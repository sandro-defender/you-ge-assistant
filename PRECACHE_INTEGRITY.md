# Precache integrity, cache refresh and kit versioning — You.Ge Assistant

How the You.Ge Assistant service worker (`/you-ge-sw.js`, with `/progressier.js`
retained as a subpath-safe `importScripts` compatibility shim — see
[`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md)) caches the app shell,
which precache assets are required and which are optional, how installed apps
receive new code, what the `precache-integrity` gate enforces, and how kit
`1.2.0` refreshes the precache generation safely.

Everything below was verified with deterministic Node tests against the real
worker source. **No real-browser or live-deployment verification was performed.**

## 1. Pipeline

| Step | Source | Notes |
| --- | --- | --- |
| SDK sources → `assistant-state.js` | `npm run sync:sdk` (`scripts/sync-sdk-browser.mjs`) | The only generated precached file. `--check` (part of `npm run check`) fails when it is out of date. |
| Precache manifest | `PRECACHE_ASSETS` in `you-ge-sw.js` | 13 scope-relative files, each declared `required: true` or `required: false` (§3). There is no separate manifest file: the worker is the single source, and the gate reads it by running the install handler. |
| Never cached by the worker | `pwa.js`, `you-ge-sw.js`, `progressier.js` | Always fetched from the network (`fetch` handler returns early). |
| Kit version | `VERSION` in `you-ge-sw.js`, `PWA.version` in `pwa.js`, `version` in root `package.json`, `KIT_COMPAT_VERSION` in `packages/assistant-sdk/src/core/constants.js` (mirrored into generated `assistant-state.js`) | All `1.2.0`. The gate requires the four source declarations to agree and verifies that `progressier.js` delegates to `you-ge-sw.js`; `validate-package.mjs` also ties `KIT_COMPAT_VERSION` to `package.json`, and the sync check ties the generated bundle to the SDK source. The SDK package version (`0.2.0`) is a separate release line (§7). |
| Cache names | `you-ge-assistant:<host>:<scope>:static:v<VERSION>` and `…:pages:v<VERSION>` | Host- and scope-isolated. The **kit version is the only cache-invalidation key.** |
| Deployment | `.github/workflows/pages.yml` | Every push to `main` publishes the runtime to GitHub Pages. |

## 2. Lifecycle

| Phase | Behaviour |
| --- | --- |
| Update detection | The browser installs a new worker when `you-ge-sw.js` (and, per the Service Worker specification, any script it imports — `domain-registry.js`, `domain-config.js` — or `progressier.js` when explicitly configured via `data-sw="/progressier.js"`) differs byte for byte. `pwa.js` also calls `registration.update()` when the page becomes visible, at most hourly. A change to any other precached file does **not** start an install. |
| `install` | Downloads the whole precache manifest with `cache: 'reload'` (HTTP cache bypassed), reading every body to the end, within one 120 s deadline. Only when every asset is settled (§3) is anything written to `static:v<VERSION>`. Any failure aborts the remaining requests and rejects the install. `skipWaiting()` is never called here. |
| Waiting | The new worker waits. `pwa.js` reports `hasUpdate`, dispatches `pwa:update`, and the Assistant shows its notice. Nothing is replaced until the page posts `SKIP_WAITING` (`PWA.applyUpdate()` or `data-auto-update`). |
| `activate` | Copies in-scope entries from the legacy `pwa-static-1.0.4` / `pwa-pages-1.0.4` caches, deletes every other cache in this host+scope namespace, then `clients.claim()`. Caches of other hosts, other scopes, the legacy shared names and third parties are left alone. |
| `controllerchange` | `pwa.js` reloads once when it requested the update (3 s fallback timer), never for an unsolicited change. |
| `fetch` | Static assets: stale-while-revalidate against `static:v<VERSION>`. Navigations: network-first; only `Cache-Control: public` HTML is stored in `pages:v<VERSION>`. |

Consequences:

- **Version bump** → new cache names. The waiting worker fills its own cache;
  the active worker's cache is untouched until activation, then retired. This is
  the only fully isolated cutover.
- **Worker changed, version unchanged** → the new worker shares the cache name,
  so its install refreshes the live cache in place (all assets or none).
- **Precached file changed, worker byte-identical, version unchanged** → no
  install happens. Each cached file is served stale on its next request and
  replaced in the background; an offline user, and any file not requested online
  (for example `offline.html`), stays on the old release. This is finding R1,
  and the reason the gate (§6) requires a version bump for such a change.

A failed install never touches the installed version: the browser discards the
new worker, keeps the active one with its complete cache, and runs the install
again on its next update check (navigation, or the hourly visibility check).

## 3. Required and optional precache assets

Each manifest entry is declared in `you-ge-sw.js`. **Required** means the
install fails unless the asset is answered with a complete HTTP 200 response.
**Optional** means the asset may be left out of a deployment; it is skipped only
when the server states that it is not deployed.

Classification was made from what the runtime does without each file and from
the deployment contract the repository already enforces, not from the fact that
a 404 used to be tolerated.

### Required — the shell every deployment ships

| Asset | Why it is required |
| --- | --- |
| `offline.html` | The worker itself serves it as the navigation fallback when the network is down. In every upload list; `scripts/verify-deployment.mjs` fails without it. |
| `offline.css`, `offline.js` | Loaded by `offline.html`; without them the fallback page is unstyled and has no retry, status or branding logic. Same lists, same deployment check. |
| `pwa.css` | Stylesheet of every component `pwa.js` renders (install button, banners, dialogs, toolbox). In every upload list; `scripts/verify-deployment.mjs` fails without it. |
| Default icon — `icons/icon-192.png`, or the same-origin `branding.icon` a domain-registry entry declares for the host | The worker's default notification icon, the image on `offline.html`, and the default `PWA` icon. |
| `icons/icon-512.png` | Default manifest and splash icon (`domain-config.js` defaults, `manifest.webmanifest`); a 512 px icon is required for installability. |

### Optional — feature files a deployment may leave out

| Asset | Documented condition for leaving it out | What the runtime does without it |
| --- | --- | --- |
| `domain-config.js`, `domain-registry.js` | Integrations that load only `pwa.js` (the minimal upload list in `README.md`). | The worker wraps its `importScripts()` in `try/catch` and uses built-in defaults; `pwa.js` and `offline.js` fall back to their own resolver. |
| `dns-diagnostics.js` | Listed as optional in the `AGENTS.md` file map. | `pwa.js` and `offline.js` check for `window.YouGeDns` and report diagnostics as unavailable. |
| `assistant-state.js`, `assistant-widget.js`, `assistant-widget.css` | Pages that do not include the Assistant (neither upload list in `README.md` / `INTEGRATION.md` contains them), and applications that bundle `@youge/assistant-sdk` and render their own UI. | No kit script depends on them; `offline.js` only publishes a DOM event the Assistant may listen to. |
| `qrcode.js` | "Only for QR" in the file map; loaded on demand, and `data-qr-library` may point elsewhere. | QR rendering rejects with `Unable to load …`; everything else works. |

With the offline feature disabled for a host (`features.offline: false` in the
domain registry) the worker precaches nothing.

### How each answer is treated

| Answer for a precache request | Required asset | Optional asset |
| --- | --- | --- |
| HTTP 200, body received completely | stored | stored |
| HTTP 404 or 410 | **install fails** | skipped — not deployed |
| HTTP 200 with `Content-Type: text/html` for a script, stylesheet or image (single-page-app fallback page) | **install fails** | skipped — not deployed; the HTML is never cached under the asset URL |
| HTTP 401, 403, 408, 409, 429 and every other 4xx | **install fails** | **install fails** |
| HTTP 5xx | **install fails** | **install fails** |
| Any other status, including 2xx other than 200 | **install fails** | **install fails** |
| Connection lost, request rejected, body breaks off | **install fails** | **install fails** |
| No complete answer within 120 s (whole manifest) | **install fails**, outstanding requests aborted | same |

Only 404 and 410 say "this file does not exist here". 401 and 403 say the
deployment is blocking the request, 408 and 429 say "try again", 409 and 5xx
say something is wrong; treating any of them as "optional file absent" would
install a worker with a smaller shell than the deployment intends and hide the
fault. They fail the install for optional assets too.

The error names the asset, whether it is required, and the answer received, for
example: `Precache failed: required asset https://app.example/offline.css is not
deployed (HTTP 404). The service worker was not installed; the previous version,
if any, stays active.`

### After the downloads

- Nothing is written until every asset is settled, so a failed install changes
  no cache.
- If writing fails (for example a storage quota), a cache created by this
  install is deleted again. A cache that already existed belongs to the active
  worker of the same kit version and is left as it is; Cache Storage has no
  multi-entry transaction, so this one case can leave a mix until the next
  successful install. With the gate requiring a version bump for every asset
  change, a same-version install only happens for worker-only changes.
- An optional asset found absent is also removed from the cache being
  refreshed, so the cache matches the deployment after a same-version install.
- A retry is a fresh run of the same procedure and overwrites every entry.

### Deployment consequences

These follow from the classification and are new in kit `1.1.1`:

- **`pwa.css` must be deployed under the worker scope even when the page uses
  `data-no-css` or points `data-css` elsewhere.** The file map previously read
  "yes (unless `data-no-css`)"; that exception is withdrawn, because the worker
  cannot see page attributes at install time and a missing stylesheet on a
  default deployment must not install silently. A deployment that omits it keeps
  its current worker and stops receiving updates until the file is restored.
- The default icons must exist at `icons/icon-192.png` (or the registry's
  `branding.icon`) and `icons/icon-512.png`, as the file map already required.
- A host that answers a missing file with 403 (for example object storage
  without list permission) must either deploy the optional files or answer 404.
- A host that answers a missing `offline.html` with another HTML page (a
  single-page fallback) cannot be told apart from a real one by the worker;
  `scripts/verify-deployment.mjs` remains the check for that.

## 4. Verified behaviour

`tests/service-worker-lifecycle.test.mjs` and
`tests/service-worker-precache-policy.test.mjs` run the real worker in a VM with
in-memory Cache Storage, a scripted network and manually advanced timers
(`tests/support/service-worker-harness.mjs`). The harness states the
required/optional lists independently of the worker.

| Requirement | Result |
| --- | --- |
| A new worker receives the current assets | First install stores all 13 assets, every request with `cache: 'reload'`. |
| Missing required asset | Each of the six, answered 404, fails the install; the error names it. On a first install no cache is created. |
| Missing optional asset | Each of the seven, answered 404, is skipped and the other twelve are stored. 410 behaves the same. |
| 401 / 403 / 404 / 408 / 409 / 410 / 429 on a required asset | Install fails. |
| 400 / 401 / 403 / 405 / 408 / 409 / 429 on an optional asset | Install fails; not skipped. |
| 5xx (500, 502, 503, 504), required or optional | Install fails. |
| 204 / 206 | Install fails; only 200 is stored. |
| HTML fallback page | Fails for a required script; an optional one is skipped and the HTML is not cached. |
| Network failure, truncated body | Install fails before anything is stored, also for a same-version refresh. |
| Timeout | Still pending at 119 999 ms; fails at 120 000 ms; every request aborted; no timer left running. |
| Storage failure while writing | The half-written new-version cache is removed; a retry completes. |
| Failed install preserves the installed version | After every failure above: active cache byte-identical, no cache for the failed version, no `skipWaiting()`, no `clients.claim()`, and the active worker still serves its shell offline. |
| Successful retry | Complete shell from one release, no leftovers; activation then leaves exactly the new static and page caches. |
| A waiting worker does not replace the current one | No `skipWaiting()` during install; the active cache still serves the old release offline. |
| Old caches are retired safely | Activation deletes only this host+scope's older caches; another host, another scope, the legacy shared name and a third-party cache survive. |
| Offline users get updated code after install + activation | With the network down, every precached file and the offline page come from the new cache. |
| Upgrade from kit `1.1.0` | §7. |
| No new worker | Stale-once-then-fresh, and stale offline — the R1 behaviour, kept as an explicit characterization test. |
| `SKIP_WAITING`, `controllerchange`, update notices, reload safeguards | Unchanged; covered by the existing suites `tests/install-experience.test.mjs` and `tests/sdk-integration.test.mjs`. |

Each rule was also checked by mutation: removing it from the worker (a required
asset made optional, 403 treated as absent, no body read, no deadline, no abort,
no cleanup, any 2xx accepted, no HTML check) makes at least one test fail.

## 5. Defects fixed in the worker

1. **Failures were swallowed.** The install handler used `Promise.allSettled()`
   over `cache.add()`: any precache failure was ignored and the install still
   succeeded. An update that lost the network halfway produced an incomplete
   `static:v<next>` cache, and activation then deleted the complete previous
   one. With the version unchanged, the same failure left a mix of two releases
   in the live cache.
2. **Every 4xx counted as "optional file not deployed".** The first fix kept
   that tolerance for all thirteen assets, so a deployment missing
   `offline.html`, or one answering 401/403/429, still installed with a smaller
   shell. Assets are now declared required or optional, and only 404/410 (or an
   HTML fallback page) on an optional asset is skipped (§3).
3. **A truncated download could be stored**, and a stalled request held the
   install open with no bound in the worker. Bodies are now read completely
   before anything is written, under one deadline.

The update model is otherwise unchanged: same cache naming scheme, same
waiting/activation contract, same fetch strategies, same messages.

Behaviour changes to be aware of: a first install on a connection that drops or
stalls mid-precache no longer registers a worker with a partial shell (the
browser retries on the next page load), and the deployment consequences in §3.

## 6. The `precache-integrity` gate

`scripts/precache-integrity.mjs`, run by `scripts/check.mjs` (`npm run check`,
CI step "Static checks and precache integrity gate") and directly with
`npm run check:precache`.

Rules:

1. **Synchronization** — `you-ge-sw.js` `VERSION`, `pwa.js` `PWA.version`,
   root `package.json` `version` and, when the SDK package is in the repository,
   `KIT_COMPAT_VERSION` in `packages/assistant-sdk/src/core/constants.js` must
   exist and be identical, and `progressier.js` must delegate to `you-ge-sw.js`
   via `importScripts`. The SDK package version (`SDK_VERSION`,
   `packages/assistant-sdk/package.json`) is not a kit-version declaration and
   is not compared.
2. **Existence** — every asset the worker lists must exist in the repository.
3. **Diff-aware bump** — compared with the merge base, if any precached file was
   modified, added to the list, removed from the list or renamed, the kit
   version must be strictly higher than at the base. The version may never move
   backwards.

How it works:

- The precache list is obtained by executing the worker's install handler in an
  isolated VM, for the base revision and for the working tree. It is not
  duplicated in the script, so the list cannot drift from the worker.
- The base is `git merge-base <base> HEAD`. `<base>` is
  `PRECACHE_INTEGRITY_BASE` / `--base` when given — CI passes the pull request's
  base commit, or the previous tip for pushes — otherwise `origin/HEAD`,
  `origin/main`, `origin/master`, `main`, `master`. The whole branch is measured,
  not the last commit, and changes that landed on `main` after the fork point
  are not attributed to the branch.
- The working tree is compared, so uncommitted edits are caught locally.
- An explicit base that cannot be resolved is an error (CI checks out with
  `fetch-depth: 0`). With no base and no git history — a downloaded copy of the
  runtime — the diff is skipped with a warning and rules 1–2 still run.
- Success prints one line. Failure lists each changed asset with its kind
  (modified, added, removed, renamed, generated), the declarations and their
  values, why it matters and the required owner action.

Not triggered by: documentation, tests, scripts, `pwa.js`, `manifest-handler.js`,
the example, or a worker change that leaves the precache list alone (the browser
already reinstalls a changed worker).

Limits: the gate covers the files the worker precaches. Other static files are
cached only at runtime and refresh by stale-while-revalidate. A default icon
overridden through the domain registry is precached by that host's worker but is
not in the gate's list, which is derived without the registry. The gate
cannot tell a comment-only edit from a behavioural one; any byte change to a
precached file needs a bump.

Observed on this repository while applying the `1.1.1` bump:

| State of the working tree | Gate result |
| --- | --- |
| Worker, tests and documentation changed; no precached file changed | pass — `13 precached assets unchanged` |
| `pwa.css` comment edited, version still `1.1.0` | **fail** — `pwa.css — modified`, owner action named |
| `progressier.js` bumped alone | **fail** — declarations not synchronized, all four listed |
| Worker, client and `package.json` bumped, `KIT_COMPAT_VERSION` forgotten | **fail** — the SDK declaration listed at `1.1.0` |
| All four bumped | pass — `kit version 1.1.0 → 1.1.1 synchronized` |
| `--base bcdca6e` at `63c703e` (PR #34, retroactively) | **fail** — `assistant-state.js — modified; generated bundle` |

## 7. Kit version `1.1.1`

Authorized by the owner and applied in PR #35. No tag, release, publication or
deployment is part of the change.

### Declarations changed, `1.1.0` → `1.1.1`

| File | Declaration |
| --- | --- |
| `progressier.js` | `const VERSION` |
| `pwa.js` | `version:` (`PWA.version`) |
| `package.json` | `"version"` |
| `packages/assistant-sdk/src/core/constants.js` | `KIT_COMPAT_VERSION` |
| `assistant-state.js` | `KIT_COMPAT_VERSION`, regenerated by `npm run sync:sdk` (one line) |

Pinned expectations updated with it: `tests/example-theme.test.mjs`,
`packages/assistant-sdk/tests/sdk-core.test.mjs`. Documentation lines:
`AGENTS.md` ("Current runtime version"), `MULTI_DOMAIN.md` cache-name example,
`packages/assistant-sdk/RELEASE.md` and `MIGRATION.md` kit-compatibility lines,
`CHANGELOG.md`.

Deliberately unchanged:

- **SDK package version `0.2.0`** (`packages/assistant-sdk/package.json`,
  `SDK_VERSION`). The kit-compatibility constant and the SDK release version are
  separate. The published `@youge/assistant-sdk@0.2.0` tarball was built at kit
  `1.1.0` and keeps reporting `kitCompatVersion: '1.1.0'`; the repository source
  and the browser bundle report `1.1.1`. The constant is informational — no code
  compares it — and reaches a published package only with a future SDK release.
- Dated records that state the version at the time they were written
  (`POST_PHASE2_ARCHITECTURE_REVIEW.md`, `THEMING.md` §6, the validation tables
  in `packages/assistant-sdk/RELEASE.md`, earlier `CHANGELOG.md` entries).
- Test fixtures that pass an arbitrary `PWA.version` through the SDK
  (`packages/assistant-sdk/tests/sdk-integrations.test.mjs`); they are not kit
  declarations.

### What the precache change set contains

Compared with `main`, two precached files differ: `pwa.css` (two comments, the
last obsolete-branding wording) and `assistant-state.js` (the version constant).
The bump also gives the files that drifted under `1.1.0` before PR #35
(`assistant-state.js`, `assistant-widget.js`, `assistant-widget.css`,
`dns-diagnostics.js`, `domain-config.js`, `pwa.css`) their own cache generation.

### What an existing `1.1.0` installation does

1. The deployed `progressier.js` differs from the installed one, so the browser
   starts installing it on the next navigation or update check.
2. The new worker downloads all 13 assets into `…:static:v1.1.1`. The `1.1.0`
   worker stays active and keeps serving `…:static:v1.1.0`, online and offline.
3. If the download fails in any way, nothing changes and the browser retries
   later (§3).
4. When it succeeds the worker waits; the page shows its update notice.
5. On `SKIP_WAITING` it activates, deletes this host+scope's `…:v1.1.0` caches,
   claims the pages, and the page reloads once.
6. From then on, offline requests are answered from the `1.1.1` cache.

`tests/service-worker-precache-policy.test.mjs` walks through exactly this
sequence, including the generated `assistant-state.js` being part of the new
cache and a failed upgrade never mixing versions.

### Risks to existing installations

- Users see one update notice; nothing is replaced until they accept it (or
  `data-auto-update` is set).
- The page cache is version-keyed, so `Cache-Control: public` pages cached for
  offline use are dropped at activation and re-cached on the next online visit;
  offline navigation falls back to `offline.html` meanwhile. The same applies to
  static files that were cached at runtime rather than precached.
- About 530 kB of precache is downloaded again.
- Deployments that do not meet §3 "Deployment consequences" keep their `1.1.0`
  worker until they do.

No migration code is needed.

## 8. Kit version `1.2.0` — canonical technical identity cutover

Authorized by the owner and applied in PR #37 (`1.1.1 → 1.2.0`). `@youge/assistant-sdk` remains `0.2.0`.

- `you-ge-sw.js` becomes the canonical service-worker source (`const VERSION = '1.2.0'`), while `progressier.js` becomes a subpath-safe `importScripts(new URL('you-ge-sw.js', self.location.href).href)` shim verified by `scripts/precache-integrity.mjs`.
- Both `you-ge-sw.js` and `progressier.js` are excluded from worker precaching and runtime cache storage.
- Precached files updated in `1.2.0` (`pwa.css`, `assistant-state.js`, `assistant-widget.js`) roll forward into isolated `…:static:v1.2.0` and `…:pages:v1.2.0` caches while `1.1.1` caches are retired on activation.