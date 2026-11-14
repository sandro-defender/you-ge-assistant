# Repository inventory and structure

## Baseline

The verified baseline for the current deep structural cleanup (PR #39) is PR #38's merge commit `42e9a3ab0b204804cba5ab37ad6696e868ec4bbe` on `main`. Before PR #39, the repository root contained **29 files** (11 essential repository/governance files and 18 runtime/public/generated files). After PR #39, the repository root contains **11 files**.

This is a structural refactor only. Source files live in organized `src/` and `public/` directories, while `npm run build` (`scripts/build.mjs`) and Pages assembly (`scripts/assemble-pages.mjs`) publish all public runtime assets at their exact original root URLs. No product behavior, public URL, kit version (`1.2.0`), or SDK version (`0.2.0`) changed.

## Remaining root-file inventory (11 files)

| Root path | Classification | Why it remains at root |
|---|---|---|
| `.editorconfig` | Essential repository/tooling config | Editor tooling discovers it from repository root. |
| `.gitattributes` | Essential repository/Git config | Git line-ending and diff attributes apply repository-wide. |
| `.gitignore` | Essential repository/Git config | Git/npm/build ignore rules (`dist/`, `_site/`, `node_modules/`) are root-scoped. |
| `AGENTS.md` | Essential contributor/agent rules | Canonical agent and contributor instructions expected at root. |
| `AGENT_HANDOFF.md` | Essential handoff/governance | Current branch/PR handoff state expected at root. |
| `CHANGELOG.md` | Essential release/history documentation | Conventional release-note discovery path. |
| `LICENSE` | Essential project/legal file | Conventional license discovery and package metadata. |
| `NEXT_AGENT_PROMPT.md` | Essential agent handoff | Canonical next-task prompt expected at root. |
| `PARITY.md` | Protected reference documentation | Owner-protected parity record; explicitly retained at root. |
| `README.md` | Essential project documentation | Repository landing page. |
| `package.json` | Essential project/build manifest | Root npm scripts (`build`, `check`, `test`, `sync:sdk`, `verify`) and kit version (`1.2.0`). |

## Organized source and output architecture

### Source directories (`src/` and `public/`)

- `src/runtime/` — Core PWA runtime and service workers:
  - `pwa.js`, `pwa.css`
  - `you-ge-sw.js` (canonical service worker)
  - `progressier.js` (legacy compatibility service-worker shim delegating to `you-ge-sw.js`)
- `src/assistant/` — Floating Assistant widget and generated state:
  - `assistant-state.js` (**generated** from `packages/assistant-sdk/src/` via `npm run sync:sdk`; never hand-edit)
  - `assistant-widget.js`, `assistant-widget.css`
- `src/domain/` — Multi-domain configuration, registry, DNS diagnostics, and dynamic manifest handler:
  - `domain-config.js`, `domain-registry.js`, `dns-diagnostics.js`, `manifest-handler.js`
- `src/offline/` — Offline fallback shell:
  - `offline.html`, `offline.css`, `offline.js`
- `src/shared/` — Shared utilities:
  - `qrcode.js`
- `public/` — Static public root assets:
  - `browserconfig.xml`, `favicon.ico`, `manifest.webmanifest`
- `icons/` — App icons and favicons served at `/icons/*`.

### Build and deployment output (`dist/` and `_site/`)

- `scripts/source-paths.mjs` — Canonical `PUBLIC_TO_SOURCE` mapping from public root filenames to `src/` and `public/` paths, used by `scripts/build.mjs`, `scripts/check.mjs`, `scripts/precache-integrity.mjs`, and tests.
- `scripts/build.mjs` (`npm run build`) — Assembles `dist/` (gitignored) with all 18 runtime/public files and `icons/` at their exact root URLs (`/pwa.js`, `/you-ge-sw.js`, `/progressier.js`, `/assistant-state.js`, `/manifest.webmanifest`, `/offline.html`, `/icons/*`, etc.).
- `scripts/assemble-pages.mjs` — Shared GitHub Pages assembly logic used by both `.github/workflows/pages.yml` and automated Pages assembly tests. It builds `dist/` and assembles `_site/` (root feature-test playground from `examples/demo/`) and `_site/example/` (independent React/Vite sample from `examples/example/dist/`), rewriting `browserconfig.xml` tile paths and `example/offline.html` fallback branding for each scope.
- `examples/example/vite.config.js` — Uses `PUBLIC_TO_SOURCE` mappings in `sharedRuntimeDevFiles()` so local Vite development serves `/pwa.js`, `/you-ge-sw.js`, `/assistant-state.js`, etc. directly from `src/` and `public/` without requiring `dist/` to be committed.

### SDK synchronization (`assistant-state.js`)

`src/assistant/assistant-state.js` is deterministically generated from `packages/assistant-sdk/src/` by `scripts/sync-sdk-browser.mjs` (`npm run sync:sdk`). `node scripts/sync-sdk-browser.mjs --check` verifies byte-level synchronization. Never hand-edit `src/assistant/assistant-state.js`.

### Public URL and service-worker compatibility

Moving source files into `src/` and `public/` does not change any public URL:

- `/you-ge-sw.js` and `/progressier.js` are published at the root of `dist/`, `_site/`, and `_site/example/`.
- `progressier.js` delegates to `you-ge-sw.js` via `importScripts(new URL('you-ge-sw.js', self.location.href).href)`.
- `manifest.webmanifest`, `offline.html`, `offline.css`, `offline.js`, and `/icons/*` resolve at their original root (and `/example/`) paths.
- `functions/manifest.webmanifest.js` imports `../src/domain/domain-registry.js`, `../src/domain/domain-config.js`, and `../src/domain/manifest-handler.js`.

## Historical note — PR #38 (completed)

In PR #38 (merged at `42e9a3ab0b204804cba5ab37ad6696e868ec4bbe`, baseline `f7189e182ccaada85693ebb3373395a37982f515`), the repository root was reduced from 46 files to 29 files by grouping documentation into `docs/` (`architecture/`, `guides/`, `operations/`, `reference/`, `design-system/`) and examples into `examples/` (`demo/`, `example/`, `push-server/`). PR #39 completes the separation by moving the remaining 18 runtime/public/generated files out of the root into `src/` and `public/` while preserving all public URLs via `dist/`.
