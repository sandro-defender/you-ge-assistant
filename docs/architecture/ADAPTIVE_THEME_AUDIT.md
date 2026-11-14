# Adaptive Theming — Phase 1: architecture audit and implementation plan

> Status: **Phase 1 deliverable** (audit + plan). Everything below was verified
> from the source in this repository, not assumed. Implementation phases 2–7 are
> tracked in the pull request that accompanies this document.

---

## 1. What exists today

### 1.1 Layers

| Layer | File(s) | Styling responsibility |
| --- | --- | --- |
| SDK core (ESM) | `packages/assistant-sdk/src/**` | No DOM styling. Normalizes config, computes state, exposes `appearance` (`position`, `offsets`, `theme`, `themeColor`). |
| Classic state bundle | `assistant-state.js` | **Generated** from `packages/assistant-sdk/src/` by `scripts/sync-sdk-browser.mjs`. Must stay byte-identical (`scripts/check.mjs` + `tests/sdk-integration.test.mjs` gate this). |
| Embedded widget (DOM) | `assistant-widget.js`, `assistant-widget.css` | The only shipped widget renderer. Dependency-free IIFE, no Shadow DOM, no build step, mounted into `document.body` as `#youge-assistant-root.youge-assistant-widget`. |
| React example | `examples/example/src/main.jsx`, `examples/example/example.css`, `examples/example/index.html` | **Second, independent renderer** of the same state: its own markup (`assistant-*` classes) and its own palette (purple/green). It re-implements notices, the FAB and the panel. |
| Toolkit UI | `pwa.css`, `pwa.js` | Install/diagnostics dialogs (`--progressier*` variables, `PWA.applyTheme`). Not part of the assistant widget. |
| Design system | `design-system/you-ge-assistant/MASTER.md` | Reference only: `#2563EB` primary, `#F8FAFC` background, system font stack, no Google Fonts, no glassmorphism, 4.5:1 floor, reduced motion required. |

### 1.2 The current styling architecture (verified)

`assistant-widget.css` (582 lines) is a **single-class-selector cascade** over one
token block:

```
.youge-assistant-widget { --youge-brand, --youge-surface, --youge-surface-soft,
                          --youge-ink, --youge-muted, --youge-line, --youge-critical,
                          --youge-auth, --youge-backup, --youge-install, --youge-info,
                          --youge-focus, --youge-shadow, --youge-fab-*, --youge-offs-* }
.youge-assistant-widget[data-theme="dark"] { …same tokens, dark values… }
@media (prefers-color-scheme: dark) { .youge-assistant-widget[data-theme="auto"] { …dark values… } }
```

and then component rules with **bare class selectors**: `.youge-fab`,
`.youge-panel`, `.youge-btn`, `.youge-notice`, `.youge-badge`, `.youge-close`,
`.youge-chrome-offer`, `.youge-adjust-*`. Specificity is `(0,1,0)` for almost
everything, `(0,2,0)` for the two dark one-offs.

`assistant-widget.js` writes only four things into the DOM itself:
`data-position`, `data-theme` (**only** `auto` | `light` | `dark`),
`--youge-offset-x/y`, `--youge-fab-size`, and — only when
`appearance.themeColor` matches a strict hex regex — `--youge-brand`.
Everything else is static CSS.

Theme modes today are therefore **exactly three**, and the third (`auto`) is
resolved *purely by `prefers-color-scheme`* — the host page is never consulted.

### 1.3 Notifications today

The engine lives in `packages/assistant-sdk/src/assistant/index.js`
(`buildNotifications`) and is driven by `PRIORITY = { critical: 1, auth: 2,
backup: 3, install: 4, info: 5 }`. Each notice carries
`{ id, priority, tone, critical, dismissible, title, message, actionId }`.
Persistence, suppression (`suppressRepeats`), critical persistence
(`criticalPersistent`), acknowledgement and per-project reset
(`lastConditionKeys`) all live there and **must not be rewritten**.

