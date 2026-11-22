# SDK cross-origin recovery — progress report

Date: 2026-11-22
Repository: `sandro-defender/you-ge-assistant`
Task branch: `arena/b982ceb9-you-ge-assistant`
Original baseline: `82a1ba36f290889f37c56d7c282b0d0112a402be` on `main`
Draft PR: https://github.com/sandro-defender/you-ge-assistant/pull/55

## Executive summary

**The recovery feature is not complete or release-ready.** Phase 1 architecture and source inspection are documented; the owner approved proceeding. Phase 2 has two internal validation helpers and focused tests, but no functioning recovery controller, public recovery API, policy authority, authenticated session handling or navigation. The SDK remains at **0.4.0** in this checkout. The owner's later request to update to 0.4.1 has not yet been applied because the required synchronized kit-version bump has not been separately authorized; see Versioning below.

No package has been published, deployed, staged, tagged or released by this task; no Staff application changes were made. Nothing in this report claims the feature is ready for production or proves native-browser behavior.

## 1. Inspection and baseline

The SDK lives in `packages/assistant-sdk`. It ships ES modules from `src` with hand-maintained TypeScript declarations and explicit package exports. There is no SDK TypeScript build configuration. React is an optional peer. The baseline has `@youge/assistant-sdk` version 0.4.0 and kit compatibility 1.2.7.

The source inspection found existing domain/project resolution, configurable presentation capabilities, endpoint/session condition setters, delegated diagnostics, external-store bindings, action dispatch and assistant lifecycle management. It did **not** find an SDK-owned cross-origin switching controller, trusted environment/origin-pair configuration, verified global policy lifecycle, host session authorization contract or return-to-primary orchestration. Domain resolution and the existing last-known-good storage are not trusted recovery authorities.

The referenced `docs/architecture/assistant-sdk-cross-origin-recovery-change-request.md` and named Staff application protocol files were not present in this checkout. Their contents and the Staff protocol's compatibility with the proposed flow have not been verified.

Full inventory, proposed API, state machine, threat model, policy delivery design, compatibility analysis and open decisions are in `docs/architecture/assistant-sdk-cross-origin-recovery-phase1.md`. That document describes a **proposal**, not an implemented API. The checkout is shallow; local history before the baseline is not available.

## 2. Changes made

### Planning

- Added `docs/architecture/assistant-sdk-cross-origin-recovery-phase1.md` with the Phase 1 plan and outstanding decisions.
- Updated `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` with task status, blockers and next actions.
- Created draft PR #55, and previously updated its description to identify the partial implementation and blockers.

### Internal code

Added `packages/assistant-sdk/src/recovery/foundation.js`, which is **not exported from the package** or connected to an `AssistantInstance`:

- `validateRecoveryConfiguration` checks a finite environment list, explicit selected environment, project IDs, configuration revisions, unique origins and exact current origin/role membership. It requires canonical HTTPS origin strings and rejects paths, credentials, queries, fragments, wildcard hosts, duplicate origins, inconsistent project IDs and ambiguous environments. A successful result is detached from the input and frozen.
- `inspectVerifiedPolicy` checks **already-authenticated** claims against caller-supplied trusted project, environment, configuration revision, issuer, audience and minimum revision. It checks mode, revocation, issue/expiry times, a 30-second age limit, and wall/monotonic clock consistency; results are frozen. It does not perform cryptographic verification, establish whether an authority/checkpoint is trustworthy, obtain policy, persist trusted state or authorize a transition. The caller-supplied trust context must not be inferred from browser storage. The current 250 ms clock-difference tolerance and other prototype decisions need review with the real authority and runtime environment before integration.
- These helpers alone do not make an environment recovery-eligible. No credentials or real Staff data were used.

### Tests

Added `packages/assistant-sdk/tests/sdk-recovery-foundation.test.mjs` and `sdk-recovery-policy-foundation.test.mjs`. They exercise selected exact-origin/environment, rejection, immutability, policy scope, revision, revocation, expiry, freshness and clock cases using synthetic data. They test internal helpers, not an end-to-end recovery flow or cryptographic trust chain.

## 3. SDK issues discovered during inspection

1. **Shared state is mutable** — `packages/assistant-sdk/src/assistant/index.js`, `computeState`, `emit` and `getState`: consumer mutation of `a.getState().network.online` changes the shared snapshot without notification. Expected: consumers cannot silently alter observable state. Recommend a carefully compatible immutable/readonly snapshot strategy and regression tests. No correction has been implemented.
2. **React adapter can retain a destroyed instance** — `packages/assistant-sdk/src/adapters/react.js`, `createReactAdapter` / `resolveAssistant`: the cached instance is returned even after `isDestroyed()` becomes true, despite the external-store binding attempting re-resolution. Expected: documented, safe rebinding for auto-attached instances and explicit handling of destroyed supplied instances. Recommend tests covering remount, subscribers and rebinding. No correction has been implemented.
3. **Conflicting installation guidance** — `packages/assistant-sdk/README.md` says 0.4.0 is unpublished near the top but gives an unconditional `npm install @youge/assistant-sdk@0.4.0` example. Expected: install guidance consistent with verified current publication status. Correct after checking the registry during documentation/release review. No current npm registry status was verified for this report.

