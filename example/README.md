# GitHub Pages example

This is the user-facing Staff Space sample at the GitHub Pages `/example/` route.
A fixed circular floating button shows the You.Ge Assistant icon and opens the
**Intelligent Floating Assistant** panel. The launcher shows one simple static zoomed mark — the animated
logo was removed — so the assistant never moves while idle; the button fill turns the toolkit's red while
`state.badge.tone` is an actionable tone (`critical`, `auth` or `install`). It consumes the local
[`@youge/assistant-sdk`](../packages/assistant-sdk/README.md) package (`file:../packages/assistant-sdk`)
and `@youge/assistant-sdk/react` adapter (`useSyncExternalStore`), sharing the
single centralized state instance initialized by `assistant-state.js`. The launcher uses a
hover-only `GlareHover` highlight at low opacity; the panel renders a `SpotlightCard`
connection-status card, a bounded `LatticeLoader` diagnostics state, prioritized
notices and working `[data-pwa-diagnostics]` / `[data-pwa-install]` quick actions.
The check-in and checklist remain local to the visitor's browser. See
[`WIDGET.md`](../WIDGET.md) for the state model and SDK configuration.

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
