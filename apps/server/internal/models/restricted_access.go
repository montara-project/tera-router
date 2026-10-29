package models

// RestrictedAccess limits the server to an allowlist of client addresses
// during a period. Empty dates or times leave that side of the period open;
// StartTime/EndTime repeat daily and may wrap past midnight (22:00–06:00).
type RestrictedAccess struct {
	Enabled    bool     `json:"enabled"`
	StartDate  string   `json:"start_date"` // 2006-01-02, inclusive
	EndDate    string   `json:"end_date"`   // 2006-01-02, inclusive
	StartTime  string   `json:"start_time"` // 15:04
	EndTime    string   `json:"end_time"`   // 15:04, exclusive
	Timezone   string   `json:"timezone"`   // IANA name; empty means UTC
	AllowedIPs []string `json:"allowed_ips"`
}
