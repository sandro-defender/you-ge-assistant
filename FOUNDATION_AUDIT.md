# You.Ge Assistant — Phase 0 Foundation Audit

**Audit date:** 2026-11-05  
**Baseline:** `6789eb7843e182062d405ec9febf37cb1ddf095e` (`main`), working tree clean before this audit  
**Scope:** every tracked file, including `reference/`, `example/`, `demo/`, `.github/`, `scripts/`, `tests/` and all documentation. No application code was changed before this audit was completed.  
**Related documents:** [`INSTALLATION_EXPERIENCE.md`](INSTALLATION_EXPERIENCE.md), [`ASSISTANT_ARCHITECTURE.md`](ASSISTANT_ARCHITECTURE.md), [`DESIGN_FOUNDATION.md`](DESIGN_FOUNDATION.md), [`ARCHITECTURE_AUDIT.md`](ARCHITECTURE_AUDIT.md) (earlier baseline audit).

> This repository has already gone through earlier evolution work. The identity,
> central domain resolver, host-aware manifest helper, cache isolation, DNS
> diagnostics and the React Bits `ElectricLogo` example were present **before**
> this task. This audit re-verified them rather than assuming they were missing.
> This PR is a foundation/definition PR: it preserves those features, documents
> the future platform, and adds only incremental UI, contract-test and tooling
> improvements.

---

## 1. Repository structure and tooling

| Area | Finding |
| --- | --- |
| Type | Static, dependency-free PWA toolkit plus docs, a feature playground and a separate React/Vite sample. It is **not** a framework application with routing, auth or a backend. |
| Package manager | npm. Root `package.json` is private, `"type": "module"`, Node >=18, no runtime dependencies and no lockfile needed. `example/` has its own npm project and lockfile. |
| Root scripts | `check` (static checker + Node tests), `test` (`node --test tests/*.test.mjs`), `verify` (live deployment smoke check), `keys` (VAPID generation). |
| Entry points | `pwa.js` (page-side client, IIFE exposing `window.PWA`), `progressier.js` (service worker), `manifest.webmanifest`, `offline.html` + `offline.js`, `domain-registry.js` → `domain-config.js` → `dns-diagnostics.js` loaded before the client. |
| Optional/edge | `manifest-handler.js` + `functions/manifest.webmanifest.js` (Cloudflare Pages adapter), `qrcode.js` (vendored MIT library, loaded on demand), `examples/push-server/` (sample Web Push sender). |
| UI | `pwa.css` (component styles and all legacy `.progressier-*` compatibility class names), `offline.css`, `demo/index.html` (playground), `example/` (React 19 + Vite 8 app with plain CSS and a vendored React Bits `ElectricLogo`). |
| Reference | `reference/Script.js`, `Script.decompiled.js`, `progressier*.json` — research-only artifacts of the legacy hosted client, deliberately not deployed. |
| CI/CD | `.github/workflows/check.yml` (build ReactBits example, static checks, syntax checks, unit tests, manifest parse) and `.github/workflows/pages.yml` (assemble and deploy the Pages playground + `/example/` sample). Both use GitHub-hosted `ubuntu-latest`; no self-hosted runner label is configured or verifiable from this session. |

## 2. What currently works (verified)

