# `@youge/assistant-sdk`

Framework-independent SDK core for **You.Ge Assistant**: centralized state,
multi-domain resolution, data-only configuration validation with Last-Known-Good
fallback, explicit on-demand DNS diagnostics integration, and existing PWA
installation integration.

> **Package status:** SDK `0.4.1` is prepared in this repository and **not yet
> published**. npm serves `0.4.0` (published 2026-11-19, registry verified
> 2026-11-22), which predates the Phase 1 correctness fixes described under
> *Recovery and failover* below; `0.4.1` is additive over `0.4.0` and the owner
> approves the gated release (see [`RELEASE.md`](RELEASE.md)). The compatible
> repository toolkit is `1.2.9` (`KIT_COMPAT_VERSION`).
> See [`MIGRATION.md`](MIGRATION.md) for host-owned worker integration and
> [`RELEASE.md`](RELEASE.md) for the authorization-gated release runbook.

---

## Architecture & Separation of Concerns

| Layer | Responsibility | Dependencies |
| --- | --- | --- |
| **SDK core** (`@youge/assistant-sdk`) | Public initialization (`create`, `attach`), data-only config & LKG validation, multi-domain resolution & manifest generation, centralized assistant state & subscriptions, connectivity/endpoint/session updates, explicit diagnostics & install delegation, `.d.ts` TypeScript contracts | **Zero** runtime dependencies (no React, Vue, Angular, or bundler runtime) |
| **PWA toolkit** (`pwa.js`, `pwa-install.js`, `/you-ge-sw.js`, `dns-diagnostics.js`) | `window.YouGePWA` / `window.PWA` APIs, integrated `<pwa-install>` dialog (`manual` default / opt-in `auto`, native Georgian `ka` and Estonian `et` support), `beforeinstallprompt` / iOS / QR fallback UI, single `/you-ge-sw.js` service worker (plus `/progressier.js` migration shim), host+scope+version cache isolation, offline fallback, Cloudflare DoH A/AAAA checks | Dependency-free classic browser scripts |
| **UI / Widget layer** (`assistant-widget.js`, `examples/example/`) | Floating assistant DOM renderer — auto-scaling launcher, manual size/position adjustment, Android Chrome handoff offer — plus the optional React external-store adapter (`@youge/assistant-sdk/react` + `examples/example/`) | SDK works independently of any widget or UI framework |

---

## Installation & Consumption

### From npm

