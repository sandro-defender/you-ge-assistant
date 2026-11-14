# Module capability enforcement (CD-1) — audit, design and evidence

Status: **implemented and complete** on `arena/bc1478a5-you-ge-assistant`
(PR #40 open for owner review). Kit is now `1.2.1` (owner-authorized bump that
satisfies the precache integrity gate, §7); `@youge/assistant-sdk` remains
`0.2.0`. Nothing is tagged, published, released, deployed or merged.

## 1. Objective

The four Assistant capabilities below must be *enforceable*, not merely
displayed:

- `modules.diagnostics`
- `modules.recovery`
- `modules.failover`
- `modules.help`

A capability set to `false` must not be executable through **any** code path —
direct SDK calls, renderer buttons, delegated toolkit hooks, DOM events,
callbacks, notifications, background or asynchronous work.

`installation`, `updates` and `chromeHandoff` keep their existing gating
behavior; they are outside CD-1 and unchanged.

## 2. Authoritative sources

| Layer | File | Role |
| --- | --- | --- |
| Capability policy (new) | `packages/assistant-sdk/src/core/capabilities.js` | One definition of the gated names, the action/notice→capability map, and the gate helpers |
| Assistant engine | `packages/assistant-sdk/src/assistant/index.js` | State, actions, notifications and the diagnostics lifecycle |
| Diagnostics adapter | `packages/assistant-sdk/src/diagnostics/index.js` | Single-flight runs, cancellation and the live `isEnabled` gate |
| React adapter | `packages/assistant-sdk/src/adapters/react.js` | Renderer action dispatch |
| Generated browser runtime | `src/assistant/assistant-state.js` | Produced by `npm run sync:sdk` only |
| DOM widget | `src/assistant/assistant-widget.js` | Thin renderer over `window.YouGeAssistant` |
| Toolkit runtime | `src/runtime/pwa.js` | `runNetworkDiagnostics()`, `showNetworkDiagnostics()`, `[data-pwa-diagnostics]` delegation |
| DoH engine | `src/domain/dns-diagnostics.js` | The only Cloudflare DNS-over-HTTPS transport |
| Offline shell | `src/offline/offline.js` | Offline diagnostics button (direct `YouGeDns.check`) |
| React example | `examples/example/src/main.jsx` | Reference renderer |

## 3. Activation paths found in the audit (before CD-1)

| # | Path | Capability | Pre-CD-1 behavior |
| --- | --- | --- | --- |
| 1 | `assistant.runDiagnostics()` | diagnostics | **Guarded** (returned a `disabled` result) |
| 2 | `pwa.runNetworkDiagnostics()` / `YouGeDns.check()` | diagnostics | **Unguarded** — DoH requests despite `modules.diagnostics: false` |
| 3 | Widget "Run network diagnostics" button (`[data-pwa-diagnostics]`) → `pwa.js` delegated click → `showNetworkDiagnostics()` | diagnostics | **Unguarded, rendered unconditionally** |
| 4 | Widget diagnostics section + "Diagnostics & recovery" panel + recovery `<details>` | diagnostics, recovery | **Rendered unconditionally** |
| 5 | Notices `network:offline`, `dns:failure`, `network:unreachable`, `api:primary-failed`, `api:primary-restored` → widget/React action button → `[data-pwa-diagnostics]` | diagnostics | **Action rendered unconditionally**, so the DoH dialog could be opened from a notice |
| 6 | `src/offline/offline.js` diagnostics button (`YouGeDns.check` directly) | diagnostics | **Unguarded** |
| 7 | `modules.recovery` | recovery | Guarded only for the generated `recovery` action; nothing else used it |
| 8 | `modules.failover` | failover | `backup-status` action guarded, but the `api:backup-active` notice and the panel "Backup" status row stayed visible |
| 9 | `modules.help` | help | **Not enforced anywhere**: `session:issue` notices carried `actionId: 'help'`, rendered as a "Get help" button; project actions with `kind: 'help'` were always exposed |
| 10 | `configure({ actions: [...] })` with a gated `id`/`kind` | all four | **Bypass**: project-supplied actions skipped the capability check entirely |
| 11 | React adapter `dispatchAssistantAction()` | diagnostics | Unguarded when no toolkit was present |
| 12 | Capability disabled *during* an in-flight run | diagnostics | The run kept going and published a late verdict |
| 13 | Events/callbacks (`youge:action`, notice clicks, `pwa:diagnostics`) | all four | No capability check on the receiving side |

