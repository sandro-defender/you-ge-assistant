# Canonical Technical Identity & Legacy Migration Contracts — You.Ge Assistant

**You.Ge Assistant** is the sole product and canonical technical identity of this
repository across every runtime, CSS, storage, event, query-parameter, manifest,
service-worker, SDK, and CI surface.

As of **kit `1.2.0`** (2026-11-14), all technical surfaces expose canonical
You.Ge Assistant identifiers (`you-ge-sw.js`, `window.YouGePWA`, `--youge-pwa-*`,
`.youge-*`, `you-ge-*` IndexedDB databases, `youge_*` cookies, `youge:pwa:*`
events, `[data-youge-*]` hooks, `?youge-*` query parameters, and `web+youge`
protocol handlers).

Any remaining `progressier*` or pre-migration `pwa*` technical identifiers are
**temporary migration compatibility only — never permanent contracts** (with
explicit domain-pinned install-ID protection noted in §2). New features, demos,
examples, documentation, and host integrations must target the canonical You.Ge
Assistant identifiers exclusively.

---

## 1. Canonical Technical Surfaces & Temporary Migration Mechanisms

| Technical surface | Canonical You.Ge Assistant identifier(s) | Temporary legacy alias(es) | Compatibility & upgrade mechanism |
| --- | --- | --- | --- |
| **1. Global objects & SDK bridge** | `window.YouGePWA` (`__youGePwaKit: true`), `window.YouGeAssistant`, `@youge/assistant-sdk`, `window.YouGeDomain`, `window.YouGeDns`, `window.YouGeManifestHandler` | `window.PWA` (`__pwaKit: true`), `window.progressier` | `pwa.js` exports `window.YouGePWA = window.PWA = PWA` and defines the deprecated `window.progressier` forwarding shim only when absent. `@youge/assistant-sdk` (`adapters/pwa-kit.js`, `assistant/index.js`) and `assistant-widget.js` resolve `root.YouGePWA \|\| root.PWA`. |
| **2. Script filenames & public asset paths** | `/you-ge-sw.js` (service worker), `/pwa.js`, `/pwa.css`, `/assistant-state.js`, `/assistant-widget.js`, `/assistant-widget.css`, `/domain-config.js`, `/domain-registry.js`, `/dns-diagnostics.js`, `/offline.{html,css,js}` | `/progressier.js` | `you-ge-sw.js` is the canonical service worker (`VERSION = '1.2.0'`). `progressier.js` is a 15-line subpath-safe `importScripts(new URL('you-ge-sw.js', self.location.href).href)` shim. Both `/you-ge-sw.js` and `/progressier.js` (plus `pwa.js` and `sw.js`) are excluded from runtime caching. |
| **3. Service worker registration & cutover** | `data-sw="/you-ge-sw.js"` (clean canonical default whenever `data-sw` is omitted) | Explicit `data-sw="/progressier.js"` (supported via shim) | Clean canonical cutover: fresh and default registrations always register `you-ge-sw.js` (resolved relative to `pwa.js`, so root and subpath deployments work identically). `pwa.js` does **not** probe `getRegistration()` to preserve legacy `/progressier.js` registrations. Explicit `data-sw="/progressier.js"` remains supported through the `progressier.js` `importScripts` shim during the `1.x` compatibility period. |
| **4. CSS custom properties** | 15 `--youge-pwa-*` variables on `:root`: `--youge-pwa-bg`, `--youge-pwa-text`, `--youge-pwa-font`, `--youge-pwa-text-weight`, `--youge-pwa-btn-weight`, `--youge-pwa-heading-weight`, `--youge-pwa-letter-spacing`, `--youge-pwa-hover`, `--youge-pwa-element`, `--youge-pwa-border`, `--youge-pwa-shadow`, `--youge-pwa-accent`, `--youge-pwa-accent-text`, `--youge-pwa-focus`, `--youge-pwa-note` (distinct from widget `--youge-*` tokens in `THEMING.md`) | `--progressierBg`, `--progressierTxt`, `--progressierFont`, `--progressierTextFontWeight`, `--progressierBtnFontWeight`, `--progressierHeadingFontWeight`, `--progressierLetterSpacing`, `--progressierHover`, `--progressierElement`, `--progressierBorderColor`, `--progressierBoxShadow`, `--progressierAccent`, `--progressierAccentText`, `--progressierFocus`, `--progressierNote` | `pwa.css` defines `:root { --youge-pwa-*: var(--progressier*, <default>); }` so legacy `:root` overrides continue cascading automatically while canonical `--youge-pwa-*` overrides win directly. `YouGePWA.applyTheme()` dual-writes both variable sets; `qrPalette()` and `showHelp()` read `--youge-pwa-*` first with `--progressier*` fallback. |
| **5. CSS selectors & forced-theme attribute** | `.youge-install-button`, `.youge-subscribe-button`, `.youge-install-banner*`, `.youge-push-banner*`, `.youge-offline-alert*`, `.youge-prompt-{overlay,reload-button}`, `.youge-qr`, `.youge-toolbox*`, `.youge-pos-{left,right,center,top,middle}`, `body[data-youge-pwa-forced-theme="light"]`, `.youge-hide-{standalone,installed}` | `.progressier-install-button`, `.progressier-subscribe-button`, `.progressier-install-banner*`, `.progressier-push-banner*`, `.progressier-offline-alert*`, `.progressier-prompt-*`, `.progressier-qr`, `.progressier-widget*`, `.pwa-toolbox.progressier-{left,right,center,top,middle}`, `body[data-progressier-forced-theme="light"]`, `.pwa-hide-{standalone,installed}` | `scanButtons()` scans both canonical and legacy button selectors. Runtime UI builders attach both canonical `.youge-*` and legacy `.progressier-*` classes; `pwa.css` groups canonical and legacy selectors on every rule. `demo/` and `example/` use `.youge-install-button`. |
| **6. Cookies, IndexedDB, `localStorage`, and Cache Storage** | Cookies: `youge_install_banner_`, `youge_push_banner_` (+ host + path)<br>IndexedDB: `you-ge-shared-files` (`shared-files`), `you-ge-notifications` (`notifications`), `you-ge-pwa-meta` (`meta`)<br>`localStorage`: `youge-pwa:welcome`<br>Caches: `you-ge-assistant:<host>:<scope>:{static,pages}:v<VERSION>` | Cookies: `progressierinstallbanner`, `progressierpushbanner`<br>IndexedDB: `progressiersharedfiles`, `progressierSavedPushNotifications`, `pwakit` (`meta`)<br>`localStorage`: `pwakit:welcome`<br>Caches: `pwa-static-1.0.4`, `pwa-pages-1.0.4` | **Cookies & `localStorage`:** read canonical first, promote valid legacy dismissals to canonical on read, and dual-write canonical + legacy on dismissal so downgrading to `1.1.1` never re-prompts users.<br>**IndexedDB:** worker inspects `indexedDB.databases()` when supported so clean installs never create legacy DBs; copies missing records by `id` into canonical stores without overwriting canonical read/click mutations; retains legacy DBs non-destructively for rollback. `pwa.js` `consumeSharedFile()` reads canonical `you-ge-shared-files` first and falls back to `progressiersharedfiles` for in-flight shares. |
| **7. Events, worker messages, attributes, URL params, and manifest** | Events: `youge:pwa:{ready,installable,installed,update,share,diagnostics,event}`<br>Worker message: `YOUGE_CONFIG` (`SKIP_WAITING` retained standard)<br>Attributes: `[data-youge-{install,diagnostics,qr,hide-standalone,show-standalone,toolbox}]`<br>Query params: `?youge-install=1`, `?youge-protocol-redirect=`, `?youge-redirect=`<br>Manifest: `"id": "/"` (generic root fallback), `web+youge`, `web+pwa` | Events: `pwa:{ready,installable,installed,update,share,diagnostics,event}`<br>Worker message: `PWA_CONFIG`<br>Attributes: `[data-pwa-*]`<br>Query params: `?pswutlzoq=install`, `?pwaprotocolredirect=`, `?pwaredirect=`<br>Manifest protocol: `web+loldwyhv` | `dispatch()` emits `youge:pwa:<name>` then `pwa:<name>` tagged with `__youGeBridged = true`; `@youge/assistant-sdk` binds both and ignores bridged `pwa:*` events to prevent double emissions. Worker accepts both `YOUGE_CONFIG` and `PWA_CONFIG`. Generic `manifest.webmanifest` uses canonical `"id": "/"` (static-only legacy hosts that relied on `/HIPSBNVemXtM8VMwRfWs` without `domain-registry.js` must pin their existing `id` in their deployed manifest). |

