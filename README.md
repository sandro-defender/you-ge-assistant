# You.Ge Assistant

A dependency-free, multi-domain-aware PWA platform and self-hosted toolkit: manifest,
service worker, install UI, offline recovery, share target, optional push,
badges, QR installation and on-demand Cloudflare DNS diagnostics.

The same runtime supports unrelated domains, subdomains and subpaths. It detects
the active origin and resolves identity/features from a central public registry,
with safe defaults for unknown hosts. It requires no account, build step or DNS
backend. The only built-in external runtime request is the user-triggered
Cloudflare DoH check; optional push/analytics integrations use the endpoints
you configure. The former `staff.you.ge` install identity and `/progressier.js` worker
path remain compatible; that hostname is neither required nor used as a DNS
test constant.

**Live playground:** <https://sandro-defender.github.io/you-ge-assistant/> — test
install, toolbox, QR, offline recovery, push, share, caches, theme, wording and
network diagnostics.

**User-facing example:** <https://sandro-defender.github.io/you-ge-assistant/example/> —
a polished sample staff workspace with a fixed, interactive assistant
launcher. Its schedule/checklist interactions use sample data stored
only in the visitor’s browser. The React build dependencies are isolated to `example/`; the core PWA
toolkit remains dependency-free. See [`example/README.md`](example/README.md).

> **For AI coding agents:** start with [`AGENTS.md`](AGENTS.md). It is a
> step-by-step integration playbook — file placement, manifest adaptation,
> server headers, CSP, push, verification, an acceptance checklist and a
> copy-ready prompt you can paste into another project's agent.

**Platform direction:** You.Ge Assistant is structured as a reusable PWA
management and infrastructure platform. Phase 2 extracts the framework-independent
SDK core locally at [`packages/assistant-sdk/`](packages/assistant-sdk/)
(`@youge/assistant-sdk` v`0.2.0` prepared 2026-11-07; v`0.1.1` is the
current published npm version) while keeping this repository's dependency-free PWA
toolkit (`window.PWA`, `/progressier.js`, DNS diagnostics, manifest/offline
support) intact. No standalone dashboard, remote configuration service,
production failover engine or `staff.you.ge` modification is implemented here.
The reusable **Intelligent Floating Assistant** widget shares the exact same
SDK state model (`assistant-state.js` synchronized from `packages/assistant-sdk/src/`)
with real-condition badges, a fixed priority ladder and an in-place panel —
plus an auto-scaling launcher with per-origin manual size/position adjustment,
the Android in-app browser → Chrome handoff offer (both 0.1.1) and adaptive
theming with four modes and five notification tiers (new in 0.2.0); see
[`WIDGET.md`](WIDGET.md) and [`packages/assistant-sdk/README.md`](packages/assistant-sdk/README.md).
Read the [foundation audit](FOUNDATION_AUDIT.md),
[platform architecture and roadmap](ASSISTANT_ARCHITECTURE.md),
[installation preservation contract](INSTALLATION_EXPERIENCE.md),
[widget implementation](WIDGET.md) and
[design/React Bits report](DESIGN_FOUNDATION.md) before starting a later phase.

---

## Quick start

```bash
git clone https://github.com/sandro-defender/you-ge-assistant.git
```

Then copy what you need into your project (or use **Use this template** on
GitHub to start from a clean copy).

**1. Copy the runtime files to your web root** (or `public/` in Next.js, Vite,
CRA, SvelteKit):

```
pwa.js  pwa.css  progressier.js  manifest.webmanifest  qrcode.js
domain-config.js  domain-registry.js  dns-diagnostics.js  manifest-handler.js
offline.html  offline.css  offline.js  browserconfig.xml  favicon.ico  icons/
```

