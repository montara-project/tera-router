package connectors

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBypassed(t *testing.T) {
	hosts := splitBypass(" localhost, 127.0.0.1 ,.Internal,")
	for host, want := range map[string]bool{
		"localhost":        true,
		"127.0.0.1":        true,
		"internal":         true,
		"api.internal":     true,
		"a.b.internal":     true,
		"notinternal":      false,
		"api.openai.com":   false,
		"localhost.evil.x": false,
	} {
		if got := bypassed(host, hosts); got != want {
			t.Errorf("bypassed(%q) = %v, want %v", host, got, want)
		}
	}
}

// TestBypassTransport pins that listed hosts skip the proxy and others use it.
func TestBypassTransport(t *testing.T) {
	tag := func(name string) http.RoundTripper {
		return roundTripFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(name))}, nil
		})
	}
	rt := bypassTransport{hosts: []string{"127.0.0.1"}, proxied: tag("proxy"), direct: tag("direct")}
	for url, want := range map[string]string{
		"http://127.0.0.1:9/x":       "direct",
		"https://api.openai.com/v1/": "proxy",
	} {
		res, err := rt.RoundTrip(httptest.NewRequest("GET", url, nil))
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(res.Body)
		if string(body) != want {
			t.Errorf("%s went %s, want %s", url, body, want)
		}
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
