package gateway

import (
	"strings"
	"testing"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"
)

func TestSafeBufferKeepsHeadAndTail(t *testing.T) {
	t.Run("small stream is returned whole", func(t *testing.T) {
		var buf safeBuffer
		payload := []byte("hello world")
		if _, err := buf.Write(payload); err != nil {
			t.Fatalf("write: %v", err)
		}
		if got := string(buf.Bytes()); got != "hello world" {
			t.Errorf("bytes = %q, want the whole stream", got)
		}
	})

	t.Run("large stream keeps head and tail", func(t *testing.T) {
		var buf safeBuffer
		head := strings.Repeat("H", captureHeadSize)
		middle := strings.Repeat("M", captureTailSize)
		tail := strings.Repeat("T", 1024)

		if _, err := buf.Write([]byte(head)); err != nil {
			t.Fatal(err)
		}
		if _, err := buf.Write([]byte(middle)); err != nil {
			t.Fatal(err)
		}
		if _, err := buf.Write([]byte(tail)); err != nil {
			t.Fatal(err)
		}

		got := buf.Bytes()
		if !strings.HasPrefix(string(got), head) {
			t.Error("captured bytes must start with the head window")
		}
		if !strings.HasSuffix(string(got), tail) {
			t.Error("captured bytes must end with the tail window")
		}
		if len(got) > captureHeadSize+captureTailSize {
			t.Errorf("capture = %d bytes, want <= %d", len(got), captureHeadSize+captureTailSize)
		}
		// The head must not be duplicated when the total exceeds both windows.
		if strings.Count(string(got), head) != 1 {
			t.Error("head window duplicated")
		}
	})

	t.Run("stream exactly at the head boundary is not duplicated", func(t *testing.T) {
		var buf safeBuffer
		payload := strings.Repeat("X", captureHeadSize)
		if _, err := buf.Write([]byte(payload)); err != nil {
			t.Fatal(err)
		}
		if got := string(buf.Bytes()); got != payload {
			t.Errorf("bytes = %d chars, want exactly %d", len(got), len(payload))
		}
	})

	t.Run("reports the full written length", func(t *testing.T) {
		var buf safeBuffer
		n, err := buf.Write([]byte("abc"))
		if err != nil || n != 3 {
			t.Errorf("Write = (%d, %v), want (3, nil)", n, err)
		}
	})
}

func TestExtractUsageFromCaptureOpenAI(t *testing.T) {
	codec, err := transform.DefaultRegistry().Codec(core.DialectOpenAI)
	if err != nil {
		t.Fatalf("codec: %v", err)
	}

	// A realistic OpenAI stream: deltas, then a usage-bearing final chunk.
	stream := strings.Join([]string{
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}`,
		"",
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		"",
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","model":"gpt-4o","choices":[],"usage":{"prompt_tokens":120,"completion_tokens":7,"total_tokens":127,"prompt_tokens_details":{"cached_tokens":40}}}`,
		"",
		"data: [DONE]",
		"",
	}, "\n")

	var capture safeBuffer
	if _, err := capture.Write([]byte(stream)); err != nil {
		t.Fatalf("capture: %v", err)
	}

	usage := extractUsageFromCapture(codec, &capture)
	if usage.PromptTokens != 120 {
		t.Errorf("prompt = %d, want 120", usage.PromptTokens)
	}
	if usage.CompletionTokens != 7 {
		t.Errorf("completion = %d, want 7", usage.CompletionTokens)
	}
	if usage.CachedTokens != 40 {
		t.Errorf("cached = %d, want 40", usage.CachedTokens)
	}
}

func TestExtractUsageFromCaptureAnthropic(t *testing.T) {
	codec, err := transform.DefaultRegistry().Codec(core.DialectAnthropic)
	if err != nil {
		t.Fatalf("codec: %v", err)
	}

	// Anthropic splits accounting: input (plus cache fields) at message_start,
	// output at message_delta.
	stream := strings.Join([]string{
		`event: message_start`,
		`data: {"type":"message_start","message":{"id":"msg_1","model":"claude-3-5-sonnet","usage":{"input_tokens":100,"cache_read_input_tokens":25,"cache_creation_input_tokens":5,"output_tokens":1}}}`,
		"",
		`event: content_block_delta`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}`,
		"",
		`event: message_delta`,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42}}`,
		"",
		`event: message_stop`,
		`data: {"type":"message_stop"}`,
		"",
	}, "\n")

	var capture safeBuffer
	if _, err := capture.Write([]byte(stream)); err != nil {
		t.Fatalf("capture: %v", err)
	}

	usage := extractUsageFromCapture(codec, &capture)
	// Canonical prompt = input + cache_read + cache_write.
	if usage.PromptTokens != 130 {
		t.Errorf("prompt = %d, want 130 (100+25+5)", usage.PromptTokens)
	}
	if usage.CompletionTokens != 42 {
		t.Errorf("completion = %d, want 42", usage.CompletionTokens)
	}
	if usage.CachedTokens != 25 {
		t.Errorf("cached = %d, want 25", usage.CachedTokens)
	}
	if usage.CacheWriteTokens != 5 {
		t.Errorf("cache write = %d, want 5", usage.CacheWriteTokens)
	}
}

