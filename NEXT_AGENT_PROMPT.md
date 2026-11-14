# Next Agent Prompt — CD-1 complete, PR #40 awaiting owner review

CD-1 (module capability enforcement) plus the owner-authorized kit `1.2.0 →
1.2.1` bump are **merged** to `main` (`9876c26`). PR **#41** on
`arena/bc1478a5-you-ge-assistant` is open: it fixes the one post-merge CI
failure (the precache-gate summary assertion must also accept the
unchanged-base form that a push to `main` produces). **No further
implementation work is queued.** Read `AGENTS.md`, `AGENT_HANDOFF.md`,
[`docs/architecture/CAPABILITY_ENFORCEMENT.md`](docs/architecture/CAPABILITY_ENFORCEMENT.md)
and [`docs/operations/PRECACHE_INTEGRITY.md`](docs/operations/PRECACHE_INTEGRITY.md)
before touching anything.

Do **not** merge PR #40 or any other PR. Do **not** tag, release, publish, or
deploy. Do **not** change the SDK package version (`@youge/assistant-sdk` stays
`0.2.0`). Do **not** start another audit workstream.

## Current release state

| Item | Value |
| --- | --- |
| Kit version | `1.2.1` — `you-ge-sw.js` `VERSION`, `pwa.js` `PWA.version`, root `package.json`, SDK `KIT_COMPAT_VERSION`, regenerated `assistant-state.js` |
| SDK package | `0.2.0` (unchanged; separate release line, publishing disabled) |
| Precache gate | pass — `4 of 13 precached assets changed … kit version 1.2.0 → 1.2.1 synchronized` |
| Tests | `npm test` 537/537, `npm run test:sdk` 128/128, CD-1 suites 90/90, `npm run check` pass |

## If the owner reports a problem

Fix only that problem on this branch:

1. Reproduce it and record the exact failing command.
2. Keep the capability policy single-sourced in
   `packages/assistant-sdk/src/core/capabilities.js`; never add a second gate.
3. After any edit to an SDK source, run `npm run sync:sdk` (never hand-edit
   `src/assistant/assistant-state.js`).
4. Re-run the full list in `CAPABILITY_ENFORCEMENT.md` §6.1 and paste the exact
   counts into the PR.
5. If a fix changes another precached asset, the precache gate will demand a new
   synchronized kit version — ask the owner before bumping again.

## If the owner decides to release (separate, explicit authorization required)

Nothing in this repository performs these steps automatically; each needs its
own owner instruction:

- Kit release: tag/deploy — the owner's decision, never taken by an agent.
- SDK release: `packages/assistant-sdk/RELEASE.md` (staged publish, owner
  approval on npmjs.com). Only there may `SDK_VERSION`/package version move, and
  only with the owner's explicit release authorization.

## Non-negotiable invariants

- Historical records stay historical: `CHANGELOG.md` `1.2.0` and
  `PRECACHE_INTEGRITY.md` §7/§8 are not rewritten to reflect newer versions.
- Current-version pins (`AGENTS.md`, worker version assertions, kit pins) move
  together with the version they describe.
- No gate, test, or check may be weakened, skipped, or bypassed to make a run
  pass.
