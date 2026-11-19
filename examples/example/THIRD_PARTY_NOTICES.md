# Third-party notices

## React Bits components

The following component sources are vendored from
[React Bits](https://github.com/DavidHDev/react-bits), by David Haz, and are now
owned/maintained as part of this example application:

| Component | Local source | Upstream variant | Runtime dependency |
| --- | --- | --- | --- |
| SpotlightCard | `src/react-bits/SpotlightCard.tsx`, `.css` | TypeScript + CSS | none |
| GlareHover | `src/react-bits/GlareHover.tsx`, `.css` | TypeScript + CSS | none |
| LatticeLoader | `src/react-bits/LatticeLoader.tsx`, `.css` | TypeScript + CSS | none |

The TypeScript + CSS variants were selected to match the requested TypeScript
preference and the project's plain-CSS conventions. Official installation
documentation recommends copying component source into the project (or using
`shadcn`/`jsrepo`); no React Bits npm package is installed. Local adaptations:
removal of the Next.js-specific `'use client'` directive, safe
`window.matchMedia?.()` access, reduced-motion overrides for the decorative
highlights/glare/loader, and design-token overrides in `example.css`. The
Intelligent Floating Assistant reuses these same owned sources: `GlareHover`
around the launcher (with a local circular `clip-path` and `overflow: visible`
override so the existing logo stage is not clipped), `SpotlightCard` for the
connection-status card, and `LatticeLoader` only while diagnostics run. See
[`../../docs/guides/DESIGN_FOUNDATION.md`](../../docs/guides/DESIGN_FOUNDATION.md) §8 and
[`../../docs/guides/WIDGET.md`](../../docs/guides/WIDGET.md) §6 for the full adoption report.

**no runtime dependencies**; `typescript`, `@types/react` and
`@types/react-dom` are dev-only, isolated in `examples/example/`, and used by
`npm run typecheck`.

The upstream repository applies the following license to all of the above
sources:

```text
MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software as part of
an application, website, or product, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

Commons Clause Restriction

You may use this Software, including for any commercial purpose, so long as
you do not sell, sublicense, or redistribute the components themselves—whether
alone, in a bundle, or as a ported version.

The same restriction covers the React Bits tools (Background Studio, Texture
Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the
sounds in the sound library. You may not sell, sublicense, or redistribute the
tools or the sounds themselves, or offer the tools or a substantially similar
copy of them as a hosted service—whether alone, in a bundle, or as a ported
version.

What you make with the tools is yours to use. You can use exported code, images,
videos, and audio in any personal or commercial application, website, or
product, including paid ones. You may not sell or redistribute the exports on
their own, either individually or as the product itself, such as a sound,
texture, background, or template pack.

No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## `@khmyznikov/pwa-install` runtime (`src/runtime/pwa-install.js`)

The self-contained `<pwa-install>` web component runtime used by `pwa.js` (and deployed alongside the example as `pwa-install.js`) is vendored from [`@khmyznikov/pwa-install`](https://github.com/khmyznikov/pwa-install) v0.7.0 with native Georgian (`ka`) localization and runtime `locale` selection added under the same MIT License:

```text
MIT License

Copyright (c) 2023 Gleb Khmyznikov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
