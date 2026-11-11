# Security Audit Report: Tera Router

## 1. Run Metadata & Execution Policy
- **Run ID**: `run-1`
- **Target Repository**: `tera-router` (`/Users/masb0ymas/Work/Projects/montara-projects/tera-router`)
- **Source Reference**: `c19b180c34a6687b82eb5f279dd3b5aee3e3806d (dirty)`
- **Run Profile**: `standard` (Full comprehensive 6-phase review)
- **Scope Paths**: `apps/server, apps/web-ui, apps/main-web, apps/docs, deploy`
- **Execution Policy**: `sandboxed-source-and-local-only` (Strict OS-enforced local sandbox, offline verification, no live network probing)
- **Prior Run History**: None (Fresh initial audit baseline)

## 2. Security Posture Summary
Tera Router demonstrates solid defensive foundations: parameterized SQL queries across all repositories, a memory-safe CGO-free pure Go SQLite runtime (`modernc.org/sqlite`), envelope encryption (AES-256-GCM) for stored credentials, tamper-evident hash chaining for audit logs, and single-use WebAuthn challenge tokens.

The comprehensive audit identified **8 confirmed vulnerabilities** across authentication controls, cryptographic binding, administrative boundaries, and gateway routing:
- **4 High-Severity Findings**:
  1. `auth.totp.enable-missing-reauth`: Missing re-authentication on TOTP enrollment allows account takeover and permanent administrator lockout via an intercepted session token.
  2. `backup.database.restore-missing-reauth-and-schema-validation`: Missing step-up re-authentication and omission of `users` table validation in live database restore enables persistent account takeover and denial of service.
  3. `crypto.app-secret.unenforced-entropy-warning`: Permissive startup allowing weak `APP_SECRET` (<32 characters) leaves HMAC-SHA256 JWT tokens open to offline dictionary cracking and master key recovery.
  4. `gateway.quota.concurrency-metering-race-condition`: Asynchronous metering and missing concurrency reservation allow concurrent bursts to bypass hard-cutoff spend budgets and TPM limits.
- **4 Medium-Severity Findings**:
  1. `crypto.sealer.missing-aad-context-binding`: Missing Authenticated Additional Data (AAD) in envelope encryption allows ciphertext transplantation between database tables.
  2. `gateway.auth.api-key-scopes-unenforced`: API key scopes configured in the database are not enforced by inference gateway route handlers.
  3. `handlers.skills.host-header-injection-credential-theft`: Host header injection in public agent skill retrieval (`GET /skills/:slug/SKILL.md`) reflects arbitrary hostnames into setup guides, enabling API key theft.
  4. `oauth.callback.wildcard-postmessage-origin`: Wildcard target origin (`*`) in OAuth callback `postMessage` and unvalidated MessageEvent listener permit cross-origin UI manipulation.
- **1 Rejected Lead**:
  - `gateway.egress.ssrf-redirect-pivot-and-dns-rebinding` was refuted by source code inspection: `POST /v1/web/fetch` forwards URLs as payload to third-party SaaS providers (Firecrawl, Exa, Tavily, Jina AI) rather than directly dialing target URLs, preventing local SSRF pivoting.

---

## 3. Confirmed Findings Summary

