# Unified hub and Configuration Playground — implementation record

Date: 2026-11-19. Branch: `arena/09fea09a-you-ge-assistant`. Scope: public Pages
information architecture and a local-only configuration experiment. No SDK,
worker, kit version, production configuration or release behavior changed.

## Existing routes and capabilities found

| Route (before) | Source | What it actually is |
| --- | --- | --- |
| `/` | `examples/demo/index.html` | Full PWA feature-test playground with install/dialog/QR, diagnostics, notifications, UI dialogs, theme, language and event log. |
| `/example/` | `examples/example/` (Vite) | Product and integration guide with a real SDK-backed panel. |
| `/example/workspace.html` | `examples/example/workspace.html` | Preserved sample workspace and theme studio. |
| `/sdk-demo/` | `examples/sdk-demo/` (Vite) | Isolated SDK-only consumer using `@youge/assistant-sdk`, `/i18n` and `/installation`. |
| `/offline.html` | `src/offline/offline.html` | Runtime offline fallback; scoped per installable app. |

Documentation sources inspected: `AGENTS.md`, `AGENT_HANDOFF.md`,
`NEXT_AGENT_PROMPT.md`, `docs/architecture/PAGES_REDESIGN_AUDIT.md`,
`docs/design-system/you-ge-assistant/MASTER.md`, its `pages/product-website.md`
override, `docs/guides/DESIGN_FOUNDATION.md`, the SDK README/package exports and
`@youge/assistant-sdk` declarations. Open PRs were checked before starting:
there were none. The `ui-ux-pro-max-skill` is not installed in `.agents/skills/`;
it was cloned outside the repository and actively used as recorded in
`docs/guides/DESIGN_FOUNDATION.md` §16.

## Routes after this change

| Route | Source | Purpose |
| --- | --- | --- |
| `/` | `examples/landing/` | Unified, no-runtime hub: Instructions, Demo, SDK Demo, Configuration Playground; product vs SDK; feature directory; short FAQ. |
| `/demo/` | `examples/demo/index.html` | The same preserved feature-test playground, now with anchors and route-correct links. Root `/demo/` serves it with the shared runtime and its own manifest. |
| `/example/` and `/example/workspace.html` | unchanged | Existing product guide and workspace. |
| `/sdk-demo/` | unchanged | Existing standalone SDK consumer. |
| `/config-playground/` | `examples/config-playground/` (Vite) | New local-only settings experiment with an illustrative preview and generated code. |

The demo route moved from `/` to `/demo/` because the explicit task requires a
unified landing page at the main entry point. No feature, control, asset or URL
inside that playground was removed; its original runtime scope is preserved by
the assembler. Root `/manifest.webmanifest` still exists for previously
installed root-scope apps, and `/demo/manifest.webmanifest` serves the moved
playground.

## Configuration sources

Playground controls map to the public `AssistantConfigInput` shape in
`packages/assistant-sdk/src/config/index.d.ts` (`enabled`, `locale`, `theme`,
`position`, `modules`, `installExperience`) and the documented classic runtime
`data-*` attributes in `AGENTS.md` §5. Installation presentation/locale follow
`InstallExperienceConfig` (public `/domain` types); diagnostics controls follow
the eight validated PWA feature controls documented in the SDK README. The 12
core locales come from `@youge/assistant-sdk/i18n`; the five extra installation
dialog tags were verified in the vendored `<pwa-install>` locale table.

SDK settings generate an `import { YouGeAssistant } from '@youge/assistant-sdk'`
example. Runtime-only switches generate a clearly separated
`window.YOU_GE_ASSISTANT_CONFIG` + `pwa.js` example. No private import, remote
config service, credential field, second worker or production write is involved.
Settings persist only in `sessionStorage` under
`youge:config-playground:settings:v1`, and unsupported keys/values are dropped
with visible feedback.

## Verification and limits

See PR description and `AGENT_HANDOFF.md` for exact commands and counts. Local
HTTP route checks were made against the assembled site; no browser binary was
available, so no desktop/mobile browser session, screenshot or physical device
test is claimed.
