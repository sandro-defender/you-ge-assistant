# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base:** `main` at `63c703e956d8eea197220cc0b491110335e5610b` (PR #34 merged)
**Branch:** `arena/62503a48-you-ge-assistant` (active)
**PR:** [#35](https://github.com/sandro-defender/you-ge-assistant/pull/35). The owner reviewed it and explicitly requested the merge on 2026-11-14; this is the last commit before merging. If you are reading this on `main`, PR #35 is merged — confirm with `gh pr view 35 --json state,mergeCommit`.
**Head:** code and product documentation end at `ad20ca7`; any later commit changes only these two handoff files. Query the live head with `gh pr view 35 --json headRefOid`.
**CI:** statuses are per head. Query `gh pr checks 35`; do not rely on a result recorded here for a later commit.

## Versions

| Version | Value | Status |
| --- | --- | --- |
| Kit (`progressier.js` `VERSION`, `pwa.js` `PWA.version`, root `package.json`, SDK `KIT_COMPAT_VERSION`, generated `assistant-state.js`) | **`1.1.1`** | Bumped from `1.1.0` in `528e17f` with explicit owner authorization. |
| SDK package (`packages/assistant-sdk/package.json`, `SDK_VERSION`) | **`0.2.0`** | Unchanged by instruction. The published `0.2.0` tarball reports `kitCompatVersion: '1.1.0'`; the repository source reports `1.1.1`. Informational constant, no code compares it. |

No tag, release or publication was performed. Merging PR #35 (owner-requested) publishes `main` to GitHub Pages through `pages.yml`; no other deployment was performed. Further version changes need new owner authorization.

## Verified repository / PR state

- PR #34 is merged at `63c703e`; PR #33 is closed unmerged with nothing to port; PR #32 is merged.
- PR #35 has no review comments on GitHub; the owner's review arrived as task instructions and is addressed below.
- The worktree was clean before and after this pass. No force-push, reset or history rewrite; every commit on the branch passes `npm test` and `scripts/check.mjs` on its own.

## What PR #35 contains

1. **Precache asset policy** (`progressier.js`, `PRECACHE_ASSETS`). Each of the 13 assets is declared required or optional.
   - Required: `offline.html`, `offline.css`, `offline.js`, `pwa.css`, the default icon (`icons/icon-192.png` or the registry's `branding.icon`), `icons/icon-512.png`.
   - Optional: `domain-config.js`, `domain-registry.js`, `dns-diagnostics.js`, `assistant-state.js`, `assistant-widget.js`, `assistant-widget.css`, `qrcode.js`.
   - An optional asset is skipped only on HTTP 404/410, or when the host answers with its HTML fallback page instead of the file. A required asset in the same situation fails the install.
   - 401, 403, 408, 409, 429, any other 4xx, 5xx, non-200 success codes, a lost connection, a truncated body, and no complete answer within 120 s fail the install for every asset.
   - Rationale per asset and the answer table: `PRECACHE_INTEGRITY.md` §3.
2. **Worker installation.** Downloads the whole manifest (`cache: 'reload'`), reads every body, and only then writes. A failed install writes nothing, leaves the active worker and its cache untouched, and is retried by the browser. A cache created by an install whose write fails is removed. No `skipWaiting()` on install; `SKIP_WAITING`, activation, cache naming and fetch strategies are unchanged.
3. **Cache refresh.** Kit `1.1.1` means new cache names (`…:static:v1.1.1`, `…:pages:v1.1.1`). An existing `1.1.0` installation installs the new worker beside the running one, shows one update notice, and deletes its `1.1.0` caches on activation (`PRECACHE_INTEGRITY.md` §7).
4. **Integrity gate** (`scripts/precache-integrity.mjs`, inside `npm run check` and the existing CI step). Reads the precache list by executing the worker's install handler; diffs from the merge base; requires a synchronized higher kit version when a precached file is modified, added, removed or renamed; requires the four kit-version declarations to agree (the SDK's `KIT_COMPAT_VERSION` was added in this pass); never compares the SDK package version.
5. **Identity cleanup.** You.Ge Assistant is the only product identity in tracked files. The last two obsolete-branding comments (`pwa.css`) were replaced with the bump.

## Remaining Progressier references (tracked files)

Method and commands: `COMPATIBILITY_CONTRACTS.md` §4. 49 of 158 tracked files contain the string.

- **Required technical compatibility contracts** (kept, not renamed): `/progressier.js` worker path; `window.progressier` shim; `.progressier-*` selectors and generated classes; `body[data-progressier-forced-theme]`; 15 `--progressier*` CSS variables; cookies `progressierinstallbanner` / `progressierpushbanner`; IndexedDB `progressiersharedfiles` / `progressierSavedPushNotifications`; `progressier.app` / `progressier.com` strings used only to detect and remove leftover tags. Purpose, reason and migration status for each: `COMPATIBILITY_CONTRACTS.md` §1.
- **Historical / reference artifacts intentionally preserved:** `reference/` (third-party bundles, JSON, provenance note in `reference/README.md`), `PARITY.md` (class identifiers of that bundle), `POST_PHASE2_ARCHITECTURE_REVIEW.md` §6–§7 (point-in-time record with a superseded note), and text that discusses the cleanup itself (`AGENTS.md` identity rule, `COMPATIBILITY_CONTRACTS.md`, `CHANGELOG.md`, this file).
- **Unexplained product-identity references:** none found.

## Owner decisions still open

1. **Classification choices to confirm.** `pwa.css` and `icons/icon-512.png` are required. For `pwa.css` this withdraws the file map's former "yes (unless `data-no-css`)" exception: a deployment that uses `data-no-css` or a custom `data-css` and does not ship `<scope>/pwa.css` keeps its `1.1.0` worker and stops updating until the file is deployed. The Assistant files are optional. Each is one `required:` flag in `PRECACHE_ASSETS` plus the matching list in `tests/support/service-worker-harness.mjs` and `PRECACHE_INTEGRITY.md` §3.
2. **Merging #35 deploys** (accepted by the owner's merge request). `pages.yml` publishes `main` to GitHub Pages; existing installations then receive the `1.1.1` update as described above. The live site has not been verified in a browser.
3. **Repository settings** still carry the old identity (not tracked files, not changed): description "Self-hosted, Progressier-compatible PWA kit…" and topic `progressier`. Suggested:
   `gh repo edit sandro-defender/you-ge-assistant --description "You.Ge Assistant: dependency-free multi-domain PWA toolkit and SDK — install UI, offline, sharing, push, badges, QR and diagnostics." --remove-topic progressier --add-topic you-ge-assistant`
4. **`reference/` and `PARITY.md`** retirement or restructuring (separate approval; also needs edits to `scripts/check.mjs`).
5. **SDK release.** Whether and when a new SDK version is published so that a published package reports kit `1.1.1`.

## Validation (at `ad20ca7`)

- TDD: the policy tests were written first and failed against the previous worker for the intended reasons (required-asset 404, 401/403/408/409/429 skipped, HTML fallback, truncated body, timeout, stale optional entry); the gate's SDK-declaration test failed before the gate read it. Ten mutations of the worker rules each make at least one test fail.
- `tests/service-worker-lifecycle.test.mjs` **11**, `tests/service-worker-precache-policy.test.mjs` **55**, `tests/precache-integrity.test.mjs` **22**, `tests/install-experience.test.mjs` **20**, `tests/sdk-integration.test.mjs` **14**, `tests/foundation-contracts.test.mjs` **14** — all passed.
- `npm test`: **481 passed, 0 failed** (423 before this pass, 393 before PR #35).
- `npm run check`: passed — static checks (gate line: `2 of 13 precached assets changed (assistant-state.js, pwa.css) since 63c703e; kit version 1.1.0 → 1.1.1 synchronized`), SDK package validation, 481 tests.
- `node scripts/sync-sdk-browser.mjs --check`: in sync. `node packages/assistant-sdk/scripts/validate-package.mjs`: passed (`@youge/assistant-sdk@0.2.0`, `KIT_COMPAT_VERSION (1.1.1) matches`).
- `packages/assistant-sdk`: `npm test` **108 passed**; `npm pack --dry-run` ok (`0.2.0`).
- `example/`: `npm ci`, `npm run typecheck`, `npm run build` passed.
- `git diff --check`: clean.
- Gate scenarios observed on this repository: `PRECACHE_INTEGRITY.md` §6 table.
- One-off check outside the suite: the worker's install handler, run in the Node VM harness with Node's `fetch` against a local static HTTP server holding the site as `pages.yml` assembles it, stored 13 assets for `/` and for `/example/`; removing `qrcode.js` gave 12; removing `offline.css` failed the install naming the file and left no cache.
- **Not performed:** real-browser testing, live-deployment verification.

## Risks

- A first install on a connection that drops or stalls mid-precache fails and is retried on the next page load instead of registering a worker with a partial shell.
- A deployment that answers a precache request with a persistent 401/403/429/5xx, or lacks a required asset, cannot install or update the worker; the console error names the asset and status.
- Hosts that answer a missing file with 403 must deploy the optional files or answer 404.
- A host that answers a missing `offline.html` with another HTML page cannot be detected by the worker.
- A same-version install whose cache *write* fails can leave a mixed cache until the next successful install (Cache Storage has no transaction); with the gate in place a same-version install only happens for worker-only changes.
- On activation the version-keyed page cache and runtime-cached static files are dropped and re-cached on the next online visit.
- The gate treats any byte change to a precached file as requiring a bump, including comment-only edits.

## Skills applied

- `tdd` → red-first tests at the worker's lifecycle events and Cache Storage state, and at the gate's result against throw-away git repositories; then the minimal implementation; rules confirmed by mutation.

## Next action

Confirm PR #35 is merged and that the post-merge `check` and `pages` runs on `main` passed (`gh run list --branch main --limit 4`). Then wait for owner direction on the open decisions above. Do not publish, release, tag, change versions or start another roadmap stage without it.
