# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base branch / commit:** `main` @ `829449057bc63d2b09aa4470da44df03482b3c57` (PR #23 merged 2026-11-12)
**Active branch:** `arena/8f493271-you-ge-assistant`

---

## 1. Repository, Branch & CI State

- **Branch changes (Task 1 + Stage 1 identity cleanup + handoff docs):**
  - Updated:
    - `AGENTS.md` (added `Repository Development Rules — Coding Agents and Contributors` + `Permanent You.Ge Assistant Identity Rule`; reframed §1–§16 around You.Ge Assistant with legacy contracts isolated in §6.1 / §9 / §10).
    - `README.md` (reframed as standalone **You.Ge Assistant** + `@youge/assistant-sdk`; removed Progressier-clone/reimplementation framing and inaccurate icon attribution; linked `INTEGRATION.md` for migrations).
    - `package.json` (replaced `"progressier"` keyword with `"assistant"`; kept `"version": "1.1.0"` and `"private": true`).
    - `example/README.md` (removed stale `ogl` / `ElectricLogo` description).
    - `demo/index.html` (removed `PARITY.md` nav link; updated CSS comment & welcome bullet wording; kept `.progressier-install-button` compatibility test).
    - `pwa.js`, `pwa.css`, `progressier.js`, `packages/assistant-sdk/src/adapters/pwa-kit.js` (header/comment rewording only; zero runtime code changes).
  - Added:
    - `AGENT_HANDOFF.md`
    - `NEXT_AGENT_PROMPT.md`
- **Latest CI on base commit `829449057bc63d2b09aa4470da44df03482b3c57`:**
  - `check` (run `43156572197`): `success`
  - `pages` (run `43156572271`): `success`

---

## 2. Project Architecture Summary

- **Classic browser runtime (v`1.1.0`, zero runtime dependencies):**
  - `pwa.js` (`window.PWA`, `window.progressier` shim): installation flows, update detection (`hasUpdate`, `applyUpdate`), push/share/QR/banners, delegates diagnostics to `window.YouGeDns`.
  - `progressier.js`: `/progressier.js` service worker with host+scope+version caches and `offline.*` fallback.
  - `domain-config.js`, `domain-registry.js`, `manifest-handler.js`, `functions/manifest.webmanifest.js`: multi-domain resolution and host-aware manifest helper.
  - `dns-diagnostics.js` (`window.YouGeDns`): on-demand Cloudflare DoH (`1.1.1.1`) + same-origin probe diagnostics with single-flight `inflight` map and `AbortController` timeouts.
  - `assistant-state.js` & `assistant-widget.js`/`.css`: centralized state script (synced from SDK via `scripts/sync-sdk-browser.mjs`) and dependency-free DOM renderer.
- **Extracted ESM SDK (`@youge/assistant-sdk` in `packages/assistant-sdk/`, v`0.2.0` prepared in-repo, v`0.1.1` published on npm):**
  - `.`: `YouGeAssistant`, `createAssistant`, `attachAssistant`, `getGlobalAssistant`, `bridgePwaGlobals`, `readToolkitSummary`, and re-exports (`SDK_VERSION = '0.2.0'`, `KIT_COMPAT_VERSION = '1.1.0'`, `SCHEMA_VERSION = 1`).
  - `./domain`: URL/host/port/IPv4/IPv6 detection, deterministic registry resolution, typed `ProjectConfig`, detailed validation (`validateDomainConfigDetailed`, `validateDomainRegistry`), manifest generation.
  - `./config`: layered data-only config pipeline (`BUNDLED_DEFAULTS` → validated `publishedConfig` → explicit overrides) and project-scoped Last-Known-Good (`youge-assistant:lkg:<projectId>`).
  - `./diagnostics`: single-flight delegation adapter (`createDiagnosticsIntegration`, `resolveDiagnosticsRunner`, `dnsFailure`, `connectivityFailure`, `normalizeDnsResult`). No `fetch` or polling.
  - `./installation`: `readPwaSnapshot`, `deriveInstallationState`, `requestPwaInstall`.
  - `./browser`: Android in-app browser detection (`detectInAppBrowser`) and best-effort Chrome `intent://` handoff (`buildChromeIntentUrl`, `createChromeHandoff`).
  - `./theme`: `auto`/`light`/`dark`/`custom` modes, optional `inheritHost` with contrast guards, CSS variables, 5-tier notification levels.
  - `./react`: optional `useSyncExternalStore` adapter (`react >= 18` optional peer).

---

## 3. Completed vs. Pending Work