**2. Add to `<head>`** (see [`INTEGRATION.md`](INTEGRATION.md) if migrating from a legacy hosted PWA setup):

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#155eef" />
<script src="/domain-registry.js" defer></script>
<script src="/domain-config.js" defer></script>
<script src="/dns-diagnostics.js" defer></script>
<script src="/pwa.js" defer></script>
```

**3. Set response headers** — serve the manifest with its JSON MIME type and
the worker without aggressive caching:

```
/manifest.webmanifest   Content-Type: application/manifest+json
/progressier.js         Cache-Control: no-cache
```

The worker's default scope is its own directory. Add `Service-Worker-Allowed`
only when intentionally granting a broader same-origin scope, and set it to the
smallest required path (for a root install that may be `/`).

Then check the result:

```bash
node scripts/check.mjs                              # static files
node scripts/verify-deployment.mjs https://you.example  # live deployment
```

`npm run check` runs static checks and unit tests; `npm run verify` checks a live deployment.

---

## Documentation map

| File | Read it when |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | you are a coding agent working in this repository or integrating the kit into a project |
| `README.md` | you need the full API, config and server setup (this file) |
| [`INTEGRATION.md`](INTEGRATION.md) | you want a worked deployment, legacy migration, upload order and rollback checklist |
| [`ARCHITECTURE_AUDIT.md`](ARCHITECTURE_AUDIT.md) | you want the earlier baseline audit and architecture plan |
| [`FOUNDATION_AUDIT.md`](FOUNDATION_AUDIT.md) | you want the Phase 0 re-audit: what works, what is preserved, what is missing and the risks |
| [`ASSISTANT_ARCHITECTURE.md`](ASSISTANT_ARCHITECTURE.md) | you want the future dashboard, SDK, multi-domain, publishing, security, failover architecture, diagram and roadmap |
| [`packages/assistant-sdk/README.md`](packages/assistant-sdk/README.md) | you want `@youge/assistant-sdk` initialization, config/LKG validation, lifecycle APIs, subpath exports and React adapter docs |
| [Official SDK on npm](https://www.npmjs.com/package/@youge/assistant-sdk/) | you want the published `@youge/assistant-sdk` package page and the current npm version |
| [`INSTALLATION_EXPERIENCE.md`](INSTALLATION_EXPERIENCE.md) | you need the preserved install behavior and the future SDK install contract |
| [`DESIGN_FOUNDATION.md`](DESIGN_FOUNDATION.md) | you need the ui-ux-pro-max-skill application record and React Bits adoption report |
| [`WIDGET.md`](WIDGET.md) | you need the Intelligent Floating Assistant state model, SDK config, events, React Bits/skill record and test matrix |
| [`THEMING.md`](THEMING.md) | you need the adaptive theme modes, host adaptation, token list, CSS isolation or notification level styling |
| [`ADAPTIVE_THEME_AUDIT.md`](ADAPTIVE_THEME_AUDIT.md) | you want the audit, constraints and plan behind the theming work |
| [`design-system/you-ge-assistant/MASTER.md`](design-system/you-ge-assistant/MASTER.md) | you are making UI decisions for the Assistant |
| [`MULTI_DOMAIN.md`](MULTI_DOMAIN.md) | you need domain registry, manifest, scope and deployment examples |
| [`DNS_RECOVERY.md`](DNS_RECOVERY.md) | you need DoH behavior, limitations or device recovery steps |
| [`CHANGELOG.md`](CHANGELOG.md) | you need release notes |
| [`snippet.html`](snippet.html) | you want to copy the complete `<head>` block |
| [`examples/push-server/`](examples/push-server/) | you need a runnable Web Push sender |
| `demo/` | you want to test the toolkit's full feature set in the playground |
| `example/` | you want a polished, user-facing sample integration (`Staff Space`) |

---

## Files

```
manifest.webmanifest      Valid static fallback manifest
domain-config.js          Central hostname/origin/config resolver
domain-registry.js        Public per-domain/subdomain customization
manifest-handler.js       Validated host-aware manifest response helper
functions/                Cloudflare Pages Functions manifest adapter
dns-diagnostics.js        On-demand Cloudflare DoH diagnostics
progressier.js            Service worker (kept at /progressier.js for update continuity)
pwa.js                    Client runtime — PWA controls, install flows and domain-aware UI
pwa.css                   Component stylesheet (with preserved compatibility variables)
assistant-state.js        Centralized Assistant state synchronized from @youge/assistant-sdk
assistant-widget.js/.css  Dependency-free floating Assistant DOM renderer
qrcode.js                 Vendored MIT QR generator (QR install dialog)
offline.html/.css/.js     Offline fallback page and status script
browserconfig.xml         Windows tile configuration
favicon.ico               Multi-size favicon (16/32/48)
snippet.html              Copy-paste head block
packages/assistant-sdk/   @youge/assistant-sdk source, tests, declarations and release docs
AGENTS.md                 Repository coding-agent rules and integration guide
INTEGRATION.md            Deployment, legacy migration and rollback checklist
demo/                     Full-feature GitHub Pages playground + manifest
example/                  User-facing Staff Space sample integration + manifest
.github/workflows/        check.yml, pages.yml, sdk-release-prep.yml
scripts/                  Static checks, SDK sync, deployment check, VAPID key generator
examples/push-server/     Runnable push sender (Node + web-push)
icons/                    You.Ge Assistant sample icons — replace with your own when branding
```

---

## Install

### 1. Upload

Copy the runtime files to your web root, keeping the paths above:

```
/ manifest.webmanifest
/ progressier.js
/ pwa.js
/ pwa.css
/ offline.html
/ offline.css
/ offline.js
/ browserconfig.xml
/ favicon.ico
/ icons/...
```

Keep the service worker at **`/progressier.js`** when migrating an existing
site so already-registered browsers update it in place without creating a
duplicate worker.

### 2. Add the `<head>` tags

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#155eef" />

<script src="/domain-registry.js" defer></script>
<script src="/domain-config.js" defer></script>
<script src="/dns-diagnostics.js" defer></script>
<script src="/pwa.js" defer></script>
```

