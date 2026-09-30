package models

// AliasTarget is one ordered candidate within a model alias pool.
type AliasTarget struct {
	ID       string `json:"id"`
	AliasID  string `json:"alias_id"`
	Position int    `json:"position"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Active   bool   `json:"active"`
}
