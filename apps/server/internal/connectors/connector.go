package connectors

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"
)

// connector is the single provider driver implementation. The wire dialect is
// a parameter: request rendering, response parsing and stream parsing are all
// delegated to the matching transform.Codec, while this type owns the transport
// mechanics (endpoint, auth headers, streaming) that differ only in small,
// dialect-specific ways.
type connector struct {
	id          string
	dialect     core.Dialect
	defaultBase string
	codec       transform.Codec
}

var (
	_ core.Connector        = (*connector)(nil)
	_ core.DirectStreamable = (*connector)(nil)
)

func (c *connector) ID() string            { return c.id }
func (c *connector) Dialect() core.Dialect { return c.dialect }

// errStopStream aborts the SSE read loop without being reported as a failure
// (either the consumer went away or a terminal error chunk was already sent).
var errStopStream = errors.New("connectors: stop stream")

// Chat performs a non-streaming completion.
func (c *connector) Chat(ctx context.Context, req *core.ChatRequest, creds core.Credentials) (*core.ChatResponse, error) {
	cl := call{provider: c.id, model: req.Model, accountID: creds.AccountID, creds: creds}

	// Some upstreams (notably the Codex backend) reject stream=false outright,
	// so the unary call is served by opening the stream and folding the
	// canonical chunks back into a single response.
	if c.requiresStream() {
		return c.chatViaStream(ctx, req, creds)
	}

	body, err := c.render(req, false, creds)
	if err != nil {
		return nil, cl.internal(err)
	}
	resp, err := doJSON(ctx, cl, c.endpoint(creds), body, c.headers(creds))
	if err != nil {
		return nil, err
	}

	// Some OpenAI-compatible upstreams answer even a non-streaming request
	// with an SSE stream; parse it through the stream path and aggregate.
	if isSSEBody(resp.contentType, resp.body) {
		return c.aggregateBody(ctx, cl, bytes.NewReader(resp.body))
	}

	// A few providers report credit exhaustion as a 200 with a human-readable
	// body instead of an error status. Detect it before parsing so the
	// dispatcher falls back to another account rather than surfacing a
	// confusing parse failure.
	if isCreditExhausted(resp.body) && !hasCompletionEnvelope(resp.body) {
		return nil, &core.ProviderError{
			Kind:      core.ErrBilling,
			Provider:  c.id,
			Model:     req.Model,
			AccountID: creds.AccountID,
			Message:   "upstream credits exhausted: " + truncateMessage(string(resp.body)),
		}
	}

	out, perr := c.codec.ParseResponse(resp.body, req.Model)
	if perr != nil {
		return nil, &core.ProviderError{
			Kind:      core.ErrUpstream,
			Provider:  c.id,
			Model:     req.Model,
			AccountID: creds.AccountID,
			Message:   perr.Error(),
			Cause:     perr,
		}
	}
	return out, nil
}

// chatViaStream serves a unary call by consuming the upstream's SSE stream.
func (c *connector) chatViaStream(ctx context.Context, req *core.ChatRequest, creds core.Credentials) (*core.ChatResponse, error) {
	cl := call{provider: c.id, model: req.Model, accountID: creds.AccountID, creds: creds}
	body, err := c.render(req, true, creds)
	if err != nil {
		return nil, cl.internal(err)
	}
	resp, err := openStream(ctx, cl, c.endpoint(creds), body, c.headers(creds))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return c.aggregateBody(ctx, cl, resp.Body)
}

// aggregateBody drains an SSE body and folds the canonical chunks into a single
// non-streaming response.
func (c *connector) aggregateBody(ctx context.Context, cl call, body io.Reader) (*core.ChatResponse, error) {
	chunks, err := c.parseStreamBody(ctx, cl, body)
	if err != nil {
		return nil, err
	}
	return cl.aggregate(cl.model, chunks)
}

// parseStreamBody reads every SSE event from body through the codec, returning
// the canonical chunks. An upstream error event aborts the read and is returned
// as a classified *core.ProviderError.
func (c *connector) parseStreamBody(ctx context.Context, cl call, body io.Reader) ([]core.StreamChunk, error) {
	state := &transform.StreamState{Model: cl.model}
	var chunks []core.StreamChunk

	readErr := transform.ReadSSE(body, func(event string, data []byte) error {
		parsed, perr := c.codec.ParseStreamEvent(event, data, state)
		if perr != nil {
			// Skip a single malformed event rather than discarding the whole
			// response; a terminal error event is surfaced as a chunk instead.
			return nil
		}
		for _, ch := range parsed {
			if ch.Type == core.ChunkError {
				return cl.wrapStreamError(ch.Err)
			}
			chunks = append(chunks, ch)
		}
		return nil
	})
	if readErr != nil {
		var pe *core.ProviderError
		if errors.As(readErr, &pe) {
			return nil, pe
		}
		return nil, cl.readError(ctx, readErr)
	}
	return chunks, nil
}

