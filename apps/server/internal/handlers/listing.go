package handlers

import (
	"strings"

	"tera-router/server/internal/dtos"
	"tera-router/server/internal/lib"

	"github.com/gofiber/fiber/v3"
)

// Helpers for list endpoints that filter and page rows already in memory:
// lists that are small or computed (chains, quota rows, health rows), where
// the dashboard sends its search and page as query parameters and the handler
// narrows the rows before answering.

// listSearch reads the `search` query parameter, trimmed and lowercased.
func listSearch(c fiber.Ctx) string {
	return strings.ToLower(strings.TrimSpace(c.Query("search")))
}

// matchesSearch reports whether any field contains the lowercased search
// text. An empty search matches everything.
func matchesSearch(search string, fields ...string) bool {
	if search == "" {
		return true
	}
	for _, f := range fields {
		if strings.Contains(strings.ToLower(f), search) {
			return true
		}
	}
	return false
}

// keep returns the rows the predicate accepts, in order. It always returns a
// non-nil slice so an empty result encodes as [] rather than null.
func keep[T any](rows []T, ok func(T) bool) []T {
	out := make([]T, 0, len(rows))
	for _, r := range rows {
		if ok(r) {
			out = append(out, r)
		}
	}
	return out
}

// pageOf cuts one page out of rows. A page past the end is empty.
func pageOf[T any](rows []T, offset, limit int) []T {
	if offset >= len(rows) {
		return []T{}
	}
	return rows[offset:min(offset+limit, len(rows))]
}

// listPage reads offset and limit for a list that is always paged.
func listPage(c fiber.Ctx) (dtos.ListQuery, error) {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return q, err
	}
	q.Clamp()
	return q, nil
}

// respondList answers with one page of rows and the total before paging. The
// page is cut only when the request sends `limit`: these lists are also read
// whole (pickers, name lookups, dashboards), and those callers send none.
// extra adds figures taken over every row (the counts of a summary strip) to
// the metadata, so a page still reports them.
func respondList[T any](c fiber.Ctx, rows []T, extra ...dtos.Metadata) error {
	meta := dtos.TotalMeta(len(rows))
	page := rows
	if c.Query("limit") != "" {
		q, err := listPage(c)
		if err != nil {
			return err
		}
		meta = dtos.ListMeta(len(rows), q.Offset, q.Limit)
		page = pageOf(rows, q.Offset, q.Limit)
	}
	for _, m := range extra {
		for k, v := range m {
			meta[k] = v
		}
	}
	return dtos.List(c, page, meta)
}
