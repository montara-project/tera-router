package dtos

// QuotaAccount is one row of the quota page. Field names match the web UI
// QuotaAccount model.
type QuotaAccount struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Provider        string  `json:"provider"`
	AuthLabel       string  `json:"auth_label"`
	Initials        string  `json:"initials"`
	Status          string  `json:"status"`
	Priority        int     `json:"priority"`
	QuotaVisibility string  `json:"quota_visibility"`
	QuotaNote       string  `json:"quota_note"`
	Requests        int64   `json:"requests"`
	InputTokens     int64   `json:"input_tokens"`
	OutputTokens    int64   `json:"output_tokens"`
	AttributedCost  float64 `json:"attributed_cost"`
	Attention       bool    `json:"attention"`
	Depleted        bool    `json:"depleted"`
}

// QuotaSummary totals the account list for the header cards. Field names
// match the web UI QuotaSummary model.
type QuotaSummary struct {
	TotalAccounts     int     `json:"total_accounts"`
	ActiveAccounts    int     `json:"active_accounts"`
	Paused            int     `json:"paused"`
	Attention         int     `json:"attention"`
	Depleted          int     `json:"depleted"`
	Requests          int64   `json:"requests"`
	InputTokens       int64   `json:"input_tokens"`
	OutputTokens      int64   `json:"output_tokens"`
	AttributedCost    float64 `json:"attributed_cost"`
	AccountsReporting int     `json:"accounts_reporting"`
	QuotaCapable      int     `json:"quota_capable"`
	UsageOnly         int     `json:"usage_only"`
	NotReported       int     `json:"not_reported"`
}
