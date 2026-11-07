package connectors

import (
	"crypto/hmac"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"

	"tera-router/server/internal/core"

	"github.com/google/uuid"
)

// ZCode's plan lane (https://zcode.z.ai/api/v1/zcode-plan/anthropic) serves
// the Anthropic wire format but only to requests that present the client
// identity of the ZCode desktop app: a fixed identification header set and a
// canonical three-block system prompt. A request whose system does not open
// with those blocks is rejected with 405 {"code":3012}, so they are injected
// on every call — the caller's own system prompt rides in the third block,
// which the upstream leaves unconstrained.

//go:embed zcode_identity.json
var zcodeIdentityAsset []byte

// zcodeIdentity is the captured client identity: the mandatory system-prompt
// prefixes plus the Anthropic version/beta headers and SDK user agent of the
// release they were captured from.
type zcodeIdentity struct {
	CliPrefix        string `json:"cliPrefix"`
	StablePrefix     string `json:"stablePrefix"`
	AnthropicVersion string `json:"anthropicVersion"`
	AnthropicBeta    string `json:"anthropicBeta"`
	SDKUserAgent     string `json:"sdkUserAgent"`
}

// zcodeIdentityData is parsed once at startup. A malformed asset is a broken
// build, not a runtime condition — the provider cannot work without it, so
// fail fast like the reference gateway does.
var zcodeIdentityData = sync.OnceValue(func() zcodeIdentity {
	var id zcodeIdentity
	if err := json.Unmarshal(zcodeIdentityAsset, &id); err != nil {
		panic(fmt.Sprintf("connectors: parse zcode identity asset: %v", err))
	}
	// The upstream compares the stable prefix byte-for-byte; a truncated
	// capture would 405 every request.
	if len(id.StablePrefix) < 1500 || id.CliPrefix == "" {
		panic("connectors: zcode identity asset is missing its canonical system prefixes")
	}
	return id
})

// zcodeAppVersion is the ZCode release the identity was captured from. It
// feeds the user agent and the x-zcode-app-version header.
var zcodeAppVersion = func() string {
	if v := strings.TrimSpace(zcodeIdentityData().SDKUserAgent); strings.HasPrefix(v, "ZCode/") {
		return strings.SplitN(v[len("ZCode/"):], " ", 2)[0]
	}
	return "3.16.3"
}()

// ZCodeHeaders returns the auth and identification headers for a ZCode plan
// call: the static client identity plus the per-request correlation headers
// the desktop client always sends (x-session-id stable per caller, fresh
// request/trace/query ids per attempt). Every value passes through
// printableASCII: the upstream gateway drops headers carrying non-ASCII bytes
// entirely, which silently breaks a request.
func ZCodeHeaders(token string, creds core.Credentials, req *core.ChatRequest) map[string]string {
	id := zcodeIdentityData()
	requestID := uuid.NewString()
	h := map[string]string{
		"Authorization":        bearer(token),
		"anthropic-version":    printableASCII(id.AnthropicVersion),
		"anthropic-beta":       printableASCII(id.AnthropicBeta),
		"user-agent":           printableASCII(id.SDKUserAgent),
		"http-referer":         "https://zcode.z.ai",
		"x-title":              "Z Code@electron",
		"x-release-channel":    "production",
		"x-client-language":    "en",
		"x-client-timezone":    zcodeTimezone(),
		"x-zcode-agent":        "glm",
		"x-platform":           runtime.GOOS + "-" + runtime.GOARCH,
		"x-os-category":        zcodeOSCategory(),
		"x-os-version":         "unknown",
		"x-zcode-app-version":  zcodeAppVersion,
		"x-zcode-session-type": "main",
		"x-zcode-query-source": "main_turn",
		"x-session-id":         printableASCII(zcodeSessionID(creds, req)),
		"x-request-id":         printableASCII(requestID),
		"x-zcode-trace-id":     printableASCII(uuid.NewString()),
		"x-query-id":           printableASCII("01a1" + requestID[4:]),
		"accept":               "application/json",
	}
	return h
}

// printableASCII trims and keeps only printable-ASCII header values; anything
// else is dropped (the upstream discards such headers anyway).
func printableASCII(v string) string {
	v = strings.TrimSpace(v)
	for i := 0; i < len(v); i++ {
		if v[i] < 0x20 || v[i] > 0x7e {
			return ""
		}
	}
	return v
}

// zcodeTimezone reports the server's IANA timezone name, or UTC when the local
// zone is unnamed.
func zcodeTimezone() string {
	if name := time.Local.String(); name != "" && name != "Local" {
		return name
	}
	return "UTC"
}

// zcodeOSCategory maps the server OS onto the categories the desktop client
// reports.
func zcodeOSCategory() string {
	switch runtime.GOOS {
	case "darwin":
		return "macos"
	case "windows":
		return "windows"
	default:
		return "linux"
	}
}

