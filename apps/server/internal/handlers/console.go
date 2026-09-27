package handlers

import (
	"fmt"
	"sync"
	"time"
)

// LogLevel classifies console feed entries.
type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// ConsoleEntry is one console feed line.
type ConsoleEntry struct {
	ID      int64    `json:"id"`
	Time    string   `json:"time"`
	Level   LogLevel `json:"level"`
	Message string   `json:"message"`
	Detail  string   `json:"detail,omitempty"`
}

// consoleCapacity bounds the ring buffer; the web client renders at most 500.
const consoleCapacity = 500

var console = struct {
	mu      sync.Mutex
	entries []ConsoleEntry
	nextID  int64
}{entries: make([]ConsoleEntry, 0, consoleCapacity)}

// ConsolePush appends one entry to the console ring buffer, dropping the
// oldest beyond capacity. Process-wide, mirroring IDRouter's consolelog.
func ConsolePush(level LogLevel, message, detail string) {
	console.mu.Lock()
	defer console.mu.Unlock()

	console.nextID++
	console.entries = append(console.entries, ConsoleEntry{
		ID:      console.nextID,
		Time:    time.Now().UTC().Format("15:04:05.000"),
		Level:   level,
		Message: message,
		Detail:  detail,
	})
	if len(console.entries) > consoleCapacity {
		console.entries = console.entries[len(console.entries)-consoleCapacity:]
	}
}

// ConsoleList returns a snapshot of the buffer, newest last.
func ConsoleList() []ConsoleEntry {
	console.mu.Lock()
	defer console.mu.Unlock()

	out := make([]ConsoleEntry, len(console.entries))
	copy(out, console.entries)
	return out
}

// ConsoleClear empties the buffer.
func ConsoleClear() {
	console.mu.Lock()
	defer console.mu.Unlock()
	console.entries = console.entries[:0]
}

// consoleInfof logs a formatted info line into the feed.
func consoleInfof(format string, args ...any) {
	ConsolePush(LogLevelInfo, fmt.Sprintf(format, args...), "")
}
