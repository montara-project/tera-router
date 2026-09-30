# Port IDRouter Admin Backend → apps/server (Fiber v3 + Postgres)

## Latar belakang
- **IDRouter** (`IDrouter/backend`, ~95k baris Go, chi + SQLite/Postgres): AI gateway dengan admin REST API lengkap. Yang diport tahap ini: **admin/dashboard REST API + domain model + persistence**.
- **apps/server**: scaffold Fiber v3, module `tera-router/server`, Postgres via `lib/pq` + golang-migrate (migrations belum ada, seeder belum ada), factory handlers/services/repositories masih kosong.
- **Kontrak wajib** = mock service `apps/web-ui/src/lib/api/services/*`: envelope `{data, metadata, message?}`, error `{message, errors: [{code, field, message, param}]}`, auth JWT (`sign-in {email,password}` → `{uid, display_name, email, access_token, refresh_token, id_token, expires_at, expires_in, role}`, `refresh {refresh_token}`, `/me`, `/sign-out`), pagination offset/limit.
- **Tidak diport tahap ini** (di-dokumentasikan sebagai fase berikutnya): jalur proxy LLM (`/v1/chat/completions`, dispatch, meter, pipeline, normalizer), SSE streams, tunnel/relay-deploy, OAuth device-flow provider (kiro/qoder/cursor/…), MCP bridge, 9router migration, database export/import.

## Keputusan desain
1. **Postgres + golang-migrate** (stack apps/server yang sudah ada), SQL tulisan tangan seperti repos IDRouter.
2. **Auth**: user email+password (argon2id, parameter port dari `IDrouter/internal/crypto/apikey.go`) + JWT HMAC-SHA256 akses 1 jam + refresh token 30 hari (di-hash sha256 di tabel `refresh_tokens`, rotasi saat refresh). Secret = `APP_SECRET`.
3. **Enkripsi rahasia**: port `crypto/envelope.go` (AES-256-GCM envelope: DEK per rahasia, dibungkus KEK). KEK diturunkan dari `APP_SECRET` via HKDF-SHA256 (stdlib Go 1.24+), tidak perlu file master key. Taxasi akun & API key revealable (column `*_wrapped_dek`, `*_ciphertext`).
4. **API key**: port `crypto/apikey.go`, prefix `kr_` (sesuai mock web-ui), argon2id verifier + lookup sha256 + display mask; plaintext hanya muncul sekali di create, recoverable via `/keys/{id}/reveal`.
5. **Response envelope & error** disatukan: helper di `internal/dtos`, error bertipe di `internal/lib/apperr`, ErrorHandler Fiber di `cmd/api/server.go` diarahkan ke envelope web-ui; `WrapValidationError` diubah jadi array `{code, field, message, param}`.

## Struktur file baru/ubah di apps/server
```
cmd/api/main.go            → buka *sql.DB, assemble Repos+Services ke Application, tutup saat shutdown
cmd/api/server.go          → ErrorHandler pakai apperr + envelope
cmd/api/routes.go          → grup /v1 + middleware auth
cmd/migrate/               → tetap; seeder diganti yang benar-benar ada
Makefile                   → target migrate (up/down/refresh/seed)
internal/app/application.go→ tambah DB, Repos, Services
internal/config/config.go  → tambah ConfigAuth (AccessTTL/RefreshTTL) + ConfigSeeder (admin email/pass) bila perlu
internal/lib/apperr/       → error bertipe + mapping status HTTP (baru)
internal/lib/sealer/       → port envelope encryption (baru)
internal/lib/password/     → argon2id hash/verify (baru)
internal/lib/apikey/       → generator kr_ key (baru)
internal/dtos/             → common.go (envelope, Metadata), + dto per resource (auth, key, plan, chain, account, provider, budget, quota, proxy_pool, skill, settings)
internal/models/           → entitas domain (user, role, api_key, plan, account, provider, chain, alias, budget, usage, proxy_pool, skill, pricing_override, capability_override, setting, audit)
internal/repositories/     → users, refresh_tokens, api_keys, plans, chains, aliases, providers, accounts, budgets, usage, proxy_pools, skills, settings, audit, pricing, capability + factory.go
internal/services/         → auth, keys, plans, chains, routing(aliases), accounts, providers(+katalog statis port dari connectors IDRouter), budgets (lazy period-reset port dari IDRouter), usage (agregasi), quota (snapshot + summary range), proxy_pools (+test nyata), settings, skills, console (ring buffer), system (gopsutil + runtime + ring history), media (katalog statis), audit + factory.go
internal/handlers/         → auth, keys, plans, chains, accounts, providers, budgets, usage, quota, proxy_pools, settings, skills, console, system, media + middleware.go (RequireAuth JWT → ContextSetUID) + factory.go
internal/seeders/          → role, admin user, default plan, default settings (fix referensi ProviderSeeder di cmd/migrate)
migrations/                → 000001…000008 (up/down, Postgres)
```

