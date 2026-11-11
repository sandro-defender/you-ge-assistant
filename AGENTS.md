# AGENTS.md — You.Ge Assistant integration guide

This guide documents how to integrate You.Ge Assistant into another web project.
Follow it in order. It describes **what exists**, **where it goes**, **what must not
be renamed**, and **how to verify multi-domain/PWA behavior**.

You.Ge Assistant is a dependency-free PWA toolkit that retains compatibility
with the former hosted Progressier client. Runtime files are plain JavaScript,
CSS, a manifest, a service worker, static icons, central domain configuration,
and an on-demand DNS diagnostics module. There is no build step or runtime
package install.

Current runtime version: **1.1.0** (`PWA.version` and `VERSION` in
`progressier.js`). For architecture findings and risks, see
[`ARCHITECTURE_AUDIT.md`](ARCHITECTURE_AUDIT.md) and
[`FOUNDATION_AUDIT.md`](FOUNDATION_AUDIT.md).

**For any future UI work:** read
[`design-system/you-ge-assistant/MASTER.md`](design-system/you-ge-assistant/MASTER.md),
[`DESIGN_FOUNDATION.md`](DESIGN_FOUNDATION.md) and
[`WIDGET.md`](WIDGET.md) first. The
`ui-ux-pro-max-skill` is mandatory for interface changes; React Bits sources
are vendored under `example/src/react-bits/` and must keep their license notice,
reduced-motion overrides and zero-runtime-dependency constraint. Do not
redesign the installation flow without reading
[`INSTALLATION_EXPERIENCE.md`](INSTALLATION_EXPERIENCE.md). The floating
Assistant has one centralized state model in `assistant-state.js`; renderers
must not create a second model, poll, call `fetch`, register another service
worker or auto-open the panel.

---

## 1. Runtime model

The ordered page-side files resolve the domain, configure PWA behavior and run the client:

```
<head>
  <link rel="manifest" href="/manifest.webmanifest">
  <script src="/domain-registry.js" defer></script>
  <script src="/domain-config.js" defer></script>
  <script src="/dns-diagnostics.js" defer></script>
  <script src="/pwa.js" defer></script>
        |
        |  resolves host config, injects /pwa.css and missing meta tags
        |  registers /progressier.js
        |  mounts buttons, banners, modals, QR
        v
  /pwa.js  --------------------------->  /progressier.js
  page-side client                       service worker
  UI + install + push + share            cache + push + share + badge
        |
        +--> /manifest.webmanifest   (static fallback or host-aware handler)
        +--> /qrcode.js              (optional, only when a QR is opened)
        +--> /offline.html/.css/.js  (offline fallback)
        +--> /icons/*                (manifest, banner and splash images)
```

`pwa.js` remains the page-side entry point. Load `domain-registry.js`,
`domain-config.js`, and `dns-diagnostics.js` before it for domain branding and
diagnostics; it remains compatible with existing pages that only load `pwa.js`.
It is safe to load with `defer`, and
it is idempotent: a second copy exits immediately (`window.PWA.__pwaKit`).

---

## 2. Non-negotiable rules

An agent must preserve these or the migration will break existing installs:

1. **Do not load the old Progressier script and `pwa.js` together.** Remove
   `https://progressier.app/<id>/script.js` and the hosted manifest link.
2. **Keep the service worker path at `/progressier.js` when migrating an
   existing site.** Browsers that already registered the hosted worker update it
   in place only if the script URL is unchanged.
3. **Keep the manifest `id` stable** for an existing app. For a brand-new app,
   choose a new stable id. Changing `id` creates a second installed app.
4. **Keep `progressier.js` at its existing path when migrating**, or set `data-sw`
to the scoped worker path. The worker resolves precache/offline assets against
the registered app scope; keep those assets in that scope. Use a scoped runtime
copy for a subpath deployment.
5. **Load the public domain registry and resolver before `pwa.js`.** Domain
   overrides are public branding/configuration, never secrets or authorization.
6. **Do not rename `pwa.css` classes** listed in §6; they are the public styling
   and markup contract.
7. **Upload assets before changing HTML**, so the first page load never asks for
   a missing worker or manifest.
8. **HTTPS is required** for service workers, install prompts, and push.
   `localhost` is the only exception.

---

## 3. File map

