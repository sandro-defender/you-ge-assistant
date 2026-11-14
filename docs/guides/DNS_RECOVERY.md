# Network diagnostics and DNS recovery

You.Ge Assistant includes optional, on-demand Cloudflare DNS-over-HTTPS diagnostics and user-guided recovery. It does not alter system settings, use WARP, or require a backend. The offline page caches the recovery UI and instructions with the app shell.

## What is tested

The diagnostic module (`dns-diagnostics.js`) uses Cloudflare's JSON DoH endpoint:

```text
https://cloudflare-dns.com/dns-query
Accept: application/dns-json
```

It resolves A and AAAA records for the **current browser hostname**, then makes a no-store, credential-free same-origin request to the app manifest (or an explicitly configured same-origin probe). A backend health URL can be optionally configured as a same-origin path. Requests have AbortController timeouts and one bounded retry by default (configurable up to two); concurrent checks for the same host and probe configuration are deduplicated. No query is made on ordinary startup.

An optional caller `AbortSignal` cancels a check:

```js
const controller = new AbortController();
const result = await window.YouGeDns.check(context, { signal: controller.signal });
// controller.abort() before completion => { ... classification: 'cancelled', cancelled: true, failed: false }
```

Cancellation is distinct from a timeout and from an ordinary probe failure: the result reports `classification: 'cancelled'` / `status: 'cancelled'` with `dnsErrors: []`, it is never retried, and it never raises a connectivity notice in `YouGeAssistant` state. Callers that pass no signal keep the existing behavior, and one caller's signal never aborts a deduplicated run another caller is waiting for.

Possible result categories include:

- **Normal connectivity:** DoH returned usable records and the application host responded.
- **DNS resolution failure:** both A and AAAA returned NXDOMAIN and the app probe failed.
- **Missing records:** both lookups returned NOERROR without A or AAAA answers.
- **Cloudflare DoH unavailable:** the DoH request failed, timed out, returned a non-success response, or returned invalid data.
- **Application host unavailable:** DoH resolved the name but the same-origin app probe did not respond. DNS interference is only one possible cause; IP routing, TLS, CDN, firewall and server problems can look the same.
- **Backend unavailable:** an optional backend probe failed while the application host responded.
- **General internet failure:** the browser reports offline and the app probe also fails.
- **Application host unavailable (online, everything failed):** the browser reports a connection but neither DoH nor the application probe responded. Because the device is online, this is reported as a connectivity failure rather than an inconclusive result. Offline (`general_internet_failure`) and backend-failure precedence are unchanged.
- **Cancelled:** the caller aborted the check. Not a failure, and no recovery guidance applies.
- **Inconclusive/unknown:** signals conflict or are insufficient.

CORS and ordinary network failures are intentionally reported together where the browser does not expose a reliable distinction. An absent AAAA record alone is not an outage when A records work.

## Important diagnostic limits

Browser JavaScript cannot inspect or query the device's normal configured DNS resolver directly. It cannot prove that an ISP intercepted, blocked, or modified DNS. The page already loaded from its origin, and a DoH lookup is a comparison point—not a test of the operating system's resolver. A successful Cloudflare lookup plus failed app request does not distinguish DNS problems from IP-level blocking, TLS/certificate errors, CDN/routing issues, firewall policy, or a backend outage. The UI therefore describes DNS interference as a possible but unverified explanation, never a confirmed result.

The diagnostics never use `staff.you.ge` or another fixed target; PWA calls pass the resolved current hostname and origin. The DoH request sends the current hostname as a DNS query to Cloudflare's public endpoint (without application credentials or a referrer) and is subject to internet access, browser CORS policy and Cloudflare availability. The toolkit does not persist the query or cache the response in the service worker; Cloudflare receives the request under its own service/privacy terms.

## Recovery steps

Recovery is user-guided. The app does not change operating-system settings.

### Android: Private DNS

Set the provider hostname to:

```text
one.one.one.one
```

1. Open Android **Settings**.
2. Open **Network & internet** (the exact menu name varies by device).
3. Open **Private DNS**.
4. Select **Private DNS provider hostname**.
5. Enter `one.one.one.one` and save.
6. Return to the current You.Ge Assistant domain and run diagnostics again.

Official instructions: <https://developers.cloudflare.com/1.1.1.1/setup/android/>  
Cloudflare Android app: <https://play.google.com/store/apps/details?id=com.cloudflare.onedotonedotonedotone>

### iPhone and iPad

Use Cloudflare's 1.1.1.1 app and select **DNS-only** mode. WARP is not required.

1. Install Cloudflare 1.1.1.1 from the App Store.
2. Enable the DNS profile and choose DNS-only mode (do not enable WARP unless you independently want it).
3. Return to the current domain and run diagnostics again.

Official instructions: <https://developers.cloudflare.com/1.1.1.1/setup/ios/>  
Cloudflare iOS app: <https://apps.apple.com/app/1-1-1-1-faster-internet/id1423538627>

### Other devices

Open your operating system or router's DNS configuration and choose a DNS-over-HTTPS/TLS provider supported by that device. The app cannot set this automatically. After changing settings, reload the **same current domain** and retry.