```bash
npm install @youge/assistant-sdk
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
| `@youge/assistant-sdk/installation` | `window.PWA` state reader, installation state/copy derivation, native prompt, `<pwa-install>` dialog open/hide, related-app lookup, and service-worker update delegation |
| `@youge/assistant-sdk/browser` | Android in-app browser detection and best-effort Chrome handoff (`detectInAppBrowser`, `buildChromeIntentUrl`, `createChromeHandoff`) |
| `@youge/assistant-sdk/theme` | Adaptive theme normalization/resolution, WCAG contrast helpers, `--youge-*` CSS variables, and notification-level taxonomy |
| `@youge/assistant-sdk/launcher` | Launcher configuration normalization and shared action-attention derivation (`deriveLauncherAttention`) |
| `@youge/assistant-sdk/i18n` | Unified 12-locale dictionary (`en`, `ka`, `ru`, `fr`, `it`, `de`, `sv`, `nl`, `no`, `da`, `et`, `es`), BCP-47 locale resolver, translation + plural helpers, RTL detection, DNS localization, and Chrome handoff labels |
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

**Schema-version policy.** `schemaVersion` is optional for compatibility: a
published payload (or stored last-known-good record) that omits it — or sets it
to `null` — is accepted as the current major and reported as
`schema_version_missing` in `meta.warnings`. A declared but malformed value
(for example `'abc'`, `'1.2.x'`, `1.5`) or a different major (`2`, `'2.0.0'`)
is rejected with `unsupported_schema_version`, exactly as before. Declare
`schemaVersion: 1` in new payloads; the missing-value tolerance may be
tightened in a future major.

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

### Launcher appearance and action-triggered attention

Launcher appearance is optional, per-instance configuration. Existing consumers
keep their current 56px responsive launcher and visual mark unless they opt in.
The `launcher` block is validated, clamped, included in `getConfig()` and
published in `state.appearance.launcher` for renderers:

```ts
const assistant = YouGeAssistant.create({
  projectId: 'portal-prod',
  launcher: {
    size: 68,
    logo: '/brand/assistant-mark.svg', // same-origin, relative path only
    appearance: {
      shape: 'circle', // circle | rounded-square | square
      logoFit: 'cover', // contain | cover | fill
      logoSize: 78, // percent of launcher diameter
      logoScale: 1.18, // clamped 0.5–2.5
      logoPosition: { x: 50, y: 50 }, // object-position percentages, each 0–100
      logoBorderRadius: '50%',
      border: { width: 1, color: '#334155', style: 'solid' },
    },
    animation: {
      enabled: true,
      type: 'electric-border',
      preset: 'plasma',
      color: '#c084fc',
      speed: 1,
      intensity: 0.8,
      trigger: 'action-available',
      triggerCategories: ['installation', 'connectivity', 'recovery'],
      stopWhenViewed: true,
    },
  },
});
```

Defaults: `size: 56`, circle, contain, scale `1`, center position, logo size
`72%`, 1px solid border, and animation disabled. Shape, logo and border settings
are independent of the animation. Invalid values fall back field-by-field;
size, zoom, position, radius, speed, intensity and border width are bounded.
Logo paths must be relative/same-origin. Supported effect preset: **Plasma**.

Attention is derived centrally from the actual `notifications` and
`availableActions` snapshot. A notice must link to an action that is currently
available and its category must be selected; a permanent shortcut or an
informational message alone never starts attention. Existing action kinds map
to categories: `install` → `installation`, `diagnostics` → `connectivity`,
`recovery` → `recovery`, `backup` → `backup`, `update` → `update`, `help` →
`help`, and project actions → `custom`. Multiple eligible notices share one
launcher animation, with priority reported from the existing action priority.

The shipped renderers call `markViewed()` when the user opens the Assistant;
viewing stops attention by default without hiding or dismissing the notices.
A custom renderer should do the same. `dismiss()` and `acknowledge()` retain
their existing behavior. A host-owned action can report success through
`assistant.completeAction('my-action')` or dispatch
`youge:action:complete` with `{ actionId: 'my-action' }`; that retires attention
for notices linked to that action without changing the host's business logic.
Expired/cleared conditions remove their notifications and are recalculated
immediately. When `stopWhenViewed` is `false`, an available action may continue
to attract attention after it is viewed.

The launcher outline is an SDK-owned CSS/SVG effect inspired by an electric
current, not a bundled or ported React Bits component. The inspected React Bits
implementation is React + WebGL/GLSL, and its MIT + Commons Clause terms prohibit
redistribution/porting of the component; the SDK therefore avoids that license
and WebGL/GPU/dependency cost. This adaptation supports the Plasma color family,
speed and intensity but intentionally omits the original shader's cursor
interaction, sparks and other advanced controls. It animates only while eligible
action attention is active. `prefers-reduced-motion` replaces motion with a
static border; the ring is decorative, pointer-transparent, and launcher
semantics, focus treatment, labels and notification badge remain available.

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
[`MULTI_DOMAIN.md`](../../docs/guides/MULTI_DOMAIN.md) for classic-script and deployment
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
  `youge-assistant:chrome-offer-dismissed`); see [`WIDGET.md`](../../docs/guides/WIDGET.md).

---

## Adaptive theming

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
isolation layers are described in [`../../THEMING.md`](../../docs/guides/THEMING.md).

## Update lifecycle and state ownership

The host owns its service worker. Neither the SDK nor `pwa.js` registers or
replaces it. Custom worker updates can be connected through an injected `pwa`
adapter implementing the existing `getState`, `onChange` and `applyUpdate`
contracts; the host controls its own update mechanism. For the optional
host-registered Assistant worker, `data-assistant-worker` opts the classic
runtime into the existing update protocol. See the [ownership audit and migration guide](../../docs/architecture/PWA_IMPLEMENTATION_AUDIT.md).

`pwa:ready` is dispatched synchronously when `pwa.js` initializes its API; it
does not indicate worker lookup completed. At window `load` (or immediately for
a complete document), `PWA.ready` resolves to the opted-in matching registration
or `null`. `PWA.register()` is now a lookup, never a registration; call it again
after a later host registration to retry attachment (the initial `PWA.ready`
result remains unchanged). A successful
update request does not guarantee activation. The fallback reloads only if the
requested worker has taken control; otherwise the update is retryable.

The SDK's `network.updateAvailable` is a reconciled view, not a second worker
owner. A boolean toolkit snapshot/change is authoritative; `pwa:update` and
`setUpdateAvailable()` are compatibility fallbacks until the toolkit publishes
its explicit state. When that state becomes false, stale Assistant notification
and action state clears. Repeated identical updates do not emit duplicate state
snapshots or notifications.

### PWA feature controls (0.3.0)

Use the same validated `modules` configuration for SDK instances and the classic
integration. For the classic runtime, set `window.YOU_GE_ASSISTANT_CONFIG` before
loading `pwa.js` and the Assistant browser bundle; call `configure()` on an
attached Assistant for later changes. No control registers or changes a host worker.

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const assistant = YouGeAssistant.create({
  projectId: 'my-app',
  modules: {
    installationDetection: true,
    installationGuidance: true,
    updateDetection: true,
    updateNotifications: true,
    autoUpdate: false,
    userUpdate: true,
    offlineDiagnostics: true,
    cacheDiagnostics: true,
    extensions: { reports: false },
  },
});
const offline = await assistant.runOfflineDiagnostics();
const cache = await assistant.runCacheDiagnostics();
assistant.destroy();
```

