package dtos

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
