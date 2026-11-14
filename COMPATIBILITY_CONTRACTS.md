# Legacy compatibility contracts — You.Ge Assistant

You.Ge Assistant is the sole product identity of this repository. Nothing here
is a Progressier product, and no documentation, example, comment or metadata may
present it as one.

Some identifiers still contain the string `progressier`. They are **not
branding**: each is a technical contract that installed apps, saved browser
data or existing host pages already depend on, inherited from the hosted client
that `staff.you.ge` used before migrating to You.Ge Assistant. Renaming any of
them is a breaking migration and needs explicit owner approval (`AGENTS.md`,
"Permanent You.Ge Assistant Identity Rule").

This file is the authoritative inventory. Update it whenever a contract is
added, removed or migrated.

## 1. Runtime contracts that keep a legacy name

| Identifier | Where | Runtime purpose | Why it must remain | Replacement / migration status |
| --- | --- | --- | --- | --- |
| `/progressier.js` (file `progressier.js`, default of `data-sw`) | `progressier.js`, `pwa.js` (`swUrl`), Pages workflow, docs | URL of the You.Ge Assistant service worker | A browser updates an installed worker in place only when the script URL is unchanged. A new URL registers a second worker and strands the old one with its caches, push subscription and share target. | `data-sw` already lets a **new** integration choose any path. Existing installs have no migration; one would need a tombstone worker at the old URL plus re-registration. Not planned. |
| `window.progressier` | `pwa.js` (shim, created only when undefined) | Alias surface (`install`, `prompt`, `register`, `ready`, `push.*`, `detection.*`, `wording`, badge helpers…) that forwards to `window.PWA` | Host pages written for the hosted client call it directly; removing it throws in their code. | `window.PWA` is the supported API and `window.YouGeAssistant` the SDK; the shim only forwards to them. Removal needs a deprecation release (owner decision). |
| `.progressier-install-button`, `.progressier-subscribe-button` | `pwa.js` scanner, `pwa.css`, `demo/`, `example/` | Declarative install / push-subscribe buttons that the runtime captures, renders and localizes | Existing pages carry this markup; the scanner and stylesheet key on the class. | `[data-pwa-install]` is the You.Ge-named click hook, but it does not render or localize the button. A rendered You.Ge-named alias does not exist yet; adding one is a public API addition that also changes precached `pwa.css` (kit bump). Until then the demo and example use the legacy class and label it as a compatibility selector. |
| `.progressier-install-banner*`, `.progressier-push-banner*`, `.progressier-offline-alert*`, `.progressier-prompt-*`, `.progressier-qr`, `.progressier-widget*`, `.pwa-toolbox.progressier-{left,right,center,top,middle}` | `pwa.js` (generated DOM), `pwa.css` | Class names on the banners, offline alert, reload prompt, QR box and floating toolbox that the runtime renders | Host stylesheets and tests target these classes to restyle or assert the UI. | The toolbox also carries neutral `pwa-toolbox*` classes. The other components have no neutral alias yet. |
| `body[data-progressier-forced-theme="light"]` | `pwa.css` | Host opt-out from the dark-scheme banner button styling | Host pages that set the attribute rely on it. | No alias. `PWA.applyTheme()` covers new integrations. |
| `--progressierBg`, `--progressierElement`, `--progressierTxt`, `--progressierBorderColor`, `--progressierHover`, `--progressierBoxShadow`, `--progressierFont`, `--progressierLetterSpacing`, `--progressierTextFontWeight`, `--progressierHeadingFontWeight`, `--progressierBtnFontWeight`, `--progressierAccent`, `--progressierAccentText`, `--progressierFocus`, `--progressierNote` (15 variables; this is the complete set the runtime reads) | `pwa.css`, `pwa.js` (`PWA.applyTheme`, install-help sheet) | Theme variables of the toolkit UI (banners, modals, toolbox) | Host stylesheets set them on `:root`; renaming silently drops every customization. | `PWA.applyTheme({ background, text, … })` is the name-independent API. The Assistant widget uses `--youge-*` tokens (`THEMING.md`) and rejects `--progressier*` as a foreign namespace. |
| `progressierinstallbanner`, `progressierpushbanner` (+ host + path) | `pwa.js` cookies | Timestamp of the last banner dismissal | Renaming forgets every dismissal and re-shows the banners to users who closed them. | None. A rename would need a read-old/write-new period. |
| `progressierSavedPushNotifications` | `progressier.js`, `pwa.js` (IndexedDB database and store) | Notification history shown by `PWA.getNotifications()` | Existing installs hold their history there; IndexedDB has no rename. | None. A rename would need a copy migration in the worker. |
| `progressiersharedfiles` | `progressier.js`, `pwa.js` (IndexedDB database and store) | Web Share Target payloads handed from the worker to the page | A share in flight during an update would be lost if the page and the worker disagreed on the name. | None. |
| `progressier.app`, `progressier.com` (host strings) | `pwa.js` manifest-link scrub, `scripts/check.mjs`, `scripts/verify-deployment.mjs`, migration steps in `AGENTS.md` / `README.md` | Detects tags left over from the hosted client so they can be replaced or reported | Migrated pages may still contain them; the checks exist to remove them. They are never loaded, linked or recommended. | Remove once no supported deployment can still carry such tags (owner decision). |