## 4. Enforcement architecture

1. **One policy module.** `core/capabilities.js` owns:
   - `GATED_CAPABILITIES` (`diagnostics`, `recovery`, `failover`, `help`);
   - `CAPABILITY_ACTION_IDS` / `CAPABILITY_ACTION_KINDS` / `CAPABILITY_NOTICE_IDS`
     — the only mapping from a rendered action or notice to a capability;
   - `isCapabilityEnabled`, `capabilityForAction`, `isActionAllowed`,
     `gateActions`, `gateNotification`, `gateNotifications`,
     `capabilitiesRecord`.

   The module is bundled into the generated `assistant-state.js`, so the DOM
   widget, the React adapter and the classic runtime share the same mapping
   instead of re-implementing booleans.

2. **API boundary.** `runDiagnostics()` checks the capability before starting;
   `buildActions()` and `buildNotifications()` run every entry —
   *including project-supplied `actions`* — through the policy; the published
   `state.capabilities` record is derived from `capabilitiesRecord()`.
   `assistant.isCapabilityEnabled(name)` is additive and read-only.

3. **Asynchronous safety.** The diagnostics adapter receives a live
   `isEnabled` predicate. It re-checks it before invoking the runner and again
   before publishing a result, so a run started while the capability was
   enabled cannot publish after it is disabled. `configure()` aborts an
   in-flight run when diagnostics becomes disabled and discards its result
   (single-flight, cancellation and generation checks were already in place).

4. **Gated notifications.** A notice that *is* failover UI
   (`api:backup-active`) is dropped when `modules.failover` is false. A notice
   that reports reality but links to a gated action (connectivity/DNS notices →
   diagnostics, `session:issue` → help) keeps its content and loses the
   `actionId`, so the badge stays honest but no gated action is reachable.

5. **Renderer enforcement.** The widget and the React example render sections,
   buttons and notice actions only when the capability is enabled, resolve the
   action→capability mapping through the SDK, and re-check before dispatching.

6. **Runtime backstop.** Because the widget delegates diagnostics to `pwa.js`,
   the toolkit consults the Assistant as well:
   `runNetworkDiagnostics()` / `showNetworkDiagnostics()` return a `disabled`
   result (no dialog, no request) when `modules.diagnostics` is false, and the
   DoH engine itself refuses to run in that state. `offline.js` hides and guards
   its diagnostics button the same way. These checks fail *open* when no
   Assistant is on the page, so toolkit-only deployments are unaffected.

## 5. Defaults and compatibility

- Defaults are unchanged: every capability stays `true` when `modules` is
  omitted, `null`, partial, or non-boolean. Unknown keys are ignored.
- `state.capabilities` keeps its exact shape
  (`installation, diagnostics, recovery, failover, help, updates,
  chromeHandoff`).
- No public API was removed or renamed. `isCapabilityEnabled(name)` is new and
  additive; `disabledDiagnosticsResult()` is a new diagnostics export.
- Behavior change, opt-out configs only: with an Assistant present and
  `modules.diagnostics: false`, the *toolkit's* on-demand diagnostics also
  refuse to run (result `classification: 'disabled'`). This is the point of
  CD-1 — hiding a button while leaving the DoH transport reachable is a
  bypass — and it cannot affect configurations that omit the flag.

## 6. Test coverage