- **PWA installation flow** — `beforeinstallprompt` capture, native `event.prompt()`, `userChoice`, `appinstalled`, standalone/display-mode/iOS detection, iOS and generic manual instruction sheets, desktop QR path, install banners, welcome flow, floating toolbox, `[data-pwa-install]` delegation and MutationObserver support. See [`INSTALLATION_EXPERIENCE.md`](INSTALLATION_EXPERIENCE.md).
- **Identity and metadata** — root manifest, offline page, snippet, demo and docs already use the user-facing name **You.Ge Assistant** / **You.Ge**. Legacy manifest `id` `/HIPSBNVemXtM8VMwRfWs` and `/progressier.js` worker path are preserved.
- **Multi-domain resolution** — `domain-config.js` normalizes hostname/origin/protocol/path, resolves exact host → wildcard host → path-scoped registry entries, validates colours/paths/icons/shortcuts, and returns safe defaults for unknown hosts. `domain-registry.js` contains public branding only.
- **Host-aware manifests** — `manifest-handler.js` emits `application/manifest+json`, `Cache-Control: private, no-store`, `Vary: Host`, rejects non-HTTPS/non-GET and validates that `id`, `scope` and `start_url` stay in the configured base path. `manifest.webmanifest` remains the static fallback for hosts without an edge function.
- **Service worker lifecycle** — registration with an explicitly computed same-origin scope, waiting-worker update prompt, `SKIP_WAITING`, `controllerchange`, visibility-triggered update checks, optional auto-update, and controlled cache cleanup.
- **Offline / caching** — precached offline shell (`offline.html/.css/.js`, `domain-*`, `dns-diagnostics.js`, `pwa.css`, `qrcode.js`, icons), network-first navigations with an offline fallback, cache-first static assets, and host+scope+version cache namespaces. Authenticated, `private`, `no-store` and non-`public` navigation responses are not cached. Share-target POSTs are never cached.
- **Network / DNS diagnostics** — `dns-diagnostics.js` performs user-triggered Cloudflare DoH A/AAAA queries with `AbortController` timeouts, bounded retries, single-flight deduplication, JSON validation and cautious classifications. `DNS_RECOVERY.md` documents Android Private DNS and iOS DNS-only recovery.
- **Other PWA features** — Web Push (VAPID), badges, notification history, share target, share-file retrieval, protocol handlers, iOS splash generation, translated wording, theming, QR install codes, toast notifications, offline alerts.
- **API endpoints** — no production API exists in this repo. The only sample routes are in `examples/push-server/server.js` (`/health`, `/api/push/public-key`, `/api/push/subscribe`, `/api/push/send`, `/api/push/test`) and the `/share-target` POST handled by the worker. Push/analytics endpoints are supplied by page configuration, never hardcoded. `scripts/verify-deployment.mjs` takes a user-supplied target URL.
- **Tests** — 30 Node tests passed before any change (`npm run check`, `npm test`) covering domain resolution, manifest responses, DNS outcomes and the sample UI. `scripts/check.mjs` additionally verifies file presence, JS syntax, manifest icons/PNG dimensions, worker/client version parity, toolbox CSS parity, legacy hosted-script leftovers, Pages asset resolution and distinct example install identities.
- **Build** — `cd example && npm ci && npm run build` passed before any change (Vite 8, React 19).

## 3. What must be preserved

1. The entire installation experience and its public API (`PWA.promptInstall`, `install`, `canInstall`, `isStandalone`, `isInstalled`, `isIOS`, `isSafari`, `showInstallHelp`, `showInstallBanner`, `showInstallRequest`, `wording`).
2. Legacy `.progressier-*` CSS class names, markup contracts, cookie names (`progressierinstallbanner`, `progressierpushbanner`), `localStorage` keys (`pwakit:welcome`) and IndexedDB names (`progressiersharedfiles`, `progressierSavedPushNotifications`).
3. `/progressier.js` as the default worker path and the stable legacy manifest `id` — changing either creates a second installed app for existing users.
4. `window.PWA.__pwaKit` idempotence, script `data-*` attributes, `[data-pwa-install]`/`[data-pwa-diagnostics]` delegation and MutationObserver behavior for dynamically added buttons.
5. Static-fallback operation when `domain-config.js`, `dns-diagnostics.js` or the manifest handler are absent.
6. The dependency-free core runtime; React/Vite/OGL dependencies stay isolated in `example/`.
7. All existing tests and static checks — nothing was removed or weakened.

## 4. What is reusable for You.Ge Assistant

| Existing asset | Future reuse |
| --- | --- |
| `domain-config.js` | Seed for SDK `project/domain resolver` and `configuration manager`; already injectable and testable without browser globals. |
| `domain-registry.js` + `manifest-handler.js` | Seed for verified, per-project manifest settings and configuration publishing (currently static, public data). |
| `pwa.js` install section | Seed for `@youge/assistant-sdk/install`; the documented [`INSTALLATION_EXPERIENCE.md`](INSTALLATION_EXPERIENCE.md) contract is the extraction boundary. |
| `progressier.js` cache namespace + scope logic | Seed for `offline shell utilities` and isolated cache namespaces. |
| `dns-diagnostics.js` | Seed for SDK `network diagnostics` / `DNS diagnostics`. |
| `pwa.css` + `offline.css` | Seed for SDK visual defaults and connection-status notifications. |
| `scripts/check.mjs` + tests | Seed for SDK contract tests, manifest validity checks and CI gates. |
| `example/` React app | Design-system reference surface for the future dashboard (cards, menu, status, empty/loading states). |

## 5. What needs improvement