All eight controls default to `true`, preserving existing behavior. `autoUpdate`
is permission for the already opt-in `data-auto-update` behavior; it does not
turn on automatic activation by itself. `installationDetection` masks the
Assistant's installation state, while `installationGuidance` gates Assistant
install actions and guidance. `updateDetection` masks Assistant update state and
events; `updateNotifications` gates notices; `userUpdate` gates Assistant
activation and refresh actions. Existing `modules.installation` and
`modules.updates` remain broader legacy SDK gates. Host worker updates and host
UI are independent of these settings. The optional `extensions` record accepts
up to 50 safe boolean flags; a future host module can check one with
`assistant.isCapabilityEnabled('reports')`. Unknown flags default enabled.

`runOfflineDiagnostics()` reports the browser's `navigator.onLine` hint, not a
network reachability proof. `runCacheDiagnostics()` delegates to an explicit PWA
adapter; the classic runtime only checks for its opted-in Assistant worker's
versioned static/page cache names, without reading entries or modifying caches.
Unsupported or unconnected environments return `unavailable`. These two methods
are independently controlled and do not replace the existing DNS diagnostics.

## Localization — 12 core locales (0.4.0)

`@youge/assistant-sdk/i18n` is the single source of truth for the SDK's own
wording: notices, actions, the floating widget, DNS classifications, the Chrome
handoff offer and the installation copy the SDK derives. It ships the same
twelve locales as the classic toolkit runtime:

| Code | Language | Native name |
| --- | --- | --- |
| `en` | English (default/fallback) | English |
| `ka` | Georgian | ქართული |
| `ru` | Russian | Русский |
| `fr` | French | Français |
| `it` | Italian | Italiano |
| `de` | German | Deutsch |
| `sv` | Swedish | Svenska |
| `nl` | Dutch | Nederlands |
| `no` | Norwegian (`nb`, `nn` normalize to `no`) | Norsk |
| `da` | Danish | Dansk |
| `et` | Estonian | Eesti |
| `es` | Spanish | Español |

### Install and import

```bash
npm install @youge/assistant-sdk@0.4.1   # exact-pin the prepared release
```

```js
import {
  DEFAULT_LOCALE,            // 'en'
  SUPPORTED_LOCALES,         // the 12 codes above, in published order
  LOCALE_METADATA,           // { code, name, nativeName, dir }
  RTL_LOCALES,               // ['ar', 'he', 'fa', 'ur'] — metadata, not core locales
  resolveLocale,             // precedence-aware BCP-47 resolver
  normalizeLocaleTag,        // any tag -> core locale code, or ''
  normalizeInstallLocaleTag, // tag for the <pwa-install> component (keeps 'auto' / zh-*, ca-ES)
  translate,                 // (locale, key, params?) -> string
  formatAlertCount,          // (locale, count) -> localized plural
  isRtlLocale,               // (locale) -> boolean
  localizeDnsClassification, // (locale, classification, status?) -> label
  localizeDnsMessage,        // (locale, classification, fallback?, caveat?) -> { message, caveat }
  chromeHandoffLabels,       // (locale) -> localized "Open in Chrome" copy
} from '@youge/assistant-sdk/i18n';
```

The same helpers are also exported from the root entry
(`import { translate } from '@youge/assistant-sdk'`), and the frozen
`YouGeAssistant` static object exposes `SUPPORTED_LOCALES`,
`LOCALE_METADATA`, `resolveLocale`, `translate`, `formatAlertCount`,
`isRtlLocale`, `normalizeLocaleTag`, `chromeHandoffLabels` and
`resolveInstallationCopy` for classic-script parity. Declarations ship beside
every entry (`SupportedLocale`, `LocaleMetadata`, `LocaleResolutionOptions`).

