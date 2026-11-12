# Audit Over-Engineering — tera-router

Hasil audit kode yang bisa dipangkas di seluruh repo (`apps/server`, `apps/web-ui`, `apps/main-web`, `apps/docs`, konfigurasi root, dan direktori skill). Audit ini hanya mencatat; belum ada perubahan yang diterapkan.

**Cakupan:** kode mati, abstraksi berlebih, dan duplikasi. Bug, keamanan, dan performa **di luar cakupan**.

**Level** = besarnya pemangkasan, bukan tingkat bahaya:

| Level    | Kriteria                                 |
| -------- | ---------------------------------------- |
| Critical | > 300 baris, atau dependency besar       |
| High     | 100–300 baris, atau 1 dependency runtime |
| Medium   | 30–100 baris                             |
| Low      | < 30 baris                               |

**Tag:**

- `delete` — kode mati, tidak ada penggantinya.
- `stdlib` — menulis ulang fungsi yang sudah ada di standard library.
- `native` — menulis ulang fitur yang sudah ada di platform atau di komponen repo.
- `yagni` — abstraksi dengan satu implementasi, config yang tak pernah diisi, atau layer dengan satu pemanggil.
- `shrink` — logika sama, bisa ditulis dengan baris lebih sedikit.

**Verifikasi:** setiap klaim "tidak dipakai" sudah dicek dengan grep simbolnya di seluruh repo. Artefak build (`dist/`, `node_modules/`, `tsconfig.tsbuildinfo`) tidak dihitung sebagai pemakai.

**Estimasi total:** sekitar **−8.800 baris** dan **−16 dependency**.

---

## Critical

- [x] **`delete` — 10 field form terdaftar tapi tidak pernah dirender**
  - Field: `RatingField`, `SliderField`, `SwitchField`, `CheckboxField`, `SelectGroupField`, `DatePickerField`, `DateRangePickerField`, `GalleryUploadField`, `RichTextEditorField`, `SubmitButton`.
  - Bukti: `field.X` atau `form.SubmitButton` untuk kesepuluhnya tidak muncul di mana pun. Yang dipakai hanya Text, Password, Select, Number, Combobox, dan Textarea.
  - Ikut terhapus:
    - `ui/{rating,slider,calendar}.tsx`
    - `common/{checkbox-input,date-picker-input,date_range-picker-input}.tsx`
    - `useFileUpload`; pindahkan `formatBytes` ke `lib/` karena masih dipakai `import-export-tab.tsx`.
  - Lokasi: `apps/web-ui/src/components/block/form/*`, `apps/web-ui/src/hooks/form.tsx`, `apps/web-ui/src/hooks/use-file-upload.tsx`
  - Dampak: ~−1.800 baris, −1 dependency (`react-day-picker`)

- [x] **`delete` — Editor rich-text Lexical**
  - File: `block/editor/{editor-inner,editor-system,editor-toolbar,rich-text-editor,theme}` dan `form/rich-text-editor-field.tsx`.
  - Satu-satunya pemakainya adalah registry form di atas, tapi karena terdaftar di situ ia tetap ikut ter-bundle dan ikut membesarkan chunk `form-*.js` (977 kB).
  - Lokasi: `apps/web-ui/src/components/block/editor/`
  - Dampak: ~−610 baris, −7 dependency (`lexical`, `@lexical/html`, `@lexical/list`, `@lexical/react`, `@lexical/rich-text`, `@lexical/utils`, `@lexkit/editor`)

- [x] **`delete` — Komponen data-grid drag-and-drop dan kolom tanpa importer**
  - File: `data-grid-table-dnd`, `data-grid-table-dnd-rows`, `data-grid-column-header`, `data-grid-column-filter`, `data-grid-column-visibility`.
  - Yang dipakai hanya `DataGrid`, `DataGridContainer`, `DataGridTable`, dan `DataGridPagination`, lewat `block/common/react-table.tsx`.
  - Lokasi: `apps/web-ui/src/components/ui/data-grid-*`
  - Dampak: ~−840 baris, −4 dependency (`@dnd-kit/core`, `@dnd-kit/modifiers`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)

