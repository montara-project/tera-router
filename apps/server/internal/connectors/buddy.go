package connectors

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"tera-router/server/internal/core"
)

// Tencent's buddy family — WorkBuddy, CodeBuddy, CodeBuddy CN — serves an
// OpenAI-compatible /v2/chat/completions to its own desktop/CLI clients only.
// The gateway fingerprints the client, so every call must present the same
// headers the real app sends: its IDE identity, a stable conversation id, a
// per-turn id shared by every retry of that turn, and a fresh id per attempt.
// A request whose identity does not line up is refused with 11128 ("Illegal
// API invocation from an unapproved channel"), and an account the gateway has
// second thoughts about is refused with 11140.
//
// tera-router holds no conversation handle at this layer, so the identity is
// derived: the conversation is keyed on the account plus the caller, and the
// turn on the conversation plus the model and the message content.

const (
	// buddyClientVersion is the CodeBuddy CLI release the realms fingerprint.
	buddyClientVersion = "2.180.0"
	// buddyWorkbuddyVersion is the WorkBuddy desktop release. The gateway
	// fingerprints X-IDE-Version, so it must match the shipped app.
	buddyWorkbuddyVersion = "5.9.4"
	// BuddyNeutralSystem replaces a caller's system prompt. The upstream
	// content-gates the system field and refuses a request whose system prompt
	// names a rival coding agent with 11128, even though auth is valid.
	BuddyNeutralSystem = "You are a helpful coding assistant."
)

// IsBuddy reports whether a provider slug is one of the buddy family. The
// upstream wire format, client fingerprint and error codes are shared, so one
// implementation serves all three.
func IsBuddy(id string) bool {
	switch id {
	case "workbuddy", "codebuddy", "codebuddy-cn":
		return true
	}
	return false
}

// isWorkbuddy reports whether the slug is WorkBuddy's realm, which identifies
// as its own desktop client rather than as the CodeBuddy CLI.
func isWorkbuddy(id string) bool { return id == "workbuddy" }

// buddyDomain returns the X-Domain value the client sends: part of the channel
// fingerprint, so it must match the host the call goes to.
func buddyDomain(id string) string {
	switch id {
	case "codebuddy-cn":
		return "copilot.tencent.com"
	case "workbuddy":
		return "www.workbuddy.ai"
	}
	return "www.codebuddy.ai"
}

// buddyClientVersionFor returns the client release the realm fingerprints.
func buddyClientVersionFor(id string) string {
	if isWorkbuddy(id) {
		return buddyWorkbuddyVersion
	}
	return buddyClientVersion
}

// buddyUserAgent is the client string the realm's own app sends.
func buddyUserAgent(id string) string {
	version := buddyClientVersionFor(id)
	if isWorkbuddy(id) {
		return "WorkBuddy/" + version + " WorkBuddy/" + version
	}
	return "CLI/" + version + " CodeBuddy/" + version
}

// buddyTraceSeq keeps per-attempt ids unique even when two requests land in
// the same clock tick: the gateway treats a repeated X-Request-ID as a replay
// of the earlier call.
var buddyTraceSeq atomic.Uint64

// buddyStableID derives an id from a seed without a clock, so the same seed
// always yields the same value.
func buddyStableID(seed string) string {
	sum := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(sum[:])
}

// buddyAttemptID mints an id unique to one outbound attempt.
func buddyAttemptID(seed string) string {
	seq := buddyTraceSeq.Add(1)
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%d", seed, time.Now().String(), seq)))
	return hex.EncodeToString(sum[:])
}

// buddyUUID mints a random v4 UUID, the shape the client sends for its message
// id.
func buddyUUID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return buddyStableID(fmt.Sprintf("uuid|%d", buddyTraceSeq.Add(1)))[:32]
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// isJWT reports whether tok looks like a JSON Web Token. The buddy realms look
// a Bearer JWT up in the session table and a bare key in the API-key table, so
// only real keys are mirrored into X-API-Key.
func isJWT(tok string) bool {
	return strings.HasPrefix(tok, "eyJ") && strings.Count(tok, ".") == 2
}

