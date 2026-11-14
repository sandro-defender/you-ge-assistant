# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base:** `main` at `63c703e956d8eea197220cc0b491110335e5610b` (PR #34 merged)
**Branch:** `arena/62503a48-you-ge-assistant` (active)
**PR:** [#35 — Precache integrity gate, all-or-nothing worker install and Progressier identity cleanup](https://github.com/sandro-defender/you-ge-assistant/pull/35), open for owner review; do not merge.
**CI:** statuses are per head. Query `gh pr checks 35`; do not rely on a result recorded here for a later commit.

## Verified repository / PR state

- PR #34 (Stage 5.4) is **merged** at `63c703e`. Post-merge `check` (run `43600130551`) and `pages` (run `43600130589`) passed on `63c703e`.
- PR #33 is **closed without merging** (closed 2026-11-14T13:30:32Z, head `5d3f145`). It touched only `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md`; both were rewritten by #34, and the facts it recorded (#32 merged, Stage 5.4 unblocked) are in `main`. Nothing from it is missing.
- PR #32 is merged at `bcdca6e`.
- The previous handoff files were stale (they described #34 and #33 as open); this file replaces them.
- Worktree was clean at the start; no owner work was overwritten. No force-push, reset or history rewrite.

## Completed in PR #35

**Service-worker install (defect fixed).** `progressier.js` used `Promise.allSettled()` over `cache.add()`, so a precache failure was swallowed: an update that lost the network mid-install still succeeded with an incomplete `static:v<next>` cache and activation deleted the complete previous one. Install now fetches the whole list (`cache: 'reload'`) and stores it only when every asset is answered. 4xx = optional file not deployed (skipped, as before); network failure or 5xx = install rejected, browser retries, installed version keeps its shell. Cache names, no-`skipWaiting`-on-install, `SKIP_WAITING`, activation and fetch strategies are unchanged.

**Diff-aware gate.** `scripts/precache-integrity.mjs` reads the precache list by running the worker's install handler in a VM (base and working tree), diffs from `git merge-base <base> HEAD`, and fails when a precached file is modified / added / removed / renamed without a synchronized strictly higher kit version, when `progressier.js` `VERSION`, `pwa.js` `PWA.version` and root `package.json` `version` disagree, when the version goes backwards, or when a listed asset is missing. Runs inside `scripts/check.mjs` (existing CI step, `fetch-depth: 0`, `PRECACHE_INTEGRITY_BASE` = PR base or pre-push commit) and as `npm run check:precache`. `check.mjs` no longer has its own precache list.

**Identity cleanup.** Reworded remaining Progressier product wording in `pwa.js` and `progressier.js` comments, `scripts/check.mjs` and `scripts/verify-deployment.mjs` messages, `AGENTS.md`, `ARCHITECTURE_AUDIT.md`, `FOUNDATION_AUDIT.md`, `PARITY.md`, `reference/README.md`, demo/example selector labels. No identifier, selector, storage key, path or API was renamed.

**Documentation.** New `PRECACHE_INTEGRITY.md` (architecture, lifecycle guarantees, gate, version proposal) and `COMPATIBILITY_CONTRACTS.md` (every Progressier-named technical identifier: purpose, reason, migration status, audit commands). `AGENTS.md` gained the sole-identity and accurate-reporting rules and the gate reference; its legacy theme-variable list was corrected to the 15 variables the runtime reads.

## R1 status

- Prevention: **resolved** (gate).
- Lifecycle defect: **fixed**.
- Historical drift under kit `1.1.0`: **awaits owner authorization**. R1 is not fully closed.

## Owner decisions requested

1. **Synchronized kit-version bump** `1.1.0` → `1.1.1` (or `1.2.0`). Not applied. Exact files, cache behaviour, risks and tests: `PRECACHE_INTEGRITY.md` §6. Includes the open question of the SDK version, because the bump edits `KIT_COMPAT_VERSION` in SDK source.
2. **Merging #35 is itself a cache refresh.** It changes `progressier.js`; the Pages deployment on `main` makes browsers install the new worker, which re-fetches the whole precache into the existing `v1.1.0` cache and shows one update notice.
3. **Repository settings** still carry the old identity (not tracked files, so not changed): description "Self-hosted, Progressier-compatible PWA kit…" and topic `progressier`. Suggested:
   `gh repo edit sandro-defender/you-ge-assistant --description "You.Ge Assistant: dependency-free multi-domain PWA toolkit and SDK — install UI, offline, sharing, push, badges, QR and diagnostics." --remove-topic progressier --add-topic you-ge-assistant`
4. **`reference/` and `PARITY.md`** retirement or restructuring (unchanged rule: separate approval; also needs edits to `scripts/check.mjs`).

## Pending work blocked by decision 1

`pwa.css` is precached, so the gate rejects these comment edits without the bump. Apply them in the bump change:

- `pwa.css:85` — ` * Floating install toolbox (original Progressier-style app icon)` → ` * Floating install toolbox (app-icon launcher; legacy placement preserved)`
- `pwa.css:99` — `/* Retained from Progressier's toolbox stylesheet; its legacy caller is optional. */` → `/* Legacy scroll-lock helper kept for existing integrations; its caller is optional. */`

These are the only known obsolete-branding lines left in tracked files outside the reference material.

## Validation (at the code commit `dbe224d`; later commits change only documentation)

- TDD: three worker regressions (network loss, 5xx, same-version partial refresh) were red against the old install handler and green after the fix. Gate tests were written before the script; two mutations (bump rule disabled; merge base replaced by branch tip) were confirmed to fail them.
- Focused: `tests/service-worker-lifecycle.test.mjs` **11 passed**; `tests/precache-integrity.test.mjs` **19 passed**.
- `npm test`: **423 passed, 0 failed** (393 before).
- `npm run check`: static checks passed (including `precache integrity: 13 precached assets unchanged since 63c703e; kit version 1.1.0 synchronized`), SDK package validation passed, 423 tests passed.
- `node scripts/sync-sdk-browser.mjs --check`: in sync. `node packages/assistant-sdk/scripts/validate-package.mjs`: passed (`@youge/assistant-sdk@0.2.0`).
- `packages/assistant-sdk`: `npm test` 108 passed; `npm pack --dry-run` ok.
- `example/`: `npm ci`, `npm run typecheck`, `npm run build` passed.
- `git diff --check`: clean.
- **Not performed:** real-browser testing, live-deployment verification.

## Risks

- First install on a connection that drops mid-precache now fails and is retried on the next page load instead of registering a worker with a partial shell.
- A deployment that answers a precache file with a persistent 5xx can no longer install the worker (4xx is tolerated).
- The gate treats any byte change to a precached file as requiring a bump, including comment-only edits.
- The gate needs git history; CI uses `fetch-depth: 0`. Without git it warns and only runs the static rules.

## Skills applied

- `tdd` → red-first regressions at two seams (worker lifecycle events + Cache Storage; gate result and CLI against real throw-away git repositories), then minimal implementation.

## Next action

Wait for owner review of PR #35 and for the decisions above. Do not merge, publish, release, deploy, change versions or start another roadmap stage.
