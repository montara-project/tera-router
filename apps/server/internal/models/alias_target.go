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

// TableName returns the backing table for the model.
func (AliasTarget) TableName() string { return "alias_targets" }
