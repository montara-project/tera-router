package transform

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
)

// maxSSELine bounds a single SSE line; large tool-call argument deltas and
// base64 image chunks can exceed bufio's 64 KiB default.
const maxSSELine = 8 << 20 // 8 MiB

// ReadSSE parses a Server-Sent Events stream, invoking fn once per dispatched
// event with the event name ("" when absent) and the data lines joined by
// "\n". Comment lines and events without data are skipped. It returns fn's
// first error, the reader's error, or nil at EOF.
func ReadSSE(r io.Reader, fn func(event string, data []byte) error) error {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), maxSSELine)

	var event string
	var data bytes.Buffer
	hasData := false

	dispatch := func() error {
		defer func() {
			event = ""
			data.Reset()
			hasData = false
		}()
		if !hasData {
			return nil
		}
		return fn(event, data.Bytes())
	}

	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			if err := dispatch(); err != nil {
				return err
			}
			continue
		}
		if line[0] == ':' {
			continue
		}
		field, value, _ := bytes.Cut(line, []byte(":"))
		value = bytes.TrimPrefix(value, []byte(" "))
		switch string(field) {
		case "event":
			event = string(value)
		case "data":
			if hasData {
				data.WriteByte('\n')
			}
			data.Write(value)
			hasData = true
		}
	}
	if err := sc.Err(); err != nil {
		return err
	}
	return dispatch()
}

// SSEEvent formats one SSE event. An empty name emits a data-only event.
func SSEEvent(name string, data []byte) []byte {
	var b bytes.Buffer
	if name != "" {
		b.WriteString("event: ")
		b.WriteString(name)
		b.WriteByte('\n')
	}
	b.WriteString("data: ")
	b.Write(data)
	b.WriteString("\n\n")
	return b.Bytes()
}

// sseJSON renders one SSE event whose data is the JSON encoding of payload.
// A payload that cannot be marshalled degrades to an empty object so the client
// never receives a malformed frame.
func sseJSON(name string, payload any) []byte {
	b, err := json.Marshal(payload)
	if err != nil {
		b = []byte(`{}`)
	}
	return SSEEvent(name, b)
}
