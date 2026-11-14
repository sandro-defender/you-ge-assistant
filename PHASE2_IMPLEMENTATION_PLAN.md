# Phase 2 — Diagnostics, Recovery & Update Hardening: Audit and Implementation Plan

**Audit date:** 2026-11-14<br />
**Verified baseline:** `main` @ `59bcb9a5354c813efe9bdd9fac429643be241730` (PR #24 merged 2026-11-14)<br />
**Active branch:** `arena/8464c385-you-ge-assistant`<br />
**Scope:** Audit existing diagnostics, DNS recovery, and PWA update behavior in You.Ge Assistant and define small, independently verifiable Phase 2 implementation stages. This is a documentation-only plan; no Phase 2 source changes are included here.

---

## 1. Audit Scope & Inspected Sources

- Architecture & recovery docs: `ASSISTANT_ARCHITECTURE.md` (§5, §6, §8, §9, §9.6, §12), `DNS_RECOVERY.md`, `PHASE1_AUDIT_PLAN.md`, `AGENTS.md`.
- Classic runtime & offline shell: `dns-diagnostics.js`, `pwa.js`, `progressier.js`, `domain-config.js`, `offline.html`, `offline.js`, `assistant-widget.js`.
- `@youge/assistant-sdk` (`0.2.0` in-repo): `src/index.{js,d.ts}`, `src/core/constants.js`, `src/config/index.js`, `src/domain/index.{js,d.ts}`, `src/diagnostics/index.{js,d.ts}`, `src/installation/index.{js,d.ts}`, `src/assistant/index.js`, `src/browser/index.js`, `src/theme/index.d.ts`, `src/adapters/{pwa-kit,react}.js`, `README.md`.
- Example & tests: `example/src/main.jsx`, `tests/dns-diagnostics.test.mjs`, `tests/sdk-integration.test.mjs`, `tests/assistant-widget.test.mjs`, `tests/foundation-contracts.test.mjs`, `packages/assistant-sdk/tests/sdk-integrations.test.mjs`, `scripts/check.mjs`.

---

## 2. Current-State Audit Findings

### 2.1 Already Implemented and Verified

1. **On-demand Cloudflare DoH + same-origin probe engine (`dns-diagnostics.js` / `window.YouGeDns`):**
   - Queries `https://cloudflare-dns.com/dns-query` (`Accept: application/dns-json`, `mode: 'cors'`, `credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`) for `A` and `AAAA` records of the current hostname only.
   - Issues a same-origin, credential-free, `no-store` probe to `manifest.webmanifest` (or `appProbePath`) and an optional same-origin `backendProbePath`.
   - Enforces `AbortController` per-request timeouts (default 5000 ms, capped at 15000 ms) and bounded retries (default 1, capped at 2) for `timeout`, `network_or_cors`, and `HTTP >= 500`.
   - Validates host syntax (`HOST_PATTERN`), enforces `origin` hostname match and active `root.location` origin match before issuing any network request, and rejects cross-origin probe URLs.
   - Deduplicates concurrent checks via an `inflight` `Map` keyed by host, origin, base path, probe URLs, online flag, timeout, retries, and `fetch`/`AbortController` identity.
   - Classifies results cautiously (`normal_connectivity`, `dns_resolution_failure`, `dns_records_missing`, `cloudflare_doh_unavailable`, `application_host_unavailable`, `backend_unavailable`, `general_internet_failure`, `possible_dns_interference`, `inconclusive`, `unknown`) and always attaches the non-authoritative DoH caveat (`JavaScript cannot inspect your device’s normal DNS resolver...`).
2. **Classic toolkit & offline shell integration (`pwa.js`, `offline.html`, `offline.js`, `progressier.js`):**
   - `pwa.js` exposes `PWA.runNetworkDiagnostics(options)` and `PWA.showNetworkDiagnostics()`, handles `[data-pwa-diagnostics]` clicks, respects `features.diagnostics` and `features.dnsRecovery`, prevents double clicks inside the modal via a local `running` flag, and dispatches `pwa:diagnostics` on completion.
   - `offline.html` + `offline.js` are precached by `/progressier.js`, work without application authentication, show current hostname and online/offline live status, include Android (`one.one.one.one`) and iOS (`1.1.1.1` DNS-only) recovery guides, and dispatch `youge:dns-result` on completion or failure.
3. **SDK diagnostics integration & state (`packages/assistant-sdk/src/diagnostics/index.js`, `assistant/index.js`):**
   - `createDiagnosticsIntegration` resolves `services.diagnostics` → `PWA.runNetworkDiagnostics` → `YouGeDns.check`, deduplicates concurrent `assistant.runDiagnostics()` calls with a shared `inFlight` promise, and emits `status: 'running'` → normalized `DnsDiagnosticSnapshot` without making `fetch` calls or polling from SDK core.
   - `dnsFailure()` and `connectivityFailure()` drive priority-1 critical notices (`dns:failure`, `network:unreachable`, `network:offline`) and priority-1 `recovery` actions.
   - `assistant-widget.js` and `example/src/main.jsx` delegate `[data-pwa-diagnostics]` to `pwa.js` when present and fall back to `assistant.runDiagnostics()` on pages without `pwa.js` (e.g., `offline.html`).
4. **PWA / Service Worker update detection (`progressier.js`, `pwa.js`, `assistant/index.js`):**
   - `/progressier.js` intentionally avoids automatic `self.skipWaiting()` on `install` and activates waiting workers only on `{ type: 'SKIP_WAITING' }` `postMessage`.
   - `pwa.js` detects pre-existing `reg.waiting && navigator.serviceWorker.controller` and `updatefound` (`worker.state === 'installed'`), emits `PWA.onChange`, dispatches `pwa:update`, optionally calls `showReloadPrompt()` when `!config.autoUpdate`, checks `registration.update()` on `visibilitychange` (throttled to 1 hour), and runs `applyUpdate()` with `SKIP_WAITING` + `controllerchange` reload + 3000 ms fallback timer.
   - `assistant/index.js` seeds `network.updateAvailable` from both `pwa:update` events and `readPwaSnapshot(pwa).hasUpdate === true`, raising priority-5 `app:update` and action `update`.
5. **Android in-app browser Chrome handoff (`packages/assistant-sdk/src/browser/index.js`):**
   - Separate from DNS diagnostics; verified for Android-restricted in-app UAs only with manual fallback instructions and zero automatic redirects.

### 2.2 Partially Implemented

1. **SDK TypeScript & README alignment for existing Phase 1 / 0.2.0 / update features:**
   - `AssistantConfigSummary` in `src/index.d.ts` omits `themeConfig: NormalizedTheme` (returned by `getConfig()`).
   - `YouGeAssistantStatic` in `src/index.d.ts` omits `normalizeTheme`, `resolveTheme`, `THEME_MODES`, and `THEME_TOKEN_KEYS` (exposed on `YouGeAssistant` in `src/index.js`).
   - `src/index.d.ts` does not re-export `notificationLevel` / `NOTIFICATION_LEVEL_MAP` and the `NOTIFICATION_LEVEL_*` runtime helpers already exported by `src/index.js`.
   - `PwaRuntimeLike.getState()` in `src/installation/index.d.ts` omits `hasUpdate?: boolean` (read by `assistant/index.js`), and `applyUpdate` is typed as `() => void` rather than `() => Promise<boolean> | boolean | void`.
   - `ResolvedDomainConfig` in `src/domain/index.d.ts` omits `diagnostics?: { appProbePath?: string; backendProbePath?: string }` even though `DomainRegistryEntry` defines it and `resolveDomain()` returns it.
   - `packages/assistant-sdk/README.md` Subpath Exports table omits `@youge/assistant-sdk/theme`.
2. **Update action delegation through `AssistantInstance`:**
   - `assistant.requestInstall()` and `assistant.runDiagnostics()` live on `AssistantInstance`, whereas `update` actions in `assistant-widget.js` and `adapters/react.js` (`dispatchAssistantAction`) still call `window.PWA.applyUpdate()` directly without going through an SDK method or inspecting the returned `Promise<boolean>`.
3. **Domain registry `diagnostics` field validation:**
   - `domain-config.js` and `packages/assistant-sdk/src/domain/index.js` pass `diagnostics` through untouched; neither `validateDomainConfig()` nor `validateDomainConfigDetailed()` validates `diagnostics.appProbePath` / `diagnostics.backendProbePath` as safe same-origin/relative paths.
4. **Tests for `pwa.js` diagnostics modal & update lifecycle:**
   - `tests/dns-diagnostics.test.mjs`, `tests/sdk-integration.test.mjs`, `tests/assistant-widget.test.mjs`, and `packages/assistant-sdk/tests/sdk-integrations.test.mjs` cover `YouGeDns.check`, `createDiagnosticsIntegration`, `pwa:diagnostics` / `youge:dns-result` events, and `hasUpdate` seeding.
   - Direct behavioral tests for `pwa.js` `showNetworkDiagnostics()`, `reg.waiting` / `updatefound` → `applyUpdate()` (`SKIP_WAITING` + `controllerchange`), and `visibilitychange` throttling are still missing.

### 2.3 Missing

1. **Localhost / IP-literal awareness in `dns-diagnostics.js`:**
   - `127.0.0.1` matches `HOST_PATTERN`, causing `YouGeDns.check` to query Cloudflare DoH for `name=127.0.0.1` (yielding `NXDOMAIN` → `'inconclusive'` when `app.ok` is true). IPv6 `[::1]` fails `HOST_PATTERN` outright before probing the app origin. `localhost` likewise produces public-DoH `NXDOMAIN` noise even when the local server responds.
2. **External cancellation (`AbortSignal`) and state reset on domain/project change:**
   - `dns-diagnostics.js` has no caller-supplied `AbortSignal` support; `assistant/index.js` does not clear stale `conditions.dns` when `configure()` switches `project.id` or `domain`.
3. **SDK `applyUpdate()` / `requestUpdate()` surface:**
   - No `applyUpdate()` method exists on `AssistantInstance` or `packages/assistant-sdk/src/installation/index.js` to encapsulate `PWA.applyUpdate()` and update-state reconciliation.

### 2.4 Potential Defects and Risks

1. **Subpath `backendProbePath` resolution bug (`dns-diagnostics.js:128-137`):**
   - `appProbeUrl` resolves against `new URL(basePath, origin)` (subpath-safe), whereas `backendProbeUrl` resolves against `origin` (`new URL(context.backendProbePath, origin)`). On a subpath deployment (e.g., `/app/`), a relative `backendProbePath: 'health'` probes `/health` instead of `/app/health`.
2. **Unbounded `response.json()` parse in `dns-diagnostics.js` (`timeoutRequest` vs `query`):**
   - `timeoutRequest` races `fetchImpl()` against `timeoutMs`, then clears the timer before `response.json()` runs. A stalled response body stream after headers arrive is not covered by `timeoutMs`.
3. **`pwa.js` diagnostics modal state sync on failure & running state (`pwa.js:2456-2475`):**
   - When `showNetworkDiagnostics()` runs, `pwa.js` does not notify `YouGeAssistant` that a check started (`running`), and on promise rejection it does not dispatch `pwa:diagnostics` (unlike `offline.js`), leaving Assistant state unaware of failed modal runs.
4. **Sticky `conditions.updateAvailable` (`assistant/index.js:486, 676`):**
   - `updateAvailable: conditions.updateAvailable || pwaSnapshot.hasUpdate === true` stays `true` once `pwa:update` fires unless `assistant.setUpdateAvailable(false)` is called explicitly.
5. **Unclassified total failure when DoH and app probe both fail online (`dns-diagnostics.js:186-191`):**
   - When `!validDns.length && !app.ok && online`, `dns-diagnostics.js` returns `classification: 'unknown'`, which `connectivityFailure()` in `diagnostics/index.js` treats as `false` (no critical `network:unreachable` notice raised even though the app probe failed while `navigator.onLine` was `true`).
6. **Documented / intentional limitations (preserve & keep honest):**
   - Browser JS cannot inspect OS/ISP DNS settings; Cloudflare DoH cannot prove DNS blocking.
   - `pwa.js` is intentionally excluded from `/progressier.js` precaching (`progressier.js:383`), so pages without `pwa.js` loaded before going offline rely on `offline.html` + `offline.js` + `dns-diagnostics.js`.
   - `showNetworkDiagnostics()` delegates inline recovery links (`developers.cloudflare.com`, Play Store, App Store) which require internet when clicked; offline users rely on the embedded plain-text instructions in `offline.html` and `pwa.js`.

### 2.5 Behavior That Must Remain Backward-Compatible

- Globals and entry points: `window.PWA` (`__pwaKit`), `window.progressier` shim, `window.YouGeDns`, `window.YouGeDomain`, `window.YouGeAssistant`, `window.YouGeAssistantSDK`.
- Service worker path & update model: `/progressier.js`, `SKIP_WAITING` message contract, host+scope+version caches, and no automatic `skipWaiting()` on `install`.
- Legacy compatibility contracts: `.progressier-*` selectors/classes, `--progressier*` CSS variables, cookies/IndexedDB stores, `manifest.webmanifest` `id: "/HIPSBNVemXtM8VMwRfWs"`, and `assistant-state.js` determinism (`npm run sync:sdk` / `--check`).
- SDK core invariants: zero runtime dependencies, no `fetch()`, no `serviceWorker.register()`, no `setInterval()`, no React runtime import, and no hardcoded `staff.you.ge` or `workers.dev` URLs in `packages/assistant-sdk/src/`.
- DoH privacy/security rules: `credentials: 'omit'`, `cache: 'no-store'`, `referrerPolicy: 'no-referrer'`, active-origin validation, same-origin probe enforcement, and manual-only execution (no background probing).

---

## 3. Staged Phase 2 Implementation Plan

Each stage below is scoped as **one small, independently reviewable PR/task** with explicit verification gates. Complete them sequentially or only as authorized.

### Stage 1 — SDK TypeScript Contracts & Subpath Documentation Alignment

- **Objective:** Eliminate verified drift between runtime exports (`src/index.js`, `assistant/index.js`, `domain/index.js`, `pwa.js`) and `.d.ts` / package documentation with zero runtime code changes.
- **Relevant files:**
  - `packages/assistant-sdk/src/installation/index.d.ts`
  - `packages/assistant-sdk/src/domain/index.d.ts`
  - `packages/assistant-sdk/src/index.d.ts`
  - `packages/assistant-sdk/README.md`
- **Dependencies / prerequisites:** Verified baseline `59bcb9a`.
- **Expected behavior / changes:**
  1. Add `hasUpdate?: boolean` to `PwaRuntimeLike.getState()` and allow `Promise<boolean> | boolean | void` on `PwaRuntimeLike.applyUpdate()` in `src/installation/index.d.ts`.
  2. Add optional `diagnostics?: { appProbePath?: string; backendProbePath?: string }` to `ResolvedDomainConfig` in `src/domain/index.d.ts`.
  3. Add `themeConfig: NormalizedTheme` to `AssistantConfigSummary` and `normalizeTheme`, `resolveTheme`, `THEME_MODES`, `THEME_TOKEN_KEYS` to `YouGeAssistantStatic` in `src/index.d.ts`; re-export `notificationLevel`, `NOTIFICATION_LEVEL_MAP`, `NOTIFICATION_LEVELS`, `NOTIFICATION_LEVEL_ICONS`, `NOTIFICATION_LEVEL_LABELS`, `NOTIFICATION_LEVEL_SHAPES`, `NOTIFICATION_LEVEL_SVG_ATTRIBUTES`, `notificationLevelMarkup`, and `normalizeNotificationLevel` in `src/index.d.ts` to match `src/index.js`.
  4. Document `@youge/assistant-sdk/theme` in the Subpath Exports table in `packages/assistant-sdk/README.md`.
- **Tests & acceptance criteria:**
  - Add/extend declaration usage assertions (e.g., TypeScript check when `tsc` is available via `example/node_modules` or structural export-parity test in `packages/assistant-sdk/tests/` verifying `src/index.d.ts` declares every runtime export of `src/index.js`).
  - `npm run check`, `node packages/assistant-sdk/scripts/validate-package.mjs`, `node scripts/sync-sdk-browser.mjs --check`, and `git diff --check` pass.
- **Compatibility & security:** Additive types/docs only; no runtime, version, or bundle-size changes.
- **Exclusions:** No runtime `.js` modifications, no `assistant-state.js` behavior changes, no version bump or npm publish.

### Stage 2 — Diagnostics Probe Path Safety, Subpath Resolution & Localhost/IP Hardening

- **Objective:** Fix subpath `backendProbePath` resolution, validate `diagnostics` registry probe paths, handle local/IP dev hosts cleanly, and enforce timeouts across JSON body parsing.
- **Relevant files:**
  - `dns-diagnostics.js`
  - `packages/assistant-sdk/src/domain/index.js`
  - `domain-config.js`
  - `tests/dns-diagnostics.test.mjs`, `packages/assistant-sdk/tests/sdk-domain.test.mjs`, `tests/domain-config.test.mjs`, `tests/sdk-integration.test.mjs`
  - `assistant-state.js` (regenerated via `npm run sync:sdk` if `domain/index.js` changes)
- **Dependencies / prerequisites:** Stage 1 (or independent on `59bcb9a` if scoped separately).
- **Expected behavior / changes:**
  1. In `dns-diagnostics.js`, resolve relative `backendProbePath` against `new URL(basePath, origin)` (consistent with `appProbePath`, while `/path` still resolves against `origin` root), preserving strict same-origin validation.
  2. In `dns-diagnostics.js`, wrap `response.json()` inside the active `timeoutMs` timer/controller scope so stalled response bodies time out cleanly as `'timeout'`.
  3. In `dns-diagnostics.js`, detect local loopback / IP-literal hosts (`localhost`, `*.localhost`, IPv4, bracketed IPv6): skip meaningless Cloudflare DoH queries for non-public/literal addresses, probe the same-origin app/backend normally, and classify clearly (`normal_connectivity` or `application_host_unavailable` / local-host note without false `NXDOMAIN` `'inconclusive'` noise).
  4. In `packages/assistant-sdk/src/domain/index.js` and `domain-config.js`, sanitize and validate `diagnostics.appProbePath` and `diagnostics.backendProbePath` (must be relative/root-relative safe paths, no cross-origin/protocol/backslash/`..` traversal), emitting `invalid_diagnostics_probe` issues in `validateDomainConfigDetailed()` while falling back safely in `validateDomainConfig()`.
- **Tests & acceptance criteria:**
  - `tests/dns-diagnostics.test.mjs`: subpath `backendProbePath` (`health` under `/app/`), hung `response.json()` timeout, `127.0.0.1` / `[::1]` / `localhost` handling (0 DoH requests, same-origin probe succeeds/fails accurately).
  - `sdk-domain.test.mjs` & `domain-config.test.mjs` & `sdk-integration.test.mjs`: invalid `diagnostics` probe rejection parity between ESM SDK and classic `domain-config.js`.
  - `npm run check`, `node scripts/sync-sdk-browser.mjs --check`, `git diff --check` pass.
- **Compatibility & security:** Preserves `YouGeDns.create` / `YouGeDns.check` signatures, DoH headers/privacy options, and active-origin enforcement.
- **Exclusions:** No background polling, no new endpoints, no `pwa.js` UI changes.

### Stage 3 — Diagnostics State Synchronization, Online-Failure Classification & Cancellation Hygiene

- **Objective:** Keep `YouGeAssistant` state synchronized with `pwa.js` diagnostics modal runs, handle total online failure (`!dohAvailable && !app.ok && online`) cleanly, reset stale DNS state on project/domain reconfiguration, and support optional cancellation signals.
- **Relevant files:**
  - `pwa.js` (only `showNetworkDiagnostics` event dispatch)
  - `packages/assistant-sdk/src/diagnostics/index.{js,d.ts}`
  - `packages/assistant-sdk/src/assistant/index.js`
  - `assistant-state.js` (regenerated via `npm run sync:sdk`)
  - `tests/assistant-widget.test.mjs`, `tests/sdk-integration.test.mjs`, `packages/assistant-sdk/tests/sdk-integrations.test.mjs`
- **Dependencies / prerequisites:** Stage 2 recommended (independent if needed).
- **Expected behavior / changes:**
  1. In `pwa.js` `showNetworkDiagnostics()`, dispatch `pwa:diagnostics` on rejection as well as resolution (matching `offline.js` behavior) so `YouGeAssistant` never misses a failed modal check.
  2. In `dns-diagnostics.js` / `diagnostics/index.js`, evaluate `online && !validDns.length && !app.ok`: surface `failed: true` (or classify as `application_host_unavailable` / connectivity failure) so `connectivityFailure()` raises a critical `network:unreachable` notice rather than silent `'unknown'`.
  3. In `assistant/index.js`, reset `conditions.dns` back to `'idle'`/`'unknown'` when `configure()` changes `project.id` or resolved hostname, and clear `diagnosticsController` on `destroy()`.
  4. Support optional `signal` (`AbortSignal`) in `dns-diagnostics.js` `options` (without sharing an aborted signal across unrelated callers in `inflight`: bypass or isolate caller-aborted calls cleanly).
- **Tests & acceptance criteria:**
  - Unit tests covering `pwa:diagnostics` failure dispatch, `connectivityFailure` when both DoH and app fail while `online: true`, DNS state reset across `configure({ projectId })`, and `AbortSignal` cancellation without poisoning subsequent retries.
  - `npm run check` and `node scripts/sync-sdk-browser.mjs --check` pass.
- **Compatibility & security:** Preserves `DnsDiagnosticSnapshot` required fields, single-flight deduplication for uncancelled calls, and zero `fetch`/polling in SDK core.
- **Exclusions:** No UI redesign of `pwa-network-diagnostics` or `assistant-widget.js`, no automatic retry loops on user-cancelled calls.

### Stage 4 — Unified Service Worker Update Lifecycle & Behavioral Tests

- **Objective:** Expose explicit update application through `@youge/assistant-sdk` (`AssistantInstance.applyUpdate()`), keep `conditions.updateAvailable` accurate after update attempts, and add deterministic behavioral tests for `pwa.js` update/diagnostics flows.
- **Relevant files:**
  - `packages/assistant-sdk/src/installation/index.{js,d.ts}`
  - `packages/assistant-sdk/src/assistant/index.js`
  - `packages/assistant-sdk/src/index.d.ts`
  - `packages/assistant-sdk/src/adapters/react.js`
  - `assistant-widget.js`
  - `assistant-state.js` (regenerated via `npm run sync:sdk`)
  - `tests/install-experience.test.mjs` (or a focused `tests/pwa-updates.test.mjs`), `tests/assistant-widget.test.mjs`, `packages/assistant-sdk/tests/sdk-integrations.test.mjs`
- **Dependencies / prerequisites:** Stage 1 (types) & Stage 3 (clean `assistant/index.js` baseline).
- **Expected behavior / changes:**
  1. Add `requestPwaUpdate(options)` in `src/installation/index.js` and `assistant.applyUpdate()` on `AssistantInstance` (guarded by `config.modules.updates !== false`, delegating to `PWA.applyUpdate()`, returning `{ applied: boolean, outcome: 'applied' | 'no-waiting-worker' | 'unsupported' | 'disabled' | 'error' }`).
  2. If `PWA.applyUpdate()` resolves `false` and `readPwaSnapshot(pwa).hasUpdate` is `false`, clear `conditions.updateAvailable` and emit an updated snapshot so stale `app:update` notices do not persist.
  3. Update `assistant-widget.js` and `adapters/react.js` (`dispatchAssistantAction`) to call `assistant.applyUpdate()` when available (falling back to `PWA.applyUpdate()` when only a bare `PWA` mock exists).
  4. Add deterministic VM/mocked ServiceWorker tests verifying `pwa.js` `reg.waiting` detection, `updatefound` → `installed` → `pwa:update`, `applyUpdate()` posting `{ type: 'SKIP_WAITING' }` to the waiting worker, `controllerchange` reload trigger, and `showNetworkDiagnostics()` dialog lifecycle.
- **Tests & acceptance criteria:**
  - All new update and modal behavioral tests pass under `node --test`.
  - Existing `assistant-widget.test.mjs` update tests and `sdk-integrations.test.mjs` `hasUpdate` snapshot tests continue to pass without weakening assertions.
  - `npm run check`, `node packages/assistant-sdk/scripts/validate-package.mjs`, `node scripts/sync-sdk-browser.mjs --check`, and `git diff --check` pass.
- **Compatibility & security:** Preserves `/progressier.js` path, manual `SKIP_WAITING` policy, `window.PWA.applyUpdate()`, `window.PWA.hasUpdate()`, and `config.autoUpdate`.
- **Exclusions:** No changes to `/progressier.js` precache policy, no background SW update polling beyond existing `visibilitychange` 1-hour check, no package version bump or npm publish.

---

## 4. Explicit Non-Goals & Deferred Work

- **Phase 3 (Dashboard foundation):** Project/domain registration UI, admin auth, and remote config publishing are out of scope.
- **Phase 4 (Resilience / failover pilot):** Automatic primary/backup endpoint switching, active endpoint probing, and write-replay guards remain deferred until `staff.you.ge` API/auth inspection.
- **Phase 5 (`staff.you.ge` integration):** Zero `staff.you.ge` or `workers.dev` URLs or app-specific logic in reusable runtime/SDK code.
- **Identity Cleanup — Stage 2 (separate owner-approved task):** Retirement of `reference/` and `PARITY.md` (and updating `scripts/check.mjs` `originalReference` checks) is explicitly excluded from Phase 2.
- **Release / publish:** `@youge/assistant-sdk@0.2.0` stays unreleased until authorized separately via `sdk-release-prep.yml`.
