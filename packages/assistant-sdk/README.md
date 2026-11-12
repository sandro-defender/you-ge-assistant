# `@youge/assistant-sdk`

Framework-independent SDK core for **You.Ge Assistant**: centralized state,
multi-domain resolution, data-only configuration validation with Last-Known-Good
fallback, explicit on-demand DNS diagnostics integration, and existing PWA
installation integration.

> **Package status (0.2.0 — prepared 2026-11-07, not yet staged):**
> `@youge/assistant-sdk@0.1.1` is on the public npm registry (org `youge`,
> scope `@youge`); `0.2.0` adds adaptive theming — four modes, validated
> custom tokens, optional host adaptation, the `./theme` subpath and the
> notification level taxonomy — prepared in-repo, **not staged and not
> published**; the owner dispatches the release workflow manually (see
> below). The first
> publication was staged by the manual-only `sdk-release-prep` workflow's
> `stage` job and became public only when the owner approved the staged
> version on npmjs.com with 2FA — the approved runbook is
> [`RELEASE.md`](RELEASE.md) §4. Staging and later releases authenticate
> with npm Trusted Publishing (OIDC); the workflows use **no npm token**
> (the temporary stage-only bootstrap was created, used and revoked).
> Release procedure and registry decision: [`RELEASE.md`](RELEASE.md).
> Vendored-copy → package migration (staff.you.ge): [`MIGRATION.md`](MIGRATION.md).

---

## Architecture & Separation of Concerns

| Layer | Responsibility | Dependencies |
| --- | --- | --- |
| **SDK core** (`@youge/assistant-sdk`) | Public initialization (`create`, `attach`), data-only config & LKG validation, multi-domain resolution & manifest generation, centralized assistant state & subscriptions, connectivity/endpoint/session updates, explicit diagnostics & install delegation, `.d.ts` TypeScript contracts | **Zero** runtime dependencies (no React, Vue, Angular, or bundler runtime) |
| **PWA toolkit** (`pwa.js`, `/progressier.js`, `dns-diagnostics.js`) | `window.PWA` APIs, `beforeinstallprompt` / iOS / QR install UI, single `/progressier.js` service worker, host+scope+version cache isolation, offline fallback, Cloudflare DoH A/AAAA checks | Dependency-free classic browser scripts |
| **UI / Widget layer** (`assistant-widget.js`, `example/`) | Floating assistant DOM renderer — auto-scaling launcher, manual size/position adjustment, Android Chrome handoff offer — plus the optional React external-store adapter (`@youge/assistant-sdk/react` + `example/`) | SDK works independently of any widget or UI framework |

---

## Installation & Consumption

### From npm (after publication)

```bash
npm install @youge/assistant-sdk@0.2.0
```

Pin the **exact version** (no `^`/`~`) if you want vendor-pin semantics — the
same deliberate-upgrade workflow as a vendored copy. See
[`MIGRATION.md`](MIGRATION.md) for replacing a vendored `packages/assistant-sdk`
copy.

The package is **ESM-only** (`"type": "module"`) and ships native ESM with
paired `.d.ts` declarations — no build step, no transpiled CommonJS. Vite,
Next, webpack, Rollup and esbuild consume it directly; Node ≥ 18 can
`import` it (CommonJS hosts can `await import('@youge/assistant-sdk')`).
The `exports` map is the only import surface: deep paths like
`@youge/assistant-sdk/src/...` are intentionally blocked.

### Local (repository checkout / vendored copy)

Inside another package in this repository or a sibling local project:

```json
{
  "dependencies": {
    "@youge/assistant-sdk": "file:../packages/assistant-sdk"
  }
}
```

### Subpath Exports

| Import path | Purpose |
| --- | --- |
| `@youge/assistant-sdk` | Full public API (`YouGeAssistant`, `createAssistant`, `attachAssistant`, config, domain, diagnostics, installation, toolkit bridge) |
| `@youge/assistant-sdk/domain` | Multi-domain resolution, validation, and scoped Web App Manifest generation |
| `@youge/assistant-sdk/config` | Data-only `publishedConfig` validator, Last-Known-Good storage helpers, and override resolver |
| `@youge/assistant-sdk/diagnostics` | Single-flight diagnostics integration controller and classification helpers |
| `@youge/assistant-sdk/installation` | `window.PWA` state reader and install prompt delegation |
| `@youge/assistant-sdk/browser` | Android in-app browser detection and best-effort Chrome handoff (`detectInAppBrowser`, `buildChromeIntentUrl`, `createChromeHandoff`) |
| `@youge/assistant-sdk/react` | Optional React 18/19 `useSyncExternalStore` adapter (zero runtime `react` import in SDK) |

