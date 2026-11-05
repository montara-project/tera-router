package connectors

import (
	"net/http"
	"strings"
)

// bypassTransport sends requests for listed hosts directly and the rest
// through the pool's proxy.
type bypassTransport struct {
	hosts   []string
	proxied http.RoundTripper
	direct  http.RoundTripper
}

func (b bypassTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if bypassed(req.URL.Hostname(), b.hosts) {
		return b.direct.RoundTrip(req)
	}
	return b.proxied.RoundTrip(req)
}

// splitBypass parses a comma separated host list, lowercased and trimmed.
func splitBypass(raw string) []string {
	var hosts []string
	for _, h := range strings.Split(raw, ",") {
		if h = strings.ToLower(strings.TrimSpace(h)); h != "" {
			hosts = append(hosts, h)
		}
	}
	return hosts
}

// bypassed reports whether host matches the list: an exact name or IP, or a
// ".suffix" entry, which matches the domain and every subdomain.
func bypassed(host string, hosts []string) bool {
	host = strings.ToLower(host)
	for _, h := range hosts {
		if h == host {
			return true
		}
		if strings.HasPrefix(h, ".") && (host == h[1:] || strings.HasSuffix(host, h)) {
			return true
		}
	}
	return false
}
