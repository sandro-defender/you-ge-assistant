# You.Ge Assistant — Architecture Audit and Implementation Plan

**Audit date:** 2026-11-04  
**Baseline:** `49e0d061ce33935d1a418f1aae74a908b1428248`  
**Audit scope:** all tracked project files, repository instructions, runtime files, examples, workflows, scripts and reference material. No application code was changed before this audit was completed.

## 1. Executive summary

This repository is not a conventional product web application. It is a dependency-free, static PWA helper kit: a browser-side SDK, service worker, static manifest, offline page, styles/icons, documentation, a feature-test playground, a sample integration, deployment checks, and an optional push-server example. There is no app framework, application navigation/authentication, production backend, DNS diagnostic, DNS recovery screen, build step, or automated browser-test suite.

The runtime is already partly deployment-relative: `pwa.js` resolves assets relative to its script URL, `progressier.js` resolves its offline and precache paths relative to the worker, and the example demonstrates a `/example/` base path. However, the shipped root manifest and offline page use root-relative URLs and a `staff.you.ge` identity; the integration instructions and sample push server also have that hostname baked in. Manifest delivery is static today, so genuinely per-host manifest identity requires a host-aware serving endpoint or equivalent deployment integration; browser-only hostname detection cannot change the bytes of a static manifest served identically on every alias.

The implementation will preserve the kit's public API, worker path (`/progressier.js`), compatibility database names and existing install identity on its legacy deployment. New domain configuration and DNS diagnostics will be layered into the existing kit, not used to replace it.

## 2. Existing architecture

### Runtime flow

`pwa.js` is the sole page-side entry point. It reads configuration from script `data-*` attributes, injects/loads `pwa.css`, fills missing PWA/iOS/Windows metadata, registers the configured worker, captures install/update events, mounts optional UI, and exposes `window.PWA`. `progressier.js` is the service worker and handles precache/offline navigation, share-target POST requests, web push display/clicks, badges, messages and update lifecycle. The manifest is a static JSON file. `qrcode.js` is loaded on demand. `offline.html`, `offline.css` and `offline.js` provide a separate fallback document.

The tree has no runtime dependency install/build process. `package.json` provides static check, live deployment verification and VAPID key-generation scripts. GitHub Actions statically checks the root runtime and builds/deploys a GitHub Pages playground and an independently scoped `/example/` sample.

### Existing UI and examples

The repository includes:
- `demo/index.html`: feature playground covering installation, QR, push API, notification history, share target, cache clearing, theme, wording, splash generation, update application and PWA events.
- `example/index.html`, `example/example.js`, `example/example.css`: a polished sample staff-workspace UI with sample browser-local interactions and a route-scoped PWA deployment.
- `pwa.css` and `offline.css`: responsive PWA component/offline styling; the helper stylesheet includes reduced-motion and focus support.
- No login, authentication flow, application navigation framework or product backend exists in this checkout.

### Existing user data / storage compatibility

The worker uses Cache Storage for static assets and network-first pages, and IndexedDB for notifications, shared files, badge/config metadata. Several IndexedDB names are legacy compatibility contracts kept from before the You.Ge Assistant migration (`progressiersharedfiles`, `progressierSavedPushNotifications`) and must not be renamed. The kit also uses `localStorage`/cookies for component preferences and dismissal state. Existing origin partitioning by browsers is a useful safety boundary, but cache names are not currently explicitly domain-keyed.

## 3. Existing PWA feature inventory

- Static root manifest with stable legacy `id`, standalone display, icons/maskable icons, share target, protocol handlers and launch handler.
- Worker registration, waiting-worker update notification/application, controller-change handling and optional automatic update.
- `beforeinstallprompt` capture and `appinstalled` handling; standalone detection via display-mode queries, iOS `navigator.standalone`, Android app referrer, launch parameter; iOS/Safari/platform detection.
- Install buttons, translated wording, generic/iOS manual install instructions, welcome/flow UI, install banners and optional floating toolbox; optional desktop QR flow.
- Generated iOS splash-screen links and Apple/Windows/legacy browser metadata.
- Offline alert/toast, network-first document handling with timeout, static-asset stale-while-revalidate, offline fallback and cache-clearing API.
- Local QR generation, customizable QR destinations, share-target form handling and IndexedDB-backed shared file retrieval; protocol redirects with same-origin default checks.
- Optional VAPID push subscription/unsubscribe and subscription renewal hooks; notification display/history, click/action routing and app-badge helpers. Actual sending and subscription persistence are backend responsibilities; the example server is explicitly not production-authenticated.
- Optional event beacon analytics; PWA event API and a broad public compatibility API documented in README/AGENTS.
- Styling/theme application, language/wording support, browser/device checks, iOS splash generation and cache/version maintenance.

