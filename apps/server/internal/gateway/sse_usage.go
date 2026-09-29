package gateway

import (
	"bytes"
	"sync"

	"tera-router/server/internal/core"
	"tera-router/server/internal/transform"
)

// Usage extraction from a passthrough stream.
//
// The zero-copy path forwards raw upstream bytes without parsing them, so token
// accounting has to happen afterwards from a copy of what went past. Usage is
// reported at the edges of a stream — Anthropic puts input tokens in the first
// event and output tokens in the last — so the capture keeps a head window and
// a rolling tail window rather than the whole stream.

const (
	// captureHeadSize holds the stream prefix (Anthropic's message_start
	// carries input_tokens there).
	captureHeadSize = 4 << 10 // 4 KiB
	// captureTailSize is a rolling window of the most recent bytes, which is
	// where the final usage event lands.
	captureTailSize = 256 << 10 // 256 KiB
)

// safeBuffer is a bounded io.Writer that keeps the first captureHeadSize bytes
// and the last captureTailSize bytes of everything written to it. It is safe
// for concurrent use.
type safeBuffer struct {
	mu       sync.Mutex
	head     bytes.Buffer
	tail     bytes.Buffer
	total    int
	headDone bool
}

// Write records p, keeping the head window once and the tail window rolling.
func (b *safeBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	n := len(p)
	b.total += n

	if !b.headDone {
		remain := captureHeadSize - b.head.Len()
		if remain > 0 {
			if n <= remain {
				b.head.Write(p)
			} else {
				b.head.Write(p[:remain])
			}
		}
		if b.head.Len() >= captureHeadSize {
			b.headDone = true
		}
	}

	b.tail.Write(p)
	if b.tail.Len() > captureTailSize {
		old := b.tail.Bytes()
		trimmed := old[len(old)-captureTailSize:]
		b.tail.Reset()
		b.tail.Write(trimmed)
	}

	return n, nil
}

// Bytes returns the captured bytes: the whole stream when it was short enough
// to fit, otherwise the head window followed by the tail window.
//
// A stream that fit entirely in the tail window is returned from tail alone —
// appending the head would duplicate its first 4 KiB.
func (b *safeBuffer) Bytes() []byte {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.total <= captureHeadSize+captureTailSize {
		return b.tail.Bytes()
	}
	out := make([]byte, 0, b.head.Len()+b.tail.Len())
	out = append(out, b.head.Bytes()...)
	out = append(out, b.tail.Bytes()...)
	return out
}

// extractUsageFromCapture parses captured raw SSE bytes with the given codec and
// accumulates every usage event found. Upstreams split accounting across events
// (Anthropic reports input tokens at message start and output tokens at message
// end), so usage is merged rather than replaced.
//
// A malformed capture yields whatever was parsed before the failure: losing
// usage on a corrupt stream is preferable to failing the request.
func extractUsageFromCapture(codec transform.Codec, capture *safeBuffer) core.Usage {
	if codec == nil || capture == nil {
		return core.Usage{}
	}

	state := &transform.StreamState{}
	var usage core.Usage
	_ = transform.ReadSSE(bytes.NewReader(capture.Bytes()), func(event string, data []byte) error {
		chunks, err := codec.ParseStreamEvent(event, data, state)
		if err != nil {
			return nil // skip unparseable events, keep scanning
		}
		for _, chunk := range chunks {
			if chunk.Type == core.ChunkUsage && chunk.Usage != nil {
				usage = mergeUsage(usage, *chunk.Usage)
			}
		}
		return nil
	})
	return usage
}