- [x] **`delete` — Paket guardrails tidak pernah dipanggil di jalur inference**
  - `internal/gateway` tidak mengimpor paket ini. `Evaluate` hanya dipakai oleh endpoint preview `POST /v1/guardrails/evaluate`.
  - Ini keputusan produk: hapus paketnya beserta repository, migrasi, dan seed-nya, **atau** sambungkan ke `gateway/handlers.go`.
  - Kalau dipertahankan, minimal buang:
    - plumbing "external engine": `resolveEngine`, field `Engine`, dan toggle `external_detectors`. Tidak ada klien Presidio maupun moderation di repo, jadi toggle ini hanya mengubah teks catatan.
    - field `PiiConfig.ScanOutput` dan `MinConfidence`, yang tidak pernah dibaca.
  - Lokasi: `apps/server/internal/guardrails/engine.go`
  - Dampak: ~−440 baris (hapus total) atau ~−100 baris (pertahankan, bersihkan)

- [x] **`yagni` — Pola `X()` → `xExec()` di repository**
  - Ada 101 helper `*Exec`. Sebanyak 91 di antaranya hanya diteruskan satu baris oleh method publik yang memakai `r.DB`.
  - Hanya 7 yang benar-benar menerima transaksi: `accounts.insertExec`, `aliases.upsertExec`, `backup.columnsExec`, `chains.insertExec`, `chains.insertStepsExec`, `chains.updateExec`, `providers.deleteExec`.
  - Perbaikan: gabungkan tiap pasangan; pertahankan parameter `Executor` hanya pada 7 helper itu.
  - Lokasi: `apps/server/internal/repositories/*.go`
  - Dampak: ~−280 baris

- [x] **`delete` — 7 komponen `block/common` tanpa importer**
  - File: `empty-section`, `usage-card`, `simple-detail-card`, `simple-review-section`, `button-action` (berisi `ButtonAdd`/`ButtonRemove`), `external-link`, `simple-alert-scrollable-dialog`.
  - Yang masih dipakai hanya varian `-form` dari dialog itu.
  - Lokasi: `apps/web-ui/src/components/block/common/`
  - Dampak: ~−450 baris

- [ ] **`delete` — Skill vendored untuk framework yang tidak dipakai**
  - `.zcode/skills/authula/` (framework auth Go) dan `.zcode/skills/typesafe-ai/`: tidak ada referensinya di `apps/`.
  - `.zcode/plans/plan-sess_*.md`: rencana porting yang sudah selesai dikerjakan.
  - Dampak: ~−1.500 baris

---

## High

- [x] **`yagni` — Layer `lib/api/services/types/`**
  - 22 file yang tiap tipenya hanya dipakai sebagai anotasi `(): XResources` di file service pasangannya. TypeScript sudah bisa menyimpulkan tipe itu dari objek yang dikembalikan.
  - Lokasi: `apps/web-ui/src/lib/api/services/types/`
  - Dampak: ~−450 baris

- [ ] **`delete` — 24 ekspor ikon tidak terpakai**
  - Ikon: `google`, `googleColorful`, `twitter`, `facebook`, `facebookColorful`, `linkedinColorful`, `github`, `radix`, `aria`, `npm`, `yarn`, `pnpm`, `react`, `nextjs`, `prisma`, `radixui`, `supabaseColorful`, `tailwind`, `apple`, `paypal`, `postgresql`, `email`, `cognito`, dll.
  - Lokasi: `apps/web-ui/src/components/block/common/icons.tsx`
  - Dampak: ~−300 baris

- [x] **`delete` — Primitive UI `accordion` dan `radio-group`**
  - Keduanya tanpa importer.
  - Oct 30: `accordion` dihapus; `radio-group` kini dipakai `provider-detail/account-strategy-card.tsx`, jadi tetap.
  - Lokasi: `apps/web-ui/src/components/ui/{accordion,radio-group}.tsx`
  - Dampak: ~−270 baris

- [x] **`delete` — Factory REST generik `resource.ts`**
  - Tidak ada importer; setiap service sudah menulis objek resource-nya sendiri.
  - Ikut terhapus dari `types/api.ts`: `HTTP_METHOD`, `API_METHOD_MAP`, `ResourceMethods`, `Resources`, `ResourceProps`.
  - Lokasi: `apps/web-ui/src/lib/api/resource.ts`, `apps/web-ui/src/types/api.ts`
  - Dampak: ~−170 baris

- [x] **`delete` — Lapisan auth lama**
  - `lib/auth/auth-server.ts`: config `betterAuth()` yang tidak pernah diimpor.
  - `lib/auth/handler.ts`: `requireSession`, `getSession`, dan `redirectIfAuthenticated`, semuanya tanpa pemanggil.
  - Ikut terhapus: `types/auth.ts` (`AuthSession`) dan env `BETTER_AUTH_*` di `config/env.ts`.
  - Lokasi: `apps/web-ui/src/lib/auth/`
  - Dampak: ~−130 baris, −1 dependency (`better-auth`)