func TestExtractUsageFromCaptureHandlesTruncatedStream(t *testing.T) {
	codec, err := transform.DefaultRegistry().Codec(core.DialectOpenAI)
	if err != nil {
		t.Fatalf("codec: %v", err)
	}

	// A stream cut mid-event: whatever parsed before the break must survive
	// rather than being discarded.
	stream := "data: {\"choices\":[{\"delta\":{\"content\":\"hi\"},\"finish_reason\":null}]}\n\n" +
		"data: {\"usage\":{\"prompt_tokens\":50,\"completion_tokens\":5}}\n\n" +
		"data: {\"choices\":[{\"del"

	var capture safeBuffer
	if _, err := capture.Write([]byte(stream)); err != nil {
		t.Fatalf("capture: %v", err)
	}

	usage := extractUsageFromCapture(codec, &capture)
	if usage.PromptTokens != 50 || usage.CompletionTokens != 5 {
		t.Errorf("usage = %+v, want the pre-truncation values", usage)
	}
}

func TestExtractUsageFromCaptureNoUsage(t *testing.T) {
	codec, err := transform.DefaultRegistry().Codec(core.DialectOpenAI)
	if err != nil {
		t.Fatalf("codec: %v", err)
	}

	var capture safeBuffer
	if _, err := capture.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\n")); err != nil {
		t.Fatal(err)
	}
	if usage := extractUsageFromCapture(codec, &capture); usage != (core.Usage{}) {
		t.Errorf("usage = %+v, want zero when the stream reports none", usage)
	}
}

func TestExtractUsageFromCaptureNilInputs(t *testing.T) {
	if usage := extractUsageFromCapture(nil, &safeBuffer{}); usage != (core.Usage{}) {
		t.Errorf("nil codec: usage = %+v, want zero", usage)
	}
	codec, _ := transform.DefaultRegistry().Codec(core.DialectOpenAI)
	if usage := extractUsageFromCapture(codec, nil); usage != (core.Usage{}) {
		t.Errorf("nil capture: usage = %+v, want zero", usage)
	}
}

// TestStreamRenderingProducesValidEventSequence exercises the rendered path end
// to end: canonical chunks go through the client codec and the resulting byte
// stream is re-parsed with the SSE reader, proving the sequence is
// well-formed for each client dialect.
func TestStreamRenderingProducesValidEventSequence(t *testing.T) {
	chunks := []core.StreamChunk{
		{Type: core.ChunkText, Delta: "Hello"},
		{Type: core.ChunkText, Delta: " world"},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{ID: "call_1", Name: "lookup", Arguments: []byte(`{"q":`)}},
		{Type: core.ChunkToolCall, Index: 0, ToolCall: &core.ToolCall{Arguments: []byte(`"x"}`)}},
		{Type: core.ChunkUsage, Usage: &core.Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15}},
		{Type: core.ChunkFinish, FinishReason: core.FinishToolCalls},
	}

	for _, dialect := range []core.Dialect{
		core.DialectOpenAI,
		core.DialectAnthropic,
		core.DialectOpenAIResponses,
	} {
		t.Run(string(dialect), func(t *testing.T) {
			codec, err := transform.DefaultRegistry().Codec(dialect)
			if err != nil {
				t.Fatalf("codec: %v", err)
			}

			state := streamState("my-alias")
			var raw []byte
			for _, chunk := range chunks {
				events, err := codec.RenderStreamChunk(chunk, state)
				if err != nil {
					t.Fatalf("render %s: %v", chunk.Type, err)
				}
				for _, ev := range events {
					raw = append(raw, ev...)
				}
			}
			for _, ev := range codec.RenderStreamDone(state) {
				raw = append(raw, ev...)
			}

			if len(raw) == 0 {
				t.Fatal("rendered stream is empty")
			}

			// The byte stream must be parseable as SSE.
			var events int
			if err := transform.ReadSSE(strings.NewReader(string(raw)), func(string, []byte) error {
				events++
				return nil
			}); err != nil {
				t.Fatalf("ReadSSE over the rendered stream: %v", err)
			}
			if events == 0 {
				t.Fatal("rendered stream contained no SSE events")
			}

			// Every event must terminate with a blank line.
			if !strings.HasSuffix(string(raw), "\n\n") {
				t.Errorf("stream does not end with a blank line: %q", string(raw[max(0, len(raw)-40):]))
			}
		})
	}
}

func TestStreamStatePresetsEchoModel(t *testing.T) {
	state := streamState("my-alias")
	if state.Model != "my-alias" {
		t.Errorf("state model = %q, want my-alias", state.Model)
	}
}
