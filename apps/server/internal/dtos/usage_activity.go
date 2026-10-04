package dtos

// UsageActivity is the dashboard's activity calendar (GET /v1/usage/activity):
// requests per UTC day over the last 53 weeks, with the models each day used.
// Only days with traffic are listed; the client fills the empty cells.
type UsageActivity struct {
	// From is the first day of the grid (a Sunday), To is today; both
	// YYYY-MM-DD in UTC.
	From          string             `json:"from"`
	To            string             `json:"to"`
	TotalRequests int64              `json:"total_requests"`
	ActiveDays    int                `json:"active_days"`
	Days          []UsageActivityDay `json:"days"`
}

// UsageActivityDay is one day with traffic.
type UsageActivityDay struct {
	Day      string               `json:"day"`
	Requests int64                `json:"requests"`
	Failed   int64                `json:"failed"`
	Models   []UsageActivityModel `json:"models"`
}

// UsageActivityModel is one model's share of a day, busiest first.
type UsageActivityModel struct {
	Provider     string `json:"provider"`
	ProviderName string `json:"provider_name"`
	Model        string `json:"model"`
	Requests     int64  `json:"requests"`
}
