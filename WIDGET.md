# Intelligent Floating Assistant

The Intelligent Floating Assistant is a **core You.Ge Assistant product
feature**, not dashboard decoration. It is a reusable, context-aware widget
that lives on every participating page once the SDK configuration is
initialized. After initialization it does not contact a management dashboard,
publish configuration, or depend on a remote service.

This document describes the implementation in this repository. It is the
companion to [`ASSISTANT_ARCHITECTURE.md`](ASSISTANT_ARCHITECTURE.md),
[`INSTALLATION_EXPERIENCE.md`](INSTALLATION_EXPERIENCE.md) and
[`DESIGN_FOUNDATION.md`](DESIGN_FOUNDATION.md).

---

## 1. Architecture

```
project HTML
  └─ window.YOU_GE_ASSISTANT_CONFIG (data only, set before scripts)
       └─ assistant-state.js  ── window.YouGeAssistant
            ▲        ▲        ▲
            │        │        │
     PWA events  project events  browser events
            │        │        │
            └── prioritized snapshot ──┬─ assistant-widget.js  (dependency-free DOM renderer)
                                       └─ React renderer in example/src/main.jsx (React Bits)
```

- **`assistant-state.js`** is the single source of truth. It owns project
  identity, install capability/status, network/DNS/endpoint/session status,
  available actions, notification priority, badge, appearance and
  dismissed/acknowledged state. It exposes a stable snapshot through
  `getState()` / `subscribe()`.
- **`assistant-widget.js`** and **`example/src/main.jsx`** are thin renderers.
  They never compute conditions, never call `fetch()`, never register a service
  worker, never poll, and never auto-open. They only render the snapshot and
  publish user intents.
- **`pwa.js` remains intact.** Installation still uses the captured
  `beforeinstallprompt` event, `promptInstall()`, `appinstalled`, iOS/generic
  help sheets and the existing `[data-pwa-install]` / `[data-pwa-diagnostics]`
  delegation. The widget annotates its actions with those attributes rather
  than requesting the same native prompt twice.
- **`you-ge-sw.js` remains the single service worker** (with `/progressier.js`
  delegating to it as a compatibility shim). The widget files are precached
  alongside the offline shell; no second registration is added.

### Files

| File | Role |
| --- | --- |
| `packages/assistant-sdk/` | Canonical framework-independent ESM SDK core (`@youge/assistant-sdk`), TypeScript declarations (`*.d.ts`) and optional `./react` external-store adapter. |
| `assistant-state.js` | Classic browser state script synchronized deterministically from `packages/assistant-sdk/src/` via `npm run sync:sdk` (`window.YouGeAssistant`). |
| `assistant-widget.js` | Dependency-free DOM renderer for any configured page. |
| `assistant-widget.css` | Fixed placement, safe areas, responsive panel, badges, reduced motion. |
| `example/src/main.jsx` | React renderer using `useSyncExternalStore` and vendored React Bits. |
| `example/example.css` | React renderer styles and React Bits local adaptations. |
| `snippet.html` | Copy-paste integration block including SDK configuration. |
| `demo/index.html`, `example/index.html`, `offline.html` | Participating pages. |
| `tests/assistant-widget.test.mjs` | 24 behavioral/static tests for the widget contract. |
| `scripts/check.mjs` §7c | Static integration and safety contracts. |

---

## 2. Centralized state

`window.YouGeAssistant.getState()` returns one stable, JSON-serializable object.
Its reference changes only when an event produces a new snapshot, which makes it
safe for `useSyncExternalStore` and avoids duplicate renders.

```js
{
  enabled: true,
  project: { id, name, shortName, icon, themeColor, hostname, origin, basePath, configured },
  installation: { support, status, canInstall, installed, standalone, ios, safari, platform, nativeAvailable },
  network: {
    online, dns: { status, classification, message, checkedAt },
    endpoints: { primary, backup, active, reason },
    session: { state, message }, updateAvailable, recovery
  },
  capabilities: { installation, diagnostics, recovery, failover, help, updates },
  notifications: [{ id, priority, tone, critical, dismissible, title, message, actionId }],
  availableActions: [{ id, label, icon, priority, kind, message, event }],
  badge: { count, tone, label, priority },
  appearance: { position, offsets: { x, y }, theme, themeColor },
  dismissed: [], acknowledged: []
}
```

`support` is one of `native`, `manual-ios`, `manual-generic`, `installed` or
`none`. A browser without a native prompt still gets manual instructions only
when the install module and `pwa.js` are available; installed apps and disabled
projects get `installed` / `none` and **no install suggestion**.