| File | Required | Role |
| --- | --- | --- |
| `domain-config.js`, `domain-registry.js` | yes for domain-aware config | Central runtime hostname/origin detection and public overrides |
| `dns-diagnostics.js` | optional | On-demand Cloudflare DoH diagnostics and classifications |
| `manifest-handler.js`, `functions/manifest.webmanifest.js` | hosting-dependent | Host-aware manifest response/helper and Cloudflare Pages adapter |
| `pwa.js` | yes | Client SDK: config, SW registration, install/push UI, floating toolbox, QR, banners, meta, splash |
| `pwa.css` | yes (unless `data-no-css`) | All component styles and Progressier CSS variables |
| `assistant-state.js` | yes | Centralized, event-driven state + configurable SDK API for the Intelligent Floating Assistant |
| `assistant-widget.js`, `assistant-widget.css` | yes (unless disabled) | Dependency-free DOM renderer, fixed placement, safe areas, badges, in-place panel, auto-scaling launcher with manual size/position adjustment, Android Chrome handoff offer |
| `progressier.js` | yes | Service worker: offline cache, push display, share target, badge |
| `manifest.webmanifest` | yes | App identity, icons, share target, protocol handlers |
| `qrcode.js` | only for QR | Vendored MIT `qrcode-generator` 2.0.4 |
| `offline.html`, `offline.css`, `offline.js` | yes | Offline fallback page |
| `icons/icon-192.png`, `icon-512.png` | yes | Manifest icons |
| `icons/icon-maskable-192.png`, `icon-maskable-512.png` | yes | Maskable icons |
| `icons/apple-touch-icon.png` | recommended | iOS home-screen icon (180×180) |
| `icons/favicon-32.png`, `favicon.ico` | recommended | Browser favicon |
| `icons/icon-144.png`, `icon-150.png`, `browserconfig.xml` | optional | Windows tiles |
| `snippet.html` | reference | Copy-paste `<head>` block |
| `INTEGRATION.md` | reference | Multi-domain deployment, migration and rollback checklist |
| `README.md` | reference | Full API and server config |
| `MULTI_DOMAIN.md`, `DNS_RECOVERY.md` | reference | Domain registry, manifest, DNS diagnostics and recovery |
| `FOUNDATION_AUDIT.md` | reference | Phase 0 re-audit: preserved behavior, gaps and risks |
| `ASSISTANT_ARCHITECTURE.md` | reference | Future dashboard, SDK, config publishing, security, failover and roadmap |
| `INSTALLATION_EXPERIENCE.md` | reference | Frozen install behavior and future SDK install contract |
| `DESIGN_FOUNDATION.md` | reference | ui-ux-pro-max-skill application and React Bits adoption report |
| `WIDGET.md` | reference | Floating Assistant architecture, SDK config, events, priority, skill/React Bits record and tests |
| `ARCHITECTURE_AUDIT.md` | reference | Baseline audit and phased architecture plan |
| `PARITY.md` | reference | What matches the original Progressier client |
| `packages/assistant-sdk/` | repo | `@youge/assistant-sdk` sources, tests, README, `RELEASE.md` (release runbook + registry decision; publishing gated, not yet executed) and `MIGRATION.md` (staff.you.ge vendored-copy → package) |
| `packages/assistant-sdk/scripts/validate-package.mjs` | tool | Package metadata, export map, version sync and tarball validation release gate |
| `reference/` | research only | Original manifest/client source and readable copies; never deploy |
| `scripts/check.mjs` | tool | Static checks for manifests, assets, versions, domain/DNS and floating-Assistant contracts |
| `tests/assistant-widget.test.mjs` | tool | 46 state/renderer/priority/a11y/lifecycle + 0.1.1 feature tests (auto-scale, manual adjust, Chrome handoff) |
| `scripts/verify-deployment.mjs` | tool | Live deployment checker |
| `scripts/generate-vapid-keys.mjs` | tool | VAPID key generator |
| `examples/push-server/` | example | Minimal Node push sender |
| `LICENSE`, `package.json` | repo | MIT license and `npm run check` / `verify` / `keys` scripts |
| `demo/` | example | Full-feature GitHub Pages playground for testing the helper |
| `example/` | example | React Bits sample PWA, isolated React build, subpath-safe manifest |
| `.github/workflows/` | repo | `check.yml` static checks, `pages.yml` playground + example deploy, `sdk-release-prep.yml` manual-only SDK release prep with ONE action dropdown (`Verify only` / `Stage release on npm` / `Publish release to npm` / `Verify OIDC trusted publishing` — no typed confirmations; `verify` never publishes; `stage` runs `npm stage publish` via OIDC (`id-token: write`) for owner approval on npm — token-free, never publishes; `publish` is main-only behind `verify` + the `SDK_RELEASE_ENABLED` authorization gate + protected environment + OIDC; `oidc-check` = non-mutating OIDC token-exchange verification, no npm command, no secrets) |

Keep the directory shape when copying. If the target project uses a `public/`
folder (Next.js, Vite, CRA), copy the **contents** of this repo into `public/`
so the URLs stay root-relative.

---

## 4. Integration playbook

### Step 1 — copy the runtime files

Copy into the target web root (plus `manifest-handler.js` and the platform adapter
when using a dynamic host-aware manifest):

```
pwa.js
pwa.css
progressier.js
manifest.webmanifest
domain-config.js
domain-registry.js
dns-diagnostics.js
qrcode.js
offline.html
offline.css
offline.js
browserconfig.xml
favicon.ico
icons/
```

