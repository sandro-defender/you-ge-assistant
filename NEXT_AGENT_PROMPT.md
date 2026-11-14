# Next Agent Prompt — Phase 2, Stage 4: Unified Service Worker Update Lifecycle & Behavioral Tests

**Repository:** `sandro-defender/you-ge-assistant` (`/home/user/you-ge-assistant`)
**Plan reference:** `PHASE2_IMPLEMENTATION_PLAN.md` (§3, Stage 4)
**Prerequisite:** PR #27 (Stage 3) merged by the owner into `main`; start from the then-current `main`.

---

## Objective

Complete **one small, independently verifiable task** — **Phase 2, Stage 4**: unify the service-worker update lifecycle so `@youge/assistant-sdk` and the classic runtime agree on one update path, plus deterministic `pwa.js` behavioral tests.

**Do not merge PR #27, publish packages, bump versions, create releases, retire `reference/`/`PARITY.md`, or start Phase 3/4/5 work.**

---

## Startup & State Verification

1. Read `AGENTS.md`, `AGENT_HANDOFF.md`, and `PHASE2_IMPLEMENTATION_PLAN.md` (§3 Stage 4) first.
2. Verify live Git state before acting (`git status --short --branch`, `git rev-parse HEAD`, `gh pr list --state open`), stay strictly on the session's active branch, and confirm PR #27 is merged (otherwise stop and report).
3. Re-check Stage 3 baseline in `packages/assistant-sdk/src/diagnostics/index.js` and `packages/assistant-sdk/src/assistant/index.js` before changing the update path.

---

## Exact Scope

Inspect only the relevant files:
- `packages/assistant-sdk/src/installation/index.{js,d.ts}` (add `requestPwaUpdate`)
- `packages/assistant-sdk/src/assistant/index.js` (add `applyUpdate()`; clear `conditions.updateAvailable`)
- `packages/assistant-sdk/src/adapters/react.js` and `assistant-widget.js` (`dispatchAssistantAction` update path)
- `assistant-state.js` (regenerated via `npm run sync:sdk`)
- `pwa.js` (only read/verify the existing update flow — no `/progressier.js` precache change)
- tests: `tests/assistant-widget.test.mjs`, `tests/install-experience.test.mjs`, `packages/assistant-sdk/tests/sdk-integrations.test.mjs`, `packages/assistant-sdk/tests/sdk-core.test.mjs`

Implement with TDD (focused tests first, red → green):
1. `requestPwaUpdate(options)` in `installation/index.js` and `assistant.applyUpdate()` guarded by `config.modules.updates !== false`, delegating to `PWA.applyUpdate()`, returning `{ applied: boolean, outcome: 'applied' | 'no-waiting-worker' | 'unsupported' | 'disabled' | 'error' }`.
2. If `PWA.applyUpdate()` resolves `false` and `readPwaSnapshot(pwa).hasUpdate` is `false`, clear `conditions.updateAvailable` and emit, so stale `app:update` notices disappear.
3. `assistant-widget.js` and `adapters/react.js` call `assistant.applyUpdate()` when available, falling back to `PWA.applyUpdate()` with only a bare `PWA` mock.
4. Deterministic VM/mocked ServiceWorker tests for `pwa.js`: `reg.waiting` detection, `updatefound` → `installed` → `pwa:update`, `applyUpdate()` posting `{ type: 'SKIP_WAITING' }` to the waiting worker, `controllerchange` reload trigger, and `showNetworkDiagnostics()` dialog lifecycle.

---

## Verification

Run and report only actually executed checks:
- `git diff --check`
- `node --test tests/install-experience.test.mjs tests/assistant-widget.test.mjs tests/sdk-integration.test.mjs`
- `npm run test:sdk`
- `node scripts/sync-sdk-browser.mjs --check`
- `node packages/assistant-sdk/scripts/validate-package.mjs`
- `npm run check`

---

## Stop Conditions

- Stop after Stage 4 changes, tests, `assistant-state.js` sync (if needed), one PR against `main`, and handoff updates are verified.
- Do **not** merge the PR, start Phase 3 work, bump versions, or publish to npm. Do not claim checks that did not run.
- Update `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` with the real branch, commit, PR, CI state and the next planned task.

---

## Stage 3 result (for reference)

Stage 3 shipped in PR #27 (`fix(diagnostics): synchronize state and support cancellation`): `pwa:diagnostics` dispatch on rejection, online-failure classification (`application_host_unavailable` instead of `unknown`), `configure()` DNS state reset keyed on `{ id, hostname, origin }`, and optional caller `AbortSignal` support with `classification`/`status` `'cancelled'` that never raises a DNS or connectivity notice. 17 new regression tests; `npm run check` green at 365/365. Preserve all of it.
