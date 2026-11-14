# You.Ge Assistant integration and migration guide

This checklist applies to any host or subdomain. Use examples such as
`app.example.com` or `/portal/`; no domain is assumed by the runtime. Fresh
installations register canonical `/you-ge-sw.js`; existing installations remain
compatible via the `/progressier.js` shim and automatic non-destructive storage
migration (`COMPATIBILITY_CONTRACTS.md`).

## 1. Upload files

Copy the runtime files into the application root (or the app's scoped public
folder):

```text
pwa.js pwa.css you-ge-sw.js progressier.js manifest.webmanifest qrcode.js
domain-config.js domain-registry.js dns-diagnostics.js manifest-handler.js
offline.html offline.css offline.js browserconfig.xml favicon.ico icons/
```

On Cloudflare Pages, retain `functions/manifest.webmanifest.js` and the shared
`manifest-handler.js` at project root if using the dynamic host-aware manifest.
Static-only hosts should publish a separate manifest per brand or use the safe
You.Ge Assistant fallback manifest.

## 2. Configure domains and subdomains

Register public overrides in `domain-registry.js` before loading the resolver.
Exact hostname keys and optional path-scoped keys (for example,
`example.com/portal/`) take precedence over `*.example.com` patterns. Add identity,
metadata, colors, icons, start URL, scope/base path, shortcuts and feature toggles
as needed. See [`MULTI_DOMAIN.md`](MULTI_DOMAIN.md) for a complete example.

Do not put secrets, private API destinations or authorization rules in this
registry. Unknown hosts use safe defaults. Browser hostname detection is not
access control.

Use this order in the page head:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<script src="/domain-registry.js" defer></script>
<script src="/domain-config.js" defer></script>
<script src="/dns-diagnostics.js" defer></script>
<script src="/pwa.js" defer></script>
```

For `/portal/`, serve assets from that base and set `pwa.basePath` to
`/portal/`; use `./` for manifest `scope` and `startUrl`. The worker defaults to
its own directory and will not request a broader scope unless explicitly
configured.

## 3. Hosting headers and manifest route

- HTTPS is required for service workers, install prompts and push (except
  localhost).
- `manifest.webmanifest`: `Content-Type: application/manifest+json`.
- Host-aware manifest responses: `Cache-Control: private, no-store`, `Vary: Host`.
- `/you-ge-sw.js` (and `/progressier.js` compatibility shim): `Content-Type: application/javascript`,
  `Cache-Control: no-cache`. If it must control above its own directory, use the
  narrowest applicable `Service-Worker-Allowed` header.
- Set CSP `worker-src 'self'`; allow `https://cloudflare-dns.com` in `connect-src`
  for user-triggered diagnostics. Respect style nonce requirements documented in
  README.
- Do not put secrets in manifest/config responses; don't CDN-cache one host's
  manifest under another hostname.

Cloudflare Pages can use the included `functions/manifest.webmanifest.js`
adapter. It resolves a validated public registry entry for the request hostname,
uses safe defaults for unknown hosts, keeps manifest URLs same-origin and within
the app base path, and disables shared caching. On other edge/server platforms,
route the manifest URL to `YouGeManifestHandler.handle(request)` or implement the
same contract. A static JSON file cannot vary by request host; build one manifest
per host if the platform cannot execute a route.

## 4. Verify deployment

```bash
npm run check
node scripts/verify-deployment.mjs https://app.example.com
```

Verify:
- the manifest MIME type, identity, start URL and scope for that host;
- static icons and all scripts are present under the correct base path;
- worker path, scope and `Service-Worker-Allowed` headers are correct;
- no unrelated host or out-of-scope URL appears in manifest actions;
- CSP allows the worker and Cloudflare endpoint only when needed.

## 5. Browser acceptance

1. In Chrome/Edge DevTools → Application, confirm the host-specific manifest and
   active worker. Install and relaunch from the icon.
2. Test iOS Safari → Share → Add to Home Screen. Other iOS browsers may not offer
   Safari's manual flow.
3. Open `PWA.showNetworkDiagnostics()` and confirm the displayed hostname is
   this deployment's host. Diagnostics are on demand and do not block startup.
4. In a controlled test, enable offline mode and reload a visited route. The
   worker caches navigation HTML only when the response explicitly declares
   `Cache-Control: public`; confirm a public route or otherwise confirm the
   scoped offline page shows the hostname, retry action and recovery instructions.
   Mark authenticated/personalized HTML `Cache-Control: private, no-store`.
5. Verify QR/share URLs use the active URL by default; test a waiting worker
   update if one is available.
6. Repeat on two separate origins and a subpath. Browser installs and local
   storage are intentionally independent per origin.

## 6. Optional push

Push still requires application-server authorization and VAPID keys. The
`examples/push-server/` sender is a demonstration, not production-authenticated.
Key subscriptions to the authenticated user and protect subscribe/send/delete
routes with your existing session middleware. Use your own contact address for
`VAPID_SUBJECT` and never expose a private VAPID key in this public registry.

## 7. Updating and rollback

- Deploy canonical `/you-ge-sw.js` alongside `/progressier.js`. Fresh and default
  registrations always use `/you-ge-sw.js`; `/progressier.js` remains available
  as a thin `importScripts('you-ge-sw.js')` shim for explicit
  `data-sw="/progressier.js"` compatibility during the `1.x` window.
  Saved share and notification records in legacy IndexedDB stores are copied
  non-destructively into canonical `you-ge-shared-files` and `you-ge-notifications`
  stores while leaving legacy databases intact for rollback.
- Worker caches include host, registered app scope and version. The worker
  copies same-origin, in-scope static assets from the last known shared legacy
  cache names and migrates legacy HTML only when it explicitly declares
  `Cache-Control: public`. Old shared-name caches are retained because older
  versions did not identify ownership safely. It prunes only its own newer
  namespace; new navigation HTML is also cached only when explicitly public.
- Keep the existing manifest ID on an already-installed host (`staff.you.ge`
  keeps `/HIPSBNVemXtM8VMwRfWs` in `domain-registry.js`; generic fallback
  `manifest.webmanifest` uses `"/"`). Changing `id` on an installed host can
  create a second installed app. Unrelated origins remain separate installs and
  cannot transfer browser data automatically.
- Roll back by restoring the previous runtime files while keeping both worker
  URLs deployed. Do not manually clear all Cache Storage or IndexedDB; this may
  erase user-visible history and shared payloads.
- Bump `VERSION` in `you-ge-sw.js`, `PWA.version` in `pwa.js`, `version`
  in `package.json` and the SDK's `KIT_COMPAT_VERSION` together for
  cache-affecting releases. `npm run check` rejects a changed precached file
  without that bump ([`PRECACHE_INTEGRITY.md`](PRECACHE_INTEGRITY.md)).
- The worker installs only when `offline.html`, `offline.css`, `offline.js`,
  `pwa.css`, `icons/icon-192.png` (or the registry's `branding.icon`) and
  `icons/icon-512.png` are all served with HTTP 200 under its scope. The other
  precached files are optional and may answer 404. Any other failure leaves the
  installed version untouched and is retried by the browser.

## 8. DNS recovery

Diagnostics use Cloudflare's public DoH JSON API for the current hostname and a
same-origin app probe. They cannot inspect a device's ordinary resolver and
cannot prove ISP DNS blocking. Recovery remains user-guided: Android Private DNS
provider hostname `one.one.one.one`, or Cloudflare 1.1.1.1 DNS-only mode on
iPhone/iPad (no WARP required). See [`DNS_RECOVERY.md`](DNS_RECOVERY.md).