The Phase 1 plan contains reproducible evidence and further context. No workaround was added to Staff.

## 4. Tests and verification

- On the original baseline, `npm run test:sdk`: **150 passed, 0 failed**.
- After adding both helper test files, the previous turn ran `npm run check`: **649 passed, 0 failed**, after installing dependencies and building the three CI examples. The first attempt failed due to missing example dependencies/build outputs; it passed after that setup. Both consumer example typechecks/builds, the configuration playground build, package validation and browser bundle synchronization also passed in that turn. The browser build printed non-fatal warnings about classic scripts/runtime CSS.
- For this report, `npm run test:sdk`: **156 passed, 0 failed**; `node scripts/sync-sdk-browser.mjs --check`: passed; `node packages/assistant-sdk/scripts/validate-package.mjs`: passed for version 0.4.0.
- These results cover the current partial work, not the mandatory full recovery test matrix. No native Safari, Android, installed-PWA, cross-origin session, security penetration or real Staff integration acceptance testing was performed.

## 5. Security and design boundaries

The intended design consumes one administrator-controlled Automatic/Manual policy but validates authorization independently per environment. The plan proposes trusted independent policy delivery, environment-scoped verification, a bounded 30-second freshness window and fail-closed behavior when verification or a trustworthy revision checkpoint is unavailable. That is a design, not an operational delivery mechanism. A cached browser value is not an authority, and a short freshness window still permits revocation delay until its deadline unless a trusted invalidation arrives sooner.

The SDK must eventually serialize transition attempts, recheck epochs after asynchronous operations, use exact configured destination roots and expose only redacted state. A scheduled navigation cannot prove arrival or authentication. The host remains responsible for authorization, unsaved work, session preparation/redemption, destination validation and account continuity. Cross-origin cookie/storage sharing must not be assumed, and browser transport errors cannot reliably prove filtering.

The actual Staff protocol has not been reviewed. No compatibility assertion or incompatibility finding can be made until its reviewed design/source is supplied. Nothing here replaces or delegates the existing host-side controller.

## 6. Remaining work

Phase 2 still needs public types, integration into the Assistant architecture, immutable lifecycle state, typed events, epoch/deadline handling and robust negative tests. Later phases still need trusted policy delivery and cryptographic verification, failure confirmation and readiness, bounded retries and cancellation, a single exclusive controller and navigation executor, host authorization/session hooks, user-confirmed return, React and classic action ownership, accessibility, full compatibility coverage, documentation and security/release review. Complete the original mandatory test matrix and real-browser/device acceptance as appropriate.

A future Staff integration is a **separate authorized task** after the SDK is complete and reviewed; it must replace/delegate, not run alongside, the existing host controller. Specific integration instructions cannot yet be responsibly finalized because neither the SDK API nor host protocol compatibility exists.

## 7. Versioning and current blocker

The user requested SDK **0.4.1**. The package metadata and `SDK_VERSION` remain **0.4.0**. Updating `SDK_VERSION` also changes generated `src/assistant/assistant-state.js`; that file is precached. `docs/operations/PRECACHE_INTEGRITY.md` requires a strictly higher, synchronized kit version when a precached asset changes. `AGENTS.md` requires separate explicit owner authorization for that kit-version bump and prohibits bypassing or weakening the gate. Authorizing SDK 0.4.1 alone does not specify or explicitly authorize a kit-version bump, so the version change is blocked rather than leaving inconsistent metadata or a failing/stale bundle. No release is implied by a version bump. The request's 0.4.1 choice should not be treated as evidence that this incomplete capability is patch-compatible or release-ready.

**Owner action:** explicitly authorize a synchronized kit-version bump and specify the desired kit version, in addition to the requested SDK 0.4.1. Separately provide the missing change-request and reviewed Staff protocol materials before authenticated navigation is implemented.

## 8. Branch and handoff state

The remote draft PR head was `9a39bfe39f92d37010a5ca5cc3a3b4859e9bf3fb` when checked in this turn. The current sandbox reports local `HEAD` at the original baseline while showing the previously completed task files as uncommitted working-tree changes. The contents have been preserved; no reset, force push or branch switch was performed. This report is a workspace change and is not claimed to have been pushed. Reconcile the local snapshot with the existing PR head safely before any future commit/push, preserving all changes.
