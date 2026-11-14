# Next Agent Prompt — Phase 2.1, Stage 5.2 (PROPOSED — awaiting owner approval)

> **Status: PROPOSED. Not authorized.** Do not begin implementation until the owner explicitly approves this task in chat or on GitHub.
> **Origin:** `POST_PHASE2_ARCHITECTURE_REVIEW.md`, defect D2 (medium).
> **Repository:** `sandro-defender/you-ge-assistant`
> **Prerequisite:** Stage 5.1 (D1 diagnostics run ownership) merged to `main`; branch from the then-current `main`.

---\n\n## Objective

Make `modules.updates: false` prevent the `app:update` notice entirely: with the updates module disabled, no `app:update` notification and no apply-update action may be published, and the update button must be dead (not just visually disabled).

## Why this

Per `POST_PHASE2_ARCHITECTURE_REVIEW.md` §3: D2 — `modules.updates: false` still publishes the `app:update` notice (`assistant/index.js` near the notice gating vs the gated apply action) with a dead button. The notice and the action are split across two code paths, so the disable flag only gates the action.

## Scope

Change only the update-state gating so the disable flag consistently suppresses both the `app:update` notice and the `update` available action when `modules.updates === false`.

- Preserve every public signature: `applyUpdate()`, `requestPwaUpdate()`, `setUpdateAvailable()`, `modules.updates` config contract.
- Preserve Stage 4 behavior when updates are enabled (waiting-worker transitions, `no-waiting-worker`/`applied`/`disabled`/`error` outcomes, `lastPwaHasUpdate` reconciliation, `pwa:update`/`visibilitychange` sync).
- No dependency changes, no version bumps, no publish/release, no browser-level claims without an actual browser test.

## Out of scope

D1 (done in Stage 5.1), D3–D6, R1/R2, Identity Cleanup Stage 2, Roadmap Phase 3, SDK release.

## Relevant files

- `packages/assistant-sdk/src/assistant/index.js` (update notice vs apply-action gating)
- `packages/assistant-sdk/tests/sdk-integrations.test.mjs` (new regression test)
- `packages/assistant-sdk/src/diagnostics/*` — untouched in this stage

## Test first (TDD red → green, `tdd` skill)

Add one deterministic test: configure the assistant with `modules: { updates: false }`, seed a waiting worker via `pwa:update`/`PWA.getState().hasUpdate = true`, and assert `getState().notifications` contains no `app:update`, `availableActions` contains no `update`, `network.updateAvailable` stays false, and `applyUpdate()` returns `{ applied: false, outcome: 'disabled' }` without invoking `PWA.applyUpdate`. Reuse the existing `pwaState`/root mock style from the Stage 4 tests; do not weaken or delete them.

## Acceptance criteria

- New test fails before the change, passes after.
- `npm run check` green with no weakened assertions.
- `node scripts/sync-sdk-browser.mjs --check` passes after `npm run sync:sdk` (only if `assistant-state.js` is affected — it embeds the SDK; regenerate, never hand-edit).
- `node packages/assistant-sdk/scripts/validate-package.mjs` and `git diff --check` pass.
- Zero changes to public APIs, compatibility contracts or package versions.

## Handoff

Update `AGENT_HANDOFF.md` (branch, commit, PR, working tree, completed work, pending work, actual test results, risks, exact next action) and replace this file with the next proposed task only after owner approval of Stage 5.2. Do not merge, publish, release or bump versions.
