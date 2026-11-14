# Precache integrity, cache refresh and kit versioning — You.Ge Assistant

How the You.Ge Assistant service worker (`/progressier.js`, a legacy path kept
for update continuity — see [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md))
caches the app shell, how installed apps receive new code, what the
`precache-integrity` gate enforces, and the kit-version change that still needs
owner authorization (§6).

Everything below was verified with deterministic Node tests against the real
worker source. **No real-browser or live-deployment verification was performed.**

## 1. Pipeline

| Step | Source | Notes |
| --- | --- | --- |
| SDK sources → `assistant-state.js` | `npm run sync:sdk` (`scripts/sync-sdk-browser.mjs`) | The only generated precached file. `--check` (part of `npm run check`) fails when it is out of date. |
| Precache list | `precacheUrls()` in `progressier.js` | 13 scope-relative files: `offline.html`, `offline.js`, `offline.css`, `domain-config.js`, `domain-registry.js`, `dns-diagnostics.js`, `assistant-state.js`, `assistant-widget.js`, `assistant-widget.css`, `pwa.css`, `qrcode.js`, the default icon (`icons/icon-192.png` unless the domain registry overrides it) and `icons/icon-512.png`. There is no separate manifest file: the worker is the single source, and the gate reads it by running the install handler. |
| Never cached by the worker | `pwa.js`, `progressier.js` | Always fetched from the network (`fetch` handler returns early). |
| Kit version | `VERSION` in `progressier.js`, `PWA.version` in `pwa.js`, `version` in root `package.json`, `KIT_COMPAT_VERSION` in the SDK | All `1.1.0`. The first three are checked by the gate; `package.json` ↔ `KIT_COMPAT_VERSION` by `packages/assistant-sdk/scripts/validate-package.mjs`. |
| Cache names | `you-ge-assistant:<host>:<scope>:static:v<VERSION>` and `…:pages:v<VERSION>` | Host- and scope-isolated. The **kit version is the only cache-invalidation key.** |
| Deployment | `.github/workflows/pages.yml` | Every push to `main` publishes the runtime to GitHub Pages. |

## 2. Lifecycle

| Phase | Behaviour |
| --- | --- |
| Update detection | The browser installs a new worker when `progressier.js` differs byte for byte (and, per the Service Worker specification, when a script it imports — `domain-registry.js`, `domain-config.js` — differs). `pwa.js` also calls `registration.update()` when the page becomes visible, at most hourly. A change to any other precached file does **not** start an install. |
| `install` | Fetches every precache asset with `cache: 'reload'` (HTTP cache bypassed), and only when all of them are answered stores them in `static:v<VERSION>`. A 4xx is treated as "this deployment does not ship the optional file" and skipped. A network failure or 5xx rejects the install. `skipWaiting()` is never called here. |
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
  replaced in the background, so an online user converges after one extra load
  per file; an offline user, and any file not requested online (for example
  `offline.html`), stays on the old release. This is finding R1.

## 3. Verified behaviour

`tests/service-worker-lifecycle.test.mjs` runs the real worker in a VM with
in-memory Cache Storage and a scripted network
(`tests/support/service-worker-harness.mjs`).

| Requirement | Result |
| --- | --- |
| A new worker receives the current assets | First install stores all 13 assets, every request with `cache: 'reload'`. |
| Existing installs can activate an update | `SKIP_WAITING` calls `skipWaiting()`; activation claims clients. |
| A waiting worker does not replace the current one | No `skipWaiting()` during install; with a new version the active cache is unchanged and still serves the old release offline. |
| Old caches are retired safely | Activation deletes only this host+scope's older caches; four kinds of foreign cache survive. |
| Offline users get updated code after install + activation | With the network down, the updated shell is served from the new cache. |
| Nobody is left with a partial cache | A network failure or 5xx during precache rejects the install; neither the active cache nor the next one is modified. Missing optional files (4xx) do not block installation. |
| Same-version reinstall | Refreshes the live cache completely or not at all. |
| No new worker | Stale-once-then-fresh, and stale offline — the R1 behaviour, kept as an explicit characterization test. |
| `SKIP_WAITING`, `controllerchange`, update notices, reload safeguards | Unchanged; covered by the existing suites `tests/install-experience.test.mjs` and `tests/sdk-integration.test.mjs`. |

## 4. Defect fixed in the worker

Before this change the install handler used `Promise.allSettled()` over
`cache.add()`: any precache failure was swallowed and the install still
succeeded. An update that lost the network halfway through therefore produced an
incomplete `static:v<next>` cache, and activation then deleted the complete
previous one — an offline hole until each missing file happened to be requested
online. With the version unchanged, the same failure left a mix of two releases
in the live cache.

The install now fetches the whole list first and writes only when every asset is
answered (see §2). The update model is otherwise unchanged: same cache names,
same waiting/activation contract, same fetch strategies.

Behaviour change to be aware of: a first install on a connection that drops
mid-precache no longer registers a worker with a partial shell; the browser
retries on the next page load.

## 5. The `precache-integrity` gate

`scripts/precache-integrity.mjs`, run by `scripts/check.mjs` (`npm run check`,
CI step "Static checks and precache integrity gate") and directly with
`npm run check:precache`.

Rules:

1. **Synchronization** — `progressier.js` `VERSION`, `pwa.js` `PWA.version` and
   root `package.json` `version` must exist and be identical.
2. **Existence** — every asset the worker lists must exist (a missing file would
   now be skipped silently at install as a 4xx).
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
  (modified, added, removed, renamed, generated), both versions, why it matters
  and the required owner action.