- [x] **`delete` — Fitur capability-override di frontend**
  - `capabilityList`, `capabilityPut`, `capabilityDelete`, dan `capabilityReset` tidak pernah dipanggil. Ikut terhapus: `CapabilitySchema` dan model `CapabilityOverride`.
  - Lokasi: `apps/web-ui/src/lib/api/{services,queries,dtos,models}/override*`
  - Dampak: ~−130 baris

- [x] **`delete` — Stack budget di frontend**
  - `services.budgets` tidak pernah dipanggil, dan tidak ada query maupun route budget.
  - Lokasi: `apps/web-ui/src/lib/api/{services,services/types,dtos,models}/budget*`
  - Dampak: ~−115 baris

- [ ] **`shrink` — Tabel recent requests terduplikasi**
  - `dashboard/overview-recent-requests` dan `cost-analytics/usage/usage-recent-requests` memakai grid `COLUMNS`, header, paginasi, dan footer yang sama.
  - Perbaikan: satu shell tabel berhalaman.
  - Dampak: ~−100 baris

- [x] **`delete` — Method repository tanpa pemanggil**
  - Method: `AuditRepository.List`, `UserRepository.Insert`, `UserRepository.UpdatePassword`, `UsageRepository.ByAPIKey`, `SkillRepository.Get`, `SkillRepository.Update`, `GuardrailRepository.Get`.
  - Lokasi: `apps/server/internal/repositories/{audit,users,usage,skills,guardrails}.go`
  - Dampak: ~−110 baris

- [ ] **`delete` — Simbol core dan gateway yang mati**
  - Tidak pernah dipakai sama sekali:
    - `core.RequestMetadata` beserta `coreMetadata()`: dibangun tiap request tapi tidak pernah dibaca.
    - `Connector.ID()`, `ProviderError.QuotaScope`.
    - `ErrCapability`, `ErrLoopDetected`, `PartAudio`, `ChunkPing`.
    - `attempt.Synthetic`.
  - Hanya dipakai test:
    - `ProviderError.Retryable()`, `Message.TextContent()`, `target.ChainName`.
  - Lokasi: `apps/server/internal/{core,gateway,connectors,transform}/`
  - Dampak: ~−90 baris

---

## Medium

- [x] **`delete` — Method service/query tanpa pemanggil**
  - account: `get`, `bulk`, `validateKey`, `quotaReset`, `reveal`
  - chain: `get`, `usage`
  - plan: `update`
  - provider: `rates`, `customList`, `accountsBulkDisable`, `accountsBulkEnable`, `accountsBulkDeleteDisabled`, `accountsBulkDeleteAll`
  - usage: `summary`, `models`, `insights`
  - guardrails: `evaluate`
  - auth: `refresh`, `signOut`
  - Lokasi: `apps/web-ui/src/lib/api/**`
  - Dampak: ~−170 baris

- [ ] **`delete` — File web lain tanpa referensi**
  - File: `components/layout/sidebar/nav-project.tsx`, tipe `ProjectItem` di `types/menu.ts`, dan `data/mock/chain.json`.
  - Lokasi: `apps/web-ui/src/`
  - Dampak: ~−180 baris

- [ ] **`delete` — `.openclaude/`**
  - `settings.json` dan `settings.local.json` menduplikasi `.claude/settings.json`.
  - `skills/graft` di dalamnya adalah salinan yang sudah menyimpang dari `.claude/skills/graft`.
  - Dampak: ~−180 baris

- [x] **`delete` — Sisa template di `lib/validation.ts`**
  - Helper: `requiredEmail`, `optionalEnum`, `requiredDate`, `optionalDateForm`, `optionalDateFilter`, `requiredFile`, `optionalFile`.
  - Schema: `CustomerInformation*Schema`, `zValidation`, beserta helper privatnya.
  - Dampak: ~−110 baris

- [ ] **`stdlib` — Parser durasi `ms()`**
  - Sekitar 100 baris tabel konversi, padahal hanya dipanggil sekali sebagai `ms('5m')`.
  - Perbaikan: `const timeout = 5 * 60_000`
  - Lokasi: `apps/web-ui/src/lib/date.ts`, `apps/web-ui/src/lib/api/client-fetch.ts`
  - Dampak: ~−95 baris

