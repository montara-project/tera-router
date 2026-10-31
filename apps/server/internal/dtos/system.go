package dtos

// SystemStatus is the dashboard's gateway status card: whether the gateway
// is serving, how long this process has run, and where it listens.
type SystemStatus struct {
	Status        string `json:"status"`
	Version       string `json:"version"`
	UptimeSeconds int64  `json:"uptime_seconds"`
	ListenAddr    string `json:"listen_addr"`
	Database      string `json:"database"`
}