All entry points ship paired `.d.ts` TypeScript declarations.

---

## Quick Start

### 1. Isolated instance (`YouGeAssistant.create`)

Works in any JavaScript runtime (browser ESM, Vite/Next/SvelteKit, or Node/SSR tests):

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const assistant = YouGeAssistant.create({
  projectId: 'my-project',
  domain: window.location.hostname,
});

const state = assistant.getState();

const unsubscribe = assistant.subscribe((nextState) => {
  console.log('Badge:', nextState.badge.count, nextState.badge.label);
});

// Clean up listeners when unmounting or tearing down:
unsubscribe();
assistant.destroy();
```

### 2. Shared page singleton (`YouGeAssistant.attach`)

When a page also loads `pwa.js`, `assistant-state.js`, or `assistant-widget.js`,
use `YouGeAssistant.attach()` so ESM modules and classic `<script>` tags share
**one** centralized state instance and **zero** duplicate listeners:

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const assistant = YouGeAssistant.attach({
  projectId: 'workspace-web',
  position: 'bottom-right',
});
```

### 3. Optional React 18/19 integration (`@youge/assistant-sdk/react`)

Inject `useSyncExternalStore` from the host app's `react` package — the SDK core
never imports React:

```tsx
import { useSyncExternalStore } from 'react';
import { YouGeAssistant } from '@youge/assistant-sdk';
import { createUseAssistant } from '@youge/assistant-sdk/react';

const useAssistant = createUseAssistant(
  useSyncExternalStore,
  () => YouGeAssistant.attach({ projectId: 'workspace-web' })
);

export function ConnectionPill() {
  const badge = useAssistant((state) => state.badge);
  return <span role="status">{badge.count ? badge.label : 'All clear'}</span>;
}
```

The getter is resolved **once per hook creation** (and re-resolved only if the
attached instance has been destroyed), because `useSyncExternalStore` calls
`getSnapshot` on every render. So it is a place to *attach* — not a place to
re-configure: a getter that calls `YouGeAssistant.attach({ ... })` with fresh
options on every render would re-configure the assistant on every render, and
`useAssistant` will not pick up new options passed that way after the first
resolution. To change configuration, call `attach({ ... })` (or
`assistant.configure({ ... })`) from an event handler or effect, then let the
state subscription re-render the component tree. Selectors are cached, so
`useAssistant((state) => state.badge)` only re-renders when the selected value
actually changes.

---

## Configuration & Last-Known-Good Pipeline

Configuration resolves deterministically in strict data-only order:

1. **Bundled defaults** (`BUNDLED_DEFAULTS`)
2. **Validated published revision** (`publishedConfig`, schema major `1`) — persisted per project under `localStorage["youge-assistant:lkg:<projectId>"]`
3. **Last-Known-Good fallback** — automatically loaded for the matching `projectId` if an incoming `publishedConfig` fails schema/security validation
4. **Explicit project overrides** — local options passed to `create()` / `attach()` / `configure()`

```js
const assistant = YouGeAssistant.create({
  projectId: 'portal-prod',
  publishedConfig: {
    schemaVersion: 1,
    revision: '2026-11-06.1',
    projectId: 'portal-prod',
    position: 'bottom-right',
    branding: {
      name: 'Customer Portal',
      shortName: 'Portal',
      themeColor: '#155eef',
    },
    modules: {
      installation: true,
      diagnostics: true,
      recovery: true,
      failover: true,
      help: true,
      updates: true,
      chromeHandoff: true, // Android in-app → Chrome offer (default true)
    },
  },
  // Optional project-local override wins over published defaults:
  theme: 'auto',
});

console.log(assistant.getConfig().meta);
// { schemaVersion: 1, source: 'published', revision: '2026-11-06.1', usedLastKnownGood: false, warnings: [] }
```

