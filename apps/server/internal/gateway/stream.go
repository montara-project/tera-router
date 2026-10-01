package gateway

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net/http"
	"sync"
	"time"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"

	"github.com/gofiber/fiber/v3"
)

// streamChat relays an upstream stream to the client as SSE.
//
// Two paths exist:
//
//   - Direct passthrough: when the client's dialect matches the upstream's and
//     the connector can hand back a raw body, the bytes are piped through
//     untouched while a bounded capture buffer records the head and tail for
//     post-hoc usage extraction. This is the fastest path and is used by
//     same-dialect proxying (e.g. Claude Code → Anthropic).
//   - Rendered: otherwise each canonical chunk is re-encoded by the client's
//     codec, so any client dialect can be served by any upstream dialect.
//
// The attempt is chosen BEFORE the stream writer starts: connect-time failures
// must still produce a proper HTTP status, and once the first byte is written
// the status is committed. Failures after that are rendered as an in-stream
// error chunk.
func (s *Server) streamChat(
	c fiber.Ctx,
	ctx context.Context,
	cancel context.CancelFunc,
	release func(),
	codec transform.Codec,
	req *core.ChatRequest,
	resolved resolveResult,
	attempts []attempt,
	meta requestMeta,
) error {
	echo := resolved.EchoModel
	if echo == "" {
		echo = req.Model
	}

	// Phase 1: connect. No client bytes are written until this succeeds, so a
	// connect failure can still produce a real HTTP status.
	conn, err := s.connectStream(ctx, attempts, req, codec.Dialect(), meta)
	if err != nil {
		cancel()
		release()
		pe := core.AsProviderError(err)
		s.logFailure(pe)
		return s.fail(c, meta.Dialect, statusForError(pe), pe.Message)
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")
	c.Set("X-TeraRouter-Provider", conn.at.Target.Provider)
	c.Set("X-TeraRouter-Model", echo)
	c.Status(http.StatusOK)

	// Everything the writer needs is captured here: the Fiber context is
	// pooled and must not be touched after the handler returns.
	writer := &streamWriter{
		srv:      s,
		cancel:   cancel,
		release:  release,
		codec:    codec,
		state:    streamState(echo),
		meta:     meta,
		provider: conn.at.Target.Provider,
		model:    conn.at.Target.Model,
		account:  conn.at.AccountID,
		start:    time.Now(),
		ttft:     conn.ttft,
		setTTFT:  conn.setTTFT,
	}
	if conn.raw != nil {
		writer.raw = conn.raw
		writer.capture = &safeBuffer{}
		writer.direct = true
	} else {
		writer.chunks = conn.chunks
	}

	// The stream writer runs on its own goroutine after the handler returns,
	// so Drain must wait for it: the writer is what records the stream's usage.
	s.metering.Add(1)
	return c.SendStreamWriter(func(w *bufio.Writer) {
		defer s.metering.Done()
		writer.run(ctx, w)
	})
}

// streamConn is the result of a successful connect: either a raw body for the
// passthrough path or a canonical chunk channel for the rendered path.
type streamConn struct {
	at      attempt
	raw     io.ReadCloser
	chunks  <-chan core.StreamChunk
	ttft    func() time.Duration
	setTTFT func(time.Duration)
}

// connectStream walks the attempt list until a stream connects, applying the
// same failure policy as the unary path (same-account retry for transient
// faults, cooldown and fallback otherwise).
func (s *Server) connectStream(
	ctx context.Context,
	attempts []attempt,
	req *core.ChatRequest,
	clientDialect core.Dialect,
	meta requestMeta,
) (streamConn, error) {
	var lastErr error

	for i := range attempts {
		at := attempts[i]
		if ctx.Err() != nil {
			return streamConn{}, ctx.Err()
		}

		conn, err := s.connectOne(ctx, at, req, clientDialect, meta)
		if err == nil {
			if s.combo != nil {
				s.combo.NoteSuccess(at.Target.Provider, at.Target.Model)
			}
			return conn, nil
		}
		lastErr = err

		// Feed the auto-combo engine's self-healing: a fallbackable failure
		// counts against the provider, a request-shaped one does not.
		pe := core.AsProviderError(err)
		if pe.Fallbackable() && s.combo != nil {
			s.combo.ExcludeAfterFailure(at.Target.Provider, at.Target.Model)
		}
		if !pe.Fallbackable() {
			return streamConn{}, pe
		}
	}

	if lastErr == nil {
		return streamConn{}, errNoAttempts
	}
	return streamConn{}, lastErr
}

// connectOne performs one attempt's connect, including same-account retries for
// transient faults.
func (s *Server) connectOne(
	ctx context.Context,
	at attempt,
	req *core.ChatRequest,
	clientDialect core.Dialect,
	meta requestMeta,
) (streamConn, error) {
	for try := 0; ; try++ {
		attemptReq := cloneRequest(req, at.Target.Model)

		var ttftMu sync.Mutex
		var ttft time.Duration
		recordTTFT := func(elapsed time.Duration) {
			ttftMu.Lock()
			ttft = elapsed
			ttftMu.Unlock()
		}
		cfg := core.StreamConfig{
			OnFirstChunk: recordTTFT,
		}
		firstChunk := func() time.Duration {
			ttftMu.Lock()
			defer ttftMu.Unlock()
			return ttft
		}

		started := time.Now()
		var (
			conn streamConn
			err  error
		)
		// Same-dialect requests are piped through untouched.
		if direct, ok := at.Conn.(core.DirectStreamable); ok && clientDialect == at.Conn.Dialect() {
			var body io.ReadCloser
			body, _, err = direct.StreamRaw(ctx, attemptReq, at.Creds)
			if err == nil {
				conn = streamConn{at: at, raw: body, ttft: firstChunk, setTTFT: recordTTFT}
			}
		} else {
			var chunks <-chan core.StreamChunk
			chunks, err = at.Conn.Stream(ctx, attemptReq, at.Creds, cfg)
			if err == nil {
				conn = streamConn{at: at, chunks: chunks, ttft: firstChunk}
			}
		}

		if err == nil {
			return conn, nil
		}

		latency := time.Since(started)
		pe := core.AsProviderError(err)
		if pe.AccountID == "" {
			pe.AccountID = at.AccountID
		}
		pe.Provider = at.Target.Provider
		pe.Model = at.Target.Model

		s.logFailure(pe)
		s.recordFailure(meta, at, pe, latency)
		s.noteFailure(pe)

		if !shouldRetrySameAccount(pe) || try >= sameAccountRetries {
			return streamConn{}, pe
		}
		backoff := retryBackoff(ctx, try)
		if backoff <= 0 {
			return streamConn{}, pe
		}
		s.log.Warn("gateway retrying stream connect on same account",
			"provider", at.Target.Provider, "account", at.AccountID,
			"kind", string(pe.Kind), "retry", try+1, "backoff", backoff)
		if serr := sleep(ctx, backoff); serr != nil {
			return streamConn{}, serr
		}
	}
}

// streamWriter owns the SSE response for one stream. It runs inside Fiber's
// stream writer goroutine, after the handler has returned, so it must not touch
// the Fiber context — everything it needs was captured before.
//
// Writes are serialized by writeMu because the heartbeat goroutine and the
// chunk loop both write to the same bufio.Writer.
type streamWriter struct {
	srv     *Server
	cancel  context.CancelFunc
	release func()
	codec   transform.Codec
	state   *transform.StreamState
	meta    requestMeta

	provider string
	model    string
	account  string

	start time.Time
	ttft  func() time.Duration

	// setTTFT records the first-chunk time on the passthrough path, which
	// never sees canonical chunks. It is nil on the rendered path, where the
	// connector's OnFirstChunk callback already fills ttft.
	setTTFT func(time.Duration)

	// direct marks the raw-passthrough path.
	direct  bool
	raw     io.ReadCloser
	capture *safeBuffer

	// chunks is the canonical chunk channel on the rendered path.
	chunks <-chan core.StreamChunk

	writeMu      sync.Mutex
	writeErr     error
	bytesWritten int64
	chunksSent   int

	usage core.Usage
}

// run drives the stream to completion, writing SSE bytes to w.
func (sw *streamWriter) run(ctx context.Context, w *bufio.Writer) {
	defer sw.release()
	defer sw.cancel()
	defer sw.record(ctx)

	if sw.direct {
		sw.runDirect(ctx, w)
		return
	}
	sw.runRendered(ctx, w)
}

// runDirect pipes the raw upstream body to the client while teeing it into a
// bounded capture, then parses the captured bytes for usage.
//
// The upstream model name is echoed untouched on this path (matching the
// reference): rewriting bytes mid-flight would defeat the point of a zero-copy
// relay, and same-dialect clients already sent the name they expect back.
func (sw *streamWriter) runDirect(ctx context.Context, w *bufio.Writer) {
	defer sw.raw.Close()

	// Every byte read is teed into the capture buffer so usage can be parsed
	// after the fact: the passthrough path never parses the stream inline.
	reader := io.TeeReader(sw.raw, sw.capture)

	buf := make([]byte, 32*1024)
	firstByte := true
	for {
		if ctx.Err() != nil {
			return
		}
		n, err := reader.Read(buf)
		if n > 0 {
			// The passthrough path never parses chunks, so time-to-first-token
			// is measured from the first byte the upstream produced.
			if firstByte {
				firstByte = false
				if sw.setTTFT != nil {
					sw.setTTFT(time.Since(sw.start))
				}
			}
			if !sw.writeRaw(w, buf[:n]) {
				// The client is gone: closing the body below aborts the
				// upstream request so no quota is burned for nobody.
				return
			}
		}
		if err != nil {
			if !errors.Is(err, io.EOF) && ctx.Err() == nil {
				sw.logWarn("gateway direct stream read failed", err)
			}
			return
		}
	}
}

// runRendered parses upstream events into canonical chunks, renders each into
// the client's dialect, and writes it. A heartbeat comment keeps the connection
// alive while the upstream produces nothing.
func (sw *streamWriter) runRendered(ctx context.Context, w *bufio.Writer) {
	heartbeat := time.NewTicker(heartbeatInterval)
	defer heartbeat.Stop()
	stopHeartbeat := make(chan struct{})
	var heartbeatDone sync.WaitGroup
	heartbeatDone.Add(1)
	go func() {
		defer heartbeatDone.Done()
		for {
			select {
			case <-heartbeat.C:
				// Only before the first chunk: once content flows the client
				// sees progress anyway.
				sw.writeMu.Lock()
				sent := sw.chunksSent
				sw.writeMu.Unlock()
				if sent == 0 {
					sw.writeRaw(w, []byte(": ping\n\n"))
				}
			case <-stopHeartbeat:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
	defer func() {
		close(stopHeartbeat)
		heartbeatDone.Wait()
	}()

	for chunk := range sw.chunks {
		if ctx.Err() != nil || sw.failed() {
			return
		}

		if chunk.Type == core.ChunkUsage && chunk.Usage != nil {
			sw.usage = mergeUsage(sw.usage, *chunk.Usage)
		}
		if chunk.Type == core.ChunkError {
			sw.renderError(w, chunk)
			return
		}

		events, err := sw.codec.RenderStreamChunk(chunk, sw.state)
		if err != nil {
			// A chunk the codec cannot render is a router-side bug; log it and
			// keep the stream alive rather than truncating the client's answer.
			sw.logWarn("gateway render stream chunk failed", err)
			continue
		}
		for _, ev := range events {
			sw.writeRaw(w, ev)
		}
		sw.writeMu.Lock()
		sw.chunksSent++
		sw.writeMu.Unlock()
	}

	// Close the stream cleanly. RenderStreamDone emits the dialect's terminal
	// event and closes anything left open, including when no finish chunk was
	// seen, so no synthetic finish is needed here.
	for _, ev := range sw.codec.RenderStreamDone(sw.state) {
		sw.writeRaw(w, ev)
	}
}

// renderError turns a mid-stream failure into a dialect error event, so the
// client's stream parser sees a terminal error instead of a truncated stream.
func (sw *streamWriter) renderError(w *bufio.Writer, chunk core.StreamChunk) {
	pe := core.AsProviderError(chunk.Err)
	sw.logWarn("gateway stream error", chunk.Err)
	if events, err := sw.codec.RenderStreamChunk(core.StreamChunk{
		Type: core.ChunkError,
		Err:  pe,
	}, sw.state); err == nil {
		for _, ev := range events {
			sw.writeRaw(w, ev)
		}
	}
	for _, ev := range sw.codec.RenderStreamDone(sw.state) {
		sw.writeRaw(w, ev)
	}
}

// failed reports whether a client write has already failed.
func (sw *streamWriter) failed() bool {
	sw.writeMu.Lock()
	defer sw.writeMu.Unlock()
	return sw.writeErr != nil
}

// writeRaw writes one event and flushes it, returning false when the client
// connection is gone. A latched error stops all further writes.
func (sw *streamWriter) writeRaw(w *bufio.Writer, b []byte) bool {
	if len(b) == 0 {
		return true
	}
	sw.writeMu.Lock()
	defer sw.writeMu.Unlock()
	if sw.writeErr != nil {
		return false
	}
	n, err := w.Write(b)
	sw.bytesWritten += int64(n)
	if err != nil {
		sw.writeErr = err
		return false
	}
	if err := w.Flush(); err != nil {
		sw.writeErr = err
		return false
	}
	return true
}

// record meters the completed stream: tokens, cost, latency, and TTFT.
func (sw *streamWriter) record(ctx context.Context) {
	// The usage and pricing reads must survive the stream context being
	// canceled (client disconnect, deadline), so they run detached.
	lookupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()

	usage := sw.usage
	if sw.direct && sw.capture != nil {
		usage = extractUsageFromCapture(sw.codec, sw.capture)
	}

	latency := time.Since(sw.start)
	var ttft time.Duration
	if sw.ttft != nil {
		ttft = sw.ttft()
	}

	rates, tokenRate := sw.srv.pricingFor(lookupCtx, sw.provider, sw.model)
	cost := costMicros(rates, usage)

	sw.srv.recordUsage(usageRecord{
		APIKeyID:   sw.meta.APIKeyID,
		AccountID:  sw.account,
		Provider:   sw.provider,
		Model:      sw.model,
		Client:     sw.meta.Client,
		ClientIP:   sw.meta.ClientIP,
		Usage:      usage,
		CostMicros: cost,
		TokenRate:  tokenRate,
		Latency:    latency,
		TTFT:       ttft,
	})
	sw.srv.logCompletion(sw.meta, sw.provider, sw.model,
		usage.PromptTokens+usage.CompletionTokens, latency, cost)

	if sw.failed() {
		sw.logWarn("gateway stream ended with client write error", sw.writeErr)
	}
}

// logWarn emits a warning through the server's logger.
func (sw *streamWriter) logWarn(msg string, err error) {
	sw.srv.log.Warn(msg,
		"provider", sw.provider,
		"model", sw.model,
		"account", sw.account,
		"error", err,
	)
}
