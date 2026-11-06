package repositories

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"sync"
	"time"

	"tera-router/server/internal/models"

	"braces.dev/errtrace"
)

// AuditRepository appends and reads the audit trail.
type AuditRepository struct {
	BaseRepository
	// mu serializes appends in this process, so two writers never read the
	// same chain head. A second process sharing the database is caught by
	// the unique seq index instead.
	mu sync.Mutex
}

const auditColumns = `id, actor, action, target, detail, created_at, outcome, session_id,
	method, route, status, client_ip, forwarded_for, user_agent, request_id, seq, prev_hash, hash`

func scanAuditEntry(s rowScanner) (models.AuditEntry, error) {
	var e models.AuditEntry
	var seq sql.NullInt64
	err := s.Scan(&e.ID, &e.Actor, &e.Action, &e.Target, &e.Detail, &e.CreatedAt, &e.Outcome, &e.SessionID,
		&e.Method, &e.Route, &e.Status, &e.ClientIP, &e.ForwardedFor, &e.UserAgent, &e.RequestID, &seq, &e.PrevHash, &e.Hash)
	if seq.Valid {
		e.Seq = &seq.Int64
	}
	return e, errtrace.Wrap(err)
}

// Insert appends one audit entry at the head of the hash chain. It fills
// CreatedAt (when zero), Outcome (when empty), Seq, PrevHash and Hash on e.
func (r *AuditRepository) Insert(ctx context.Context, e models.AuditEntry) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if e.CreatedAt.IsZero() {
		e.CreatedAt = time.Now()
	}
	e.CreatedAt = e.CreatedAt.UTC().Truncate(time.Millisecond)
	if e.Outcome == "" {
		e.Outcome = models.AuditOutcomeSuccess
	}

	return r.withTx(ctx, func(tx Executor) error {
		var head int64
		e.PrevHash = ""
		err := r.queryRowContext(ctx, tx,
			`SELECT seq, hash FROM audit_entries WHERE seq IS NOT NULL ORDER BY seq DESC LIMIT 1`,
		).Scan(&head, &e.PrevHash)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return errtrace.Wrap(err)
		}
		seq := head + 1
		e.Seq = &seq
		e.Hash = e.ComputeHash()

		_, err = r.execContext(ctx, tx, `
			INSERT INTO audit_entries (`+auditColumns+`)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
			e.ID, e.Actor, e.Action, e.Target, e.Detail, e.CreatedAt.Format(models.AuditTimeLayout), e.Outcome, e.SessionID,
			e.Method, e.Route, e.Status, e.ClientIP, e.ForwardedFor, e.UserAgent, e.RequestID, seq, e.PrevHash, e.Hash,
		)
		return err
	})
}

// AuditFilter narrows the audit list. Empty fields match everything.
type AuditFilter struct {
	// Search matches action, target, actor, session, client IP and
	// forwarded-for, case-insensitively.
	Search string
	// Outcome is "success" or "failed".
	Outcome string
	// Category is the action prefix before the first dot ("keys", "auth").
	Category string
	Offset   int
	Limit    int
}

func (f AuditFilter) where() (string, []any) {
	var conds []string
	var args []any
	arg := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		p := arg(strings.ToLower(s))
		var cols []string
		for _, c := range []string{"action", "target", "actor", "session_id", "client_ip", "forwarded_for"} {
			cols = append(cols, "instr(lower("+c+"), "+p+") > 0")
		}
		conds = append(conds, "("+strings.Join(cols, " OR ")+")")
	}
	if f.Outcome != "" {
		conds = append(conds, "outcome = "+arg(f.Outcome))
	}
	if f.Category != "" {
		p := arg(f.Category)
		conds = append(conds, "(action = "+p+" OR substr(action, 1, length("+p+") + 1) = "+p+" || '.')")
	}
	if len(conds) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(conds, " AND "), args
}

// List returns one page of entries, newest first, and the filtered total.
func (r *AuditRepository) List(ctx context.Context, f AuditFilter) ([]models.AuditEntry, int, error) {
	where, args := f.where()

	var total int
	if err := r.queryRowContext(ctx, r.DB, `SELECT COUNT(*) FROM audit_entries`+where, args...).Scan(&total); err != nil {
		return nil, 0, errtrace.Wrap(err)
	}

	n := len(args)
	rows, err := r.queryContext(ctx, r.DB, `
		SELECT `+auditColumns+` FROM audit_entries`+where+`
		ORDER BY created_at DESC, seq DESC
		LIMIT $`+strconv.Itoa(n+1)+` OFFSET $`+strconv.Itoa(n+2),
		append(args, f.Limit, f.Offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	entries := []models.AuditEntry{}
	for rows.Next() {
		e, err := scanAuditEntry(rows)
		if err != nil {
			return nil, 0, err
		}
		entries = append(entries, e)
	}
	return entries, total, errtrace.Wrap(rows.Err())
}

// AuditCounts are the totals behind the audit page header.
type AuditCounts struct {
	Recorded int64 `json:"recorded"`
	Failed   int64 `json:"failed"`
	// Legacy rows predate the hash chain and are not verified.
	Legacy     int64    `json:"legacy"`
	Categories []string `json:"categories"`
}

// Counts totals the trail and lists the action categories it holds.
func (r *AuditRepository) Counts(ctx context.Context) (AuditCounts, error) {
	c := AuditCounts{Categories: []string{}}
	err := r.queryRowContext(ctx, r.DB, `
		SELECT COUNT(*), COALESCE(SUM(outcome = 'failed'), 0), COALESCE(SUM(seq IS NULL), 0)
		FROM audit_entries`).Scan(&c.Recorded, &c.Failed, &c.Legacy)
	if err != nil {
		return c, errtrace.Wrap(err)
	}

	rows, err := r.queryContext(ctx, r.DB, `
		SELECT DISTINCT CASE WHEN instr(action, '.') > 0 THEN substr(action, 1, instr(action, '.') - 1) ELSE action END AS category
		FROM audit_entries WHERE action <> '' ORDER BY category`)
	if err != nil {
		return c, err
	}
	defer rows.Close()
	for rows.Next() {
		var cat string
		if err := rows.Scan(&cat); err != nil {
			return c, errtrace.Wrap(err)
		}
		c.Categories = append(c.Categories, cat)
	}
	return c, errtrace.Wrap(rows.Err())
}

// AuditVerification is the result of walking the hash chain.
type AuditVerification struct {
	OK      bool  `json:"ok"`
	Checked int64 `json:"checked"`
	Legacy  int64 `json:"legacy"`
	// The first row that does not fit the chain, when OK is false.
	BrokenSeq *int64 `json:"broken_seq"`
	BrokenID  string `json:"broken_id"`
	Reason    string `json:"reason"`
}

// Verify walks the chain in order and recomputes every hash. It reports the
// first row whose position, link or content does not match.
//
// ponytail: removing the newest rows leaves a shorter chain that still
// verifies; anchoring the head outside the database would catch that.
func (r *AuditRepository) Verify(ctx context.Context) (AuditVerification, error) {
	var v AuditVerification
	if err := r.queryRowContext(ctx, r.DB,
		`SELECT COUNT(*) FROM audit_entries WHERE seq IS NULL`).Scan(&v.Legacy); err != nil {
		return v, errtrace.Wrap(err)
	}

	rows, err := r.queryContext(ctx, r.DB,
		`SELECT `+auditColumns+` FROM audit_entries WHERE seq IS NOT NULL ORDER BY seq`)
	if err != nil {
		return v, err
	}
	defer rows.Close()

	prev := ""
	for rows.Next() {
		e, err := scanAuditEntry(rows)
		if err != nil {
			return v, err
		}
		want := v.Checked + 1
		switch {
		case *e.Seq != want:
			v.Reason = "row #" + strconv.Itoa(int(want)) + " is missing"
		case e.PrevHash != prev:
			v.Reason = "link to the previous row does not match"
		case e.Hash != e.ComputeHash():
			v.Reason = "row content does not match its hash"
		}
		if v.Reason != "" {
			v.BrokenSeq, v.BrokenID = e.Seq, e.ID
			return v, nil
		}
		prev = e.Hash
		v.Checked++
	}
	v.OK = true
	return v, errtrace.Wrap(rows.Err())
}

// All returns every entry, oldest first, for export.
//
// ponytail: loads the whole trail into memory; stream rows if exports reach
// hundreds of MB.
func (r *AuditRepository) All(ctx context.Context) ([]models.AuditEntry, error) {
	rows, err := r.queryContext(ctx, r.DB,
		`SELECT `+auditColumns+` FROM audit_entries ORDER BY seq IS NOT NULL, seq, created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []models.AuditEntry{}
	for rows.Next() {
		e, err := scanAuditEntry(rows)
		if err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, errtrace.Wrap(rows.Err())
}
