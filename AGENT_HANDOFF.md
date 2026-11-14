# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base:** `main` at `8b8e95eff16731527586b281a256b66e38972288` (PR #36 merged)
**Branch:** `arena/ff5bf457-you-ge-assistant` (active)
**PR:** [#37](https://github.com/sandro-defender/you-ge-assistant/pull/37) — `feat(identity): migrate technical surfaces to canonical You.Ge Assistant contracts (1.2.0)` (`arena/ff5bf457-you-ge-assistant` → `main`).
**Working tree:** clean.

Permanent contributor rules live in [`AGENTS.md`](AGENTS.md); canonical vs. temporary compatibility contracts and the staged `2.0.0` removal schedule live in [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md).

## Completed on PR #37 — Canonical Technical Identity Migration (`1.2.0`)

Owner-authorized parameters executed across Phases 1–4:
- **Kit version bump:** `1.1.1 → 1.2.0` synchronized across `you-ge-sw.js` (`VERSION`), `pwa.js` (`PWA.version`), root `package.json`, `packages/assistant-sdk/src/core/constants.js` (`KIT_COMPAT_VERSION`), and regenerated `assistant-state.js` (`@youge/assistant-sdk` package version unchanged at **`0.2.0`**).
- **Service worker cutover (clean canonical cutover):**
  - Added canonical **`you-ge-sw.js`** (`VERSION = '1.2.0'`), excluding both `you-ge-sw.js` and `progressier.js` from caching/precaching.
  - Replaced **`progressier.js`** with a subpath-safe compatibility shim (`importScripts(new URL('you-ge-sw.js', self.location.href).href)`).
  - Updated `pwa.js` to consistently register `you-ge-sw.js` on all fresh and default registrations (root and subpath) with no automatic legacy-worker preservation, while keeping explicit `data-sw="/progressier.js"` compatibility working through the shim for the documented `1.x` compatibility period.
- **Client globals, SDK bridge, storage, events, URL parameters & manifest (`canonical_fallback_preserve_staff`):**
  - Canonical **`window.YouGePWA`** (`__youGePwaKit: true`) aliased to `window.PWA` alongside the temporary `window.progressier` shim; `@youge/assistant-sdk` (`adapters/pwa-kit.js`, `assistant/index.js`) and `assistant-widget.js` prefer `root.YouGePWA || root.PWA`.
  - Canonical IndexedDB databases (`you-ge-shared-files`, `you-ge-notifications`, `you-ge-pwa-meta`) with idempotent, non-destructive service-worker copy-on-upgrade from `progressiersharedfiles` and `progressierSavedPushNotifications` (legacy DBs retained intact for rollback).
  - Canonical banner cookies (`youge_install_banner_`, `youge_push_banner_`) and `youge-pwa:welcome` `localStorage` with read promotion + dual-write mirroring.
  - Canonical `youge:pwa:*` events (with deduplicated `pwa:*` listeners in SDK), `YOUGE_CONFIG` worker messages, `[data-youge-*]` DOM hooks, and `?youge-install=1` / `?youge-protocol-redirect=` / `?youge-redirect=` query parameters.
  - `manifest.webmanifest` updated to `"id": "/"` and `web+youge` / `web+pwa` protocol handlers while preserving `staff.you.ge`'s `/HIPSBNVemXtM8VMwRfWs` ID in `domain-registry.js`.
- **CSS variables, selectors, first-party templates, CI & verification:**
  - Defined 15 canonical `--youge-pwa-*` custom properties in `pwa.css` chaining `var(--progressier*, <default>)`, paired `.youge-*` selectors + `body[data-youge-pwa-forced-theme="light"]`, and dual-set theme variables in `PWA.applyTheme()`.
  - Migrated `demo/index.html`, `example/index.html`, `example/example.css`, `example/vite.config.js`, `snippet.html`, `.github/workflows/{check,pages}.yml`, `scripts/check.mjs`, `scripts/precache-integrity.mjs`, and `scripts/verify-deployment.mjs` to canonical You.Ge Assistant surfaces while still copying/checking `progressier.js`.
- **Governance, documentation & staged removal policy:**
  - Updated `COMPATIBILITY_CONTRACTS.md` (all 7 technical surfaces, retained non-contract references, **12-month / `>= 2027-11-14` / `2.0.0`** 4-stage removal policy, audit grep commands), `AGENTS.md`, `README.md`, `INTEGRATION.md`, `PRECACHE_INTEGRITY.md`, `MULTI_DOMAIN.md`, `WIDGET.md`, `examples/push-server/README.md`, `packages/assistant-sdk/{README,MIGRATION,RELEASE}.md`, and `CHANGELOG.md`.
  - Added dedicated contract suite `tests/identity-migration.test.mjs` (13 end-to-end tests covering all 4 phases).

## Versions

| Version | Value | Status |
| --- | --- | --- |
| Kit (`you-ge-sw.js` `VERSION`, `pwa.js` `PWA.version`, root `package.json`, SDK `KIT_COMPAT_VERSION`, generated `assistant-state.js`) | **`1.2.0`** | Synchronized across all declarations on PR #37 (`1.1.1` on `main` until PR #37 merges). |
| SDK package (`packages/assistant-sdk/package.json`, `SDK_VERSION`) | **`0.2.0`** | In-repo source includes post-`0.2.0` changes from PRs #30–#37 (`KIT_COMPAT_VERSION = '1.2.0'`, `window.YouGePWA`, `youge:pwa:*`). Any future npm release requires an owner-authorized semver bump. |

Further kit, package or SDK version changes require explicit owner authorization (`AGENTS.md`).

## Active backlog after PR #37 (from post-PR #36 audit)

### Confirmed defects

1. **`CD-2` (High — SDK React adapter & `.d.ts` contracts, non-precached):**
   - `createUseAssistant` (`packages/assistant-sdk/src/adapters/react.js`) passes `selector = null` to `getExternalStoreBindings` and runs `selector(state)` *after* `useSyncExternalStore`, causing re-renders on unrelated state transitions.
   - `FALLBACK_ASSISTANT_STATE.project` omits four non-optional `AssistantProjectInfo` fields (`detectedHostname`, `matchedRegistryKey`, `projectIdSource`, `domainValidation`), breaking SSR callers reading `state.project.domainValidation`.
   - `createReactAdapter` does not check `isDestroyed()` on its cached instance; `ReactAdapterOptions` (`react.d.ts`) omits `createElement?`; `ThemeResolutionContext` (`src/theme/index.d.ts`) omits `seedPrimary?`.
2. **`CD-3` (High — `bridgePwaGlobals` SDK global parity, non-precached):**
   - `bridgePwaGlobals()` (`packages/assistant-sdk/src/adapters/pwa-kit.js`) exposes only `{ version, domain, attach }` on `window.YouGeAssistantSDK`, omitting `resolveTheme`, `normalizeTheme`, `NOTIFICATION_LEVEL_ICONS`, `createChromeHandoff`, `detectInAppBrowser`, etc., disabling adaptive theming and Android Chrome handoff when `assistant-widget.js` loads after `bridgePwaGlobals()`.
3. **`CD-1` (High — Module capability gating across SDK state + widget, touches precached files):**
   - `modules.diagnostics: false`, `modules.recovery: false`, `modules.failover: false` and `modules.help: false` do not gate `"Diagnostics & recovery"` UI or notice `actionId` rendering in `assistant-widget.js`, `example/src/main.jsx`, and `packages/assistant-sdk/src/assistant/index.js`.
4. **`CD-4` (Medium — `Escape` collision & focus stranding with `[data-youge-help]` / `[data-pwa-help]`, touches precached files):**
   - `toolkitDialogOpen()` (`assistant-widget.js`) checks `.pwa-flow` only, missing `[data-youge-help]` / `[data-pwa-help]` mounted by `pwa.js` (`showHelp`).
5. **`CD-5` (Medium — `offline.html` hardcoded Assistant branding, touches precached files):**
   - `offline.html` sets `YOU_GE_ASSISTANT_CONFIG.branding` to `'You.Ge Assistant'` / `'icons/icon-192.png'`, overriding custom `domain-registry.js` branding.
6. **`CD-6` (Medium — `dns-diagnostics.js` mixed RCODE / `possible_dns_interference` edge cases, touches precached files):**
   - Mixed DoH RCODEs `[0, 3]`, `[0, 2]`, and `[validDns=1, dnsErrors=1]` edge cases in `dns-diagnostics.js`.
7. **`CD-7` (Low — Widget `destroy()` media listener cleanup, touches precached files):**
   - `watchScheme()` (`assistant-widget.js`) registers a `matchMedia('(prefers-color-scheme: dark)')` listener that `destroy()` never removes.

> **Precache gate constraint (`PRECACHE_INTEGRITY.md`):** `CD-2` and `CD-3` live entirely in non-precached SDK adapter/type files and can land on kit `1.2.0` with zero version bump. `CD-1`, `CD-4`, `CD-5`, `CD-6` and `CD-7` modify precached files and must be batched only when the owner authorizes a synchronized kit-version bump (`1.2.0 → 1.2.1`) — or added before PR #37 merges if explicitly requested by the owner.

### Architectural risks & minor debt

- **`AR-1` (High):** npm `@youge/assistant-sdk@0.2.0` predates PRs #30–#37 while `package.json` still reads `0.2.0`; `sdk-release-prep.yml` will block on version uniqueness until an authorized bump.
- **`AR-2` (Medium):** Classic `domain-config.js` and `packages/assistant-sdk/src/domain/index.js` are maintained separately (aligned via `tests/sdk-integration.test.mjs`).
- **`AR-3` / `IMP-1` / `IMP-2` (Low–Medium):** `scripts/verify-deployment.mjs` expects root-absolute `/pwa.js` in HTML; `scripts/check.mjs` standalone `node --check` list omits a few files already covered by `.github/workflows/check.yml`.

## GitHub repository identity — owner action required (blocked by GitHub App permissions)

The Arena GitHub App token lacks `administration:write` (`HTTP 403`), so repository description/topics must be updated by the owner:

```sh
gh repo edit sandro-defender/you-ge-assistant \
  --description "You.Ge Assistant: dependency-free multi-domain PWA toolkit and SDK — install UI, offline, sharing, push, badges, QR and diagnostics." \
  --remove-topic progressier --add-topic you-ge-assistant
```

## Remaining owner-level work

1. **Review & merge PR #37 (`1.2.0` canonical technical identity migration)** when ready, then run the real-browser acceptance checklist (`AGENTS.md` §15) on <https://sandro-defender.github.io/you-ge-assistant/> and `/example/` (`/you-ge-sw.js` activation, `1.2.0` cache generation, offline reload, install/relaunch).
2. **Repository metadata:** Run the `gh repo edit` command above.
3. **Future kit `1.2.1` bump authorization:** Required when scheduling precached-runtime fixes (`CD-1`, `CD-4`, `CD-5`, `CD-6`, `CD-7`).
4. **SDK semver bump & release decision:** Decide whether/when to bump `@youge/assistant-sdk` (`0.2.1` / `0.3.0`) after landing `CD-2` + `CD-3` so npm matches `main`.

## Validation (PR #37)

- `npm run check` (`scripts/check.mjs` + full Node test suite including `tests/identity-migration.test.mjs`): **passed**.
- `npm run test:sdk` & `node packages/assistant-sdk/scripts/validate-package.mjs`: **passed** (`@youge/assistant-sdk@0.2.0`, `KIT_COMPAT_VERSION = 1.2.0`, 27/27 release-workflow gates).
- `node scripts/sync-sdk-browser.mjs --check` & `node scripts/precache-integrity.mjs`: **passed**.
- `cd example && npm run typecheck && npm run build`: **passed** (`example/vite.config.js` dev server and `.github/workflows/pages.yml` serve/copy both `you-ge-sw.js` and `progressier.js`).
- `COMPATIBILITY_CONTRACTS.md` §5 legacy-token grep audit & `git diff --check`: **clean** (zero unmapped legacy identifiers).
- Real-browser testing was **not** performed (Node VM / mocked-DOM verification only).

## Next action

After PR #37 is reviewed/merged, execute [`NEXT_AGENT_PROMPT.md`](NEXT_AGENT_PROMPT.md): harden `@youge/assistant-sdk` React and PWA-kit adapter contracts (`CD-2` + `CD-3`) — a self-contained, non-precached SDK slice requiring no kit or SDK version bump.
