# Multi-domain and subdomain configuration

You.Ge Assistant is designed to run from different origins with one runtime. The browser detects the active `hostname`, `origin`, `protocol`, `pathname`, subdomain, best-effort registrable/root domain, and application base path. `domain-config.js` owns this logic; modules and UI consume its resolved configuration instead of each detecting the host independently.

> Browser installations and storage are origin-scoped. `https://app.example.com` and `https://tools.example.com` are separate PWA installations, service workers, Cache Storage and IndexedDB areas. They do not transparently share an install or user data.

## Add a host or subdomain

Load the public registry before the resolver and PWA client. Put an entry in `domain-registry.js` (or set `globalThis.YOU_GE_DOMAIN_REGISTRY` before loading it):

```js
globalThis.YOU_GE_DOMAIN_REGISTRY = {
  'app.example.com': {
    identity: {
      name: 'Example Operations',
      shortName: 'Example Ops',
      description: 'Operations tools for Example Company.',
    },
    branding: {
      themeColor: '#14532d',
      backgroundColor: '#f4f7f4',
      icon: 'icons/example-192.png',
      appleTouchIcon: 'icons/example-180.png',
      splashIcon: 'icons/example-512.png',
      favicon: 'icons/example-32.png',
      icons: [
        { src: 'icons/example-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/example-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/example-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: 'icons/example-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    pwa: {
      enabled: true,
      id: './',
      startUrl: './?launchedfrom=homescreen',
      scope: './',
      basePath: '/',
      display: 'standalone',
    },
    features: {
      installation: true,
      offline: true,
      sharing: true,
      push: true,
      badges: true,
      qr: true,
      diagnostics: true,
      dnsRecovery: true,
    },
    shortcuts: [
      { name: 'Today', short_name: 'Today', url: './today/' },
    ],
  },
  '*.example.org': {
    identity: { name: 'Example Portal', shortName: 'Portal' },
    pwa: { basePath: '/portal/', scope: './', startUrl: './?launchedfrom=homescreen' },
  },
};
```

Exact-host path entries such as `example.com/portal/` can give separate apps on the same origin their own identity/features; the longest matching path wins for that host. Exact hostname configuration wins over wildcard configuration. A wildcard such as `*.example.org` matches subdomains but not `example.org`. For example:

```js
globalThis.YOU_GE_DOMAIN_REGISTRY['example.com/portal/'] = {
  identity: { name: 'Portal', shortName: 'Portal' },
  pwa: { basePath: '/portal/', id: './', scope: './', startUrl: './' },
};
```

## Custom-domain aliases and project identity

A custom domain can identify the same SDK project as another hostname by declaring the same typed `project.id` in each matched registry entry. The ID is a stable application/project identity for Assistant state and project-scoped notice/configuration keys; it does not connect origins, cookies, authentication, service workers, Cache Storage, or browser storage.

```js
import { YouGeAssistant } from '@youge/assistant-sdk';

const domainRegistry = {
  'portal.customer.example': {
    project: { id: 'customer-portal' },
    identity: { name: 'Customer Portal', shortName: 'Portal' },
    pwa: { basePath: '/', scope: './', startUrl: './', id: './' },
  },
  'portal.customer-brand.test': {
    project: { id: 'customer-portal' },
    identity: { name: 'Customer Portal', shortName: 'Portal' },
    pwa: { basePath: '/', scope: './', startUrl: './', id: './' },
  },
};

const assistant = YouGeAssistant.create({
  domainRegistry,
  // Optional explicit project identity wins over projectId and registry mapping.
  // project: { id: 'customer-portal' },
});
```

Project ID precedence is `project.id` → legacy `projectId` → matched registry `project.id` → a normalized host plus application base path. Keep the legacy `projectId` option for existing integrations; new integrations should prefer the typed `project: { id }` form. A shared ID is only a logical configuration identity: browser storage and user sessions remain origin-scoped, and hostname matching is not authentication or authorization.

## Multi-subdomain configuration

A leading wildcard matches one or more subdomain labels, including nested subdomains, but not the apex hostname. Declare the apex separately if it should use the same project identity:

```js
const domainRegistry = {
  'workspace.example.com': {
    project: { id: 'workspace' },
    identity: { name: 'Workspace', shortName: 'Workspace' },
    pwa: { basePath: '/', scope: './', startUrl: './', id: './' },
  },
  '*.workspace.example.com': {
    project: { id: 'workspace' },
    identity: { name: 'Workspace', shortName: 'Workspace' },
    pwa: { basePath: '/', scope: './', startUrl: './', id: './' },
  },
};
```

The wildcard entry matches hosts such as `team.workspace.example.com` and `eu.team.workspace.example.com`, but not `workspace.example.com`. Exact-host configuration takes precedence over a wildcard match; path-scoped entries take precedence within their host class, then longer matching paths and host suffixes win, with a stable key tie-break for equivalent aliases.

The derived `rootDomain` is informational only; this module uses a small compound-suffix list, not a full Public Suffix List. Never use it for cookies, authorization, tenant boundaries or other security decisions. The registry is public client configuration: **never put secrets, credentials, authorization decisions, or private API tokens in it**. Unknown hosts receive safe You.Ge Assistant defaults and remain usable.