- [ ] **`shrink` — Empat filter bar hampir identik**
  - File: `keys/filter-keys`, `quota/filter-quota`, `traffic/pricing/filter`, `traffic/chains/filter`.
  - Perbaikan: satu `FilterBar({ search, selects, count })`.
  - Dampak: ~−80 baris

- [ ] **`shrink` — `StatCard` dan icon badge terduplikasi**
  - `StatCard` disalin persis di `dashboard/overview-stat-cards` dan `cost-analytics/usage/usage-overview-cards`.
  - Ada tiga varian icon badge: `common/icon-badge`, `system/system-icon-badge`, `quota/quota-icon-badge`.
  - Perbaikan: satu `StatCard`, dan satu `IconBadge` dengan prop `tone`.
  - Dampak: ~−80 baris

- [ ] **`shrink` — Pembungkus skeleton halaman diulang**
  - Muncul di `guardrails/route-skeleton`, `proxy-pool/route-skeleton`, `provider-detail/detail-skeleton`, dan ±8 route secara inline.
  - Perbaikan: satu `PageSkeleton`.
  - Dampak: ~−60 baris

- [ ] **`shrink` — Handler model katalog vs custom adalah salinan**
  - `CustomModels`/`CatalogModels` dan `CustomModelsUpdate`/`CatalogModelsUpdate` saling menyalin.
  - `AccountsBulkDisable` dan `AccountsBulkEnable` hanya berbeda satu bool.
  - Perbaikan: `parseModelStates` dan `setProviderAccountsDisabled(bool)`.
  - Lokasi: `apps/server/internal/handlers/providers.go`
  - Dampak: ~−50 baris

- [ ] **`shrink` — Kode guardrails yang berulang**
  - Skoring toxicity dan bias memakai loop yang sama. Perbaikan: satu `scoreKeywords(...)`.
  - Default config di `ParseConfig` ditulis dua kali.
  - Lokasi: `apps/server/internal/guardrails/engine.go`
  - Dampak: ~−38 baris

- [ ] **`native` — `system-progress.tsx` menulis ulang progress bar**
  - Perbaikan: pakai `ui/progress.tsx` yang sudah ada.
  - Dampak: ~−40 baris

- [ ] **`yagni` — Opsi data-grid yang tidak pernah diisi**
  - Opsi `tableLayout` yang tidak pernah diisi pemanggil: `dense`, `stripped`, `cellBorder`, `headerSticky`, `rowsDraggable`, dll.
  - Tipe API tanpa importer: `DataGridApiFetchParams`, `DataGridApiResponse`, `DataGridRequestParams`.
  - Lokasi: `apps/web-ui/src/components/ui/data-grid.tsx`, `apps/web-ui/src/components/ui/data-grid-table.tsx`
  - Dampak: ~−40 baris

- [ ] **`shrink` — `number-input.tsx`**
  - Ada contoh JSDoc sepanjang 45 baris, dan jalur `PatternFormat` yang tidak pernah dipakai.
  - Dampak: ~−45 baris

- [ ] **`shrink` — Logika retry untuk akun yang sama terduplikasi**
  - Blok retry dan backoff disalin di `gateway/unary.go` dan `gateway/stream.go`.
  - Perbaikan: satu helper `retryAttempt(...)`.
  - Dampak: ~−20 baris

---

## Low

- [ ] **`shrink` — Tiga fungsi deteksi error yang identik**
  - `isContextTooLarge`, `isModelNotFound`, dan `isToolCallMalformed` identik kecuali daftar kata kuncinya.
  - Perbaikan: satu `matchesNeedles(status, body, needles)`.
  - Lokasi: `apps/server/internal/connectors/errors.go`
  - Dampak: ~−18 baris

- [ ] **`stdlib` — Fungsi Go yang menulis ulang standard library**
  - `fnv32` → `hash/fnv` (`guardrails/engine.go`)
  - `parseInt` → `strconv.Atoi` (`gateway/resolve.go`)
  - `round1` → `math.Round` (`services/system.go`)
  - `contains`/`indexOf` di test → `strings.Contains` (`gateway/logic_test.go`)
  - Dampak: ~−42 baris

- [ ] **`yagni` — Dependency `go-sqlfmt`**
  - Hanya dipakai untuk pretty-print SQL saat mode debug.
  - Perbaikan: log statement mentah lewat slog.
  - Lokasi: `apps/server/internal/repositories/base_repository.go`
  - Dampak: −1 dependency

