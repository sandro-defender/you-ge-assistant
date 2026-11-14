# Next Agent Prompt — harden `@youge/assistant-sdk` React & PWA-kit adapter contracts (`CD-2` + `CD-3`)

Read `AGENTS.md`, `COMPATIBILITY_CONTRACTS.md`, and `AGENT_HANDOFF.md` first. Kit is **`1.2.0`** (canonical You.Ge Assistant technical identity migration on PR #37); `@youge/assistant-sdk` is **`0.2.0`**.

## Objective

Fix the two High-severity confirmed defects in `@youge/assistant-sdk`'s non-precached adapter and TypeScript declaration layer (`CD-2` and `CD-3` from `AGENT_HANDOFF.md`) without modifying any precached runtime asset or bumping kit/SDK versions:

1. **React external-store selector memoization, SSR fallback shape & lifecycle (`CD-2`):**
   - Update `createUseAssistant` in `packages/assistant-sdk/src/adapters/react.js` so selector-based subscriptions memoize selected snapshots (`Object.is`) before `useSyncExternalStore` compares them — ensuring components calling `useAssistant(selector)` do not re-render when unrelated `AssistantState` fields change and derived selector outputs remain tear-free and referentially stable while unchanged.
   - Complete `FALLBACK_ASSISTANT_STATE.project` in `packages/assistant-sdk/src/adapters/react.js` so every non-optional field declared on `AssistantProjectInfo` (`packages/assistant-sdk/src/index.d.ts`: `detectedHostname`, `matchedRegistryKey`, `projectIdSource`, `domainValidation`) is present and frozen for SSR `getServerSnapshot()` callers.
   - Update `createReactAdapter` (`packages/assistant-sdk/src/adapters/react.js`) so `resolveAssistant()` re-resolves when a cached instance reports `isDestroyed() === true` (matching `getExternalStoreBindings`).
   - Align paired TypeScript declarations: add optional `createElement` to `ReactAdapterOptions` (`packages/assistant-sdk/src/adapters/react.d.ts`) and optional `seedPrimary?: string | null` to `ThemeResolutionContext` (`packages/assistant-sdk/src/theme/index.d.ts`).
2. **`bridgePwaGlobals()` SDK global parity for `assistant-widget.js` (`CD-3`):**
   - Update `bridgePwaGlobals()` in `packages/assistant-sdk/src/adapters/pwa-kit.js` so `root.YouGeAssistantSDK` exposes (or merges onto an existing partial object without clobbering active `domain`/`YouGeAssistant` instances) the same theme, notification-level and Android Chrome-handoff helpers that `assistant-widget.js` reads (`resolveTheme`, `normalizeTheme`, `detectHostScheme`, `contrastRatio`, `THEME_MODES`, `THEME_TOKEN_KEYS`, `NOTIFICATION_LEVELS`, `NOTIFICATION_LEVEL_ICONS`, `NOTIFICATION_LEVEL_SHAPES`, `NOTIFICATION_LEVEL_SVG_ATTRIBUTES`, `NOTIFICATION_LEVEL_LABELS`, `notificationLevelMarkup`, `normalizeNotificationLevel`, `detectInAppBrowser`, `isChromeHandoffCandidate`, `buildChromeIntentUrl`, `chromeHandoffInstructions`, `createChromeHandoff`), while preserving `root.YouGePWA || root.PWA` resolution.

## Acceptance Criteria & Verification

- Use TDD (`tdd` skill): add failing regression tests first in `packages/assistant-sdk/tests/sdk-integrations.test.mjs`, `packages/assistant-sdk/tests/sdk-declarations.test.mjs`, and `tests/sdk-integration.test.mjs`, plus compile-time coverage in `example/src/sdk-public-subpaths.typecheck.ts`.
- Verify:
  1. `useAssistant(selector)` skips subscriber re-renders when unrelated state slices change and returns stable selected values across repeated `getSnapshot()` reads.
  2. `FALLBACK_ASSISTANT_STATE.project` satisfies every required property of `AssistantProjectInfo` (including `domainValidation.valid === true` and `domainValidation.issues`).
  3. `createReactAdapter` re-attaches cleanly if its previously resolved assistant was destroyed, and TypeScript accepts `{ useSyncExternalStore, createElement }` and `resolveTheme(theme, { seedPrimary })`.
  4. Mounting `assistant-widget.js` after `bridgePwaGlobals()` resolves adaptive themes (`data-scheme`, `--youge-*` variables) and offers Android Chrome handoff on restricted Android WebViews identically to `assistant-state.js`.
- Do **not** edit any file in `SOURCE_MODULES` of `scripts/sync-sdk-browser.mjs` unless authorized for a kit-version bump (`theme/index.d.ts` is `.d.ts`-only and does not change `assistant-state.js`). Confirm `node scripts/sync-sdk-browser.mjs --check`, `node scripts/precache-integrity.mjs`, `npm run test:sdk`, `node --test tests/sdk-integration.test.mjs`, `node packages/assistant-sdk/scripts/validate-package.mjs`, and `npm run check` (plus `example` `npm run typecheck` when dependencies are installed) all pass.

## Boundaries

- Keep `@youge/assistant-sdk` zero-dependency, ESM-only, with zero `fetch()`, `serviceWorker.register()`, `setInterval()`, or runtime `react` imports.
- Use canonical You.Ge Assistant surfaces (`window.YouGePWA`, `you-ge-sw.js`, `--youge-pwa-*`, `.youge-*`, `[data-youge-*]`, `youge:pwa:*`) in new code/docs while preserving all compatibility contracts in `COMPATIBILITY_CONTRACTS.md`; do not modify `reference/` or `PARITY.md`.
- Do not bump kit (`1.2.0`) or SDK (`0.2.0`) versions, tag, release, publish, deploy, or merge without explicit authorization.
- Update `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` when complete.