### Resolve the user's locale

`resolveLocale()` applies one documented precedence order and never reads
storage:

1. explicit selection (anything that is not `'auto'`),
2. host/domain configured language (`domainLocale` or `domainConfig.language` /
   `domainConfig.identity.language` / `domainConfig.installExperience.locale`),
3. the browser list (`navigator.languages`, then `navigator.language`),
4. `fallback` (default `en`).

```js
import { resolveLocale, LOCALE_METADATA, isRtlLocale } from '@youge/assistant-sdk/i18n';

const locale = resolveLocale({
  explicit: window.YOU_GE_ASSISTANT_LOCALE, // undefined / 'auto' falls through
  navigatorLanguage: navigator.languages?.[0],
});
const { nativeName, dir } = LOCALE_METADATA[locale];
document.documentElement.lang = locale;
document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : dir;
```

An attached Assistant tracks the same value: `assistant.getLocale()` returns the
active core locale and `assistant.setLocale('ka' | 'auto')` updates localized
notices/labels runtime-only (never persisted), syncs
`window.YouGePWA.setLanguage()` when present, and emits
`youge:locale-change`. Unsupported tags degrade to the fallback locale instead
of throwing.

### Show localized installation instructions

`resolveInstallationCopy(locale?)` returns the frozen copy set the toolkit uses,
so a host never re-implements strings:

```js
import { resolveInstallationCopy, translate } from '@youge/assistant-sdk/i18n';
// or: import { resolveInstallationCopy } from '@youge/assistant-sdk/installation';

const copy = resolveInstallationCopy('ka');
// {
//   language: 'ka',
//   installActionLabel,        // button label
//   instructionsActionLabel,
//   installAvailableTitle,
//   nativeAvailableMessage,    // Chromium: the browser offered a native prompt
//   iosAvailableMessage,       // iOS Safari: add to Home Screen
//   genericAvailableMessage,   // menu-based manual install
//   iosShortcutHint,           // "Share → Add to Home Screen"
//   genericHint,
// }

button.textContent = copy.installActionLabel;
hint.textContent = translate('ka', 'iosShortcutHint');
```

Other localization helpers:

```js
import {
  formatAlertCount,             // '1 alert' / '3 alerts' / '5 уведомлений'
  localizeDnsClassification,    // 'dns_resolution_failure' -> localized label
  localizeDnsMessage,           // -> { message, caveat }
  chromeHandoffLabels,          // -> { title, intro, steps, button labels }
} from '@youge/assistant-sdk/i18n';

count.textContent = formatAlertCount(locale, notices.length);
const dns = localizeDnsMessage(locale, result.classification, result.message, true);
```

### 12 core locales vs. 35 installation-dialog locales

Two distinct locale sets exist and they are deliberately not merged:

| Surface | Locales | Source |
| --- | --- | --- |
| **SDK core + classic toolkit wording** (notices, actions, widget, DNS, installation copy, handoff) | **12** | `@youge/assistant-sdk/i18n` (shared with `assistant-state.js`, `assistant-widget.js`, `pwa.js`, `dns-diagnostics.js`, `offline.html`) |
| **`<pwa-install>` dialog chrome** (the optional installation component rendered by the runtime) | **35** | vendored `@khmyznikov/pwa-install@0.7.0` (`src/runtime/pwa-install.js`), reached through `window.YouGePWA` — never imported by the SDK |

The component has its own locale list; `normalizeInstallLocaleTag()` maps a
BCP-47 tag onto the component's expected casing (`nb`/`nn` → `no`, `zh-Hant` →
`zh-TW`, `ca` → `ca-ES`) and preserves `'auto'` so the component can decide.
A component locale outside the SDK's 12 core locales localizes *only the dialog
chrome*; SDK notices and copy stay in the nearest supported core locale
(fallback `en`). Both sets are local-only assets — no CDN, no runtime download.

## PWA installation integration (0.4.0)

The installation entry point is a thin, framework-independent adapter over the
host's existing PWA runtime (`window.YouGePWA`, with the `window.PWA` alias).

The component it can open is configured through the validated, data-only
`installExperience` input (additive in `0.4.0`; every field is optional):

