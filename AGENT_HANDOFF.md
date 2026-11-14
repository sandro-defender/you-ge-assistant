# Current handoff — CI assertion fixed; Diagnostics Stage 2 blocked

**Date:** 2026-11-14
**Branch:** `arena/ca1b6b72-you-ge-assistant`, based on `main` at `9876c267d595c6af54daf3d59c67efca67ca4dcb`.
**Scope:** assertion-only correction and handoff updates; see the branch and PR history for commit and review status. Kit remains `1.2.1`; SDK remains `0.2.0`.

Part A: corrected the obsolete precache summary assertion in `tests/identity-migration.test.mjs`; the current summary reports unchanged assets and synchronized version `1.2.1`. Focused identity suite passed 13/13. No other obsolete assertion was found by searching test summary wording.

Part B is **not implemented**. Both `dns-diagnostics.js` and `domain-config.js` are precached by `src/runtime/you-ge-sw.js`. The integrity gate requires a synchronized kit-version increase when a precached asset changes. The task forbids changing `1.2.1` and bypassing or weakening the gate; `AGENTS.md` requires stopping and asking for owner authorization. Existing diagnostics still resolve root-relative backend paths at the origin rather than ensuring the configured base path; Stage 2 safety and body-timeout requirements remain unverified and must not be represented as complete. Browser DNS cannot establish whether an arbitrary hostname resolves to a local address.

Verification of Part A: identity 13/13; existing diagnostics 26/26; `npm test` 537/537; `npm run test:sdk` 128/128; `npm run check`, `npm run sync:sdk -- --check`, `npm run build`, and `npm run check:precache` passed. `npm test` and `npm run check` initially failed because `examples/example/dist` was absent; after `npm ci`, `npm run typecheck`, and `npm run build` in `examples/example`, both passed. Example build warns about classic scripts not bundled, as expected. No Stage 2 regressions have been added. The pending work is backend probe-path resolution (including subpaths), bounded JSON response parsing timeouts, localhost and local-IP hardening, domain configuration validation, and deployment/networking regression tests. Obtain explicit owner authorization for a future synchronized kit-version bump before changing precached runtime files; do not weaken the gate or move code to avoid it.

---

## Historical handoff (PR #40; superseded by current status above)

# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base:** `main` @ `2e19830` (PR #39 merge)
**Branch:** `arena/bc1478a5-you-ge-assistant` (active)
**PR:** #40 — "CD-1 — Module capability enforcement" (open, **draft**, awaiting
owner review; **do not merge**)
**Working tree:** clean at the branch tip; everything pushed.
**Versions:** kit **`1.2.1`**; `@youge/assistant-sdk` **`0.2.0`** (unchanged).

Permanent development and layout rules live in [`AGENTS.md`](AGENTS.md). The
CD-1 audit, enforcement architecture, activation-path inventory, test matrix and
verification evidence are in
[`docs/architecture/CAPABILITY_ENFORCEMENT.md`](docs/architecture/CAPABILITY_ENFORCEMENT.md).

## CD-1 status: implemented and complete

`modules.diagnostics`, `modules.recovery`, `modules.failover` and `modules.help`
are enforced capabilities rather than advisory UI flags.

**Enforcement architecture**

- `packages/assistant-sdk/src/core/capabilities.js` is the single policy: gated
  names, action/notice → capability map, `isCapabilityEnabled`,
  `capabilityForAction`, `isActionAllowed`, `gateActions`, `gateNotification(s)`,
  `capabilitiesRecord`. It is bundled into the generated `assistant-state.js`
  and exposed as `YouGeAssistantSDK.*` for classic renderers.
- Assistant API boundary: `runDiagnostics()` refuses a disabled capability (no
  runner), `buildActions()` gates built-in **and** project-supplied actions,
  `buildNotifications()` gates notices, `state.capabilities` comes from
  `capabilitiesRecord()`, and `isCapabilityEnabled(name)` is a new read-only
  method.
- Diagnostics adapter takes a live `isEnabled` predicate, re-checks it before the
  runner starts and before publishing, and `configure()` aborts an in-flight run
  when diagnostics is disabled (async/init-order safety).
- Renderers: `assistant-widget.js` and `examples/example/src/main.jsx` render
  and dispatch only through the policy; the widget re-checks at click time.
