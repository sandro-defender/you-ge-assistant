# Next Agent Prompt — Phase 2.1, Stage 5.1 (PROPOSED — awaiting owner approval)

> **Status: PROPOSED. Not authorized.** Do not begin implementation until the owner explicitly approves this task in chat or on GitHub.
> **Origin:** recommendation in [`POST_PHASE2_ARCHITECTURE_REVIEW.md`](POST_PHASE2_ARCHITECTURE_REVIEW.md) §9 (defect D1).
> **Repository:** `sandro-defender/you-ge-assistant`
> **Prerequisite:** `main` @ `180fe45` (PR #28 merged 2026-11-14). Start a fresh task branch from the then-current `main`.

---

## Objective

Make a diagnostics run own its own cancellation state, so a stale run can never disable the current run's controller or drop its caller listeners.

## Why this first

`packages/assistant-sdk/src/diagnostics/index.js` keeps run ownership in the shared mutable slots `runController` and `detachRun` (lines 113–114, reassigned at 155/170), while every run's finalizer unconditionally calls the module-level `detach()` (line 217 → 119–125). If a run is cleared, a new run starts, and the first run settles late, the late finalizer retires the *new* run:

- `clear()` (and therefore `configure()` on a project/hostname change and `destroy()`) can no longer abort the in-flight run — contradicting `packages/assistant-sdk/README.md:378` (“`destroy()` aborts any run still in flight”);
- a caller's `AbortSignal` listener is removed from the wrong run, so user cancellation is silently ignored and a runner that ignores its signal leaves the caller's promise pending forever.

`generation` (line 228) already prevents late *results* from being published, so state is not corrupted — only cancellation is broken. That makes this a contained, testable fix.

## Scope

Change **only** run ownership in the diagnostics controller, plus the matching test and the regenerated browser bundle. Keep single-flight dedup, `generation`-based result discarding, the `DnsDiagnosticSnapshot` shape, `isCancelledResult`/`dnsFailure`/`connectivityFailure`, and every public signature exactly as they are.

- Replace the shared slots with a per-run record (for example `{ controller, detach, generation }`) captured in the run closure; `clear()` retires the record it owns; a run's finalizer may retire only its own record.
- `isRunning()` must keep its current meaning.
- No new dependency, no `fetch`, no polling, no React import, no `serviceWorker` access (SDK core invariants).

## Out of scope

D2–D6 from the review (update-notice gating, IP-literal wording, `cancelled` normalisation, outcome union, DNS identity/`basePath`), the `pwa:ready` doc gap, CI type-checking of subpaths, version bumps, `reference/`/`PARITY.md`, Phase 3, failover, `staff.you.ge`, npm publish.

## Relevant files

- `packages/assistant-sdk/src/diagnostics/index.js` (implementation)
- `packages/assistant-sdk/src/diagnostics/index.d.ts` (only if a type must follow — no signature change expected)
- `assistant-state.js` (regenerate with `npm run sync:sdk`; never hand-edit)
- `packages/assistant-sdk/tests/sdk-integrations.test.mjs` (new regression test)

## Test first (TDD red → green, `tdd` skill)

Add one deterministic test that fails on current `main` and asserts, for the sequence **run A starts → `clear()` → run B starts → run A settles late**:

1. run B's runner signal is still aborted by a later `clear()` (i.e. `destroy()` still cancels the owned run);
2. run B's caller `AbortSignal` still reaches run B's runner when the caller aborts after A's late settle;
3. no late result from A or B is published (`onResult` receives nothing after `clear()`; state is never overwritten);
4. a subsequent run after `clear()` starts a fresh runner rather than joining a retired one.

Reuse the existing fake-signal helper style from the two current cancellation tests (`sdk-integrations.test.mjs:297` and `:363`); do not weaken or delete them.

## Acceptance criteria

- New test fails before the change, passes after.
- `npm run check` green with no weakened assertions (**377 + new** tests).
- `node scripts/sync-sdk-browser.mjs --check` passes after `npm run sync:sdk`.
- `node packages/assistant-sdk/scripts/validate-package.mjs` and `git diff --check` pass.
- `cd example && npm ci && npm run typecheck && npm run build` passes; clean up `node_modules`/`dist` afterwards.
- Zero changes to `pwa.js`, `progressier.js`, `domain-config.js`, `dns-diagnostics.js`, compatibility contracts or package versions.

## Compatibility & risks

- Internal only; no public API change. `runDiagnostics()`, `clear()`, `isRunning()` and all result shapes stay identical.
- The only risk is the concurrency rewrite itself: keep `generation` semantics unchanged, keep one controller per run, and keep bridging (not mutating) the caller's signal.
- `assistant-state.js` must be regenerated, not edited.

## Verification baseline to report (only what was actually run)

`git diff --check` · `node scripts/sync-sdk-browser.mjs --check` · `node packages/assistant-sdk/scripts/validate-package.mjs` · `npm run test:sdk` · `npm run check` · focused `node --test packages/assistant-sdk/tests/sdk-integrations.test.mjs`.

## Handoff

Update `AGENT_HANDOFF.md` (branch, commit, PR, working tree, completed work, pending work, actual test results, risks, exact next action) and replace this file with the next proposed task — Stage 5.2 (update-state gating consistency, defect D2). Do not merge, publish, release or bump versions.
