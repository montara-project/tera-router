package dtos

// LogLevel classifies console feed entries.
type LogLevel string

const (
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// ConsoleEntry is one console feed line. Request is set on the one entry the
// gateway writes per API request; plain lines leave it nil.
type ConsoleEntry struct {
	ID      int64           `json:"id"`
	Time    string          `json:"time"`
	Level   LogLevel        `json:"level"`
	Message string          `json:"message"`
	Detail  string          `json:"detail,omitempty"`
	Request *ConsoleRequest `json:"request,omitempty"`
}

// ConsoleRequest is one gateway request's outcome and timeline.
type ConsoleRequest struct {
	RequestID string `json:"requestId"`
	// Endpoint is "METHOD /path".
	Endpoint string `json:"endpoint"`
	Status   int    `json:"status"`
	// Outcome is completed, failed (an upstream attempt was made) or
	// rejected (refused before any upstream was tried).
	Outcome    string `json:"outcome"`
	Reason     string `json:"reason,omitempty"`
	KeyName    string `json:"keyName,omitempty"`
	Client     string `json:"client,omitempty"`
	Model      string `json:"model,omitempty"`
	ServedBy   string `json:"servedBy,omitempty"`
	Account    string `json:"account,omitempty"`
	Tokens     int    `json:"tokens"`
	DurationMs int64  `json:"durationMs"`
	// StartedAt is RFC 3339 with milliseconds (UTC).
	StartedAt string         `json:"startedAt"`
	Events    []ConsoleEvent `json:"events"`
}

// ConsoleEvent is one step of a request's timeline, offset from its start.
type ConsoleEvent struct {
	OffsetMs int64  `json:"offsetMs"`
	Kind     string `json:"kind"`
	Text     string `json:"text"`
}
