# Post-Phase 2 Architecture Review & Next-Phase Proposal

**Review date:** 2026-11-14
**Reviewed state:** `main` @ `180fe456c6b91bbff5e88b80ce88c0ad7c1ffaf0` (PR #28 merged 2026-11-14 10:13:34 UTC)
**Scope:** Documentation and architecture audit only. No runtime, SDK, test, workflow, dependency or package change is included in this review.
**Excluded by instruction:** dashboards, DNS failover, alternate-domain recovery, `staff.you.ge` integration.

---

## 1. Verified repository state

| Item | Verified value |
| --- | --- |
| `main` head | `180fe45` — *Merge pull request #28 from sandro-defender/arena/9d1c3eef-you-ge-assistant* |
| PR #28 | `MERGED`, head `3c12c9f`, merge commit `180fe45`, 19 files, +1169/−139 |
| Open PRs | none |
| Working tree | clean at review start; review writes docs only |
| CI on `180fe45` | `check` + `pages` — success (runs `43584261202`, `43584261201`) |
| CI on PR #28 head | `check` success on `8ff426c` and on docs head `3c12c9f` |
| Version | kit `1.1.0` (`progressier.js:18`, `pwa.js:3291`), SDK `0.2.0` in-repo (`core/constants.js:5`) |

Locally executed in this review: `npm run check` (**377/377 pass**, `All checks passed.`, `SDK package validation passed.`), `node scripts/sync-sdk-browser.mjs --check` (in sync), `git diff --check` (clean), `example/` `npm ci && npm run typecheck && npm run build` (pass; artifacts removed afterwards).

**Handoff accuracy at review start — stale.** `AGENT_HANDOFF.md` still described PR #28 as *open, awaiting owner merge*, with base commit `e2f8be0` and active branch `arena/9d1c3eef-you-ge-assistant`. `NEXT_AGENT_PROMPT.md` still said “Do not merge PR #28”. Corrected by this review.

---

## 2. Phase 2 completion assessment

All four stages are implemented, tested and merged; the merged code matches the plan, and the Stage 4 claim of 12 new behavioural tests is exact (4 + 1 + 6 + 1).

| Stage | PR | Merge | Verdict |
| --- | --- | --- | --- |
| 1 — SDK TypeScript contracts & subpath docs | #25 | `ee83c0e` | **Complete.** All four planned `.d.ts`/README drifts closed; export-parity test added. |
| 2 — Probe path safety, subpath resolution, local/IP hosts | #26 | `fe1854b` | **Complete.** `backendProbePath` now resolves against `basePath`; body parsing moved inside the `timeoutMs`/controller scope; `diagnostics` probe paths validated with ESM↔classic parity; localhost/IP-literal handling added. |
| 3 — Diagnostics state sync, classification, cancellation | #27 | `e2f8be0` | **Complete.** Rejection path now dispatches `pwa:diagnostics`; `online && !validDns && !app.ok` classifies as `application_host_unavailable`; `configure()` resets DNS state; `AbortSignal` support with dedup isolation. |
| 4 — Unified service-worker update lifecycle | #28 | `180fe45` | **Complete.** `requestPwaUpdate()` + `AssistantInstance.applyUpdate()`, renderer delegation with bare-`PWA` fallback, stale-`updateAvailable` reconciliation, `pwa.js` waiting-worker tracking, `assistant-state.js` regenerated. |

Backward compatibility was preserved: `window.PWA`, `window.progressier`, `/progressier.js`, `SKIP_WAITING`, `.progressier-*` selectors, `--progressier*` variables, compatibility cookies/IndexedDB stores and manifest `id` are untouched. `/progressier.js` was not modified in Phase 2 at all (`git log 59bcb9a..180fe45 -- progressier.js` is empty). SDK core invariants still hold (no `fetch`, no `serviceWorker.register`, no `setInterval`, no React import — enforced by `packages/assistant-sdk/tests/sdk-integrations.test.mjs:197`).

---

## 3. Confirmed defects

Severity reflects user-visible impact and blast radius, not effort.

### D1 — High: a stale diagnostics run detaches the *current* run, losing caller cancellation

`packages/assistant-sdk/src/diagnostics/index.js` keeps run ownership in single shared mutable slots (`runController`, `detachRun` — declared at lines 113–114, reassigned at 155/170), while every run's finalizer unconditionally calls the module-level `detach()` (line 217 → 119–125).

Interleaving: run A starts → `clear()` (line 224, e.g. `configure()` on a project/domain change at `assistant/index.js:705`, or `destroy()` at `:945`) → run B starts → run A settles late → A's finalizer calls `detach()`, which now clears **B's** `detachRun`/`runController`.

Evidence (executed against the real module):

```
runs started = 2
before clear(): run2 signal aborted = false
after clear():  run2 signal aborted = false   ← destroy() can no longer cancel the owned run
```

and with a caller signal at the same interleaving:

```
after run2 start:         caller listeners = 1
after run1 late settle:   caller listeners = 0   ← run2 lost its caller listener
after caller.abort():     run2 runner signal aborted = false
```

Consequences: a user-cancelled check keeps probing; `destroy()` no longer guarantees abortion of the owned run, contradicting `packages/assistant-sdk/README.md:378` (“`destroy()` aborts any run still in flight”); a runner that ignores its signal leaves the caller's promise pending forever. `generation` still prevents late *results* from being published, so state is not corrupted — the defect is cancellation, not staleness. Existing tests (`sdk-integrations.test.mjs:337`, `:363`) cover the single-run cases only and never interleave two runs.

### D2 — Medium: `modules.updates: false` still raises an “App update available” notice with a dead button

`packages/assistant-sdk/src/assistant/index.js:446` adds the `app:update` notification gated only on `network.updateAvailable`, whereas the matching action at `:510` is gated on `config.modules.updates`. `assistant-widget.js:493–503` renders a button for *any* `notice.actionId`, and `NOTICE_ACTION_HOOKS` (`assistant-widget.js:61–64`) has no `update` entry, so the button carries `data-action="update"` and reaches `handleAction` (`:852–858`), which calls `applyUpdate()` and receives `disabled` — nothing happens.

Evidence (executed):

```
modules.updates=false -> {"applied":false,"outcome":"disabled"}   pwa.applyUpdate calls = 0
   updateAvailable: true   notifications: [ 'install:available/4', 'app:update/5' ]   actions: [ 'install', 'diagnostics' ]
```

The notice therefore advertises an action that is deliberately absent, and `updateAvailable`/`badge.count` report an update the project has disabled.

### D3 — Medium: public IP-literal hosts are described as “local development hosts”

`dns-diagnostics.js:42–47` treats **every** IPv4 literal as a local host, and the local branch at `:331–340` always emits “This is a local development host…”. Verified classification of literals: `8.8.8.8`, `203.0.113.10`, `1.1.1.1` → `ip` (i.e. local). A project served from a public IP literal gets “local development host” wording and DoH is skipped, which is defensible for DoH but wrong for the message. `DNS_RECOVERY.md:113` documents the same over-broad rule.

### D4 — Low: the declared `cancelled` field is never published in state

`DnsDiagnosticSnapshot` declares `cancelled?: boolean` (`diagnostics/index.d.ts:8`), but `normalizeDnsResult()` (`diagnostics/index.js:61–71`) rebuilds the record from a fixed shape and drops it:

```
raw       : {"status":"cancelled","classification":"cancelled","cancelled":true,"failed":false,...}
normalized: {"status":"cancelled","classification":"cancelled","message":"stopped","checkedAt":"...","failed":false}
```

`assistant/index.js:883` routes `pwa:diagnostics`/`runDiagnostics` through this normaliser, so `assistant.getState().network.dns.cancelled` is always `undefined`. No wrong notice results today (`classification: 'cancelled'` is preserved and is in neither failure list), so this is a contract/type mismatch rather than a behavioural bug.

### D5 — Low: `requestPwaUpdate()` can return an outcome outside its declared union

`installation/index.js:106–108` forwards any non-empty runtime `outcome` string verbatim, while `UpdateApplyOutcome` (`installation/index.d.ts`) declares exactly five values.

```
requestPwaUpdate({pwa:{applyUpdate: async () => ({applied:false, outcome:'totally-custom'})}})
→ {"applied":false,"outcome":"totally-custom"}
```

Consumer `switch` statements narrow on the union and will not handle the value. No known producer emits such a string today, so this is latent.

### D6 — Low: a DNS verdict survives a base-path change on the same host and project

`dnsIdentity()` (`assistant/index.js:675–678`) compares `{ id, hostname, origin }` only, so `basePath` changes do not invalidate the result, even though the project model treats `example.com/portal/` and `example.com/other/` as separate apps (`MULTI_DOMAIN.md`). Evidence (executed):

```
dns before: normal_connectivity
basePath after configure: /portal/
dns after basePath change: normal_connectivity  (message: "checked /portal/")
```

Probe paths (`diagnostics.appProbePath` / `backendProbePath`) are likewise absent from the identity.

---

## 4. Meaningful architectural risks

### R1 — Precache content changed without a kit version bump

Phase 2 changed four files that `/progressier.js` precaches (`progressier.js:311–325`): `dns-diagnostics.js`, `domain-config.js`, `assistant-state.js`, `assistant-widget.js`. `VERSION` stayed `1.1.0` in both `progressier.js:18` and `pwa.js:3291`, and `progressier.js` itself is byte-identical to its pre-Phase-2 state — so no new worker is installed and the `install` precache never re-runs. `AGENTS.md:677–679` requires a joint version bump exactly for this case. Impact is bounded but real: `staleWhileRevalidate()` (`progressier.js:432–454`) returns the cached copy and refreshes in the background, so online users see one stale load; offline users, or anyone whose cached copy is never re-fetched, keep the pre-Phase-2 files. No automated gate currently ties precached-file changes to a version bump.

### R2 — Renderer/state contract is enforced by regex, not by the compiler

`packages/assistant-sdk/tests/sdk-declarations.test.mjs` asserts declaration coverage with regular expressions and `extractInterfaceBody` string slicing. CI's real `tsc` run (`example/`) imports only `@youge/assistant-sdk` and `@youge/assistant-sdk/react`; the `./domain`, `./diagnostics`, `./installation`, `./browser` and `./theme` declaration files are never type-checked by CI. A strict manual `tsc --noEmit` over those subpaths in this review passed, so the current files are sound — the risk is that a future regression in them would not be caught.

### R3 — `pwa.js` update bookkeeping is intentionally redundant, and undocumented as such

`updateWorker` (`pwa.js:206`) is only read as a change-detection sentinel in `clearUpdateState()` (`:223`); it never influences `getState()` or any decision. `isUpdateAvailable()` (`:242–253`) also mutates `sawWaitingWorker`/`updateWorker` as a side effect of being read from `getState()`. Behaviour is correct (`clearUpdateState(false)` does not emit), but the invariants “sentinel only” and “getState may mutate” are recorded nowhere, so a future edit can easily turn them into a bug.

### R4 — Two independent update-state sources with no reconciliation owner

`conditions.updateAvailable` (SDK), `pwa.js` `updateAvailable`/`sawWaitingWorker`, and `PWA.getState().hasUpdate` all exist, with reconciliation split across `computeState()` (`assistant/index.js:521–536`), the `onChange` bridge (`:636–651`) and `applyUpdate()` (`:826–845`). Stage 4 made the transitions consistent and tested them, but the ownership is still implicit: any third path that sets `conditions.updateAvailable` (for example `setUpdateAvailable()` at `:797`) can drift from the runtime.

### R5 — No browser-level verification anywhere in the pipeline

Every service-worker, presentation and lifecycle assertion is mocks/VM-based (`tests/install-experience.test.mjs`, `tests/assistant-widget.test.mjs`, `tests/sdk-integration.test.mjs`). `scripts/verify-deployment.mjs` is the only real-network check and needs a live URL, so it is manual and was not run. `check.yml` and `pages.yml` contain no browser runner, and `reference`-era compatibility is asserted by string matching only. Genuine browser behaviour — `controllerchange` timing, `SKIP_WAITING` handoff, iOS standalone, real install prompts — is unverified by automation.

---

## 5. Test and verification gaps

1. **No test interleaves two diagnostics runs across `clear()`.** D1 reproduces in four lines; the two existing cancellation tests each use a single run.
2. **No test asserts the `modules.updates: false` notification surface.** `sdk-integrations.test.mjs:499` asserts only that `applyUpdate()` returns `disabled`; nothing checks `notifications`/`availableActions`/`badge` consistency (D2).
3. **No test covers public IPv4 literals**; the local-host suite uses `localhost`, `*.localhost`, `127.0.0.1`, `[::1]` only (`tests/dns-diagnostics.test.mjs:219–246`).
4. **No test asserts `network.dns.cancelled`** even though the declaration publishes it (D4).
5. **No test covers a `basePath` change** for DNS identity (D6); `tests/assistant-widget.test.mjs:1287` and `:1328` cover project-id and hostname changes.
6. **No test compares `requestPwaUpdate()` output against the declared union** (D5).
7. **No CI step type-checks the five non-React SDK subpaths** (R2).
8. **No offline/service-worker integration test**: the precache list, cache naming, and version-bump rule are asserted as source strings (`scripts/check.mjs:236–339`), never as behaviour.

---

## 6. Optional cleanup

- `pwa:ready` is emitted (`pwa.js:3608`) and consumed by the SDK (`core/constants.js:38`, `assistant/index.js:906`), but is missing from the AGENTS.md §8 event table (`AGENTS.md:560–571`) and the README event block (`README.md:503–512`).
- `AGENTS.md:675–687` documents the version-bump rule and rollback, but no documentation states which files are precached, so the rule cannot be applied without reading `progressier.js`.
- `pwa.js` still carries source comments that narrate Progressier behaviour (`:420` legacy manifest replacement, `:1384` `?pwaredirect=`, `:1744` cookie names, `:3042` query matching, `:3334` IndexedDB store, `:3397` shim). All describe preserved compatibility contracts and should stay; the wording is accurate.
- `pwa.css:99` (“Retained from Progressier's toolbox stylesheet”) is an accurate provenance note, not branding drift.
- `README.md:458–464` and `AGENTS.md:521–522` document `PWA.applyUpdate()`/`hasUpdate()` but not the SDK-level `applyUpdate()` / `update`-action delegation that Stage 4 added; that exists only in `packages/assistant-sdk/README.md:380`.

## 7. Progressier branding status

> **Superseded in part (precache integrity and identity cleanup PR, 2026-11-14).** The §6 view that the `pwa.js` and `pwa.css` provenance comments "should stay" no longer applies: the `pwa.js` comments were rewritten to describe legacy You.Ge Assistant compatibility contracts, and the two `pwa.css` comments (`:85`, `:99`) were replaced with the owner-authorized kit `1.1.1` bump. The R1 finding in §5 is enforced by `scripts/precache-integrity.mjs` and resolved for existing installations by that bump. Current state: [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md) and [`PRECACHE_INTEGRITY.md`](PRECACHE_INTEGRITY.md). The text below is the original point-in-time record.

Audited all shipped `.js`/`.css`/`.html`/`.webmanifest`/`.md` outside `reference/`. **No obsolete product branding remains in user-facing output.** Every remaining occurrence is one of:

- a preserved compatibility contract (`/progressier.js`, `window.progressier`, `.progressier-*`, `--progressier*`, `progressierinstallbanner`, `progressierpushbanner`, `progressierSavedPushNotifications`, `progressiersharedfiles`, manifest `id` `/HIPSBNVemXtM8VMwRfWs`, `progressier.app`/`.com` legacy-manifest scrub at `pwa.js:420`);
- an accurate provenance comment, listed in §6;
- historical record (`CHANGELOG.md`, `*_AUDIT.md`, `PHASE1_AUDIT_PLAN.md`, `PHASE2_IMPLEMENTATION_PLAN.md`, `PARITY.md`, `reference/`).

`demo/index.html:142,255` still uses `.progressier-install-button` — a compatibility selector, correctly kept. Identity surfaces (`package.json`, `manifest.webmanifest`, `demo/manifest.webmanifest`, `snippet.html`, `offline.html`, page titles) are consistently You.Ge Assistant, and `tests/foundation-contracts.test.mjs` locks that in.

**Identity Cleanup Stage 2** (`reference/` and `PARITY.md`) remains pending and, per the standing constraint, is **not** proposed here without separate owner approval. Note that retiring either requires editing `scripts/check.mjs:117–121` and `:233–240,336`.

## 8. Future enhancements (not currently necessary)

- A real-browser smoke suite (Playwright) for install/update/diagnostics flows.
- Publishing `@youge/assistant-sdk@0.2.0` (prepared, unblocked, owner-dispatched).
- Anything from the roadmap's Phase 3/4/5 — explicitly out of scope for this review.

---

## 9. Recommended next phase

### Objective

**Phase 2.1 — Phase 2 correctness and release-hygiene closure.** Fix the confirmed defects that Phase 2 introduced or left visible (D1–D6), close the two gaps that make them likely to recur (R1, R2), and leave Phase 3 unblocked by a clean baseline.

### Why this should be next

The defects above are in code merged hours ago and are cheap to fix at their source. D1 breaks a documented guarantee (`destroy()` aborts in-flight diagnostics) and silently disables cancellation; D2 shows the user an update button that provably does nothing; D3 mislabels a production host as a development one. Building a dashboard/hosted control plane on top of that would multiply the surfaces carrying the same three-state update model and the same run-ownership slot pattern. Every item is a small, local change to files the team has just touched, with tests that already exist to extend — no new dependency, no restructuring, no public-API break.

### Scope

In scope: D1–D6, R1 (gate + version decision), R2 (type-check the five subpaths), and the `pwa:ready` documentation gap.

Out of scope (unchanged unless separately authorized): Phase 3 dashboard / hosted control plane, DNS failover, alternate-domain recovery, `staff.you.ge`, Identity Cleanup Stage 2 (`reference/`, `PARITY.md`), npm publish, dependency additions, any redesign of working architecture.

### Suggested stages (one small PR each, independently verifiable)

**Stage 5.1 — Diagnostics run ownership (D1)**
Replace the shared `runController`/`detachRun` slots with a per-run record (`{ controller, detach, generation }`) so a stale finalizer can only retire its own run; keep `generation` semantics and single-flight behaviour untouched.
Files: `packages/assistant-sdk/src/diagnostics/index.js`, `assistant-state.js` (via `npm run sync:sdk`), `packages/assistant-sdk/tests/sdk-integrations.test.mjs`.
Acceptance: a new test reproduces the interleaving (run A → `clear()` → run B → A settles late) and asserts (a) run B's runner signal still aborts on `clear()`, (b) run B's caller signal still aborts the runner, (c) no late result is published. Existing cancellation tests unchanged and green.

**Stage 5.2 — Update-state gating consistency (D2)**
Gate the `app:update` notice on `config.modules.updates` (matching `:510`), keep `updateAvailable` truthful for any `modules.updates: false` project, and make the widget drop a notice action button whose action is not in `availableActions`.
Files: `packages/assistant-sdk/src/assistant/index.js`, `assistant-widget.js`, `assistant-state.js`, `packages/assistant-sdk/README.md`, tests in `packages/assistant-sdk/tests/sdk-integrations.test.mjs` and `tests/assistant-widget.test.mjs`.
Acceptance: `modules.updates: false` yields no `app:update` notice, no `update` action and no rendered dead button; `modules.updates: true` behaviour byte-identical to today's tests.

**Stage 5.3 — DNS verdict and host-classification accuracy (D3, D6)**
Add `basePath` and the resolved probe paths to `dnsIdentity()`; split “local development host” from “IP-literal host” in `dns-diagnostics.js` messaging while keeping the DoH-skip rule for all literals (or, if the owner prefers, keep the skip and only correct the wording).
Files: `packages/assistant-sdk/src/assistant/index.js`, `dns-diagnostics.js`, `DNS_RECOVERY.md`, `assistant-state.js`, `tests/dns-diagnostics.test.mjs`, `tests/assistant-widget.test.mjs`.
Acceptance: a public literal host no longer reports “local development host”; `basePath` change resets `network.dns` to `idle`; all 22 existing DNS tests unchanged and green.

**Stage 5.4 — Contract and release hygiene (D4, D5, R1, R2, docs)**
Publish `cancelled` through `normalizeDnsResult()`; validate `requestPwaUpdate()` outcomes against the declared union; add a `check.mjs` gate (or an equivalent documented rule) tying precached-file changes to a `VERSION` bump; extend the CI type-check to the five non-React subpaths; document `pwa:ready`.
Files: `packages/assistant-sdk/src/diagnostics/index.js`, `packages/assistant-sdk/src/installation/index.js`, `scripts/check.mjs`, `.github/workflows/check.yml`, `AGENTS.md`, `README.md`, plus tests.
Note: the `VERSION` bump itself is a version change and needs **explicit owner authorization**; the stage can ship the gate first and let the owner decide the bump.
Acceptance: `npm run check` green with the new gates; `tsc` covers all subpaths; no runtime behaviour change other than the added `cancelled` field.

### Dependencies and prerequisites

Stage 5.1 is independent. 5.2 depends on 5.1 only for a clean `assistant/index.js` baseline (not strictly). 5.3 is independent but should follow 5.1 to avoid rebasing `assistant-state.js` twice. 5.4 last, because it touches `check.mjs` and CI for every stage before it. No external prerequisite, no network access, no new dependency.

### Risks and backward compatibility

- **Public API:** 5.1 and 5.3 are internal. 5.2 changes `notifications`/`availableActions` output only for `modules.updates: false`, which is currently contradictory — treat as a bug fix, not a contract change. 5.4 is additive (`cancelled`) plus a hardening of returned values to the already-declared union.
- **Compatibility contracts:** none of the stages touches `/progressier.js`, `window.PWA`, `window.progressier`, `SKIP_WAITING`, `.progressier-*`, `--progressier*`, storage keys or manifest `id`. Stage 5.4's version bump touches `progressier.js:18` and `pwa.js:3291` only.
- **`assistant-state.js` churn:** stages 5.1–5.3 each regenerate it; land them sequentially to keep the sync gate meaningful.
- **Regression risk** concentrates in the diagnostics controller (concurrency) — mitigate with the new interleaving test plus the existing 377-test suite.

### Acceptance criteria for the phase

`npm run check` green with no weakened assertions; `sync --check`, `validate-package.mjs`, `git diff --check` clean; `example/` typecheck + build green; D1–D6 each covered by at least one new deterministic test that fails before the change; no new dependency; no public-API break other than the enumerated fixes.