Do not copy `.git`, `examples/`, `scripts/`, or the markdown docs unless the
target project wants them.

### Step 2 — adapt the manifest

Edit `manifest.webmanifest`:

| Field | What to do |
| --- | --- |
| `name`, `short_name` | Target app name |
| `id` | Keep the existing id when migrating; otherwise a new stable path such as `/` |
| `start_url` | Usually `/?launchedfrom=homescreen`; must be inside `scope` |
| `scope` | `/` for a root app, or the subpath the app is served from |
| `display` | `standalone` (default), `fullscreen`, or `minimal-ui` |
| `theme_color`, `background_color` | Match the target brand |
| `icons` | Replace the PNGs, keep 192/512 and both maskable entries |
| `share_target.action` | Must be `/share-target` (the worker handles that POST) |
| `protocol_handlers` | Keep if the app uses `web+pwa:` links; remove otherwise |
| `categories` | Optional |

The checked-in manifest is a valid static fallback. For host-specific install
identity, serve the manifest through `manifest-handler.js` (Cloudflare Pages
adapter: `functions/manifest.webmanifest.js`) or generate one per host at build
time. A static JSON file cannot vary based on the incoming hostname. The resolver
and public registry supply identity/features to client modules.

### Step 3 — register domain configuration and add the head block

Minimum:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#155eef" />
<script src="/domain-registry.js" defer></script>
<script src="/domain-config.js" defer></script>
<script src="/dns-diagnostics.js" defer></script>
<script src="/pwa.js" defer></script>
```

Recommended, with explicit configuration:

```html
<script
  src="/pwa.js"
  defer
  data-sw="/progressier.js"
  data-manifest="/manifest.webmanifest"
  data-app-name="My App"
  data-theme-color="#ffffff"
  data-icon="/icons/icon-192.png"
  data-splash-icon="/icons/icon-512.png"
  data-start-url="/?launchedfrom=homescreen"
></script>
```

`pwa.js` fills in `application-name`, Apple meta, Windows tile meta, the
manifest link if missing, and the iOS splash links. Do not duplicate those tags
unless you set `data-no-meta`.

### Step 4 — server headers

```
/manifest.webmanifest
  Content-Type: application/manifest+json

/progressier.js
  Content-Type: application/javascript
  Cache-Control: no-cache
```

Only set `Service-Worker-Allowed` when granting a scope broader than the worker
file's directory, and use the narrowest required path. Serve `pwa.js`, `pwa.css`, `offline.*` and `qrcode.js` with `no-cache` or a
short max-age. The worker's own `VERSION` controls its caches; do not add a
long-lived immutable cache to `progressier.js`.

### Step 5 — optional push

Generate a VAPID pair:

```bash
node scripts/generate-vapid-keys.mjs --write
```

Then load the client with:

```html
<script
  src="/pwa.js"
  defer
  data-vapid-public-key="THE_PUBLIC_KEY"
  data-push-endpoint="/api/push/subscribe"