## 4. Current domain assumptions and hardcoded configuration

### Existing adaptable behavior

- `pwa.js` uses browser `location` for fallback application name, QR default destination, protocol redirect origin and URL handling. Runtime asset defaults derive from the script URL. Worker registration scope defaults to the worker directory and can be set via `data-sw-scope`.
- `progressier.js` handles same-origin requests only and derives its scope directory from its own URL. Its share-target redirect and offline page paths follow that worker location.
- `example/` configures a relative manifest, worker scope and asset paths, and its checker verifies a distinct install identity and subpath scope.
- `scripts/verify-deployment.mjs` receives a user-supplied target URL; it has no fixed target host in its logic.

### Fixed or host-specific behavior

- Root `manifest.webmanifest`: `name` and `short_name` are `staff.you.ge`; stable `id` is `/HIPSBNVemXtM8VMwRfWs`; root-absolute start/scope/icon/share/protocol URLs.
- `offline.html`: title and retry destination assume `staff.you.ge` and `/`; root-absolute assets; no explicit domain label or recovery diagnostics.
- `snippet.html`, `INTEGRATION.md`, README/AGENTS/ PARITY documentation, deployment comments and example copy describe the staff.you.ge integration.
- `scripts/generate-vapid-keys.mjs` prints `mailto:admin@staff.you.ge`; sample push sender defaults its notification title to `staff.you.ge`.
- Demo/example manifests, branding and GitHub Pages workflow include sample-specific identities, intentionally separate from the production kit.
- Worker cache names `pwa-static-${VERSION}` / `pwa-pages-${VERSION}` and cache cleanup prefix `pwa-` are version-based, not hostname-based. Names are origin-scoped by browser storage, but a broader worker on a shared origin can currently remove other `pwa-*` caches.
- Worker metadata/IndexedDB databases and page-side persistence names are compatibility identifiers, not branding; they should be retained and treated as origin-partitioned stores.
- `reference/` contains the legacy hosted client's original artifacts and is research-only; it is not deployed and should not be blindly rebranded or rewritten.

There are no authentication redirects, canonical/OG metadata system, DNS tests, Cloudflare endpoint integration, or API host constants in the product runtime. Push, analytics and other configured endpoints are supplied through page configuration; they require validation and same-origin-safe defaults when domain-driven endpoint configuration is introduced.

## 5. Proposed You.Ge Assistant architecture

1. Add a small dependency-free domain module that takes a browser location (injectable in tests), normalizes hostname/origin/protocol/pathname, derives base path and subdomain/apex information conservatively, and resolves a validated immutable configuration.
2. Keep a central default plus an explicit allowlisted registry for optional host/subdomain overrides. Exact hostname entries take precedence; wildcard behavior is constrained and documented. Unknown domains receive a safe, feature-limited default identity and no privileged endpoint values. Runtime location informs display and local diagnostics only; it never authenticates a user or grants access.
3. Make the page runtime consume one resolved configuration object. Preserve script attributes as legacy/explicit overrides where safe. Keep `window.PWA` and current markup/API compatible, adding a documented identity/domain API rather than duplicating hostname logic in components.
4. Use a validated manifest representation and a small server/edge handler contract for runtime manifest responses. Static-only hosting must either use deployment-generated per-host manifests or accept the documented fixed fallback identity; client-side host detection alone cannot provide a valid dynamic JSON response to multiple host aliases. Keep stable IDs for the existing staff.you.ge installation and use stable per-origin IDs for other domains. Do not tell users a cross-origin install is shared.
5. Derive worker scope and asset URLs from the deployed base path/config. Preserve `/progressier.js` as the default path for existing installations. Namespace cache names with a safe host/path-derived identifier plus version, delete only this kit's known namespaces, and retain the existing compatible IndexedDB names. Add a migration/cleanup policy that does not erase saved shares, notifications or badge data.
6. Rework the cached offline document so identity/domain/context can be rendered from the current origin and scope without fetching configuration. Include a retry link derived from the active scope and a locally available diagnostics/recovery entry point.
7. Add an on-demand Cloudflare DoH diagnostics module. It will query `https://cloudflare-dns.com/dns-query` for the browser-detected hostname, validate JSON/status/type/answer data, use AbortController timeouts and bounded single-flight retries, and distinguish DoH failure, DNS result, app-origin fetch failure, backend failure, browser offline signal, and inconclusive cases. It cannot inspect the device's normal DNS resolver and must not label a successful DoH lookup proof of ISP DNS blocking.
8. Add user-guided Android Private DNS and iOS DNS-only Cloudflare setup links. No automatic system settings modification, WARP requirement, secrets, or private API response caching.