### Configuration Security Rules

- **Data-only JSON:** Functions, `<script>` payloads, `javascript:`/`vbscript:` URLs, `eval()`, and `new Function()` are rejected by `validatePublishedConfig()` and stripped from local overrides.
- **No secrets in SDK config:** Keys matching credential patterns (`apiKey`, `secret`, `privateKey`, `password`, `accessToken`, `bearerToken`, `vapidPrivateKey`, etc.) are rejected in `publishedConfig` and stripped from local config so secrets never enter state snapshots or `localStorage`.
- **Same-origin branding icons:** Cross-origin icon URLs are rejected in favor of safe same-origin fallback icons.

### Domain resolution and project identity

The SDK detects its runtime hostname from browser-like locations or full URLs,
normalizes case/trailing dots/ports, and supports custom hostnames, nested
subdomains, `localhost`, IPv4 and IPv6 development URLs. Registry precedence is
exact host + matching path, exact host, most-specific wildcard + path, then the
most-specific wildcard host; longer matching paths and a stable key tie-break
make resolution deterministic. Unknown hosts get safe defaults.

Use the typed `project` option for a stable app identity. Registry entries can
map multiple custom-domain aliases to the same ID; `projectId` remains supported
for existing callers. The order is `project.id` → `projectId` → matched registry
`project.id` → normalized host + application base path. This only controls the
SDK's logical project identity and project-scoped keys—it does not share browser
storage, authentication, cookies, installations or service workers across origins.
Hostname matching is not a trust or authorization decision.

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const domains = {
  'app.example.com': {
    project: { id: 'example-app' },
    identity: { name: 'Example App', shortName: 'Example' },
  },
  'app.customer-brand.test': {
    project: { id: 'example-app' },
    identity: { name: 'Example App', shortName: 'Example' },
  },
  '*.workspace.example.net': {
    project: { id: 'workspace' },
    identity: { name: 'Workspace', shortName: 'Workspace' },
  },
};

const assistant = YouGeAssistant.create({ domainRegistry: domains });
console.log(assistant.getState().project.projectIdSource); // 'domainRegistry', unless explicitly overridden

const checked = YouGeAssistant.validateDomainRegistry(domains);
if (!checked.valid) console.warn(checked.issues); // code, path and message per issue

const local = YouGeAssistant.resolveDomain('http://127.0.0.1:5173/app/', {
  '127.0.0.1/app/': { project: { id: 'local-app' } },
});
console.log(local.domain.origin, local.project?.id); // http://127.0.0.1:5173, local-app
```

`validateDomainConfig()` keeps its backward-compatible normalized-config return
value. `validateDomainConfigDetailed()` and `validateDomainRegistry()` add safe
normalized outputs plus actionable `valid`/`issues` results. See
[`MULTI_DOMAIN.md`](../../MULTI_DOMAIN.md) for classic-script and deployment
examples, wildcard/apex behavior and origin/storage boundaries.

---

## Android in-app browser → Chrome handoff (0.1.1)

Restricted Android in-app browsers (Facebook, Messenger, Instagram and the
generic Android WebView) can hide features and break links. The SDK ships a
reusable, dependency-free helper that detects them and offers a best-effort
**Open in Chrome** handoff — it never touches navigation on its own.

```js
import { createChromeHandoff } from '@youge/assistant-sdk';
// or: import { createChromeHandoff } from '@youge/assistant-sdk/browser';

const handoff = createChromeHandoff({
  userAgent: navigator.userAgent,
  location: window.location,
  document,
});

if (handoff.shouldOffer()) {
  // Confident Android restricted in-app detection only (never iOS, never
  // normal Chrome/Safari, never an uncertain/missing user agent).
  button.onclick = () => {
    handoff.open(window.location.href, (manualInstructions) => {
      // The intent could not leave the app → show copy-ready manual steps
      // (manualInstructions.steps / .url / .openLabel / …).
    });
  };
}
handoff.destroy(); // clears the pending fallback timer
```

**What it guarantees**

- `detectInAppBrowser(ua)` → frozen `{ android, ios, inApp, restricted,
  uncertain, browser }`. Facebook / Messenger / Instagram / WebView markers
  are recognised; a missing user agent reports `uncertain: true`.
- `isChromeHandoffCandidate()` is true only for **Android + restricted +
  certain** — iOS in-apps are identified but never candidates, supported
  browsers are never redirected, and ordinary navigation is never
  intercepted.
- `buildChromeIntentUrl(url, { packageName })` preserves the original
  pathname, query **and** hash
  (`intent://host/path?query#hash#Intent;…`) and also carries the full URL
  percent-encoded in `S.browser_fallback_url`. Only absolute `http(s)` URLs
  are accepted; anything else returns `null`.
