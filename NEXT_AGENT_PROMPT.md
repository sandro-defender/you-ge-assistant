# Next Agent Prompt — Post-Phase 2 Next Step (Owner-Selected)

**Repository:** `sandro-defender/you-ge-assistant` (`/home/user/you-ge-assistant`)
**Prerequisite:** PR #28 (Phase 2 — Stage 4) merged by the owner into `main`; start from the then-current `main`.

---

## Objective

Phase 2 (Stages 1–4 in `PHASE2_IMPLEMENTATION_PLAN.md`) is complete upon merge of **PR #28**. Before editing code, inspect `git status --short --branch`, `git rev-parse HEAD`, `gh pr list --state open`, `AGENTS.md`, and `AGENT_HANDOFF.md`, confirm PR #28 is merged, and verify which owner-authorized track is requested:

1. **Track A — Identity Cleanup, Stage 2** (*requires explicit owner authorization*): retire `reference/` (`Script.js`, `Script.decompiled.js`, `progressier*.json`, `reference/README.md`) and `PARITY.md`, and update `scripts/check.mjs` `originalReference` checks cleanly while keeping all required Progressier technical compatibility contracts intact.
2. **Track B — Roadmap Phase 3: Dashboard & Hosted Control Plane Foundation** (`ASSISTANT_ARCHITECTURE.md` §12): scope the first small PR for project/domain registration UI, admin auth boundary, and schema-versioned `publishedConfig` output (`schemaVersion: 1`, data-only JSON).

**Do not merge PR #28, publish packages, bump versions, create releases, or retire `reference/`/`PARITY.md` unless explicitly authorized by the user.**

---

## Verification Baseline to Preserve

Run and report only actually executed checks:
- `git diff --check`
- `node scripts/sync-sdk-browser.mjs --check`
- `node packages/assistant-sdk/scripts/validate-package.mjs`
- `npm run test:sdk`
- `npm run check`

---

## Stage 4 result (for reference)

Stage 4 shipped in PR #28 (`fix(assistant): unify service worker update lifecycle`): `requestPwaUpdate(options)` in `installation/index.{js,d.ts}`, `AssistantInstance.applyUpdate()` guarded by `config.modules.updates !== false`, renderer `update` action delegation in `assistant-widget.js` and `adapters/react.js` (with bare `PWA` mock fallback), stale `updateAvailable` reconciliation when no waiting worker remains, `pwa.js` waiting-worker/reload-loop fixes, synchronized `assistant-state.js`, and 12 new deterministic behavioral/integration tests (`npm run check` green at 377/377). Preserve all of it.
