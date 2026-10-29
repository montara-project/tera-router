# Changelog

All notable changes to this project are documented in this file. Versions follow the git tags (`v*`); Docker images are published to ghcr.io with the same version.


## [1.14.0](https://github.com/montara-project/tera-router/compare/v1.13.0...v1.14.0) (2026-10-29)

### Features

* **plans:** enforce plan rate limits and show per-key plan usage ([d58aa6c](https://github.com/montara-project/tera-router/commit/d58aa6c8f9c5aa7b09416ba8738aad76ae664ee2))
* **security:** add restricted access allowlist period ([b56a051](https://github.com/montara-project/tera-router/commit/b56a051fcfa4f1b59f5459ca55095445e21cd585))
* **web-ui:** polish dashboard overview and click-only activity details ([a305d22](https://github.com/montara-project/tera-router/commit/a305d22a130aa9921dda06a1b6742adcdac2afa6))
* **web-ui:** polish restricted access form in settings security tab ([705f09f](https://github.com/montara-project/tera-router/commit/705f09f954c72ada7ad4620e620d53f6d2558830))

### Bug Fixes

* **budgets:** count each budget's own scope and enforce account budgets ([b4a3b7f](https://github.com/montara-project/tera-router/commit/b4a3b7fc53f7e6fbb92619382d6e4fe91e4b74ce))
* **deps:** bump seroval override to 1.6.12 for audit advisories ([7da71ae](https://github.com/montara-project/tera-router/commit/7da71ae8bdcb4f8f7d550749d506f9554f71219c))
* **web-ui:** polish remaining dashboard pages on mobile ([b20151e](https://github.com/montara-project/tera-router/commit/b20151e279e0652464c91888f135da272a4ece79))

## [1.13.0](https://github.com/montara-project/tera-router/compare/v1.12.0...v1.13.0) (2026-10-28)

### Features

* **server:** stream model tests and add playground endpoints ([51cec37](https://github.com/montara-project/tera-router/commit/51cec375c96d3292df6992def3371a3df1ddbc3a))
* **web-ui:** add Playground page and stream the model test panel ([4c864bc](https://github.com/montara-project/tera-router/commit/4c864bc9f413fa3cd33eee5fec677b19d84e2e2a))

### Bug Fixes

* **deps:** bump better-auth to 1.7.14 for auth advisories ([4fc3723](https://github.com/montara-project/tera-router/commit/4fc3723522953fc778392ce969d068c7fc72a5c1))

## [1.12.0](https://github.com/montara-project/tera-router/compare/v1.11.0...v1.12.0) (2026-10-25)

### ⚠ BREAKING CHANGES

* the database download is now POST
  /v1/backup/database/download with a {password, otp} body (was GET), and
  POST /v1/backup/config/export requires password.

### Features

* require password and TOTP for backup download and config export ([42422c1](https://github.com/montara-project/tera-router/commit/42422c170d085eb768266e70f170f33fb02f788a))
* **server:** add branding logo/favicon and public branding endpoint ([b9e2baf](https://github.com/montara-project/tera-router/commit/b9e2baf7216fbb495c6104b8441c14e0b8c8e3cf))
* **server:** add proxy pool edit, batch import, bulk delete and relay mode ([46f0542](https://github.com/montara-project/tera-router/commit/46f0542335b59609cd954489f7c56e71a05f8b3c))
* **web-ui:** wire plan create and update dialogs on /plans ([97a32ad](https://github.com/montara-project/tera-router/commit/97a32adf20c7527ec3aba3ffe563e25fbc6a337a))
* **web-ui:** wire provider health drill-down and Manage Keys link ([1e127d6](https://github.com/montara-project/tera-router/commit/1e127d6b2a7eaa3680d41af2cb6920f2e909e272))
* **web-ui:** wire remaining dashboard features to the server ([598e566](https://github.com/montara-project/tera-router/commit/598e566132e1e7d7bf1af78ec6928642dfb342a5))

### Bug Fixes

* **deps:** resolve pnpm audit vulnerabilities ([1832545](https://github.com/montara-project/tera-router/commit/1832545530bb1d4df654a52c527d0ab1dc25cd1c))
* **server:** bump golang.org/x/net to v0.60.0 for HTTP/2 vulns ([3dce932](https://github.com/montara-project/tera-router/commit/3dce9324df96e4e36e07a8ef571044103a8065a9))
* **server:** render cleared plan limits as unlimited ([e55b77a](https://github.com/montara-project/tera-router/commit/e55b77aabea8bd5c98f05b2c5d252ea6dd42c600))
* update github workflows ([32d5cb0](https://github.com/montara-project/tera-router/commit/32d5cb0d84dad2ea4b5cb75438d7bf09600b2fec))
* update license ([46211b5](https://github.com/montara-project/tera-router/commit/46211b52c9e66cccf80dd182e54e28da123a519d))

## [1.11.0](https://github.com/montara-project/tera-router/compare/v1.10.0...v1.11.0) (2026-10-24)

### Features

* per-provider account strategy with smart round robin ([f880434](https://github.com/montara-project/tera-router/commit/f8804349c354a4afad49511ce719be3bf4c330f4))
* require password and TOTP to reveal API keys ([c8f3beb](https://github.com/montara-project/tera-router/commit/c8f3bebf24a8bc8e166a2f9f047df4649d6e2ecc))

### Bug Fixes

* **server:** exempt web-ui assets from the dashboard rate limit ([9fdfe6c](https://github.com/montara-project/tera-router/commit/9fdfe6caa21611f3f72ea098e181b74a2c15c91e))

## [1.10.0](https://github.com/montara-project/tera-router/compare/v1.9.0...v1.10.0) (2026-10-24)

### Bug Fixes

* **server:** remove account api key reveal endpoint ([6432fcf](https://github.com/montara-project/tera-router/commit/6432fcf67ab0433e2aefe76371b2c8e6a19c7dd0))

## [1.9.0](https://github.com/montara-project/tera-router/compare/v1.8.0...v1.9.0) (2026-10-23)

### Features

* group model aliases on the model alias page ([e93d3f4](https://github.com/montara-project/tera-router/commit/e93d3f4a16c96cf3f1bc0ff9966e7c2c53fc7263))
* limit chain and alias provider pickers to usable providers ([42a9c3c](https://github.com/montara-project/tera-router/commit/42a9c3c3c52f7320aec652426d55727e302c157e))
* **web-ui:** test all enabled models from the provider catalog ([3e53ffe](https://github.com/montara-project/tera-router/commit/3e53ffe6815805c31fd7a2c0661da508e6e94aaa))

### Bug Fixes

* **web-ui:** use scrollable dialog form for chain and model alias forms ([4dcb401](https://github.com/montara-project/tera-router/commit/4dcb401443029ded1f21eb82f0ff201a9ce2c08c))

## [1.8.0](https://github.com/montara-project/tera-router/compare/v1.7.0...v1.8.0) (2026-10-23)

### Features

* allow renaming a model alias ([5074aba](https://github.com/montara-project/tera-router/commit/5074abad04f72ffcf74e51422a728ce48957440a))
* **web-ui:** show model aliases as a list with detail and edit dialogs ([7dc3fe8](https://github.com/montara-project/tera-router/commit/7dc3fe8aa2ad1977f27f17a5de64bb6a820ff3c8))

### Bug Fixes

* **server:** regenerate API keys on legacy import ([9d81983](https://github.com/montara-project/tera-router/commit/9d819831066f3c3797e86ff0e14b06897b5e10e1))
* **server:** restore the sk_tr_ API key prefix ([4ccc227](https://github.com/montara-project/tera-router/commit/4ccc227610fee00d9bd6b38139e9a59408c9a168))
* update form model alias & chains ([3f190b9](https://github.com/montara-project/tera-router/commit/3f190b9893a526d409068c4d2fbd25707554c667))
* **web-ui:** stretch the login OTP input to the form width ([c498a8b](https://github.com/montara-project/tera-router/commit/c498a8bf6de30486d3748d87f3b8281c5e2e30a6))

## [1.7.0](https://github.com/montara-project/tera-router/compare/v1.6.0...v1.7.0) (2026-10-22)

### Bug Fixes

* update apikey prefix ([7ee6f82](https://github.com/montara-project/tera-router/commit/7ee6f825de4ebb8025f48ea4397fdee6c0dc0f89))

## [1.6.0](https://github.com/montara-project/tera-router/compare/v1.5.0...v1.6.0) (2026-10-21)

### Features

* **main-web:** animate routing diagram connectors with beams ([4d75f0e](https://github.com/montara-project/tera-router/commit/4d75f0e607144f5c0e4ff7f88efd42c1b23ad602))
* **main-web:** animate theme switch with a circle reveal ([d9bec9a](https://github.com/montara-project/tera-router/commit/d9bec9a7cc04f8397269fd8209f4a721be9488dd))
* **main-web:** mirror the admin dashboard in the landing mockup ([6db2fdd](https://github.com/montara-project/tera-router/commit/6db2fdd7795d763e094c261c24ef4e859639a88d))
* **main-web:** redesign landing page with blueprint layout ([d953822](https://github.com/montara-project/tera-router/commit/d953822f4843ade0ebd52f43d4926e0fa9a8e8fe))
* **main-web:** stream the request log live ([3655857](https://github.com/montara-project/tera-router/commit/365585732203b6c27c1e6522c8290a149e5f21b1))
* **main-web:** type out the get-started terminals ([9dbb554](https://github.com/montara-project/tera-router/commit/9dbb554d4bda6a0fa48671dcd1baa0554927e042))

### Bug Fixes

* **main-web:** escape the JSON-LD and add version and author ([7a2e9a1](https://github.com/montara-project/tera-router/commit/7a2e9a1dabc30f145867fb9ac1caee87c18945ae))
* **main-web:** hold the theme reveal lock until the transition ends ([98075b4](https://github.com/montara-project/tera-router/commit/98075b420db2b25ecd90dcffc8aaaba612db5b50))
* **main-web:** stop divider nodes from adding horizontal scroll ([fb7ef46](https://github.com/montara-project/tera-router/commit/fb7ef460852ff1cdce1727e7638fc3b04bf98723))

### Performance Improvements

* **main-web:** load fonts in parallel, share icon paths, cache at the edge ([a8b1258](https://github.com/montara-project/tera-router/commit/a8b12583a51329646bacfcf3932c09690c19c826))

## [1.5.0](https://github.com/montara-project/tera-router/compare/v1.4.0...v1.5.0) (2026-10-21)

### Performance Improvements

* **web-ui:** drop lodash, split CLI icons, lazy-load rare form fields ([4fe6811](https://github.com/montara-project/tera-router/commit/4fe6811b189d8713b434ab7e8da040fd2ed6fb3e))
* **web-ui:** isolate server clock tick from the sidebar layout ([652e521](https://github.com/montara-project/tera-router/commit/652e521e1a3a8821fa44755741deef25d3ed4732))
* **web-ui:** lazy-load model test sheet and skill markdown renderer ([9f829ac](https://github.com/montara-project/tera-router/commit/9f829acdbe9a60e3863aacf053305b06dc02ba74))

## [1.4.0](https://github.com/montara-project/tera-router/compare/v1.3.1...v1.4.0) (2026-10-19)

### Features

* **web-ui:** add InputOTP component and use it for 2FA codes ([e24d72b](https://github.com/montara-project/tera-router/commit/e24d72ba33b0c092f5b338563f396e31807a1e0b))

### Bug Fixes

* **web-ui:** polish login form states, autofill, and branding ([120f2c0](https://github.com/montara-project/tera-router/commit/120f2c0d5ddcbc3a15cd10dfeb631124a711ce14))

### Performance Improvements

* **web-ui:** lazy-load heavy form fields and preload font in HTML ([e82b220](https://github.com/montara-project/tera-router/commit/e82b220f648962ec4b69eeb8861ac175ef1f28b2))

## [1.3.1](https://github.com/montara-project/tera-router/compare/v1.3.0...v1.3.1) (2026-10-19)

### Features

* **docs:** add per-page metadata, hreflang, sitemap, and robots for SEO ([31aca19](https://github.com/montara-project/tera-router/commit/31aca190ae33b8e3469d193ef4f25fcc17bb0ea8))
* **main-web:** add SEO metadata, JSON-LD, sitemap, and robots ([a526a36](https://github.com/montara-project/tera-router/commit/a526a36c6b9750eafd37ffa2d0ba1772bb6cb990))

## [1.3.0](https://github.com/montara-project/tera-router/compare/v1.2.0...v1.3.0) (2026-10-19)

### Features

* **server:** sync Deepgram stt/tts models from upstream ([ee81daf](https://github.com/montara-project/tera-router/commit/ee81daf6236ee3cbcdbea5c0c86c0baa2cacb3f7))
* **server:** sync ElevenLabs tts and scribe models from upstream ([4c5086c](https://github.com/montara-project/tera-router/commit/4c5086c1d19c79124eccddbe07c4cc096981f836))
* **server:** sync models for Gemini, Mistral, Together, Fireworks, Nebius, and Groq ([c5eb0af](https://github.com/montara-project/tera-router/commit/c5eb0af7fe409e4edeceb6eaf2caa3621eca1bd7))
* **web-ui:** add 404 not found page with back-to-home link ([caa7fdd](https://github.com/montara-project/tera-router/commit/caa7fdd379f2e5bc96fbae1b4a10b915d8d4c12d))

## [1.2.0](https://github.com/montara-project/tera-router/compare/v1.1.0...v1.2.0) (2026-10-18)

### Features

* **server:** bulk delete custom providers without accounts ([ee0d2fc](https://github.com/montara-project/tera-router/commit/ee0d2fc85a2dbf2eca5971fb18d8ecf76563627b))
* **web-ui:** delete providers without API keys from the Providers page ([6a6896a](https://github.com/montara-project/tera-router/commit/6a6896aebdd598c0a2674846fd0e78ea6fb2a3fc))

## [1.1.0](https://github.com/montara-project/tera-router/compare/v1.0.0...v1.1.0) (2026-10-18)

### Features

* add optional TOTP two-factor authentication ([976058c](https://github.com/montara-project/tera-router/commit/976058c4a38ec603302cbb6d42e079929b09ee47))
* block client IPs manually and after repeated failed sign-ins ([26da689](https://github.com/montara-project/tera-router/commit/26da68970cd17881cd4d0119afccb9d0f7a5b547))
* **server:** rename the admin from ADMIN_EMAIL on seed ([49a37ca](https://github.com/montara-project/tera-router/commit/49a37ca6ccb64e6b797cdd2bad6ecad8c9d0f26b))
* **server:** sync the admin password from ADMIN_PASSWORD on seed ([3a405ec](https://github.com/montara-project/tera-router/commit/3a405ecdbcac6cac00f4fab2bc5b6f4b36119432))

### Bug Fixes

* **gateway:** stop honoring API keys revoked after they were cached ([01aef92](https://github.com/montara-project/tera-router/commit/01aef92071676b4ca62191db17ab39f846775f3f))
* **gateway:** wait for the last-used stamp before shutdown ([1bb7d46](https://github.com/montara-project/tera-router/commit/1bb7d461469ac41ac7c941f844f62cf51dfe88e0))
* **server:** cap concurrent argon2 runs and hide registered emails ([38498d5](https://github.com/montara-project/tera-router/commit/38498d5319d3aa3ebeda7417c47f87470971d938))
* **server:** end admin sessions when the env changes how it signs in ([496c9ca](https://github.com/montara-project/tera-router/commit/496c9cafa32980a0dd580986c066f95dc7cf005e))
* **server:** read APP_SECRET from the environment and warn when short ([36a0031](https://github.com/montara-project/tera-router/commit/36a00315e208fa8fa6f5b0462ee4bedb4d4cc4d4))
* **server:** refuse access tokens issued before a session revocation ([3187b34](https://github.com/montara-project/tera-router/commit/3187b3476a26be9ab72f072e0b90f598c54851ef))
* **server:** send HSTS on HTTPS responses ([6233b16](https://github.com/montara-project/tera-router/commit/6233b16ee088341583926509c78df9b8b3bba578))
* **web-ui:** wire up the sidebar Log out action ([d69b3ff](https://github.com/montara-project/tera-router/commit/d69b3ff2aff003fcde5f5d4e002677188159faa2))

## [1.0.0](https://github.com/montara-project/tera-router/compare/v0.6.0...v1.0.0) (2026-10-16)

### Features

* **catalog:** add media providers and derive the Media page from it ([446faa5](https://github.com/montara-project/tera-router/commit/446faa573a20d9fca32be146b1879428ea832fcd))
* **chains:** toggle chain steps active per step ([ac066a4](https://github.com/montara-project/tera-router/commit/ac066a499c631e047b4fee14a262a8c29e830368))
* **gateway:** add image generation and embeddings endpoints ([2d5e55a](https://github.com/montara-project/tera-router/commit/2d5e55aeea1547f126507aeca939f95c28be3b59))
* **gateway:** add text-to-speech and speech-to-text endpoints ([569afbd](https://github.com/montara-project/tera-router/commit/569afbd52c8e0f39c8c48d206caf070c6a579419))
* **gateway:** add web search and web fetch endpoints ([ccea64c](https://github.com/montara-project/tera-router/commit/ccea64cbd7879a1b1d30253b077a621d7bf4d239))
* **tunnels:** expose the router on a tailnet with Tailscale serve ([81b6a41](https://github.com/montara-project/tera-router/commit/81b6a413752c472f3e062e7094873f4cc7e76264))
* **web-ui:** add brand icons for web search providers ([eb4f4e9](https://github.com/montara-project/tera-router/commit/eb4f4e93b9a686657a3f321471f932f7c0371843))
* **web-ui:** add ElevenLabs and Deepgram provider icons ([fddaae9](https://github.com/montara-project/tera-router/commit/fddaae939a5166e482310566623cb32140a07396))
* **web-ui:** group providers page into category tabs ([720b373](https://github.com/montara-project/tera-router/commit/720b373b859bdf33d39dc95782cadf79a7a5e939))
* **web-ui:** paginate the Provider Health tables ([a9646c0](https://github.com/montara-project/tera-router/commit/a9646c0d11b6a118ed3ffc12d105ef78b1766061))
* **web-ui:** replace CLI tool letter tiles with brand icons ([e87fe48](https://github.com/montara-project/tera-router/commit/e87fe480722824bb02df59d8d70e37fa07701e28))
* **web-ui:** view skill guides in a rendered markdown dialog ([18c5218](https://github.com/montara-project/tera-router/commit/18c5218fe97915fd2e4378dcae4c302ddc11703e))

### Bug Fixes

* **catalog:** drop search capability from OpenAI ([322177f](https://github.com/montara-project/tera-router/commit/322177f2320abfe695566b83136bf9205b28475a))
* **deploy:** disable Headroom Kompress in the compose sidecar ([a6fa64e](https://github.com/montara-project/tera-router/commit/a6fa64e83dffd7bbf363985ac79b213e7b772dc1))
* **web-ui:** make chain step comboboxes scrollable and enable model on pick ([85f72e7](https://github.com/montara-project/tera-router/commit/85f72e7d29c0347bba3b710105454519f39fe656))
* **web-ui:** open Provider Health on the Providers tab ([8d42474](https://github.com/montara-project/tera-router/commit/8d42474a66518268485ebf53aa07b9b2136f1e9e))
* **web-ui:** open the API key form for search and voice providers ([1ff1424](https://github.com/montara-project/tera-router/commit/1ff1424cc7df71077e0b028bc828ab2043bc4ca9))
* **web-ui:** show provider icons for every Media provider ([d97c997](https://github.com/montara-project/tera-router/commit/d97c99730570961dcd50f8a6875d40610137f768))
* **web-ui:** treat a missing chain step active flag as active ([ac864d9](https://github.com/montara-project/tera-router/commit/ac864d9028ae410d1ba94065ef528b1312d511ad))

## [0.6.0](https://github.com/montara-project/tera-router/compare/v0.5.7...v0.6.0) (2026-10-15)

### Features

* **deploy:** add an optional Headroom sidecar to docker compose ([dc96e9b](https://github.com/montara-project/tera-router/commit/dc96e9bef2dca3532ab2492f509077c7b3562fd4))
* **server:** apply token saving settings in the gateway ([0dd1705](https://github.com/montara-project/tera-router/commit/0dd17050e85859b4cd1909f98f7f3c843b3aa8b2))
* **web-ui:** configure the Headroom proxy URL and timeout ([bce9062](https://github.com/montara-project/tera-router/commit/bce90624963afb1c3979a7dc126c049a00ef3488))

## [0.5.7](https://github.com/montara-project/tera-router/compare/v0.5.6...v0.5.7) (2026-10-13)

### Features

* **providers:** add Meta Muse as an API key provider ([ef28d7f](https://github.com/montara-project/tera-router/commit/ef28d7ffa86fcf8b13b89317b09bc831d1e4b07d))
* **web-ui:** use the Meta brand mark for the Muse provider avatar ([4030e12](https://github.com/montara-project/tera-router/commit/4030e12f87044ccc512bb1d030e994cffdecf3b2))

## [0.5.6](https://github.com/montara-project/tera-router/compare/v0.5.5...v0.5.6) (2026-10-10)

### Features

* **web-ui:** show connection status and detail links on media providers ([0d1ccba](https://github.com/montara-project/tera-router/commit/0d1ccba3ebd5df8f77ae31f93d62e16364ffda61))

### Bug Fixes

* **server:** identify as the current cline release upstream ([08e9292](https://github.com/montara-project/tera-router/commit/08e9292a527c9c22dc350ffc04f1cf958f10093b))
* **server:** send cline identification headers on dashboard model tests ([851c26a](https://github.com/montara-project/tera-router/commit/851c26a3e0b1aa8c550b04496a16338a05853cf3))
* **server:** serve unary cline calls from the upstream stream ([0c4f8d1](https://github.com/montara-project/tera-router/commit/0c4f8d10f71fac2f3d31f736e5f50ad9f0c6b42f))
* **web-ui:** format billions and trillions in fmtCompact ([7b3c7c9](https://github.com/montara-project/tera-router/commit/7b3c7c9aa9e030ca2fac5eb55a8af720b654b189))

## [0.5.5](https://github.com/montara-project/tera-router/compare/v0.5.4...v0.5.5) (2026-10-10)

### Features

* **endpoints:** poll cloudflare tunnel status while it is running ([346dd1b](https://github.com/montara-project/tera-router/commit/346dd1bf1dafa3529271dbf5f704022b7d807e38))
* **endpoints:** wire cloudflare quick tunnel to cloudflared on the server ([9bc667a](https://github.com/montara-project/tera-router/commit/9bc667a2cf0a77746f8138aeecaa11031763cb1d))
* **server:** restore cloudflare tunnel on boot and rate limit its visitors ([8798ba8](https://github.com/montara-project/tera-router/commit/8798ba846f4b9abac264d8a3700e5aac272a705d))
* **server:** serve skill documents and inject skills into gateway requests ([d1344e6](https://github.com/montara-project/tera-router/commit/d1344e6956295834a721fd968d765b8fc69caf06))
* **skills:** wire skill toggles, per-key selection, and SKILL.md upload ([163690c](https://github.com/montara-project/tera-router/commit/163690cc593e1949f80ba8e881f8a9583753fd1f))

### Bug Fixes

* update readme ([bafb3ae](https://github.com/montara-project/tera-router/commit/bafb3aea7c424c9ba899560b12b4e0e85da1d055))

## [0.5.4](https://github.com/montara-project/tera-router/compare/v0.5.3...v0.5.4) (2026-10-07)

### Bug Fixes

* **server:** stop V1Join from double-versioning gateway base urls ([95d12d2](https://github.com/montara-project/tera-router/commit/95d12d28c8138a3049eb8b3dee0f635f20ebd3cd))
* **server:** surface HTML upstream pages in model sync and credential probe ([e357cb4](https://github.com/montara-project/tera-router/commit/e357cb4cac7ec78d07c62b7c8a215342a5adf5b5))

## [0.5.3](https://github.com/montara-project/tera-router/compare/v0.5.2...v0.5.3) (2026-10-05)

### Features

* **usage:** paginate provider health and provider accounting sections ([75d5db7](https://github.com/montara-project/tera-router/commit/75d5db7e149070df4606af8d815e4d84507d0525))

## [0.5.2](https://github.com/montara-project/tera-router/compare/v0.5.1...v0.5.2) (2026-10-05)

### Features

* **backup:** add config backup, sqlite snapshot/restore and 9router/omniroute import endpoints ([6ed571b](https://github.com/montara-project/tera-router/commit/6ed571b5a705e352e000977c1edabf5476a2f998))
* **cli-tools:** add Claude Code configuration page ([46e20d1](https://github.com/montara-project/tera-router/commit/46e20d1ef87cd6ab1ba534108b7d6278f0cd8e37))
* **dashboard:** add github-style usage activity calendar ([219d330](https://github.com/montara-project/tera-router/commit/219d3302baf62c2fe4de2d4c82b7850b1e936e11))
* **settings:** wire the import/export tab to the backup endpoints ([8a0b234](https://github.com/montara-project/tera-router/commit/8a0b234497e2da2015e814c1bdf235959f4381cf))
* **usage:** add per-day request activity endpoint with model breakdown ([944b01e](https://github.com/montara-project/tera-router/commit/944b01e95aec415619812dd0cad63ca48e284ca5))
* **usage:** render the providers health table on the usage page ([17340d8](https://github.com/montara-project/tera-router/commit/17340d8a93ec815243c47462b81cf14914d88e9f))
* **usage:** wire the terminal request details dialog ([6342ab8](https://github.com/montara-project/tera-router/commit/6342ab8220cb63aea543b5eaa7736019190dda38))

### Bug Fixes

* implementation guardrails ([cadda79](https://github.com/montara-project/tera-router/commit/cadda797d717f1919c8c9837fe5529cd8afef3b3))
* **quota:** page the account table client-side and refresh every minute ([06f512c](https://github.com/montara-project/tera-router/commit/06f512c794533238c8f3e836fed84d7b026214b0))
* **settings:** correct the sqlite path in the import-export card ([43de677](https://github.com/montara-project/tera-router/commit/43de677de8e95081f476337b95ef8a54a13f8c2c))

## [0.5.1](https://github.com/montara-project/tera-router/compare/v0.5.0...v0.5.1) (2026-10-04)

### Features

* **pricing:** paginate pricing overrides server-side ([19adaa9](https://github.com/montara-project/tera-router/commit/19adaa925a8926539fa8052081775a2c95bea9d9))

### Bug Fixes

* update column ([f5971c4](https://github.com/montara-project/tera-router/commit/f5971c4ea0129008adf7423076e734ebb3cc6600))

## [0.5.0](https://github.com/montara-project/tera-router/compare/v0.4.3...v0.5.0) (2026-10-04)

### Features

* **oauth:** rescue remote Codex sign-in with pasted callback URL ([df48941](https://github.com/montara-project/tera-router/commit/df4894178b1108a8dfb719262390110d74db2d91))
* **quota:** show Claude subscription session and weekly limits ([1aff1b4](https://github.com/montara-project/tera-router/commit/1aff1b46b9e81f3fac24939937f2ea699480e2dc))

### Bug Fixes

* **oauth:** echo state and use console token endpoint for Anthropic exchange ([ea0a89a](https://github.com/montara-project/tera-router/commit/ea0a89aa30a1a5292c6080d1664171b905ef1fe4))
* **oauth:** pin Claude sign-in to Anthropic's console display-code callback ([962c661](https://github.com/montara-project/tera-router/commit/962c661a6a15d027d5c50f12e09c8f38a0281ab1)), references [code#state](https://github.com/code/issues/state)
* update model prices list ([8bbf132](https://github.com/montara-project/tera-router/commit/8bbf1323b89014ab9b7631acbf44eb659389c3f8))
* update oauth anthropic & codex and also custom providers ([2df3fea](https://github.com/montara-project/tera-router/commit/2df3fea1442894810541b4fda15b6d4ecb413fad))
* update system prompt claude code ([df0ce32](https://github.com/montara-project/tera-router/commit/df0ce323df9d3d36d78cd7cd6a0a1382ed4a49f8))

## [0.4.3](https://github.com/montara-project/tera-router/compare/v0.4.2...v0.4.3) (2026-10-03)

### Features

* advertise chains and auto-combos on gateway /v1/models ([3c61ae6](https://github.com/montara-project/tera-router/commit/3c61ae67ba7380d0eb9b3d60dc5e21a31e549a2a))
* **alias:** list only active models in the model combobox ([61b31c1](https://github.com/montara-project/tera-router/commit/61b31c1e0e084efeafc7d10f4035f070251169a9))
* **alias:** pick provider and model via combobox in fallback order ([5c0740b](https://github.com/montara-project/tera-router/commit/5c0740b80f5d52d92e51c2708e8f8979d72635a7))
* **endpoints:** add how-to-use-this-router steps card ([363d42e](https://github.com/montara-project/tera-router/commit/363d42ebcb1b439f4b2a9b4ca19f662182b22945))
* official-website sign-in option for OpenAI and Anthropic connects ([2dfb832](https://github.com/montara-project/tera-router/commit/2dfb832dc990c99092adf22d34773cb6ffac7730))
* **pricing:** pick provider and model via combobox in override dialog ([2440ce7](https://github.com/montara-project/tera-router/commit/2440ce7822eb2bd9a0452c0c27e438e8b9ab398c))
* provider health derived from gateway attempt outcomes ([922b781](https://github.com/montara-project/tera-router/commit/922b781da979d91e410363f4d5b4853f98791e61))
* **providers:** enable or disable provider API keys from account routing ([831d68c](https://github.com/montara-project/tera-router/commit/831d68c24f0a8435ec53682f2ddf97e54834c6c3))
* seed custom_providers rows on catalog provider connect ([9c892f6](https://github.com/montara-project/tera-router/commit/9c892f64384f476bcd521968da20a78959935384))
* **settings:** report app version via /health and check latest release on GitHub ([d78665f](https://github.com/montara-project/tera-router/commit/d78665fd6910f5ef5e656fa9edf1fe1581bfa125))
* **usage:** paginate provider distribution and align trend card height ([b94d622](https://github.com/montara-project/tera-router/commit/b94d622398eba22106481d7a19df0cf07b80a8ff))
* **web-ui:** pick chain steps and terminal fallback via provider/model comboboxes ([a02be59](https://github.com/montara-project/tera-router/commit/a02be5932029ea238891f309c1a72a5119df1ca8))
* **web:** add analytics script to docs and main-web layouts ([a5c7eab](https://github.com/montara-project/tera-router/commit/a5c7eabe89d470feb664ed019812dbcfa1d8ea9b))
* wire settings color theme palette switching ([146d2fb](https://github.com/montara-project/tera-router/commit/146d2fbf52e9ace978ee9fed9b9d71e57f73091a))

### Bug Fixes

* annotate scope param type in pricing override dialog ([84b1aa6](https://github.com/montara-project/tera-router/commit/84b1aa6bcc3dc56314fbea89000c73dd5f3cb6f6))
* copy api key through the reveal endpoint in keys table ([30da570](https://github.com/montara-project/tera-router/commit/30da57011fd29c21eecf20bfad42e1dc4f9df8e1))
* **docs:** update started with docker compose ([bebbc5c](https://github.com/montara-project/tera-router/commit/bebbc5c5547156ce4e50913268243abcb8028212))
* keep auto-combo ids out of the gateway /v1/models listing ([ee98ace](https://github.com/montara-project/tera-router/commit/ee98ace81ecae0000e45e66541c7b6c32573a629))
* server-side state filter for model catalog pickers ([53dbde0](https://github.com/montara-project/tera-router/commit/53dbde03f3fd2a88d9e88dd570c660f8b505655e))
* smooth model test sheet slide animation ([d3ae7a8](https://github.com/montara-project/tera-router/commit/d3ae7a841b1c36cbd0b57cafeff8ed6a6bfdc0ae))
* update animation with motion/react ([994cef7](https://github.com/montara-project/tera-router/commit/994cef7672f60240f9688c8760b139c6cf571337))
* update connect chatgpt & anthropic api ([2722bc3](https://github.com/montara-project/tera-router/commit/2722bc32349bc793107cacb3d94d7bb7f29a8d40))
* update empty state model catalog ([25268ed](https://github.com/montara-project/tera-router/commit/25268edf22ab730bef13fb119523094741fad88e))
* update main web UI ([1074700](https://github.com/montara-project/tera-router/commit/1074700c6500ba8247123371f6b6a29e8d18a1e5))
* update nav user ([14adf49](https://github.com/montara-project/tera-router/commit/14adf499e7ca0034d0b26c5786d53ffbf09511e3))
* update padding ([f05cdef](https://github.com/montara-project/tera-router/commit/f05cdefcd5c043ee4c5887f79646d7a850626123))
* update provider model test ([bf7b652](https://github.com/montara-project/tera-router/commit/bf7b6525f474b6399002acbff11df6f58edc91c2))
* update release yml ([2f7d5e0](https://github.com/montara-project/tera-router/commit/2f7d5e05d1977d6337ad74d4f0801d56294f6535))
* update switch color ([c151b08](https://github.com/montara-project/tera-router/commit/c151b080d452c74f2af2d049ee531f2fdde7a193))
* update usage card ([bce8408](https://github.com/montara-project/tera-router/commit/bce8408f68b14ff3f1f2d8da0c426e2bcce5817b))
* **web-ui:** keep skeleton background neutral outside theme palettes ([001f6b0](https://github.com/montara-project/tera-router/commit/001f6b08f125c382eab87b343bef2a5aab98e7c4))
* **web-ui:** key catalog model tests by slug not prefixed id ([51f2a4e](https://github.com/montara-project/tera-router/commit/51f2a4e7f9fb491d32cfc5f64fe38e619ded6495))
* **web-ui:** read pricing override scope from form store ([4673ad3](https://github.com/montara-project/tera-router/commit/4673ad39458efef88ea211821dac19aee8665bcb))

## [0.4.2](https://github.com/montara-project/tera-router/compare/v0.4.1...v0.4.2) (2026-10-02)

## [0.4.1](https://github.com/montara-project/tera-router/compare/v0.4.0...v0.4.1) (2026-10-02)

## [0.4.0](https://github.com/montara-project/tera-router/compare/v0.3.0...v0.4.0) (2026-10-01)

### Features

* model pricing overrides page + reasoning rates in catalog ([#20](https://github.com/montara-project/tera-router/issues/20)) ([aed0d6f](https://github.com/montara-project/tera-router/commit/aed0d6f8a05df32755c1a32a8ba77e93eca375ee))

## [0.3.0](https://github.com/montara-project/tera-router/compare/v0.2.0...v0.3.0) (2026-10-01)

### Features

* **server:** advertise only model aliases on /v1/models ([348ac16](https://github.com/montara-project/tera-router/commit/348ac161f73a56b8abe99ab669482edc4edf1b0f))
* **server:** catalog provider model catalog endpoints ([4bff28f](https://github.com/montara-project/tera-router/commit/4bff28fb8c31ff747f00be9bafd875f5e34a2c1b))
* **web-ui:** provider detail and key management for catalog providers ([c9344c6](https://github.com/montara-project/tera-router/commit/c9344c622e57d9bf57d449cabfc5fa58ff38cff6))

### Bug Fixes

* open model list ([9316ba5](https://github.com/montara-project/tera-router/commit/9316ba50b28b5be91b1719439276a8c7907c0d82))

### Reverts

* models list with auth ([2c896d3](https://github.com/montara-project/tera-router/commit/2c896d3084bdbfe6f1b1ab8be848ce00b9976f08))

## [0.2.0](https://github.com/montara-project/tera-router/compare/v0.1.2...v0.2.0) (2026-10-01)

### Features

* add autocombo dan model upstream ([9585869](https://github.com/montara-project/tera-router/commit/95858694e1c7d78214c30009fd29c92681ad8869))
* **server:** add compiled-in model pricing fallback ([32a49b8](https://github.com/montara-project/tera-router/commit/32a49b85f056015017c85e0e59b2b9e5e442613c))
* **server:** add OAuth connect flows for claude and codex ([cbb1fa5](https://github.com/montara-project/tera-router/commit/cbb1fa5996446816e5a56157bf4280064d6fe384))
* **server:** integrate OpenRouter, Ollama, and Cline accounts ([bf9a2d1](https://github.com/montara-project/tera-router/commit/bf9a2d1224e19e5ccb3111a9b3536a3dccfe14dc))
* **web-ui:** prefill custom provider form from Connect ([0659d82](https://github.com/montara-project/tera-router/commit/0659d82d8803084c570deb319dc359dc72c71c78))
* **web-ui:** show the signed-in user in the sidebar nav ([bcbeb3f](https://github.com/montara-project/tera-router/commit/bcbeb3f9b5df4621b91f051763231c523f704709))
* **web-ui:** use real brand marks for provider avatars ([18c7c77](https://github.com/montara-project/tera-router/commit/18c7c77f476de5c43db925362395b8fa66db49d8))
* **web-ui:** wire chains page to the chains API ([5c456ec](https://github.com/montara-project/tera-router/commit/5c456ec22c8055139e6c5ca9d510b2b3e902eb2c))
* **web-ui:** wire provider connect flows to the dashboard ([458e29e](https://github.com/montara-project/tera-router/commit/458e29e2d09e87de2695cb81b14031f6d79845f0))

### Bug Fixes

* minor form.Subscribe button ([bd434b6](https://github.com/montara-project/tera-router/commit/bd434b6246d1b0dab046b3ebb788acc025e4eeb8))
* **server:** derive provider spend totals from per-model costs ([3ea505d](https://github.com/montara-project/tera-router/commit/3ea505d0c874a08a2b24d010f76d726820377507))
* **server:** drop unsupported media providers from the console catalog ([a1b0d75](https://github.com/montara-project/tera-router/commit/a1b0d757b9bf7391a2f59b0eec52ff07b9f8ec3d))
* **server:** gate auto-combo candidates by the provider model catalog ([4dd2c63](https://github.com/montara-project/tera-router/commit/4dd2c63a9dd07400c6919f5ec271083dbcb68d94))
* **server:** harden OAuth reconnect, popup HTML, and callback timeouts ([44bc30e](https://github.com/montara-project/tera-router/commit/44bc30e02c3e6211ebe08fdbff67e81ad7d93c95))
* **server:** map duplicate chain names to a 409 conflict ([4c2e20b](https://github.com/montara-project/tera-router/commit/4c2e20b52a1f5aee54c4425f7dd3ec9cf3019a85))
* **server:** narrow OAuth refresh permanence to token-invalid codes ([cf1ef52](https://github.com/montara-project/tera-router/commit/cf1ef52e260b6190cf4b9b60e4366853c792de01))
* **server:** normalize custom provider api_kind before the sync dialect check ([4641197](https://github.com/montara-project/tera-router/commit/46411978aa99b24027e235ec041543880fa8f0c7))
* **server:** serialize model catalog read-modify-write per provider ([9cc32a4](https://github.com/montara-project/tera-router/commit/9cc32a45abc33c03424c280731e80a788e16c5e7))
* **server:** treat upstream pricing without usable rates as unpriced ([c24dbdd](https://github.com/montara-project/tera-router/commit/c24dbdd59d24d62fdb3dc11fdc2f0e5069ecc690))
* update allowed ip for rate limit ([c7ddc99](https://github.com/montara-project/tera-router/commit/c7ddc99c84335a4db04d983bc2fc3f8d5fa2d14d))
* update catalog ([0c303f2](https://github.com/montara-project/tera-router/commit/0c303f2a41970681017d02ee7b5858f11cc245c4))
* update minor ([ac8d7fa](https://github.com/montara-project/tera-router/commit/ac8d7fa1bd9577004fc1d92c6cfeeaecfb50878d))
* update model alias ([38cb121](https://github.com/montara-project/tera-router/commit/38cb121ef0d13e8df7572810067a44ac6849330d))
* update model price upstream ([6d2ee20](https://github.com/montara-project/tera-router/commit/6d2ee203f1325c385d6248e933966b0be098b13b))
* update model pricing ([b2035c1](https://github.com/montara-project/tera-router/commit/b2035c1f23307f2e9496f006f34c5fa35259af19))
* update provider ([3340002](https://github.com/montara-project/tera-router/commit/33400022814c931ff0c5f55a84436c0f96ac2979))
* update provider catalog ([5537ce6](https://github.com/montara-project/tera-router/commit/5537ce640ce0f3821e896bbc1d2f301d381dd650))
* update provider catalog price ([5b489c0](https://github.com/montara-project/tera-router/commit/5b489c089134a028e014fa5b23a03c1dbda4aad1))
* update provider custom ([c0f388a](https://github.com/montara-project/tera-router/commit/c0f388a5739970a0a4b34ba759dfc1ce19130b63))
* update provider detail ([67246c4](https://github.com/montara-project/tera-router/commit/67246c460192cd127ed8bea6d0d62d15f8434ac0))
* update search debounce ([4aa4120](https://github.com/montara-project/tera-router/commit/4aa4120aa7499b9ae356a2130335a6db1d9a2ade))
* update spa broken & sync models ([d6c9c07](https://github.com/montara-project/tera-router/commit/d6c9c0751dd2bc67653b518368fe549f81ec1de1))
* update trusted proxies ([ce5e730](https://github.com/montara-project/tera-router/commit/ce5e730e9411dad8f4304f03cb2b7c2068e645bb))
* **web-ui:** make alias names read-only on edit and add draft cancel ([a3866fe](https://github.com/montara-project/tera-router/commit/a3866fe614d5a8a200260d44de85daffc0f053df))
* **web-ui:** re-type form.Subscribe render-prop params ([2ce4854](https://github.com/montara-project/tera-router/commit/2ce4854b12b5f5eabbeb5c57e4038d985047276c))
* **web-ui:** restore explicit types on form.Subscribe render props ([91bde7a](https://github.com/montara-project/tera-router/commit/91bde7ae4ee7cd992beea85431ad004090b21309))
* **web-ui:** retry profile errors and reset chains pagination on filter ([a309047](https://github.com/montara-project/tera-router/commit/a309047f29730461dc4abf420c0f3da318229710))
* **web-ui:** type form.Subscribe render-prop params ([9035963](https://github.com/montara-project/tera-router/commit/9035963c66080e240ae6d3586243c3241ceb1e26))

## [0.1.2](https://github.com/montara-project/tera-router/compare/v0.1.1...v0.1.2) (2026-09-30)

### Bug Fixes

* only rilis linux amd64 ([401ad4c](https://github.com/montara-project/tera-router/commit/401ad4c2973ef5ede38b4e1b01fcefe362fb3afa))
* update prefix VITE_ ([935d8cb](https://github.com/montara-project/tera-router/commit/935d8cb5316ef0ecec0f26f38e6b69bfdca61eba))
* update react doctor ([a4e8986](https://github.com/montara-project/tera-router/commit/a4e8986e78d36523c047cc258ab4ad088f135d8a))
* update vite api url ([cbf3198](https://github.com/montara-project/tera-router/commit/cbf31989a5816020712cbccde7e4889fce314270))

## [0.1.1](https://github.com/montara-project/tera-router/compare/v0.1.0...v0.1.1) (2026-09-30)

### Bug Fixes

* update dockerfile ([2a62b4a](https://github.com/montara-project/tera-router/commit/2a62b4a172375ba314bcf3774a7c2a784a4af984))
* update release ([967dddd](https://github.com/montara-project/tera-router/commit/967dddd587dcb38f4f1f51a01a138e830afb46b5))
* update release version ([a0bf90c](https://github.com/montara-project/tera-router/commit/a0bf90cb6d0090e7f44f657b3e0b687c840642ad))

## 0.1.0 (2026-09-30)

### Features

* add auth middleware, handlers, and v1 routes ([e55025a](https://github.com/montara-project/tera-router/commit/e55025afc7c1d775788c857b41fc6aa44d314b45))
* add button group ([1033410](https://github.com/montara-project/tera-router/commit/1033410f9fb105dfbae34686bb65da1c6329cb13))
* add crypto libs for secret sealing, passwords, and api keys ([5564295](https://github.com/montara-project/tera-router/commit/5564295b6d817f3499d5ec4b11a0eb3e3bb7661a))
* add custom provider detail page ([d6407de](https://github.com/montara-project/tera-router/commit/d6407dec3649c5f66b1de357ae8542a13f7397b2))
* add docker deployment for the docs site ([43865b0](https://github.com/montara-project/tera-router/commit/43865b04776cc573c78c41cf846d9c5a84cc9f08))
* add docs i18n with en-US default locale ([1e1786a](https://github.com/montara-project/tera-router/commit/1e1786aeaa1a394830594b677ab98c4664534bab))
* add docs site metadata and favicon ([bc0f3d7](https://github.com/montara-project/tera-router/commit/bc0f3d75da84ae30ecb9eb31c73f0439a00db7fa))
* add dtos ([3496703](https://github.com/montara-project/tera-router/commit/349670351d3401d02f34cf48eaa5eb7d052afd01))
* add edit policy dialog to guardrails ([1f057f8](https://github.com/montara-project/tera-router/commit/1f057f814d726ba7a5f5ebefdd6d02cba2e2e5a6))
* add fumadocs skills ([901e418](https://github.com/montara-project/tera-router/commit/901e4185604d6b04f68763f6925c3e3bd795af1f))
* add husky, commitlint and lintstage ([a2edf5a](https://github.com/montara-project/tera-router/commit/a2edf5a91f8f6f1588c127ead1c8dd94afd630a5))
* add inference gateway with multi-dialect connectors ([4de980f](https://github.com/montara-project/tera-router/commit/4de980f4e5ed18822cfcbe37b41383f337a4931e))
* add main-web app with vinext and cloudflare workers deploy ([667df91](https://github.com/montara-project/tera-router/commit/667df915ea2d9bcbe605c73bdf7810f563134293))
* add migrate-on-boot flag to the api server ([a0f35b3](https://github.com/montara-project/tera-router/commit/a0f35b3276e9cb9acd03e6949c4a47de51bbbf8a))
* add per-key model allowlist and key detail page ([75da8c8](https://github.com/montara-project/tera-router/commit/75da8c88e86c4c50e34a9b02b72bd4987791366d))
* add postgres migrations, models, and repositories ([1f00dfd](https://github.com/montara-project/tera-router/commit/1f00dfdef5aa99d2c2d6725508fbad382781c8c4))
* add react doctor yaml ([668b38d](https://github.com/montara-project/tera-router/commit/668b38d081c55f69903e9f29fd9100eb196a82f0))
* add seed on boot ([830b0ae](https://github.com/montara-project/tera-router/commit/830b0ae350fb7a47c4339bed021c313bbe377c39))
* add seeders and database tooling targets ([fca2cec](https://github.com/montara-project/tera-router/commit/fca2cece09541b18a7e0513d92ce1c7411c60411))
* add services for admin api domains ([e7d77f3](https://github.com/montara-project/tera-router/commit/e7d77f34b0b9d608380ce35518ce2a62fcbf298d))
* add skills ([1070025](https://github.com/montara-project/tera-router/commit/1070025f9d92e16c09ae51fc444bcd1920726f06))
* add TableName method to each table-backed model ([a2baad4](https://github.com/montara-project/tera-router/commit/a2baad45c734408f2d7884c0fe5dbb77d4fccd81))
* add typed app errors and response envelope ([fbd4f37](https://github.com/montara-project/tera-router/commit/fbd4f373e498384eb5d1b6913040ba6b02ae7ee4))
* add usage card ([a572bb2](https://github.com/montara-project/tera-router/commit/a572bb2c3cfb8e6300dcc96e94adee44c491c88d))
* build dashboard overview page ([a03ceb8](https://github.com/montara-project/tera-router/commit/a03ceb8ecdc164cf53f80b546e787adc7e72bd45))
* build guardrails page ([cfb9601](https://github.com/montara-project/tera-router/commit/cfb960193d3e1ee39e335294f47f8d5ca4f70c1e))
* build provider health page ([b2c5b30](https://github.com/montara-project/tera-router/commit/b2c5b30a71729f42843ed5e3f75a9fffc076395e))
* build providers tab with policy creation on guardrails ([86e9143](https://github.com/montara-project/tera-router/commit/86e9143e7a27003cfb5c132a9790fa3eca94538d))
* build usage page telemetry dashboard ([3fa9076](https://github.com/montara-project/tera-router/commit/3fa9076e4b90c6194ec970edf2708ab710149358))
* initial project ([b01455d](https://github.com/montara-project/tera-router/commit/b01455d895fe9afede262c9dc964409a4e1c0272))
* localize the docs home page ([dc74f4b](https://github.com/montara-project/tera-router/commit/dc74f4b3a8d85f7e28b0232a46b0d022a0b154fd))
* polish console log page ([73e117b](https://github.com/montara-project/tera-router/commit/73e117bbbd078d5900efa3c210c87385e5c98e2e))
* polish main-web landing page ui ([468a169](https://github.com/montara-project/tera-router/commit/468a1697a45538622f213b262b964b7ebb12d978))
* polish media providers page UI ([3ca2abe](https://github.com/montara-project/tera-router/commit/3ca2abeaf040e6285be4691540f7fceaba778b59))
* polish provider health page ([d60c3a1](https://github.com/montara-project/tera-router/commit/d60c3a19d852f2bdf50bcd18fa52f2402aea5225))
* polish providers page UI ([860bbe9](https://github.com/montara-project/tera-router/commit/860bbe9ca989fadd441fd458ccc2f5c0fbe631f6))
* provider policy dialog with templates and provider select ([26bf065](https://github.com/montara-project/tera-router/commit/26bf065ac1799083652cd3a13815eea51bc3b50c))
* revamp CPU per-core card ([ce776d4](https://github.com/montara-project/tera-router/commit/ce776d41bb7df0bde15b514d1525029d67a544f3))
* **server:** add deployment ([3d768ea](https://github.com/montara-project/tera-router/commit/3d768ea0d63c9e4f3f224d902ac6cb9b6f690551))
* **server:** add sentry for trace error log ([e6211be](https://github.com/montara-project/tera-router/commit/e6211be5e4bd4b61f5cb2e0b195215a8f6c4db63))
* **server:** implement guardrails policies, detectors, and evaluate API ([cff3e2a](https://github.com/montara-project/tera-router/commit/cff3e2a32324aacc9cf6b71ac3db2989506e97f6))
* **server:** migrate database from postgresql to sqlite ([f57c20a](https://github.com/montara-project/tera-router/commit/f57c20a6ade73085265c3332f27e1429ef8f8c29))
* update block components ([785df91](https://github.com/montara-project/tera-router/commit/785df91b63887555899c360d67553f77b762dc40))
* use tera logo with white background and baked-in padding ([d3efb9d](https://github.com/montara-project/tera-router/commit/d3efb9d6eea1514993e41d8174a96576f3b3efc9))
* wire new custom provider dialog on providers page ([32246f5](https://github.com/montara-project/tera-router/commit/32246f5930c20002199a1fd36f3174691ef6fb96))
* wire usage analytics page to a telemetry endpoint ([e06211e](https://github.com/montara-project/tera-router/commit/e06211ed7331947512247316376a95e3515da7be))
* wire web-ui API layer to all backend endpoints ([cf730e5](https://github.com/montara-project/tera-router/commit/cf730e5763198bbb2bd70e1525c504990979c90c))

### Bug Fixes

* finish card surface treatment and Tera Router rename ([d7503a7](https://github.com/montara-project/tera-router/commit/d7503a76519d97d91a74231db19cc59d2d10300c))
* format guardrail audit timestamps and align audit table columns ([5336522](https://github.com/montara-project/tera-router/commit/5336522249ee4691214d35620cd3a57ea594c5f2))
* map unknown routes to 404 and disallowed methods to 405 ([815f5cb](https://github.com/montara-project/tera-router/commit/815f5cb914440c72abacd36e3084d5d189a86f53))
* minor import ([178ae7b](https://github.com/montara-project/tera-router/commit/178ae7b7796e977b7aa3d59d35c9b3d9c2145269))
* minor typing ([b06c2f4](https://github.com/montara-project/tera-router/commit/b06c2f444cf98814cf072580354cc37d887f7624))
* missing import ([4c729af](https://github.com/montara-project/tera-router/commit/4c729af99bbb8fee205e7cc35606772830de45e0))
* missing typing ([8eb3ef1](https://github.com/montara-project/tera-router/commit/8eb3ef1cf2eca516e80b73a06507518c80f63b0c))
* mount sonner Toaster in root layout ([a0c8d87](https://github.com/montara-project/tera-router/commit/a0c8d87fcbc39af822e80425bb64b213b96fbe8c))
* remove .source ([71403cb](https://github.com/montara-project/tera-router/commit/71403cb53a08e70d230b26af69f08b66f875a476))
* render cards over the sidebar background layer ([ffc22c3](https://github.com/montara-project/tera-router/commit/ffc22c3978425db365f4c51cf7d50c76fc98ce0d))
* restore theme provider children typing in web-ui ([1c87357](https://github.com/montara-project/tera-router/commit/1c8735703a2ad0af1453913820cf9b72a7fabe44))
* scrollbar on the sidebar is display none ([ce98d58](https://github.com/montara-project/tera-router/commit/ce98d586595c6e7ab4cafb3edf06510e1e844eee))
* **server:** update cmd/api ([5ed7b96](https://github.com/montara-project/tera-router/commit/5ed7b9631771bd20e3a2b02e883a6c6e63b11461))
* **server:** update repositories ([cf67d25](https://github.com/montara-project/tera-router/commit/cf67d25dd87a9ad900f0973875cc24bfe624c005))
* tighten keys table select column ([6b0e66a](https://github.com/montara-project/tera-router/commit/6b0e66a37a4736cd9f04b49c26b286012563d115))
* update block components ([bb8237c](https://github.com/montara-project/tera-router/commit/bb8237c14d446ad4f48ea8c66f7ca10833c57413))
* update block components ([316b26c](https://github.com/montara-project/tera-router/commit/316b26c76e3e428ee8c90d57da69376bc3031d71))
* update changeset ([560e011](https://github.com/montara-project/tera-router/commit/560e011be302deb8ff70f2eda0c11fc09180f1f4))
* update changeset ([2e19ffc](https://github.com/montara-project/tera-router/commit/2e19ffcf98710a5a5c6bcc3253b093f61b7c7374))
* update cloudflare config ([319c0a0](https://github.com/montara-project/tera-router/commit/319c0a0465a357253d033f013c9078176c408deb))
* update deploy main-web to CF workers ([3a8dbc1](https://github.com/montara-project/tera-router/commit/3a8dbc1b4e90065b5e8fbc4ac036be52045a36ba))
* update deployment ([366090a](https://github.com/montara-project/tera-router/commit/366090af369d0fbaa75ab30ed941128a9cbee2fc))
* update docs ([8466891](https://github.com/montara-project/tera-router/commit/84668915f7508c4b9c018b77d95fe00f1527922a))
* update docs ([0653c08](https://github.com/montara-project/tera-router/commit/0653c08a6033b80bed30d8b7cc016f44febebc9b))
* update docs ([082b23c](https://github.com/montara-project/tera-router/commit/082b23cedf507e5e15a874648dcc9201dd4eba2f))
* update docs ([ba31340](https://github.com/montara-project/tera-router/commit/ba31340588893351b66629566793eb34342b821a))
* update dtos handlers ([9efb5ac](https://github.com/montara-project/tera-router/commit/9efb5ac47501b05c21efd481f7adf4a41e882ed5))
* update endpoint page ([d880c09](https://github.com/montara-project/tera-router/commit/d880c09c38e5bb1edcf69de91368eac1803a38a8))
* update font styles ([38343f6](https://github.com/montara-project/tera-router/commit/38343f662a31d350db965ee80a349ebfc62b2f70))
* update form keys ([b363ac6](https://github.com/montara-project/tera-router/commit/b363ac6e4ba41078d1f61975754a27fdbcbc668e))
* update handlers ([9e34cb8](https://github.com/montara-project/tera-router/commit/9e34cb8c8f87ef3a8c0eef84f50c7b3ef470eea4))
* update home page ([7a5900c](https://github.com/montara-project/tera-router/commit/7a5900c0fab324145ca040379b5239a0890fcde3))
* update improve minor issues ([f25b5e6](https://github.com/montara-project/tera-router/commit/f25b5e6c5aabffc78502a6ab2b4e5cf9b7be2480))
* update key guardrails ([8fe07df](https://github.com/montara-project/tera-router/commit/8fe07df7cd82fd18ecc52c2bd302cb9c421f4edd))
* update linter ([7624110](https://github.com/montara-project/tera-router/commit/7624110042f76811cb42d0860b1c7e5ea71b8779))
* update login ([b3c216a](https://github.com/montara-project/tera-router/commit/b3c216af195a74944fa829c3e5250588426b992e))
* update login ui ([13226d5](https://github.com/montara-project/tera-router/commit/13226d5f5af6a0eefc3335e7dd4fa0e2577e5cd4))
* update main-web dark palette and hero background ([36ab30a](https://github.com/montara-project/tera-router/commit/36ab30ad7250f4efd86b7319b22cf31077a29ea8))
* update minor ([d2d34ce](https://github.com/montara-project/tera-router/commit/d2d34cef8d7be105b33b36b0f359a5fe226cd2fb))
* update minor repositories ([1d08592](https://github.com/montara-project/tera-router/commit/1d0859227837c50db1243d2fdfc11e1f450346ad))
* update minor sidebar nav setting ([9249408](https://github.com/montara-project/tera-router/commit/92494083752b69d53d6f65933b44c156defd202b))
* update oxlint and oxfmt ([f9b41b1](https://github.com/montara-project/tera-router/commit/f9b41b10539c66437b9e9ddbde506b576f526980))
* update package name ([0cfefe8](https://github.com/montara-project/tera-router/commit/0cfefe86737f9639bfbd65256592096860585ccc))
* update prefix custom provider ([a2818db](https://github.com/montara-project/tera-router/commit/a2818db824840b3584a1bc16303defe1f600d257))
* update query print ([3a6a6ff](https://github.com/montara-project/tera-router/commit/3a6a6ffbe92e877b4f12e7d1d2a253d10b345a53))
* update quota page ([3177af9](https://github.com/montara-project/tera-router/commit/3177af99f6a0dbf9ee4ec5d8b766c657d2760887))
* update react-table ([ae5bd5d](https://github.com/montara-project/tera-router/commit/ae5bd5d094cddfb66968599b2a6bfecbe4614814))
* update release-it ([89eb1e9](https://github.com/montara-project/tera-router/commit/89eb1e951f85e33a64c49dcacdc10b043b4d9815))
* update root provider docs ([5ba25f0](https://github.com/montara-project/tera-router/commit/5ba25f003a42d49a1f2cc4051902767306130b83))
* update script ([5946a4c](https://github.com/montara-project/tera-router/commit/5946a4c8188124548cac506e419ed29b831c94b3))
* update script ([53fa9c0](https://github.com/montara-project/tera-router/commit/53fa9c0d7252c6295c200006063c96b27775220e))
* update sealer and quota ([c62f8ac](https://github.com/montara-project/tera-router/commit/c62f8ac66d440e1db2a6a79999d7662d91f61311))
* update section card ([c49c5d1](https://github.com/montara-project/tera-router/commit/c49c5d1a5ebfaabba2e9b2a6214f783596a23f6d))
* update seeders ([e2f28cd](https://github.com/montara-project/tera-router/commit/e2f28cd8774b69a7acbd220a1e121b930390fd9a))
* update sentry config ([06b3375](https://github.com/montara-project/tera-router/commit/06b337580ee704ad681af531195067e73562e081))
* update server ([f5b3334](https://github.com/montara-project/tera-router/commit/f5b3334b0d51dc9ebca9a67affed763958b72448))
* update sidebar ([99e5b82](https://github.com/montara-project/tera-router/commit/99e5b82b3c16aed2d988473dc7c6b9d299d3da93))
* update sidebar menu ([ca28bf4](https://github.com/montara-project/tera-router/commit/ca28bf4efd2493d38e4c2abb2b5064e31e9c567a))
* update sidebar menu ([b1bc54c](https://github.com/montara-project/tera-router/commit/b1bc54c6921c756a4afd91adfbd25d468ea0356e))
* update skills and block components ([475890c](https://github.com/montara-project/tera-router/commit/475890cd58d1f43c4d48549f8b96916570ea31f9))
* update syntax style to snake_case ([1ae6506](https://github.com/montara-project/tera-router/commit/1ae6506a06df73003ef76cca661eaf9e0072b251))
* update system page ([a315689](https://github.com/montara-project/tera-router/commit/a315689686cf9d25588b3db8565d3910111d1032))
* update telemetery ([1263407](https://github.com/montara-project/tera-router/commit/1263407effaffbdc1eaea0713f744cabe99f7b5a))
* update theme ([a745f48](https://github.com/montara-project/tera-router/commit/a745f48ffd37420136cc34e017fb8d574891978b))
* update ts version ([0377fbb](https://github.com/montara-project/tera-router/commit/0377fbb4c797973a1ff8f372ffb5663d2769c069))
* update typing ([d24baa9](https://github.com/montara-project/tera-router/commit/d24baa972c9a0c0fd3179055bdaf664633541e8a))
* update ui page ([942665c](https://github.com/montara-project/tera-router/commit/942665c62a49d6d3771efc59f677df0e21ae69c3))
* update ui skills, system, quota page ([300b0ac](https://github.com/montara-project/tera-router/commit/300b0ac4ea69b3809d5b14f51681fb078d6ff5e7))
* update usage section ([38125d3](https://github.com/montara-project/tera-router/commit/38125d3821ffcaf2bf6b1b8c52c17c06af8a3784))
* update validate on dtos ([f4fb5a3](https://github.com/montara-project/tera-router/commit/f4fb5a34fa0787cadb525368d8bc15ef982b9b42))
* use the dark terminal card in main-web light mode ([31696cc](https://github.com/montara-project/tera-router/commit/31696ccd438a23a7ada0f3d211dbcd610a2d94a1))
* **web-ui:** linter file ([496cbb7](https://github.com/montara-project/tera-router/commit/496cbb70e756164a9720c0d9e82655146d8eca43))
* **web-ui:** update chain page ([f0bcd35](https://github.com/montara-project/tera-router/commit/f0bcd35d456850311a8db4203af8ac54ce0d732f))
* **web-ui:** update chain table ([74c79f6](https://github.com/montara-project/tera-router/commit/74c79f6de477ed6b0da8400201c5ae19a04d5f87))
* **web-ui:** update codebase ([db6397f](https://github.com/montara-project/tera-router/commit/db6397f4d6ba7fbfb4b1c3bd453c49f6b2419fc6))
* **web-ui:** update copy button ([4f80ce8](https://github.com/montara-project/tera-router/commit/4f80ce8b71bd720de2414eeab6126addea7847c8))
* **web-ui:** update decoration ([b061b63](https://github.com/montara-project/tera-router/commit/b061b632afceacfcdce3b9c3735198ff097267fb))
* **web-ui:** update endpoint page ([9bf6303](https://github.com/montara-project/tera-router/commit/9bf6303da77de750e1f515553511d13deb811416))
* **web-ui:** update favicon ([b5bd41d](https://github.com/montara-project/tera-router/commit/b5bd41d1ceb98376b5565fbed71b411880b7a25c))
* **web:** update services ([d695e54](https://github.com/montara-project/tera-router/commit/d695e54670c3d4ede09e2e3e5d515ddf10d1316c))
