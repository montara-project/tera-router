package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"tera-router/server/internal/connectors"
)

// clineCreditUnits is how many balance units make one Cline credit (one US
// dollar).
//
// ponytail: inferred, not documented. The balance endpoint answers a bare
// integer; a free account with a few requests read -24330 on 2026-11-13,
// which is only a believable balance as millionths (-$0.02). Confirm against
// the Cline dashboard and change it here if the two disagree.
const clineCreditUnits = 1_000_000

// ClineBalance is the credit balance of the Cline account behind a key.
type ClineBalance struct {
	// Credits is the balance in Cline credits (US dollars); negative once
	// usage has overdrawn it.
	Credits float64 `json:"balance"`
	// Units is the integer the upstream reported, unconverted.
	Units int64 `json:"balance_units"`
}

// ClineBalance reads the credit balance of the account a Cline key belongs
// to: GET {base}/users/me names the user, GET {base}/users/{id}/balance
// reports the balance. The key is sent as the gateway sends it (workos:
// prefix unless it is a native sk_ key).
func (s *UpstreamService) ClineBalance(ctx context.Context, baseURL, apiKey string) (ClineBalance, error) {
	base := strings.TrimSuffix(baseURL, "/")
	get := func(endpoint string, into any) error {
		if err := validateEndpoint(endpoint); err != nil {
			return err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return err
		}
		for k, v := range connectors.ClineHeaders(apiKey) {
			req.Header.Set(k, v)
		}
		req.Header.Set("Accept", "application/json")

		resp, err := probeClient().Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		if err != nil {
			return err
		}
		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			return fmt.Errorf("cline rejected the credential (HTTP %d)", resp.StatusCode)
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("cline answered HTTP %d", resp.StatusCode)
		}
		if err := json.Unmarshal(body, into); err != nil {
			return fmt.Errorf("parse cline response: %w", err)
		}
		return nil
	}

	var me struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := get(base+"/users/me", &me); err != nil {
		return ClineBalance{}, err
	}
	if me.Data.ID == "" {
		return ClineBalance{}, fmt.Errorf("cline did not name the account behind this key")
	}

	var balance struct {
		Data struct {
			Balance int64 `json:"balance"`
		} `json:"data"`
	}
	if err := get(base+"/users/"+url.PathEscape(me.Data.ID)+"/balance", &balance); err != nil {
		return ClineBalance{}, err
	}
	return ClineBalance{
		Credits: float64(balance.Data.Balance) / clineCreditUnits,
		Units:   balance.Data.Balance,
	}, nil
}