- [ ] **`delete` — Sisa kecil di server**
  - `ConfigApp.Name` beserta flag `--app-name` dan entri Makefile-nya: nilainya tidak pernah dibaca.
  - `Repositories.DB`: diisi tapi tidak pernah dibaca.
  - `models.Setting`, `dtos.LogLevelDebug`, `dtos.LogLevelError`: tidak pernah direferensikan.
  - `proxyPoolsHandler.Get`: tidak didaftarkan sebagai route.
  - Route `GoogleRedirect`: hanya membalas 501.
  - `modelcatalog.SettingsKey`: hanya meneruskan ke fungsi repository.
  - Parameter yang tidak dipakai di `filterAllowedTargets` dan `oaiStreamToolCallID`.
  - Dampak: ~−45 baris

- [ ] **`delete` — Helper lib web tanpa referensi**
  - Fungsi: `getInitialName`, `toAbsoluteUrl`, `formatCurrency`.
  - File konstanta: `constants/provider.ts`, `constants/assets.ts`.
  - Konstanta: `AUTH_ERROR_TYPE`, `AUTH_PROVIDER`.
  - Data sidebar: `SIDEBAR_MENU_ADMIN.user` dan `.teams`.
  - Tipe: `UnixTimestamp`.
  - Dampak: ~−100 baris

- [ ] **`stdlib`/`native` — Helper web yang menulis ulang yang sudah ada**
  - `formatTimeAgo` → `Intl.RelativeTimeFormat`
  - `quota-formatters.ts` → `fmtCompact` / `fmtMoney` yang sudah ada
  - Logika clipboard di `copyable-button.tsx` → hook `useCopyToClipboard` yang sudah ada
  - Dampak: ~−35 baris

- [ ] **`delete` — Scaffold main-web dan docs**
  - `apps/main-web/app/api/hello/route.ts`: route demo bawaan scaffold.
  - `apps/docs/components/mdx-components.tsx`: cukup pakai `defaultMdxComponents` langsung.
  - Dampak: ~−15 baris

- [ ] **`shrink` — Link landing main-web terduplikasi**
  - Array nav dan konstanta `GITHUB_URL`/`DOCS_URL` diulang di `site-header`, `site-footer`, dan `page.tsx`.
  - Perbaikan: satu `links.ts`.
  - Dampak: ~−20 baris

- [ ] **`delete` — Artefak coverage ter-commit di skill vendored**
  - File: `.agents/skills/ui-styling/scripts/.coverage` (52 kB) dan `scripts/tests/coverage-ui.json`.

---

## Di luar cakupan (perlu review biasa)

- **Guardrails tidak pernah diterapkan:** halaman Guardrails menyimpan kebijakan yang tidak pernah dijalankan pada request di gateway. Ini masalah produk/kebenaran, bukan sekadar kode mati.

## Dicek tapi bukan temuan

- `github.com/lib/pq`, `github.com/dustin/go-humanize`, dan `github.com/molecule-man/go-brrr` di `go.mod` memang tidak diimpor langsung, tetapi masih dibutuhkan dependency lain (`go mod why`), jadi tidak bisa dihapus.
- Sekitar 17k baris di `apps/main-web` kebanyakan adalah tipe Cloudflare hasil generate (`.cloudflare/types/index.d.ts`) yang sudah di-gitignore; tidak ada yang ter-commit untuk dipangkas. Saran: tambahkan `.cloudflare/` ke `ignorePatterns` oxlint/oxfmt.
- Tujuh skill desain di `.agents/skills/` di-symlink ke `.claude/skills/` dan `.zcode/skills/`, bukan disalin, jadi tidak ada duplikasi.

---

# Audit Keamanan & Kebenaran — 2026-11-12

Audit menyeluruh (bug, keamanan, ketahanan beban, test). Audit lean sebelumnya tidak diulang; beberapa item lean kecil yang baru ditemukan digabung di temuan terkait. Diasumsikan: gateway self-hosted satu proses, puluhan–ratusan stream inference konkuren; dashboard dipakai sedikit admin.

