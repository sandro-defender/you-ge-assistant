# AGENTS.md — You.Ge Assistant

> **Document structure:** The section immediately below defines permanent **Repository Development Rules** for coding agents and contributors working in `sandro-defender/you-ge-assistant`. The remainder of this file (§1–§17) is the preserved **You.Ge Assistant Integration Guide** for target web projects.

---

## Repository Development Rules — Coding Agents and Contributors

### Task sizing

- One prompt, one independently verifiable objective.
- Prefer small changes over phase-wide implementation.
- Never proceed to another stage without authorization.

### Token efficiency

- Inspect relevant files only.
- Never dump entire files, skills or successful test logs.
- Avoid duplicated explanations and repeated investigations.
- Report results concisely; show detailed output only when debugging.

### Skills

- Installed project skills live under `.agents/skills/` (`mobile-native`, `break-ui`, `tdd`); read `.agents/skills/README.md` and §17 below for priority rules.
- Read only relevant skills.
- Apply their actionable instructions.
- Never reproduce complete skill contents.
- Summarize each relevant skill in one line: `skill → application`.
- Do not claim unused or unavailable skills were applied (note: `ui-ux-pro-max-skill` is referenced by legacy UI docs but is not installed in `.agents/skills/`).

### Testing

- Use focused tests after small changes (`node --test <file>`).
- Use integration/regression tests at appropriate milestones (`npm run test:sdk`, `node scripts/sync-sdk-browser.mjs --check`, `node packages/assistant-sdk/scripts/validate-package.mjs`).
- Run full verification at major completion points (`npm run check`, plus `cd example && npm ci && npm run typecheck && npm run build` when dependencies are available).
- Never weaken tests or claim unexecuted checks passed.
- Reuse prior results only when the tested source and configuration remain unchanged.

### Git and PR safety

- Preserve existing work.
- Never reset, discard or overwrite user changes.
- Never force-push.
- Do not merge, publish, release or bump package or kit versions without explicit authorization. When the precache integrity gate (§12) demands a kit-version bump, stop and request owner authorization; never bump, bypass or weaken the gate to get a green check.
- Keep changes within the requested scope.

### Handoff requirements

- Maintain `AGENT_HANDOFF.md` as the authoritative current-state record.
- Maintain `NEXT_AGENT_PROMPT.md` as the next small ready-to-use task.
- Update both after every completed task.
- Include branch, commit, PR, working-tree status, completed work, pending work, test results, risks and exact next action.
- Ensure both documents agree with actual repository state.

### Architecture

- Use canonical You.Ge Assistant technical identifiers (`you-ge-sw.js`, `window.YouGePWA`, `--youge-pwa-*`, `.youge-*`, `you-ge-*` IndexedDB stores, `youge_*` cookies, `youge:pwa:*` events, `[data-youge-*]`, `web+youge`) for all new code, docs, snippets and examples; keep legacy aliases (`window.PWA`, `window.progressier`, `/progressier.js` `importScripts` shim, `.progressier-*`, `--progressier*`, legacy storage fallbacks, `staff.you.ge` manifest `id`) intact during the `1.x` compatibility window (`COMPATIBILITY_CONTRACTS.md`).
- Keep the SDK framework-independent and dependency-light (zero runtime dependencies; no `fetch`, `serviceWorker.register`, or `setInterval` in `@youge/assistant-sdk` core).
- Respect existing PWA, security and origin boundaries (hostname detection is never auth; no secrets in client/public config; regenerate `assistant-state.js` only via `npm run sync:sdk`).
- Avoid unnecessary abstractions and dependencies.

### Permanent You.Ge Assistant Identity Rule

