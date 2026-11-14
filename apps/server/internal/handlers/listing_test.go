package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
)

// getList fetches a list endpoint and returns one field of every row, in the
// order the server sent them, plus the total the server reports.
func getList(t *testing.T, h backupHarness, url, field string) ([]string, int) {
	t.Helper()
	status, raw := h.do(t, httptest.NewRequest(http.MethodGet, url, nil))
	if status != http.StatusOK {
		t.Fatalf("GET %s = %d (%s)", url, status, raw)
	}
	var res struct {
		Data     []map[string]any `json:"data"`
		Metadata struct {
			Total int `json:"total"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		t.Fatalf("GET %s: %v (%s)", url, err, raw)
	}
	out := make([]string, 0, len(res.Data))
	for _, row := range res.Data {
		out = append(out, fmt.Sprint(row[field]))
	}
	return out, res.Metadata.Total
}

// listCase is one request against a list endpoint. Ordered cases compare the
// rows as sent; the others compare them as a set.
type listCase struct {
	query   string
	want    []string
	total   int
	ordered bool
}

// runListCases checks each case's rows and total against the endpoint.
func runListCases(t *testing.T, h backupHarness, path, field string, cases []listCase) {
	t.Helper()
	for _, tc := range cases {
		got, total := getList(t, h, path+tc.query, field)
		want := slices.Clone(tc.want)
		if !tc.ordered {
			slices.Sort(got)
			slices.Sort(want)
		}
		if !slices.Equal(got, want) {
			t.Errorf("GET %s%s = %v, want %v", path, tc.query, got, tc.want)
		}
		if total != tc.total {
			t.Errorf("GET %s%s total = %d, want %d", path, tc.query, total, tc.total)
		}
	}
}

func TestPageOf(t *testing.T) {
	rows := []int{1, 2, 3}
	for _, tc := range []struct {
		offset, limit int
		want          []int
	}{
		{0, 2, []int{1, 2}},
		{2, 2, []int{3}},
		{3, 2, []int{}},
		{9, 2, []int{}},
	} {
		if got := pageOf(rows, tc.offset, tc.limit); !slices.Equal(got, tc.want) {
			t.Errorf("pageOf(%d, %d) = %v, want %v", tc.offset, tc.limit, got, tc.want)
		}
	}
}