> **Status: semua 20 temuan sudah diperbaiki** (2026-11-12). Ringkasan perbaikan:
> #1 CAST→INTEGER + test rate pecahan; #2 bounds di `Budget`/`Plan.Validate` + `math.Round`; #3 `Bytes()` band fix + test 256–260 KiB; #4 userinfo di-strip dari audit `proxy_pool.create/update`; #5 `.env.example` `ADMIN_PASSWORD` dikosongkan + seeder menolak nilai dev saat `ENV!=development`; #6 `ConfigImport` wajib reauth + dialog UI + test; #7 interceptor 401 me-refresh (single-flight) lalu retry sekali; #8 migrate+reseal file upload sebelum `RestoreFrom`; #9 `io.LimitReader` 1 MiB di token+userinfo; #10 send terminal di-`select` `ctx.Done()`; #11 `label`/`priority`/`proxy_pool_id` jadi pointer; #12 delete pool men-NULL-kan `accounts.proxy_pool_id` dalam tx; #13 `Update` dipecah → `UpdateProfile`/`UpdateTokens` (+`Update` utuh untuk re-seal); #14 `startProbe` heartbeat bersama di kedua stream path, write gagal → `cancel()`; #15 `singleflight` per lookup di `authenticate`; #16 `serveDirect` hormati `Fallbackable()`; #17 retry insert 3× + counter `droppedUsage`; #18 `idx_accounts_key_hash` parsial + dedupe + 409; #19 test baru token/oauth-manager/rate-limit; #20 default CORS env-aware (`*` hanya dev) + compose kosong.

## Must fix

- [x] **1. `SumSince` gagal scan saat `token_consumption_rate` pecahan → 500 untuk semua request + bypass budget**
  - `internal/repositories/usage.go:91`. `SUM(...*COALESCE(token_consumption_rate,1))` menghasilkan REAL begitu ada rate non-integer; scan ke `int64` gagal → `checkBudgets`/`checkRateLimits` 500 setiap request (`gateway/access.go:159`, `ratelimit.go:115`); di `exhaustedAccounts` error di-skip → budget akun diam-diam tidak berlaku (`access.go:230`).
  - Perbaikan: `CAST(SUM(...) AS INTEGER)` seperti agregat lain di file yang sama.

- [x] **2. `budget_spend` tanpa batas → negatif/overflow → budget diam-diam tak terbatas**
  - `internal/handlers/budgets.go:31,72`. `int64(*d.BudgetSpend*1e6)`; `budget_spend:-5` atau `1e19` → `limit<=0` adalah encoding "tanpa limit". `alert_pct`/`limit_tokens` juga tak divalidasi.
  - Perbaikan: validasi di `Budget.Validate` (>=0, <=~9e12, pct 0–100) + `math.Round`/cek overflow.

- [x] **3. `safeBuffer.Bytes()` membuang head stream untuk total di (256 KiB, 260 KiB] → under-billing**
  - `internal/gateway/sse_usage.go:81`. Stream 257 KiB kehilangan ~1 KiB pertama (berisi `message_start`/`input_tokens` Anthropic) → `PromptTokens=0` → klien hanya ditagih output.
  - Perbaikan: `total<=captureTailSize` → tail saja; `<=head+tail` → head[:total-tail]+tail.

- [x] **4. Secret relay tersimpan di audit log**
  - `internal/handlers/proxy_pools.go:67,138`. `auditRecord(...,{"url":pool.URL})`; URL relay berbentuk `relay+https://:<secret>@host`. Pembaca `/v1/audit` atau unduhan DB mendapat kredensial hidup.
  - Perbaikan: hapus userinfo sebelum dicatat (log host saja).

- [x] **5. `.env.example` mengirim `ADMIN_PASSWORD=admin123` + `SEED_ON_BOOT=true` → kredensial default dipaksakan ulang tiap boot**
  - `.env.example:21,33`; `internal/seeders/user.go:139-160` (`syncPassword` menulis ulang hash bila beda + cabut semua sesi + hapus passkey). Password yang diganti via UI kembali ke `admin123` setelah restart.
  - Perbaikan: kosongkan/komentari `ADMIN_PASSWORD` di contoh; tolak nilai dev saat `ENV!=development` + panjang minimum.

- [x] **6. `ConfigImport` tanpa reauth padahal Export/Restore mewajibkannya**
  - `internal/handlers/backup.go:195-236`. Mengganti SELURuh tabel config (akun+semua kredensial sealed, api_keys, chains) hanya dengan sesi admin — sesi yang dicuri bisa menukar semua kredensial tanpa faktor kedua.
  - Perbaikan: panggil `reauthenticate(...)` seperti `ConfigExport`/`DatabaseRestore`.

- [x] **7. Flow refresh-token web-ui mati → logout paksa tiap jam, cookie refresh 30 hari tak terpakai**
  - `apps/web-ui/src/lib/api/services/auth.ts:32` (`refresh` tanpa callsite); interceptor `client-fetch.ts:58-64` langsung `clearAuthTokens` + redirect. Server `accessTTL=1h`, `refreshTTL=30d`.
  - Perbaikan: pada 401, satu refresh ter-queue lalu retry; atau berhenti menyimpan refresh token.