The script can inject the manifest and Apple meta tags itself if you prefer a
one-line install, but declaring them in HTML is more reliable (Chrome can miss
dynamically added manifests on first load).

`snippet.html` contains the full head block, including the optional push
attributes. `INTEGRATION.md` has the deployment order, headers, update and
rollback steps for multi-domain deployments.

### 3. Add install buttons (optional)

Any element with `data-pwa-install` opens the browser prompt, or iOS instructions:

```html
<button type="button" data-pwa-install>Install app</button>
```

Related attributes:

| Attribute | Behaviour |
| --- | --- |
| `data-pwa-install` | Click triggers install; hidden once installed/standalone |
| `data-pwa-hide-standalone` | Hidden when running as an installed app |
| `data-pwa-show-standalone` | Hidden when running in a browser tab |

You can also drive your own UI:

```js
PWA.onChange((state) => {
  // state: { standalone, installed, canInstall, hasUpdate, ios, safari, pushSupported, ... }
  installButton.hidden = !state.canInstall && !state.ios;
});
```

### Legacy compatibility buttons

For existing migrations, legacy install and push-subscribe markup continues to
work automatically (150 ms DOM scan, wiring `.captured` and `.initialized`):

```html
<button type="button" class="progressier-install-button"
        data-icons="true"
        data-install="Install"
        data-installed="Launch the app"></button>

<button type="button" class="progressier-subscribe-button"
        data-icons="true"
        data-eligible="Get notifications"
        data-subscribed="Notifications enabled"
        data-blocked="Notifications blocked"></button>
```

| Attribute | Behaviour |
| --- | --- |
| `data-behavior` | `disable` (default) or `hide` when install is unavailable |
| `data-hide-standalone` | Hide inside an installed app (default `true`) |
| `data-allow-ios` | Treat iOS as installable via instructions (default `true`) |
| `data-allow-samsung` | Allow Samsung Internet (default `true`) |
| `data-install` / `data-installed` | Button labels |
| `data-icons` | Show the inline icon |
| `data-eligible` / `data-subscribed` / `data-blocked` | Subscribe labels |

### Floating install toolbox

`data-toolbox` adds an optional floating app-icon launcher. Clicking it
opens the local install flow (`PWA.showInstallRequest()`), which leads to the
native prompt when available or the install instructions otherwise. It is hidden
in iframes, when there is no registered service worker, by `data-toolbox-off` or
`body.no-toolbox`, and—by default—in
standalone mode.

```html
<script
  src="/pwa.js"
  defer
  data-toolbox
  data-toolbox-position="right"
  data-toolbox-color="#ffffff"
  data-toolbox-img="/icons/icon-192.png"
></script>
```

The button can also be managed at runtime:

```js
PWA.enableToolbox({ position: 'left-top', color: '#ffffff', image: '/icons/icon-192.png' });
PWA.hideToolbox();    // hide without removing the widget
PWA.showToolbox();    // show it again, subject to platform/URL rules
PWA.disableToolbox(); // remove and clean up the widget
```

Supported positions are `left`, `right`, or `center`, with optional `-top` or
`-middle` vertical placement. `data-toolbox-show-platforms` can limit it to
`mobile` or `desktop`; `data-toolbox-show-urls` accepts a JSON array or
comma-separated path/URL patterns (`*` wildcard). Query parameters included in a
pattern are matched as a subset, so extra parameters on the current URL do not
prevent a match. Prefix a pattern with `%&%` to hide the widget on matching
pages. The standalone default can be overridden
with `data-toolbox-hide-standalone="false"`.

### Banners, modal, offline alert

```js
PWA.showInstallBanner({ text, icon, color, btnColor, platforms: 'all' | 'mobile' | 'desktop' });
PWA.showPushBanner({ text, icon, color, btnColor });
PWA.showWelcome({ title, text, items: ['Step one', 'Step two'] });
PWA.showFlow({ title, text, button: 'Continue' });
PWA.showReloadPrompt({ color });
PWA.enableReloadPrompt({ minutes: 60 });
PWA.showOfflineAlert();
PWA.enableOfflineAlert();
PWA.notify('Saved');
```

