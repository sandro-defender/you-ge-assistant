# PWA Installation Experience — Preservation Record and SDK Contract

**Status:** audited 2026-11-05. The implementation in `pwa.js`, `pwa.css`,
`progressier.js` and `manifest.webmanifest` is **preserved**. This document is
the extraction boundary for a future `@youge/assistant-sdk/install` module.
No browser supports fully programmatic installation: the SDK must continue to
react to browser-fired events and show manual instructions where required.

---

## 1. Current behavior, question by question

### How installation eligibility is detected

- `pwa.js` listens for `beforeinstallprompt`, calls `event.preventDefault()`,
  stores the event in `installPromptEvent`, calls `refreshState()` and dispatches
  `pwa:installable`. `PWA.canInstall()` and `PWA.getState().canInstall` reflect
  whether a deferred event is currently available.
- Feature gates are respected first: `domainConfig.pwa.enabled === false` or
  `domainConfig.features.installation === false` disables capture, prompts,
  banners, help sheets and install buttons.
- There is **no** claim that an app can be installed without the browser event.
  When no event exists, the kit offers manual instructions (or a QR path on
  desktop when `data-desktop-qr` is configured). `getInstalledRelatedApps()` is
  not used and is not implied.
- `PWA.getState()` also exposes `standalone`, `installed`, `ios`, `safari`,
  `launchSource`, `hostname`, `origin` and `basePath`.

### How the native browser installation prompt is triggered

- Only from a user gesture: an `.progressier-install-button` click/Enter/Space,
  a delegated `[data-pwa-install]` click, the install banner button, the welcome
  flow, the floating toolbox or a direct `PWA.promptInstall()` call.
- `promptInstall()` takes the single stored `beforeinstallprompt` event, clears
  it first (so it cannot be reused), calls `event.prompt()`, then awaits
  `event.userChoice`. It returns `{ outcome: 'accepted' | 'dismissed' }` and
  sets `installed = true` on acceptance.
- The desktop QR path (`data-desktop-qr`, `window.screen.width > 991`, non-iOS)
  loads `qrcode.js` on demand and returns `{ outcome: 'qr' }` instead of
  pretending a desktop native prompt exists.

### How already-installed applications are detected

- `isStandalone()` checks `matchMedia` for `standalone`, `fullscreen`,
  `minimal-ui` and `window-controls-overlay` display modes, then
  `navigator.standalone === true` (iOS) and an `android-app://` document
  referrer (TWA / trusted web activity).
- A `?launchedfrom=homescreen` launch parameter also sets the in-memory
  `installed` flag, matching the manifest `start_url`.
- `appinstalled` sets `installed = true`, clears the deferred event and
  dispatches `pwa:installed`. A `matchMedia('(display-mode: standalone)')`
  change listener re-emits state. `pageshow` with `event.persisted` refreshes
  state after back/forward cache restores.
- Install buttons are hidden with `data-hide-standalone` (default) or disabled
  in standalone with `data-hide-standalone="false"`; labels/icons switch to
  "launch/open" state. `[data-pwa-show-standalone]` and
  `[data-pwa-hide-standalone]` elements are toggled by `refreshDom()`.

### How Android / Chromium installation works

- On Chromium/Android the browser fires `beforeinstallprompt`; the kit captures
  it and invokes the native prompt from an install button, banner, welcome flow
  or toolbox. `userChoice.outcome` drives state and analytics events
  (`install_prompt`, `install_choice`, `install_qr`, `install_instructions`).
- `.progressier-install-button` supports `data-behavior`, `data-hide-standalone`,
  `data-allow-ios`, `data-allow-samsung`, `data-icons`,
  localized `data-install` / `data-installed` labels, keyboard activation and a
  400ms re-render interval. A delegated click handler plus a
  `MutationObserver` keeps dynamically added buttons working.
- Android launch from a TWA is recognized through the `android-app://` referrer.

### How iOS installation instructions work

- `isIOS()` matches iPhone/iPad/iPod user agents and iPadOS 13+ desktop-mode
  (`Macintosh` + `navigator.maxTouchPoints > 1`). `isSafari()` excludes
  Chrome/CriOS/Edge/Opera/Firefox/FxiOS/SamsungBrowser.
