# Agent Handoff — SDK `0.4.0` release preparation (kit `1.2.7`)

**Date:** 2026-11-19
**Branch:** `arena/ac2af8ea-you-ge-assistant`, based on `017bcef09457d1388b5e0f219e63c218310f6695` (`main`).
**PR:** [PR #52](https://github.com/sandro-defender/you-ge-assistant/pull/52) (open against `main`, release preparation only — unmerged).
**Commit:** verified release-candidate tree `6a18579` (this handoff commit adds documentation only).
**Working tree:** Complete release-preparation change set: synchronized SDK/kit version bumps, public-surface audit, new tests, documentation and release records. Generated `dist/`, `examples/example/node_modules` and `examples/example/dist` stay gitignored.
**Versions:** SDK package `@youge/assistant-sdk` `0.3.0 → 0.4.0` (prepared, **not published**); kit `1.2.6 → 1.2.7`, **explicitly authorized by the owner during this task** because the regenerated precached `assistant-state.js` mirrors `SDK_VERSION`. The registry still reports `0.3.0` as `latest` (`npm view` verified 2026-11-19; `@0.4.0` is 404). No npm stage/publish, tag, GitHub release, merge or deployment was performed.

## Completed

- **Version synchronization.** `packages/assistant-sdk/package.json` `0.4.0`, `SDK_VERSION` `0.4.0`, `KIT_COMPAT_VERSION` `1.2.7`, `VERSION` in `you-ge-sw.js`, `PWA.version` in `pwa.js`, root `package.json` `1.2.7`; `npm run sync:sdk` regenerated `src/assistant/assistant-state.js`. `SCHEMA_VERSION` stays `1` — the only config change is the additive, defaulted `installExperience` input, and a `0.3.0` `publishedConfig` still validates.
- **Release gates and pinned expectations.** `scripts/check.mjs` now asserts SDK `0.4.0` and adds contracts for the `./i18n` subpath, the 12 core locales, the i18n helpers and declarations, and the installation API/type surface. `tests/identity-migration.test.mjs` (version, cache names `v1.2.7`, gate summary `1.2.6 → 1.2.7`, `AGENTS.md` pin), `tests/install-experience.test.mjs`, `tests/example-theme.test.mjs`, `tests/pages-landing.test.mjs` and `packages/assistant-sdk/tests/sdk-core.test.mjs` were updated. No rule was weakened.
- **Public SDK API audit (npm-consumer view).** `packages/assistant-sdk/tests/sdk-public-api.test.mjs` imports `@youge/assistant-sdk`, `/i18n` and `/installation` through the package specifier, asserting: the exact export map with no wildcards, `ERR_PACKAGE_PATH_NOT_EXPORTED` for `src/...` deep imports, root↔subpath export parity, all 12 locales (metadata, full key parity, non-empty copy, plural forms, RTL detection, DNS localization, Chrome handoff labels), the seven documented installation APIs plus their TypeScript types, and the `native`/`manual-ios`/`manual-generic`/`installed`/`none` state matrix with honest dialog/prompt fallbacks.
- **Consumer proof (outside the repo).** `npm pack` → fresh project install of the real tarball: runtime check passed (0.4.0/1.2.7, 12 locales, all APIs, deep imports blocked), `tsc --noEmit` passed under `moduleResolution` `NodeNext` **and** `Bundler` with `skipLibCheck: false`, and `npm ls --omit=dev` shows the SDK with **no** runtime dependencies (React optional and unmet).
- **Package contents.** `files` now also ships `MIGRATION.md`; `validate-package.mjs` requires `README.md`, `MIGRATION.md` and `LICENSE` in the tarball and in the whitelist. `npm pack --dry-run`: **27 files**, 120.1 kB tarball / 458.2 kB unpacked, including `src/core/i18n.{js,d.ts}` and every export target.
- **Documentation.** SDK README gains `## Localization — 12 core locales (0.4.0)` and `## PWA installation integration (0.4.0)` with install/import, locale resolution, localized instructions, state reading, dialog open/hide, native triggering, manual-only browsers, the 12-vs-35 locale distinction, and explicit "the browser decides" installation caveats; plus updated status, subpath table and versioning sections. Also updated: `CHANGELOG.md` (new `0.4.0`/`1.2.7` entry and the missing retrospective `1.2.6` entry), `RELEASE.md` (§1 state, packed size, new §7 pass), `MIGRATION.md`, root `README.md`, `docs/guides/INSTALLATION_EXPERIENCE.md` (§6 SDK driving), `docs/guides/INTEGRATION.md`, `docs/operations/PRECACHE_INTEGRITY.md` (§1, new §13), `AGENTS.md`, and the demo/example version labels.
- **Pre-existing test failure corrected.** `tests/example-theme.test.mjs` expected exactly three example dependencies although `@playwright/test` was added by PR #51; verified failing on base `017bcef` in a clean worktree, then the expected list was corrected to the four declared dependencies (the guard still fails on any new dependency).
- **`examples/example` typecheck coverage.** New `src/installation-i18n.typecheck.ts` compiles the documented 0.4.0 localization + installation API and every exported type through the package specifier.

## Verification (all re-run on this branch)

- `npm run check`: **passed** — `scripts/check.mjs` 300 contracts green, `validate-package.mjs` green, `node --test tests/*.test.mjs packages/assistant-sdk/tests/*.test.mjs` **622/622**.
- `npm run test:sdk`: **150/150** (was 142/142; `sdk-public-api.test.mjs` adds 8).
- `node packages/assistant-sdk/scripts/validate-package.mjs`: **passed** (`0.4.0` / `1.2.7`, 27 tarball files, zero runtime deps, optional React peer, export map + declarations, release-gate assertions, no npm token reference).
- `node scripts/precache-integrity.mjs`: **passed** — `1 of 14 precached assets changed (assistant-state.js) since 017bcef; kit version 1.2.6 → 1.2.7 synchronized`.
- `node scripts/sync-sdk-browser.mjs --check`: **in sync**.
- `npm pack --dry-run`: 27 files; every export target, `README.md`, `MIGRATION.md`, `LICENSE` present; no tests/scripts/metadata leaked.
- `examples/example`: `npm ci --ignore-scripts`, `npm run typecheck` and `npm run build`: **passed** (Vite emits its usual classic-script warnings).
- Root `npm run build` (Pages assembly): **passed** (19 runtime/public files + `icons/`).
- Registry: `npm view @youge/assistant-sdk version` → `0.3.0` (`latest`); `npm view @youge/assistant-sdk@0.4.0` → 404. Nothing was published.
- `git diff --check`: clean.

## Limits, risks and exact next action

- No physical Chromium/Safari/manual-install session and no Playwright e2e run (browser download is unavailable in this sandbox; `npm ci` used `--ignore-scripts`). The 35-locale `<pwa-install>` chrome and RTL/cross-browser behaviour remain browser-verification items for the owner.
- The GitHub Actions `sdk-release-prep` workflow cannot be dispatched from a sandbox or on a branch: its `verify` selection is main-only-adjacent, its stage/publish jobs are main-only and environment-protected. Its **verify selection was reproduced locally step by step** (example ci/typecheck/build → `npm run check` → SDK tests → browser-sync check → validate → pack dry-run). No OIDC check, stage or publish was attempted.
- `SDK_RELEASE_ENABLED` remains unset, no secrets were added, no workflow file changed, and the protected `sdk-npm-publish` environment is untouched.
- **Exact next action (owner):** review and merge this PR (kit `1.2.7` also deploys via Pages on merge to `main`), then dispatch `.github/workflows/sdk-release-prep.yml` with **Verify only**, then **Stage release on npm**, and approve the staged `0.4.0` on npmjs.com. Publishing, tagging and GitHub releases remain the owner's gated decisions.

---

## Historical handoff (superseded)

# Agent Handoff — `<pwa-install>` integration and full multilingual localization

**Date:** 2026-11-18
**Branch:** `arena/b025b717-you-ge-assistant`, based on `b256c49faf3b0198c890d5165126e6c60db1b29a` (`main`).
**PR:** [PR #51](https://github.com/sandro-defender/you-ge-assistant/pull/51) (open against `main`, awaiting review).
**Working tree:** Complete implementation, multilingual coverage across all surfaces, tests, documentation, synchronized SDK/kit declarations, and `THIRD_PARTY_NOTICES.md`. Generated `dist/`, `examples/example/node_modules`, and `examples/example/dist` are gitignored. Host service-worker ownership remains unchanged.
**Versions:** Kit `1.2.5 → 1.2.6`, **authorized by the owner because precached assets changed**; SDK package `@youge/assistant-sdk` remains `0.3.0`. No npm publish, tag, merge, or deployment was performed.

## Completed

- **Self-contained `@khmyznikov/pwa-install@0.7.0` runtime (`src/runtime/pwa-install.js`):** Bundled cleanly with MIT attribution (`THIRD_PARTY_NOTICES.md` and `examples/example/THIRD_PARTY_NOTICES.md`), zero remote CDN calls, idempotent `customElements` registration guards, all 35 built-in locales (including native Georgian `ka`, Russian `ru`, Estonian `et`, `nb`/`nn->no`, `zh-*`/`ca`, RTL handling, decorative `alt=""`, and localized accessible close controls).
- **Classic PWA toolkit (`src/runtime/pwa.js`, `src/runtime/pwa.css`, `src/runtime/you-ge-sw.js`, `src/domain/dns-diagnostics.js`, `src/offline/offline.{html,js}`):**
  - Added `pwa-install.js` as an optional precached asset (`14` assets total in `PRECACHE_ASSETS`: `6` required, `8` optional).
  - Integrated `<pwa-install>` under `installExperience` (default `presentation: 'manual'` with opt-in `'auto'`), exposed `showInstallDialog`, `hideInstallDialog`, `triggerInstall`, `getInstalledRelatedApps`, and `configureInstallExperience`, unified all 12 core locales (`en`, `ka`, `ru`, `fr`, `it`, `de`, `sv`, `nl`, `no`, `da`, `et`, `es`) across `wording`, `showHelp('ios' | 'generic')`, install/push banners (with decorative `alt=""`), QR dialog, and captured `.youge-install-button` refreshes (`PWA.setLanguage`/`getLanguage`, `lastDispatchedLanguageKey` deduplication), while syncing bidirectionally with `YouGeAssistant` (`fromPwa`/`fromAssistant`) and respecting standalone explicit `<pwa-install locale="...">`.
  - Localized all 33 DNS diagnostic keys across all 12 core locales (`YouGeDns`) and all 19 offline recovery targets (`offline.js` listening for `pwa:language` + forwarding locale to `YouGeDns.check`), plus fixed `src/assistant/assistant-widget.js` (`lang`, `dir`, `chromeOpenLabel`, `toolkitDialogOpen` `Escape` ownership).
- **Domain, SDK & Browser State (`src/domain/domain-config.js`, `packages/assistant-sdk/`, `src/assistant/assistant-state.js`):**
  - Added `packages/assistant-sdk/src/core/i18n.{js,d.ts}` (`@youge/assistant-sdk/i18n` subpath export), `KIT_COMPAT_VERSION = '1.2.6'`, 12-locale UI/notice/DNS/Chrome-handoff localization (`translate`, `formatAlertCount`, `resolveLocale`, `normalizeLocaleTag`, `normalizeInstallLocaleTag`, `isRtlLocale`, `resolveInstallationCopy`), `domainRegistry` language precedence in `'auto'` mode, live `navigator` `languagechange` tracking in `'auto'` mode (with runtime-only `setLocale`, zero `localStorage` locale persistence), `installExperience`, `showInstallDialog` / `hideInstallDialog` / `triggerInstall` / `getInstalledRelatedApps`, named `createChromeHandoff`, and `youge:locale-change` events (`bubbles: false` on `document` & `window`).
  - Regenerated `src/assistant/assistant-state.js` via `npm run sync:sdk`.
- **Examples, Tooling & Documentation:** Fully localized `examples/demo/index.html` and `examples/example` (`src/i18n.{js,d.ts}` with 186 verified keys, `example.js`, `main.jsx`, `landing.ts`, `ThemeStudio.jsx`, `FoundationPreview.tsx`, HTML/CSS/TS), fixed `'auto'` `<select>` persistence and `resolveExampleLocale` explicit locale resolution, updated `scripts/{source-paths,build,verify-deployment,check}.mjs`, `AGENTS.md`, `README.md`, `packages/assistant-sdk/README.md`, `docs/operations/PRECACHE_INTEGRITY.md` (§12), and `docs/guides/{INSTALLATION_EXPERIENCE,INTEGRATION}.md`.

## Verification

- `node scripts/check.mjs`: **passed** (required files, syntax, manifest, service worker, precache integrity `8 of 14 precached assets changed … kit version 1.2.5 → 1.2.6 synchronized`, examples, MIT notices, and Assistant contracts).
- `node packages/assistant-sdk/scripts/validate-package.mjs`: **passed** (`KIT_COMPAT_VERSION` `1.2.6`, `SDK_VERSION` `0.3.0`, 26 tarball files, 23 source modules).
- `npm run test:sdk`: **142 passed / 0 failed** (including `packages/assistant-sdk/tests/sdk-i18n.test.mjs`).
- `examples/example`: `npm run typecheck` and `npm run build` **passed**; `node scripts/sync-pages-examples.mjs --check` **passed**; `assemblePages({ skipBuild: true })` verified root, `pwa-install.js`, `example/`, and `example/pwa-install.js`.
- `node --test tests/*.test.mjs packages/assistant-sdk/tests/*.test.mjs`: **613 passed / 1 failed** (the single failure is the pre-existing `tests/example-theme.test.mjs:149` assertion against `@playwright/test` in `examples/example/package.json`, which already failed on base `main` `b256c49`). All new and updated runtime/SDK/i18n/example tests (`tests/i18n-runtime.test.mjs`, `packages/assistant-sdk/tests/sdk-i18n.test.mjs`, `tests/install-experience.test.mjs`, `tests/assistant-widget.test.mjs`, `tests/example-ui.test.mjs`, `tests/identity-migration.test.mjs`, `tests/precache-integrity.test.mjs`, `tests/service-worker-precache-policy.test.mjs`, `packages/assistant-sdk/tests/sdk-core.test.mjs`) passed.
- `git diff --check`: clean.

## Limits, risks and exact next action

- No physical mobile/desktop Chromium/Safari browser session or live deployment was run in this sandbox (`examples/example` Playwright e2e tests were not executed); `<pwa-install>` and runtime DOM sync tests exercised mocked DOM/custom-element harnesses.
- `tests/example-theme.test.mjs:149` fails on base `main` (`b256c49`) due to `@playwright/test` in `examples/example/package.json` vs an expected 3-entry list; kept untouched so base-branch issues are not silently masked.
- Host-owned service-worker registration, canonical identity, and legacy aliases remain preserved.
- Leave merge, publish, release, tag, and deployment decisions to the owner.

---

## Historical handoff (superseded)

# Agent Handoff — audited runtime follow-up fixes

**Date:** 2026-11-16
**Branch:** `arena/a259b4d2-you-ge-assistant`, based on `73a4c61ddb37369aab1baafd1e48c0e74d3d4db1` (`main`).
**Commit / PR:** Implementation is committed on `HEAD`; [PR #48](https://github.com/sandro-defender/you-ge-assistant/pull/48) is open against `main`. No merge, release, publish, tag or deployment has occurred.
**Working tree:** Runtime, focused regressions, synchronized kit declarations and documentation are modified locally. `examples/example/dist` and dependencies are generated/ignored. The host-owned worker contract remains unchanged.
**Versions:** Kit `1.2.4 → 1.2.5`, **authorized by the owner because precached assets changed**; SDK package `@youge/assistant-sdk` remains `0.3.0`. No npm stage/publish or deployment was performed.

## Completed

- **Service-worker navigation boundary:** notification payload, action, fallback and hash navigation targets are resolved only against the registered worker scope and origin. The public `safeNavigationUrl()` helper keeps its broader documented HTTP contract.
- **DNS cancellation:** `window.YouGeDns.check(context, options)` forwards the same run options to the cancellable engine, so caller `AbortSignal` cancellation remains distinct from timeout and connectivity results.
- **Classic PWA controls:** generated close, reload, QR, flow and diagnostics controls use native buttons and explicit button types; labels are text-safe; dialogs restore focus and remove Escape listeners; banners, alerts and toolbox controls have visible focus styling while legacy classes/layout remain intact.
- **Legacy install compatibility:** `data-behavior="disable|hide"`, `data-allow-ios`, `data-allow-samsung`, standalone handling and legacy `.progressier-*` selectors remain enforced.
- `npm run sync:sdk` regenerated `src/assistant/assistant-state.js`; the synchronized kit declarations are `1.2.5` while SDK release version remains `0.3.0`.

## Verification

- `npm run check`: **595 passed / 0 failed**; static contracts and package validation passed.
- `npm run test:sdk`: **135 passed / 0 failed**.
- `examples/example`: `npm run typecheck` and `npm run build` passed; Vite emitted its existing classic-script warnings. The generated `dist` is ignored.
- `node scripts/precache-integrity.mjs`: passed — `3 of 13` precached assets changed (`assistant-state.js`, `dns-diagnostics.js`, `pwa.css`), with kit `1.2.4 → 1.2.5` synchronized.
- `npm pack --dry-run --json`: passed for SDK `0.3.0`; `git diff --check` is clean.

## Limits, risks and exact next action

- No real-browser, physical-device, live DNS/push or deployed-Pages verification was performed in this follow-up.
- Deferred M6/M7 scope, canonical identity, legacy aliases and host-owned service-worker registration were not redesigned.
- Commit the current implementation, push only `arena/a259b4d2-you-ge-assistant`, then request owner review. Do not merge, publish, stage a release, tag or deploy without separate authorization.

---

## Historical handoff (superseded)

# Agent Handoff — premium product website redesign

**Date:** 2026-11-15
**Branch:** `arena/34c9ca4e-you-ge-assistant`, based on `5f87833de5666ddfc42489169481ce1f946f64bc` (see `git merge-base HEAD main` for authoritative base).
**Commit / PR:** Implementation `6d5ee9f`; [PR #46](https://github.com/sandro-defender/you-ge-assistant/pull/46) against main. See `git log -1` for the latest documentation follow-up.
**Working tree:** Implementation committed and pushed; documentation follow-up is part of this commit. Local build/browser tooling is ignored; the final tree should be clean.
**Versions:** SDK 0.3.0 and kit 1.2.3 unchanged. npm registry confirms existing 0.3.0 publication; this task publishes nothing.

## Completed

Premium light-first navy/violet product site at `/example/`, coordinated homepage
at `/`, original modular SVG symbol/favicon and integration artwork, shared
responsive navigation/footer, real SDK state/theme/install demonstrations and
five-step guide. Staff Space and the theme studio are preserved at
`/example/workspace.html` in the same scope. Deployment workflow and runtime
ownership/compatibility contracts are unchanged. No SDK code was duplicated.

Published npm 0.3.0 source is byte-identical to repository SDK src. All displayed
SDK functions typecheck against downloaded declarations and were executed against
the downloaded package; nested module overrides preserve independent flags.
Current installation/migration docs correct stale unpublished banners.

## Verification

`npm run check`: 572/572 tests plus static/package validation. Example clean
install, typecheck/build, Pages assembly, SDK sync, precache gate, syntax loop and
package dry-run pass. All 13 precached assets unchanged. Chromium checks cover all
three routes at 360/390/768/1024/1440px, clipboard, theme, offline/online, install
guidance, widget/menu Escape, and JS-disabled documentation. No page/asset errors
or horizontal overflow; no demo worker registered. axe A/AA reports zero issues
on homepage/guide desktop and mobile, plus workspace mobile. Screenshots and audit:
`docs/design-system/you-ge-assistant/pages/product-website.md` and
`docs/architecture/PAGES_REDESIGN_AUDIT.md`.

## Limits and exact next action

PR #46 is open. Check its latest `static` job with `gh pr checks 46`; GitHub
[CI run 43665433253](https://github.com/sandro-defender/you-ge-assistant/actions/runs/43665433253) passed on `05ee8c9` (all static job steps). This final follow-up only records that result. Review the PR and screenshots. Do not merge/deploy/publish/tag/version-bump. Physical
mobile hardware, other browser engines, real install acceptance, production
Cloudflare DNS/push, and host-owned worker adapters remain separate integration
checks. Seven GitHub URLs returned 200; npm frontend URLs are allowlist-blocked,
while the actual package was verified through the registry. No release or Pages
workflow should be manually dispatched.

---

## Historical handoff (superseded)

# Agent Handoff — PWA management and SDK 0.3.0 preparation

**Date:** 2026-11-15
**Branch:** `arena/9a7feeea-you-ge-assistant`, based on `302c338417ebc1421795c187014413e1f03d85b9`.
**Commit and PR:** PR #44; see `git log -1` and `gh pr view 44` for current commit and CI.
**Working tree:** See `git status`; build outputs and dependencies are ignored.
**Versions:** SDK `0.3.0` and kit `1.2.3`, explicitly authorized; neither is published or deployed by this task.

## Completed

The toolkit never registers, unregisters or replaces a host worker. The host owns registration and scope. A host may explicitly register the optional Assistant worker in a deployment without a competing worker and opt in using `data-assistant-worker`. `PWA.register()` and the legacy alias retry safe attachment, and `PWA.ready` retains the first lookup. Custom workers use the existing SDK PWA adapter; see `docs/architecture/PWA_IMPLEMENTATION_AUDIT.md` for exact migration and ownership constraints. The demo no longer waits indefinitely on `navigator.serviceWorker.ready`.

SDK `modules` now contains independent `installationDetection`, `installationGuidance`, `updateDetection`, `updateNotifications`, `autoUpdate`, `userUpdate`, `offlineDiagnostics` and `cacheDiagnostics`; optional `modules.extensions` carries safe named boolean flags. Existing broad `installation`/`updates` SDK gates remain. Automatic update still requires the existing explicit toolkit opt-in. Offline diagnostics reports only `navigator.onLine`; cache diagnostics checks presence of the exact Assistant cache names, never host cache contents. Browser bundle regenerated with `npm run sync:sdk`; `AGENTS.md` records permanent ownership and feature-control rules.

An administrator runtime example now shows independent disable/re-enable through the existing instance's `configure()`; it merges the current resolved `modules` because configuration overrides are replaced at the top level. It explains server-side authorization and persistence, startup loading, multi-client propagation and already-running effects. A focused SDK test verifies immediate synchronous state/subscriber updates, independent toggles, no instance recreation and no worker registration.

## Verification and limitations

`npm run check`: 564/564; `npm run test:sdk`: 135/135. Build, package validation, browser-bundle sync and precache integrity passed (one precached bundle changed; kit 1.2.2 → 1.2.3). Example `npm ci`, typecheck including the 0.3.0 typed adapter example, and build passed; Vite emits classic-script warnings. Node harnesses cover host workers, no worker, registration retries and controls. No browser executable was found; no real-browser, staff.you.ge, or deployed-worker testing was performed. Cache presence is not cache-content health and may differ when an older worker controls the page. No publish, merge, deploy, tag or release occurred.

## Next action

Review the current PR and CI. Separately verify actual browser and staff.you.ge integration and the host's update adapter before approving publication. Do not merge, publish, release, tag or deploy without explicit authorization.

---

## Historical handoff (superseded)

# Agent Handoff — Diagnostics Phase 2 real-world verification

**Date:** 2026-11-15  
**Branch:** `arena/2914f4d7-you-ge-assistant`, based on `main` at `bb3041ce60952b398110246dc88552d0f28e3a81` (merged PR #42).  
**PR and commit:** See the current branch PR and `git log -1`; this record is part of that commit.  
**Working tree:** see `git status`; no generated build artifacts are tracked.  
**Versions:** kit `1.2.2`, SDK package `0.2.0`, unchanged.

## Outcome

Reviewed the Phase 2 engine, SDK integration and diagnostics tests. No reproducible implementation bug was found in the scenarios below; no production source or regression tests were changed. The browser exercise used a temporary Node HTTP server and headless Chromium driven by Playwright, with browser web security enabled. It called the real `YouGeDns` API and displayed its message in a minimal test page, not the product widget. The server recorded requests. Browser and harness dependencies were installed outside the repository and are not shipped.

- `localhost`, `127.0.0.1`, `[::1]`, and the sandbox's `169.254.0.21` link-local interface: same-origin manifest succeeded, correctly classified localhost/loopback/private and skipped public DoH. The link-local interface is not a separate LAN device or RFC1918 network.
- Root and `/app/` bases and an encoded space were requested at the expected URLs. Encoded `..`, encoded slash and root-relative escape fell back to the in-base manifest; the invalid backend was omitted. Invalid encoded base, mismatched origin and invalid hostname made no requests.
- Same-origin and cross-origin HTTP redirects were rejected, and server logs showed no request to their `/escaped` targets. The cross-origin target was a different loopback origin on the same server.
- Slow response headers timed out. For DNS JSON, the harness rerouted the Cloudflare endpoint to a real local HTTP response: malformed JSON produced `invalid_response`; a body kept open mid-JSON timed out; complete empty answers were parsed. This exercises Chromium fetch and body streaming but does not verify Cloudflare itself.
- A 404 was reported as `http_error`; CSP `connect-src 'none'` blocked a probe with `network_or_cors` and no server request; stopping the server after loading the page produced `network_or_cors`. Messages were returned to the test page. Redirects and blocked connections are intentionally indistinguishable from other network failures in browser Fetch.

## Checks

`npm run build` passed. Example `npm ci`, `npm run typecheck`, and `npm run build` passed (Vite classic-script warnings). `npm run check` passed 545/545 after building the example; the first run had 544/545 because the example dist prerequisite was absent. `npm run check:precache` passed with all 13 precached assets unchanged and kit `1.2.2` synchronized.

## Remaining limitations and next action

Not verified: an actual remote RFC1918 LAN host/device, a live deployment or real Cloudflare DoH (outbound access is restricted), a deployed reverse proxy's decoding/rewrite behavior, product widget rendering, other browsers, TLS/CORS failures against remote servers, or real device DNS behavior. The local server saw URL paths as sent by Chromium, not all possible production server decoding policies. Verify those on the target deployment/network when available; do not imply they passed. Do not merge, deploy, publish, tag, release, bump versions or weaken the precache gate without separate authorization.

---

## Historical handoff (PR #42; superseded by current status above)

# Agent Handoff — Diagnostics Phase 2, Stage 2

**Date:** 2026-11-14
**Branch:** `arena/ca1b6b72-you-ge-assistant`, based on `main` at `9876c267d595c6af54daf3d59c67efca67ca4dcb`.
**PR:** #42, expanded from the assertion fix to include the owner-authorized Stage 2 work; do not merge without approval. See Git history and PR for current commit and CI state.
**Versions:** kit `1.2.2` (owner-authorized synchronized precache bump); SDK package `0.2.0` (unchanged, not published).

## Completed

- Corrected the obsolete identity-migration precache summary assertion. It accepts both an unchanged base and a synchronized `1.2.1 → 1.2.2` update, while retaining the integrity verdict check.
- Diagnostics use URL resolution against a validated, slash-terminated deployment base. Relative probes stay within that base; root-relative paths must already be within it. Cross-origin, traversal, encoded separators, double-encoded percent escapes and malformed paths are rejected. Invalid app paths fall back to the base-relative manifest; invalid backend paths are omitted. Invalid bases cause no requests. Probe redirects fail rather than escaping the base. Classic and SDK domain validators check configured paths against an explicit `pwa.basePath`; runtime also checks the effective base when configuration does not specify one.
- The existing request deadline already covers DoH `response.json()` as well as fetch, aborting on timeout/cancellation and cleaning up timers/listeners. Synchronous JSON exceptions now also classify as `invalid_response`; HTTP, network, timeout and cancellation distinctions remain. Application/backend health probes do not parse JSON.
- Localhost, loopback, private LAN and IP-literal hosts retain same-origin probes and skip public DoH. Noncanonical IPv6 literals are normalized. Ordinary hostnames still use DoH; browser JavaScript cannot determine their actual local resolver results or reliably detect that they resolve to a local address. The configured origin must match the host and, in a browser, the active origin.
- Added path, encoded-segment, invalid-base, redirect policy, JSON stall/abort/error, private-LAN, IPv6 and classic/SDK configuration regressions; adjusted existing identity tests to use in-base probes.

## Verification

Focused identity, diagnostics, classic domain and SDK domain suites: 87/87. `npm test`: 545/545; `npm run check`: passed, 545/545; `npm run test:sdk`: 129/129; `npm run sync:sdk -- --check`, `npm run build`, and `npm run check:precache`: passed. Example build was prepared first (classic-script bundling warnings only). The gate reports three changed precached assets and `1.2.1 → 1.2.2` synchronized. No browser or live deployment verification was performed. Earlier full runs before the example build failed because `examples/example/dist` was missing; reruns after building passed.

## Next action

Review PR #42 and CI; with separate authorization, perform real-browser/local-network verification, especially redirect handling and server treatment of encoded path segments. Do not merge, deploy, publish, release or tag without explicit approval.

---

## Historical handoff (PR #40; superseded by current status above)

# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base:** `main` @ `2e19830` (PR #39 merge)
**Branch:** `arena/bc1478a5-you-ge-assistant` (active)
**PR:** #40 — "CD-1 — Module capability enforcement" (open, **draft**, awaiting
owner review; **do not merge**)
**Working tree:** clean at the branch tip; everything pushed.
**Versions:** kit **`1.2.1`**; `@youge/assistant-sdk` **`0.2.0`** (unchanged).

Permanent development and layout rules live in [`AGENTS.md`](AGENTS.md). The
CD-1 audit, enforcement architecture, activation-path inventory, test matrix and
verification evidence are in
[`docs/architecture/CAPABILITY_ENFORCEMENT.md`](docs/architecture/CAPABILITY_ENFORCEMENT.md).

## CD-1 status: implemented and complete

`modules.diagnostics`, `modules.recovery`, `modules.failover` and `modules.help`
are enforced capabilities rather than advisory UI flags.

**Enforcement architecture**

- `packages/assistant-sdk/src/core/capabilities.js` is the single policy: gated
  names, action/notice → capability map, `isCapabilityEnabled`,
  `capabilityForAction`, `isActionAllowed`, `gateActions`, `gateNotification(s)`,
  `capabilitiesRecord`. It is bundled into the generated `assistant-state.js`
  and exposed as `YouGeAssistantSDK.*` for classic renderers.
- Assistant API boundary: `runDiagnostics()` refuses a disabled capability (no
  runner), `buildActions()` gates built-in **and** project-supplied actions,
  `buildNotifications()` gates notices, `state.capabilities` comes from
  `capabilitiesRecord()`, and `isCapabilityEnabled(name)` is a new read-only
  method.
- Diagnostics adapter takes a live `isEnabled` predicate, re-checks it before the
  runner starts and before publishing, and `configure()` aborts an in-flight run
  when diagnostics is disabled (async/init-order safety).
- Renderers: `assistant-widget.js` and `examples/example/src/main.jsx` render
  and dispatch only through the policy; the widget re-checks at click time.
- Runtime backstop: `pwa.js` (`runNetworkDiagnostics` / `showNetworkDiagnostics`
  / `[data-pwa-diagnostics]`), `dns-diagnostics.js` (the Cloudflare DoH
  transport) and `offline.js` consult
  `window.YouGeAssistant.isCapabilityEnabled('diagnostics')` and make **no**
  request while disabled; they fail open when no Assistant is present.

**Activation paths audited (13):** public SDK API, generated + project actions,
notifications and their action links, DOM/React renderers, delegated toolkit
hooks, `youge:action` / `pwa:diagnostics` / session / endpoint events, toolkits,
DoH engine, offline shell, reconfiguration and in-flight async runs.

**Generated bundle:** `src/assistant/assistant-state.js` is produced only by
`npm run sync:sdk`; `--check` reports in sync.

## Kit version bump (owner-authorized) — applied

CD-1 changes four precached assets, so the diff-aware precache gate required a
synchronized kit bump. The owner authorized `1.2.0 → 1.2.1`, kit only:

| Location | Value |
| --- | --- |
| `src/runtime/you-ge-sw.js` | `const VERSION = '1.2.1'` |
| `src/runtime/pwa.js` | `PWA.version: '1.2.1'` |
| `package.json` | `"version": "1.2.1"` |
| `packages/assistant-sdk/src/core/constants.js` | `KIT_COMPAT_VERSION = '1.2.1'` |
| `src/assistant/assistant-state.js` | regenerated (`npm run sync:sdk`) |
| `packages/assistant-sdk/package.json` | **`0.2.0` — unchanged** |

Gate result:

```
precache integrity: 4 of 13 precached assets changed (assistant-state.js,
assistant-widget.js, dns-diagnostics.js, offline.js) since 2e19830;
kit version 1.2.0 → 1.2.1 synchronized
```

Current-version references updated: `AGENTS.md` (runtime version line, also
asserted by `tests/identity-migration.test.mjs`), worker version + cache names +
gate summary in that same file, kit pin in `tests/example-theme.test.mjs`,
`KIT_COMPAT_VERSION` in `packages/assistant-sdk/tests/sdk-core.test.mjs`, plus
the current-state lines in `PRECACHE_INTEGRITY.md` (§1, §9),
`MULTI_DOMAIN.md`, `COMPATIBILITY_CONTRACTS.md`, `REPOSITORY_STRUCTURE.md`,
SDK `MIGRATION.md`/`RELEASE.md`, and a new `CHANGELOG.md` `1.2.1 (kit)` section.
Historical `1.2.0` records were left intact, and no gate rule was weakened,
skipped or bypassed.

## Verification (2026-11-14, local)

| Check | Result |
| --- | --- |
| `npm test` | **537 pass / 0 fail** |
| `npm run test:sdk` | 128 pass / 0 fail |
| CD-1 suites (`sdk-capabilities`, `capability-enforcement`, `assistant-widget`) | 90 pass / 0 fail |
| `npm run check` | passed (static contracts + package validation + 537 tests) |
| `npm run check:precache` | passed (see gate result above) |
| `npm run sync:sdk -- --check` | in sync |
| `npm run build` | 18 runtime/public files + `icons/` |
| `validate-package.mjs`, `npm pack --dry-run` | passed (`0.2.0`, 24 files, publishing disabled) |
| `examples/example` typecheck + build | passed |
| `git diff --check` | clean |
| `npm run verify` | not run — requires a deployed URL; nothing was deployed |

## Compatibility notes

- Defaults unchanged: omitted/partial/null `modules` → every capability enabled.
- `state.capabilities` shape unchanged; additive API only.
- Opt-out configs only: with an Assistant present and `modules.diagnostics:
  false`, the *toolkit's* on-demand diagnostics also refuse to run
  (`classification: 'disabled'`). Documented in README, WIDGET.md, SDK README.
- Installed apps move to `…:static:v1.2.1` / `…:pages:v1.2.1`; `1.2.0` caches
  retire on activation.

## Not done / deliberately untouched

- No npm publish, no tag, no GitHub release, no deployment, no merge.
- `@youge/assistant-sdk` stays `0.2.0`; publishing remains deferred.
- `npm run verify` (live deployment verification) not performed.
- No other audit item was started.

## Next action

Owner review of PR #40. The implementation is complete and every local gate is
green; the only open items are the owner's merge decision and the separate
SDK release line.