`domain-config.js` validates host keys, same-origin manifest URLs, scope/base paths, colors, icons, shortcuts and the supported `og:*`/`twitter:*` metadata keys. Only add domains you intend to serve; matching a host is never authentication or authorization.

Feature flags are opt-out booleans and should be set to `false` only when a host should not expose that behavior:

| Flag | Effect |
| --- | --- |
| `installation` | Hides/blocks install UI; generated manifest uses browser display mode |
| `offline` | Disables offline caching and fallback interception in the worker |
| `sharing` | Removes the generated share target and disables the worker share route |
| `push` | Disables push subscription UI and push-event processing |
| `badges` | Disables app-badge updates |
| `qr` | Hides/disables QR install UI |
| `diagnostics` | Disables the on-demand network diagnostics UI/API |
| `dnsRecovery` | Hides the user-guided DNS recovery instructions |

Disabling `push` does not delete server subscriptions; remove any existing subscriptions through the configured application endpoint when appropriate. On static-only hosting, the checked-in manifest cannot respond to feature flags, so generate the per-host manifest (especially when disabling its `share_target`) or use the host-aware handler.

## Include the runtime

For a root-mounted application:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<script src="/domain-registry.js" defer></script>
<script src="/domain-config.js" defer></script>
<script src="/dns-diagnostics.js" defer></script>
<script src="/pwa.js" defer></script>
```

For an application mounted under `/portal/`, serve the runtime files in that directory (or provide explicitly configured same-origin paths). Keep the worker inside the app directory when practical. The default worker scope is its own directory; an explicitly broader `data-sw-scope` requires an appropriate `Service-Worker-Allowed` response header and should be used only when needed.

The browser runtime exposes the resolved context through `PWA.config.domain` and `PWA.getState()` (`hostname`, `origin`, and `basePath`). `PWA.runNetworkDiagnostics()` and `PWA.showNetworkDiagnostics()` always test the active hostname, not a configured sample host.

## Host-aware manifest

A static JSON manifest cannot vary by request hostname. For domain-specific install labels, serve `manifest.webmanifest` through a host-aware route using `manifest-handler.js`; `functions/manifest.webmanifest.js` is a Cloudflare Pages Functions adapter. The handler:

- resolves only public configuration from the validated registry;
- defaults unknown hosts safely;
- emits same-origin relative identity/start/scope/icon data;
- rejects out-of-scope start URLs; and
- uses `Cache-Control: private, no-store` to prevent one host's manifest being reused for another.

The checked-in `manifest.webmanifest` remains a valid static fallback for static-only hosts. It has the You.Ge Assistant fallback identity and preserves the legacy `/HIPSBNVemXtM8VMwRfWs` ID for the prior root installation. On static-only hosting, domain-specific manifest names require a separate per-host generated manifest/build; browser-only hostname detection cannot change a static file response.

For a new domain, use a stable `id` such as `./` or an application-specific path. Keep the historical ID only on its original installation. Changing an installed app's manifest `id` can create a second installation.

## Subpath and hosting configuration

- `pwa.basePath` is the directory containing the app (for example `/portal/`).
- `pwa.scope` and `pwa.startUrl` must stay inside that base path. `./` is recommended for subpath deployments.
- Serve the worker as JavaScript with `Cache-Control: no-cache`; do not aggressively cache it.
- Serve manifests as `application/manifest+json`.
- Serve over HTTPS for service workers and installation (localhost is allowed for development).
- Use a host-aware route or per-host build output if multiple hostnames need different manifest branding.
- Do not share one CDN-cached manifest response across hosts. The provided handler sends `Vary: Host` and disables caching.
- Relative assets keep the same source compatible with root and subpath installs. Deploy each app's worker/offline assets in its own scope.

## Cache isolation and migration

The worker cache namespace includes the current hostname, worker scope path and runtime version, for example:

```text
you-ge-assistant:app.example.com:%2Fportal%2F:static:v1.1.1
you-ge-assistant:app.example.com:%2Fportal%2F:pages:v1.1.1
```

Cache Storage is already origin-partitioned by the browser; the namespace also prevents collisions between apps/scopes on a shared origin. The worker only handles same-origin requests inside its scope and prunes only its own new namespace. It copies same-origin, in-scope static assets from the last legacy cache names and migrates legacy HTML only when its response explicitly declares `Cache-Control: public`; old shared-name caches are retained because older releases did not namespace them safely. New navigation HTML is cached only when explicitly public. Mark authenticated/personalized HTML `Cache-Control: private, no-store`. IndexedDB names for saved shares and notification history remain unchanged for compatibility.

## Example deployments

| Deployment | Registry config | Manifest scope | Worker scope |
| --- | --- | --- | --- |
| `https://example.com/` | exact or safe defaults | `/` or `./` | `/` |
| `https://www.example.com/` | exact or wildcard | `/` or `./` | `/` |
| `https://app.example.com/` | exact or `*.example.com` | `/` or `./` | `/` |
| `https://example.com/portal/` | `basePath: '/portal/'` | `./` | `/portal/` |
| unknown host | safe You.Ge Assistant defaults | current app directory | registered app scope |

Use `npm run check` to run syntax, manifest, domain/manifest/DNS unit checks and deployment-layout validations.