Auto-show them from the script tag with `data-install-banner`, `data-push-banner`,
`data-offline-alert` or `data-welcome` (shown once, remembered in `localStorage`).

### Theming

The Floating Assistant supports adaptive themes (`auto`, `light`, `dark`,
`custom`) via `@youge/assistant-sdk` / `YOU_GE_ASSISTANT_CONFIG` (see
[`THEMING.md`](THEMING.md)).

For `pwa.css` dialogs and banners, `PWA.applyTheme()` updates the preserved
component CSS variables:

```js
PWA.applyTheme({
  background: '#ffffff',
  text: '#051b2c',
  accent: '#1a73e8',
  accentText: '#ffffff',
  font: 'Inter, system-ui, sans-serif',
  border: 'rgba(0,0,0,.09)',
});
```

`pwa.css` loads automatically. Set `data-no-css` to opt out and style the
components yourself.

### iOS splash screens and meta tags

On iOS Safari (not inside the installed app), `pwa.js` generates the splash
image for the current iPhone/iPad screen and adds the matching
`apple-touch-startup-image` link for portrait and landscape. It also fills in
`application-name`, `apple-mobile-web-app-title`, theme color, Windows tiles and
the legacy browser meta tags if the HTML does not already have them.

The splash is generated from `data-splash-icon` (default
`/icons/icon-512.png`) on the theme color background. Because it is a `data:`
image, allow `data:` in `img-src` if you use a strict CSP, or set
`data-no-splash` and provide your own static links. The link is added on a normal
Safari visit and is used the next time the app launches from the home screen.

```js
// Force a refresh after changing the theme or icon at runtime.
PWA.createAppleSplashScreens();
```

---

## Multi-domain architecture

Load `domain-registry.js`, then `domain-config.js`, before `pwa.js`. Exact hostnames
precede `*.example.com` patterns; unknown hosts use safe You.Ge Assistant defaults.
The registry supports domain identity, icons/colors, validated Open Graph/Twitter
metadata, manifest identity/scope, shortcuts and feature flags. It is public configuration only: never put secrets,
authorization rules or private endpoints there. Hostname detection is not an
authentication mechanism.

A static JSON manifest cannot vary based on the request hostname. Serve
`manifest.webmanifest` through `manifest-handler.js` for host-specific identity
(the Cloudflare Pages adapter is `functions/manifest.webmanifest.js`), or
generate one manifest per host at build time. The handler uses no-store caching,
same-origin/in-scope URLs and safe defaults for unknown hosts. See
[`MULTI_DOMAIN.md`](MULTI_DOMAIN.md) for registry, subpath, deployment and cache
migration examples. Browser installs and storage stay isolated by origin.

## Configuration

All options are optional `data-*` attributes on the script tag. Paths are
resolved against the directory that serves `pwa.js`, so the defaults work at a
domain root (`/`) and under a subpath (`/app/`, GitHub Pages project sites)
without changes.

```html
<script
  src="/pwa.js"
  defer
  data-sw="/progressier.js"
  data-manifest="/manifest.webmanifest"
  data-analytics="/api/pwa-events"
  data-push-endpoint="/api/push/subscribe"
  data-vapid-public-key="BEl62i..."
  data-csp-nonce="..."
></script>
```

| Attribute | Default | Purpose |
| --- | --- | --- |
| `data-sw` | `progressier.js` | Service worker URL (next to `pwa.js`) |
| `data-sw-scope` | resolved app scope, bounded by worker directory | Service worker scope |
| `data-base-path` | directory serving `pwa.js` | Explicit app base path for a subpath deployment |
| `data-manifest` | `manifest.webmanifest` | Manifest URL (also injected if missing) |
| `data-css` | `pwa.css` | Component stylesheet URL |
| `data-icon` | `icons/icon-192.png` | Icon used by banners/modals |
| `data-splash-icon` | `icons/icon-512.png` | Source image for iOS splash screens |
| `data-app-name` | resolved domain identity | Explicit app name override |
| `data-theme-color` | resolved domain branding | Explicit theme/splash color override |
| `data-start-url` | `?launchedfrom=homescreen` | Windows tile start URL |
| `data-analytics` | — | Optional beacon endpoint for install/launch events |
| `data-push-endpoint` | — | Default endpoint that receives push subscriptions |
| `data-vapid-public-key` | — | Enables the subscribe buttons and push banner |
| `data-install-banner` | off | Show the install banner automatically |
| `data-push-banner` | off | Show the push banner automatically |
| `data-offline-alert` | off | Show the offline alert automatically |
| `data-toolbox` | off | Show the floating install launcher |
| `data-toolbox-off` | off | Suppress the launcher even when `data-toolbox` is set |
| `data-toolbox-position` | `right` | `left`, `right`, `center`, with optional `-top` / `-middle` |
| `data-toolbox-color` | theme color | Background color behind the floating app icon |
| `data-toolbox-img` | app icon | Custom launcher image URL (relative to `pwa.js`) |
| `data-toolbox-use-logo` | off | Force the app icon instead of `data-toolbox-img` |
| `data-toolbox-hide-standalone` | on | Hide in standalone mode; set to `false` to keep visible |
| `data-toolbox-show-platforms` | `all` | Limit visibility to `mobile` or `desktop` |
| `data-toolbox-show-urls` | all | JSON array or comma-separated path/URL patterns |
| `data-welcome` | off | Show the welcome modal once per browser |
| `data-auto-update` | off | Apply service worker updates without asking |
| `data-no-meta` | off | Do not inject manifest/Apple/Windows meta tags |
| `data-no-splash` | off | Do not generate iOS splash screens |
| `data-no-css` | off | Do not inject `pwa.css` |
| `data-viewport-fit` | off | Add `viewport-fit=cover` on iOS/standalone |
| `data-itunes-app-id` | — | Adds the `apple-itunes-app` meta tag |
| `data-allow-external-protocol` | off | Allow `web+pwa:` redirects to other origins |
| `data-csp-nonce` | — | Nonce for injected styles |
| `data-debug` | off | Console logging |