></script>
```

Server contract:

- `POST /api/push/subscribe` — body is the browser subscription JSON
  (`endpoint`, `keys.p256dh`, `keys.auth`). Return any `2xx`.
- `DELETE /api/push/subscribe` — body is `{ "endpoint": "..." }`.
- Sending is server-side; see `examples/push-server/server.js`.

Without both attributes, subscribe buttons remain visible but report that push
is not configured instead of asking for permission.

### Step 6 — Content Security Policy

| Need | CSP |
| --- | --- |
| Load `pwa.js` / worker | `script-src 'self'`; `worker-src 'self'` |
| Inline styles injected by install help | add `data-csp-nonce="..."` and allow that nonce in `style-src` |
| iOS splash images (generated `data:` PNGs) | allow `data:` in `img-src`, or set `data-no-splash` |
| `data-analytics` beacon | allow the endpoint in `connect-src` |
| QR library | `script-src 'self'` is enough; it is a local file |

### Step 7 — verify

Static checks:

```bash
node scripts/check.mjs      # or: npm run check
```

It verifies JS syntax, manifest JSON, real PNG sizes against the declared
`icons[].sizes`, precache assets, `VERSION` consistency between the worker and
`pwa.js`, and leftover hosted Progressier URLs.

Live checks:

```bash
node scripts/verify-deployment.mjs https://your-domain.example
```

It checks the HTML for leftover `progressier.app` tags, manifest MIME type,
real PNG dimensions, service-worker headers, offline assets, and Windows tiles.
Exit code `1` is a hard failure.

Browser acceptance:

1. DevTools → Application → Manifest: no errors, installable.
2. Application → Service Workers: `/progressier.js` is activated.
3. Install, close, relaunch from the icon.
4. iOS Safari: Share → Add to Home Screen → launch.
5. Offline reload shows `/offline.html`.
6. No console errors; no requests to `progressier.app`.

---

## 5. Configuration reference

All options are optional `data-*` attributes on the `pwa.js` script tag. Path
defaults are resolved against the directory that serves `pwa.js`, so they work
unchanged at a domain root and under a subpath.

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-sw` | `progressier.js` | Service worker URL |
| `data-sw-scope` | resolved app scope, bounded by worker directory | Service worker scope |
| `data-base-path` | directory serving `pwa.js` | App base path for a subpath deployment |
| `data-manifest` | `manifest.webmanifest` | Manifest URL |
| `data-css` | `pwa.css` | Stylesheet URL |
| `data-icon` | `icons/icon-192.png` | Icon in banners/modals |
| `data-splash-icon` | `icons/icon-512.png` | Source for generated iOS splash |
| `data-qr-library` | `qrcode.js` | Local QR library URL |
| `data-qr-logo` | app icon | Logo drawn in the QR center |
| `data-desktop-qr` | off | On desktop, install buttons open the QR dialog |
| `data-app-name` | resolved domain identity | Explicit app name override |
| `data-theme-color` | resolved domain branding | Explicit theme color and splash background |
| `data-start-url` | `?launchedfrom=homescreen` | Windows tile start URL |
| `data-itunes-app-id` | — | Adds `apple-itunes-app` |
| `data-analytics` | — | Beacon endpoint for install/launch events |
| `data-push-endpoint` | — | Receives push subscriptions |
| `data-vapid-public-key` | — | Enables push subscribe UI |
| `data-install-banner` | off | Auto-show install banner |
| `data-push-banner` | off | Auto-show push banner |
| `data-offline-alert` | off | Auto-show offline alert |
| `data-toolbox` | off | Show the floating app-icon install launcher |
| `data-toolbox-off` | off | Suppress the launcher |
| `data-toolbox-position` | `right` | Position: `left`, `right`, `center`; optional `-top` / `-middle` |
| `data-toolbox-color` | theme color | Launcher background color |
| `data-toolbox-img` | app icon | Custom launcher image, relative to `pwa.js` |
| `data-toolbox-use-logo` | off | Force the app icon instead of the custom image |
| `data-toolbox-hide-standalone` | on | Hide inside standalone mode; `false` keeps it visible |
| `data-toolbox-show-platforms` | `all` | Restrict to `mobile` or `desktop` |
| `data-toolbox-show-urls` | all | JSON array or comma-separated match patterns |
| `data-welcome` | off | Show welcome modal once per browser |
| `data-auto-update` | off | Activate updates without asking |
| `data-no-meta` | off | Skip manifest/Apple/Windows meta injection |
| `data-no-css` | off | Do not inject `pwa.css` |
| `data-no-splash` | off | Do not generate iOS splash links |
| `data-viewport-fit` | off | Add `viewport-fit=cover` on iOS standalone |
| `data-allow-external-protocol` | off | Allow `web+pwa:` redirects to other origins |
| `data-csp-nonce` | — | Nonce for injected styles |
| `data-debug` | off | Verbose console logging |

Booleans are presence-based: `data-debug` means on; omit it for off. The
floating launcher also stays hidden in iframes and when `body.no-toolbox` is
present; it waits for the service worker registration before appearing.

Domain-specific behavior belongs in the central registry—not per-component host
checks. Exact hosts precede validated `*.example.com` patterns; unknown domains
fall back safely. The registry is public and must contain no secrets or access
control. See [`MULTI_DOMAIN.md`](MULTI_DOMAIN.md) for configuration and the
host-aware manifest contract. Static hosting cannot return different manifest
JSON for each Host; use the supplied server/edge adapter or per-host build output.
Feature switches cover installation, offline, sharing, push, badges, QR,
diagnostics and DNS recovery; see [`MULTI_DOMAIN.md`](MULTI_DOMAIN.md).

---

## 6. HTML contract

These selectors and attributes are compatible with the original Progressier
client. Existing markup keeps working without changes.

| Markup | Behaviour |
| --- | --- |
| `.progressier-install-button` | Captured and rendered automatically; opens install prompt or help |
| `.progressier-subscribe-button` | Captured; requests push permission/subscription |
| `data-behavior="disable"` / `"hide"` | Disable or hide when installed |
| `data-hide-standalone` | Hide in standalone mode (default `true`) |
| `data-allow-ios` | Allow the iOS path (default `true`) |
| `data-allow-samsung` | Allow the Samsung path (default `true`) |
| `data-install`, `data-installed` | Custom labels; default English values localize |
| `data-icons` | Show the install icon next to the label |
| `data-eligible`, `data-subscribed`, `data-blocked` | Subscribe-button labels |
| `.captured`, `.initialized` | Added by the kit; same names as the original |
| `[data-pwa-install]` | Local alias for an install trigger |
| `[data-pwa-qr]` | Opens the QR dialog; value may be a custom URL |
| `[data-pwa-hide-standalone]` | Hidden when standalone |
| `[data-pwa-show-standalone]` | Hidden when not standalone |

