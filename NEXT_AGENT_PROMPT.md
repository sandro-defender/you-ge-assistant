# Next Agent Prompt — after PR #35 (precache safety, kit 1.1.1, identity cleanup)

PR [#35](https://github.com/sandro-defender/you-ge-assistant/pull/35) on `arena/62503a48-you-ge-assistant` is open for owner review. Do not start another roadmap stage.

Before acting, read `AGENT_HANDOFF.md`, check the branch and worktree, and query live state (`gh pr view 35`, `gh pr checks 35`).

## State to rely on

- Kit version **`1.1.1`** in all four declarations and the generated bundle; SDK package **`0.2.0`**, unchanged.
- The worker's precache manifest declares required and optional assets; the policy and its rationale are in `PRECACHE_INTEGRITY.md` §3.
- `npm run check` runs the precache integrity gate; a precached-file change needs a synchronized, higher kit version.

## If review requests changes

Work only on the current branch, in PR #35. Use red-first tests for behaviour changes and keep the verification and handoff rules in `AGENTS.md`.

- Changing an asset's classification: edit its `required:` flag in `PRECACHE_ASSETS` (`progressier.js`), the matching list in `tests/support/service-worker-harness.mjs`, and `PRECACHE_INTEGRITY.md` §3. A worker-only change needs no version bump.
- Changing any precached file needs a new kit version, which needs new owner authorization.

## Boundaries

- Do not merge, publish, release, deploy or tag. The `1.1.1` bump was authorized once; any further kit, package or SDK version change needs new explicit authorization. If the gate fails, request it; never bypass or weaken the gate.
- Keep the SDK package at `0.2.0` unless the owner asks for an SDK release.
- Do not make a required precache asset optional, or widen what counts as "not deployed" (404/410 or an HTML fallback page), without owner approval.
- You.Ge Assistant is the sole product identity. Preserve the legacy compatibility contracts in `COMPATIBILITY_CONTRACTS.md` (`/progressier.js`, `window.progressier`, selectors, CSS variables, storage keys, manifest `id`); do not rename them.
- Do not remove or restructure `reference/` or `PARITY.md`.
- No dashboard, domain-failover or `staff.you.ge`-specific features, new dependencies or unrelated refactors.

## Otherwise

Stop and wait for explicit owner direction.
