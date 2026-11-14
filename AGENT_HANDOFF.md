# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Verified base:** `main` / PR #37 merge `f7189e182ccaada85693ebb3373395a37982f515`
**Branch:** `arena/4dc708a7-you-ge-assistant` (active)
**PR:** #38 — Repository Structure & Organization (this branch; keep open for owner review)
**Working tree:** PR #38 changes; preserve them.
**Versions:** kit `1.2.0`; `@youge/assistant-sdk` `0.2.0`.

Permanent development and layout rules live in [`AGENTS.md`](AGENTS.md). The full pre-move root inventory, relocation rationale, compatibility decisions and target layout are in [`docs/architecture/REPOSITORY_STRUCTURE.md`](docs/architecture/REPOSITORY_STRUCTURE.md).

## PR #38 — Repository Structure & Organization

Structural-only changes on this branch:

- Root documentation is grouped into `docs/architecture/`, `docs/guides/`, `docs/operations/`, `docs/reference/` and `docs/design-system/`.
- First-party examples are consistently under `examples/`: `demo/`, independent React/Vite `example/`, and existing `push-server/`. The demo still assembles to the Pages site root and the app remains at `/example/`.
- `tests/`, `scripts/`, `packages/assistant-sdk/`, `functions/`, `icons/`, and third-party `reference/` remain within their established boundaries.
- Public classic runtime files stay at their existing root URLs. This includes `/you-ge-sw.js`, `/progressier.js`, `/pwa.js`, `/pwa.css`, `/assistant-state.js`, `/assistant-widget.js`, `/assistant-widget.css`, `/manifest.webmanifest`, `/offline.{html,css,js}`, `/domain-config.js`, `/domain-registry.js`, `/dns-diagnostics.js`, `/qrcode.js`, `browserconfig.xml`, `favicon.ico`, and `/icons/*`.
- Pages assembly, GitHub Actions, static checks, tests, docs links, example package resolution and Vite's shared-runtime path are updated for source moves. No redirects or service-worker URL aliases were introduced.
- `PARITY.md` and `reference/` are preserved. No runtime implementation, product behavior, kit version, SDK version, public SDK exports or package layout changed.

## Deferred work / known risks

- Do not implement CD-1 (or any other audit item) in this PR. CD-1 capability enforcement remains the next planned implementation task after PR #38.
- CD-1 touches precached runtime files. Before implementation, consult [`docs/operations/PRECACHE_INTEGRITY.md`](docs/operations/PRECACHE_INTEGRITY.md) and obtain owner authorization for any required kit version bump (current kit `1.2.0`). Never bypass the integrity gate.
- Other audited defects CD-2 through CD-7 remain deferred.
- No browser or live deployment test was performed. Pages verification below is a local workflow-equivalent artifact assembly only.

## Verification — PR #38 working tree

- `npm run check` — **passed**, static checks and **496/496** root + SDK tests.
- `npm run test:sdk` — **passed**, **108/108** SDK tests.
- `node packages/assistant-sdk/scripts/validate-package.mjs` — **passed**; `npm pack --dry-run` inspection lists **23 package files**, exports included.
- `node scripts/sync-sdk-browser.mjs --check` — **passed**.
- `node scripts/precache-integrity.mjs` — **passed**; 13 precached assets unchanged from baseline; kit remains `1.2.0`.
- Clean example install `cd examples/example && npm ci`, `npm run typecheck`, and `npm run build` — **passed**. Vite printed the existing expected warnings for classic `<script>` runtime files that it does not bundle.
- Pages workflow-equivalent local assembly — **passed**; checked root and `/example/` output for runtime files, worker shim, manifests and icons. No real Pages deployment was performed.
- Repository Markdown local-link check — **0 broken links**; `git diff --check` — **passed** after final documentation whitespace cleanup.
- GitHub Actions CI — **pending** PR workflow run.

## Next action

Commit and push verified changes on `arena/4dc708a7-you-ge-assistant`, create/update PR #38, confirm GitHub Actions checks, and leave the PR open for owner review. The next planned code task is CD-1 capability enforcement; do not start it in this refactor.