## UI and API

Add `dns-diagnostics.js` before `pwa.js`. Then call:

```js
PWA.showNetworkDiagnostics();

// Programmatic result (no startup request):
const result = await PWA.runNetworkDiagnostics();
console.log(result.hostname, result.classification, result.message);
```

`PWA.showNetworkDiagnostics()` identifies the tested hostname and provides retry and recovery links. Use `<button data-pwa-diagnostics>` for delegated buttons. `offline.html` loads the same small module and exposes a manual check plus locally cached recovery instructions without requiring application authentication.

The module can optionally compare a backend path through the domain registry:

```js
'portal.example.com': {
  diagnostics: {
    appProbePath: 'manifest.webmanifest',
    backendProbePath: '/health', // same-origin only; no credentials sent
  },
}
```

Never configure a cross-origin or arbitrary user-provided probe URL. The implementation rejects cross-origin probes and sends requests without credentials, with `cache: 'no-store'`.

Relative probe paths follow the resolved domain `basePath` (for example `health` under `/app/` probes `/app/health`), while root-relative paths such as `/health` resolve against the origin. `validateDomainConfigDetailed()` / `YouGeDomain.validateConfigDetailed()` reject unsafe probe paths (cross-origin URLs, `//host` network paths, `javascript:`/`data:` schemes, backslashes, whitespace padding and `..` traversal) with an `invalid_diagnostics_probe` issue, and the normalized config drops them so the runtime falls back to `manifest.webmanifest` and no backend probe.

### Host classification

Every result carries a `hostKind` field, and the wording, the DoH skip and the
recovery guidance all follow it:

| `hostKind` | Examples | Public DoH | Reported as |
| --- | --- | --- | --- |
| `hostname` | `portal.example.com` | queried (A + AAAA) | a normal DNS name |
| `localhost` | `localhost`, `team.localhost` | skipped | a local development host |
| `loopback` | `127.0.0.1`, `127.255.255.254`, `[::1]`, `[::ffff:127.0.0.1]` | skipped | a local development host |
| `private` | `10.1.2.3`, `172.16.5.5`, `192.168.1.10`, `169.254.10.10`, `100.64.0.7`, `[fd00::1]`, `[fe80::1]` | skipped | a private/local-only address |
| `public-ip` | `8.8.8.8`, `1.1.1.1`, `203.0.113.10`, `[2001:db8::12]` | skipped | the IP address the app is served from |

Public DoH cannot resolve `localhost`, loopback, private or IP-literal hosts, so
those hosts never query it: the same-origin app and backend probes still run,
the result carries `dohSkipped: true` and `dohAvailable: false`, and the
classification stays `normal_connectivity` or `application_host_unavailable`
instead of a misleading NXDOMAIN `inconclusive` result.

The kinds are deliberately separate. Loopback (`127.0.0.0/8`, `::1`) is the only
address class a browser can serve a development app from without a network
interface, so it keeps the "local development host" wording. RFC1918, link-local
and carrier-grade NAT ranges are local-only but are reached over a network
interface, so they are described as private rather than as loopback. A public IP
literal is a production-style target that simply is not a DNS name: it is never
described as a development host, and its message names the address. IPv6 literal
handling, including bracketed parsing and compressed-vs-expanded spellings, is
unchanged; malformed host values still classify as `unknown` without any request.

### Diagnostic identity

A DNS verdict belongs to one effective diagnostic target, not just to one
hostname. `YouGeAssistant` clears the published verdict (`network.dns` returns
to `idle` / `unknown`, a stale `dns:failure` notice disappears) and aborts an
in-flight run that has not reported yet whenever `configure()` changes any part
of that target:

- the project id;
- the resolved hostname;
- the origin;
- the resolved base path (`/portal/` and `/other/` on the same host are
  different apps);
- the configured `diagnostics.appProbePath` or `diagnostics.backendProbePath`,
  which change what the app and backend probes actually request.

Unrelated configuration (branding, theme, module toggles, positions) and a
repeated `configure()` with an identical target keep the current verdict.
`./health` and `health` describe the same probe target and are treated as equal;
root-relative `/health` is not equivalent, because on a subpath it resolves to a
different URL. Any run that was in flight when the target changed is cancelled
and cannot publish a result afterwards, including after its own identity has
moved on.

## Testing

`npm test` uses mocked fetch/AbortController responses to cover A/AAAA success, missing AAAA, NXDOMAIN, empty records, invalid responses, request and stalled-body timeouts, retry/deduplication, CORS/network errors, app-host failure, offline state, backend failure, subpath backend probe resolution, the full host-classification table (localhost, loopback, private, public IP literal, hostname, malformed values), invalid host/origin input, and rejected diagnostics probe paths. A separate table-driven suite covers the diagnostic identity: base-path changes, probe-path changes, unrelated configuration that must keep a verdict, repeated identical configuration, and a stale in-flight run that must not publish after the identity changes. These tests do not contact Cloudflare and do not simulate ISP blocking. Verify CORS and actual resolver behavior manually in a controlled network; do not claim real-world ISP interference testing unless it was observed on an affected network.
