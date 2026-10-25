package connectors

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
)

// A relay pool is not an HTTP forward proxy but a small fetch relay (a
// Cloudflare Worker or the local Node script the dashboard generates). Its pool
// URL is written as relay+https://:<secret>@relay.example.workers.dev: the
// gateway sends every upstream request to the relay endpoint with the real
// target and the shared secret in headers, and the relay replays it.
const (
	relaySchemePrefix = "relay+"
	// RelayTargetHeader carries the original upstream URL to the relay.
	RelayTargetHeader = "X-Tera-Relay-Target"
	// RelaySecretHeader authenticates the gateway to the relay.
	RelaySecretHeader = "X-Tera-Relay-Secret"
)

// IsRelayURL reports whether a pool URL addresses a fetch relay.
func IsRelayURL(raw string) bool {
	return strings.HasPrefix(strings.TrimSpace(raw), relaySchemePrefix)
}

// RelayURL builds the pool URL for a relay endpoint and its secret.
func RelayURL(endpoint, secret string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(endpoint))
	if err != nil {
		return "", err
	}
	u.Scheme = relaySchemePrefix + u.Scheme
	u.User = url.UserPassword("", secret)
	return u.String(), nil
}

// relayTransport rewrites each request onto the relay endpoint.
type relayTransport struct {
	base     http.RoundTripper
	endpoint url.URL
	secret   string
}

// NewRelayTransport parses a relay+http(s) pool URL into a RoundTripper that
// tunnels requests through the relay over base.
func NewRelayTransport(raw string, base http.RoundTripper) (http.RoundTripper, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, err
	}
	scheme := strings.TrimPrefix(u.Scheme, relaySchemePrefix)
	if scheme != "http" && scheme != "https" || u.Host == "" {
		return nil, &url.Error{Op: "parse", URL: raw, Err: errInvalidRelay}
	}
	secret, _ := u.User.Password()
	endpoint := url.URL{Scheme: scheme, Host: u.Host, Path: u.Path}
	return &relayTransport{base: base, endpoint: endpoint, secret: secret}, nil
}

func (t *relayTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	out := req.Clone(req.Context())
	out.Header.Set(RelayTargetHeader, req.URL.String())
	out.Header.Set(RelaySecretHeader, t.secret)
	endpoint := t.endpoint
	out.URL = &endpoint
	out.Host = endpoint.Host
	return t.base.RoundTrip(out)
}

var errInvalidRelay = errors.New("relay URL must be relay+http(s)://:<secret>@host")