Presentation is priority-based only: `.youge-notice[data-priority="1…4"]`
changes the `border-left` colour; the icon is `priority === 1 ? 'recovery' :
priority === 4 ? 'install' : 'info'`. There is **no** semantic
success/info/warning/error/critical taxonomy, and no per-type background,
title or action treatment — so five visually distinct tiers do not exist yet.

### 1.4 Tests that constrain the work

| File | What it pins |
| --- | --- |
| `tests/assistant-widget.test.mjs` (1224 lines) | VM harness over `assistant-state.js` + `assistant-widget.js`. Pins notification behaviour (persistence/suppression/acknowledge), badge tone rules, `data-theme` fallback for an unsupported theme, exact CSS text patterns (`.youge-assistant-widget {` token block, `.youge-badge[data-tone="auth"] { … color: #ffffff; }`, `[data-theme="dark"]`/`[data-theme="auto"]` badge flips, 44px targets, `--youge-fab-size` tiers, no `@keyframes`, no `animation:`) **and computes WCAG contrast from the token blocks**. |
| `scripts/check.mjs` | Static contracts: `assistant-state.js === buildBrowserStateScript()`, no `fetch`/`register`/`setInterval` in the SDK sources or the widget, widget CSS must keep `position: fixed`, `env(safe-area-inset`, `prefers-reduced-motion`, `min-height: 44px`, `max-width: 480px`. |
| `tests/example-ui.test.mjs` | The React example's FAB tone set must **equal** the widget's; notices must keep the `data-pwa-install` / `data-pwa-diagnostics` hooks. |
| `tests/sdk-integration.test.mjs` | Classic + ESM singletons, single service worker, `assistant-state.js` sync. |
| `packages/assistant-sdk/tests/*` | `getConfig().theme` is a **string** (`'dark'`), published-config security, LKG. |
| `.github/workflows/check.yml` | `example` `npm ci && typecheck && build`, `check.mjs`, `node --check` on every script, SDK tests + `npm pack --dry-run`, root `npm test`. |

## 2. Where host-page CSS actually interferes (verified risk list)

Shadow DOM was evaluated and **rejected** — see §4.

| # | Host CSS pattern | Effect on the widget today | Verified cause |
| --- | --- | --- | --- |
| 1 | `#app * { margin: 0 }`, `#app button { … }` (id-scoped resets) | Beats every `(0,1,0)` widget rule | Component selectors are bare classes |
| 2 | `button { text-transform: uppercase }` | Widget buttons/fabs render uppercase | Widget never declares `text-transform` on `button`-derived nodes; element rules still apply |
| 3 | `button { letter-spacing: .1em; font-weight: 800 }` | Distorted labels, badge count | Not declared on `.youge-fab` / `.youge-badge`; `font: inherit` in `.youge-btn` inherits *through* the root, which declares no `letter-spacing` |
| 4 | `* { line-height: 1.1 }`, `body { word-spacing }` | Cramped notice copy | Root declares `font-family` and `color` only — the rest inherits |
| 5 | `* { box-sizing: content-box }` | 44px targets/panel padding drift | No reset; only `.youge-badge` sets `box-sizing` |
| 6 | `img { max-width: 100% }` / `svg { display: block }` | Brand icon and notice icon sizing | `icon()` sets `aria-hidden` but no reset |
| 7 | `:root { color-scheme: dark }` with a **light** page | Range inputs / focus rings flip; widget tokens stay light | Widget sets `color-scheme` on itself only |
| 8 | `* { text-shadow: … }`, `p { margin: 1em 0 }` | Inherited shadows, doubled spacing | No inheritance boundary |
| 9 | `[data-theme="dark"]` used by **other libraries** (Bootstrap 5.3, Docusaurus, Next themes) | No effect — harmless but unexploited: the host's real scheme is ignored | `auto` reads `prefers-color-scheme` only |
| 10 | `*:focus { outline: none }` | Reduced keyboard affordance | Cannot be defended without `!important`; widget already uses `:focus-visible` + 3px outline |
| 11 | Host `!important` layout rules (`position: static !important`) | Launcher detached / invisible | No `!important` guard on critical layout properties |
| 12 | Global `transition: none !important` | Widget loses transitions (acceptable; reduced-motion parity) | — |