// zcodeShapeBody rewrites a rendered Anthropic request into the shape ZCode's
// plan lane requires: the canonical three-block system prompt, a metadata
// user_id built from stable per-account identifiers, a max_tokens default, and
// the thinking budget expressed as a named effort level.
func zcodeShapeBody(body []byte, req *core.ChatRequest, creds core.Credentials) ([]byte, error) {
	id := zcodeIdentityData()

	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("connectors: zcode body reshape: %w", err)
	}

	// The client's own system prompt goes into block 3; blocks 1 and 2 are the
	// canonical identity text the upstream byte-compares.
	dynamic := zcodeClientSystem(req)
	block3 := ""
	if dynamic != "" {
		block3 = "\n\n" + dynamic
	}
	out["system"] = []map[string]any{
		{"type": "text", "text": id.CliPrefix},
		{"type": "text", "text": id.StablePrefix, "cache_control": map[string]string{"type": "ephemeral"}},
		{"type": "text", "text": block3, "cache_control": map[string]string{"type": "ephemeral"}},
	}

	// metadata.user_id identifies the conversation the way the desktop app
	// does: {"device_id":…,"account_uuid":…,"session_id":…}.
	meta, _ := out["metadata"].(map[string]any)
	if meta == nil {
		meta = map[string]any{}
	}
	meta["user_id"] = zcodeMetadataUserID(creds, req)
	out["metadata"] = meta

	// A request without max_tokens is rejected; the desktop client defaults
	// to 8192.
	if v, ok := out["max_tokens"].(float64); !ok || v <= 0 {
		out["max_tokens"] = 8192
	}

	// Reasoning follows the official client's anthropic mapping: thinking is
	// adaptive with the effort level carried in output_config, and a request
	// without reasoning asks for disabled thinking explicitly.
	if effort := zcodeEffort(req); effort != "" {
		out["thinking"] = map[string]any{"type": "adaptive"}
		out["output_config"] = map[string]any{"effort": effort}
	} else {
		out["thinking"] = map[string]any{"type": "disabled"}
	}

	return json.Marshal(out)
}

// zcodeClientSystem extracts the caller's system prompt from the canonical
// request: a non-empty trimmed string, or "" when absent.
func zcodeClientSystem(req *core.ChatRequest) string {
	if req == nil || req.System == "" {
		return ""
	}
	return strings.TrimSpace(req.System)
}

// zcodeEffort maps the canonical reasoning config onto the effort levels the
// plan lane accepts (low, high, max; "medium" normalizes to high), "" when
// thinking is not requested.
func zcodeEffort(req *core.ChatRequest) string {
	if req == nil || req.Reasoning == nil {
		return ""
	}
	if req.Reasoning.MaxTokens > 0 {
		switch b := req.Reasoning.MaxTokens; {
		case b <= 2048:
			return "low"
		case b <= 16384:
			return "high"
		default:
			return "max"
		}
	}
	switch strings.ToLower(strings.TrimSpace(req.Reasoning.Effort)) {
	case "low":
		return "low"
	case "medium", "med", "high":
		return "high"
	case "xhigh", "x-high", "extra-high", "max":
		return "max"
	default:
		return ""
	}
}

// zcodeSessionKey returns the stable per-caller key the session id derives
// from: the inbound API key + client address when known, else the account.
// The router has no conversation handle at this layer, so a caller key is the
// closest stable equivalent of the desktop client's session.
func zcodeSessionKey(creds core.Credentials, req *core.ChatRequest) string {
	if req != nil {
		if key := req.Metadata.APIKeyID + ":" + req.Metadata.ClientIP; strings.Trim(key, ":") != "" {
			return key
		}
	}
	return creds.AccountID
}

// zcodeSessionID derives the stable conversation handle for one caller+account
// pair. The official client sends the bare session id — it strips the internal
// "sess_" prefix before writing x-session-id, and the body's
// metadata.user_id.session_id must reuse the same normalized value (one prefix
// rule for header and body).
func zcodeSessionID(creds core.Credentials, req *core.ChatRequest) string {
	mac := hmac.New(sha256.New, []byte("zcode-session:"+creds.AccountID))
	mac.Write([]byte(zcodeSessionKey(creds, req)))
	return hex.EncodeToString(mac.Sum(nil))[:32]
}

// zcodeMetadataUserID builds the metadata.user_id value: stable UUIDs derived
// from the account (the router has no desktop device identity to present) and
// the caller-keyed session id above.
func zcodeMetadataUserID(creds core.Credentials, req *core.ChatRequest) string {
	return fmt.Sprintf(`{"device_id":%q,"account_uuid":%q,"session_id":%q}`,
		zcodeStableUUID("device:"+creds.AccountID),
		zcodeStableUUID("account:"+creds.AccountID),
		zcodeSessionID(creds, req))
}

// zcodeStableUUID derives a deterministic UUID from key material via
// HMAC-SHA256 (the upstream only requires the v4 shape, and stability beats
// randomness for grouping conversations).
func zcodeStableUUID(key string) string {
	mac := hmac.New(sha256.New, []byte("zcode-uuid"))
	mac.Write([]byte(key))
	sum := mac.Sum(nil)
	var buf [16]byte
	copy(buf[:], sum[:16])
	// v4 layout: version nibble + variant bits.
	buf[6] = (buf[6] & 0x0f) | 0x40
	buf[8] = (buf[8] & 0x3f) | 0x80
	return uuid.UUID(buf).String()
}