// Stream performs a streaming completion, emitting canonical chunks on the
// returned channel until it is closed. Connect-time failures (non-2xx status,
// transport errors) are returned as err before any chunk is sent.
func (c *connector) Stream(ctx context.Context, req *core.ChatRequest, creds core.Credentials, cfg core.StreamConfig) (<-chan core.StreamChunk, error) {
	cl := call{provider: c.id, model: req.Model, accountID: creds.AccountID, creds: creds}
	body, err := c.render(req, true, creds)
	if err != nil {
		return nil, cl.internal(err)
	}
	resp, err := openStream(ctx, cl, c.endpoint(creds), body, c.headers(creds))
	if err != nil {
		return nil, err
	}

	out := make(chan core.StreamChunk, streamBufferSize)
	go func() {
		defer close(out)
		defer resp.Body.Close()

		start := time.Now()
		state := &transform.StreamState{Model: req.Model}
		var (
			ttftReported bool
			meaningful   int
			finished     bool
			errored      bool
		)

		readErr := transform.ReadSSE(resp.Body, func(event string, data []byte) error {
			parsed, perr := c.codec.ParseStreamEvent(event, data, state)
			if perr != nil {
				// A malformed event must not kill an otherwise healthy stream.
				return nil
			}
			for _, ch := range parsed {
				if !ttftReported && isMeaningfulChunk(ch) {
					ttftReported = true
					if cfg.OnFirstChunk != nil {
						cfg.OnFirstChunk(time.Since(start))
					}
				}
				switch ch.Type {
				case core.ChunkText, core.ChunkThinking:
					if ch.Delta != "" {
						meaningful++
					}
				case core.ChunkToolCall:
					if ch.ToolCall != nil {
						meaningful++
					}
				case core.ChunkFinish:
					finished = true
				case core.ChunkError:
					errored = true
					ch.Err = cl.wrapStreamError(ch.Err)
				}
				select {
				case out <- ch:
				case <-ctx.Done():
					return errStopStream
				}
				if errored {
					// The upstream reported a terminal failure; stop reading.
					return errStopStream
				}
			}
			return nil
		})

		switch {
		case errors.Is(ctx.Err(), context.Canceled):
			// The caller hung up; there is nobody left to report to.
			return
		case readErr != nil && !errors.Is(readErr, errStopStream):
			// A read killed by the context deadline is promoted to ErrTimeout
			// by readError, so a stalled upstream is classified as such rather
			// than as a clean end of stream.
			out <- core.StreamChunk{Type: core.ChunkError, Err: cl.readError(ctx, readErr)}
		case errored:
			// A terminal error chunk was already delivered.
		case meaningful == 0 && !finished:
			out <- core.StreamChunk{Type: core.ChunkError, Err: &core.ProviderError{
				Kind:      core.ErrEmptyStream,
				Provider:  c.id,
				Model:     req.Model,
				AccountID: creds.AccountID,
				Message:   "upstream closed the stream without any content",
			}}
		}
	}()
	return out, nil
}

// StreamRaw opens a streaming connection and hands the raw SSE body to the
// caller for zero-copy, same-dialect piping. Connect-time failures are
// classified exactly like Stream.
func (c *connector) StreamRaw(ctx context.Context, req *core.ChatRequest, creds core.Credentials) (io.ReadCloser, http.Header, error) {
	cl := call{provider: c.id, model: req.Model, accountID: creds.AccountID, creds: creds}
	body, err := c.render(req, true, creds)
	if err != nil {
		return nil, nil, cl.internal(err)
	}
	resp, err := openStream(ctx, cl, c.endpoint(creds), body, c.headers(creds))
	if err != nil {
		return nil, nil, err
	}
	return resp.Body, resp.Header, nil
}

// render encodes the canonical request for this dialect. The caller's request
// is never mutated: the stream flag and any credential-specific preamble (the
// Claude Code system prompt Anthropic OAuth tokens require) go on a copy.
func (c *connector) render(req *core.ChatRequest, stream bool, creds core.Credentials) ([]byte, error) {
	clone := *req
	clone.Stream = stream
	if c.dialect == core.DialectAnthropic && anthropicOAuth(creds) {
		clone.SystemPreamble = ClaudeCodeSystemPrompt
	}
	return c.codec.RenderRequest(&clone, c.id)
}

// requiresStream reports whether the upstream only accepts stream=true.
func (c *connector) requiresStream() bool {
	return c.id == "codex"
}

// hasCompletionEnvelope reports whether a body is a well-formed completion
// response: an OpenAI chat.completion carries "choices", a Responses API object
// carries "output". Used to avoid misreading a legitimate response whose text
// merely mentions credits as a billing failure.
func hasCompletionEnvelope(body []byte) bool {
	var probe struct {
		Choices []json.RawMessage `json:"choices"`
		Output  []json.RawMessage `json:"output"`
	}
	if err := json.Unmarshal(body, &probe); err != nil {
		return false
	}
	return len(probe.Choices) > 0 || len(probe.Output) > 0
}