| Fingerprint | Severity | Title | Affected Boundary | Observed Result |
| :--- | :--- | :--- | :--- | :--- |
| `auth.totp.enable-missing-reauth` | **HIGH** | Missing Re-Authentication on TOTP Enrollment Allows Account Takeover and Persistent Administrator Lockout via Stolen Session | `apps/server/cmd/api/routes.go` -> `apps/server/internal/handlers/auth_totp.go` | Server accepts TOTP enrollment without password re-authentication, commits attacker's TOTP secret to users table, and blocks subsequent password-only sign-ins with totp_required: true |
| `backup.database.restore-missing-reauth-and-schema-validation` | **HIGH** | Missing Step-Up Re-Authentication and Inadequate Schema Validation in Database Restore Enables Persistent Account Takeover and Denial of Service | `apps/server/cmd/api/routes.go` -> `apps/server/internal/handlers/backup.go` | Server accepts arbitrary SQLite database without re-authentication, overwrites live database, and grants access to attacker account credentials while invalidating legitimate accounts |
| `crypto.app-secret.unenforced-entropy-warning` | **HIGH** | Unenforced Minimum APP_SECRET Length and Saltless KEK Derivation Permit Offline Token Cracking and Master Key Recovery | `apps/server/cmd/api/flag.go` -> `apps/server/internal/lib/token/token.go` | Server accepts weak secrets on startup, produces crackable HS256 tokens, and permits full authentication bypass upon secret recovery |
| `gateway.quota.concurrency-metering-race-condition` | **HIGH** | Asynchronous Metering and Missing Concurrency Reservation Allows Hard-Cutoff Budget and Rate Limit Bypass | `apps/server/internal/gateway/handlers.go` -> `apps/server/internal/gateway/meter.go` | All concurrent requests are admitted and processed upstream, bypassing hard-cutoff budgets and per-minute limits due to unreserved in-flight usage and asynchronous metering. |
| `crypto.sealer.missing-aad-context-binding` | **MEDIUM** | Missing Authenticated Additional Data (AAD) in Envelope Encryption Allows Cross-Table Ciphertext Transplantation and Plaintext Secret Recovery via API Key Reveal | `apps/server/cmd/api/routes.go` -> `apps/server/internal/lib/sealer/sealer.go` | Ciphertext transplantation succeeds: Open decrypts the transplanted account credential without error, returning the plaintext provider key |
| `gateway.auth.api-key-scopes-unenforced` | **MEDIUM** | API Key Scopes Configured in Database Are Unchecked by Inference Gateway Handlers | `apps/server/internal/gateway/auth.go` -> `apps/server/internal/gateway/server.go` | The gateway admits the request and generates model completions with HTTP 200 OK because key.Scopes is never checked. |
| `handlers.skills.host-header-injection-credential-theft` | **MEDIUM** | Host Header Injection in Unauthenticated Agent Skill Retrieval (GET /skills/:slug/SKILL.md) | `apps/server/cmd/api/routes.go` -> `apps/server/internal/handlers/skill_docs.go` | The server returns 200 OK with the attacker's host reflected into the Markdown documentation instructing agents to transmit their API key to that host. |
| `oauth.callback.wildcard-postmessage-origin` | **MEDIUM** | Wildcard Target Origin in OAuth Callback postMessage and Missing Origin Verification in Web UI Message Listener Permit Cross-Origin Spoofing | `apps/server/internal/handlers/oauth.go` -> `apps/web-ui/src/components/block/providers/use-oauth-connect.ts` | Dashboard accepts message from arbitrary origin without origin validation and updates UI state |

---

## 4. Confirmed Findings (Detailed Analysis)

### 1. [auth.totp.enable-missing-reauth] Missing Re-Authentication on TOTP Enrollment Allows Account Takeover and Persistent Administrator Lockout via Stolen Session
- **Severity**: **HIGH** (Likelihood: medium, Impact: high)
- **Root Cause**: In `apps/server/internal/handlers/auth_totp.go`, `TOTPEnable` processes `dtos.TOTPEnable` containing secret and code, verifying `totp.Verify()` but omitting any step-up password verification via `reauthenticate()`. Once set in the users table, `SignIn` requires the TOTP code on all subsequent attempts.
- **Intended Behavior**: Enrolling or modifying authentication factors must require primary credential re-authentication (`reauthenticate()`) to ensure that possession of a bearer session token alone is insufficient to alter authentication factors or lock out the account owner.
- **Source Trace**:
  - `[entrypoint]` `apps/server/cmd/api/routes.go:71` in `routes`: Route `POST /v1/auth/totp/enable` is registered under protected v1 group with only `RequireAuth` middleware
  - `[propagation]` `apps/server/internal/handlers/auth_totp.go:84` in `TOTPEnable`: Handler receives secret and code in request body and resolves authenticated user from context
  - `[propagation]` `apps/server/internal/handlers/auth_totp.go:100` in `TOTPEnable`: Handler verifies code validity against provided secret with `totp.Verify()` without re-authenticating user password
  - `[sink]` `apps/server/internal/handlers/auth_totp.go:108` in `TOTPEnable`: Handler seals secret and commits `totp_wrapped_dek`, `totp_ciphertext`, and `totp_last_step` to users table, enabling TOTP
- **Demonstrated Impact**: Allows an attacker with a temporary session to permanently lock out the administrator and secure persistent two-factor access, requiring database manipulation or service reboot with `ADMIN_TOTP_RESET=true` to recover
- **Smallest Effective Fix**:
  - Strategy: Require step-up re-authentication with password (via `reauthenticate`) before allowing TOTP setup, enrollment, or disabling, matching the security control in `RegisterBegin`.

