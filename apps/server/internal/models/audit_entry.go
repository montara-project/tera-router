package models

import "time"

// AuditEntry is one append-only audit record.
type AuditEntry struct {
	ID        string    `json:"id"`
	Actor     string    `json:"actor"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Detail    string    `json:"detail"` // raw JSON
	CreatedAt time.Time `json:"created_at"`
}

// TableName returns the backing table for the model.
func (AuditEntry) TableName() string { return "audit_entries" }
