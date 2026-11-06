package models

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
)

// Audit outcomes, derived from the response status of the request that
// wrote the entry.
const (
	AuditOutcomeSuccess = "success"
	AuditOutcomeFailed  = "failed"
)

// AuditTimeLayout is how created_at is stored and hashed. It matches the
// column default, so rows written by SQL and by Go sort the same way.
const AuditTimeLayout = "2006-01-02 15:04:05.000-07:00"

// AuditEntry is one append-only audit record.
type AuditEntry struct {
	ID        string    `json:"id"`
	Actor     string    `json:"actor"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Detail    string    `json:"detail"` // raw JSON
	CreatedAt time.Time `json:"created_at"`

	// Request context, empty for entries written outside a dashboard request
	// (gateway decisions, system start/stop).
	Outcome      string `json:"outcome"`
	SessionID    string `json:"session_id"`
	Method       string `json:"method"`
	Route        string `json:"route"`
	Status       int    `json:"status"`
	ClientIP     string `json:"client_ip"`
	ForwardedFor string `json:"forwarded_for"`
	UserAgent    string `json:"user_agent"`
	RequestID    string `json:"request_id"`

	// Chain position. Seq is nil and the hashes empty for rows written before
	// the chain existed.
	Seq      *int64 `json:"seq"`
	PrevHash string `json:"prev_hash"`
	Hash     string `json:"hash"`
}

// ComputeHash returns the SHA-256 over the previous hash and every stored
// field, so a change to any of them, or to the order, breaks the chain.
func (e AuditEntry) ComputeHash() string {
	var seq int64
	if e.Seq != nil {
		seq = *e.Seq
	}
	// Struct field order fixes the JSON key order, so the encoding is stable.
	payload, _ := json.Marshal(struct {
		Seq          int64  `json:"seq"`
		PrevHash     string `json:"prev_hash"`
		ID           string `json:"id"`
		CreatedAt    string `json:"created_at"`
		Actor        string `json:"actor"`
		Action       string `json:"action"`
		Target       string `json:"target"`
		Detail       string `json:"detail"`
		Outcome      string `json:"outcome"`
		SessionID    string `json:"session_id"`
		Method       string `json:"method"`
		Route        string `json:"route"`
		Status       int    `json:"status"`
		ClientIP     string `json:"client_ip"`
		ForwardedFor string `json:"forwarded_for"`
		UserAgent    string `json:"user_agent"`
		RequestID    string `json:"request_id"`
	}{
		seq, e.PrevHash, e.ID, e.CreatedAt.UTC().Format(AuditTimeLayout),
		e.Actor, e.Action, e.Target, e.Detail, e.Outcome, e.SessionID,
		e.Method, e.Route, e.Status, e.ClientIP, e.ForwardedFor, e.UserAgent, e.RequestID,
	})
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}