- Runtime backstop: `pwa.js` (`runNetworkDiagnostics` / `showNetworkDiagnostics`
  / `[data-pwa-diagnostics]`), `dns-diagnostics.js` (the Cloudflare DoH
  transport) and `offline.js` consult
  `window.YouGeAssistant.isCapabilityEnabled('diagnostics')` and make **no**
  request while disabled; they fail open when no Assistant is present.

**Activation paths audited (13):** public SDK API, generated + project actions,
notifications and their action links, DOM/React renderers, delegated toolkit
hooks, `youge:action` / `pwa:diagnostics` / session / endpoint events, toolkits,
DoH engine, offline shell, reconfiguration and in-flight async runs.

**Generated bundle:** `src/assistant/assistant-state.js` is produced only by
`npm run sync:sdk`; `--check` reports in sync.

## Kit version bump (owner-authorized) — applied

CD-1 changes four precached assets, so the diff-aware precache gate required a
synchronized kit bump. The owner authorized `1.2.0 → 1.2.1`, kit only:

| Location | Value |
| --- | --- |
| `src/runtime/you-ge-sw.js` | `const VERSION = '1.2.1'` |
| `src/runtime/pwa.js` | `PWA.version: '1.2.1'` |
| `package.json` | `"version": "1.2.1"` |
| `packages/assistant-sdk/src/core/constants.js` | `KIT_COMPAT_VERSION = '1.2.1'` |
| `src/assistant/assistant-state.js` | regenerated (`npm run sync:sdk`) |
| `packages/assistant-sdk/package.json` | **`0.2.0` — unchanged** |

Gate result:

```
precache integrity: 4 of 13 precached assets changed (assistant-state.js,
assistant-widget.js, dns-diagnostics.js, offline.js) since 2e19830;
kit version 1.2.0 → 1.2.1 synchronized
```

Current-version references updated: `AGENTS.md` (runtime version line, also
asserted by `tests/identity-migration.test.mjs`), worker version + cache names +
gate summary in that same file, kit pin in `tests/example-theme.test.mjs`,
`KIT_COMPAT_VERSION` in `packages/assistant-sdk/tests/sdk-core.test.mjs`, plus
the current-state lines in `PRECACHE_INTEGRITY.md` (§1, §9),
`MULTI_DOMAIN.md`, `COMPATIBILITY_CONTRACTS.md`, `REPOSITORY_STRUCTURE.md`,
SDK `MIGRATION.md`/`RELEASE.md`, and a new `CHANGELOG.md` `1.2.1 (kit)` section.
Historical `1.2.0` records were left intact, and no gate rule was weakened,
skipped or bypassed.

## Verification (2026-11-14, local)

| Check | Result |
| --- | --- |
| `npm test` | **537 pass / 0 fail** |
| `npm run test:sdk` | 128 pass / 0 fail |
| CD-1 suites (`sdk-capabilities`, `capability-enforcement`, `assistant-widget`) | 90 pass / 0 fail |
| `npm run check` | passed (static contracts + package validation + 537 tests) |
| `npm run check:precache` | passed (see gate result above) |
| `npm run sync:sdk -- --check` | in sync |
| `npm run build` | 18 runtime/public files + `icons/` |
| `validate-package.mjs`, `npm pack --dry-run` | passed (`0.2.0`, 24 files, publishing disabled) |
| `examples/example` typecheck + build | passed |
| `git diff --check` | clean |
| `npm run verify` | not run — requires a deployed URL; nothing was deployed |

## Compatibility notes

- Defaults unchanged: omitted/partial/null `modules` → every capability enabled.
- `state.capabilities` shape unchanged; additive API only.
- Opt-out configs only: with an Assistant present and `modules.diagnostics:
  false`, the *toolkit's* on-demand diagnostics also refuse to run
  (`classification: 'disabled'`). Documented in README, WIDGET.md, SDK README.
- Installed apps move to `…:static:v1.2.1` / `…:pages:v1.2.1`; `1.2.0` caches
  retire on activation.

## Not done / deliberately untouched

- No npm publish, no tag, no GitHub release, no deployment, no merge.
- `@youge/assistant-sdk` stays `0.2.0`; publishing remains deferred.
- `npm run verify` (live deployment verification) not performed.
- No other audit item was started.

## Next action

Owner review of PR #40. The implementation is complete and every local gate is
green; the only open items are the owner's merge decision and the separate
SDK release line.