### Priority ladder

| Priority | Condition | Tone | Dismissible |
| --- | --- | --- | --- |
| 1 | Critical connectivity / DNS / primary API recovery | `critical` | No — acknowledge or resolve |
| 2 | Auth / session issue | `auth` | Yes |
| 3 | Backup endpoint active | `backup` | Yes |
| 4 | PWA installation available | `install` | Yes |
| 5 | Optional info, new features, updates, primary-restored | `info` | Yes |

The badge takes the tone and label of the highest-priority visible notice. It
is hidden when there are no alerts, but the floating entry point remains.

### Real-condition sources

| Condition | Source |
| --- | --- |
| Installable / installed / iOS / Safari | `PWA.getState()`, `PWA.onChange()`, `PWA.canInstall()`, `PWA.isInstalled()`, `pwa:installable`, `pwa:installed`. |
| Online / offline | `online` / `offline` browser events. |
| DNS diagnostics | `pwa:diagnostics` from the existing dialog, `youge:dns-result`, or `offline.js` diagnostics. |
| Primary / backup / recovery | `youge:endpoint-status` published by the project, or `setEndpointStatus()`. |
| Auth / session | `youge:session-status` published by the project, or `setSessionStatus()`. |
| Update | `pwa:update`, or `setEndpointStatus()` after backup→primary recovery. |
| New features / project help | Data-only `features` / `actions` configuration. |

The Assistant **publishes and consumes status**; it does not invent endpoint
health. It never probes the primary API in the background, never replays writes,
and never treats hostname detection as authentication. DNS classifications are
cautious: a DoH result is not proof of an ISP problem.

---

## 3. Event-driven lifecycle

Listeners are bound once in `bindOnce()`:

- `online`, `offline`, `storage`
- `visibilitychange` (re-reads PWA state; no request)
- `youge:endpoint-status`, `youge:session-status`, `youge:dns-result`
- `pwa:installable`, `pwa:installed`, `pwa:update`, `pwa:diagnostics`
- `PWA.onChange()`

`destroy()` removes every listener and the PWA subscription. `configure()` never
re-binds listeners. There is no `setInterval`, no `fetch`, and no
`serviceWorker.register` in the widget runtime. `runDiagnostics()` is
single-flight: concurrent calls share one promise and one delegated check.

Dismissed non-critical notices are stored per project under
`youge-assistant:notices:<projectId>` in `localStorage`, so navigation and
multi-page use do not repeat them. Critical notices cannot be dismissed; they
can be acknowledged, and suppression is cleared when the underlying condition
resolves so a later recurrence is visible again.

---

## 4. Configurable SDK interface

Set `window.YOU_GE_ASSISTANT_CONFIG` **before** `assistant-state.js` executes.
Only local SDK configuration may contain a `services.diagnostics` function;
remote/versioned configuration must remain data-only and secret-free.

```js
window.YOU_GE_ASSISTANT_CONFIG = {
  enabled: true,
  projectId: 'staff-space',
  position: 'bottom-right',          // bottom-right | bottom-left | top-right | top-left
  offsets: { x: 20, y: 20 },         // CSS px, combined with safe-area insets
  branding: { name, shortName, icon, themeColor }, // icon must be same-origin
  theme: 'auto',                     // auto | light | dark (legacy string form)
  // …or the object form (see THEMING.md):
  // theme: { mode: 'auto' | 'light' | 'dark' | 'custom', inheritHost: false,
  //          tokens: { primary, radius, … }, host: { … }, variables: { … } },
  modules: { installation, diagnostics, recovery, failover, help, updates, chromeHandoff },
  notifications: { dismissible, suppressRepeats, criticalPersistent },
  actions: [{ id, label, icon, priority, kind, message }],
  features: [{ id, label, message }],
  // optional local-only service:
  // services: { diagnostics: () => Promise.resolve(result) }
};
```

Public API:

| Method | Purpose |
| --- | --- |
| `configure(options)` | Re-apply project/widget config; does not re-bind listeners. |
| `getState()` | Stable snapshot. |
| `subscribe(listener)` | Event-driven updates; returns unsubscribe. |
| `setEndpointStatus(detail)` | Publish primary/backup/failover status. |
| `setSessionStatus(detail)` | Publish auth/session condition. |
| `setDnsResult(result)` | Publish a DNS/diagnostics result. |
| `runDiagnostics()` | On-demand, single-flight check. |
| `requestInstall()` | Delegate to `PWA.promptInstall()` when available. |
| `dismiss(id)` / `acknowledge(id)` | Suppression controls. |
| `destroy()` | Cleanup. |