- The handoff is best-effort: if the `intent://` attempt fails, or the page
  is still visible after `fallbackDelayMs` (default 900 ms), `open()` hands
  the caller `chromeHandoffInstructions()` — a three-step manual fallback
  with the original URL — instead of retrying or forcing anything.
- Config flag `modules.chromeHandoff` (default `true`) surfaces as
  `state.capabilities.chromeHandoff`; set it to `false` to disable the
  offer everywhere.
- The shipped widget (`assistant-widget.js`) and the React example both
  render this offer (with per-origin dismissal
  `youge-assistant:chrome-offer-dismissed`); see [`WIDGET.md`](../../WIDGET.md).

---

## Adaptive theming (unreleased)

`theme` accepts the original string form and a validated object form:

```js
const assistant = YouGeAssistant.create({
  theme: {
    mode: 'auto',        // auto | light | dark | custom
    inheritHost: false,  // opt in to reading the host page's allowlisted values
    tokens: { primary: '#7c3aed', radius: 16, fontFamily: 'Inter, system-ui, sans-serif' },
  },
});

assistant.configure({ theme: 'dark' });                 // runtime switch, same API
assistant.getConfig().theme;                            // 'dark'  (mode string)
assistant.getConfig().themeConfig;                      // validated record
assistant.getConfig().meta.warnings;                    // e.g. ['theme.tokens:invalid_token:primary']
```

Fourteen colour tokens (`primary`, `onPrimary`, `background`, `surface`,
`surfaceSoft`, `text`, `mutedText`, `border`, `focus`, `success`, `info`,
`warning`, `error`, `critical`) plus six design tokens (`fontFamily`,
`fontSize`, `radius`, `radiusSmall`, `borderWidth`, `shadow`). Invalid values are
dropped field by field with a warning code; nothing throws and nothing invalid
reaches the DOM. Host adaptation reads only accent/background/surface/text/muted/
border/font/radius/`--youge-*` variables, contrast-guards every colour, and
never inherits layout, position, z-index, offsets, launcher size or motion.

Helpers exported from the root entry and `@youge/assistant-sdk/theme`:

| Export | Purpose |
| --- | --- |
| `THEME_MODES`, `THEME_TOKEN_KEYS`, `COLOR_TOKEN_KEYS`, `TOKEN_CSS_VARIABLES`, `PROTECTED_VARIABLES` | Token vocabulary and the variables a theme may not override. |
| `normalizeTheme(input)`, `normalizeToken(key, value)` | Idempotent validation with `warnings`. |
| `resolveTheme(theme, context)` | Pure resolution to `{ mode, scheme, inheritHost, tokens, variables, warnings }`. |
| `themeToCssVariables(resolved)` | Filtered `--youge-*` map. |
| `detectHostScheme`, `detectHostTypography`, `contrastRatio`, `relativeLuminance`, `bestInk` | Host detection and WCAG maths. |
| `NOTIFICATION_LEVELS`, `NOTIFICATION_LEVEL_SHAPES`, `NOTIFICATION_LEVEL_ICONS`, `NOTIFICATION_LEVEL_LABELS`, `normalizeNotificationLevel`, `notificationLevelMarkup` | Notification tier metadata shared by every renderer. |

React renderers use `resolveAppearanceTheme(state.appearance)` and
`notificationLevelElement(level, createElement)` from
`@youge/assistant-sdk/react`, so an app never re-implements theming and never
injects markup. The library ships no CSS of its own; the embedded widget's
isolation layers are described in [`../../THEMING.md`](../../THEMING.md).

## Public API Reference

### `AssistantInstance` methods