- You.Ge Assistant is the sole product and canonical technical identity of this repository. Nothing in it is, or may be described as, a Progressier product.
- **Canonical vs. temporary compatibility policy:** Treat You.Ge Assistant identifiers (`you-ge-sw.js`, `window.YouGePWA`, `window.YouGeAssistant`, `--youge-pwa-*`, `.youge-*`, `you-ge-shared-files` / `you-ge-notifications` / `you-ge-pwa-meta`, `youge_install_banner_` / `youge_push_banner_`, `youge-pwa:welcome`, `youge:pwa:*`, `YOUGE_CONFIG`, `[data-youge-*]`, `?youge-install=1`, `web+youge`) as canonical everywhere. Treat all Progressier-named identifiers (`progressier.js` shim, `window.progressier`, `.progressier-*`, `--progressier*`, `progressier*` cookies/IndexedDB stores, `pswutlzoq`, `web+loldwyhv`) as **temporary migration compatibility only, never permanent contracts**.
- Never introduce new `progressier*` identifiers, never use legacy selectors or paths in new examples/templates/docs, and never expand legacy shim surfaces.
- Whenever an agent discovers obsolete Progressier branding, product descriptions, example/template framing, documentation, comments, metadata, or unmapped legacy references, it must proactively replace or reframe them as You.Ge Assistant.
- Preserve existing temporary migration shims and upgrade paths during the documented `1.x` compatibility period (`>= 12 months` / before `2.0.0`) unless executing the staged removal policy in [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md) §4 with explicit owner approval.
- Report remaining Progressier-named technical identifiers accurately: never claim a complete cleanup without the search method and the list of exceptions. [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md) is the authoritative inventory (canonical surface, temporary alias, upgrade mechanism, compatibility period and concrete removal policy); update it whenever a surface is added, migrated or retired.
- `reference/` and `PARITY.md` are third-party compatibility evidence. Do not remove or restructure them without separate owner approval.

---

## You.Ge Assistant integration guide

This guide documents how to integrate **You.Ge Assistant** into another web project.
Follow it in order. It describes **what exists**, **where it goes**, **what must not
be renamed**, and **how to verify multi-domain/PWA behavior**.

You.Ge Assistant is a dependency-free PWA toolkit and modular SDK
(`@youge/assistant-sdk` / `window.YouGeAssistant`). Runtime files are plain
JavaScript, CSS, a manifest, a service worker, static icons, central domain
configuration, and an on-demand DNS diagnostics module. There is no build step
or runtime package install required for classic `<script>` integration.

Current runtime version: **1.2.0** (`YouGePWA.version` / `PWA.version`, `VERSION` in
`you-ge-sw.js`, root `package.json` and the SDK's `KIT_COMPAT_VERSION`; the SDK
package itself is versioned separately, currently `0.2.0`). For architecture findings and risks, see
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
        |  registers /you-ge-sw.js (or preserves an active /progressier.js install)
        |  mounts buttons, banners, modals, QR
        v
  /pwa.js  --------------------------->  /you-ge-sw.js  (shim: /progressier.js)
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
it is idempotent: a second copy exits immediately (`window.YouGePWA.__youGePwaKit`).

---

## 2. Non-negotiable compatibility rules

An agent must preserve these so fresh installs use canonical You.Ge Assistant
identifiers while existing installs upgrade safely:

1. **Remove any legacy hosted script/manifest tags when migrating an older app**
   (for example, `https://progressier.app/<id>/script.js`) so they do not run
   alongside `pwa.js`.
2. **Deploy canonical `/you-ge-sw.js` alongside the `/progressier.js` compatibility
   shim.** Fresh installs register `/you-ge-sw.js` by default; when `data-sw` is
   omitted and `getRegistration(scope)` detects an already-installed `/progressier.js`
   worker, `pwa.js` preserves `/progressier.js` in place while `/progressier.js`
   loads `/you-ge-sw.js` via `importScripts`.
3. **Keep the manifest `id` stable** for an existing app (such as `staff.you.ge`'s
   pinned `id` in `domain-registry.js`). Generic fallback `manifest.webmanifest`
   and brand-new apps use canonical `"/"` (or their scoped route path). Changing
   `id` on an already-installed host creates a second installed app.
