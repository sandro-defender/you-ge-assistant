# GitHub Pages product redesign — audit and verification

Date: 2026-11-15. Scope: product website and integration guidance, not SDK behavior,
release configuration, deployment, or a new dashboard.

## Before implementation

- `.github/workflows/pages.yml` builds `examples/example` with its independent
  lockfile **before** `scripts/assemble-pages.mjs` builds/copies the root runtime.
  The workflow uploads `_site` and deploys only from main/manual dispatch. Neither
  workflow nor its deployment permissions/triggers were changed.
- `/` was the feature-test playground (`examples/demo/index.html`), with links to
  Repository, AGENTS.md, README and `/example/`. Its working test controls remain.
- `/example/` was Staff Space: local check-in/checklist, React Assistant renderer,
  foundation preview and adaptive theme studio. Its links led to local sections,
  the root playground, and third-party notices. All are preserved in the new
  `/example/workspace.html` entry point, in the **same scope** and Vite build.
- Runtime-generated offline pages exist at `/offline.html` and
  `/example/offline.html`. Their technical URLs, workers, compatibility shims,
  icons, storage contracts and precached source files were left unchanged.
- Vite already uses `base: './'` and a dev middleware for shared runtime files.
  The SDK is buildless and consumed via `file:../../packages/assistant-sdk`; this
  remains deliberate so a clean CI checkout builds the example first.
- Existing reusable pieces include the optional DOM widget, React store adapter,
  React Bits cards/hover/loading components, SDK theme resolver, runtime dialogs,
  install/diagnostic data hooks and theme studio. They remain the source of real
  behavior; no SDK implementation or theme resolver was copied into the guide.

## Published SDK verification

Registry lookup confirmed `latest` is **0.3.0** on 2026-11-15:

```
https://registry.npmjs.org/@youge/assistant-sdk/-/assistant-sdk-0.3.0.tgz
sha512-TL/1QEFfG/mIw32Jiw0yA1Wh/xUUlWzZ6NsXMILpzKm4gbUCeWpO0ad7UyUFIYmL4ll2SfhlE21CVJuVapMBXA==
```

Downloaded/extracted the tarball in ignored local scratch storage. Compared its
`src/` recursively against repository SDK `src/`: **no differences**. Reviewed
its export map, implementation and paired TypeScript declarations for root,
`/domain`, `/config`, `/diagnostics`, `/installation`, `/browser`, `/theme`,
`/react`, and `/package.json` exports. The package README's old unpublished
banner was stale; the repository's current-facing installation and migration
introductions now reflect the registry, without altering historical release logs.

Every displayed SDK function lives in `examples/example/src/guide-examples.ts`.
It was typechecked both through normal example CI and through a temporary
TypeScript `paths` mapping directly to the **downloaded npm declarations**.
The functions were also executed against that downloaded package: isolated
initialization/subscription/cleanup, attaching shared state, configuration,
host-reported endpoint/session updates, and safe disabling. Assertions confirmed
that changing update/cache flags preserves independently disabled modules.

`node scripts/sync-pages-examples.mjs` renders those exact functions into the
HTML. `--check` and the repository tests catch drift. Examples are readable and
selectable without JavaScript. Worker registration is explicitly labeled host
code, not an SDK method; opt-in HTML attributes were checked against `pwa.js`.

The public command is `npm install @youge/assistant-sdk`; the guide explains
pinning `@0.3.0`, ESM/TypeScript, Node 18+, optional React, HTTPS, the difference
between SDK and classic assets, and `configure()`'s module replacement behavior.
No publication, version bump, release, deployment or merge is part of this work.

## Implementation and routes

- `/`: coordinated product introduction, original diagram, capabilities,
  installation preview, developer CTAs and the existing live playground.
- `/example/`: primary product showcase, features, integration architecture,
  practical five-step guide, installation, ownership/migration guidance, actual
  SDK panel/widget, and developer resources.
- `/example/workspace.html`: preserved sample and theme studio, shared product
  navigation, and contrast improvements. Existing workspace-specific contract
  assertions now target this page; they were not removed or weakened.
- Shared header/footer and mobile navigation: Product, Features, Documentation,
  Examples, GitHub, Get started. Assets are route-relative in production.
- New focused tests cover guide-source parity, navigation, real API delegation,
  no demo worker registration, and assembled assets/anchors under the Pages base.
- Manifest names/colors match the product showcase; original `id`, start URL and
  scope remain unchanged. No SDK/runtime implementation or package version changed.

## Verification results

- `npm ci`, `npm run typecheck`, `npm run build` in `examples/example`: pass.
- `node scripts/assemble-pages.mjs`: pass, inspected output; independent Vite build
  still precedes runtime assembly. Classic-script Vite warnings are expected:
  these scripts/styles are supplied by assembly, not bundled or copied into SDK.
- `npm run check`: **572/572 tests pass**, plus static and SDK package validation.
- `node scripts/sync-sdk-browser.mjs --check`: pass.
- `npm run check:precache`: pass, all 13 precached assets unchanged; kit 1.2.3.
- CI script syntax loop and package `npm pack --dry-run`: pass (24 SDK files).
- Chromium/Playwright rendered the production site at `/you-ge-assistant/`:
  all three pages fit 360, 390, 768, 1024 and 1440px without horizontal overflow.
  No page errors or local HTTP asset failures. Widget mounted once; zero worker
  registrations after all three routes. Browser web security remained enabled.
- Exercised real clipboard copying, menu open/Escape/focus, widget open/Escape,
  theme configuration, offline/online subscription updates, and installation
  guidance. The actual browser instructions dialog appeared, not a simulated UI.
- JS-disabled guide: all samples present, navigation visible, live selector disabled.
- axe WCAG 2/2.1 A/AA: zero violations for homepage and product guide at 1440px and
  390px, and preserved workspace at 390px after contrast fixes. Code scroll regions
  are keyboard focusable. Automated checks do not prove full accessibility.
- Internal rendered links, fragments and assets: pass. All seven distinct linked
  GitHub URLs returned HTTP 200. npmjs.com frontend is outside the sandbox network
  allowlist; its two public package URLs could not be fetched. The actual package
  and version were independently verified through registry.npmjs.org.

Browser/audit dependencies were installed only in ignored scratch storage, not
project manifests or lockfiles. Screenshots and visual notes are in
[`product-website.md`](../design-system/you-ge-assistant/pages/product-website.md).

## Remaining limits

Physical iOS/Android devices, Safari/Firefox, actual install acceptance, real push,
Cloudflare DNS/network success, and live host-worker adapters need separate
integration/hardware verification. This redesign intentionally registers no
worker, requests no push permission, and does not test production host services.
New product content contains no obsolete product branding. Legacy technical
identifiers remain unchanged as inventoried in `COMPATIBILITY_CONTRACTS.md`.
GitHub PR #46 check workflow [run 43665433253](https://github.com/sandro-defender/you-ge-assistant/actions/runs/43665433253) passed on commit `05ee8c9`, including independent SDK tests/dry-run, full unit suite, build/typecheck, syntax and manifest checks. Latest-head status is recorded in the PR; no Pages deployment
or release workflow will be manually dispatched for this task.
