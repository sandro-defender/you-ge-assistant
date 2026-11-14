# Next Agent Prompt — Phase 2, Stage 3: Diagnostics State Sync, Online-Failure Classification & Cancellation Hygiene

**Repository:** `sandro-defender/you-ge-assistant` (`/home/user/you-ge-assistant`)
**Plan reference:** `PHASE2_IMPLEMENTATION_PLAN.md` (§3, Stage 3)
**Prerequisite:** PR #26 (Stage 2) merged by the owner into `main`; start from the then-current `main`.

---

## Objective

Complete **one small, independently verifiable task** — **Phase 2, Stage 3**: keep `YouGeAssistant` state synchronized with `pwa.js` diagnostics modal runs, classify total online failure (`online && !validDns.length && !app.ok`), reset stale DNS conditions on project/domain reconfiguration, and support an optional caller-supplied `AbortSignal` without poisoning single-flight deduplication.

**Do not implement Stage 4, add `applyUpdate()`/`requestPwaUpdate()`, redesign diagnostics UI, modify `/progressier.js` precache policy, bump versions, publish packages, or retire `reference/`/`PARITY.md`.**

---

## Startup & State Verification

1. Read `AGENTS.md`, `AGENT_HANDOFF.md`, and `PHASE2_IMPLEMENTATION_PLAN.md` (§3 Stage 3) first.
2. Verify live Git state before acting (`git status --short --branch`, `git rev-parse HEAD`, `gh pr list --state open`), stay strictly on the session's active branch, and confirm PR #26 is merged (otherwise stop and report).
3. Re-check Stage 2 behavior in `dns-diagnostics.js` (local-host `dohSkipped`, bounded JSON parsing, base-path probe resolution) before changing classification logic.

---

## Exact Scope

Inspect only the relevant files:
- `pwa.js` (only `showNetworkDiagnostics()` event dispatch — no UI changes)
- `dns-diagnostics.js`
- `packages/assistant-sdk/src/diagnostics/index.{js,d.ts}`
- `packages/assistant-sdk/src/assistant/index.js`
- `assistant-state.js` (regenerated via `npm run sync:sdk`)
- `tests/assistant-widget.test.mjs`, `tests/sdk-integration.test.mjs`, `packages/assistant-sdk/tests/sdk-integrations.test.mjs`, `tests/dns-diagnostics.test.mjs`

Implement with TDD (focused tests first, red → green):
1. `pwa.js` `showNetworkDiagnostics()`: dispatch `pwa:diagnostics` on rejection as well as resolution (matching `offline.js`), without changing dialog markup or behavior.
2. `dns-diagnostics.js` / `diagnostics/index.js`: evaluate `online && !validDns.length && !app.ok` as a real connectivity failure (`failed: true` or `application_host_unavailable`) so `connectivityFailure()` raises the critical `network:unreachable` notice instead of a silent `'unknown'`. Keep local/dev-host behavior from Stage 2 intact.
3. `assistant/index.js`: reset `conditions.dns` to `'idle'`/`'unknown'` when `configure()` changes `project.id` or the resolved hostname, and clear `diagnosticsController` on `destroy()`.
4. `dns-diagnostics.js`: accept an optional `signal` (`AbortSignal`) in `options`; a caller-aborted run must reject/classify cleanly and must not poison the shared `inflight` entry for later uncancelled checks.

---

## Verification

Run and report only actually executed checks:
- `git diff --check`
- `node --test tests/dns-diagnostics.test.mjs tests/assistant-widget.test.mjs tests/sdk-integration.test.mjs`
- `npm run test:sdk`
- `node scripts/sync-sdk-browser.mjs --check`
- `node packages/assistant-sdk/scripts/validate-package.mjs`
- `npm run check`

---

## Stop Conditions

- Stop after Stage 3 changes, tests, `assistant-state.js` sync (if needed), one PR against `main`, and handoff updates are verified.
- Do **not** merge the PR, start Stage 4, bump versions, publish to npm, or claim checks that did not run.
- Update `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` with the real branch, commit, PR, CI state and the next planned task (Phase 2 — Stage 4).
