# Next Agent Prompt — Audit Existing Diagnostics & Author `PHASE2_IMPLEMENTATION_PLAN.md`

**Repository:** `sandro-defender/you-ge-assistant` (`/home/user/you-ge-assistant`)
**Branch:** `arena/8f493271-you-ge-assistant` (base: `main` @ `829449057bc63d2b09aa4470da44df03482b3c57`)

---

## Objective

Complete **one small, documentation-only task**: audit the repository's existing diagnostics, recovery, and update/type contracts and author `PHASE2_IMPLEMENTATION_PLAN.md` at the repository root.

**Do not implement Phase 2 features, delete `reference/`/`PARITY.md`, edit source code, modify tests, bump versions, or touch CI/release workflows.**

---

## Startup & State Verification

1. Read `AGENTS.md` (including **Repository Development Rules** and the **Permanent You.Ge Assistant Identity Rule**), `AGENT_HANDOFF.md`, and `PHASE1_AUDIT_PLAN.md` first.
2. Verify live Git state before acting:
   - `git status --short --branch`
   - `git rev-parse HEAD`
   - `gh pr list --state open`
3. Stay strictly on branch `arena/8f493271-you-ge-assistant`. Preserve all uncommitted edits already on the branch. Never switch branches, force-push, merge, tag, release, or publish.

---

## Exact Scope

Perform targeted inspection of only the relevant files:
- `ASSISTANT_ARCHITECTURE.md` (§5, §9, §12)
- `DNS_RECOVERY.md`
- `dns-diagnostics.js`
- `pwa.js` (`runNetworkDiagnostics`, `applyUpdate`, `getState`, `isUpdateAvailable`)
- `packages/assistant-sdk/src/diagnostics/index.{js,d.ts}`
- `packages/assistant-sdk/src/assistant/index.js`
- `packages/assistant-sdk/src/installation/index.{js,d.ts}`
- `packages/assistant-sdk/src/index.{js,d.ts}` and `packages/assistant-sdk/README.md`
- `packages/assistant-sdk/tests/sdk-integrations.test.mjs`, `tests/dns-diagnostics.test.mjs`, `tests/assistant-widget.test.mjs` (targeted inspection of diagnostics/update coverage only)

Author `PHASE2_IMPLEMENTATION_PLAN.md` covering:
1. **Audit baseline:** date, branch, base commit SHA, and verified baseline check state.
2. **Already implemented & tested (do not duplicate):**
   - Single-flight diagnostics deduplication (`src/diagnostics/index.js` + `dns-diagnostics.js`).
   - Waiting Service Worker `hasUpdate` snapshot seeding and `applyUpdate` integration (`pwa.js` + `src/assistant/index.js`).
   - Android in-app Chrome handoff (`src/browser/index.js` — distinct from browser diagnostics).
   - Classic on-demand Cloudflare DoH + same-origin probe engine (`dns-diagnostics.js`).
3. **Verified gaps & small staged deliverables for Phase 2:** break Phase 2 into small, independently verifiable stages (one focused PR/task per stage), covering any remaining diagnostics/recovery gaps in `@youge/assistant-sdk` and verified `.d.ts`/README drift (`PwaRuntimeLike.getState().hasUpdate`, `YouGeAssistantStatic` / `AssistantConfigSummary` theme typings, `./theme` in `packages/assistant-sdk/README.md`).
4. **Compatibility & security boundaries:**
   - Zero runtime dependencies, no `fetch`, no `serviceWorker.register`, and no `setInterval` in SDK core unless an explicit architecture boundary changes.
   - No hardcoded `staff.you.ge` or `workers.dev` URLs; no secrets; Cloudflare DoH caveats preserved.
   - Preserve `window.PWA`, `window.progressier`, `/progressier.js`, and `assistant-state.js` sync via `npm run sync:sdk`.
5. **Explicit non-goals:** Phase 3 dashboard, Phase 4 automatic API failover / write replay, Phase 5 `staff.you.ge` pilot, UI redesigns, Stage 2 `reference/`/`PARITY.md` removal, or `@youge/assistant-sdk` release/publish.

After authoring `PHASE2_IMPLEMENTATION_PLAN.md`, update `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` to reflect completion of the Phase 2 plan and point `NEXT_AGENT_PROMPT.md` to **Phase 2 — Stage 1** (pending owner approval).

---

## Acceptance Criteria & Focused Checks

- `PHASE2_IMPLEMENTATION_PLAN.md` exists at the repository root and matches verified symbols/paths on disk.
- `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` are updated and consistent with live Git state.
- Zero changes to `.js`, `.ts`, `.css`, `.html`, `.json`, or `.yml` files.
- Run and summarize only focused checks:
  - `git status --short --branch`
  - `git diff --check`
  - `node scripts/check.mjs`
  - `node packages/assistant-sdk/scripts/validate-package.mjs`

---

## Token-Efficiency & Skill Rules

- Read only relevant files/sections; never dump full files or passing logs.
- For this documentation-only task, UI skills (`mobile-native`, `break-ui`) do not apply and `tdd` does not apply until Stage 1 implementation; do not install new skills or claim unused skills were applied.
- Report unrun checks honestly (`example/` build without `node_modules`, `npm run verify`, lint).

---

## Stop Conditions

- Stop immediately once `PHASE2_IMPLEMENTATION_PLAN.md`, `AGENT_HANDOFF.md`, and `NEXT_AGENT_PROMPT.md` are written and verified.
- Do **not** begin implementing Stage 1 of Phase 2, commit/push unless explicitly instructed, open a PR unless requested, or merge/publish/release.
