# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Verified base:** `main` / PR #39 merge `2e19830db8d93d0194fdf059195b4fb058679e24`
**Branch:** `arena/bc1478a5-you-ge-assistant` (active)
**PR:** #40 — CD-1 Module Capability Enforcement (draft; **do not merge** — owner review)
**Working tree:** clean at the branch tip; changes pushed.
**Versions:** kit `1.2.0`; `@youge/assistant-sdk` `0.2.0` — **both unchanged** (no bump authorized).

Permanent development and layout rules live in [`AGENTS.md`](AGENTS.md). The CD-1
audit, enforcement architecture, activation-path inventory, test matrix and
verification evidence are in
[`docs/architecture/CAPABILITY_ENFORCEMENT.md`](docs/architecture/CAPABILITY_ENFORCEMENT.md).

## CD-1 — Module capability enforcement (this PR)

`modules.diagnostics`, `modules.recovery`, `modules.failover` and `modules.help`
are now enforced capabilities rather than advisory UI flags.

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

**Activation paths audited:** public SDK API, generated + project actions,
notifications and their action links, DOM/React renderers, delegated toolkit
hooks, `youge:action` / `pwa:diagnostics` / session / endpoint events, toolkits,
DoH engine, offline shell, reconfiguration and in-flight async runs. The full
table (13 paths, pre-CD-1 behavior) is in the architecture document §3.

**Generated runtime:** `src/assistant/assistant-state.js` regenerated only via
`npm run sync:sdk`; `--check` reports in sync.

**Tests (behavioral):**

| Suite | Result |
| --- | --- |
| `packages/assistant-sdk/tests/*.test.mjs` | 128 pass / 0 fail (incl. 20 new `sdk-capabilities`) |
| `tests/*.test.mjs` | 407 pass / 2 fail (both the precache gate, see below) |
| Full suite | 535 pass / 2 fail |
| New CD-1 suites (`sdk-capabilities`, `capability-enforcement`, widget CD-1 block) | 90 pass / 0 fail |

`node scripts/check.mjs`, `sync --check`, `build`, `validate-package`,
`examples/example` typecheck+build and `git diff --check` were run (see
architecture doc §6.1). `npm run verify` needs a deployed URL and was not run.

## ⚠ Owner decision required — kit version bump

CD-1 changes four precached files (`assistant-state.js` generated,
`assistant-widget.js`, `dns-diagnostics.js`, `offline.js`). `npm run check:precache`
therefore **fails by design** and names the owner action; nothing was bumped or
bypassed. Proposed, pending explicit authorization:

```
kit 1.2.0 → 1.2.1, synchronized in:
  src/runtime/you-ge-sw.js                      const VERSION
  src/runtime/pwa.js                            PWA.version
  package.json                                  version
  packages/assistant-sdk/src/core/constants.js  KIT_COMPAT_VERSION
  src/assistant/assistant-state.js              regenerated (npm run sync:sdk)
@youge/assistant-sdk stays 0.2.0.
```

Until that bump, installed PWAs would keep serving the cached pre-CD-1 runtime
(the reason the gate exists), and the two gate tests
(`tests/identity-migration.test.mjs` "Phase 1", `tests/precache-integrity.test.mjs`
"this repository itself passes the gate…") fail as expected.

**Precache gate fix included:** the gate read base-commit paths as public paths,
but since the source/output split they live under `src/`. Every base lookup
returned null, so the gate degraded to `diff skipped` and silently stopped
enforcing the version rule. It now resolves base paths through
`scripts/source-paths.mjs` (flat-path fallback for pre-split commits), with two
regression tests. No rule was weakened; this is what makes the required bump
visible.

## Compatibility notes

- Defaults unchanged: omitted/partial/null `modules` → every capability enabled.
- `state.capabilities` shape unchanged; no public API removed or renamed
  (`isCapabilityEnabled`, `capabilityForAction`, `isAllowed`, `gateActions`,
  `gateNotifications`, `capabilitiesRecord`, `disabledDiagnosticsResult` are
  additive).
- Opt-out configs only: with an Assistant present and `modules.diagnostics:
  false`, the *toolkit's* on-demand diagnostics also refuse to run
  (`classification: 'disabled'`). Documented in README, WIDGET.md and the SDK
  README.

## Not done / deferred

- No npm publish, tag, GitHub release, deployment or merge.
- No kit/SDK version change (see above).
- `npm run verify` (live deployment verification) not performed — no deployment.
- SDK publishing remains deferred.
- Other audit items (outside CD-1) are not started.

## Next action

Owner review of PR #40 (`arena/bc1478a5-you-ge-assistant`). Either authorize the
synchronized kit `1.2.1` bump (then the gate and the two gate tests pass), or
request changes. Do not merge, release, tag, deploy or publish.