- No native `beforeinstallprompt` exists on iOS. `promptInstall()` falls back to
  `showHelp('ios')`, which renders a shadow-DOM dialog with the steps **Share →
  Add to Home Screen → Add**, the app icon/name and the note that iOS requires
  Safari. `PWA.showInstallHelp('ios')` exposes the same sheet.
- A `window.alert` fallback is used when Shadow DOM is unavailable.

### How unsupported browsers are handled

- `showHelp('generic')` shows neutral manual steps (browser menu → "Install
  app" / "Add to Home screen" → confirm) and returns
  `{ outcome: 'instructions' }`. Banners can be limited with
  `platforms: 'mobile' | 'desktop' | 'all'` and `preview: true`.
- The kit never claims a programmatic install, never auto-fires a prompt on
  page load, and does not treat an unknown domain as installable with
  privileged endpoints (unknown hosts receive safe defaults).

### How installation state is stored

- **Runtime only:** `installPromptEvent`, `installed`, `updateAvailable`,
  `registration`, `listeners` and `launchSource` live in the `pwa.js` closure.
  There is no persistent "installed" flag in `localStorage`; installed state is
  derived from browser display mode, launch source and install events. This is
  intentional — browser installation state is authoritative.
- **Dismissal state:** `progressierinstallbanner` and `progressierpushbanner`
  cookies (legacy-compatible names) control banner intervals, default 7 days,
  with 365-day dismissal cookies and `SameSite=Lax; path=/`.
- **Welcome state:** `localStorage['pwakit:welcome'] = '1'`.
- **Config/branding:** `domain-registry.js` + `domain-config.js` are public,
  validated data. They contain no secrets and are not authentication state.

### How the prompt is displayed and dismissed

- Surfaces: `.progressier-install-button`, `[data-pwa-install]`, the top install
  banner, the welcome dialog, the floating install toolbox, the QR dialog, and
  `showInstallHelp('ios' | 'generic')`.
- The help sheet is a modal (`role="dialog"`, `aria-modal="true"`) with a
  backdrop, close ✕, "Got it", Escape handling, focus moved to the primary
  button and focus restored to the previously focused element on close. Clicking
  the backdrop, close or primary button removes it. Only one sheet is open at a
  time (`[data-pwa-help]` guard).
- Banners have "Install" and "Not now" buttons plus a keyboard-operable close
  control; dismissal writes the cookie and animates the banner out. `rtl`
  wording is supported. `pwa.css` contains a global
  `@media (prefers-reduced-motion: reduce)` rule.
- All UI is driven by the public `window.PWA` API and `pwa:*` events, so a host
  app can replace the visual layer without reimplementing detection.

### Whether installation instructions are cached or available offline

- The service worker **explicitly excludes `pwa.js` from caching**
  (`CLIENT_PATH` check in the `fetch` handler). The instruction strings live in
  `pwa.js`, so they are available offline **only while that page's script is
  already loaded in memory**. A fresh offline navigation does not get the
  platform-specific install sheet.
- What **is** precached: `offline.html`, `offline.css`, `offline.js`,
  `domain-config.js`, `domain-registry.js`, `dns-diagnostics.js`, `pwa.css`,
  `qrcode.js`, `icons/icon-192.png`, `icons/icon-512.png`. The offline fallback
  page includes DNS/network recovery instructions and locally resolved
  hostname/scope branding, and its retry link is derived from the active scope.
- `pwa.css` is precached, so the visual layer for the install banner is
  available offline; `qrcode.js` is precached for the QR path; neither replaces
  `pwa.js`.
- **Documented limitation / future SDK improvement:** publish installation copy
  as static, brandable JSON/HTML that can be precached with the offline shell.
  This PR does not change that behavior; changing precache policy could affect
  existing installs and must be a separate, tested phase.

---

## 2. Backward-compatibility contract (freeze before extraction)

| Contract | Keep |
| --- | --- |
| Public API | `PWA.promptInstall/install`, `canInstall`, `isStandalone`, `isInstalled`, `isIOS`, `isSafari`, `getState`, `onChange`, `refresh`, `showInstallHelp`, `showInstallBanner/hideInstallBanner`, `showInstallRequest`, `wording`, `showQRCode`, `notify` |
| Events | `beforeinstallprompt`, `appinstalled`, `pwa:installable`, `pwa:installed`, `pwa:update`, display-mode changes |
| Markup | `.progressier-install-button`, `[data-pwa-install]`, `[data-pwa-diagnostics]`, `[data-pwa-show-standalone]`, `[data-pwa-hide-standalone]`, `data-*` button attributes |
| Persistence | legacy cookie names, `pwakit:welcome`, legacy IndexedDB names |
| Identity | legacy manifest `id` `/HIPSBNVemXtM8VMwRfWs` and `/progressier.js` worker path |
| Styling | `pwa.css` class names and toolbox sizing/placement verified against `reference/Script.decompiled.js` |

## 3. Future SDK module design — `@youge/assistant-sdk/install`

A **single public package with internal modules** is the target. Do not create
multiple packages or an empty package in this phase. The install module should
be a thin, brandable adapter over the browser events, not a replacement for
them:

```ts
// Illustrative interface only — not implemented in this PR.
export interface AssistantInstallIdentity {
  projectId: string;             // stable, used only for namespacing
  name: string;                  // project-specific branding
  shortName: string;
  icon: string;                  // same-origin URL
  manifestUrl: string;
  startUrl: string;
  scope: string;
}

export interface AssistantInstallCopy {
  ios: string[];                 // ordered manual steps
  generic: string[];
  iosNote?: string;
  labels: { install: string; installed: string; notNow: string; close: string };
  locale?: string;               // reuse existing wording table
}

export interface AssistantInstallBehavior {
  desktopQr?: boolean;
  banner?: { enabled: boolean; platforms: 'all' | 'mobile' | 'desktop'; intervalDays: number };
  welcome?: boolean;
  toolbox?: boolean;
  hideStandalone?: boolean;
  storageNamespace?: string;     // project-scoped, never global
}

export interface AssistantInstallExperience {
  readonly state: AssistantInstallState; // { standalone, installed, canInstall, platform, launchSource }
  requestInstall(options?: { skipQr?: boolean }): Promise<{ outcome: string }>;
  showInstructions(platform: 'ios' | 'generic'): void;
  showBanner(options?: object): void;
  onChange(listener: (state: AssistantInstallState) => void): () => void;
  destroy(): void;               // remove listeners, observers, timers
}

export function createInstallExperience(config: {
  identity: AssistantInstallIdentity;
  copy?: Partial<AssistantInstallCopy>;
  behavior?: Partial<AssistantInstallBehavior>;
  location?: Pick<Location, 'hostname' | 'origin' | 'href'>; // injectable for tests
  events?: EventTarget;          // injectable for tests
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}): AssistantInstallExperience;
```

Design rules for the future module:

1. **No programmatic install claim.** `requestInstall()` may only call the
   browser-supplied `beforeinstallprompt` event, or show instructions/QR.
2. **Project-specific branding and copy** come from validated data, never from
   executable remote JavaScript. Unknown domains get safe neutral defaults.
3. **Manifest settings remain a separate module** (`manifest utilities`); the
   install module consumes the resolved identity, it does not invent IDs or
   scopes (changing `id` creates a second installed app).
4. **State storage is namespaced by `projectId`** and remains compatible with
   legacy cookie names where an existing install depends on them.
5. **Offline copy is data, not code** — precache a small JSON/HTML instruction
   resource with the offline shell when that phase is implemented.
6. **All listeners/observers/timers are removable** via `destroy()`; respect
   `prefers-reduced-motion`; keep visible focus and ≥24px (prefer 44px) targets.
7. **Domain detection is never authentication.** Admin actions belong to the
   dashboard, not to this module.

## 4. Verification added in this PR

`tests/install-experience.test.mjs` runs `pwa.js` in a dependency-free DOM
harness and asserts: event capture and `preventDefault`, native `prompt()` on a
user action, `userChoice` outcomes, `appinstalled`, already-installed behavior,
standalone/iPadOS/TWA detection, iOS and generic instruction sheets, sheet
dismissal (close/Escape), banner dismissal cookies, and service worker
registration with `/progressier.js` and its computed scope. Static contract
tests additionally pin the precache list, manifest identity and cache namespace.

## 5. Self-contained `<pwa-install>` integration (kit `1.2.6`, unchanged in `1.2.7`)

Kit `1.2.6` integrates `@khmyznikov/pwa-install@0.7.0` (MIT, vendored as a self-contained
runtime script `pwa-install.js` with zero CDN calls across 35 supported locales,
including native Georgian `ka`, Russian `ru`, and Estonian `et`):

- **`manual` default (opt-in `auto`):** `installExperience.presentation` defaults to
  `'manual'`, meaning no unprompted install dialog opens on initial load unless
  explicitly configured (`presentation: 'auto'` or `data-install-presentation="auto"`).
- **Rich native & manual dialog:** `PWA.showInstallDialog(options)`,
  `PWA.hideInstallDialog()`, `PWA.triggerInstall()`, `PWA.getInstalledRelatedApps()`,
  and `PWA.configureInstallExperience(options)` drive `<pwa-install>` cleanly while
  respecting `data-desktop-qr`, `data-behavior`, `data-allow-ios`, and
  `data-allow-samsung`, and automatically falling back to `showHelp('ios' | 'generic')`
  when custom elements are unavailable or on unsupported browsers (`fallbackAvailable === false`).
- **Full 12-locale toolkit & 35-locale install dialog parity:** `pwa.js` (`wording` +
  `showHelp('ios' | 'generic')`), `dns-diagnostics.js`, `offline.js`, `assistant-widget.js`,
  `@youge/assistant-sdk/i18n`, and both example surfaces share 12 synchronized locales
  (`en`, `ka`, `ru`, `fr`, `it`, `de`, `sv`, `nl`, `no`, `da`, `et`, `es`), while
  `pwa-install.js` independently supports 35 locales including `ka`, `ru`, and `et`.
- **SDK parity (`@youge/assistant-sdk`):** `installExperience` defaults, localized
  copy (`resolveInstallationCopy`, `translate`, `resolveLocale`), `showInstallDialog` /
  `hideInstallDialog` / `triggerInstall` / `getInstalledRelatedApps`, and
  `EVENT_NAMES.pwaInstallDialog` are mirrored in the SDK core and browser bundle
  (`assistant-state.js`).

## 6. Driving it from the SDK `0.4.1`

The SDK does not add a second installation flow: it reads and calls the runtime
described above. Every helper returns an honest result instead of throwing, so a
host can render guidance from one `switch` and never claim that a browser can
install.

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

const state = deriveInstallationState({ pwa: window.YouGePWA });
const copy = resolveInstallationCopy(state.locale); // 12 core locales

switch (state.support) {
  case 'native':                       // Chromium offered beforeinstallprompt
    await requestPwaInstall({ pwa: window.YouGePWA });
    break;
  case 'manual-ios':                   // Safari: no programmatic prompt exists
    hint.textContent = copy.iosShortcutHint;
    break;
  case 'manual-generic':               // menu-based install / component steps
    await showPwaInstallDialog({ pwa: window.YouGePWA }, { locale: state.locale });
    break;
  case 'installed':
    hideInstallUi();
    break;
  default:                             // 'none': no runtime or capability disabled
    hint.textContent = copy.genericHint;
}
```

- `deriveInstallationState()` reports `support`, `status`, `canInstall`,
  `installed`, `ios`/`safari`, `platform`, `componentEnabled`,
  `componentLoaded`, `dialogOpen`, `presentation`, `locale`, `backend` and
  `relatedAppsInstalled`; `enabled: false` or `features.installation === false`
  yields `support: 'none'`.
- `showPwaInstallDialog()` prefers the component's `showInstallDialog()`, falls
  back to `promptInstall()`, and returns
  `{ shown, outcome, backend }`. `hidePwaInstallDialog()` returns `true` only
  when the component was open.
- `triggerPwaInstall()` prefers `triggerInstall()`; browsers without it fall
  back to the prompt API. `outcome: 'accepted'` means the prompt was accepted —
  confirm installation with `readInstalledRelatedApps()` or the runtime's
  `pwa:installed` event.
- **Two locale sets stay separate:** the SDK's copy, notices and widget use the
  twelve core locales; the `<pwa-install>` dialog chrome uses its own 35. A
  component-only locale localizes the dialog, while SDK strings fall back to
  `en` (or the nearest supported core locale).
- **Browser support is the browser's decision:** HTTPS, an eligible manifest and
  Chromium engagement heuristics gate `beforeinstallprompt`; iOS Safari, Firefox
  desktop and most in-app browsers have no install API and must get written
  instructions.

Host ownership is unchanged: no service worker registration, no manifest
rewrite, no `beforeinstallprompt` capture and no CDN.