```js
YouGeAssistant.create({
  projectId: 'my-app',
  installExperience: {
    enabled: true,            // default true
    presentation: 'manual',   // 'manual' = gesture-triggered (default); 'auto' = opt-in prompt offer
    locale: 'auto',           // 'auto' or a BCP-47 tag forwarded to the component
    installDescription: '',   // optional, sanitized, max 280 chars
    manifestUrl: '',          // optional same-origin manifest path
    disableChrome: false,     // component flags pass through with validation
    styles: {},               // safe --custom-property overrides only
  },
}); // classic pages: window.YOU_GE_ASSISTANT_CONFIG before pwa.js/assistant-state.js
```

The input never registers a worker and never overrides the host's manifest
identity: `manifestId`/`manifestUrl` stay validated strings and are not applied
by the SDK itself.
It **never registers a service worker**, never captures `beforeinstallprompt`
in competition with `pwa.js`, never calls `fetch`, and never claims an
installation without a browser prompt.

```js
import {
  deriveInstallationState,
  resolveInstallationCopy,
  requestPwaInstall,
  showPwaInstallDialog,
  hidePwaInstallDialog,
  triggerPwaInstall,
  readInstalledRelatedApps,
} from '@youge/assistant-sdk/installation';
```

Types shipped with the entry: `InstallationSupport`
(`'native' | 'manual-ios' | 'manual-generic' | 'installed' | 'none'`),
`InstallationStatus`, `AssistantInstallationState`, `InstallationCopySet`,
`InstallDialogResult`, `RelatedAppInfo`, `PwaRuntimeLike` (the injectable
runtime shape, also usable with mocks/tests).

### Read the installation state

```js
const state = deriveInstallationState({
  pwa: window.YouGePWA,                       // host runtime; omit for "none"
  installExperience: assistant.getConfig().installExperience,
});

state.support;            // 'native' | 'manual-ios' | 'manual-generic' | 'installed' | 'none'
state.status;             // 'available' | 'installed' | 'unavailable'
state.canInstall;         // native prompt is available in this browser
state.installed;          // installed / standalone window
state.ios; state.safari;  // iOS Safari manual flow
state.platform;           // 'chromium' | 'ios' | 'generic'
state.nativeAvailable;    // === canInstall
state.componentEnabled;   // installation component allowed by config
state.componentLoaded;    // <pwa-install> upgraded
state.dialogOpen;         // component dialog currently open
state.presentation;       // 'manual' (default) | 'auto' (opt-in)
state.locale;             // locale handed to the component
state.backend;            // 'beforeinstallprompt' | 'manual' | 'none'
state.relatedAppsInstalled;
```

`deriveInstallationState({ enabled: false })` or a runtime whose
`config.features.installation === false` reports `support: 'none'` so a disabled
capability never advertises installation. `detection: false` stops state
detection without disabling the rest of the SDK.

### Open and hide the installation dialog

```js
const shown = await showPwaInstallDialog({ pwa: window.YouGePWA }, { locale });
// { shown: true, outcome: 'shown', backend: 'pwa-install' }
// Prefers window.YouGePWA.showInstallDialog(), falls back to promptInstall(),
// and reports { shown: false, outcome: 'unsupported' | 'disabled' | 'error' }
// instead of throwing.

hidePwaInstallDialog({ pwa: window.YouGePWA }); // true when the component was open
```

### Trigger installation when the browser supports it

```js
const result = await triggerPwaInstall({ pwa: window.YouGePWA }, { source: 'assistant' });
// { outcome: 'accepted' | 'dismissed' | 'unsupported' | 'error', backend?: string }

if (result.outcome === 'accepted') {
  announce('Installed — opening the app window'); // your own UI copy
} else if (result.outcome === 'dismissed') {
  // the visitor declined; offer the instructions again later
}
```

`requestPwaInstall()` is the compatibility path that only delegates to
`window.YouGePWA.promptInstall()`. Both helpers resolve to
`{ outcome: 'unsupported' }` when the API is missing and never reject.

### Browsers that only support manual installation

Most browsers cannot open a native installation prompt programmatically. Use the
derived state to choose the honest path:

```js
const state = deriveInstallationState({ pwa: window.YouGePWA });
const copy = resolveInstallationCopy(state.locale);

if (state.support === 'native') {
  await requestPwaInstall({ pwa: window.YouGePWA });      // Chromium prompt
} else if (state.support === 'manual-ios') {
  instruction.textContent = copy.iosShortcutHint;        // Safari: Share → Add to Home Screen
} else if (state.support === 'manual-generic') {
  instruction.textContent = copy.genericHint;            // browser menu / install component
  await showPwaInstallDialog({ pwa: window.YouGePWA });  // the component's written steps
} else if (state.installed) {
  hideInstallUi();
}
```