| Method | Signature / Return | Description |
| --- | --- | --- |
| `getState()` | `() => AssistantState` | Returns the current immutable-convention JSON-serializable state snapshot (`project`, `installation`, `network`, `capabilities`, `notifications`, `availableActions`, `badge`, `appearance`, `dismissed`, `acknowledged`). |
| `getConfig()` | `() => AssistantConfigSummary` | Returns resolved sanitized configuration plus `meta` (`source`, `revision`, `usedLastKnownGood`, `warnings`). |
| `configure(options)` | `(AssistantConfigInput) => AssistantState` | Re-runs configuration resolution, reloads project-scoped notice state, and emits an updated snapshot without duplicating listeners. |
| `subscribe(fn, opts?)` | `(fn, { immediate?: boolean }) => () => void` | Subscribes to state transitions. Calls `fn(state)` immediately unless `{ immediate: false }`. Returns an `unsubscribe` function. |
| `setConnectivity(online)` | `(boolean) => AssistantState` | Updates online/offline condition explicitly. |
| `setEndpointStatus(detail)` | `({ primary, backup, active, reason }) => AssistantState` | Reports host-app primary/backup API health. |
| `setSessionStatus(detail)` | `({ state, message }) => AssistantState` | Reports `'unknown' \| 'ok' \| 'issue'` session condition from the host app's own auth layer. |
| `setDnsResult(result)` | `(object) => AssistantState` | Records normalized DNS diagnostic status (`classification`, `message`, `checkedAt`). |
| `setUpdateAvailable(flag?)` | `(boolean) => AssistantState` | Marks a waiting service worker update ready to apply. |
| `runDiagnostics(opts?)` | `() => Promise<object>` | Single-flight on-demand diagnostics delegating to `services.diagnostics` → `window.PWA.runNetworkDiagnostics` → `window.YouGeDns.check`. Never polls automatically. |
| `requestInstall(opts?)` | `() => Promise<{ outcome: string }>` | Delegates installation to `window.PWA.promptInstall()`. Never registers a second install flow or service worker. |
| `dismiss(id)` | `(string) => boolean` | Dismisses a non-critical notification for the active `projectId`. Automatically resets once the underlying condition clears. |
| `acknowledge(id)` | `(string) => boolean` | Acknowledges a critical notification while keeping the condition visible in diagnostics. |
| `isDestroyed()` | `() => boolean` | Returns `true` after `destroy()` has been called. |
| `destroy()` | `() => void` | Removes all `window`/`document` event listeners, unsubscribes from `PWA.onChange`, and clears subscribers. |

### Notification Priority Ladder

1. **`1` (`critical`):** Offline (`network:offline`), DNS failure (`dns:failure`), host unreachable (`network:unreachable`), primary endpoint failed (`api:primary-failed`)
2. **`2` (`auth`):** Host-reported session attention (`session:issue`)
3. **`3` (`backup`):** Backup endpoint active (`api:backup-active`)
4. **`4` (`install`):** PWA installation available (`install:available`)
5. **`5` (`info`):** Primary endpoint restored (`api:primary-restored`), app update ready (`app:update`), configured feature announcements (`feature:<id>`)

### Browser handoff helpers (0.1.1)

Also reachable from the root entry, the frozen `YouGeAssistant` static and
`@youge/assistant-sdk/browser`:

| Export | Signature / Return | Description |
| --- | --- | --- |
| `detectInAppBrowser(ua?)` | `(string?) => InAppBrowserDetection` | Classifies the user agent; frozen result, `uncertain: true` when unavailable. |
| `isChromeHandoffCandidate(d)` | `(d) => boolean` | Android + restricted + certain only. |
| `buildChromeIntentUrl(url, opts?)` | `(string, { packageName? }) => string \| null` | `intent://` URL preserving path, query and hash; `null` for non-http(s)/invalid input. |
| `chromeHandoffInstructions(url, labels?)` | `(string, labels?) => ChromeHandoffInstructions` | Copy-ready manual fallback data (title, 3 steps, URL, button labels). |
| `createChromeHandoff(opts?)` | `(opts?) => ChromeHandoffController` | `{ detection, shouldOffer(), intentUrl(), instructions(), open(url, onFallback), destroy() }` with injectable environment for tests. |
| `CHROME_PACKAGE` / `CHROME_OFFER_STORAGE_KEY` | `string` | `'com.android.chrome'` / `'youge-assistant:chrome-offer-dismissed'`. |

