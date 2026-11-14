# Next Agent Prompt — Stage 5.3 (proposed, not authorized)

Do not start until the owner explicitly approves Stage 5.3 and Stage 5.2 PR [#31](https://github.com/sandro-defender/you-ge-assistant/pull/31) has merged. Verify live `main`, worktree, PR and CI state first; read `AGENTS.md` and `AGENT_HANDOFF.md`, relevant skills and `POST_PHASE2_ARCHITECTURE_REVIEW.md` (D3, D6 and Stage 5.3). Follow the active session branch instructions.

## Objective

Address DNS host-classification and verdict identity accuracy (D3 and D6), scoped to the approved task. Public IP-literal hosts must not be described as local development hosts; preserve the existing DoH skip for IP literals. A change to the effective base path or probe identity must not retain a stale DNS verdict. Inspect current behavior and contracts before choosing the smallest safe correction.

## Tests and validation

Use deterministic regression tests for public and local IP literals and for changes to effective DNS probe identity; preserve existing DNS tests and compatibility. Run focused tests first, the full suite, `npm run check`, package validation and `git diff --check`; regenerate the browser SDK only if its source changes, then verify synchronization. Report any browser or environment limitations honestly.

## Boundaries and handoff

Do not revisit D1/D2, start Stage 5.4, add dependencies, change versions, publish, deploy or merge. Preserve Progressier technical compatibility contracts and public APIs. Update both handoff files with actual branch, PR, commit, tests and CI; open one focused PR for owner review. Stop after the PR is ready.
