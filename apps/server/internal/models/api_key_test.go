package models

import "testing"

func TestAPIKeyScopes(t *testing.T) {
	cases := []struct {
		scopes, scope string
		want          bool
	}{
		{"", KeyScopeChat, true},
		{"*", KeyScopeImages, true},
		{"chat", KeyScopeChat, true},
		{"chat", KeyScopeImages, false},
		{"chat, web\tembeddings", KeyScopeEmbeddings, true},
		{"chats", KeyScopeChat, false},
	}
	for _, c := range cases {
		if got := (APIKey{Scopes: c.scopes}).HasScope(c.scope); got != c.want {
			t.Errorf("HasScope(%q, %q) = %v, want %v", c.scopes, c.scope, got, c.want)
		}
	}
	if got := UnknownKeyScope("chat chats"); got != "chats" {
		t.Errorf("UnknownKeyScope = %q, want chats", got)
	}
	if got := UnknownKeyScope("chat,web *"); got != "" {
		t.Errorf("UnknownKeyScope = %q, want none", got)
	}
}