## Migrasi (8 file)
1. `roles`, `users` (fullname, email unique, phone, address, token_verify, password_hash, is_active, is_blocked, role_id, deleted_at, timestamps)
2. `refresh_tokens` (user_id fk, token_hash unique, expires_at, revoked_at)
3. `custom_providers` (name, slug unique, base_url, api_kind, pricing jsonb, enabled, priority, metadata) + `accounts` (provider, label, auth_kind, kolom envelope secret/token/refresh, key_fingerprint, key_hash, token_expires_at, metadata jsonb, priority, disabled, proxy_pool_id, needs_reconnect)
4. `plans` (name, description, limit_micros, limit_tokens, period, alert_pct, hard_cutoff, allowed_models text[], rpm/tpm/concurrent int null) + `api_keys` (user_id, plan_id, name, key_hash, lookup_hash unique, display, scopes, disabled, last_used_at, kolom envelope reveal)
5. `chains` + `chain_steps`, `model_aliases` + `alias_targets`
6. `budgets` (scope_kind, scope_id, limit_*, remaining_*, period_bucket)
7. `usage_records` (bigserial + index created_at, api_key_id, provider, model)
8. `proxy_pools`, `skills`, `settings` (kv jsonb), `audit_entries`, `model_pricing_overrides`, `model_capability_overrides`

## Endpoint yang diimplementasikan (semua di bawah `/v1`)
- **Auth (publik)**: `POST /auth/sign-in`, `POST /auth/refresh`; **terproteksi**: `GET /auth/me`, `POST /auth/sign-out` (`/auth/google/redirect` → 501 untuk saat ini)
- **Keys**: `GET/POST /keys`, `GET/PUT/PATCH/DELETE /keys/{id}`, `POST /keys/{id}/reveal` — respons list berisi `id, name, status, keyPreview, planLabel, planNote, createdAt` (fullKey hanya saat create/reveal)
- **Plans**: CRUD + `GET /plans/{id}/keys`
- **Chains**: CRUD + `GET /chains/{id}/usage`; **Aliases**: `GET/PUT/DELETE /models/alias`
- **Providers**: `GET /providers` → `{connected: [yang punya account/custom provider], available: [katalog statis port IDRouter]}` dengan field `id, name, slug, connected, accounts, capabilities, official`
- **Accounts**: `GET/POST /accounts`, `POST /accounts/bulk`, `POST /validate-key`, `GET/PATCH/DELETE /accounts/{id}`, `POST /accounts/{id}/test|reveal`, `GET /accounts/{id}/quota`, `POST /accounts/{id}/quota/reset`, custom-provider CRUD
- **Budgets**: CRUD + `GET /budgets/status` (hitung pemakaian vs limit dari usage_records, lazy period reset port IDRouter)
- **Usage**: `GET /usage`, `GET /usage/models`, `GET /usage/insights` (agregasi SQL; kosong sampai fase gateway)
- **Quota**: `GET /quota` (list akun gaya QuotaAccount mock), `GET /quota/overview?range=`, `PATCH/DELETE /quota/{id}` (toggle status/disable account)
- **Proxy pools**: CRUD + `POST /proxy-pools/{id}/test` (HTTP request nyata lewat proxy, update last_tested_at)
- **Settings**: `GET/PUT /settings` (kv jsonb, struct `AppSettings` sesuai mock: rtk/caveman/terse/headroom/round-robin/timeout/branding dll.)
- **Skills**: `GET/POST /skills`, `DELETE /skills/{id}`
- **Console**: `GET /console`, `DELETE /console` (ring buffer 500 entri, terisi dari audit + lifecycle request)
- **System**: `GET /system/stats` (host CPU/mem/disk via gopsutil, proses & Go runtime, history ring 60 titik)
- **Media**: `GET /media` (katalog statis port IDRouter)
- `/health` tetap; ID di-generate uuid v7-style dengan MachineID tetap dipakai untuk kompatibilitas

## Urutan kerja
1. Fondasi: apperr, dtos envelope, ErrorHandler, Application+DB wiring, routes group
2. Lib crypto: sealer, password, apikey (+ unit test)
3. Migrations + models + repositories (+ factory)
4. Services (+ katalog statis provider/media, lazy budget reset) (+ factory)
5. Middleware auth + handlers + routes
6. Seeders + fix cmd/migrate + Makefile target
7. Verifikasi: `go build ./...`, `go vet ./...`, `go test ./...`, jalankan `make run` + smoke test curl (sign-in → CRUD keys/plans/chains/settings → system stats), `gofmt`

Catatan: butuh Postgres lokal yang hidup (DATABASE_URL di `.env`) untuk smoke test; jika tidak jalan, semua verifikasi kompilasi & unit test tetap dijalankan dan smoke test ditandai.