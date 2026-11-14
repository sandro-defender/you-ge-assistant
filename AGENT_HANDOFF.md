# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Verified base:** `main` / PR #38 merge `42e9a3ab0b204804cba5ab37ad6696e868ec4bbe`
**Branch:** `arena/abdd374a-you-ge-assistant` (active)
**PR:** #39 — Deep Repository Structure Cleanup: Separate Runtime Source from Published Assets (this branch; keep open for owner review)
**Working tree:** clean at the current PR #39 branch tip; PR changes are pushed.
**Versions:** kit `1.2.0`; `@youge/assistant-sdk` `0.2.0`.

Permanent development and layout rules live in [`AGENTS.md`](AGENTS.md). The full root inventory, source/output separation, and compatibility rationale are in [`docs/architecture/REPOSITORY_STRUCTURE.md`](docs/architecture/REPOSITORY_STRUCTURE.md).

## PR #39 — Deep Repository Structure Cleanup

Structural-only changes on this branch:

- **Root cleanup:** Reduced root files from **29** to **11** essential files (`.editorconfig`, `.gitattributes`, `.gitignore`, `AGENTS.md`, `AGENT_HANDOFF.md`, `CHANGELOG.md`, `LICENSE`, `NEXT_AGENT_PROMPT.md`, `PARITY.md`, `README.md`, `package.json`).
- **Organized source directories:**
  - `src/runtime/`: `pwa.js`, `pwa.css`, `you-ge-sw.js`, `progressier.js`
  - `src/assistant/`: `assistant-state.js` (generated from `packages/assistant-sdk/src/` via `npm run sync:sdk`), `assistant-widget.js`, `assistant-widget.css`
  - `src/domain/`: `domain-config.js`, `domain-registry.js`, `dns-diagnostics.js`, `manifest-handler.js`
  - `src/offline/`: `offline.html`, `offline.css`, `offline.js`
  - `src/shared/`: `qrcode.js`
  - `public/`: `browserconfig.xml`, `favicon.ico`, `manifest.webmanifest`
- **Source-to-output separation:**
  - `scripts/source-paths.mjs` maps public root paths to `src/` and `public/`.
  - `scripts/build.mjs` (`npm run build`) assembles `dist/` (gitignored) with all 18 runtime/public files and `icons/` at their exact original root URLs.
  - `scripts/assemble-pages.mjs` provides shared GitHub Pages assembly for both `.github/workflows/pages.yml` and automated Pages assembly tests.
  - `examples/example/vite.config.js` serves the shared runtime from `src/` and `public/` in local dev.
- `PARITY.md` and `reference/` are preserved. No runtime implementation, product behavior, kit version (`1.2.0`), SDK version (`0.2.0`), or public URLs changed.

## Completed work — PR #38 (historical)

PR #38 (merged at `42e9a3ab0b204804cba5ab37ad6696e868ec4bbe`) grouped root documentation into `docs/` and examples into `examples/` (`demo/`, `example/`, `push-server/`), reducing root files from 46 to 29.

## Deferred work / known risks

- Do not implement CD-1 (or any other audit item) in PR #39. CD-1 capability enforcement remains the next planned implementation task after PR #39 is reviewed and merged.
- CD-1 touches precached runtime files. Before implementation, consult [`docs/operations/PRECACHE_INTEGRITY.md`](docs/operations/PRECACHE_INTEGRITY.md) and obtain owner authorization for any required kit version bump (current kit `1.2.0`). Never bypass the integrity gate.
- SDK publishing remains deferred (`@youge/assistant-sdk` stays `0.2.0`).
- No live browser or live GitHub Pages deployment test was performed; Pages verification is local artifact assembly via `scripts/assemble-pages.mjs`.

## Next action

Owner review of PR #39 (`arena/abdd374a-you-ge-assistant`). Leave PR #39 open; do not merge, release, tag, deploy, or start CD-1.