What the SDK can and cannot promise:

- A **native prompt** requires Chromium's `beforeinstallprompt`, an HTTPS
  origin, an eligible manifest (name, icons, `start_url`, display mode) and the
  browser's own engagement heuristics. The SDK surfaces availability; the
  browser decides.
- **iOS Safari** has no programmatic prompt. The SDK reports `manual-ios` and
  provides localized instructions (`showInstallHelp`/`showHelp` in the classic
  runtime).
- **Firefox on desktop, in-app browsers and embedded webviews** generally offer
  no install API. The SDK reports `manual-generic`/`none`.
- `outcome: 'accepted'` means the browser accepted the prompt, not that the app
  finished installing. Confirm with `readInstalledRelatedApps()` or the
  `appinstalled`/`pwa:installed` signal from the host runtime.

```js
const related = await readInstalledRelatedApps({ pwa: window.YouGePWA });
// Promise<RelatedAppInfo[]>; resolves [] when the browser has no
// navigator.getInstalledRelatedApps (most browsers) or the query is denied.
```

Installation component state flows into the PWA events the classic runtime
already dispatches (`youge:pwa:installable`, `youge:pwa:installed`,
`youge:pwa:install-dialog` and their legacy `pwa:*` aliases); the SDK only
observes them.

### Changing settings at runtime

A host administrator's existing application can update the **same** Assistant
instance using `configure()`. For a page using the classic toolkit and widget,
`attach()` returns the already-attached instance (or attaches one if absent):

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const assistant = YouGeAssistant.attach();
const unsubscribe = assistant.subscribe((state) => {
  console.log('Assistant update available:', state.network.updateAvailable);
});

function setPwaModule(name, enabled) {
  // configure() replaces the modules override, so retain the other settings.
  const modules = { ...assistant.getConfig().modules, [name]: enabled };
  return assistant.configure({ modules });
}

setPwaModule('updateNotifications', false);
console.log(assistant.isCapabilityEnabled('updateNotifications')); // false now
// Update detection and user-controlled activation remain enabled.
setPwaModule('cacheDiagnostics', false);
setPwaModule('updateNotifications', true); // cache diagnostics stays disabled
setPwaModule('cacheDiagnostics', true);