// isMeaningfulChunk reports whether a chunk represents actual model output,
// used for the TTFT callback and the empty-stream check. Usage, finish and ping
// chunks carry no output.
func isMeaningfulChunk(ch core.StreamChunk) bool {
	switch ch.Type {
	case core.ChunkText, core.ChunkThinking:
		return ch.Delta != ""
	case core.ChunkToolCall:
		return ch.ToolCall != nil && (ch.ToolCall.ID != "" || ch.ToolCall.Name != "")
	default:
		return false
	}
}

// isSSEBody reports whether a unary response is really an SSE stream. Some
// gateways always stream and some omit the Content-Type, so the body prefix is
// sniffed as a fallback.
func isSSEBody(contentType string, body []byte) bool {
	if strings.Contains(strings.ToLower(contentType), "text/event-stream") {
		return true
	}
	trimmed := bytes.TrimSpace(body)
	return len(trimmed) > 0 && (bytes.HasPrefix(trimmed, []byte("data:")) || bytes.HasPrefix(trimmed, []byte(":")))
}

// wrapStreamError normalizes a mid-stream error into a *core.ProviderError
// carrying this attempt's identifiers.
func (c call) wrapStreamError(err error) *core.ProviderError {
	if err == nil {
		err = errors.New("upstream stream error")
	}
	var pe *core.ProviderError
	if errors.As(err, &pe) {
		if pe.Provider == "" {
			pe.Provider = c.provider
		}
		if pe.Model == "" {
			pe.Model = c.model
		}
		if pe.AccountID == "" {
			pe.AccountID = c.accountID
		}
		return pe
	}
	return &core.ProviderError{
		Kind:      core.ErrUpstream,
		Provider:  c.provider,
		Model:     c.model,
		AccountID: c.accountID,
		Message:   err.Error(),
		Cause:     err,
	}
}

// aggregate folds a canonical chunk sequence into a single non-streaming
// response. It is used for upstreams that only speak SSE (the Codex backend)
// and for unary responses that turn out to be streams.
//
// An upstream error chunk is returned as a *core.ProviderError; a sequence with
// no content and no tool calls is an ErrEmptyResponse.
func (c call) aggregate(model string, chunks []core.StreamChunk) (*core.ChatResponse, error) {
	var (
		text     strings.Builder
		thinking strings.Builder
		usage    core.Usage
		finish   core.FinishReason
	)

	type pendingCall struct {
		id, name string
		args     strings.Builder
	}
	calls := map[int]*pendingCall{}
	var order []int

	for _, ch := range chunks {
		switch ch.Type {
		case core.ChunkText:
			text.WriteString(ch.Delta)
		case core.ChunkThinking:
			thinking.WriteString(ch.Delta)
		case core.ChunkToolCall:
			cur, ok := calls[ch.Index]
			if !ok {
				cur = &pendingCall{}
				calls[ch.Index] = cur
				order = append(order, ch.Index)
			}
			if ch.ToolCall != nil {
				if ch.ToolCall.ID != "" {
					cur.id = ch.ToolCall.ID
				}
				if ch.ToolCall.Name != "" {
					cur.name = ch.ToolCall.Name
				}
				cur.args.Write(ch.ToolCall.Arguments)
			}
		case core.ChunkUsage:
			if ch.Usage != nil {
				total := usage.TotalTokens
				usage.Merge(*ch.Usage)
				if ch.Usage.TotalTokens == 0 {
					// The aggregate path keeps a total only when an upstream
					// states one; it does not synthesise one from the partial
					// counts.
					usage.TotalTokens = total
				}
			}
		case core.ChunkFinish:
			if ch.FinishReason != "" {
				finish = ch.FinishReason
			}
		case core.ChunkError:
			return nil, c.wrapStreamError(ch.Err)
		}
	}

	var parts []core.ContentPart
	if thinking.Len() > 0 {
		parts = append(parts, core.ContentPart{Type: core.PartThinking, Text: thinking.String()})
	}
	if text.Len() > 0 {
		parts = append(parts, core.ContentPart{Type: core.PartText, Text: text.String()})
	}
	if len(order) > 0 {
		sort.Ints(order)
		for _, idx := range order {
			cur := calls[idx]
			args := cur.args.String()
			if args == "" {
				// A tool call that streamed no argument fragments still needs a
				// valid JSON object for the canonical representation.
				args = "{}"
			}
			parts = append(parts, core.ContentPart{Type: core.PartToolCall, ToolCall: &core.ToolCall{
				ID:        cur.id,
				Name:      cur.name,
				Arguments: json.RawMessage(args),
			}})
		}
	}

	if len(parts) == 0 {
		return nil, &core.ProviderError{
			Kind:      core.ErrEmptyResponse,
			Provider:  c.provider,
			Model:     model,
			AccountID: c.accountID,
			Message:   "upstream stream produced no content",
		}
	}

	switch {
	case finish == "":
		finish = core.FinishStop
	case finish == core.FinishStop && len(order) > 0:
		// A stream that emitted tool calls cannot have stopped naturally.
		finish = core.FinishToolCalls
	}

	return &core.ChatResponse{
		Model:        model,
		Message:      core.Message{Role: core.RoleAssistant, Content: parts},
		FinishReason: finish,
		Usage:        usage,
	}, nil
}
