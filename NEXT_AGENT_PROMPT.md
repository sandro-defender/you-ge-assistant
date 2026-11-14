# Next Agent Prompt — after PR #35 (precache integrity and identity cleanup)

PR [#35](https://github.com/sandro-defender/you-ge-assistant/pull/35) on `arena/62503a48-you-ge-assistant` is open for owner review. Do not start another roadmap stage.

Before acting, read `AGENT_HANDOFF.md`, check the branch and worktree, and query live state (`gh pr view 35`, `gh pr checks 35`). PR #34 is merged at `63c703e`; PR #33 is closed unmerged and nothing from it is missing.

## If the owner authorizes the kit-version bump

Do exactly the change set in `PRECACHE_INTEGRITY.md` §6 with the version the owner names, in one PR:

1. `progressier.js` `VERSION`, `pwa.js` `version`, `package.json` `version`, SDK `KIT_COMPAT_VERSION`; then `npm run sync:sdk`.
2. Update the two pinned test expectations and the documentation lines listed there.
3. Apply the two `pwa.css` comment replacements recorded in `AGENT_HANDOFF.md`.
4. Run `npm run check`; the gate must report the old → new version as synchronized. Then the example typecheck and build.

Do not change the SDK package version or publish unless the owner separately asks.

## If review requests changes

Work only on the current branch and keep the verification and handoff rules in `AGENTS.md`.

## Boundaries

- Do not merge, publish, release, deploy, tag or change any version without explicit authorization. If the precache gate fails, request authorization; never bypass or weaken it.
- You.Ge Assistant is the sole product identity. Preserve the legacy compatibility contracts in `COMPATIBILITY_CONTRACTS.md` (`/progressier.js`, `window.progressier`, selectors, CSS variables, storage keys, manifest `id`); do not rename them.
- Do not remove or restructure `reference/` or `PARITY.md`.
- No dashboard, domain-failover or `staff.you.ge`-specific features, new dependencies or unrelated refactors.

## Otherwise

Stop and wait for explicit owner direction.
