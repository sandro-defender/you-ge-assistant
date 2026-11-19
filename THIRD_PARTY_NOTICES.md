# Third-party notices

## `@khmyznikov/pwa-install` (`src/runtime/pwa-install.js`)

The self-contained web component runtime in `src/runtime/pwa-install.js` is built from
[`@khmyznikov/pwa-install`](https://github.com/khmyznikov/pwa-install) v0.7.0 (by Gleb Khmyznikov),
preserving zero runtime dependencies for both the root kit and `@youge/assistant-sdk`.

Local You.Ge Assistant adaptations (maintained under the same MIT terms):
- Added native Georgian (`ka`) and Estonian (`et`) translations to the bundled `@lit/localize` translation map.
- Added a reactive `locale` property/attribute on `<pwa-install>` (defaulting to `navigator.languages[0]` / `navigator.language` unless configured explicitly or set to `"auto"`, with case-insensitive subtag resolution and `nb`/`nn` → `no` mapping).
- Localized the `<pwa-install>` dialog close button `title` / `aria-label`.
- Exported `changeLocale`, `getLocale`, and `isRTL` on `PWAInstallComponent` for runtime language switching.
- Stripped the development `sourceMappingURL` footer and ensured `globalThis.PWAInstallComponent` availability.

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

## `qrcode-generator` (`src/shared/qrcode.js`)

Local QR generation uses the vendored MIT-licensed `qrcode-generator` library in `src/shared/qrcode.js`.

## Example-only React Bits components (`examples/example/`)

See [`examples/example/THIRD_PARTY_NOTICES.md`](examples/example/THIRD_PARTY_NOTICES.md) for the MIT + Commons Clause notices governing the components vendored into the example application.