If your site uses a strict CSP without `'unsafe-inline'`, pass a nonce with
`data-csp-nonce` or add the nonce to your policy.

---

## JavaScript API

`window.PWA` is always available. `window.progressier` gets a compatibility shim
(`install`, `prompt`, `isStandalone`, `checkIfStandalone`, `register`, `ready`,
`setAppBadge`, `clearAppBadge`, `track`, `wording`, `detection`, `push`, banner
helpers) so existing calls keep working.

| Method | Description |
| --- | --- |
| `PWA.promptInstall()` / `PWA.install()` | Show native install prompt or iOS help. Resolves `{ outcome }` |
| `PWA.showInstallRequest()` | Show the full local install flow (or desktop QR dialog) |
| `PWA.canInstall()` | Browser prompt is available |
| `PWA.isStandalone()` | Running as an installed app |
| `PWA.isInstalled()` | Installed or standalone |
| `PWA.isIOS()` / `PWA.isSafari()` | Platform checks |
| `PWA.getState()` | Full state plus hostname, origin and base path |
| `PWA.config.domain` | Resolved active domain/origin/subdomain/root/base path |
| `PWA.onChange(fn)` | Subscribe to state changes; returns unsubscribe |
| `PWA.refresh()` | Re-apply hidden states to the DOM |
| `PWA.ready` | Promise resolving to the service worker registration |
| `PWA.applyUpdate()` | Activate a waiting service worker and reload |
| `PWA.hasUpdate()` | Update is waiting |
| `PWA.subscribePush({ vapidPublicKey, endpoint })` | Ask permission, subscribe, POST to server |
| `PWA.unsubscribePush({ endpoint })` | Unsubscribe and notify server |
| `PWA.requestPushPermission()` | Permission only |
| `PWA.setBadge(n)` / `PWA.clearBadge()` | App icon badge |
| `PWA.getNotifications()` | Push history from the preserved IndexedDB notification store |
| `PWA.markNotificationsRead()` | Mark the whole history as read |
| `PWA.getSharedFile()` | Promise resolving to a shared file/URL |
| `PWA.clearCaches({ includeStatic })` | Clear cached pages (and optionally static assets) |
| `PWA.track(name, detail)` | Fire an event (and beacon if configured) |
| `PWA.showInstallHelp('ios' \| 'generic')` | Show the instructions sheet |
| `PWA.showInstallBanner(options)` / `PWA.hideInstallBanner()` | Top install banner |
| `PWA.showPushBanner(options)` / `PWA.hidePushBanner()` | Top push banner |
| `PWA.showWelcome(options)` / `PWA.showFlow(options)` | Welcome and modal flows |
| `PWA.showReloadPrompt()` / `PWA.enableReloadPrompt()` | Reload prompt |
| `PWA.showOfflineAlert()` / `PWA.enableOfflineAlert()` | Offline alert |
| `PWA.showNetworkDiagnostics()` | Current-host DoH diagnostics and recovery UI |
| `PWA.runNetworkDiagnostics()` | On-demand classified diagnostics result |
| `PWA.enableToolbox(options)` / `PWA.showToolbox()` | Create/show the floating install launcher |
| `PWA.hideToolbox()` / `PWA.disableToolbox()` | Hide or remove the launcher |
| `PWA.createAppleSplashScreens()` | Regenerate iOS splash links for the current screen |
| `PWA.notify(message, options)` | Small toast |
| `PWA.wording.get(key)` / `PWA.wording.setLanguage('fr')` | UI wording |
| `PWA.applyTheme({ background, text, accent, ... })` | Set preserved `pwa.css` component CSS variables |
| `PWA.scanButtons()` | Re-scan `.progressier-*` compatibility buttons |