Not triggered by: documentation, tests, scripts, `pwa.js`, `manifest-handler.js`,
the example, or a worker change that leaves the precache list alone (the browser
already reinstalls a changed worker).

Limits: the gate covers the files the worker precaches. Other static files are
cached only at runtime and refresh by stale-while-revalidate. A default icon
overridden through the domain registry is precached by that host's worker but is
not in the gate's list, which is derived without the registry. The gate
cannot tell a comment-only edit from a behavioural one; any byte change to a
precached file needs a bump.

Applied retroactively, the gate rejects PR #34
(`node scripts/precache-integrity.mjs --base bcdca6e` at `63c703e` reports
`assistant-state.js — modified; generated bundle`).

## 6. Owner decision required — synchronized kit-version bump

**Not applied.** Kit, package and SDK versions, release metadata and tags are
unchanged by this work.

### Current values

| Declaration | Value |
| --- | --- |
| `progressier.js` `VERSION` | `1.1.0` |
| `pwa.js` `PWA.version` | `1.1.0` |
| root `package.json` `version` | `1.1.0` |
| SDK `KIT_COMPAT_VERSION` (`packages/assistant-sdk/src/core/constants.js`, mirrored in generated `assistant-state.js`) | `1.1.0` |
| SDK `SDK_VERSION` / `packages/assistant-sdk/package.json` | `0.2.0` (not part of this proposal) |
| Cache names | `…:static:v1.1.0`, `…:pages:v1.1.0` |

### What has drifted under `1.1.0`

The kit was set to `1.1.0` in `5b1a4a1` (2026-11-07). Since then these precached
files changed with the version unchanged: `assistant-state.js`,
`assistant-widget.js`, `assistant-widget.css`, `dns-diagnostics.js`,
`domain-config.js`, `pwa.css`. The worker script last changed in `575430e`
(2026-11-14 02:18 UTC) and its imported `domain-config.js` in `f528c15`
(03:10 UTC); `dns-diagnostics.js`, `assistant-widget.js` and `assistant-state.js`
changed after both, so no install has been triggered for them.

### Is a one-time refresh needed?

No migration code is needed, and no installation is permanently stuck: online
use converges through stale-while-revalidate. What is missing is a
*deterministic* refresh and a truthful label.

- **This change alone** modifies `progressier.js`. Once deployed (merging to
  `main` publishes to GitHub Pages), browsers install the new worker, which
  re-fetches the complete precache into the existing `v1.1.0` cache. That
  refreshes existing installations in place without a version change. It is a
  side effect of the worker fix, stated here so that merging is an informed
  decision.
- **The bump** is still required to (a) give the drifted asset set its own
  version so `PWA.version` identifies a build again, (b) cut over through new
  cache names, isolated from pages still controlled by the old worker, and
  (c) unblock precached-file edits that the gate now rejects (below).

### Proposed change

Kit `1.1.0` → **`1.1.1`** (patch: cache refresh plus fixes; no kit API is added
by the bump). If the owner prefers the version to reflect the additive Phase 2 /
Stage 5 runtime behaviour, `1.2.0` satisfies the gate equally. One change set:

| File | Change |
| --- | --- |
| `progressier.js` | `const VERSION = '1.1.1';` |
| `pwa.js` | `version: '1.1.1',` |
| `package.json` | `"version": "1.1.1"` |
| `packages/assistant-sdk/src/core/constants.js` | `KIT_COMPAT_VERSION = '1.1.1'` (required by `validate-package.mjs`, which ties it to the root version) |
| `assistant-state.js` | regenerate with `npm run sync:sdk` |
| `tests/example-theme.test.mjs:156`, `packages/assistant-sdk/tests/sdk-core.test.mjs:98` | pinned `1.1.0` expectations |
| `AGENTS.md` ("Current runtime version"), `MULTI_DOMAIN.md` cache-name example, `packages/assistant-sdk/RELEASE.md` and `MIGRATION.md` kit-compatibility lines, `CHANGELOG.md`, §6 of this file | documentation |
| `pwa.css:85`, `pwa.css:99` | the two remaining obsolete-branding comments (see `AGENT_HANDOFF.md`); blocked until the bump because `pwa.css` is precached |

Separate owner question raised by the table: changing `KIT_COMPAT_VERSION` edits
SDK source, and the in-repo SDK already differs from the published
`@youge/assistant-sdk@0.2.0` (Stage 5 changes). Whether and when the SDK gets its
own version and release is not proposed here.

### Cache behaviour of the bump

New caches `…:static:v1.1.1` and `…:pages:v1.1.1` are created at install; on
activation `…:v1.1.0` caches of the same host and scope are deleted. Legacy
shared-name caches are still copied from and left in place.

### Risks to existing installations

- Users see one update notice; the new worker waits until they accept it (or
  `data-auto-update` is set). Until then they keep the complete old shell.
- The page cache is version-keyed, so `Cache-Control: public` pages cached for
  offline use are dropped at activation and re-cached on the next online visit;
  offline navigation falls back to `offline.html` meanwhile. The same applies to
  static files that were cached at runtime rather than precached.
- About 530 kB of precache is downloaded again.
- If any precache request fails with a network error or 5xx, the install is
  retried later and the old version keeps running (§4).

### Tests required for the bump

`npm run check` (includes the gate, which must report
`kit version 1.1.0 → 1.1.1 synchronized`), `npm test`,
`node scripts/sync-sdk-browser.mjs --check`,
`node packages/assistant-sdk/scripts/validate-package.mjs`, example typecheck and
build. The upgrade path itself is already covered version-independently by
`tests/service-worker-lifecycle.test.mjs`. A real-browser check of the update
notice on the deployed site is recommended and has not been done.
