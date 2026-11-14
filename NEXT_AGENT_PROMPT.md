# Next Agent Prompt — Stage 5.4 (proposed, not authorized)

Do not start until the owner explicitly approves Stage 5.4. Stage 5.3 (D3 + D6) is merged at `bcdca6e` on `main`, so this task is unblocked but still unauthorized. Verify live `main`, worktree, PR and CI state first; read `AGENTS.md`, `AGENT_HANDOFF.md`, the relevant skills and `POST_PHASE2_ARCHITECTURE_REVIEW.md` (D4, D5, R2 and Stage 5.4). Follow the active session branch instructions.

## Objective

Close the two remaining low-severity contract defects left by the Phase 2 review, scoped narrowly:

1. **D4** — `DnsDiagnosticSnapshot` declares `cancelled?: boolean`, but `normalizeDnsResult()` rebuilds the record from a fixed shape and drops it, so `assistant.getState().network.dns.cancelled` is always `undefined`. Publish the declared field without changing any existing field or classification.
2. **D5** — `requestPwaUpdate()` forwards any non-empty runtime `outcome` string verbatim while `UpdateApplyOutcome` declares five values. Normalize an out-of-union runtime outcome to the declared union (or document and widen the contract deliberately) so consumers narrowing on the union stay sound.

Inspect current behavior and contracts before choosing the smallest safe correction. Do not rework the diagnostics architecture, change unrelated public APIs or result contracts, revisit D3/D6, change package or kit versions, or add dependencies.

## Tests and validation

Use deterministic regression tests for both defects (including the negative cases in the review) and preserve existing tests and compatibility. Run focused tests first, the full suite, `npm run check`, package validation and `git diff --check`; regenerate the browser SDK only if its source changes (`npm run sync:sdk`), then verify synchronization with `--check`. Report any browser or environment limitations honestly.

## Boundaries and handoff

Do not publish, release, deploy, merge, force-push, reset or overwrite owner work. Preserve Progressier technical compatibility contracts and public APIs. Update both handoff files with actual branch, PR, commit, tests and CI; open one focused PR for owner review. Stop after the PR is ready.