### Wording

Bundled languages: English, French, Italian, German, Swedish, Dutch, Norwegian,
Danish, Estonian and Spanish. The language is auto-detected and can be overridden:

```js
PWA.wording.setLanguage('de');
console.log(PWA.wording.get('install'));
```

### Events

Listen on `document`:

```js
document.addEventListener('pwa:installable', () => {});
document.addEventListener('pwa:installed', () => {});
document.addEventListener('pwa:update', () => {});
document.addEventListener('pwa:share', (event) => {});
document.addEventListener('pwa:diagnostics', (event) => {});
document.addEventListener('pwa:event', (event) => {
  console.log(event.detail.name, event.detail.detail);
});
```

`pwa:share` carries `{ id, url, title, text, file, blob }`.

### Logout

Clear cached pages and the push subscription when a user signs out:

```js
await PWA.clearCaches();        // cached pages; add { includeStatic: true } for assets
await PWA.unsubscribePush();
```

---

## Web Share Target

Receiving shares is handled by the service worker and requires no server route.
`manifest.webmanifest` exposes `POST /share-target`; the worker stores the payload
in IndexedDB and redirects to `/?launchedfrom=share&fileid=...`.

Read it in your app:

```js
PWA.getSharedFile().then(async (shared) => {
  if (!shared) return;
  if (shared.file) await uploadFile(shared.file);
  else if (shared.url) prefillComposer({ url: shared.url, title: shared.title, text: shared.text });
});
```

The `fileid`, `url`, `title`, `text` query parameters are removed from the
address bar automatically after reading. The runtime also sets `sharedurl`,
`sharedtitle` and `sharedtext` aliases for older code.

Limits: one file, up to 25 MB. Keep a server-side `POST /share-target` route that
redirects to `/` as a fallback for the very first visit, before the worker is active.

---

## Push notifications

The worker accepts standard Web Push payloads:

```json
{
  "title": "New message",
  "body": "You have a new message",
  "icon": "/icons/icon-192.png",
  "url": "/inbox",
  "tag": "message-42",
  "data": { "conversationId": "42" }
}
```

It also understands Declarative Web Push payloads (`{ "notification": { ... } }`),
`notificationclick` (focus + navigate), app badge counting and
`pushsubscriptionchange` renewal.

### Subscribe on the client

The call must happen from a user gesture (required by iOS):

```js
document.querySelector('#enable-push').addEventListener('click', async () => {
  const result = await PWA.subscribePush({
    vapidPublicKey: 'BEl62i...your-public-key',
    endpoint: '/api/push/subscribe',
  });
  if (!result.ok) console.log('Not subscribed:', result.permission);
});
```

### Minimal Node server

```bash
npm install express web-push
npx web-push generate-vapid-keys
```

```js
const express = require('express');
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const app = express();
app.use(express.json());

// Store subscriptions in your database, keyed by user id.
const subscriptions = new Map();

app.post('/api/push/subscribe', (req, res) => {
  if (!req.user) return res.sendStatus(401);
  subscriptions.set(req.user.id, req.body);
  res.sendStatus(201);
});

app.delete('/api/push/subscribe', (req, res) => {
  subscriptions.delete(req.user?.id);
  res.sendStatus(204);
});

app.post('/api/push/send', async (req, res) => {
  const subscription = subscriptions.get(req.body.userId);
  if (!subscription) return res.sendStatus(404);
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: 'You.Ge Assistant',
        body: req.body.message,
        url: '/',
      })
    );
    res.sendStatus(202);
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      subscriptions.delete(req.body.userId); // expired
    }
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000);
```

Notes:

- Never ship the VAPID **private** key to the browser.
- The subscribe endpoint receives cookies (`credentials: 'include'`), so protect it
  with your normal session auth.
- `pushsubscriptionchange` re-subscribes and POSTs the new subscription to the same
  endpoint. Use `upsert` semantics.
- Chrome/Edge on Android and desktop, and iOS 16.4+ for home-screen apps, support
  push. iOS requires the app to be installed and permission requested from a tap.

---

## App badge

```js
PWA.setBadge(3);     // show 3 on the app icon
PWA.clearBadge();    // clear
```

Notifications received via push increment the badge automatically; opening one
decrements it. Call `PWA.clearBadge()` when the user reads everything.

---

## Protocol handler

The manifest registers `web+pwa:` and points it at:

