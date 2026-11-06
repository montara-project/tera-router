// Package consolelog is the dashboard Console feed: a process-wide ring buffer
// of plain lines (sign-ins, audit records, warnings) and one structured entry
// per gateway request. It lives outside handlers so the gateway can write to
// it too.
package consolelog

import (
	"sort"
	"strconv"
	"sync"
	"time"

	"tera-router/server/internal/dtos"
)

// Capacity bounds the ring buffer; the oldest entries drop beyond it.
const Capacity = 1000

// Session names this process's feed. Ids restart at 1 when the server
// restarts, so a client that polls with ?after= starts over when it changes.
var Session = strconv.FormatInt(time.Now().UnixNano(), 36)

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

// ListAfter returns the entries newer than id, oldest first, and the id of the
// oldest entry still in the buffer (0 when it is empty). A polling client
// appends the new entries and drops any it holds below first, which is how
// trimmed and cleared lines leave its view.
func ListAfter(id int64) (entries []dtos.ConsoleEntry, first int64) {
	feed.mu.Lock()
	defer feed.mu.Unlock()

	if len(feed.entries) > 0 {
		first = feed.entries[0].ID
	}
	// Ids only grow, so the buffer is sorted by id.
	i := sort.Search(len(feed.entries), func(i int) bool { return feed.entries[i].ID > id })
	entries = make([]dtos.ConsoleEntry, len(feed.entries)-i)
	copy(entries, feed.entries[i:])
	return entries, first
}

// Clear empties the buffer. Ids keep increasing, so a new entry never reuses
// one the client has seen.
func Clear() {
	feed.mu.Lock()
	defer feed.mu.Unlock()
	feed.entries = feed.entries[:0]
}