Example:

```html
<button class="progressier-install-button" data-icons="true">Install</button>
<button class="progressier-subscribe-button" data-icons="true"
        data-eligible="Get notifications"
        data-subscribed="Notifications enabled"
        data-blocked="Notifications blocked"></button>
```

The scanner runs every 150 ms and captures new nodes, so client-rendered
buttons work without a manual call. `PWA.scanButtons()` forces a scan.

---

## 7. JavaScript API

`window.PWA` is always defined. `window.progressier` is also defined with a
compatibility shim (`install`, `prompt`, `isStandalone`,
`checkIfStandalone`, `register`, `ready`, `setAppBadge`, `clearAppBadge`,
`track`, `wording`, `detection`, `push`, `installBanner`, `pushBanner`,
`showWelcome`, `utils.wait`, `utils.vibrate`).

| Method | Returns / effect |
| --- | --- |
| `PWA.promptInstall(options)` / `PWA.install()` | `{ outcome }`: `accepted`, `dismissed`, `instructions`, `qr`, `already-installed` |
| `PWA.showInstallRequest()` | Show the local install flow (or desktop QR dialog) |
| `PWA.canInstall()` | `true` when `beforeinstallprompt` is captured |
| `PWA.isStandalone()` | Running as installed app |
| `PWA.isInstalled()` | Installed or standalone |
| `PWA.isIOS()`, `PWA.isSafari()` | Platform checks |
| `PWA.getState()` | State snapshot plus current hostname, origin and base path |
| `PWA.config.domain` | Resolved domain/origin/subdomain/root/base-path context |
| `PWA.onChange(fn)` | Subscribe to state; returns unsubscribe |
| `PWA.refresh()` | Re-apply hidden states |
| `PWA.ready` | Promise of the service-worker registration |
| `PWA.register()` | Register if needed; same promise |
| `PWA.applyUpdate()` | Activate waiting worker and reload |
| `PWA.hasUpdate()` | A waiting worker exists |
| `PWA.postToWorker(message)` | MessageChannel request/response to the worker |
| `PWA.subscribePush({ vapidPublicKey, endpoint })` | Permission + subscribe + POST |
| `PWA.unsubscribePush({ endpoint })` | Unsubscribe + DELETE |
| `PWA.requestPushPermission()` | Permission only |
| `PWA.setBadge(n)`, `PWA.clearBadge()` | App icon badge |
| `PWA.getNotifications()` | Push history array |
| `PWA.markNotificationsRead()` | Mark history read |
| `PWA.getSharedFile()` / `consumeSharedFile()` | Promise of the shared payload |
| `PWA.clearCaches({ includeStatic })` | Clear page cache (and optionally assets) |
| `PWA.showInstallHelp('ios' \| 'generic')` | Instructions sheet |
| `PWA.showInstallBanner(options)` / `hideInstallBanner()` | Top banner |
| `PWA.showPushBanner(options)` / `hidePushBanner()` | Top push banner |
| `PWA.showFlow(options)` | Generic modal |
| `PWA.showNetworkDiagnostics()` / `PWA.runNetworkDiagnostics()` | On-demand current-host DNS/app diagnostics and recovery UI/result |
| `PWA.showWelcome(options)` | Welcome modal |
| `PWA.showQRCode(url \| { url, text, installHere })` | QR dialog |
| `PWA.showReloadPrompt()` / `enableReloadPrompt()` | Reload prompt |
| `PWA.showOfflineAlert()` / `enableOfflineAlert()` | Offline alert |
| `PWA.createAppleSplashScreens()` | Regenerate iOS splash links |
| `PWA.notify(message, options)` | Toast |
| `PWA.wording.get(key)` / `setLanguage('fr')` | UI wording |
| `PWA.applyTheme({ background, text, element, border, hover, shadow, ... })` | Set CSS variables |
| `PWA.scanButtons()` | Force button scan |
| `PWA.track(name, detail)` | Emit event and optional beacon |
| `PWA.urlBase64ToUint8Array()`, `PWA.arrayBufferToBase64()` | Helpers |
| `PWA.config` | Resolved configuration object |
| `PWA.version` | Kit version |

`showFlow` accepts:
`title`, `text`, `items[]`, `app` (boolean), `icon`, `appName`, `appHint`,
`button`, `secondary`, `onPrimary`, `onSecondary`, `dismissible`.

`showQRCode` accepts a URL string or
`{ url, title, text, installHere, dismissible, logo }`.

---

## 8. Events

Listen on `document`:

| Event | Detail |
| --- | --- |
| `pwa:installable` | Install prompt captured |
| `pwa:installed` | App installed or entered standalone |
| `pwa:update` | New service worker waiting |
| `pwa:share` | `{ id, url, title, text, file, blob }` |
| `pwa:diagnostics` | Classified Cloudflare DoH/current-host result |
| `pwa:event` | `{ name, detail }` for every `PWA.track()` call |

The `progressier` shim also exposes `progressier.ready` and the push helpers,
so legacy code such as `progressier.push.isSubscribed()` keeps working.

---

## 9. Storage and state

| Key | Type | Purpose |
| --- | --- | --- |
| `progressierinstallbanner` + host + path | Cookie | Install banner dismissal timestamp |
| `progressierpushbanner` + host + path | Cookie | Push banner dismissal timestamp |
| `progressierSavedPushNotifications` | IndexedDB | Notification history (same name as original) |
| `progressiersharedfiles` | IndexedDB | Shared files from the share target |
| `pwakit` / `meta` | IndexedDB | Worker metadata (badge state) |
| `pwa-static-<legacy-version>` | Cache | Legacy static assets copied in-scope; old cache retained |
| `pwa-pages-<legacy-version>` | Cache | Only explicitly public, in-scope HTML migrates; old cache retained |
| `you-ge-assistant:<host>:<scope>:pages:v<VERSION>` | Cache | This worker scope’s network-first page cache |
| `you-ge-assistant:<host>:<scope>:static:v<VERSION>` | Cache | This worker scope’s precached/runtime assets |
| `pwakit:welcome` | localStorage | Welcome modal shown once |

Do not rename the Progressier IndexedDB stores if migrating an existing site;
old history and shared files live there. Cache names now include hostname, scope and
version. Old shared-name caches are copied in-scope but not deleted because their
ownership was not encoded safely.

---

## 10. Theming

`pwa.css` reads Progressier variables from `:root`:

```
--progressierBg
--progressierElement
--progressierTxt
--progressierBorderColor
--progressierHover
--progressierBackdrop
--progressierBoxShadow
--progressierIconShadow
--progressierFont
--progressierLetterSpacing
--progressierTextFontWeight
--progressierHeadingFontWeight
--progressierBtnFontWeight
```

Set them in CSS or at runtime:

```js
PWA.applyTheme({
  background: '#ffffff',
  element: '#fafafa',
  text: '#142a37',
  border: '#eaeaea',
  hover: '#f6f6f6',
  shadow: '0 2px 8px rgba(15,41,14,.08), 0 3px 35px rgba(7,21,41,.20)',
  font: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
});
```

For dark mode, override the same variables under
`@media (prefers-color-scheme: dark)` or a `.dark` class on `<html>`. The kit's
components inherit whatever the page sets.

---

## 11. Framework notes

- **Static HTML / PHP / Rails / Django:** use the head block in `snippet.html`.
- **Next.js (App Router):** put the runtime files in `public/`, add the script
  with `next/script` (`strategy="afterInteractive"`) or a plain `<script defer>`
  in `app/layout.tsx`, and keep `manifest.webmanifest` in `public/`.
- **Next.js (Pages Router):** add the script in `pages/_document.tsx` and the
  manifest link in `<Head>`.
- **Vite / CRA / SvelteKit:** copy runtime files to `public/`; add the script to
  `index.html` or `app.html`.
- **SPA routers:** the service worker handles navigations network-first, caches
  only HTML responses explicitly marked `Cache-Control: public`, and otherwise
  falls back to `/offline.html`. Mark authenticated pages `private, no-store`.
  Do not register a second worker at the same scope.
- **Subpath deployment (`/app/`):** copy the files into that folder and point
  the script at it (`src="/app/pwa.js"`). Nothing else is needed: `pwa.js`
  resolves the worker, manifest, CSS, icons and QR library relative to its own
  URL, and `progressier.js` resolves precache/offline paths against its
  registered scope. Use `./` manifest scope/start URLs and a route-local manifest
  for a subpath. Offline assets are scope-relative, as shown in
  `.github/workflows/pages.yml`.
- **GitHub Pages:** `.github/workflows/pages.yml` builds `_site/` from the
  runtime files, publishes `demo/` as the root feature-test playground, and
  publishes `example/` at `/example/` with its own worker scope and offline page.
  Enable Pages
  with **Source: GitHub Actions** once. The pages are
  <https://sandro-defender.github.io/you-ge-assistant/> and
  <https://sandro-defender.github.io/you-ge-assistant/example/>.

---

## 12. Updating and rollback

When any cached file changes:

1. Bump `VERSION` in `progressier.js` and `PWA.version` in `pwa.js` together.
2. Upload the changed files.
3. Reload. With `data-auto-update` the new worker activates automatically;
   otherwise `PWA.showReloadPrompt()` or the built-in prompt asks the user.