---

## 2. Domain-Pinned Install Identity Exception (`staff.you.ge`)

| Identifier | Where | Reason it remains | Policy |
| --- | --- | --- | --- |
| `id: '/HIPSBNVemXtM8VMwRfWs'` | `domain-registry.js` (`'staff.you.ge'` entry only) | Browsers key installed PWAs by `(origin, manifest.id)`. Changing `id` on `staff.you.ge` would cause installed users to see a duplicate app icon instead of updating in place. | Scoped strictly to the `'staff.you.ge'` host entry in `domain-registry.js`. Generic fallback `manifest.webmanifest` and all new domains use canonical `"id": "/"` (or their own route path). Retire on `staff.you.ge` only if the project owner explicitly authorizes a re-install migration for `staff.you.ge`. |

---

## 3. Intentionally Retained Non-Contract Legacy References

| Reference | Location | Why it remains |
| --- | --- | --- |
| `progressier.app`, `progressier.com` host checks | `pwa.js` (leftover `<link rel="manifest">` scrubber), `scripts/check.mjs`, `scripts/verify-deployment.mjs` | Defensive migration hygiene: detects and strips/flags leftover third-party hosted tags on migrated pages. Never loaded, linked, or recommended. |
| `reference/` (`Script.js`, `Script.decompiled.js`, `progressier.json`, `progressier.decompiled.json`) | `reference/` (never deployed), `scripts/check.mjs` §3 & toolbox sizing parity check | Frozen third-party parity archive kept for historical verification. Requires separate owner approval to retire. |
| `PARITY.md`, `ARCHITECTURE_AUDIT.md`, `FOUNDATION_AUDIT.md`, `POST_PHASE2_ARCHITECTURE_REVIEW.md`, `PHASE*_PLAN.md`, `CHANGELOG.md` | Repository root markdown | Point-in-time historical engineering records and parity matrices. Preserved as immutable historical context rather than rewritten retroactively. |

