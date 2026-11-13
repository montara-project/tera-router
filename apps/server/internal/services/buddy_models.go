package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"tera-router/server/internal/connectors"
	"tera-router/server/internal/core"
)

// buddyConfigPath is the CLI config endpoint that carries the served model
// list. The buddy realms have no /models endpoint; this is what the shipped
// client reads on startup.
const buddyConfigPath = "/v3/config"

// buddyConfigEnvelope is the reply shape: a Tencent-style code envelope around
// the config object.
type buddyConfigEnvelope struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

// buddyConfigModel is the model metadata the config carries. Only the id is
// used today; the rest is the vendor's own flags.
type buddyConfigModel struct {
	ID string `json:"id"`
}

// ListBuddyModels reads the model catalog of one buddy realm from its CLI
// config (GET {host}/v3/config). It doubles as the credential probe: the
// endpoint is authenticated but costs no credits, unlike a chat probe.
func (s *UpstreamService) ListBuddyModels(ctx context.Context, host, token, slug string) ([]UpstreamModel, error) {
	base := strings.TrimRight(strings.TrimSpace(host), "/")
	// The catalog base carries the /v2 gateway prefix; the config endpoint is
	// rooted at the host, so only the scheme and host are kept.
	if i := strings.Index(base, "/v2"); i > 0 {
		base = base[:i]
	}
	endpoint := base + buddyConfigPath
	if err := validateEndpoint(endpoint); err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	for k, v := range connectors.BuddyHeaders(slug, core.Credentials{AccessToken: token}, nil, "") {
		req.Header.Set(k, v)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := probeClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("%s rejected the credential (HTTP %d)", slug, resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%s answered HTTP %d", slug, resp.StatusCode)
	}

	var envelope buddyConfigEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("parse %s config: %w", slug, err)
	}
	if envelope.Code != 0 {
		return nil, fmt.Errorf("%s config error: %s", slug, orUnknown(envelope.Msg))
	}
	var data struct {
		Models []buddyConfigModel `json:"models"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		return nil, fmt.Errorf("parse %s model list: %w", slug, err)
	}
	out := make([]UpstreamModel, 0, len(data.Models))
	for _, model := range data.Models {
		id := strings.TrimSpace(model.ID)
		if id == "" {
			continue
		}
		out = append(out, UpstreamModel{ID: id})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("%s config listed no models", slug)
	}
	return out, nil
}

// orUnknown names an empty upstream message.
func orUnknown(msg string) string {
	if strings.TrimSpace(msg) == "" {
		return "unknown error"
	}
	return msg
}
