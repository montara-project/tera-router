package middlewares

import "testing"

func TestClientIP(t *testing.T) {
	cases := []struct {
		name, peer, header string
		tunnel             bool
		want               string
	}{
		{"tunnel up, loopback peer", "127.0.0.1", "203.0.113.7", true, "203.0.113.7"},
		{"tunnel up, ipv6 loopback peer", "::1", "203.0.113.7", true, "203.0.113.7"},
		{"tunnel down ignores header", "127.0.0.1", "203.0.113.7", false, "127.0.0.1"},
		{"remote peer cannot forge header", "198.51.100.9", "203.0.113.7", true, "198.51.100.9"},
		{"malformed header", "127.0.0.1", "not-an-ip", true, "127.0.0.1"},
		{"no header", "127.0.0.1", "", true, "127.0.0.1"},
	}
	for _, tc := range cases {
		if got := clientIP(tc.peer, tc.header, tc.tunnel); got != tc.want {
			t.Errorf("%s: clientIP = %q, want %q", tc.name, got, tc.want)
		}
	}
}
