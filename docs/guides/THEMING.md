# Adaptive theming for the embedded Assistant

The Assistant widget keeps one visual identity — You.Ge — and adapts it to four
explicitly configured modes, an optional host-website palette, and five
notification levels. Nothing here changes the notification engine, the state
model, the events or the install/PWA behaviour: theming is presentation applied
to tokens that already existed.

Scope of this document: the public configuration, the resolution rules, the
isolation mechanism, the notification tiers, the test matrix and the known
limitations. The design rationale and the file-by-file audit that preceded the
implementation are in [`../architecture/ADAPTIVE_THEME_AUDIT.md`](../architecture/ADAPTIVE_THEME_AUDIT.md).

---

## 1. Configuration surface

Theme configuration is the existing `theme` key. The 0.x string form still works
and means exactly what it did before:

```js
window.YOU_GE_ASSISTANT_CONFIG = {
  theme: 'auto',            // auto | light | dark  (legacy, unchanged)
};
```

The object form adds host adaptation and custom tokens:

```js
window.YOU_GE_ASSISTANT_CONFIG = {
  theme: {
    mode: 'auto',           // auto | light | dark | custom
    inheritHost: false,     // opt in to reading this page's palette
    tokens: {               // custom / explicit overrides
      primary: '#7c3aed',
      radius: 16,
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    host: {                 // optional explicit host values, no DOM reading
      primary: '#17634f',
      surface: '#ffffff',
    },
    variables: {            // escape hatch for exact CSS custom properties
      '--youge-badge-ink': '#0b1220',
    },
  },
};
```

`configure({ theme })` accepts any of those forms at runtime — this is the same
public method the widget already used, so no second initialization system was
introduced:

```js
YouGeAssistant.attach().configure({ theme: { mode: 'dark' } });
YouGeAssistant.attach().configure({ theme: 'auto' });   // back to the default
```

`getConfig().theme` still returns the **mode string** (the 0.x contract);
`getConfig().themeConfig` returns the validated record. Validation feedback
appears in the pre-existing `meta.warnings` channel, e.g.
`theme.tokens:invalid_token:primary`, `theme:unsupported_mode:neon`,
`theme:contrast_guard:text`. A rejected value never throws and never reaches the
DOM.

### Modes

| Mode | Scheme source | Host values read | Identity |
| --- | --- | --- | --- |
| `auto` (default) | host page + `prefers-color-scheme` | only with `inheritHost: true` | You.Ge palette, adapted per scheme |
| `light` | forced | never | You.Ge light palette |
| `dark` | forced | never | You.Ge dark palette |
| `custom` | `tokens` first, palette fills the rest | only with `inheritHost: true` | You.Ge, overridden per token |

`auto` always *detects* the scheme; `inheritHost` only gates whether host
**values** are used. A host page that is dark gets the Assistant's dark
foundation even with `inheritHost: false`.

### Tokens

| Group | Keys |
| --- | --- |
| Colour | `primary`, `onPrimary`, `background`, `surface`, `surfaceSoft`, `text`, `mutedText`, `border`, `focus`, `success`, `info`, `warning`, `error`, `critical` |
| Non-colour | `fontFamily`, `fontSize` (10–20), `radius` (0–28), `radiusSmall` (0–20), `borderWidth` (0–3), `shadow` |