4. **Keep worker and precache assets inside the app scope.** `you-ge-sw.js` resolves
   precache/offline assets against the registered app scope; use a scoped runtime
   copy for a subpath deployment.
5. **Load the public domain registry and resolver before `pwa.js`.** Domain
   overrides are public branding/configuration, never secrets or authorization.
6. **Use canonical `--youge-pwa-*` CSS variables and `.youge-*` selectors** for
   all new styling and markup while keeping the temporary `--progressier*` and
   `.progressier-*` migration aliases intact during the `1.x` compatibility window
   ([`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md)).
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
| `pwa.js` | yes | Client runtime (`window.YouGePWA` / `window.PWA`): config, SW registration, install/push UI, floating toolbox, QR, banners, meta, splash |
| `pwa.css` | yes | Component styles (`--youge-pwa-*` tokens and `.youge-*` selectors, plus temporary migration aliases). Required by the worker's precache: keep it deployed even with `data-no-css` or a custom `data-css` |
| `assistant-state.js` | for the Assistant | Centralized, event-driven state + configurable SDK API for the Intelligent Floating Assistant |
| `assistant-widget.js`, `assistant-widget.css` | for the Assistant widget | Dependency-free DOM renderer, fixed placement, safe areas, badges, in-place panel, auto-scaling launcher with manual size/position adjustment, Android Chrome handoff offer |
| `you-ge-sw.js` | yes | Canonical service worker: offline cache, push display, share target, badge, and non-destructive legacy IndexedDB migration |
| `progressier.js` | migration shim | Subpath-safe `importScripts('you-ge-sw.js')` shim kept during the `1.x` compatibility window so existing `/progressier.js` registrations update in place |
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
| `PARITY.md` | archive | Historical feature/sizing parity record (not primary product docs) |
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
you-ge-sw.js
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
| `protocol_handlers` | Keep `web+youge` / `web+pwa` if the app uses protocol links; remove otherwise |
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

Recommended, with explicit configuration (omit `data-sw` when migrating an existing `/progressier.js` site so `pwa.js` auto-preserves its active registration):

```html
<script
  src="/pwa.js"
  defer
  data-sw="/you-ge-sw.js"
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

/you-ge-sw.js (and /progressier.js compatibility shim)
  Content-Type: application/javascript
  Cache-Control: no-cache
```

Only set `Service-Worker-Allowed` when granting a scope broader than the worker
file's directory, and use the narrowest required path. Serve `pwa.js`, `pwa.css`, `offline.*` and `qrcode.js` with `no-cache` or a
short max-age. The worker's own `VERSION` controls its caches; do not add a
long-lived immutable cache to `you-ge-sw.js` or `progressier.js`.

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
`icons[].sizes`, precache assets, kit-version consistency (worker `VERSION`,
`PWA.version`, `package.json`, SDK `KIT_COMPAT_VERSION`), precache integrity
against the merge base (§12), and leftover legacy hosted-script URLs.

Live checks:

```bash
node scripts/verify-deployment.mjs https://your-domain.example
```

It checks the HTML for leftover `progressier.app` tags, manifest MIME type,
real PNG dimensions, service-worker headers, offline assets, and Windows tiles.
Exit code `1` is a hard failure.

Browser acceptance:

1. DevTools → Application → Manifest: no errors, installable.
2. Application → Service Workers: `/you-ge-sw.js` is activated (or `/progressier.js` on an upgraded legacy install).
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
| `data-sw` | `you-ge-sw.js` (auto-preserves active `/progressier.js` when omitted) | Service worker URL |
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
| `data-allow-external-protocol` | off | Allow `web+youge:` / `web+pwa:` redirects to other origins |
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

Use canonical You.Ge Assistant declarative attributes and rendered button classes
for all new integrations (`[data-pwa-*]` aliases remain supported):

| Markup | Behaviour |
| --- | --- |
| `[data-youge-install]` (alias: `[data-pwa-install]`) | Install trigger; opens the browser prompt or manual install instructions |
| `[data-youge-diagnostics]` (alias: `[data-pwa-diagnostics]`) | Opens the on-demand network diagnostics modal |
| `[data-youge-qr]` (alias: `[data-pwa-qr]`) | Opens the QR dialog; value may be a custom URL |
| `[data-youge-hide-standalone]` (alias: `[data-pwa-hide-standalone]`) | Hidden when standalone |
| `[data-youge-show-standalone]` (alias: `[data-pwa-show-standalone]`) | Hidden when not standalone |
| `.youge-install-button` | Captured, rendered and localized automatically; opens install prompt or help |
| `.youge-subscribe-button` | Captured, rendered and localized; requests push permission/subscription |

Example:

```html
<button type="button" data-youge-install>Install</button>
<button type="button" data-youge-qr>Show QR code</button>

<button type="button" class="youge-install-button" data-icons="true">Install</button>
<button type="button" class="youge-subscribe-button" data-icons="true"
        data-eligible="Get notifications"
        data-subscribed="Notifications enabled"
        data-blocked="Notifications blocked"></button>
```

### 6.1 Rendered button options & temporary legacy compatibility markup

Rendered buttons (`.youge-install-button`, `.youge-subscribe-button`) accept the
options below. Temporary migration compatibility selectors (`.progressier-install-button`,
`.progressier-subscribe-button`) remain supported during the `1.x` compatibility
window (`YouGePWA.scanButtons()` forces a scan) but must not be used in new code:

| Markup | Behaviour |
| --- | --- |
| `.youge-install-button` (legacy alias: `.progressier-install-button`) | Captured and rendered automatically; opens install prompt or help |
| `.youge-subscribe-button` (legacy alias: `.progressier-subscribe-button`) | Captured; requests push permission/subscription |
| `data-behavior="disable"` / `"hide"` | Disable or hide when installed |
| `data-hide-standalone` | Hide in standalone mode (default `true`) |
| `data-allow-ios` | Allow the iOS path (default `true`) |
| `data-allow-samsung` | Allow the Samsung path (default `true`) |
| `data-install`, `data-installed` | Custom labels; default English values localize |
| `data-icons` | Show the install icon next to the label |
| `data-eligible`, `data-subscribed`, `data-blocked` | Subscribe-button labels |
| `.captured`, `.initialized` | Added by the runtime to wired buttons |

---

## 7. JavaScript API

Use `window.YouGePWA` (canonical; `window.PWA` is the supported alias) for
runtime PWA actions and `window.YouGeAssistant` (or `@youge/assistant-sdk`) for
centralized Assistant state, configuration, and subscriptions. For temporary
migration compatibility only, `window.progressier` is exposed as a thin shim
(`install`, `prompt`, `isStandalone`, `checkIfStandalone`, `register`,
`ready`, `setAppBadge`, `clearAppBadge`, `track`, `wording`, `detection`,
`push`, `installBanner`, `pushBanner`, `showWelcome`, `utils.wait`,
`utils.vibrate`).

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

Listen on `document` (canonical `youge:pwa:*` events are emitted alongside
bridged `pwa:*` compatibility events):

| Canonical event | Compatibility alias | Detail |
| --- | --- | --- |
| `youge:pwa:ready` | `pwa:ready` | `pwa.js` initialized its API; service-worker registration may not have run or completed |
| `youge:pwa:installable` | `pwa:installable` | Install prompt captured |
| `youge:pwa:installed` | `pwa:installed` | App installed or entered standalone |
| `youge:pwa:update` | `pwa:update` | New service worker waiting |
| `youge:pwa:share` | `pwa:share` | `{ id, url, title, text, file, blob }` |
| `youge:pwa:diagnostics` | `pwa:diagnostics` | Classified Cloudflare DoH/current-host result |
| `youge:pwa:event` | `pwa:event` | `{ name, detail }` for every `YouGePWA.track()` call |

The temporary `window.progressier` shim also exposes `progressier.ready` and push
helpers during the `1.x` migration period.

---

## 9. Storage and state (canonical stores + non-destructive migration)

| Canonical key | Temporary legacy key | Type | Purpose & migration |
| --- | --- | --- | --- |
| `youge_install_banner_` + host + path | `progressierinstallbanner` + host + path | Cookie | Install banner dismissal timestamp (promotes legacy on read; mirrors write during `1.2.x` for rollback safety) |
| `youge_push_banner_` + host + path | `progressierpushbanner` + host + path | Cookie | Push banner dismissal timestamp (promotes legacy on read; mirrors write during `1.2.x` for rollback safety) |
| `you-ge-notifications` (`notifications`) | `progressierSavedPushNotifications` | IndexedDB | Notification history (worker copies missing legacy records idempotently; legacy DB retained for rollback) |
| `you-ge-shared-files` (`shared-files`) | `progressiersharedfiles` | IndexedDB | Shared-file payloads (worker migrates on activate; `pwa.js` reads canonical first then legacy for in-flight shares) |
| `you-ge-pwa-meta` (`meta`) | `pwakit` (`meta`) | IndexedDB | Worker metadata / badge state (copied when canonical entry absent) |
| `you-ge-assistant:<host>:<scope>:pages:v<VERSION>` | `pwa-pages-<legacy-version>` | Cache | Scoped network-first public HTML cache (public in-scope legacy entries copied) |
| `you-ge-assistant:<host>:<scope>:static:v<VERSION>` | `pwa-static-<legacy-version>` | Cache | Scoped precached/runtime static assets (in-scope legacy entries copied) |
| `youge-pwa:welcome` | `pwakit:welcome` | localStorage | Welcome modal shown once (promoted on read and mirrored on write) |

Clean installations where `indexedDB.databases()` is available never create the
legacy IndexedDB databases. Upgraded installations preserve legacy databases and
caches untouched so downgrades within `1.x` do not lose history or shares.

---

## 10. Theming

For the Intelligent Floating Assistant (`assistant-widget.js` / `@youge/assistant-sdk`),
use adaptive theme modes and `--youge-*` tokens documented in [`THEMING.md`](THEMING.md).

For `pwa.css` UI components (banners, modals, toolbox), `pwa.css` defines 15
canonical `--youge-pwa-*` custom properties on `:root` (falling back to temporary
`--progressier*` migration variables when present):

```
--youge-pwa-bg               (legacy fallback: --progressierBg)
--youge-pwa-element          (legacy fallback: --progressierElement)
--youge-pwa-text             (legacy fallback: --progressierTxt)
--youge-pwa-border           (legacy fallback: --progressierBorderColor)
--youge-pwa-hover            (legacy fallback: --progressierHover)
--youge-pwa-shadow           (legacy fallback: --progressierBoxShadow)
--youge-pwa-font             (legacy fallback: --progressierFont)
--youge-pwa-letter-spacing   (legacy fallback: --progressierLetterSpacing)
--youge-pwa-text-weight      (legacy fallback: --progressierTextFontWeight)
--youge-pwa-heading-weight   (legacy fallback: --progressierHeadingFontWeight)
--youge-pwa-btn-weight       (legacy fallback: --progressierBtnFontWeight)
--youge-pwa-accent           (legacy fallback: --progressierAccent)
--youge-pwa-accent-text      (legacy fallback: --progressierAccentText)
--youge-pwa-focus            (legacy fallback: --progressierFocus)
--youge-pwa-note             (legacy fallback: --progressierNote)
```

Use `--youge-pwa-*` in CSS or call `YouGePWA.applyTheme()` at runtime (which
dual-writes canonical and legacy variables during the `1.x` compatibility period;
see [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md)):

```js
YouGePWA.applyTheme({
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
  URL, and `you-ge-sw.js` (plus the `progressier.js` shim) resolves precache/offline paths against its
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

The service-worker install precache is defined in `you-ge-sw.js` and includes
`offline.html`, `offline.js`, `offline.css`, `domain-config.js`,
`domain-registry.js`, `dns-diagnostics.js`, `assistant-state.js`,
`assistant-widget.js`, `assistant-widget.css`, `pwa.css`, `qrcode.js`, the
configured default icon, and `icons/icon-512.png`. `pwa.js`, `you-ge-sw.js`, and
`progressier.js` themselves are not in that precache list; the worker script
updates through normal service-worker script checks.

Each entry is declared required or optional in the worker. **Required**
(`offline.html`, `offline.css`, `offline.js`, `pwa.css`, the default icon,
`icons/icon-512.png`): the install fails unless every one is answered with a
complete HTTP 200. **Optional** (the domain, diagnostics, Assistant and QR
files): skipped only when the server answers 404/410 or its HTML fallback page.
Any other answer — 401, 403, 408, 409, 429, 5xx, a lost connection, a 120 s
timeout — fails the install for every asset. A failed install writes nothing and
leaves the installed version active; the browser retries. Do not make an asset
optional, or widen what counts as "not deployed", without owner approval.

`npm run check` (and CI) runs the diff-aware precache integrity gate,
`scripts/precache-integrity.mjs`: it reads that list by executing `you-ge-sw.js`'s
install handler, verifies that `progressier.js` delegates to `you-ge-sw.js`,
compares every listed file with the merge base, and fails when
a precached file was modified, added, removed or renamed without a synchronized,
higher kit version, or when the kit-version declarations disagree. Details,
cache lifecycle and upgrade guarantees: [`PRECACHE_INTEGRITY.md`](PRECACHE_INTEGRITY.md).

When any cached file changes:

1. Bump `VERSION` in `you-ge-sw.js`, `PWA.version` in `pwa.js`, `version`
   in the root `package.json` and `KIT_COMPAT_VERSION` in
   `packages/assistant-sdk/src/core/constants.js` together, then run
   `npm run sync:sdk` (in this repository the bump needs owner authorization;
   `PRECACHE_INTEGRITY.md` §7 lists the pinned tests and documentation lines).
   The SDK package version is separate and does not move with the kit.
2. Upload the changed files.
3. Reload. With `data-auto-update` the new worker activates automatically;
   otherwise `YouGePWA.showReloadPrompt()` or the built-in prompt asks the user.

The old worker is replaced because the script URL is unchanged (`/you-ge-sw.js`
on fresh installs, or `/progressier.js` on preserved legacy installs). Keep both
worker files in place during rollback; restore the previous files and bump `VERSION`
again. To remove the PWA entirely, serve a worker at `/you-ge-sw.js` (and `/progressier.js`
if previously used) that calls `self.registration.unregister()` and remove the manifest/script tags.

---

## 13. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Manifest ignored | Wrong MIME type; serve `application/manifest+json` |
| Install prompt never appears | Chrome requires HTTPS, a valid manifest, icons, and a controlling worker; use `YouGePWA.promptInstall()` or `[data-youge-install]` |
| Worker not updating | `Cache-Control` too long on `you-ge-sw.js` / `progressier.js`; bump `VERSION` |
| Buttons do nothing | Legacy hosted script still loaded, or `.youge-*` / `.progressier-*` node added before `pwa.js`; the scanner retries every 150 ms |
| Push says not configured | Missing `data-vapid-public-key` or `data-push-endpoint` |
| Push permission denied | Browser/site settings; `PWA.unsubscribePush()` then reset site permissions |
| iOS splash missing | Generated only in iOS Safari (not standalone); allow `data:` in `img-src` or supply static links |
| CSP blocks install help | Pass `data-csp-nonce` and allow it in `style-src` |
| QR blank | `/qrcode.js` not uploaded or blocked; check the Network panel |
| Share target 404 | `share_target.action` must be `/share-target`; the worker handles the POST |
| Offline page missing | Upload `offline.html`, `offline.css`, `offline.js`; the worker precaches them |
| Worker never installs or updates (`Precache failed: …` in the console) | A required precache asset is missing or a precache request was refused; the message names the asset and the HTTP status. Deploy the file under the worker scope — see `PRECACHE_INTEGRITY.md` §3 |

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
- protocol redirects (`web+youge:`, `web+pwa:`, `youge-redirect`, `youge-protocol-redirect`, plus legacy aliases)

Not included because they require a backend service rather than client files:

- hosted push campaigns, scheduling, segments, delivery
- analytics dashboard, A/B tests, funnel reports
- dashboard-managed announcements/newsfeed content
- user accounts, billing, subscription management
- App Store / Play Store / TWA packaging
- third-party attribution/promo routing

Do not tell a user these are "implemented" by copying files. They need a
backend or a separate service.

Additional client-side UI features **not** bundled in this toolkit (add them in
the target project if the design calls for them):

- pull-to-refresh indicator
- cookie-consent banner (only banner-dismissal cookies exist)
- backend-driven toolbox promo routing (the local `data-toolbox` icon opens the local `PWA.showInstallRequest()` flow)
- newsfeed/announcement feed UI (notification history is stored and exposed via `PWA.getNotifications()`, but there is no rendered feed)
- platform-specific install instruction screens for every OS; the toolkit ships a generic sheet plus the iOS path

---

## 15. Agent acceptance checklist

Before reporting an integration complete, confirm all of these:

- [ ] Any legacy hosted PWA script (`progressier.app`) and manifest tags removed.
- [ ] `pwa.js`, `pwa.css`, `you-ge-sw.js`, `progressier.js` (compatibility shim), manifest, offline files, QR library, icons uploaded.
- [ ] Manifest `name`, `short_name`, `id`, `start_url`, `scope`, colors, icons adapted.
- [ ] Manifest served as `application/manifest+json`.
- [ ] `you-ge-sw.js` (and `progressier.js` shim) served from the expected path with `no-cache` and correct scope.
- [ ] `npm run check` exits `0` (static checks, syntax and unit tests).
- [ ] Manifest parses as JSON and every icon path exists with the declared size.
- [ ] `scripts/verify-deployment.mjs` exits `0` against the deployed URL.
- [ ] Host-aware manifest route or per-host static manifest has the correct identity/scope.
- [ ] Domain/DoH diagnostics identify the current hostname and explain resolver limitations.
- [ ] The DNS recovery screen is available offline and does not require authentication.
- [ ] Browser: manifest valid, worker activated, install works, relaunch works.
- [ ] Browser: offline reload shows the offline page.
- [ ] Browser: no console errors and no leftover legacy `progressier.app` requests.
- [ ] If push is enabled: VAPID keys set, subscribe POST reaches the server, a test notification displays.
- [ ] If the app is on a subpath: worker paths and manifest scope updated.
- [ ] Version bumped if any cached file changed.

---

## 16. Copy-ready prompt for another agent

Paste this into the target project's AI agent and fill in the two placeholders:

> Integrate You.Ge Assistant located at `<KIT_PATH>` into this project.
>
> 1. Read `<KIT_PATH>/AGENTS.md` first and follow the integration guide (§1–§16).
> 2. Copy the runtime files into the web root (or `public/`): `pwa.js`,
>    `pwa.css`, `you-ge-sw.js`, `progressier.js`, `manifest.webmanifest`, `domain-config.js`,
>    `domain-registry.js`, `dns-diagnostics.js`, `qrcode.js`,
>    `offline.html`, `offline.css`, `offline.js`, `browserconfig.xml`,
>    `favicon.ico`, and `icons/`.
> 3. Remove any leftover legacy hosted PWA script (`progressier.app`) and manifest tags.
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