---

### 2. [backup.database.restore-missing-reauth-and-schema-validation] Missing Step-Up Re-Authentication and Inadequate Schema Validation in Database Restore Enables Persistent Account Takeover and Denial of Service
- **Severity**: **HIGH** (Likelihood: medium, Impact: critical)
- **Root Cause**: In `apps/server/internal/handlers/backup.go`, `DatabaseRestore` processes the upload and replaces the live database without invoking `reauthenticate()`, and `inspectDatabase` checks only `sqlite_master` count for four table names without validating the `users` table or verifying that encrypted secret fields can be opened by the host `APP_SECRET`.
- **Intended Behavior**: `DatabaseRestore` must require step-up re-authentication via `reauthenticate(c, h.app, req.Password, req.OTP)` matching `DatabaseDownload`, and `inspectDatabase` must verify table completeness (including `users` and `roles`), run `PRAGMA foreign_key_check`, and test-decrypt at least one sealed credential before initiating `RestoreFrom`.
- **Source Trace**:
  - `[entrypoint]` `apps/server/cmd/api/routes.go:241` in `routes`: Route `POST /v1/backup/database/restore` is registered under protected backup group with only `RequireAuth` middleware
  - `[propagation]` `apps/server/internal/handlers/backup.go:368` in `DatabaseRestore`: `DatabaseRestore` parses uploaded SQLite file without enforcing step-up re-authentication
  - `[propagation]` `apps/server/internal/handlers/backup.go:409` in `DatabaseRestore`: `inspectDatabase` verifies `PRAGMA integrity_check` and four table names in `sqlite_master`, omitting `users` table validation and secret checks
  - `[sink]` `apps/server/internal/handlers/backup.go:425` in `DatabaseRestore`: `h.app.Repos.Backup.RestoreFrom(ctx, tmp)` invokes SQLite online backup `Step(-1)` overwriting live database page by page
- **Demonstrated Impact**: Complete database replacement, persistent administrator lockout, arbitrary account takeover, or complete denial of service.

---

### 3. [crypto.app-secret.unenforced-entropy-warning] Unenforced Minimum APP_SECRET Length and Saltless KEK Derivation Permit Offline Token Cracking and Master Key Recovery
- **Severity**: **HIGH** (Likelihood: low, Impact: critical)
- **Root Cause**: In `apps/server/cmd/api/flag.go`, `validateFlag` checks `len(cfg.App.Secret) < minSecretLen` and logs a WARNING without terminating startup, allowing weak secrets. In `apps/server/internal/lib/sealer/sealer.go`, `FromSecret` calls `hkdf.Key(sha256.New, []byte(appSecret), nil, hkdfInfo, KeySize)` with nil salt, leaving the derived KEK completely vulnerable to offline dictionary attack if `APP_SECRET` is weak.
- **Intended Behavior**: The server must refuse to start (`log.Fatal`) in production or non-test environments if `APP_SECRET` has less than 32 characters or low entropy, preventing deployment with trivial secrets that compromise HS256 token integrity and AES-256-GCM data encryption keys.
- **Source Trace**:
  - `[entrypoint]` `apps/server/cmd/api/flag.go:32` in `parseFlag`: Flag `-app-secret` or `APP_SECRET` environment variable is parsed into `cfg.App.Secret`
  - `[propagation]` `apps/server/cmd/api/flag.go:80` in `validateFlag`: `validateFlag` logs a warning if secret length is less than 32 characters but does not abort execution
  - `[propagation]` `apps/server/cmd/api/main.go:75` in `assemble`: `assemble` passes weak secret to `sealer.FromSecret` which uses saltless HKDF
  - `[sink]` `apps/server/internal/lib/token/token.go:46` in `SignAccess`: Access tokens are signed using HMAC-SHA256 with the weak secret, allowing offline brute-force attacks
- **Demonstrated Impact**: Complete compromise of all authentication and all encrypted secrets at rest across the entire installation.

---