`getConfig().theme` returns the mode string (unchanged 0.x contract);
`getConfig().themeConfig` returns the validated theme record and
`getConfig().meta.warnings` reports rejected values. See
[`THEMING.md`](THEMING.md) for the four modes, host adaptation, tokens,
isolation layers and notification tiers.

Project-specific actions are rendered from `availableActions` and publish a
`youge:action` CustomEvent on `document` with `{ id, kind, source }`. The host
application listens for that event and owns the business logic. Built-in
`install` and `diagnostics` actions instead delegate to `pwa.js`, preventing
duplicate prompts and duplicate network checks.

---

## 5. Interaction and UX

- Persistent fixed floating button on every configured page; visible with zero
  alerts; configurable position/offsets keep it clear of critical app controls.
  The playground uses `bottom-left` to avoid the existing install toolbox.
- Click opens a responsive in-place panel. No separate page, no new tab, no
  auto-open. Escape and a labelled close button dismiss it; focus returns to
  the launcher. While a toolkit dialog is open on top of the panel
  (`[data-pwa-flow]`, `.pwa-flow`) the panel leaves Escape to that dialog, so
  one keypress never closes two layers at once.
- The panel shows identity/branding, connection status, prioritized notices,
  installation assistance, network diagnostics, recovery guidance and
  app-specific help. Notice actions reuse the toolkit's delegated hooks
  (`data-pwa-install`, `data-pwa-diagnostics`) and carry the action's own
  wording, so a notice button performs the same flow as the section below it
  instead of being an inert label.
- Subtle count/tone badge, never a flashing decoration. A visually hidden
  `role="status" aria-live="polite"` region announces a complete contextual
  phrase without moving focus.
- **Android Chrome handoff offer (0.1.1):** on a confident restricted in-app
  detection (Facebook / Messenger / Instagram / Android WebView on Android —
  via `YouGeAssistantSDK.createChromeHandoff`) the widget shows an *Open in
  Chrome* region above the launcher with a three-step manual fallback carrying
  the original URL (pathname + query + hash). Best-effort `intent://` only —
  supported browsers, iOS in-apps and uncertain user agents render nothing,
  nothing navigates without the explicit button press, dismissal persists per
  origin (`youge-assistant:chrome-offer-dismissed`), and the offer hides while
  the panel is open.
- Auto-scaling launcher on one token: `--youge-fab-size` defaults to 56px and
  re-states itself per tier — 54px below 480px (exact square rule kept as the
  circle regression gate), 60px at ≥768px, 64px at ≥1280px — with the glyph on
  `--youge-fab-glyph`. The panel gap and the Chrome offer track the same token,
  so nothing ever covers the launcher at its real size. 44px minimum controls,
  visible `:focus-visible` outlines, `cursor: pointer`,
  `touch-action: manipulation`, SVG icons (no emoji), `aria-label`,
  `aria-expanded`, `aria-controls`, `role="dialog"`.
- **Manual adjustment (per origin):** the panel's *Adjust icon* section exposes
  labelled native ranges — size 44–72px, horizontal/vertical 0–160px — that
  apply immediately (size as an inline override that outranks every tier),
  persist as `youge-assistant:fab-adjust` (`{size,x,y}`) across reloads and
  PWA restarts, and reset to the automatic defaults in one button. 44px touch
  targets, `touch-action: manipulation`, focus restoration across panel
  re-renders; keyboard, touch and pointer share one delegated `input` path.
- The launcher is a **true circle**: `border-radius: 50%` on a square box at
  every tier (54/56/60/64px), so it stays circular at every size and position.
  Any decorative layer inside it is a circle of its own (`::before` inset 0), so
  no square edge or glow can escape the button and the glyph stays clipped
  above it.
- The resting state is deliberately calm: one low-saturation fill
  (`--youge-fab-bg`), a hairline ring, one short elevation shadow, no glow, no
  blur, no `@keyframes`. Hover lifts 1px and press scales to 0.98 — feedback
  without theatre. Icon ink on the resting fill measures 9.45:1 (light) and
  11.01:1 (dark); on the red fill 6.57:1 and 10.32:1.
