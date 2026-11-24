# GitHub Pages example

The GitHub Pages `/example/` route is the You.Ge Assistant product landing page
and SDK 0.4.1 integration guide. It includes original CSS illustrations, an
accessible architecture diagram, typechecked code samples and a real SDK state
panel connected to the optional DOM widget. No worker is registered by the page.

The preserved Staff Space sample is at `/example/workspace.html`. The interactive
SDK launcher studio is at `/example/launcher-demo.html` (local Vite route:
`http://localhost:5173/launcher-demo.html`). It renders the actual classic
`assistant-state.js` and `assistant-widget.js`, not the mock preview from the
configuration playground. Open the floating launcher at the lower right to see
the real panel and action buttons.

The studio includes four scenario controls: **Idle** has no PWA install adapter
or actionable notice; **Installation** attaches a host PWA adapter exposing the
SDK's real `getState()` / `canInstall` snapshot; **Network problem** calls the
SDK's `setConnectivity(false)` host-state API to publish its actual diagnostics
and recovery actions; **Multiple actions** combines those same two SDK states.
Use **Complete installation** or **Restore connection** one at a time to verify
the single attention outline stays on while another eligible action remains.
**Resolve all** reaches the quiet resolved state. The shape, logo fit/zoom,
outline toggle/color/speed/intensity controls call `YouGeAssistant.configure()`
on that same centralized instance. The demo uses no service worker or outbound
network calls, and honors reduced-motion preferences.
A fixed circular floating button shows the You.Ge Assistant icon and opens the
**Intelligent Floating Assistant** panel. The launcher shows one simple static zoomed mark — the animated
logo was removed — so the assistant never moves while idle; the button fill turns the toolkit's red while
`state.badge.tone` is an actionable tone (`critical`, `auth` or `install`). It consumes the local
[`@youge/assistant-sdk`](../../packages/assistant-sdk/README.md) package (`file:../../packages/assistant-sdk`)
and `@youge/assistant-sdk/react` adapter (`useSyncExternalStore`), sharing the
single centralized state instance initialized by `assistant-state.js`. The launcher uses a
hover-only `GlareHover` highlight at low opacity; the panel renders a `SpotlightCard`
connection-status card, a bounded `LatticeLoader` diagnostics state, prioritized
notices and working `[data-pwa-diagnostics]` / `[data-pwa-install]` quick actions.
The check-in and checklist remain local to the visitor's browser. See
[`../../docs/guides/WIDGET.md`](../../docs/guides/WIDGET.md) for the state model and SDK configuration.

The page also includes a read-only **Platform foundation** preview: three React
Bits `SpotlightCard` cards, a `LatticeLoader` capability-check state, a
`GlareHover` install CTA that still uses `data-pwa-install`, an accessible
empty state and connection-status notifications. It is a design reference for
the future Assistant dashboard — it registers no projects and publishes no
configuration. A static HTML fallback keeps the same information readable
without React.

## Develop and build

```sh
npm ci
npm run dev
npm run typecheck
npm run build
```

Vite serves the shared PWA runtime and icons from the repository root during
local development. The Pages workflow builds this directory and assembles its
output with the manifest, service worker, offline page and icons under the
same `/example/` scope. `base: './'` keeps the assets working beneath the
GitHub Pages project path.

React, React DOM, TypeScript types and Vite are isolated to this example.
They are not runtime dependencies of the You.Ge Assistant PWA toolkit or
`@youge/assistant-sdk`. The React Bits sources and their license notice are in
[`src/`](src/) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
`src/assistant-mark.png` is the static circular You.Ge Assistant launcher mark.

`npm run typecheck` runs `tsc --noEmit` over the TypeScript React Bits sources,
`FoundationPreview.tsx`, and the `.d.ts` declarations exported by
`@youge/assistant-sdk`; it is also a CI gate. Both `@youge/assistant-sdk` and
the core PWA toolkit remain dependency-free at runtime.

## Landing page maintenance

Edit `src/guide-examples.ts`, then run `node scripts/sync-pages-examples.mjs`
from the repository root. The script renders the same typechecked source into
HTML so the guide works without JavaScript; tests detect drift. `src/landing.ts`
only wires the live SDK panel, appearance selector and clipboard feedback.
`src/landing.css` owns the product site identity, separate from the sample app.

The example deliberately retains its local `file:` SDK dependency: CI builds
it before root assembly, using buildless SDK exports. Public snippets were
verified against the published npm 0.4.0 tarball and the prepared repository
0.4.1 source; no SDK implementation is copied here.