---

## 4. Legacy Compatibility Period & Concrete Removal Policy

All temporary `progressier*` shims, selectors, CSS variables, storage fallbacks,
and query/protocol aliases are governed by the following two-horizon deprecation
and removal schedule:

### Compatibility Period

- **Minimum compatibility window:** **12 months** from the kit `1.2.0` migration
  date (**2026-11-14 → not earlier than 2027-11-14**) **and** at least **two
  minor kit releases** (`1.2.x` and `1.3.x`), targeting **kit `2.0.0`** as the
  earliest breaking removal release.
- During `1.x`, all compatibility shims remain active, tested in
  `tests/identity-migration.test.mjs`, and non-destructive to legacy storage so
  any deployment can roll back cleanly within `1.x`.

### Concrete Staged Removal Policy

1. **Stage A — Active Compatibility Window (`1.2.0`, current):**
   - Clean canonical cutover: You.Ge Assistant identifiers (`you-ge-sw.js`,
     `window.YouGePWA`, `--youge-pwa-*`, `.youge-*`, `youge:pwa:*`,
     `you-ge-*` stores, `youge_*` cookies) are default everywhere.
   - Legacy surfaces dual-read, promote on read, dual-write cookies/`localStorage`
     for rollback safety, and keep `progressier.js` available as a thin
     `importScripts('you-ge-sw.js')` shim for explicit `data-sw="/progressier.js"`
     compatibility.
   - New code, docs, snippets, and examples use only canonical identifiers.
2. **Stage B — Deprecation Telemetry & Console Warnings (`>= 1.3.0`, >= 6 months after `1.2.0`):**
   - Emit a one-time `console.warn` (when `data-debug` is enabled, or once per
     session on localhost) whenever a host page invokes `window.progressier`,
     relies on `.progressier-*` buttons, sets `--progressier*` variables without
     `--youge-pwa-*`, sets `data-sw="/progressier.js"`, or uses
     `?pswutlzoq=install` / `web+loldwyhv`.
   - Stop mirroring writes to legacy banner cookies (`progressierinstallbanner`,
     `progressierpushbanner`) and `pwakit:welcome` once rollback to `1.1.1` is
     no longer supported, while keeping legacy reads active through the end of
     `1.x`.
3. **Stage C — Pre-Removal Verification Gates (required before `2.0.0`):**
   - Owner sign-off confirming either (a) all managed deployments have served
     `>= 1.2.0` through a full 12-month active cycle so active users have
     promoted cookies/`localStorage` and migrated IndexedDB stores, or (b)
     explicit re-prompt/history reset is accepted for dormant >12-month clients.
   - Repository and downstream host search (`git grep -Ii progressier`) confirms
     zero host templates still reference `window.progressier`, `.progressier-*`,
     `--progressier*`, or `data-sw="/progressier.js"`.
4. **Stage D — Removal Execution (`2.0.0`, >= 2027-11-14, owner-authorized major bump):**
   - Remove `window.progressier`, `.progressier-*` selectors, `--progressier*`
     CSS variable fallbacks, `progressierinstallbanner` / `progressierpushbanner`
     cookie reads, `progressiersharedfiles` / `progressierSavedPushNotifications`
     IndexedDB migration code, `?pswutlzoq=install`, `?pwaprotocolredirect`,
     and `web+loldwyhv`.
   - **Service worker retirement safety:** Keep `/progressier.js` for **one
     final `2.0.x` transitional release** as a minimal self-unregistering or
     pass-through worker (or HTTP 301/tombstone per hosting capabilities) only
     if any deployment has not yet switched to `/you-ge-sw.js`; never return
     HTTP 404 for `/progressier.js` while browsers are still polling it for
     updates. Once active registrations are on `/you-ge-sw.js`, delete
     `progressier.js` from the repository and deployment artifacts.

---

## 5. Audit Commands

```sh
# 1. Every occurrence in tracked files outside frozen third-party reference artifacts
git grep -nIi progressier -- . ':!reference/*'

# 2. Distinct legacy tokens in runtime code and stylesheets
git grep -Iohi "[A-Za-z0-9_./+:#-]*progressier[A-Za-z0-9_.-]*" -- \
  pwa.js you-ge-sw.js progressier.js pwa.css manifest.webmanifest \
  packages/assistant-sdk/src assistant-state.js assistant-widget.js | sort | uniq -c | sort -rn

# 3. Verify canonical migration test suite and full repository gates
node --test tests/identity-migration.test.mjs
npm run check
```

Every runtime match from command (2) must map to a temporary migration row in
§1–§3 above. Any unmapped occurrence is regression drift and must be removed.