The old worker is replaced because the script URL is unchanged. Keep the worker
file in place during rollback; restore the previous files and bump `VERSION`
again. To remove the PWA entirely, serve a worker at `/progressier.js` that
calls `self.registration.unregister()` and remove the manifest/script tags.

---

## 13. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Manifest ignored | Wrong MIME type; serve `application/manifest+json` |
| Install prompt never appears | Chrome requires HTTPS, a valid manifest, icons, and a controlling worker; use `PWA.promptInstall()` or the markup |
| Worker not updating | `Cache-Control` too long on `progressier.js`; bump `VERSION` |
| Buttons do nothing | Old Progressier script still loaded, or `.progressier-*` node added before `pwa.js`; the scanner retries every 150 ms |
| Push says not configured | Missing `data-vapid-public-key` or `data-push-endpoint` |
| Push permission denied | Browser/site settings; `PWA.unsubscribePush()` then reset site permissions |
| iOS splash missing | Generated only in iOS Safari (not standalone); allow `data:` in `img-src` or supply static links |
| CSP blocks install help | Pass `data-csp-nonce` and allow it in `style-src` |
| QR blank | `/qrcode.js` not uploaded or blocked; check the Network panel |
| Share target 404 | `share_target.action` must be `/share-target`; the worker handles the POST |
| Offline page missing | Upload `offline.html`, `offline.css`, `offline.js`; the worker precaches them |

---

## 14. Included vs backend-only

Included and self-hosted:

- install buttons, banners, welcome/flow modal, iOS help
- QR install dialog with local QR generation and logo
- push permission/subscription UI and service-worker display
- notification history storage, badge, share target
- offline caching and offline page
- meta tags, Apple splash generation, Windows tiles
- theming variables and 10-language wording
- protocol redirects (`web+pwa:`, `pwaredirect`, `pwaprotocolredirect`)

Not included because they were Progressier services, not client code:

- hosted push campaigns, scheduling, segments, delivery
- analytics dashboard, A/B tests, funnel reports
- dashboard-managed announcements/newsfeed content
- user accounts, billing, subscription management
- App Store / Play Store / TWA packaging
- Progressier attribution/promo mode

Do not tell a user these are "implemented" by copying files. They need a
backend or a separate service.

Client-side Progressier features that are **not** in this kit (add them in the
target project if the design calls for them):

- pull-to-refresh indicator
- cookie-consent banner (only banner-dismissal cookies exist)
- Progressier's backend-driven toolbox promo/install-page routing; the local
  `data-toolbox` icon opens the local `PWA.showInstallRequest()` flow instead
- newsfeed/announcement feed UI (notification history is stored and exposed via
  `PWA.getNotifications()`, but there is no rendered feed)
- platform-specific install instruction screens for every OS; the kit ships a
  generic sheet plus the iOS path

---

## 15. Agent acceptance checklist

Before reporting the integration complete, confirm all of these:

- [ ] Old `progressier.app` script and manifest tags removed.
- [ ] `pwa.js`, `pwa.css`, `progressier.js`, manifest, offline files, QR library, icons uploaded.
- [ ] Manifest `name`, `short_name`, `id`, `start_url`, `scope`, colors, icons adapted.
- [ ] Manifest served as `application/manifest+json`.
- [ ] `progressier.js` served from the expected path with `no-cache` and correct scope.
- [ ] `npm run check` exits `0` (static checks, syntax and unit tests).
- [ ] Manifest parses as JSON and every icon path exists with the declared size.
- [ ] `scripts/verify-deployment.mjs` exits `0` against the deployed URL.
- [ ] Host-aware manifest route or per-host static manifest has the correct identity/scope.
- [ ] Domain/DoH diagnostics identify the current hostname and explain resolver limitations.
- [ ] The DNS recovery screen is available offline and does not require authentication.
- [ ] Browser: manifest valid, worker activated, install works, relaunch works.
- [ ] Browser: offline reload shows the offline page.
- [ ] Browser: no console errors and no `progressier.app` requests.
- [ ] If push is enabled: VAPID keys set, subscribe POST reaches the server, a test notification displays.
- [ ] If the app is on a subpath: worker paths and manifest scope updated.
- [ ] Version bumped if any cached file changed.

---

## 16. Copy-ready prompt for another agent

Paste this into the target project's AI agent and fill in the two placeholders:

> Integrate You.Ge Assistant located at `<KIT_PATH>` into this project.
>
> 1. Read `<KIT_PATH>/AGENTS.md` first and follow it exactly.
> 2. Copy the runtime files into the web root (or `public/`): `pwa.js`,
>    `pwa.css`, `progressier.js`, `manifest.webmanifest`, `domain-config.js`,
>    `domain-registry.js`, `dns-diagnostics.js`, `qrcode.js`,
>    `offline.html`, `offline.css`, `offline.js`, `browserconfig.xml`,
>    `favicon.ico`, and `icons/`.
> 3. Remove any existing `progressier.app` script and manifest tags.
> 4. Load the public registry, domain resolver, DNS module and `pwa.js` in order;
>    add the manifest link, icons and theme color to the head.
> 5. Add validated host configuration. Use `manifest-handler.js` or per-host
>    generated manifests for domain-specific install identity; keep all destinations
>    same-origin and within the app scope.
> 6. Serve the manifest as `application/manifest+json`; serve the worker with
>    `Cache-Control: no-cache` and the narrowest required worker scope header. Add
>    Cloudflare DoH to `connect-src` if diagnostics are enabled.
> 7. If push is required, generate VAPID keys with
>    `node scripts/generate-vapid-keys.mjs --write`, add
>    `data-vapid-public-key` and `data-push-endpoint` to the script tag, and
>    implement `POST`/`DELETE` on that endpoint.
> 8. Run `npm run check`, then run
>    `node <KIT_PATH>/scripts/verify-deployment.mjs <DEPLOYED_URL>`.
> 9. Report the checklist results from §15, including any backend-only features
>    that were not part of the kit.

Replace `<KIT_PATH>` with the path or repository URL of You.Ge Assistant and
`<DEPLOYED_URL>` with the target deployment URL.

---

## 17. Agent skills

Project skills are stored in `.agents/skills/` — one folder per skill, each containing a
`SKILL.md` (discovered by scanning `<project>/.agents/skills/*/SKILL.md`; the folder name
must match the `name` field in the frontmatter). Skills are read-only guidance: none add
runtime dependencies, none change application behavior, and none override the PWA toolkit's
dependency-free core.

| Skill | Source | License | When to invoke |
| --- | --- | --- | --- |
| `mobile-native` | https://github.com/emilkowalski/skills (`skills/mobile-native/`) | MIT | Mobile-first and PWA UI work: touch interactions, mobile navigation, safe areas, viewport/keyboard behavior, responsive layouts on the web PWA and the React example. |
| `break-ui` | https://github.com/emilkowalski/skills (`skills/break-ui/`) | MIT | UI edge-case testing: long labels and content, empty and error states, large datasets, extreme values, overflow, unusual but realistic interactions. The worst-case fixture stays dev-only; it runs through existing fixtures and the Node.js test runner; no new dependencies. |
| `tdd` | https://github.com/mattpocock/skills (`skills/engineering/tdd/`) | MIT | Implementation and regression tests: red → green → refactor, one vertical slice at a time, tests at public interfaces/seams. Uses the existing `node --test` runner and project conventions; must not assume Vitest or another framework. |

Invocation priorities:

1. `ui-ux-pro-max-skill` remains the mandatory design authority for interface changes (this
   file §2); it takes priority over any skill for UI decisions.
2. `mobile-native` takes priority for mobile- and PWA-specific work.
3. `break-ui` applies before UI changes land, to catch edge cases early.
4. `tdd` applies to implementation and regression testing.
5. No skill overrides the dependency-free core toolkit, existing PWA/offline/service-worker
   behavior, design tokens and theme architecture, or existing React Bits constraints.

Optional skills (evaluated, deliberately not installed):

- `grill-me` (requirements clarification) — no current `SKILL.md` exists in the upstream
  mattpocock/skills repository (only `docs/productivity/grill-me.md`; retired skills are
  deleted upstream, not kept), so there is no verifiable source to install from.
- `to-spec` (implementation specifications) — `disable-model-invocation: true` (cannot be
  model-invoked) and it publishes specs to a project issue tracker with triage labels, an
  external tracker integration/side effect this task does not require.

Do not install `to-tickets`, `code-review`, `diagnosing-bugs`, or the entire Matt Pocock
collection unless a concrete task justifies them.

Future options (install only when a concrete task justifies them): Emil animate,
review-animations, improve-animations, prototype; better-interface;
vercel-react-best-practices; stageshow. Do not add `animate-expo` to this web PWA project;
do not use Stageshow as a replacement for production UI engineering.

Suggested workflow: clarify requirements → prepare a specification for larger changes → read
the design foundation (`DESIGN_FOUNDATION.md`, `WIDGET.md`, `design-system/you-ge-assistant/MASTER.md`) → apply `ui-ux-pro-max-skill` for UI work → apply `mobile-native` for mobile/PWA work → apply `break-ui` for edge-case testing → apply `tdd` for implementation → verify build, tests and lint. Avoid making every skill mandatory for every task.

Testing tools: `npm test` (`node --test tests/*.test.mjs packages/assistant-sdk/tests/*.test.mjs`) and `npm run check` (static checks plus the same tests). No Vitest, Playwright or other test framework may be added to the core toolkit or the React example without a separate decision.

Each installed skill's license and upstream source are recorded in `.agents/skills/README.md`; upstream LICENSE texts are copied into each skill folder.