| Requirement | Test (all behavioral) |
| --- | --- |
| Each capability independently disabled | `packages/assistant-sdk/tests/sdk-capabilities.test.mjs` |
| All four disabled / all enabled | same |
| Missing or partial `modules` | same |
| Default behavior and backward compatibility | same, plus the existing 499-test baseline |
| Direct SDK calls while disabled | same (`runDiagnostics()` with an application-owned runner) |
| Widget and renderer attempts while disabled | `tests/assistant-widget.test.mjs` (capability block) |
| Indirect activation (events, callbacks, notices, background) | `tests/capability-enforcement.test.mjs` |
| Async / initialization-order edge cases | `sdk-capabilities.test.mjs` + `capability-enforcement.test.mjs` |
| No diagnostic network requests, incl. Cloudflare DoH | `tests/capability-enforcement.test.mjs` (counting `fetch`) |
| Recovery/failover cannot be bypassed | `sdk-capabilities.test.mjs` + widget tests |
| Help cannot be activated through another path | `sdk-capabilities.test.mjs` + widget tests |

Files and counts:

| File | Tests | Scope |
| --- | --- | --- |
| `packages/assistant-sdk/tests/sdk-capabilities.test.mjs` | 20 | policy, defaults, per-capability matrix, direct calls, indirect paths, async |
| `tests/capability-enforcement.test.mjs` | 12 | real `pwa.js` / DoH / offline shell with a counting `fetch` |
| `tests/assistant-widget.test.mjs` (CD-1 block) | 4 (58 in the file) | DOM renderer: rendering and click behavior |
| `tests/example-ui.test.mjs` | 15 (updated import assertion) | React example contract |

## 6.1 Verification evidence (2026-11-14, local)

| Check | Result |
| --- | --- |
| `npm test` (537 tests) | **537 pass / 0 fail** |
| `npm run test:sdk` | 128 pass / 0 fail |
| CD-1 capability suites (`sdk-capabilities`, `capability-enforcement`, `assistant-widget`) | 90 pass / 0 fail |
| `npm run check` (static contracts + package validation + full suite) | passed |
| `npm run check:precache` | pass — `4 of 13 precached assets changed … kit version 1.2.0 → 1.2.1 synchronized` |
| `npm run sync:sdk -- --check` | in sync |
| `npm run build` | 18 runtime/public files + `icons/` assembled |
| `validate-package.mjs` / `npm pack --dry-run` | passed (`@youge/assistant-sdk@0.2.0`, 24 files, publishing disabled) |
| `cd examples/example && npm run typecheck && npm run build` | passed |
| `git diff --check` | clean |
| `npm run verify` | not run: it requires a deployed URL and no deployment was made |

No browser or production deployment was exercised; all runtime evidence is
VM-level execution of the real classic sources.

## 7. Precache integrity and the owner-authorized kit bump

`assistant-state.js`, `assistant-widget.js`, `dns-diagnostics.js` and
`offline.js` are precached. CD-1 changes all four, so the diff-aware gate
requires a **synchronized kit-version bump** or installed apps keep serving the
old capability checks from cache.

The owner authorized the kit-only bump, and it is applied on this PR:

```
kit 1.2.0 → 1.2.1, synchronized in:
  src/runtime/you-ge-sw.js            const VERSION = '1.2.1'
  src/runtime/pwa.js                  PWA.version = '1.2.1'
  package.json                        version = 1.2.1
  packages/assistant-sdk/src/core/constants.js  KIT_COMPAT_VERSION = '1.2.1'
  src/assistant/assistant-state.js     regenerated bundle (npm run sync:sdk)
@youge/assistant-sdk stays 0.2.0 (separate release line, unchanged).
```

Gate result on this change:

```
precache integrity: 4 of 13 precached assets changed (assistant-state.js,
assistant-widget.js, dns-diagnostics.js, offline.js) since 2e19830;
kit version 1.2.0 → 1.2.1 synchronized
```

Current-version assertions were updated to `1.2.1` (worker version, cache
names, gate summary and `AGENTS.md` sync in `tests/identity-migration.test.mjs`;
the kit pin in `tests/example-theme.test.mjs`; `KIT_COMPAT_VERSION` in
`packages/assistant-sdk/tests/sdk-core.test.mjs`). The historical `1.2.0`
records — `CHANGELOG.md`, `PRECACHE_INTEGRITY.md` §7/§8, the compatibility
stage definitions — are untouched, no rule was weakened or skipped, and no test
was deleted. `PRECACHE_INTEGRITY.md` §9 records the bump.

No npm publish, tag, release, deployment or merge is part of CD-1.