// When the host view unmounts:
unsubscribe();
```

`configure()` synchronously resolves settings, returns the new state and notifies
subscribers when that state changes. Subsequent Assistant actions and capability
checks use the new values without recreating the instance. Existing dialogs,
work already started, or an already-sent worker activation are not necessarily
reversed; for example, disabling `autoUpdate` does not undo an activation already
requested. These controls never change a host-owned worker or its update logic.

**Persistence and authorization belong to the host application.** Have the
host's authenticated, authorized admin endpoint validate an allowlist of module
names and boolean values, save the project's settings, and return the canonical
settings. After a successful save, pass them to the existing instance:

```js
// hostAdminApi is the host application's own authenticated API, not an SDK API.
async function saveAssistantModules(hostAdminApi, modules) {
  const saved = await hostAdminApi.saveAssistantModules(modules);
  return assistant.configure({
    modules: { ...assistant.getConfig().modules, ...saved.modules },
  });
}
```

On a later page load, fetch the saved settings and supply them in `modules` when
attaching the Assistant. If the classic toolkit may act before the Assistant
bundle loads, provide the same settings in `window.YOU_GE_ASSISTANT_CONFIG`
**before** loading `pwa.js`; otherwise a startup auto-update could already have
been requested. Distribute changes to other open clients through the host's own
mechanism and call `configure()` there too; the SDK does not persist, authorize,
or synchronize these local runtime overrides. Treat client settings and local
storage as untrusted: authorization and concurrency/conflict handling must be
server-side. A host can use local storage for a non-authoritative cache, but it
must not grant administrator privileges or override server policy.

### Module capability enforcement

`modules.diagnostics`, `modules.recovery`, `modules.failover` and `modules.help`
are enforced capabilities (`core/capabilities.js` is the single policy, exported
as `GATED_CAPABILITIES`, `isCapabilityEnabled()`, `capabilityForAction()`,
`isActionAllowed()`, `capabilitiesRecord()` and `disabledDiagnosticsResult()`):

| Flag `false` | What stops working |
| --- | --- |
| `modules.diagnostics` | `runDiagnostics()` resolves `{ status: 'disabled' }` without starting any runner (including an application-owned `services.diagnostics`); the `diagnostics` action, its notice links and the live DNS pipeline follow. Disabling it mid-run aborts the run and discards the late result. |
| `modules.recovery` | The `recovery` action item and its renderers. The SDK publishes recovery **state and actions only** — it performs no navigation, endpoint switching or authorization (see "Recovery and failover: division of responsibility" below). |
| `modules.failover` | The `backup-status` action and the `api:backup-active` notice. Endpoint state reported by the host is still recorded regardless of the flag. |
| `modules.help` | Help actions on notices and project-supplied actions with `kind: 'help'` (or a gated id). The underlying session condition is still reported. |

Enforcement happens at the API boundary, in generated actions *and*
project-supplied `configure({ actions })` entries, in notifications (a notice
that merely links to a gated action keeps its content and loses its action) and
in the React adapter's `dispatchAction()` (it returns
`{ disabled: true, capability }` instead of dispatching `youge:action`). Renderers
read `state.capabilities` and may call `assistant.isCapabilityEnabled(name)`.
Omitted flags keep the documented `true` default, so no configuration needs to
change. See
[`../../docs/architecture/CAPABILITY_ENFORCEMENT.md`](../../docs/architecture/CAPABILITY_ENFORCEMENT.md).

`modules.updates: false` gates the Assistant update notification, update action,
and `assistant.applyUpdate()` (which returns `disabled`). It does not disable
the toolkit's independent PWA prompt or service-worker machinery. Apply through
the Assistant instance when using the Assistant UI, so the gate and stale-state
reconciliation are honored. `destroy()` unsubscribes from `PWA.onChange()` and
removes Assistant listeners; `configure()` can toggle the updates module
without replacing the instance.

### Recovery and failover: division of responsibility

The SDK is a **state and presentation layer** for recovery and failover, not an
execution engine. It:

- records endpoint conditions the host reports through `setEndpointStatus()`
  and session conditions through `setSessionStatus()`;
- derives notices (`api:primary-failed`, `api:backup-active`,
  `api:primary-restored`, `session:issue`) and the `recovery` / `backup-status`
  action items, gated by `modules.recovery` / `modules.failover`;
- dispatches `youge:action` events and exposes the presentation flag
  `state.network.recovery` (see `setEndpointStatus`).

The SDK deliberately performs **no** endpoint health checks, **no** hostname or
endpoint switching, **no** authorization, and **no** navigation — including no
navigation to a fallback host. Those remain host-owned responsibilities: the
host probes its endpoints, decides whether a failure can be solved by changing
hostnames, validates any recovery destination against its own allowlist, and
owns all authentication and session security. There are no recovery lifecycle
hooks or navigation contracts in this release; the `recovery` action is a
dispatched event for the host to answer.

| Event | Meaning |
| --- | --- |
| `pwa:ready` | PWA API initialized; not a registration-success event. |
| `pwa:update` | Toolkit detected a waiting service-worker update. |
| `pwa:installable`, `pwa:installed` | Installation availability/state changed. |
| `pwa:diagnostics` | Toolkit diagnostics result. |

## Public API Reference

### `AssistantInstance` methods

| Method | Signature / Return | Description |
| --- | --- | --- |
| `getState()` | `() => AssistantState` | Returns the current deeply frozen (immutable) JSON-serializable state snapshot (`project`, `installation`, `network`, `capabilities`, `notifications`, `availableActions`, `badge`, `appearance`, `dismissed`, `acknowledged`). Every nested object and array is frozen, so external callers can never mutate internal assistant state through returned references (attempted mutation throws in strict-mode consumers); snapshot identity is stable between state changes for `useSyncExternalStore`. |
| `getConfig()` | `() => AssistantConfigSummary` | Returns resolved sanitized configuration plus `meta` (`source`, `revision`, `usedLastKnownGood`, `warnings`). |
| `getLocale()` | `() => SupportedLocale` | Returns the resolved active UI locale (`en`, `ka`, `ru`, `fr`, `it`, `de`, `sv`, `nl`, `no`, `da`, `et`, `es`). |
| `setLocale(locale)` | `(string) => AssistantState` | Resolves `'auto'` (honoring `domainConfig.language` before browser `navigator.languages`) or an explicit BCP-47 tag, updates localized notices/labels runtime-only (never written to `localStorage`), syncs `window.PWA.setLanguage()` when attached, and emits `youge:locale-change`. |
| `configure(options)` | `(AssistantConfigInput) => AssistantState` | Re-runs configuration resolution, reloads project-scoped notice state, and emits an updated snapshot without duplicating listeners. |
| `subscribe(fn, opts?)` | `(fn, { immediate?: boolean }) => () => void` | Subscribes to state transitions. Calls `fn(state)` immediately unless `{ immediate: false }`. Returns an `unsubscribe` function. |
| `setConnectivity(online)` | `(boolean) => AssistantState` | Updates online/offline condition explicitly. |
| `setEndpointStatus(detail)` | `({ primary, backup, active, reason }) => AssistantState` | Reports host-app primary/backup API health (presentation only — the SDK never probes or switches endpoints). When `active` transitions `'backup' → 'primary'` while `primary` is `'healthy'`, the state flag `network.recovery` becomes `true` (the "returned from the fallback endpoint" presentation flag); it is `false` whenever `active !== 'primary'`. |
| `setSessionStatus(detail)` | `({ state, message }) => AssistantState` | Reports `'unknown' \| 'ok' \| 'issue'` session condition from the host app's own auth layer. |
| `setDnsResult(result)` | `(object) => AssistantState` | Records normalized DNS diagnostic status (`classification`, `message`, `checkedAt`). |
| `setUpdateAvailable(flag?)` | `(boolean) => AssistantState` | Marks a waiting service worker update ready to apply. |
| `runDiagnostics(opts?)` | `({ signal? }) => Promise<object>` | Single-flight on-demand diagnostics delegating to `services.diagnostics` → `window.PWA.runNetworkDiagnostics` → `window.YouGeDns.check`. Resolves `{ status: 'disabled' }` and starts nothing when `modules.diagnostics` is false. Never polls automatically. An optional `AbortSignal` cancels the run: it resolves `{ status: 'cancelled', cancelled: true, failed: false }` and raises no connectivity or DNS notice. `destroy()` aborts any run still in flight. |
| `requestInstall(opts?)` | `() => Promise<{ outcome: string }>` | Delegates installation to `window.PWA.promptInstall()`. Never registers a second install flow or service worker. |
| `applyUpdate()` | `() => Promise<AssistantUpdateResult>` | Respects `modules.updates !== false` and delegates to `window.PWA.applyUpdate()`. Returns `{ applied, outcome }` (`'applied'`, `'no-waiting-worker'`, `'unsupported'`, `'disabled'`, `'error'`) and clears stale `updateAvailable` state when no waiting worker remains. |
| `dismiss(id)` | `(string) => boolean` | Dismisses a non-critical notification for the active `projectId`. Automatically resets once the underlying condition clears. |
| `acknowledge(id)` | `(string) => boolean` | Acknowledges a critical notification while keeping the condition visible in diagnostics. |
| `isCapabilityEnabled(name)` | `(string) => boolean` | Live check against the resolved configuration for `diagnostics`, `recovery`, `failover` and `help` (other names report `true`). Renderers and toolkit integrations use it instead of reading config. |
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
events into `@youge/assistant-sdk` while keeping `pwa.js` and `/you-ge-sw.js`
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

// Optional: let the user cancel a slow check. Cancellation is reported as
// `status: 'cancelled'` and never as a connectivity failure.
const checkController = new AbortController();
document.querySelector('#cancel-check-btn')?.addEventListener('click', () => {
  checkController.abort();
});
assistant.runDiagnostics({ signal: checkController.signal });

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
- **Publishing is gated, never automatic.** `0.4.1` is prepared in this
  repository; the registry reports `0.4.0` as `latest` (published 2026-11-19,
  verified 2026-11-22). The manual release workflow remains authorization-gated — no
  push, pull request or merge publishes anything, and the owner approves the
  staged version on npmjs.com. Historical release decisions and the current
  runbook are recorded in [`RELEASE.md`](RELEASE.md).
- **`0.4.0` is additive.** Every `0.3.0` export, type, event and compatibility
  alias is preserved; the release adds the `./i18n` subpath, the
  `installExperience` configuration input, the installation state/dialog
  helpers and their declarations. `SCHEMA_VERSION` stays `1`: the new input is
  optional and defaulted (`enabled: true`, `presentation: 'manual'`,
  `locale: 'auto'`), a `0.3.0` `publishedConfig` still validates unchanged, and
  unknown or unsafe keys are dropped rather than accepted.
  `KIT_COMPAT_VERSION` tracks the synchronized repository toolkit (`1.2.7`).
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
