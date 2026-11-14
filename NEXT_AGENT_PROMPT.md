# Next Agent Prompt — owner-authorized precache kit bump for CD-1

CD-1 (module capability enforcement) is implemented and pushed on
`arena/bc1478a5-you-ge-assistant` as PR #40, **awaiting owner review**. Read
`AGENTS.md`, `AGENT_HANDOFF.md`,
[`docs/architecture/CAPABILITY_ENFORCEMENT.md`](docs/architecture/CAPABILITY_ENFORCEMENT.md)
and [`docs/operations/PRECACHE_INTEGRITY.md`](docs/operations/PRECACHE_INTEGRITY.md)
first.

Do **not** start another audit item. Do **not** merge, tag, release, publish or
deploy. CD-1 ends with the owner's decision.

## Blocking state

Four precached files changed (`assistant-state.js` generated,
`assistant-widget.js`, `dns-diagnostics.js`, `offline.js`). The diff-aware gate
(`npm run check:precache`, also inside `npm run check`) fails and names the
required action. Kit `1.2.0` and SDK `0.2.0` are unchanged because no bump was
authorized.

Two tests fail for the same reason and are expected to pass after the bump:

- `tests/identity-migration.test.mjs` → "Phase 1: precache integrity gate passes with kit 1.2.0…"
- `tests/precache-integrity.test.mjs` → "this repository itself passes the gate against its merge base…"

## Objective (only if the owner explicitly authorizes it)

Apply the **synchronized** kit `1.2.0 → 1.2.1` bump:

1. `src/runtime/you-ge-sw.js` — `const VERSION = '1.2.1'`
2. `src/runtime/pwa.js` — `PWA.version: '1.2.1'` (the `version:` entry)
3. `package.json` — `"version": "1.2.1"`
4. `packages/assistant-sdk/src/core/constants.js` — `KIT_COMPAT_VERSION = '1.2.1'`
5. `npm run sync:sdk` — regenerate `src/assistant/assistant-state.js`
6. `@youge/assistant-sdk/package.json` stays `0.2.0` (separate release line)

Then update the pinned kit-version references the gate/tests and docs name
(`README.md`, `AGENTS.md`, `docs/operations/PRECACHE_INTEGRITY.md`,
`docs/reference/COMPATIBILITY_CONTRACTS.md`, `CHANGELOG.md`, the
`tests/identity-migration.test.mjs` assertions) and the CHANGELOG entry from
"Unreleased" to `1.2.1 (kit)`.

## Acceptance criteria

- `node scripts/precache-integrity.mjs` → pass, `13 precached assets changed … kit version 1.2.0 → 1.2.1 synchronized`.
- `npm run check` → pass (static checks + SDK validation + full suite), except
  `examples/example` assembly tests that need `cd examples/example && npm run
  build` first.
- No behavioral change beyond the version strings: diff-review that CD-1 runtime
  logic is untouched.
- Nothing published, tagged, released, deployed or merged.

## If the owner instead requests changes to CD-1

Keep the capability work on PR #40's branch, keep
`docs/architecture/CAPABILITY_ENFORCEMENT.md` and both handoff documents current,
and re-run the verification list in that document §6.1 after every change.