```
/?launchedfrom=homescreen&pwaprotocolredirect=%s
```

`pwa.js` redirects to the encoded URL. By default only same-origin URLs are
allowed; set `data-allow-external-protocol` if the app must handle external links.

---

## Offline behaviour

- Navigations: network-first, 5 s timeout, then an explicitly public cached copy or `/offline.html`; HTML is not cached unless the response declares `Cache-Control: public`.
- Static assets (CSS, JS, images, fonts, media, PDFs): stale-while-revalidate.
- `/api/*`, non-GET requests and cross-origin requests are never cached.
- Responses with `Cache-Control: no-store` or `private`, and requests carrying an
  `Authorization` header, are never cached.
- Bump `VERSION` in `progressier.js` on deploy to invalidate old caches.

The worker deliberately does **not** cache private or unmarked HTML. It only
stores navigation responses explicitly marked `Cache-Control: public`; set
`Cache-Control: private, no-store` on authenticated/personalized pages. If your
app is a single-page app, public shell routes marked public can remain available;
deep links that were never visited fall back to `/offline.html`.

---

## Cloudflare DNS diagnostics and recovery

`dns-diagnostics.js` is an on-demand, non-blocking Cloudflare DoH check for the
current hostname, followed by a no-store same-origin application probe. Open the
reusable UI with `PWA.showNetworkDiagnostics()` or call
`PWA.runNetworkDiagnostics()`. Android instructions cover Private DNS provider
hostname `one.one.one.one`; iPhone/iPad guidance uses Cloudflare's app in
DNS-only mode (WARP is not required). Recovery remains available from the cached
offline page and requires no application authentication.

JavaScript cannot inspect the device's normal DNS resolver. A DoH response is
not proof of ISP DNS blocking; app, TLS, IP routing, CDN, backend, CORS and general
network failures are distinguished where possible, and uncertain results remain
inconclusive. See [`DNS_RECOVERY.md`](DNS_RECOVERY.md) for official setup links,
store links, classifications and test limitations. Allow
`https://cloudflare-dns.com` in `connect-src` if the site's CSP is restrictive.

## Server configuration

HTTPS is mandatory for service workers and install prompts (`localhost` excluded).
Your CSP must allow the worker (`worker-src 'self'`, or `script-src 'self'` if
`worker-src` is not set) and, for user-triggered DNS diagnostics, allow
`https://cloudflare-dns.com` in `connect-src`.

The host-aware manifest handler returns `application/manifest+json`,
`Cache-Control: private, no-store` and `Vary: Host`. Use the included Cloudflare
Pages Functions adapter or adapt `manifest-handler.js` to a trusted server/edge
route. Static hosts need a per-domain generated manifest; do not share a cached
manifest between hosts.

### nginx

```nginx
# Manifest must use the manifest MIME type or Chrome ignores it.
location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache";
}

# Service worker: never cache aggressively.
location = /progressier.js {
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /pwa.js {
    default_type application/javascript;
    add_header Cache-Control "no-cache";
}

location = /pwa.css {
    default_type text/css;
    add_header Cache-Control "no-cache";
}

location = /offline.html {
    add_header Cache-Control "no-cache";
}

location = /offline.css {
    add_header Cache-Control "no-cache";
}

location = /offline.js {
    add_header Cache-Control "no-cache";
}
```

### Apache

```apache
AddType application/manifest+json .webmanifest
AddType application/javascript .js

<FilesMatch "^(progressier|pwa)\.js$">
    Header set Cache-Control "no-cache"
</FilesMatch>

<Files "pwa.css">
    Header set Cache-Control "no-cache"
</Files>

<Files "manifest.webmanifest">
    Header set Cache-Control "no-cache"
</Files>
```

If the worker lives in a subdirectory but must control the root, set
`Service-Worker-Allowed: /` and register with `data-sw-scope="/"`.

---

## GitHub Pages

This repository publishes two GitHub Pages routes through
`.github/workflows/pages.yml`:

- <https://sandro-defender.github.io/you-ge-assistant/> — the full feature-test playground.
- <https://sandro-defender.github.io/you-ge-assistant/example/> — a polished sample
  staff workspace showing the helper in a user-facing page.

The workflow publishes `demo/` at `/` with the shared runtime at the Pages root.
It publishes `example/` at `/example/` with its own runtime copy, manifest,
service-worker scope and offline page so the sample is a separate installable app.
GitHub Pages is static and uses the example's static manifest; it cannot execute
the host-aware manifest function.

The project site is served from `/you-ge-assistant/`. `pwa.js` resolves its files
relative to its own URL, and `progressier.js` resolves precache assets against
the registered app scope, so their paths remain inside that base. Both manifests use
relative `scope` and `start_url` values so each install has its own identity and
launch path. The example build copies the icons into `/example/icons/` so the
sample worker and offline page stay within the example app's own scope.