## 6. Branding and content changes planned

- Rename the package and all product-facing copy to **You.Ge Assistant** where it refers to this kit; use a shorter label (`You.Ge`) where platform space warrants.
- Update root manifest fallback identity, offline screen, snippet, docs, example push title/default VAPID subject, and demo navigation/metadata where those currently present this product as the kit.
- Preserve filenames/API identifiers such as `pwa.js`, `progressier.js`, `.progressier-*` CSS compatibility classes, cache/IndexedDB data keys, GitHub repository URL and legacy worker URL. Keep third-party compatibility references and reference artifacts clearly labeled instead of blindly replacing them.
- Keep the sample `Staff Space` as a sample application identity, but remove the implication that its host is the only supported deployment.

## 7. DNS diagnostics/recovery plan

- No DNS engine exists today; there is no server-side resolver or monitoring. Diagnostics will be initiated only on user request or when the diagnostics UI is opened (never block startup or continuously poll).
- DoH query uses DNS JSON API with `Accept: application/dns-json`; query types A and AAAA, check HTTP/network/timeout/JSON validity and DNS status (`NOERROR`, `NXDOMAIN`, others), and report available answers without treating a missing AAAA record alone as an outage.
- Compare with a same-origin application reachability probe that does not expose arbitrary URLs or cache private responses. State the browser's limits: JS cannot inspect the ordinary configured resolver; DoH success plus app failure is inconclusive among resolver, route, IP/TLS, CDN and backend faults.
- Provide a per-run result including current hostname, resolver, time and a retry action. Recovery instructions are platform-guided and link to official Cloudflare Android/iOS setup and store listings. Retest the current detected host after the user returns.

## 8. Affected files and modules

Expected changes: `pwa.js`, `progressier.js`, `manifest.webmanifest`, `offline.html`, `offline.js`, `offline.css`, `pwa.css`, `snippet.html`, `demo/index.html`, `demo/manifest.webmanifest`, `example/` assets/config as needed, `scripts/check.mjs`, `scripts/verify-deployment.mjs`, `scripts/generate-vapid-keys.mjs`, `examples/push-server/*`, `.github/workflows/pages.yml`, `package.json`, `README.md`, `AGENTS.md`, `INTEGRATION.md`, `PARITY.md`; new domain/DNS modules, tests, architecture/config/deployment/DNS docs and changelog.

No changes are expected in `reference/` or `qrcode.js` except if an audit identifies a concrete correctness issue. Icons are reused by default; domain-custom icon sets are registry-relative URLs and must be validated for same-origin scope where required.

## 9. Compatibility, security and privacy risks