### 4. [gateway.quota.concurrency-metering-race-condition] Asynchronous Metering and Missing Concurrency Reservation Allows Hard-Cutoff Budget and Rate Limit Bypass
- **Severity**: **HIGH** (Likelihood: high, Impact: high)
- **Root Cause**: Absence of in-flight spend or token reservation upon request admittance, coupled with asynchronous non-blocking persistence of usage records to SQLite.
- **Intended Behavior**: The gateway should track in-flight token and spend reservations against hard-cutoff budgets and per-minute limits, rejecting requests whose projected or in-flight consumption exceeds remaining quota, and record usage synchronously or with atomic in-memory accumulators.
- **Source Trace**:
  - `[entrypoint]` `apps/server/internal/gateway/handlers.go:119` in `Server.handleChat`: Inbound chat completion request admitted by gateway acquire semaphore
  - `[propagation]` `apps/server/internal/gateway/handlers.go:205` in `Server.handleChat`: Invokes `checkBudgets` and `checkRateLimits` without reserving in-flight spend
  - `[propagation]` `apps/server/internal/gateway/access.go:154` in `Server.checkBudgets`: `usageSince` queries historical database records via `SumSince`, returning zero for all concurrent in-flight requests
  - `[sink]` `apps/server/internal/gateway/meter.go:145` in `Server.recordUsage`: Actual usage is persisted asynchronously in a background goroutine, leaving a persistent TOCTOU window
- **Demonstrated Impact**: Direct financial loss to the operator and exhaustion of upstream provider quotas despite explicit hard-cutoff configuration.

---

### 5. [crypto.sealer.missing-aad-context-binding] Missing Authenticated Additional Data (AAD) in Envelope Encryption Allows Cross-Table Ciphertext Transplantation and Plaintext Secret Recovery via API Key Reveal
- **Severity**: **MEDIUM** (Likelihood: low, Impact: high)
- **Root Cause**: In `apps/server/internal/lib/sealer/sealer.go`, `encrypt()` calls `gcm.Seal(nonce, nonce, plaintext, nil)` with nil additional data for both DEK wrapping and secret encryption. No contextual metadata (such as table name, record UUID, or purpose) is included in the AEAD authentication tag, allowing valid ciphertexts from any table or column to be decrypted in any other context.
- **Intended Behavior**: AES-256-GCM encryption in sealer should pass Authenticated Additional Data (e.g. format: `<namespace>:<table_name>:<record_id>:<column_name>`) when sealing both the DEK and the secret ciphertext, ensuring that ciphertexts cannot be transplanted across different records or columns without failing authentication tag verification.
- **Source Trace**:
  - `[entrypoint]` `apps/server/cmd/api/routes.go:95` in `routes`: Route `POST /v1/keys/:id/reveal` is registered under protected v1 group
  - `[propagation]` `apps/server/internal/handlers/keys.go:341` in `Reveal`: Handler fetches APIKey record by id and retrieves `key.Secret` struct containing `WrappedDEK` and `Ciphertext`
  - `[propagation]` `apps/server/internal/lib/sealer/sealer.go:103` in `Open`: `Open` unmarshals base64 `WrappedDEK` and `Ciphertext` and decrypts them using `decrypt()`
  - `[sink]` `apps/server/internal/lib/sealer/sealer.go:166` in `decrypt`: `gcm.Open` authenticates and decrypts ciphertext with nil additional data, succeeding even when ciphertext originated from another table
- **Demonstrated Impact**: Breaks the isolation between unrevealable provider credentials and user-revealable API keys, exposing high-value upstream credentials.

---

### 6. [gateway.auth.api-key-scopes-unenforced] API Key Scopes Configured in Database Are Unchecked by Inference Gateway Handlers
- **Severity**: **MEDIUM** (Likelihood: medium, Impact: medium)
- **Root Cause**: Omission of scope enforcement middleware or per-endpoint scope verification in the inference gateway router.
- **Intended Behavior**: The gateway should check that the authenticated key's `Scopes` include the required permission (e.g. `inference:chat`, `inference:media`, `web:fetch`) before allowing request execution, returning 403 Forbidden when unauthorized.
- **Source Trace**:
  - `[entrypoint]` `apps/server/internal/gateway/auth.go:40` in `Server.authMiddleware`: Extracts token from Authorization or x-api-key header and verifies against repository
  - `[propagation]` `apps/server/internal/gateway/auth.go:55` in `Server.authMiddleware`: Binds `models.APIKey` into context locals `authedKeyLocal` without checking `key.Scopes`
  - `[sink]` `apps/server/internal/gateway/server.go:167` in `Register`: Attaches `authMiddleware` directly to handlers without any scope inspection, granting full access to restricted keys
