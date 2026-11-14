# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base:** `main` at `86d8ae30ac3816a1bb098ed4750ad313c03a6135` (PR #35 merged)
**Branch:** `arena/a56adc21-you-ge-assistant` (active)
**PR:** opened from this branch; query `gh pr list --head arena/a56adc21-you-ge-assistant --json number,url,state`.
**Working tree:** clean. This pass changes only `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` (plus a follow-up handoff commit recording the PR number). No runtime, test, script or version file was touched.

Permanent contributor rules live in [`AGENTS.md`](AGENTS.md) (Repository Development Rules); they are not duplicated here. `AGENTS.md` was reviewed in this pass and already agrees with the merged state (kit `1.1.1`, SDK `0.2.0`, identity rule); it is unchanged.

## Verified post-merge state (queried live on 2026-11-14)

- **PR #35 is MERGED into `main`.** Title: "Precache safety (required/optional assets), integrity gate, kit 1.1.1 and Progressier identity cleanup". Merged **2026-11-14T15:18:05Z**; merge commit **`86d8ae30ac3816a1bb098ed4750ad313c03a6135`**, which is the current `main` tip. Merged branch head: `c78b84d6e553ec92e10795cb600bf97a9dc34bc1`. Nothing is awaiting review or merge for #35.
- **Post-merge CI on `86d8ae3` passed:** [`check` run 43609433247](https://github.com/sandro-defender/you-ge-assistant/actions/runs/43609433247) — success (completed 15:18:40Z); [`pages` run 43609433240](https://github.com/sandro-defender/you-ge-assistant/actions/runs/43609433240) — success (completed 15:18:33Z).
- **GitHub Pages deployment was triggered and completed:** deployment `7789494221` (environment `github-pages`, sha `86d8ae3`) reached state `success` at 15:18:33Z. Site: <https://sandro-defender.github.io/you-ge-assistant/> (example at `/example/`).
- **CI green and a successful Pages deployment do not prove live behavior.** No real-browser verification has been performed. Live worker installation at `1.1.1`, replacement of `1.1.0` caches, offline behavior and the update flow on the deployed site are **unverified**.
- **No tag, no release, no SDK publication occurred.** GitHub tags: none. GitHub releases: none. npm `@youge/assistant-sdk` latest is `0.2.0`, published 2026-11-07 — before the merge; nothing published since.

## Versions

| Version | Value | Status |
| --- | --- | --- |
| Kit (`progressier.js` `VERSION`, `pwa.js` `PWA.version`, root `package.json`, SDK `KIT_COMPAT_VERSION`, generated `assistant-state.js`) | **`1.1.1`** | Merged with PR #35 (owner-authorized bump from `1.1.0`). |
| SDK package (`packages/assistant-sdk/package.json`, `SDK_VERSION`) | **`0.2.0`** | Unchanged. The published `0.2.0` tarball reports `kitCompatVersion: '1.1.0'`; repository source reports `1.1.1`. Informational constant; no code compares it. |

Further kit, package or SDK version changes need new owner authorization (`AGENTS.md`).

## Merged precache-integrity policy and asset classifications (final in `main`)

Authoritative detail: [`PRECACHE_INTEGRITY.md`](PRECACHE_INTEGRITY.md) §3, §6, §7. Summary of what is now in `main`:

- `PRECACHE_ASSETS` in `progressier.js` declares 13 assets, each required or optional.
  - **Required:** `offline.html`, `offline.css`, `offline.js`, `pwa.css`, the default icon (`icons/icon-192.png` or the registry's `branding.icon`), `icons/icon-512.png`.
  - **Optional:** `domain-config.js`, `domain-registry.js`, `dns-diagnostics.js`, `assistant-state.js`, `assistant-widget.js`, `assistant-widget.css`, `qrcode.js`.
- **Final `pwa.css` decision:** required. The former "yes (unless `data-no-css`)" exception is withdrawn — a deployment using `data-no-css` or a custom `data-css` must still ship `<scope>/pwa.css`, or it keeps its old worker and stops updating.
- **Final Assistant-file decision:** `assistant-state.js`, `assistant-widget.js`, `assistant-widget.css` are optional (pages without the Assistant, or apps bundling `@youge/assistant-sdk`, may omit them).
- An optional asset is skipped only on HTTP 404/410 or an HTML fallback page. Every other answer (401/403/408/409/429, other 4xx, 5xx, non-200 success, lost connection, truncated body, 120 s deadline) fails the install for every asset.
- Install is all-or-nothing: nothing is written until every asset is downloaded completely; a failed install leaves the active worker and its cache untouched and is retried by the browser.
- The diff-aware integrity gate (`scripts/precache-integrity.mjs`, inside `npm run check` and CI) requires a synchronized, higher kit version when a precached file changes, and requires the four kit-version declarations to agree. It never compares the SDK package version.
- Kit `1.1.1` means new cache names (`…:static:v1.1.1`, `…:pages:v1.1.1`). An existing `1.1.0` installation is expected to install the new worker beside the active one, show one update notice, and delete its `1.1.0` caches on activation (`PRECACHE_INTEGRITY.md` §7). This sequence is verified by Node tests against the real worker source only — **not yet observed in a live browser**.
- Changing a classification later: one `required:` flag in `PRECACHE_ASSETS`, the matching list in `tests/support/service-worker-harness.mjs`, and `PRECACHE_INTEGRITY.md` §3; making a required asset optional or widening "not deployed" needs owner approval.

## GitHub repository identity — owner action required (blocked in this session)

The task authorized replacing the obsolete repository description and removing the `progressier` topic, but **the change could not be applied**: the Arena GitHub App token lacks the `administration=write` repository permission. REST `PATCH /repos/…`, `PUT /repos/…/topics` and GraphQL `updateRepository` all returned HTTP 403 "Resource not accessible by integration" (verified 2026-11-14). **No metadata was changed.**

Live metadata still reads (verified via `gh api repos/sandro-defender/you-ge-assistant`):

- Description: "Self-hosted, Progressier-compatible PWA kit: manifest, service worker, install UI, QR, offline, share target, push and badge. No build step, no dependencies."
- Topics: `install-prompt`, `javascript`, `offline-first`, `progressier`, `pwa`, `service-worker`, `web-manifest`, `web-push`.

Owner command to apply the authorized change (or edit Settings → General manually):

```sh
gh repo edit sandro-defender/you-ge-assistant \
  --description "You.Ge Assistant: dependency-free multi-domain PWA toolkit and SDK — install UI, offline, sharing, push, badges, QR and diagnostics." \
  --remove-topic progressier --add-topic you-ge-assistant
```

Resulting topics: `install-prompt`, `javascript`, `offline-first`, `pwa`, `service-worker`, `web-manifest`, `web-push`, `you-ge-assistant`. Repository name and visibility stay unchanged. This metadata change does not touch any technical compatibility identifier; those are never renamed (`COMPATIBILITY_CONTRACTS.md`).

## Remaining Progressier references in tracked files

Unchanged by this pass. Method and full inventory: [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md) §1–§4. All remaining occurrences are required technical compatibility contracts (`/progressier.js`, `window.progressier`, `.progressier-*` selectors, 15 `--progressier*` CSS variables, banner cookies, IndexedDB stores, migration-detection host strings) or intentionally preserved historical/reference artifacts (`reference/`, `PARITY.md`, dated records, cleanup discussion). No unexplained product-identity reference exists in tracked files. The only remaining obsolete product branding is the **GitHub repository metadata above**, which is outside tracked files.

## Remaining owner-level work

1. **Live deployment verification (highest priority).** Run `node scripts/verify-deployment.mjs https://sandro-defender.github.io/you-ge-assistant/` and the real-browser acceptance checklist in `AGENTS.md` §15: worker activated at `1.1.1`, install/relaunch, offline reload, and the `1.1.0 → 1.1.1` update flow with cache replacement on an existing installation. Until then, deployment behavior is unverified regardless of CI status.
2. **Repository metadata:** apply the command above (blocked here by token permissions).
3. **`reference/` and `PARITY.md`** retirement or restructuring (separate approval; also needs edits to `scripts/check.mjs`).
4. **SDK release decision:** whether/when to publish so a published package reports kit `1.1.1`.

## Validation

This pass (documentation-only):

- `git diff --check`: clean.
- `node scripts/check.mjs`: passed (static checks, kit-version synchronization, precache integrity gate — no precached file changed; manifest and package identity checks).
- Stale-status scan: no text in `AGENT_HANDOFF.md` / `NEXT_AGENT_PROMPT.md` presents PR #35 as open, awaiting review or unmerged.
- Branding scan (method: `COMPATIBILITY_CONTRACTS.md` §4): capitalized `Progressier` appears only in allowed rule/provenance/historical/cleanup contexts; no runtime file changed, so every compatibility identifier is intact.
- Full `npm test` not re-run (docs-only change, per task instruction). Last full results on the merged code: 481 tests passed in PR #35 validation, and the post-merge `check` run on `main` passed.

Merged PR #35 validation (historical, at its head): TDD red-first policy tests, 481 tests passed, `npm run check` passed, SDK package validation and `npm pack --dry-run` ok, example typecheck/build passed; details in `PRECACHE_INTEGRITY.md` §4/§6 and the PR. Real-browser and live-deployment testing were **not** part of it.

## Risks

- Live deployment behavior is unverified (see owner work item 1); a green `pages` run only proves the artifact was published.
- Deployments missing a required asset (notably `pwa.css` under `data-no-css`) or answering precache requests with persistent 401/403/429/5xx keep their old worker; hosts answering missing files with 403 must deploy the optional files or answer 404 (`PRECACHE_INTEGRITY.md` §3).
- On activation, version-keyed page caches and runtime-cached static files are dropped and re-cached on the next online visit; ~530 kB precache is re-downloaded (`PRECACHE_INTEGRITY.md` §7).
- The gate treats any byte change to a precached file as requiring a bump, including comment-only edits.

## Next action

Execute [`NEXT_AGENT_PROMPT.md`](NEXT_AGENT_PROMPT.md): a fresh, read-only architecture and product-quality audit of the merged `main`. The owner-level items above stay open; do not merge, publish, release, tag, bump versions or deploy without explicit authorization (`AGENTS.md`).