- **Red means "act on this".** The button owns no opinion about urgency: its
  `data-tone` is `state.badge.tone`, the tone of the highest-priority notice the
  user has not dismissed or acknowledged. `critical`, `auth` and `install`
  (connection loss, DNS failure, dead primary endpoint, session attention, an
  available install action) paint the button with the toolkit's own
  `--youge-critical` red. `info`, `backup` and `none` stay neutral: an optional
  update, a restored connection, a feature announcement, the app already running
  on a backup endpoint, or a diagnostic in progress are not user actions.
  Dismissing the event clears the color on the next state emit, with no polling.
  The count badge (inverted to stay legible on red) and the `aria-label` phrase
  repeat the message, because color is never the only signal.
- Two shared motion tokens instead of one duration everywhere:
  `--youge-motion-fast: 160ms` for hover/press feedback and
  `--youge-motion-state: 240ms` for the state color, border and shadow change.
  `@media (prefers-reduced-motion: reduce)` drops both durations and removes
  the travel, so the state still changes — instantly, without motion — and the
  JS close path stays immediate. Every essential action works without animation.
  Dark mode follows the OS only for `theme: 'auto'`; contrast-safe light/dark
  tokens are defined together.
- Safe-area insets (`env(safe-area-inset-*)`), `100dvh` mobile max-height,
  `max-width: 480px` breakpoint, and panel width clamped to the viewport.

---

## 6. React Bits + mandatory design skill

### React Bits

Current official installation docs were re-read at
<https://reactbits.dev/get-started/installation>: components are installed as
source code the project owns, per-component dependencies are listed in the Code
tab, and TS-CSS is a valid variant. The already-vendored, zero-dependency TS-CSS
sources are used again:

| Component | Widget use | Reason |
| --- | --- | --- |
| `GlareHover` | Hover-only feedback around the floating launcher. | `mode="hover"`, `playOnce`, reduced-motion guard; not a loop. |
| `SpotlightCard` | Connection-status card in the panel. | Pointer/focus-driven light, `ambient=false`, `flare=false`, reduced-motion override. |
| `LatticeLoader` | Bounded "checking connection" feedback. | Only rendered while diagnostics are running; accessible status; stops under reduced motion. |

The dependency-free DOM renderer uses equivalent CSS transitions rather than
importing React, because a classic script cannot consume React components. No
GSAP, Motion, HugeIcons, Tailwind, shaders, WebGL backgrounds or component
collections were added. The React example's brand mark is now a static zoomed
image (the former `ElectricLogo`/`ogl` animation was removed on request); no
new WebGL effect is introduced by this widget.

### `ui-ux-pro-max-skill`

The official skill was read again (`SKILL.md`, `references/quick-reference.md`
§1–3, `references/pro-rules.md`) and searched with these exact commands:

```bash
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "floating action button notification badge keyboard focus safe area reduced motion mobile viewport" \
  --domain ux --stack html-tailwind -n 5 --full
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "notification panel priority status feedback aria live region dialog escape focus order" \
  --domain ux --stack react -n 5 --full
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "touch target 44px visible focus contrast toast aria live reduced motion cursor pointer" \
  --domain web --stack html-tailwind -n 5 --full
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "SaaS assistant widget empty state status card action list hierarchy" \
  --domain product -n 5 --full
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "developer tooling SaaS floating assistant widget notification panel" \
  --design-system -p "You.Ge Assistant" --variance 4 --motion 2 --density 7 -f markdown
```

Where it influenced the work:

- **Accessibility (priority 1):** `contextual-live-badge-updates` produced the
  single polite live region with a complete phrase; `focus-states`,
  `aria-labels`, `escape-routes`, `focus-not-obscured` produced the labelled
  FAB, Escape/close path, focus restoration and 3px focus outlines.
- **Touch & interaction (priority 2):** `touch-target-size`, `touch-spacing`,
  `cursor-pointer`, `tap-delay`, `press-feedback`, `safe-area-awareness`
  produced 56px/44px targets, 8px gaps, `touch-action: manipulation`, press
  feedback and `env(safe-area-inset-*)` offsets.
- **Performance (priority 3):** `reduce-reflows`, `third-party-scripts`,
  `offline-support` reinforced one stable snapshot, deferred classic scripts,
  no runtime requests and offline-shell availability.
- **Style/layout (priorities 4–5):** `no-emoji-icons`, `icon-style-consistent`,
  `elevation-consistent`, mobile-first breakpoints and "no horizontal scroll"
  produced the inline SVG set, token-based surfaces, 480px panel clamp and
  `100dvh` max-height.
- **Animation / feedback (priorities 7–8):** 150–300ms transitions, no
  continuous bounce, reduced-motion override, disabled/loading feedback and
  progressive disclosure (`<details>` recovery guidance, empty state).