Also relevant: `pwa.js` finds install/diagnostics buttons by **`document.querySelectorAll('[data-pwa-install]')`** and a **`document`-level delegated `click`** handler using `event.target.closest(...)`. Both cross-light-DOM only.

## 3. Public API today

Initialization is **configuration-first**, not an `init()` call:

```js
window.YOU_GE_ASSISTANT_CONFIG = { … };      // before assistant-state.js
// or
YouGeAssistant.attach({ … }, { root });      // ESM / React
assistant.configure({ … });                  // re-apply
```

`theme` is already a documented top-level key with a **string** value
(`auto|light|dark`) and `appearance.theme` mirrors it. `getConfig().theme` is
asserted to be `'dark'` in `packages/assistant-sdk/tests/sdk-config-security.test.mjs`.
Any new design must accept `theme: { mode, inheritHost, tokens }` **and** keep
`theme: 'dark'` working, keep `getConfig().theme` a string, and introduce no
second initialization system.

## 4. Isolation strategy: decision

**Chosen: scoped selectors + CSS custom properties + an explicit inheritance
boundary + a narrow `!important` guard set. No Shadow DOM.**

Why Shadow DOM is rejected, from the source:

1. `pwa.js` resolves install/diagnostics intent with `document.querySelectorAll('[data-pwa-install]')` (line 260) and a document-level delegated `click` → `event.target.closest('[data-pwa-install]')` (lines 3455–3461). Inside a shadow root the target is **retargeted to the host**, so `.closest()` never matches and the widget's Install / Diagnostics buttons silently die. Fixing that means either patching `pwa.js` (touching install behaviour = explicitly forbidden) or duplicating delegation.
2. The documented integration surface exposes the panel by id (`#youge-assistant-panel`) and `YouGeAssistantWidget.getRoot()`. Existing tests (`tests/assistant-widget.test.mjs` lines 625, 774) and host pages rely on both being in the light DOM.
3. `pwa-flow` dialogs are detected with `document.querySelector('.pwa-flow')` for the Escape contract; the widget's own focused-element bookkeeping (`doc.activeElement`) and `focus()` restore path assume one document tree.
4. Accessibility auditing, the `role="status"` live region and host CSS variable inheritance all behave more predictably when the nodes are ordinary light-DOM children.

What we do instead (all additive, no markup identity changes):

- **ID-scoped selectors.** Every component rule is prefixed with
  `#youge-assistant-root` → specificity `(1,1,0)`, which beats host
  element/class resets (`*`, `button`, `.dark button`) and most utility CSS.
- **Explicit inheritance boundary** on the root: `font-family` (token),
  `font-size`, `line-height`, `letter-spacing`, `word-spacing`,
  `text-transform`, `text-align`, `text-indent`, `direction`, `writing-mode`,
  `text-shadow`, `font-style`, `font-weight`, `isolation: isolate`,
  `color-scheme`, `-webkit-font-smoothing`, `visibility`, `pointer-events`,
  plus a `box-sizing: border-box` reset for the subtree.
- **Narrow `!important` guard** on properties that must never be overridden:
  the root's `position`/`z-index`/`display`, the FAB's
  `position`/`display`/`width`/`height`/`pointer-events`, the panel's
  `position`/`display`, and the existing `[hidden]` rules.
- **Tokens stay CSS custom properties** (`--youge-*`), so "custom mode" and
  "host adaptation" are the same mechanism the widget already uses for
  `--youge-fab-size` and `--youge-brand`: JS validates, CSS consumes.
- **No new global rules**: nothing in `assistant-widget.css` targets anything
  outside `#youge-assistant-root` (verified by a new contract test).

