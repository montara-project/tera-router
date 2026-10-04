package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// claudeUsageURL reports a Claude subscription's rate-limit windows — the
// data Claude Code's /usage shows.
var claudeUsageURL = "https://api.anthropic.com/api/oauth/usage"

// UsageWindow is one subscription rate-limit window: how much of the window's
// allowance is used (percent) and when it resets.
type UsageWindow struct {
	// Key is the upstream window name: five_hour (the rolling session),
	// seven_day (weekly, all models), seven_day_sonnet, seven_day_opus.
	Key         string     `json:"key"`
	Utilization float64    `json:"utilization"`
	ResetsAt    *time.Time `json:"resets_at"`
}

// FetchClaudeUsage reads the session and weekly windows of a Claude
// subscription with its OAuth access token. Windows the plan does not have
// (null upstream) are omitted.
func FetchClaudeUsage(ctx context.Context, accessToken string) ([]UsageWindow, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, claudeUsageURL, nil)
	if err != nil {
		return nil, fmt.Errorf("oauth: build usage request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oauth: usage request: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("oauth: read usage response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("oauth: usage endpoint returned %d: %s", resp.StatusCode, truncate(body, 300))
	}

	type window struct {
		Utilization float64    `json:"utilization"`
		ResetsAt    *time.Time `json:"resets_at"`
	}
	var raw struct {
		FiveHour       *window `json:"five_hour"`
		SevenDay       *window `json:"seven_day"`
		SevenDaySonnet *window `json:"seven_day_sonnet"`
		SevenDayOpus   *window `json:"seven_day_opus"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("oauth: parse usage response: %w", err)
	}

	out := make([]UsageWindow, 0, 4)
	for _, w := range []struct {
		key string
		w   *window
	}{
		{"five_hour", raw.FiveHour},
		{"seven_day", raw.SevenDay},
		{"seven_day_sonnet", raw.SevenDaySonnet},
		{"seven_day_opus", raw.SevenDayOpus},
	} {
		if w.w != nil {
			out = append(out, UsageWindow{Key: w.key, Utilization: w.w.Utilization, ResetsAt: w.w.ResetsAt})
		}
	}
	return out, nil
}