- **Pre-delivery checklist:** verified 375/768/1024/1440px behavior through
  responsive CSS contracts, 4.5:1 contrast tokens, visible focus, reduced
  motion, descriptive labels, no emoji icons, and no obscured focus.

The `--design-system` query returned the same SaaS/General direction already
persisted in [`design-system/you-ge-assistant/MASTER.md`](design-system/you-ge-assistant/MASTER.md)
(`#2563EB` primary, `#EA580C` CTA, `#F8FAFC` background, variance 4 / motion 2
/ density 7). Its Glassmorphism, Google Font and GSAP scroll-reveal suggestions
were **not** adopted: the repository already uses system fonts and plain CSS,
and the user explicitly excluded unnecessary dependencies, heavy animation and
WebGL/shader effects. The skill's recommendations never override those technical
requirements. No `--force` was used; the existing `MASTER.md` was not replaced.

---

## 7. Tests

`tests/assistant-widget.test.mjs` contains 46 tests (46 including the 0.1.1
feature releases). Coverage maps to the requested scenarios:

| Scenario | Test(s) |
| --- | --- |
| Installable browser | native install action at priority 4 |
| Already-installed PWA | install suggestions and badges suppressed |
| Unsupported install browser | `pwa` absent and `modules.installation=false` |
| Platform-specific instructions | iOS Safari manual vs generic |
| Network failure | critical offline notice, persistent until acknowledged |
| DNS failure | `dns_resolution_failure` classification |
| Backup API activation / primary recovery | priority 3 then priority 5 restoration |
| Primary API failure | `api:primary-failed` critical notice |
| Multiple simultaneous notifications | fixed `[1,2,3,4,5]` ordering |
| Dismissed / acknowledged notifications | dismiss non-critical, acknowledge critical |
| Suppressed repeats | re-emit suppression and reset after resolution |
| Mobile viewport / safe areas | CSS contracts |
| Keyboard / screen-reader / reduced motion | runtime Escape/ARIA + CSS contracts |
| Multi-page navigation | shared `localStorage` across contexts |
| Multiple project configurations | project-scoped dismissal and branding |
| No duplicate SW/network requests | static contracts + single-flight diagnostics + one install delegation |
| Never auto-open | panel hidden on mount; state updates do not open |
| Event-driven updates | custom events and PWA events |
| Responsive launcher sizing (phone/tablet/desktop) | single `--youge-fab-size` token, tier CSS contracts, circle gates |
| Manual size/position + persistence + reset | range clamp, inline override, `fab-adjust` storage, reset-to-defaults |
| Touch/keyboard/pointer adjust path | delegated `input` + `click`, 44px target CSS |
| Android Chrome handoff offer | Facebook/Messenger/Instagram show; Chrome/iOS/unknown hidden |
| URL preservation + failed handoff fallback | intent keeps `?query#hash`; manual steps with verbatim URL |
| Offer dismissal + panel non-overlap | persisted dismissal survives reload; hidden while panel open |

Static checks in `scripts/check.mjs` §7c additionally enforce the integration
across `demo`, `example`, `offline`, `snippet`, Pages workflow, Vite middleware
and the worker precache list.

---

## 8. Limitations and deliberately deferred work

- No management dashboard, published `@youge/assistant-sdk` package, remote
  configuration service, project registration/verification UI, `staff.you.ge`
  integration, production backup/failover engine, auth implementation, npm
  publish, release/tag or deployment is introduced.
- Endpoint/session status is **published by the project**. The widget does not
  health-check APIs, does not decide failover, and does not cache authenticated
  responses.
- Domain detection is configuration input, never authentication. Project
  icons are restricted to same-origin URLs. No arbitrary Host-header trust, no
  cross-origin redirects, no cross-project private-data sharing.
- The offline shell does not load `pwa.js`, so installation is explicitly
  unavailable there; connection diagnostics still publish into the centralized
  state.
- DNS-over-HTTPS classifications remain cautious and are not proof of ISP
  interference. Real-device installation, production DNS, CSP and deployment
  behavior remain acceptance checks outside these unit/static tests.
- The Chrome handoff is best-effort by design: `intent://` requires Chrome (or
  another intent handler) on the device, and a page URL whose hash contains a
  literal `#Intent;` sequence is the one pathological case the handoff cannot
  round-trip — the manual fallback with the original URL covers both.
- PR #6 remains open and unmerged; this feature is delivered on the same
  working branch.