- [x] **8. Kegagalan pasca-restore meninggalkan DB live rusak**
  - `internal/handlers/backup.go:444-456`. `migrator.Up` + `ResealLegacy` berjalan SETELAH swap; bila gagal, DB lama-schema tetap live.
  - Perbaikan: migrate+reseal file upload SEBELUM `RestoreFrom`, atau auto-rollback dari `*.pre-restore-*.bak`.

- [x] **9. Body respons OAuth dibaca tanpa batas**
  - `internal/oauth/flow.go:251,348` (`io.ReadAll` di token exchange + `FetchUserInfo` — dipanggil per-refresh JIT saat request gateway). Provider jahat/buggy → memori tak terbatas; sibling paths sudah di-cap (64KiB–4MiB).
  - Perbaikan: `io.LimitReader` + tolak bila kelebihan.

- [x] **10. Send terminal `out <-` tanpa guard → kebocoran goroutine + koneksi upstream**
  - `internal/connectors/connector.go:230,234`. Klien disconnect saat buffer penuh + ctx `DeadlineExceeded` → send blok selamanya; `close(out)` dan `resp.Body.Close()` tak pernah jalan.
  - Perbaikan: bungkus `select { case out<-ch: case <-ctx.Done(): }` seperti send chunk lain.

- [x] **11. PATCH akun tak bisa set `priority=0` atau kosongkan `proxy_pool_id`/`label`/`metadata`**
  - `internal/handlers/accounts.go:265-283`; field DTO non-pointer (`dtos/accounts.go:15-16`) → `!=0`/`!=""` jadi tes "field ada".
  - Perbaikan: pointer fields seperti `Disabled *bool`.

