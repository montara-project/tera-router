package handlers

import (
	"fmt"
	"sync"
	"time"

	"tera-router/server/internal/dtos"
)

// consoleCapacity bounds the ring buffer; the web client renders at most 500.
const consoleCapacity = 500

var console = struct {
	mu      sync.Mutex
	entries []dtos.ConsoleEntry
	nextID  int64
}{entries: make([]dtos.ConsoleEntry, 0, consoleCapacity)}

// ConsolePush appends one entry to the console ring buffer, dropping the
// oldest beyond capacity. Process-wide, mirroring IDRouter's consolelog.
func ConsolePush(level dtos.LogLevel, message, detail string) {
	console.mu.Lock()
	defer console.mu.Unlock()

	console.nextID++
	console.entries = append(console.entries, dtos.ConsoleEntry{
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
func ConsoleList() []dtos.ConsoleEntry {
	console.mu.Lock()
	defer console.mu.Unlock()

	out := make([]dtos.ConsoleEntry, len(console.entries))
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
	ConsolePush(dtos.LogLevelInfo, fmt.Sprintf(format, args...), "")
}