- **Completed:**
  - **Phases 0, 1, 1.5** (PR #6): foundation audit, frozen install contract, Intelligent Floating Assistant.
  - **SDK extraction & audit fixes** (PRs #7, #8): `@youge/assistant-sdk` extracted; single-flight diagnostics promise identity and waiting SW `hasUpdate` snapshot seeding fixed and covered by tests.
  - **Release automation & SDK versions** (PRs #9–#20): OIDC Trusted Publishing (`sdk-release-prep.yml`), `0.1.0` & `0.1.1` published on npm (`RELEASE.md`), `0.2.0` adaptive theming prepared in-repo (**not staged/published**), static circular panel/launcher logo.
  - **Skills & quality fixes** (PRs #21, #22): `.agents/skills/{mobile-native,break-ui,tdd}` installed; UI/TDD fixes.
  - **Phase 1 — Multi-domain intelligence** (PR #23, `PHASE1_AUDIT_PLAN.md`, merged `8294490`).
  - **Task 1 — Permanent coding-agent rules** (`AGENTS.md`, `AGENT_HANDOFF.md`, `NEXT_AGENT_PROMPT.md`).
  - **Identity Cleanup — Stage 1** (current working tree): permanent identity rule added to `AGENTS.md`; obsolete Progressier product framing, `package.json` keyword, stale `ogl`/`ElectricLogo` text in `example/README.md`, `demo/index.html` `PARITY.md` nav link, and legacy header comments cleaned up with zero runtime/contract changes.
- **Pending:**
  - **Next small task:** Audit existing diagnostics and author `PHASE2_IMPLEMENTATION_PLAN.md` (plan only; do not implement Phase 2 yet).
  - **Identity Cleanup — Stage 2 (awaiting owner sign-off):** Retire `reference/` (~500 KB third-party bundle + decompilation) and `PARITY.md`, updating `scripts/check.mjs` (lines 9–10, 100–101, 117–120, 233, 336) to replace `originalReference` checks with standalone toolbox assertions.
  - **Phase 2 implementation:** Scoped stages from `PHASE2_IMPLEMENTATION_PLAN.md` once approved.
  - **Roadmap Phases 3–5 & `@youge/assistant-sdk@0.2.0` npm release:** Dashboard foundation, failover pilot, `staff.you.ge` pilot, owner-dispatched release.

---

## 4. Remaining Progressier References (Classified)

1. **Required compatibility contracts (preserved intentionally):**
   - `/progressier.js` worker path (`progressier.js`, `data-sw`, `snippet.html`, `.github/workflows/pages.yml`, `.github/workflows/check.yml`).
   - `window.PWA`, `window.progressier` shim, `bridgePwaGlobals` (`pwa.js`, `packages/assistant-sdk/src/adapters/pwa-kit.js`).
   - CSS/HTML contracts: `.progressier-install-button`, `.progressier-subscribe-button`, `.captured`, `.initialized`, `--progressier*` CSS variables (`pwa.css`, `pwa.js`, `demo/index.html`, `example/example.css`).
   - Storage & manifest continuity: `progressierinstallbanner`, `progressierpushbanner`, `progressierSavedPushNotifications`, `progressiersharedfiles`, `pwakit`, `manifest.webmanifest` `id` `/HIPSBNVemXtM8VMwRfWs`, `protocol_handlers` (`web+pwa`, `web+loldwyhv`).
   - Migration safeguards: `pwa.js` leftover `progressier.app`/`progressier.com` manifest link scrubber; `scripts/check.mjs` & `scripts/verify-deployment.mjs` leftover detectors.
2. **Historical technical records (kept intact):**
   - `CHANGELOG.md`, `FOUNDATION_AUDIT.md`, `ARCHITECTURE_AUDIT.md`, `ASSISTANT_ARCHITECTURE.md`, `INSTALLATION_EXPERIENCE.md`, `DESIGN_FOUNDATION.md`, `ADAPTIVE_THEME_AUDIT.md`, `PHASE1_AUDIT_PLAN.md`, `WIDGET.md`, `packages/assistant-sdk/RELEASE.md`.
   - `INTEGRATION.md`, `packages/assistant-sdk/MIGRATION.md`, `packages/assistant-sdk/README.md`, `examples/push-server/README.md` (technical migration/SW filename notes).
3. **Pending Stage 2 cleanup (awaiting owner authorization):**
   - `reference/` (`Script.js`, `Script.decompiled.js`, `progressier.json`, `progressier.decompiled.json`, `reference/README.md`) and `PARITY.md`, plus `scripts/check.mjs` references to `reference/`.
   - Note: `packages/assistant-sdk/tests/sdk-theme.test.mjs`, `tests/*.test.mjs`, and `scripts/check.mjs` assertions referencing legacy compatibility contracts remain intentionally in place.

---

## 5. Verified Test & Check Results

- **After Stage 1 edits (`2026-11-14`):**
  - `git diff --check`: **PASS**.
  - `node scripts/sync-sdk-browser.mjs --check`: **PASS**.
  - `npm run check`: **PASS** (static contracts, `validate-package.mjs`, **338/338** tests).
  - `node packages/assistant-sdk/scripts/validate-package.mjs`: **PASS** (`@youge/assistant-sdk@0.2.0`, 23 packed files, release gates intact).
- **Not run locally / unavailable:**
  - `example/` (`npm ci && npm run typecheck && npm run build`): `example/node_modules` absent locally; verified green in CI run `43156572197` on `8294490`.
  - `npm run verify <url>`: requires deployed URL. Lint: none configured.

---

## 6. Exact Next Action

Execute `NEXT_AGENT_PROMPT.md`: audit existing diagnostics/recovery/update surfaces and author `PHASE2_IMPLEMENTATION_PLAN.md` (documentation-only; Stage 2 `reference/`/`PARITY.md` removal remains queued separately pending owner sign-off).