## 5. Planned token model

Modes: `auto` (default) · `light` · `dark` · `custom`.

```js
theme: {
  mode: 'auto',              // 'auto' | 'light' | 'dark' | 'custom'
  inheritHost: false,        // opt-in host adaptation (auto defaults to scheme detection only)
  tokens: { primary, onPrimary, background, surface, surfaceSoft, text, mutedText,
            border, focus, fontFamily, radius, shadow,
            success, info, warning, error, critical },
  host: { /* optional explicit host values, same keys, same validation */ },
  variables: { '--youge-anything': 'validated value' }
}
```

- `light`/`dark` never read the host or the OS.
- `auto` resolves the scheme from the host (when `inheritHost`) then
  `prefers-color-scheme`; the Assistant palette is the foundation, only
  *validated, contrast-checked* host values are adopted.
- `custom` requires `tokens`; anything missing or invalid falls back to the
  Assistant default **per token**, never globally.
- Every colour is checked by a strict grammar (`#rgb`/`#rrggbb`/`#rrggbbaa`,
  `rgb()`, `hsl()`, or a whitelisted `var(--youge-*)`), every length is
  clamped, `fontFamily` is restricted to a safe font-stack grammar
  (no `url(`, `;`, `}`, `(`-balanced only), `shadow` to a bounded
  `x y blur rgba(...)` grammar. Anything else → default + warning.
- Contrast guard: if a host/derived text-on-surface pair is below 4.5:1 the
  Assistant's own pair is restored. Button/badge ink is derived from the
  effective fill (WCAG relative luminance), never trusted blindly.

## 6. Notification taxonomy (presentation only)

`level` is added to each notice, derived from the existing `priority`/`id`
by a pure function. **Priorities, ids, suppression, persistence,
acknowledgement and dismissal rules stay untouched** — `level` is additive.

| level | source conditions | treatment |
| --- | --- | --- |
| `critical` | `network:offline`, `dns:failure`, `network:unreachable` | filled tone band, octagon icon, acknowledge only |
| `error` | `api:primary-failed` | strong tint, alert icon, action + dismiss |
| `warning` | `session:issue` | amber tint, triangle icon |
| `info` | `api:backup-active`, `app:update`, features | neutral tint, info icon |
| `success` | `api:primary-restored`, `install:available` | green tint, check icon |

## 7. Phases

1. **Audit + plan** — this document. ✅
2. **Shared theme tokens and configuration** — `src/theme/index.js` (+ `.d.ts`),
   `THEMES`/token constants, `theme` object-or-string config validation,
   `BUNDLED_DEFAULTS`, typed public surface, sync of `assistant-state.js`.
3. **Embedded SDK adaptive theming + CSS isolation** — `assistant-widget.js`
   applies `data-scheme`, tokens and variables; `assistant-widget.css` gets the
   reset/guard layer and scheme blocks; host detection + contrast guard.
4. **Notification theming** — `level` mapping, five visual tiers, icons,
   action/dismiss hierarchy, critical persistence unchanged.
5. **React example** — mode selector, light/dark previews, custom tokens,
   host-adaptation demo, five notification previews, sharing the same tokens.
6. **Tests + documentation** — new `tests/theming.test.mjs`,
   `packages/assistant-sdk/tests/sdk-theme.test.mjs`, `THEMING.md`, SDK README,
   `WIDGET.md`, `docs/guides/snippet.html`, CHANGELOG.
7. **Full CI + final verification report.**

### Invariants for every phase

- No new runtime dependency in the SDK or the widget; no build step.
- No version bump, no publish, no release, no dist-tag.
- `assistant-state.js` stays generated and byte-identical to the SDK sources.
- PWA install/detection, Chrome handoff, notification persistence, service
  worker and event contracts untouched.
- Existing tests keep their assertions; where a selector legitimately changes,
  the assertion is migrated to the new selector and **strengthened**, never
  removed.