// buddyJWTClaims reads the claims the header set needs out of a session token.
func buddyJWTClaims(token string) (userID, email string) {
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return "", ""
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", ""
	}
	var claims struct {
		UserID    string `json:"user_id"`
		UserIDAlt string `json:"userId"`
		UID       string `json:"uid"`
		Subject   string `json:"sub"`
		Email     string `json:"email"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", ""
	}
	for _, candidate := range []string{claims.UserID, claims.UserIDAlt, claims.UID, claims.Subject} {
		if candidate != "" {
			userID = candidate
			break
		}
	}
	return userID, claims.Email
}

// buddyConversationKey is the stable per-caller key the conversation id
// derives from: the account plus the inbound API key and client address when
// known. A caller that sends neither collapses onto the account — and an empty
// account id is refused by the caller, because a constant key would make every
// unrelated call share one conversation upstream.
func buddyConversationKey(creds core.Credentials, req *core.ChatRequest) string {
	key := creds.AccountID
	if req != nil {
		if caller := req.Metadata.APIKeyID + ":" + req.Metadata.ClientIP; strings.Trim(caller, ":") != "" {
			key += "|" + caller
		}
	}
	return key
}

// buddyConversationID is the X-Conversation-ID value: stable across the turns
// of one conversation, so the gateway aggregates them as one session.
func buddyConversationID(creds core.Credentials, req *core.ChatRequest) string {
	mac := hmac.New(sha256.New, []byte("buddy-conversation"))
	mac.Write([]byte(buddyConversationKey(creds, req)))
	return hex.EncodeToString(mac.Sum(nil))
}

// buddyTurnSeed identifies one turn: conversation, model and the message
// content. Every retry of that turn reuses it, a different turn gets its own.
func buddyTurnSeed(creds core.Credentials, req *core.ChatRequest, model string) string {
	seed := buddyConversationID(creds, req) + "|" + model
	if req != nil {
		seed += "|" + req.System
		for _, m := range req.Messages {
			seed += "|" + string(m.Role) + ":" + m.TextContent()
			for _, p := range m.Content {
				if p.ToolCall != nil {
					seed += "|tc:" + p.ToolCall.ID + ":" + p.ToolCall.Name + ":" + string(p.ToolCall.Arguments)
				}
				if p.ToolResult != nil {
					seed += "|tr:" + p.ToolResult.CallID + ":" + p.ToolResult.Content
				}
			}
		}
	}
	return seed
}

// buddyB3TraceID derives the 32-character trace id of one turn: a retry
// reuses it, the next turn gets its own.
func buddyB3TraceID(turnID string) string {
	sum := sha256.Sum256([]byte("b3|" + turnID))
	return hex.EncodeToString(sum[:16])
}

// BuddyHeaders returns the auth and identification headers for one buddy
// attempt: the realm's client identity plus the layered conversation, turn and
// attempt ids. providerID selects the realm (workbuddy, codebuddy,
// codebuddy-cn); model feeds the per-turn seed.
func BuddyHeaders(providerID string, creds core.Credentials, req *core.ChatRequest, model string) map[string]string {
	tok := creds.Token()
	version := buddyClientVersionFor(providerID)
	turnID := buddyStableID("turn|" + buddyTurnSeed(creds, req, model))

	h := map[string]string{
		"Authorization":             bearer(tok),
		"Accept":                    "application/json, text/plain, */*",
		"x-requested-with":          "XMLHttpRequest",
		"X-Request-ID":              buddyAttemptID("msg|" + tok + "|" + model),
		"X-Conversation-ID":         buddyConversationID(creds, req),
		"X-Conversation-Request-ID": turnID,
		"X-Root-Request-ID":         turnID,
		"X-Conversation-Message-ID": buddyUUID(),
		"X-Trace-ID":                turnID,
		"X-B3-TraceId":              buddyB3TraceID(turnID),
		"X-B3-SpanId":               buddyUUID()[:16],
		"X-B3-Sampled":              "1",
		"X-Agent-Intent":            "craft",
		"X-Domain":                  buddyDomain(providerID),
		"X-Product":                 "SaaS",
		"X-IDE-Type":                "CLI",
		"X-IDE-Name":                "CLI",
		"X-IDE-Version":             version,
		"User-Agent":                buddyUserAgent(providerID),
	}
	if !isWorkbuddy(providerID) {
		h["X-Product-Version"] = version
	} else {
		h["X-IDE-Type"] = "WorkBuddy"
		h["X-IDE-Name"] = "WorkBuddy"
		h["X-Private-Data"] = "true"
	}
	// API-key accounts must send the key twice: as Bearer and as X-API-Key.
	// Sending a session JWT as X-API-Key makes the gateway look it up in the
	// API-key table and answer 401 {"message":"not_found"}.
	if tok != "" && !isJWT(tok) {
		h["X-API-Key"] = tok
	}
	if userID, _ := buddyJWTClaims(tok); userID != "" {
		h["X-User-Id"] = userID
	}
	return h
}

// buddyShapeRequest rewrites a rendered OpenAI body into the shape the buddy
// gateway accepts: a neutral system prompt with the caller's instructions
// folded into the first user turn, no tools for the model that cannot serve
// them, and reasoning expressed only as the flat effort knob.
func buddyShapeRequest(body []byte, req *core.ChatRequest, providerID string) ([]byte, error) {
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("buddy: parse rendered request: %w", err)
	}

	messages, _ := out["messages"].([]any)
	system := strings.TrimSpace(req.System)
	// A conversation must open with a system turn; without one the gateway
	// rejects the request with 11101 "Parse message failed".
	if system != "" {
		wrapped := "<client_instructions>\n" + system + "\n</client_instructions>"
		found := false
		for _, raw := range messages {
			msg, ok := raw.(map[string]any)
			if !ok || msg["role"] != string(core.RoleUser) {
				continue
			}
			msg["content"] = prependBuddyText(msg["content"], wrapped)
			found = true
			break
		}
		if !found {
			// No user turn to fold into (an assistant- or tool-led
			// conversation): prepend one rather than losing the instructions.
			messages = append([]any{map[string]any{"role": string(core.RoleUser), "content": wrapped}}, messages...)
		}
	}
	messages = prependBuddySystem(messages)
	delete(out, "system")

	// glm-5.2 over this gateway answers with an empty body when tool
	// definitions are present: the model spends its budget on hidden
	// reasoning and emits no visible tokens. Tool results without matching
	// definitions confuse it further, so the whole tool lane goes.
	if model, _ := out["model"].(string); strings.Contains(model, "glm-5.2") {
		delete(out, "tools")
		delete(out, "tool_choice")
		messages = stripBuddyTools(messages)
	}
	out["messages"] = messages

	// The gateway refuses a reasoning object its CLI never sends; only the
	// flat effort string reaches it.
	if effort, ok := out["reasoning_effort"]; ok && effort != nil && effort != "" {
		delete(out, "reasoning")
	} else {
		delete(out, "reasoning_effort")
		delete(out, "reasoning")
	}
	// The CN realm only emits thinking deltas when a summary is requested, and
	// an explicit "none" must not ask for one.
	if providerID == "codebuddy-cn" {
		if effort, _ := out["reasoning_effort"].(string); effort == "" {
			out["reasoning_effort"] = "medium"
			out["reasoning_summary"] = "auto"
		} else if effort != "none" {
			out["reasoning_summary"] = "auto"
		}
	}

	return json.Marshal(out)
}

// prependBuddySystem puts the neutral system prompt at the head of the message
// list, replacing any system message already there.
func prependBuddySystem(messages []any) []any {
	out := make([]any, 0, len(messages)+1)
	out = append(out, map[string]any{"role": string(core.RoleSystem), "content": BuddyNeutralSystem})
	for _, raw := range messages {
		if msg, ok := raw.(map[string]any); ok && msg["role"] == string(core.RoleSystem) {
			continue
		}
		out = append(out, raw)
	}
	return out
}

// prependBuddyText folds text ahead of a message's content, keeping both the
// plain-string and the array-of-parts forms valid.
func prependBuddyText(content any, text string) any {
	switch v := content.(type) {
	case string:
		if v == "" {
			return text
		}
		return text + "\n\n" + v
	case []any:
		return append([]any{map[string]any{"type": "text", "text": text}}, v...)
	default:
		return text
	}
}

// stripBuddyTools removes tool calls and tool results from a message list.
func stripBuddyTools(messages []any) []any {
	out := make([]any, 0, len(messages))
	for _, raw := range messages {
		msg, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		if msg["role"] == string(core.RoleTool) {
			continue
		}
		delete(msg, "tool_calls")
		delete(msg, "tool_call_id")
		if parts, ok := msg["content"].([]any); ok {
			kept := make([]any, 0, len(parts))
			for _, p := range parts {
				part, ok := p.(map[string]any)
				if !ok {
					kept = append(kept, p)
					continue
				}
				switch part["type"] {
				case "tool_call", "tool_result", "function_call", "function_call_output":
					continue
				}
				kept = append(kept, p)
			}
			msg["content"] = kept
		}
		out = append(out, msg)
	}
	return out
}
