package oauth

import (
	"encoding/json"
	"fmt"
	"strings"
)

// RefreshError is returned by ProviderConfig.Refresh when the token endpoint
// rejects a refresh request. The Permanent flag distinguishes unrecoverable
// failures (revoked tokens, invalid grant) from transient ones (rate limits,
// server errors) so callers can decide whether to mark the account for
// re-authentication.
type RefreshError struct {
	Code       string // provider error code (e.g. "token_revoked", "invalid_grant")
	Message    string // human-readable provider message
	HTTPStatus int    // HTTP status from the token endpoint
	Permanent  bool   // true when re-authentication is required
}

func (e *RefreshError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("oauth refresh: %s: %s (status=%d permanent=%v)", e.Code, e.Message, e.HTTPStatus, e.Permanent)
	}
	return fmt.Sprintf("oauth refresh: %s (status=%d permanent=%v)", e.Code, e.HTTPStatus, e.Permanent)
}

// IsPermanentRefresh returns true when err is a RefreshError that requires
// re-authentication (the refresh token itself is dead or revoked).
func IsPermanentRefresh(err error) bool {
	if err == nil {
		return false
	}
	re, ok := err.(*RefreshError)
	return ok && re.Permanent
}

// classifyRefreshError inspects the token endpoint response body and HTTP
// status to decide whether a refresh failure is permanent. The "error" field
// is polymorphic: standard OAuth uses a string ("error": "invalid_grant"),
// while OpenAI uses a nested object ("error": {"message": "...",
// "code": "token_revoked"}).
func classifyRefreshError(body []byte, status int) *RefreshError {
	var raw struct {
		Error            json.RawMessage `json:"error"`
		ErrorDescription string          `json:"error_description"`
	}
	_ = json.Unmarshal(body, &raw)

	var code, msg string
	msg = raw.ErrorDescription

	if len(raw.Error) > 0 {
		// Try string first.
		var s string
		if json.Unmarshal(raw.Error, &s) == nil {
			code = s
		} else {
			// Try object.
			var obj struct {
				Message string `json:"message"`
				Code    string `json:"code"`
				Type    string `json:"type"`
			}
			if json.Unmarshal(raw.Error, &obj) == nil {
				if obj.Code != "" {
					code = obj.Code
				} else if obj.Type != "" {
					code = obj.Type
				}
				if obj.Message != "" {
					msg = obj.Message
				}
			}
		}
	}

	// permanentCodes are OAuth error codes that indicate the refresh token
	// itself is invalid and cannot be recovered. Client- and consent-side
	// codes (unauthorized_client, access_denied) are deliberately excluded:
	// they do not prove the stored token is dead, and HTTP 401/403 alone is
	// equally unreliable — some auth servers answer 401 for transient
	// outages, and marking that permanent forces needless re-authentication.
	permanentCodes := map[string]bool{
		"token_revoked":     true,
		"token_invalidated": true,
		"invalid_grant":     true,
		"invalid_token":     true,
	}

	permanent := permanentCodes[strings.ToLower(code)]

	// Transient: rate limiting or server errors.
	if status == 429 || status >= 500 {
		permanent = false
	}

	return &RefreshError{
		Code:       code,
		Message:    msg,
		HTTPStatus: status,
		Permanent:  permanent,
	}
}