- [x] **12. Hapus proxy pool → `accounts.proxy_pool_id` menggantung dan tak bisa dibersihkan**
  - `internal/repositories/proxy_pools.go:76-82`; kolom tanpa `REFERENCES`; (berpadu dengan #11) tak ada API untuk memperbaiki.
  - Perbaikan: tx `UPDATE accounts SET proxy_pool_id=NULL WHERE proxy_pool_id=$1` + delete, atau `ON DELETE SET NULL` via migrasi.

- [x] **13. UPDATE whole-row menghilangkan write konkuren; PATCH bisa menghidupkan token OAuth mati**
  - `internal/handlers/accounts.go:248-293` + `internal/repositories/accounts.go:141-160`; pola sama di `keys.go`, `chains.go`, `budgets.go`; `internal/oauth/manager.go:144` juga whole-row → refresh JIT menimpa PATCH admin yang masuk di antaranya.
  - Perbaikan: update kolom yang diubah saja (seperti `SetDisabled`/`SetNeedsReconnect`) atau optimistic concurrency via `updated_at`.

## Should fix

- [x] **14. Klien mati tak terdeteksi selama upstream diam → slot/reservasi tertahan s.d. 3 menit**
  - `internal/gateway/stream.go:303-341,358-365`. `streamCtx` lepas dari koneksi klien; satu-satunya deteksi = write gagal; heartbeat hanya menulis saat `chunksSent==0`. Gelombang stall → semua slot dipegang klien mati → 503 untuk yang hidup.
  - Perbaikan: probe-write heartbeat tiap tick (batalkan saat write gagal); ticker sama untuk `runDirect`.

- [x] **15. Thundering herd argon2: `authenticate` sebelum in-flight cap, tanpa single-flight**
  - `internal/gateway/auth.go:91-120`. Setelah restart/`KeysChanged()` bump, burst N request → N verifikasi argon2 (~64MiB,4-thread) serentak → lonjakan memori multi-GB.
  - Perbaikan: `singleflight` per `lookup`, atau semaphore terbatas di depan `Verify`.

- [x] **16. `serveDirect` mengabaikan `Fallbackable()` → error non-retryable membakar semua attempt**
  - `internal/gateway/web.go:205-207`. `ErrContextTooLarge`/`ErrAccountSuspended` tetap di-retry ke semua akun; klien melihat error TERAKHIR, bukan pertama.
  - Perbaikan: `if !last.Fallbackable() || ctx.Err()!=nil { break }`.

- [x] **17. Baris usage dibuang diam-diam saat insert gagal**
  - `internal/gateway/meter.go:152-157`. Context 5s berlomba dengan `busy_timeout(5000)`; gagal → hanya log; tak ada retry → budget/TPM kehilangan traffic yang barusan dilayani (mis. saat `VACUUM INTO` restore).
  - Perbaikan: retry terbatas di dalam window, atau counter dropped-rows.

- [x] **18. POST `/v1/accounts` double-submit → kredensial duplikat (TOCTOU, `key_hash` tanpa UNIQUE)**
  - `internal/handlers/accounts.go:205-213` + skema `migrations/000003`. Dua request paralel lolos `GetByKeyHash` keduanya → dua baris credential sama.
  - Perbaikan: `CREATE UNIQUE INDEX idx_accounts_key_hash ... WHERE key_hash<>''` + terjemahkan ke 409.

- [x] **19. Tes hilang untuk cabang berisiko**
  - `internal/lib/token/token.go` — tanpa test file: cek `SigningMethodHMAC`/issuer/exp belum diuji (regresi → bypass auth).
  - `internal/oauth/manager.go` — singleflight refresh tak teruji: dua refresh konkuren mengonsumsi single-use refresh-token dua kali → `invalid_grant` → `needs_reconnect` permanen.
  - `internal/middlewares/rate-limit.go` — hanya `clientIP` yang teruji; limiter inti (max, skipPaths, exempt) tidak.

- [x] **20. `CORS_ALLOWED_ORIGINS` default `*`**
  - `cmd/api/flag.go:89` + `deploy/docker-compose.yaml:20`. Auth Bearer (bukan cookie) jadi tak ada credential-replay, tapi semua endpoint publik terbaca lintas origin dari situs manapun.
  - Perbaikan: default kosong; `*` hanya di development.

## Nice (dicatat, tak dihitung)

Diperbaiki pada batch yang sama: "today" kini UTC (`usage.go`), `Listen` gagal → proses exit (`server.go`), `Retry-After` pada 429 middleware (`rate-limit.go`), truncasi rune-safe (`errors.go`), loop duplikat dihapus (`guardrails.go`), exempt-IP dikanonikalisasi `netip` (`rate-limit.go`), `strategy` chain divalidasi saat write (`dtos/chains.go`).

Masih terbuka (risiko kecil, tidak sebanding churn-nya untuk batch ini):

- `repositories/usage.go:607` `HealthRows` memuat semua row window ke memori per request.
- `legacy_import.go:72-90` 6 fase import tanpa transaksi luar (partial import saat gagal).
- `reserve.go:22` reservasi tak mencakup budget per-akun (tradeoff terdokumentasi, tapi bypass paralel nyata di beban tinggi).
- `handlers.go:94` `count_tokens` tanpa cap; `planDirect` abaikan account strategy; safety-copy backup pakai resolusi detik (dua restore cepat → nama bentrok).
- `lib/token` terima semua varian HMAC (HS384/HS512) tanpa cek `iss` (defense-in-depth); IPv6 /64 rotation bisa mengitari rate-limit per-IP; `sso_reauth` ticket diparkir di localStorage (XSS-reachable, tapi one-use + terikat sub).
- `ipblock.go:122` + `rate-limit.go:67` keyed per-IP penuh → rotasi IPv6 /64 menghindari brute-force guard & limiter.
- `backup.go:557` nama safety-copy resolusi 1 detik (dua restore sedetik → gagal); `chains.go` `strategy` tak divalidasi; `plans.go` index N+1; `proxy_pools.go:289` health-check serial abort-first-error.
- Web-ui kecil: `portal-link-button` tanpa pending-guard; tiket reauth SSO di `localStorage` (single-use, 5m, identity-bound — pertimbangkan `postMessage`); submit reauth password kosong untuk akun SSO → 422 menyesatkan.
- `resolve.go:227,251` error DB transient di-resolving ditelan jadi "not found" (alias → literal provider/model); komentar precedence `auto` kontradiksi dengan kode (`resolve.go:62-77` vs :99-104).

**Dicek tapi bukan temuan:** ordering middleware benar (IPBlock→BodyLimit→CORS→RateLimit); resolusi client-IP (Cf-Connecting-IP hanya dari loopback selama tunnel; XFF hanya lewat hop terkonfigurasi); sealer (DEK+nonce segar per secret, AAD purpose-bound); rotasi refresh-token atomik per-row; `ConsumeTOTPStep` atomic anti-replay; `parallel()` capture benar (Go 1.22+); `BackupRepository` Sprintf hanya nama tabel fixed-list; `importKeys` halaman 10k (`ponytail:`); portal token 192-bit random; tunnel `exec.Command` array (tanpa shell); semua `go func`/ticker lifecycle-managed + `Drain()`.