- **Manifest identity:** changing `id` can create an additional installed app. Keep the legacy `staff.you.ge` ID and distinguish newly configured origins with stable origin-specific IDs; browsers isolate installs by origin. A separate domain cannot inherit another origin's install/storage.
- **Dynamic manifest hosting:** a static file server cannot inspect/validate request Host and return a host-specific body. Require an explicit edge/server route or per-host build artifact; reject unregistered host configuration and never derive privileged settings from an arbitrary Host header.
- **Service worker/cache migration:** changing cache namespace must be scoped to this worker and preserve current user stores. Old worker caches should only be removed after confirming ownership; do not delete all `pwa-*` caches indiscriminately.
- **Path deployments:** base path must be normalized and kept inside origin/scope for manifest, worker, offline, share, QR and retry routes. Worker `Service-Worker-Allowed` headers may be necessary for scopes broader than the worker directory.
- **Host trust:** use `window.location` only for local contextual display and current-host diagnostic target. Allowlist registry keys; validate redirect destinations and manifest asset URLs; never use hostname as authorization or to expose secrets.
- **DNS semantics:** DoH cross-origin requests are subject to Cloudflare availability/CORS/network policy; distinguish DoH/CORS failure from NXDOMAIN and application/TLS/backend failure. Results are diagnostic evidence, not proof of resolver tampering.
- **Connectivity probe:** avoid caching or sending credentials, and do not let arbitrary query values become fetch targets.
- **Push example:** current push demo is unauthenticated by design. Do not expand that exposure; keep production authorization explicitly documented.
- **Legacy storage:** compatibility-named IndexedDB and cookies should be retained; use origin isolation and migration rather than clearing them on rename.

## 10. Test and migration plan

1. Add Node built-in test-runner coverage for normalization, apex/`www`/subdomain/unrelated/unknown hostname, protocol/origin/path, safe config precedence, base-path validation, manifest fields/identity and scope containment. Use injected location/config; no external service or DNS dependency in unit tests.
2. Add deterministic DNS tests using injected fetch, fake timers/AbortController and fixtures for A/AAAA success, NXDOMAIN, malformed JSON, invalid responses, retry/deduplication, timeout, CORS/network rejection, DoH unavailable, app-host unavailable and backend-unavailable classifications.
3. Extend static checks for old-branding exceptions, manifest generation route/contract, valid fallback manifest/icons, worker/version/cache namespace, deployment scopes and no hard-coded `staff.you.ge` in the DNS engine.
4. Preserve and run the current static check, syntax checks, manifest parsing and sample Pages assembly checks. Add live deployment verification for host-aware manifest MIME/body where a staging endpoint exists; never claim real ISP interference testing without a real affected network.
5. Browser/manual acceptance (not currently automated): install separately on two origins, verify resolved identity/manifest, worker scope and origin-isolated cache; test subpath deployment, online/offline recovery, install prompt/manual iOS guidance, QR/share current-origin destination and worker update. Validate HTTPS and relevant CSP/CORS headers.
6. Migration: retain `/progressier.js`, existing public `PWA` API, current legacy manifest ID for `staff.you.ge`, IndexedDB names and storage; increment worker version. Serve a compatibility fallback if dynamic manifest infrastructure is unavailable. Document that cross-origin migration requires a separate install and does not transfer browser storage.

## 11. Phased implementation plan

1. **Audit/architecture (this document):** inventory, architecture, affected files, risks and tests. Complete before runtime changes.
2. **Identity/domain foundation:** rebrand product-facing content; add centralized detection/registry and unit tests; retain compatibility identifiers.
3. **PWA adaptation:** host-aware manifest handler/contract and fallback, scope-aware worker, isolated safe caches, domain-aware offline page, preserve installation/update/share/QR behavior.
4. **Diagnostics/recovery:** Cloudflare DoH module, classifications, accessible UI and Android/iOS guides; no startup blocking.
5. **Integration/regression:** static and unit checks, Pages assembly/subpath validation, check/build; document any live/browser/network validation not available in this environment.
6. **Docs/release preparation:** README and configuration/DNS/deployment/changelog; record migration limits and validation status.

## 12. Repository/CI status at audit

- The checkout was clean on `arena/93a765db-pwa-helper` before this audit document.
- Existing workflows are `check.yml` (static/syntax/manifest checks on PR and main/master push) and `pages.yml` (GitHub Pages playground/example deployment on `main`). There is no build bundler or browser-test job.
- GitHub reports no pull request associated with the current branch and no open PR created by this user in this repository. Therefore no existing PR is available to update or CI check results to await; a new PR will not be created without resolving that constraint.
- No `ui-ux-pro-max-skill` files or instructions are present in the checked-out repository or its parent directory.