- **Demonstrated Impact**: Breaches principle of least privilege, enabling restricted keys to consume unauthorized inference and media generation services.

---

### 7. [handlers.skills.host-header-injection-credential-theft] Host Header Injection in Unauthenticated Agent Skill Retrieval (GET /skills/:slug/SKILL.md)
- **Severity**: **MEDIUM** (Likelihood: medium, Impact: high)
- **Root Cause**: Unvalidated reflection of client-supplied `Host` and `X-Forwarded-Proto` headers into sensitive agent configuration documentation.
- **Intended Behavior**: `requestBaseURL` should prioritize the configured server URL (`app.Config.App.APIURL`) or validate the incoming Host header against an allowlist before embedding it into agent documentation.
- **Source Trace**:
  - `[entrypoint]` `apps/server/cmd/api/routes.go:31` in `routes`: Registers public unauthenticated route `GET /skills/:slug/SKILL.md`
  - `[propagation]` `apps/server/internal/handlers/skill_docs.go:62` in `skillsHandler.requestBaseURL`: Reads unvalidated `c.Host()` and `X-Forwarded-Proto` header to construct base URL
  - `[sink]` `apps/server/internal/handlers/skill_docs.go:31` in `skillsHandler.Document`: Replaces `{{BASE_URL}}` in markdown template instructing agents to send Bearer API key to reflected host
- **Demonstrated Impact**: Theft of Inbound API Keys from AI agents following the setup documentation.

---

### 8. [oauth.callback.wildcard-postmessage-origin] Wildcard Target Origin in OAuth Callback postMessage and Missing Origin Verification in Web UI Message Listener Permit Cross-Origin Spoofing
- **Severity**: **MEDIUM** (Likelihood: low, Impact: medium)
- **Root Cause**: In `apps/server/internal/handlers/oauth.go:481`, `renderOAuthPopupResult` specifies `targetOrigin: "*"` instead of restricting to the dashboard origin, and in `apps/web-ui/src/components/block/providers/use-oauth-connect.ts:141`, the message event handler does not check `event.origin` against expected origins.
- **Intended Behavior**: `renderOAuthPopupResult` should accept and enforce the dashboard specific origin as the `postMessage` `targetOrigin`, and `use-oauth-connect.ts` should verify that `event.origin` matches the expected loopback callback server origin before processing the event.
- **Source Trace**:
  - `[entrypoint]` `apps/server/internal/handlers/oauth.go:381` in `ensureLoopback`: Callback HTTP handler is bound to `GET /auth/callback` on fixed loopback port
  - `[propagation]` `apps/server/internal/handlers/oauth.go:427` in `loopbackCallback`: `loopbackCallback` executes token exchange and renders HTML page via `renderOAuthPopupResult`
  - `[propagation]` `apps/server/internal/handlers/oauth.go:481` in `renderOAuthPopupResult`: Inline script executes `window.opener.postMessage(payload, "*")` with wildcard target origin
  - `[sink]` `apps/web-ui/src/components/block/providers/use-oauth-connect.ts:141` in `useOAuthConnect`: MessageEvent listener processes completion without validating `event.origin`
- **Demonstrated Impact**: Allows cross-origin pages to spoof OAuth connection status, manipulate UI feedback, and trigger unauthorized refresh queries.

---

## 5. Rejected Candidate Record
| Fingerprint | Claimed Root Cause | Refutation Reason |
| :--- | :--- | :--- |
| `gateway.egress.ssrf-redirect-pivot-and-dns-rebinding` | Absence of CheckRedirect policy restricting target redirects on sharedClient in connectors/http.go and absence of socket-level IP validation via net.Dialer.Control. | Refuted by source code: apps/server/internal/connectors/web.go does not directly dial the user-supplied target URL. Instead, WebFetch dispatches an API request to an external third-party scraping SaaS provider (Exa, Tavily, Firecrawl, or Jina-AI), passing the target URL as JSON data or URL path. The third-party provider's remote servers execute the fetch; tera-router's sharedClient only connects to the provider's API endpoint (e.g. api.firecrawl.dev). Any HTTP 302 redirect issued by the target URL is received by the third-party provider's servers in the cloud, never by tera-router's local HTTP client. Thus, sharedClient cannot be pivoted into cloud metadata or internal networks. |

---

