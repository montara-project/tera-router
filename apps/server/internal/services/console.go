package services

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
	ID      int64     `json:"id"`
	Time    string    `json:"time"`
	Level   LogLevel  `json:"level"`
	Message string    `json:"message"`
	Detail  string    `json:"detail,omitempty"`
	At      time.Time `json:"-"`
}

// ConsoleService keeps the in-memory console ring buffer the dashboard
// polls. Mirrors IDRouter's consolelog ring buffer.
type ConsoleService struct {
	mu      sync.Mutex
	entries []ConsoleEntry
	nextID  int64
}

// consoleCapacity bounds the ring buffer; the web client renders at most 500.
const consoleCapacity = 500

func NewConsoleService() *ConsoleService {
	return &ConsoleService{entries: make([]ConsoleEntry, 0, consoleCapacity)}
}

// Push appends one entry, dropping the oldest beyond capacity.
func (s *ConsoleService) Push(level LogLevel, message, detail string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.nextID++
	s.entries = append(s.entries, ConsoleEntry{
		ID:      s.nextID,
		Time:    time.Now().UTC().Format("15:04:05.000"),
		Level:   level,
		Message: message,
		Detail:  detail,
		At:      time.Now().UTC(),
	})
	if len(s.entries) > consoleCapacity {
		s.entries = s.entries[len(s.entries)-consoleCapacity:]
	}
}

// List returns a snapshot of the buffer, newest last.
func (s *ConsoleService) List() []ConsoleEntry {
	s.mu.Lock()
	defer s.mu.Unlock()

	out := make([]ConsoleEntry, len(s.entries))
	copy(out, s.entries)
	return out
}

// Clear empties the buffer.
func (s *ConsoleService) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = s.entries[:0]
}

// Debugf logs a formatted debug line into the feed.
func (s *ConsoleService) Debugf(format string, args ...any) {
	s.Push(LogLevelDebug, fmt.Sprintf(format, args...), "")
}
