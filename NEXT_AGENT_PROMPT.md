# Next Agent Prompt — review `<pwa-install>` integration and multilingual localization

Read `AGENTS.md`, the current `AGENT_HANDOFF.md`, `docs/operations/PRECACHE_INTEGRITY.md` §12, `docs/guides/INSTALLATION_EXPERIENCE.md` §5, and `THIRD_PARTY_NOTICES.md`. Work only on `arena/b025b717-you-ge-assistant` (base `b256c49`). The implementation is complete: `@khmyznikov/pwa-install@0.7.0` is vendored as the self-contained optional runtime `src/runtime/pwa-install.js` with MIT attribution and 35 built-in locales (including native Georgian `ka`, Russian `ru`, Estonian `et`, `nb`/`nn->no`, and accessible close labels); `pwa.js`, `dns-diagnostics.js`, `offline.{html,js}`, `assistant-widget.js`, `@youge/assistant-sdk/i18n`, `assistant-state.js`, and both example surfaces are unified across all 12 core locales (`en`, `ka`, `ru`, `fr`, `it`, `de`, `sv`, `nl`, `no`, `da`, `et`, `es`) with bidirectional locale sync, runtime-only `setLocale`, `domainRegistry` defaults, and `Escape` dialog ownership. Kit `1.2.6` is owner-authorized because precached assets changed; SDK package remains `0.3.0`.

Verification highlights: `node scripts/check.mjs`, `validate-package.mjs`, `npm run test:sdk` (142/142), `examples/example` typecheck & build, `sync-pages-examples.mjs --check`, `assemblePages({ skipBuild: true })`, and `node scripts/precache-integrity.mjs` (`1.2.5 → 1.2.6` across 14 precached assets) all pass. Full `node --test tests/*.test.mjs packages/assistant-sdk/tests/*.test.mjs` finishes 613/614 (the sole failure is the pre-existing `@playwright/test` dependency assertion on base `main` at `tests/example-theme.test.mjs:149`). [PR #51](https://github.com/sandro-defender/you-ge-assistant/pull/51) is open against `main`; physical Safari/Chromium browser testing of `<pwa-install>` and Playwright e2e tests remain recommended before release; do not merge, publish, deploy, or bump versions without authorization.

---

## Historical prompt (superseded)

# Next Agent Prompt — review audited runtime follow-up

Read `AGENTS.md`, the current `AGENT_HANDOFF.md`, `docs/operations/PRECACHE_INTEGRITY.md` §11 and the focused regression files. Work only on `arena/a259b4d2-you-ge-assistant` (base `73a4c61`). The implementation is complete: service-worker notification/action/fallback/hash targets are confined to the registered scope; global DNS run options preserve caller cancellation; classic PWA controls use native semantics, focus cleanup and visible focus rings; and legacy install-button flags are enforced. Kit `1.2.5` is owner-authorized because precached assets changed; SDK package remains `0.3.0`.

Verification is green: `npm run check` 595/595, `npm run test:sdk` 135/135, example typecheck/build, precache integrity, package validation and SDK dry-run pack. [PR #48](https://github.com/sandro-defender/you-ge-assistant/pull/48) is open; no release, publish, tag, deployment or merge has occurred. Keep the host-owned worker registration contract, canonical You.Ge identity, legacy aliases and deferred M6/M7 scope unchanged. Do not bump versions again or weaken tests/gates; leave merge/release/deploy decisions to the owner.

---

## Historical prompt (superseded)

# Next Agent Prompt — review the product website PR

Read `AGENTS.md`, the current `AGENT_HANDOFF.md`, and
`docs/architecture/PAGES_REDESIGN_AUDIT.md`. Work only on
`arena/34c9ca4e-you-ge-assistant` (base `5f87833`). Review the current branch's
single [PR #46](https://github.com/sandro-defender/you-ge-assistant/pull/46) and its latest CI checks (`gh pr checks 46`). Website
implementation is complete: product guide `/example/`, coordinated `/` homepage,
preserved `/example/workspace.html`, shared navy/violet identity, typed practical
examples, real interactive SDK panel and screenshots. 572 tests pass locally; GitHub check run `43665433253` also passed on `05ee8c9`.
Source, published SDK types, assembly, browser and accessibility checks are
recorded in the audit. Inspect any CI failure before making a change. Do not
merge, deploy, publish, tag, bump versions, or change SDK/worker ownership.
Physical mobile/other browsers and production host adapters remain separately
authorized follow-up checks, not blockers hidden by the local browser results.

---

## Historical prompt (superseded)

# Next Agent Prompt — review SDK 0.3.0 PWA management

Read `AGENTS.md`, the current `AGENT_HANDOFF.md`, `docs/architecture/PWA_IMPLEMENTATION_AUDIT.md`, and the SDK README. Branch `arena/9a7feeea-you-ge-assistant` is based on `302c338`; see `git log -1`, `git status`, and the current branch PR for final state. SDK `0.3.0` and kit `1.2.3` are prepared but not published. PR #44 also documents and tests runtime admin changes through `configure()`; review CI and verify real-browser/staff.you.ge custom-worker and host-registered Assistant-worker behavior when available. Preserve host source, scope, registration, cache and update lifecycle. Do not merge, deploy, publish, tag or release without separate authorization.

---

## Historical prompt (superseded)

# Next Agent Prompt — deployment verification follow-up

Read `AGENTS.md` and the current section of `AGENT_HANDOFF.md`. Diagnostics Phase 2 browser verification was performed on branch `arena/2914f4d7-you-ge-assistant` based on merged PR #42; see its PR and `git log -1` for the current commit, and `git status` for the working tree. Kit remains `1.2.2`, SDK package `0.2.0`. Review the PR and its verification evidence; do not merge, deploy, publish, release or tag without explicit approval.

When access is available and separately authorized, verify the actual deployed proxy's encoded-path behavior and the product widget, remote RFC1918 LAN, live Cloudflare DoH, TLS/CORS and other browsers. The completed local browser exercise used a link-local sandbox interface and a local DoH response, not a remote LAN or Cloudflare. Do not weaken the precache integrity gate.

---

## Historical prompt (PR #42; superseded)

# Next Agent Prompt — Review Diagnostics Stage 2

Read `AGENTS.md` and the current section of `AGENT_HANDOFF.md`. PR #42 on `arena/ca1b6b72-you-ge-assistant` contains the stale CI assertion correction and Diagnostics Phase 2 Stage 2, with the owner-authorized synchronized kit `1.2.1 → 1.2.2` bump. SDK package remains `0.2.0`. Check current PR/CI status and review the scoped changes and recorded verification. Do not merge, deploy, publish, release or tag without explicit approval.

The next recommended task is separately authorized real-browser and local-network verification of root/subpath probes, stalled bodies, redirects, and server behavior for encoded path segments. DNS-over-HTTPS cannot establish the device resolver's actual answers or reliably detect hostnames resolving to private addresses. Do not weaken the precache integrity gate.

---

## Historical prompt (superseded)

# Next Agent Prompt — CD-1 complete, PR #40 awaiting owner review

CD-1 (module capability enforcement) plus the owner-authorized kit `1.2.0 →
1.2.1` bump are implemented, pushed and green on
`arena/bc1478a5-you-ge-assistant` (PR #40 → `main`). **No further
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