Lengths accept numbers (treated as px) or px strings and are normalized; colours
must be hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`); `fontFamily` and `shadow`
are length- and character-limited. Everything is validated field by field, so a
bad `radius` costs you the radius, not the theme.

### Host adaptation

`inheritHost: true` (or an explicit `host: {...}` map) reads **only** the
allowlisted tokens: accent, background, surface, text, muted text, border, font
family, radius and any `--youge-*` custom property the integrator supplies. It
never inherits layout, positioning, z-index, offsets, launcher size or motion.

Reading is defensive: a computed value is only accepted if it parses as a valid
token, and every inherited colour passes a contrast guard against the resolved
surface. A host that reports a 1.2:1 body colour gets the Assistant's own
readable ink plus a `theme:contrast_guard:text` warning instead of an unusable
widget. A brand colour that is too dark for a dark surface falls back to the
dark-adapted brand (`theme:contrast_guard:seedPrimary`).

---

## 2. Architecture

```
packages/assistant-sdk/src/theme/index.js      ← one dependency-free resolver
        │  normalizeTheme → resolveTheme → themeToCssVariables
        ├── assistant-state.js  (bundled browser copy, generated)
        ├── assistant-widget.js (classic DOM renderer)
        └── examples/example/src/*.jsx   (React renderer, via /react adapter)
```

* **One resolver, no parallel implementations.** The React example calls
  `resolveAppearanceTheme()` from `@youge/assistant-sdk/react`, which is a thin
  wrapper over the same `resolveTheme` the DOM widget uses. Custom-property
  names, defaults, contrast rules and warning codes therefore cannot drift.
* **Pure module.** `resolveTheme(theme, { document, matchMedia, root,
  hostScheme, seedPrimary })` receives its environment explicitly, so it is
  SSR-safe and unit-testable without a browser.
* **Presentation only.** The resolver returns tokens and `--youge-*` variables.
  The renderers write variables and three data attributes:
  `data-theme` (mode), `data-scheme` (`light | dark`) and `data-theme-inherit`.
* **Notification levels are metadata, not engine.** `NOTIFICATION_LEVELS`,
  `NOTIFICATION_LEVEL_SHAPES`, `NOTIFICATION_LEVEL_ICONS`,
  `NOTIFICATION_LEVEL_LABELS` and `normalizeNotificationLevel()` live next to the
  tokens. `level` is a presentation field derived from the unchanged priority
  ladder; priority, dismissal, acknowledgement, persistence and the emitted
  events are untouched.

### Why not Shadow DOM

Audited and rejected. Shadow DOM would have broken more than it fixed here:

* service-worker/PWA install prompts and diagnostics are delegated to page-level
  `pwa.js` through `[data-pwa-install]` / `[data-pwa-diagnostics]` lookups that
  host code and tests query in the light DOM;
* the widget publishes `youge:action` CustomEvents and is styled by integrators
  who target `.youge-*` classes; encapsulation would hide both;
* focus and `aria-live` announcements inside a shadow root have a long tail of
  assistive-technology inconsistencies;
* the existing public CSS custom properties (`--youge-brand` etc.) are a
  documented integration surface.

CSS isolation is therefore achieved in four light-DOM layers:

1. **Narrow layout guard** — `#youge-assistant-root` pins
   `position / display / z-index / visibility / pointer-events` with
   `!important`, plus a matching `[hidden]` rule so the `display: block
   !important` guard cannot defeat the widget's own hidden switch.
2. **Inheritance boundary** — the root sets private `--youge-reset-*` values and
   one descendant rule consumes them for `box-sizing`, `font`,
   `letter-spacing`, `text-transform`, `line-height`, `list-style` and
   `background-image`.
3. **Subtree reset** — `img`, `svg`, buttons and other native controls are
   normalized inside the widget only.
4. **Scoped selectors only** — every rule starts with `.youge-`,
   `.youge-assistant-widget` or `#youge-assistant-root`. No universal selector,
   no `:root`, no `!important` in the reset (the reset must stay beatable by the
   widget's own rules).

---

## 3. Notification theming

Five levels, one component: `critical`, `error`, `warning`, `info`, `success`.
The level is derived from the priority ladder
(`PRIORITY_LEVEL = {1: critical, 2: warning, 3: info, 4: success, 5: info}`) and
overridable per notice; it never changes ordering or suppression.

| Level | Stripe | Icon | Actions |
| --- | --- | --- | --- |
| `critical` | 4px, error colour, heavier title | octagon with exclamation | Acknowledge (persistent) |
| `error` | 4px | circle with exclamation | primary action + Dismiss |
| `warning` | 3px | triangle with exclamation | primary action + Dismiss |
| `info` | 3px | circle with `i` | primary action + Dismiss |
| `success` | 3px | circle with check | primary action + Dismiss |

Severity never depends on colour alone: stripe width, glyph shape and title
weight differ too. Glyph geometry is defined once as declarative shapes and
consumed twice — `notificationLevelMarkup()` for the DOM widget,
`notificationLevelElement(level, createElement)` for React, so the example never
injects HTML (`dangerouslySetInnerHTML` appears nowhere in the example).

Themes provide `--youge-success/warning/error/critical` fills plus derived
`*-ink` label inks (never trusted: a fill only keeps a white label when it
clears the AA floor). Critical notices keep their engine-level persistence and
acknowledgement behaviour.

---

## 4. Try it

* `examples/demo/index.html` — **Assistant theme** section: Auto / Light / Dark / Custom,
  “Follow this page”, and an intentionally invalid palette that shows the warning
  channel.
* `examples/example/` (React) — **One Assistant, four modes** studio: mode selection,
  light/dark/live previews, two custom palettes, four authored host websites
  (including a low-contrast trap), a contrast audit table and a gallery of all
  five notification levels. Every preview is painted from the same
  `--youge-*` variables as the shipped widget.

---

## 5. Tests

| Suite | Covers |
| --- | --- |
| `packages/assistant-sdk/tests/sdk-theme.test.mjs` (35) | modes, token validation, ranges, contrast guards, host detection, level metadata/shapes/markup |
| `tests/widget-theming.test.mjs` (27) | DOM behaviour under a fake document: attributes, variable writes, injection guards, per-level notices, CSS isolation literals, back-compat |
| `tests/assistant-widget.test.mjs` (47) | unchanged widget contracts plus the resolver path and the hidden switch |
| `tests/example-theme.test.mjs` (11) | the example demonstrates all four modes, host adaptation, five levels, a11y and adds no dependency |
| `scripts/check.mjs` | ~20 new static contracts (exports, typings, isolation, level CSS, example usage) |
| `tests/example-ui.test.mjs` (9) | unchanged FAB/handoff/accessibility contracts |

Run everything with `npm run check` (static contracts + package validation + all
unit suites).

---

## 6. Compatibility and limitations

Unchanged on purpose:

* package versions are bumped only by the release commit (`1.1.0` kit,
  `0.2.0` SDK); nothing is published, released or dist-tagged by this work;
* zero runtime dependencies in the SDK and the embedded bundle;
* existing public API, `data-*` hooks, events, service worker, install/detection
  flow and the Android in-app-browser → Chrome handoff;
* `theme` as a string, and every existing CSS custom property;
* notification engine behaviour (priority, suppression, persistence, ack/dismiss).

Limits worth knowing:

* The resolver validates and normalizes; it does not police taste. A palette
  that passes the AA guard can still look unlike the rest of your product.
* Host adaptation reads the allowlisted tokens from the host page; if the host
  paints its palette on an ancestor via an image or gradient, only the explicit
  `host` map or `tokens` will reproduce it.
* `color-mix()` is used only on the notification icon tile, because older in-app
  Android webviews cannot be assumed to support it; notice tints use plain
  tokens.
* No headless browser is available in this environment, so visual verification
  is CSS-literal and unit-level; real-device screenshots remain an acceptance
  check.