## 6. Needs Validation
No unconfirmed leads or unresolved blockers remain. All 9 candidate leads have been conclusively settled and independently verified through repository source evidence and bounded local execution checks.

---

## 7. Defensive Hardening Notes & Positive Patterns
### Positive Security Patterns
1. **Parameterized SQL Queries**: All queries across `internal/repositories` use strict parameterized placeholders (`$1, $2, ...`), preventing SQL injection.
2. **CGO-Free SQLite Architecture**: Pure Go SQLite (`modernc.org/sqlite`) eliminates C-level buffer overflows and memory corruption vulnerabilities in the database driver.
3. **Envelope Encryption for Stored Secrets**: Provider API keys and OAuth tokens are sealed at rest using AES-256-GCM with per-secret DEKs wrapped under a KEK derived from `APP_SECRET`.
4. **Tamper-Evident Audit Logging**: System audit logs incorporate cryptographic SHA-256 chaining to guarantee immutability and detect omitted records.
5. **Single-Use Passkey Ceremonies**: WebAuthn registration and authentication ceremonies are single-use and bound to temporary tokens, preventing assertion replay.

### Hardening Recommendations
1. **Passkey Deletion Lacks Step-Up Auth**: `DELETE /v1/auth/passkeys/:id` removes credentials without password or WebAuthn re-authentication (`reauthenticate`), unlike `RegisterBegin` which requires step-up auth.
2. **TOTP Disabling Lacks Password Re-Authentication**: `POST /v1/auth/totp/disable` only validates `req.Code` without requiring the account password via `reauthenticate()`, allowing an attacker with an intercepted code to disable MFA.
3. **Absence of Role Enforcement in Protected Handlers**: The server schema defines admin and user roles (`apps/server/internal/seeders/role.go`), but `RequireAuth` only checks account state and session revocation, omitting any check on `claims.Role`. If user-level accounts are added in the future, they would inherit full access to administrative endpoints.
4. **Omission of jwt.WithIssuer Validation in token.ParseAccess**: Access tokens set `Issuer: 'tera-router'`, but `ParseAccess` relies on default claims validation without explicitly verifying the `iss` claim.
5. **Unchecked Tool Installation Status on CLI Config Apply**: `POST /v1/cli-tools/:id/apply` writes configuration directories and files in host `$HOME` even if the targeted CLI tool is not detected as installed by `DetectCLITools()`, creating unmanaged dotfiles and folders.
6. **Missing Step-Up Reauthentication on CLI Tool Configuration**: Modifying developer environment and CLI tool configurations on the host (e.g. `~/.claude/settings.json`, `~/.hermes/.env`) does not require password/OTP re-authentication.
7. **Wildcard CORS Allowed Origins Default**: The `cors-allowed-origins` flag defaults to `*` in `apps/server/cmd/api/flag.go` and is passed to `cors.New()` in `server.go`. Setting `*` exposes public API endpoints, models, and latency metrics to arbitrary cross-origin sites.
8. **Unauthenticated Fixed Loopback HTTP Listener**: The loopback callback server bound to `localhost:1455`/`1457` lacks HTTP Basic/Bearer authentication and accepts any `GET /auth/callback?code=...&state=...` request from local processes.
9. **X-TeraRouter-Model Response Header Reflection**: In `unary.go:173`, `stream.go:67`, and `web.go:191`, `c.Set('X-TeraRouter-Model', echo)` reflects user-supplied model names directly into HTTP response headers.
10. **Cache Invalidation on Plan Mutation**: In `handlers/plans.go`, `Update` and `Delete` do not call `h.app.KeysChanged()`. If an administrator alters a plan's allowed models, rate limits, or budgets, API keys already cached in `authCache` remain valid under their cached version until `authCacheTTL` expires (5 minutes).
11. **Pre-Request Token and Budget Estimation**: Quota checks in `access.go` compare current cumulative spend against budget caps without estimating prompt or max completion tokens of the incoming request, allowing a single request to consume significantly more than the remaining budget balance.

---

## 8. Coverage Ledger Summary
- **Total Seeded Units**: 8
- **Covered (Clean) Units**: 1 (`apps/server/cmd/api/routes.go#POST /v1/cli-tools/:id/apply`)
- **Candidate (Confirmed) Units**: 7
- **Blocked Units**: 0
- **Deferred Units**: 0
- **Coverage Critic Disposition**: Clean pass (`stop: true`, 0 missing units, 0 reassignments).
