// Package consolelog is the dashboard Console feed: a process-wide ring buffer
// of plain lines (sign-ins, audit records, warnings) and one structured entry
// per gateway request. It lives outside handlers so the gateway can write to
// it too.
package consolelog

import (
	"sync"
	"time"

	"tera-router/server/internal/dtos"
)

// Capacity bounds the ring buffer; the oldest entries drop beyond it.
const Capacity = 1000

var feed = struct {
	mu      sync.Mutex
	entries []dtos.ConsoleEntry
	nextID  int64
}{entries: make([]dtos.ConsoleEntry, 0, Capacity)}

// Push appends a plain line stamped with the current time.
func Push(level dtos.LogLevel, message, detail string) {
	PushEntry(dtos.ConsoleEntry{Level: level, Message: message, Detail: detail}, time.Now())
}

// PushEntry appends an entry that happened at `at` and returns its id. The id
// and time are assigned here; anything else on the entry is kept.
func PushEntry(e dtos.ConsoleEntry, at time.Time) int64 {
	feed.mu.Lock()
	defer feed.mu.Unlock()

	feed.nextID++
	e.ID = feed.nextID
	e.Time = at.UTC().Format("15:04:05.000")
	feed.entries = append(feed.entries, e)
	if len(feed.entries) > Capacity {
		feed.entries = feed.entries[len(feed.entries)-Capacity:]
	}
	return e.ID
}

// List returns a snapshot of the buffer, oldest first.
func List() []dtos.ConsoleEntry {
	feed.mu.Lock()
	defer feed.mu.Unlock()

	out := make([]dtos.ConsoleEntry, len(feed.entries))
	copy(out, feed.entries)
	return out
}

// Clear empties the buffer. Ids keep increasing, so a new entry never reuses
// one the client has seen.
func Clear() {
	feed.mu.Lock()
	defer feed.mu.Unlock()
	feed.entries = feed.entries[:0]
}