## 2. Legacy contracts without the string

These are equally frozen for existing installs; they are listed so that a
string search is not mistaken for the complete picture.

| Identifier | Purpose | Why it must remain |
| --- | --- | --- |
| Manifest `id` `/HIPSBNVemXtM8VMwRfWs` (`manifest.webmanifest`, `domain-registry.js` for `staff.you.ge`) | Install identity of the existing `staff.you.ge` app | Changing `id` creates a second installed app. |
| Protocol handlers `web+pwa` and `web+loldwyhv`, query parameters `pwaprotocolredirect`, `pwaredirect`, `launchedfrom` | Deep links and launch detection | Installed apps and already-issued links use them. |
| `window.PWA`, `PWA.__pwaKit`, `pwa:*` events, `pwakit` IndexedDB, `pwakit:welcome` localStorage, legacy caches `pwa-static-1.0.4` / `pwa-pages-1.0.4` | Public API and storage of the toolkit | Documented API and saved state; the legacy caches are copied in scope and left in place. |
| Worker message `SKIP_WAITING` | Page-initiated activation of a waiting worker | An old page must be able to activate a new worker and vice versa. |

## 3. Non-runtime material that names the legacy client

| Material | Status |
| --- | --- |
| `reference/` (`Script.js`, `Script.decompiled.js`, `progressier.json`, `progressier.decompiled.json`) | Unmodified third-party artifacts kept as parity evidence, never deployed. `scripts/check.mjs` syntax-checks them and compares toolbox CSS markers against them. Retirement or restructuring needs separate owner approval and edits to those checks. |
| `PARITY.md` | Compatibility evidence comparing You.Ge Assistant with the reference bundle. `Progressier*` entries are class names inside that bundle. Same approval rule. |
| `POST_PHASE2_ARCHITECTURE_REVIEW.md` §6–§7 | Point-in-time review of the branding status; kept as a historical record with a superseding note. |
| `CHANGELOG.md`, `*_AUDIT.md`, `PHASE*_PLAN.md` | Historical records. They mention only the technical identifiers above. |
| Git history, merged PR titles | Immutable; not rewritten (no force-push). |

## 4. How to audit

```sh
# Every occurrence in tracked text files, case-insensitive
git grep -nIi progressier

# Distinct tokens outside the third-party reference bundle
git grep -Iohi "[A-Za-z0-9_./+:#-]*progressier[A-Za-z0-9_.-]*" -- . \
  ':!reference/Script.js' ':!reference/Script.decompiled.js' | sort | uniq -c | sort -rn

# Product-name mentions (capitalized) — each must be a rule, provenance note or reference identifier
git grep -n "Progressier" -- . ':!reference/Script.js' ':!reference/Script.decompiled.js'
```

Every token must map to a row above. A capitalized `Progressier` outside
`reference/`, `PARITY.md`, this file, the identity rule in `AGENTS.md` and the
historical records is obsolete branding and must be replaced.
