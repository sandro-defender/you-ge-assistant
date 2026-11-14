# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base branch / commit:** `main` @ `59bcb9a5354c813efe9bdd9fac429643be241730` (PR #24 merged 2026-11-14 02:18:09 UTC)
**Active branch:** `arena/8464c385-you-ge-assistant` (HEAD: `59bcb9a5354c813efe9bdd9fac429643be241730`)

---

## 1. Repository, Branch & CI State

- **Merged Stage 1 identity baseline (PR #24, `arena/8f493271-you-ge-assistant` @ `575430ee227a51f2816e07ff1ff0fcc0f5bb27b0` → `main` @ `59bcb9a5354c813efe9bdd9fac429643be241730`):**
  - Permanent `Repository Development Rules` + `Permanent You.Ge Assistant Identity Rule` in `AGENTS.md`.
  - Stage 1 identity cleanup with zero runtime/contract changes.
- **Current uncommitted working-tree changes on `arena/8464c385-you-ge-assistant` (Phase 2 audit plan + Phase 2 Stage 1):**
  - **Added:**
    - `PHASE2_IMPLEMENTATION_PLAN.md` (diagnostics, DNS recovery, and PWA update audit + 4-stage Phase 2 plan).
    - `packages/assistant-sdk/tests/sdk-declarations.test.mjs` (3 export/interface/README declaration parity tests).
  - **Modified:**
    - `packages/assistant-sdk/src/installation/index.d.ts` (`PwaRuntimeLike.getState().hasUpdate?: boolean`; `applyUpdate?: () => Promise<boolean> | boolean | void`).
    - `packages/assistant-sdk/src/domain/index.d.ts` (`DomainDiagnosticsConfig` interface; `ResolvedDomainConfig.diagnostics?: DomainDiagnosticsConfig`).
    - `packages/assistant-sdk/src/index.d.ts` (`AssistantConfigSummary.themeConfig`, `YouGeAssistantStatic` theme helpers/constants, `DomainDiagnosticsConfig`, `NOTIFICATION_LEVEL_MAP`, `notificationLevel`, and `./theme` notification-level re-exports).
    - `packages/assistant-sdk/README.md` (added `@youge/assistant-sdk/theme` row to Subpath Exports table).
    - `AGENT_HANDOFF.md`, `NEXT_AGENT_PROMPT.md`.
  - **Zero runtime `.js` changes, zero version bumps, zero dependency additions.**
- **Latest CI on `main` @ `59bcb9a5354c813efe9bdd9fac429643be241730`:**
  - `check` (`static`, run `43545812282`): `success`
  - `pages` (`build` & `deploy`, run `43545812299`): `success`
  - Open PRs: none (`gh pr list --state open` empty).

---

## 2. Project Architecture & Diagnostics/Update Audit Summary

- **Classic browser runtime (v`1.1.0`, zero runtime dependencies):**
  - `pwa.js` (`window.PWA`, `window.progressier` shim): installation flows, update detection (`hasUpdate`, `applyUpdate`, `showReloadPrompt`), push/share/QR/banners, and diagnostics modal (`showNetworkDiagnostics`, `runNetworkDiagnostics`, `[data-pwa-diagnostics]`).
  - `progressier.js`: `/progressier.js` service worker with host+scope+version caches, `offline.*` precache fallback, and explicit `SKIP_WAITING` activation.
  - `domain-config.js`, `domain-registry.js`, `manifest-handler.js`, `functions/manifest.webmanifest.js`: multi-domain resolution and host-aware manifest helper.
  - `dns-diagnostics.js` (`window.YouGeDns`): on-demand Cloudflare JSON DoH (`1.1.1.1`) + same-origin app/backend probes with single-flight `inflight` map, `AbortController` timeouts, bounded retries, active-origin verification, and non-authoritative DoH caveats.
  - `assistant-state.js` & `assistant-widget.js`/`.css`: centralized state script (synced from SDK via `scripts/sync-sdk-browser.mjs`) and dependency-free DOM renderer.
- **Extracted ESM SDK (`@youge/assistant-sdk` in `packages/assistant-sdk/`, v`0.2.0` prepared in-repo, v`0.1.1` published on npm):**
  - `.`, `./domain`, `./config`, `./diagnostics`, `./installation`, `./browser`, `./theme`, `./react` (optional `react >= 18` peer).
  - TypeScript declarations and Subpath Exports documentation are now aligned with runtime exports (`Phase 2 — Stage 1`).
- **Remaining Phase 2 audit items (`PHASE2_IMPLEMENTATION_PLAN.md` Stages 2–4):**
  - **Stage 2:** Fix subpath `backendProbePath` resolution in `dns-diagnostics.js`, cover `response.json()` inside `timeoutMs`, handle local/IP-literal hosts (`localhost`, `127.0.0.1`, `[::1]`) cleanly without public DoH noise, and validate `diagnostics` probe paths in `domain/index.js` + `domain-config.js`.
  - **Stage 3:** Dispatch `pwa:diagnostics` on rejection in `pwa.js` `showNetworkDiagnostics()`, surface critical connectivity notice when `!validDns.length && !app.ok && online`, reset `conditions.dns` on project/domain change in `assistant/index.js`, and support optional caller `AbortSignal`.
  - **Stage 4:** Add `AssistantInstance.applyUpdate()` / `requestPwaUpdate()`, route widget/React update actions through it, clear stale `conditions.updateAvailable`, and add behavioral tests for `pwa.js` update/diagnostics flows.

---

## 3. Completed vs. Pending Work

- **Completed:**
  - **Phases 0, 1, 1.5** (PR #6), **SDK extraction & audit fixes** (PRs #7, #8), **Release automation & SDK 0.1.0/0.1.1** (PRs #9–#20; `0.2.0` adaptive theming prepared in-repo, **not staged/published**), **Skills & UI/TDD fixes** (PRs #21, #22), **Phase 1 — Multi-domain intelligence** (PR #23).
  - **Task 1 + Identity Cleanup — Stage 1** (PR #24, merged `59bcb9a`).
  - **Phase 2 Diagnostics/Recovery/Update Audit & Plan** (`PHASE2_IMPLEMENTATION_PLAN.md`).
  - **Phase 2 — Stage 1** (`installation/index.d.ts`, `domain/index.d.ts`, `index.d.ts`, `packages/assistant-sdk/README.md`, `packages/assistant-sdk/tests/sdk-declarations.test.mjs`).
- **Pending:**
  - **Phase 2 — Stage 2 (next task):** Diagnostics probe path safety, subpath resolution, and localhost/IP hardening (`PHASE2_IMPLEMENTATION_PLAN.md` §3 Stage 2).
  - **Phase 2 — Stages 3–4:** Diagnostics state sync/cancellation and unified SW update lifecycle + behavioral tests.
  - **Identity Cleanup — Stage 2 (awaiting explicit owner sign-off):** Retire `reference/` and `PARITY.md`, updating `scripts/check.mjs` `originalReference` assertions.
  - **Roadmap Phases 3–5 & `@youge/assistant-sdk@0.2.0` npm release:** Dashboard foundation, failover pilot, `staff.you.ge` pilot, owner-dispatched release.

---

## 4. Remaining Progressier References (Classified)

1. **Required compatibility contracts (preserved intentionally):** `/progressier.js` worker path, `window.PWA` / `window.progressier`, `.progressier-install-button` / `.progressier-subscribe-button` / `.captured` / `.initialized`, `--progressier*` CSS vars, `progressierinstallbanner` / `progressierpushbanner` cookies, `progressierSavedPushNotifications` / `progressiersharedfiles` IndexedDB stores, `manifest.webmanifest` `id` `/HIPSBNVemXtM8VMwRfWs`, and migration scrubbers/detectors in `pwa.js` / `scripts/check.mjs` / `scripts/verify-deployment.mjs`.
2. **Historical technical records (kept intact):** `CHANGELOG.md`, `FOUNDATION_AUDIT.md`, `ARCHITECTURE_AUDIT.md`, `ASSISTANT_ARCHITECTURE.md`, `INSTALLATION_EXPERIENCE.md`, `DESIGN_FOUNDATION.md`, `ADAPTIVE_THEME_AUDIT.md`, `PHASE1_AUDIT_PLAN.md`, `WIDGET.md`, `INTEGRATION.md`, `packages/assistant-sdk/{RELEASE,MIGRATION,README}.md`, `examples/push-server/README.md`.
3. **Pending Stage 2 cleanup (awaiting owner authorization):** `reference/` and `PARITY.md`, plus `scripts/check.mjs` `originalReference` checks.

---

## 5. Verified Test & Check Results

- **After Phase 2 — Stage 1 edits (`2026-11-14`):**
  - `git diff --check`: **PASS**.
  - `node --test packages/assistant-sdk/tests/sdk-declarations.test.mjs`: **PASS** (**3/3**).
  - `npm run test:sdk`: **PASS** (**96/96**).
  - `node scripts/sync-sdk-browser.mjs --check`: **PASS**.
  - `node packages/assistant-sdk/scripts/validate-package.mjs`: **PASS** (`@youge/assistant-sdk@0.2.0`, 23 packed files, release gates intact).
  - `npm run check`: **PASS** (static contracts, `validate-package.mjs`, **341/341** tests).
- **Not run locally / unavailable:**
  - `tsc --noEmit`: `tsc` not installed globally and `example/node_modules` absent locally.
  - `example/` (`npm ci && npm run typecheck && npm run build`): `example/node_modules` absent locally; passed on `59bcb9a` in CI run `43545812299`.
  - `npm run verify <url>`: requires deployed URL. Lint: none configured.

---

## 6. Exact Next Action

Execute `NEXT_AGENT_PROMPT.md` (**Phase 2 — Stage 2: Diagnostics Probe Path Safety, Subpath Resolution & Localhost/IP Hardening** from `PHASE2_IMPLEMENTATION_PLAN.md`), preserving all existing Stage 1 and documentation work on `arena/8464c385-you-ge-assistant`.