- **No automated behavioral test for the install flow.** Existing tests cover domain/manifest/DNS/sample UI, but installation is only checked by static source tokens. This PR adds a DOM-harness runtime test.
- **Install instruction sheet accessibility/polish.** The shadow-DOM sheet has no visible `:focus-visible` ring, a 40px close target, and a 70%-opacity note that can lose contrast. This PR improves it incrementally without changing behavior.
- **No TypeScript type-check gate.** The React example is JSX; newly adopted React Bits TS-CSS source needs a `tsc --noEmit` check. This PR adds isolated dev-only TypeScript tooling in `example/`.
- **React Bits coverage was limited to one WebGL logo.** This PR vendors small, zero-dependency TS-CSS components for cards, CTA feedback and loading states, with reduced-motion and cleanup guarantees.
- **Documentation describes the toolkit but not the platform.** No single document defined the future dashboard, SDK, configuration publishing, security boundaries, failover architecture or roadmap. This PR adds them.
- **No explicit decisions register.** Several future decisions depend on inspecting the *external* `staff.you.ge` implementation; they are listed in [`ASSISTANT_ARCHITECTURE.md`](ASSISTANT_ARCHITECTURE.md#11-decisions-that-cannot-be-made-yet).
- **Self-hosted runner usage is unverified.** The GitHub API returns `403 Resource not accessible by integration` when listing repository runners; CI remains on `ubuntu-latest` until a runner label is confirmed.

## 6. What is genuinely missing (searched, not inferred)

- Standalone management dashboard: no project/domain registration, verification UI, admin access control, health/failover monitoring, or configuration publishing UI.
- Published SDK package `@youge/assistant-sdk`: no npm workspace, package export map, build output, versioning or release pipeline. Intentionally deferred.
- Central configuration service, schema registry, last-known-good storage, config version negotiation and signature/validation of published configs.
- Primary/backup API failover engine, automatic recovery, write-replay policy, per-project endpoint health checks and user-facing failover notifications.
- Domain verification workflow (DNS/HTTP challenge, ownership proof, approval state). Current hostname detection is display/config only.
- Administrator authentication/authorization. Nothing in this repo authenticates users; `examples/push-server` explicitly warns that its routes are unauthenticated samples.
- `staff.you.ge` integration of any kind, backup authentication, or use of the example Cloudflare Worker URL as a runtime default.
- Production infrastructure, deployment URLs for the Assistant service, secrets, or release tags.
- Automated browser/device tests for real Android/Chromium install prompts and iOS Safari "Add to Home Screen"; existing checks are unit/static tests.
- TypeScript in the core runtime; `pwa.js`, `progressier.js`, `domain-config.js` and `dns-diagnostics.js` remain classic scripts by design for no-build embedding.

## 7. Architectural and security risks

| Risk | Current status / required future control |
| --- | --- |
| Domain detection mistaken for authentication | Already documented as display/config only. Future dashboard must verify ownership and authenticate administrators separately. |
| Host header trust / cross-origin redirects | `manifest-handler.js` derives host from `request.url`, sets `Vary: Host` and rejects scopes that escape the app base path. Future endpoints must not trust arbitrary `Host`, must allowlist redirect targets and keep protocol-handler redirects same-origin unless explicitly configured. |
| Cross-project cache/private-data leakage | Worker namespaces caches by hostname + registered scope + version, deletes only its own namespace, and will not cache `authorization`, `private`, `no-store` or non-`public` navigations. Dashboards and SDK caches must use project-scoped names too. |
| Sensitive authenticated API responses cached | Excluded by default today; keep that default when failover/config modules are added. |
| Silent replay of write operations | No replay exists today. The future failover engine must explicitly exclude non-idempotent writes. |
| Remote config as executable code/secrets | No remote config service exists. Future schema must be data-only JSON (no `eval`/`Function`/script URLs), contain no credentials, and be validated against a versioned schema. |
| Stable install identity/scope | Legacy `id` and `/progressier.js` are preserved; per-project manifest `id`s must remain stable after launch. |
| Static manifest on shared hosting | A static file cannot vary per host. Host-aware delivery requires the edge function or deployment-generated per-host manifests; document this rather than pretending client-side detection changes manifest bytes. |
| Push sample security | `examples/push-server/server.js` is an unauthenticated sample with local JSON storage; must not be deployed as a production endpoint. |
| DoH diagnostic overclaim | A successful Cloudflare DoH lookup does **not** prove the device's resolver works or that an ISP blocks DNS. Current classifications are deliberately cautious; keep them. |
| WebGL/animation cost | The former `ElectricLogo`/OGL animation was removed; the launcher uses a static zoomed mark. The adopted components are CSS/DOM-only, skip continuous animation, respect `prefers-reduced-motion`, and clean up observers/listeners. |
| Preview/backup URL confusion | The future `https://staff-you-ge.sandro-1990.workers.dev` is an example value for *project-specific* configuration only. It is not a global SDK default, not hardcoded in runtime, and not an approved production backup. Sandbox preview URLs are never production infrastructure. |