`offline.html` uses paths relative to its own scope, so root and `/example/`
copies remain inside their respective deployment paths.

To deploy your own copy on Pages:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main`, or run the `pages` workflow manually.
3. Open `https://<user>.github.io/<repo>/`.

At a domain root, nothing needs rewriting.

---

## Manifest notes

- The static fallback `id` remains `/HIPSBNVemXtM8VMwRfWs` for compatibility with
  the previous installation. The dynamic registry keeps this ID only for the
  legacy host; new origins should use a stable `./` or app-specific ID.
- The dynamic manifest resolves `id`, `start_url` and `scope` from validated
  per-host configuration. A static-only deployment can use a per-host generated
  manifest or the safe You.Ge Assistant fallback.
- `protocol_handlers` registers both original schemes: `web+pwa:` and
  `web+loldwyhv:`. Both point at
  `/?launchedfrom=homescreen&pwaprotocolredirect=%s`, matching the old manifest.
- The fallback `scope` is `/`. For a subpath, set `basePath` and use `./`
  start/scope values; the handler ensures the app stays in that scope.
- `icons/` ships You.Ge Assistant sample artwork hosted locally. Replace it with
  your own branding artwork before shipping another application.

---

## Migration & compatibility

When migrating an existing site off a legacy hosted setup, see
[`INTEGRATION.md`](INTEGRATION.md) for the step-by-step upload order, header
setup, and rollback checklist. In short: remove legacy `progressier.app` tags,
keep `/progressier.js` at its existing path, preserve legacy manifest `id` and
IndexedDB store names (`progressierSavedPushNotifications`,
`progressiersharedfiles`), and deploy `/pwa.js` + `/manifest.webmanifest`.

---

## Testing

- **Chrome DevTools → Application**: Manifest (no errors), Service Workers (activated),
  Cache Storage (`you-ge-assistant:<host>:<scope>:static/pages:<version>`).
- **Lighthouse → PWA**: installability and offline checks.
- `chrome://web-app-internals`: installability diagnostics.
- Toggle **Offline** in DevTools and reload a visited route → a matching public
  cached page (only with `Cache-Control: public`) or the scoped offline page should appear.
- Install on Android and use the system share sheet → the app should open with the
  shared file/URL.
- iOS: open in Safari → Share → Add to Home Screen; verify standalone launch and
  safe-area layout.
- Push: subscribe, send a test notification, click it, check badge count.
- Live deployment: `node scripts/verify-deployment.mjs https://your-domain.example`.
- `npm test`: deterministic domain, manifest-handler and mocked DNS tests; this
  does not verify real ISP DNS interference.

---

## Included vs. server-side capabilities

You.Ge Assistant runs entirely client-side / self-hosted without a hosted
control-plane subscription; features that require a backend remain yours to
implement:

| Capability | Status in You.Ge Assistant |
| --- | --- |
| Install prompt, `[data-pwa-install]`, iOS instructions | Included |
| Legacy `.progressier-*` button classes and attributes | Included (compatibility) |
| Install banner / push banner | Included |
| Welcome, flow and install modals | Included |
| Offline alert and reload prompt | Included |
| Offline caching (`you-ge-assistant:*` scoped caches) | Included |
| Web Share Target | Included |
| Push notifications | Included — supply your own VAPID keys and sender |
| Push history (`progressierSavedPushNotifications`) | Included (preserved store name) |
| App badge & protocol handlers | Included |
| Component theming, adaptive Assistant themes, 10 languages | Included |
| Apple splash screens, Windows tiles, favicon | Included |
| QR-code install dialog (`qrcode.js`) | Included (local, zero external calls) |
| Analytics dashboard, A/B tests, funnel reports | Server-side / optional `data-analytics` beacon |
| Push scheduling, segments, campaigns | Server-side (see `examples/push-server/`) |
| App Store / Play Store / TWA packaging | Out of scope |
| Announcements/newsfeed UI, cookie banner, pull-to-refresh | Not bundled |

If you need push campaigns or analytics, the client API is already there; only the
server side is yours to run.

---

## License

MIT — see [`LICENSE`](LICENSE).

Bundled third-party code:

- `qrcode.js` — [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
  2.0.4, MIT, © 2009 Kazuhiko Arase. Kept verbatim with its license header.
- `examples/push-server/` uses the `web-push` npm package at runtime; it is not
  vendored here.

The icons in `icons/` are You.Ge Assistant sample artwork; replace them with
your own icons when branding a different product — they are not covered by the
MIT grant.