---

## Illustrative Host-Project Integration Example

Below is an illustrative integration showing how any independent web application
(for example, `https://portal.example.com`) wires its own API health and session
events into `@youge/assistant-sdk` while keeping `pwa.js` and `/progressier.js`
responsible for installation and offline caching:

```js
import { YouGeAssistant, bridgePwaGlobals } from '@youge/assistant-sdk';

// 1. Register domain branding & attach singleton state before or alongside pwa.js
const { assistant } = bridgePwaGlobals({
  domainRegistry: {
    'portal.example.com': {
      identity: { name: 'Operations Portal', shortName: 'Ops Portal' },
      branding: { themeColor: '#155eef', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/', scope: './', startUrl: './?launchedfrom=homescreen' },
    },
  },
  assistantConfig: {
    projectId: 'ops-portal',
    actions: [
      { id: 'support', label: 'Contact support', kind: 'help', icon: 'help', message: 'Open support desk' },
    ],
  },
});

// 2. Report real endpoint or session transitions from the host app's own API client
export function onApiHealthChange({ primaryOk, usingBackup, reason }) {
  assistant.setEndpointStatus({
    primary: primaryOk ? 'healthy' : 'unavailable',
    backup: usingBackup ? 'active' : 'inactive',
    active: usingBackup ? 'backup' : 'primary',
    reason: reason || '',
  });
}

export function onSessionExpired() {
  assistant.setSessionStatus({
    state: 'issue',
    message: 'Please sign in again to sync changes.',
  });
}

// 3. Trigger diagnostics or install only from explicit user actions
document.querySelector('#check-network-btn')?.addEventListener('click', () => {
  assistant.runDiagnostics();
});

document.querySelector('#install-app-btn')?.addEventListener('click', () => {
  assistant.requestInstall();
});
```

---

## Security & Non-Goals

- **Domain detection is never authentication:** `resolveDomain()` selects public UI branding and manifest scope only. Unknown hosts receive `configured: false` and neutral defaults. Authentication and authorization always stay inside each host project.
- **Zero background network traffic:** The SDK core contains **no `fetch()` calls**, **no `setInterval()` polling**, **no telemetry**, and **no service worker registration**.
- **No sensitive caching or write replay:** Only public notice dismissal timestamps (`youge-assistant:notices:<projectId>`) and validated public data-only config (`youge-assistant:lkg:<projectId>`) touch `localStorage`.

---

## Versioning & Releases

- **Semver policy:** `patch` = fixes only · `minor` = additive API ·
  `major` = breaking API or config-schema change. Pre-1.0 (`0.x`) until the
  API is frozen by a public release.
- **Version sources are synchronized and machine-checked:** `package.json` ↔
  `SDK_VERSION` ↔ `KIT_COMPAT_VERSION` (the compatible You.Ge Assistant
  runtime line) ↔ the runtime version.
- **Publishing is gated, never automatic.** `0.2.0` is prepared in-repo
  (2026-11-07) and **not staged or published**; `0.1.1` was published
  (2026-11-07) and `0.1.0` (2026-11-06)
  only through the manual `sdk-release-prep` workflow's staged-approval flow;
  every publication still requires explicit authorization (`confirm_publish`,
  `SDK_RELEASE_ENABLED`, the protected `sdk-npm-publish` environment, npm
  Trusted Publishing (OIDC) on both the `stage` and `publish` jobs — no npm
  token anywhere — and the `SDK_RELEASE_CONFIRM` env that `prepublishOnly`
  requires — a stray direct `npm publish` is refused). The registry decision
  and release runbook live in [`RELEASE.md`](RELEASE.md).
- Replacing a vendored SDK copy (e.g. `staff.you.ge`): see
  [`MIGRATION.md`](MIGRATION.md).

---

## Testing & Verification

Run the standalone SDK test suite independently of the PWA application:

```bash
cd packages/assistant-sdk
npm test
node scripts/validate-package.mjs   # package metadata, export map, versions, contents
npm pack --dry-run                  # what a release would contain
```

From the repository root, `npm run check` runs the static contracts, this
package validation and the full test suites together.
