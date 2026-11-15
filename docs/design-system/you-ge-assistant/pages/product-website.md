# Product website — visual system and review

Date: 2026-11-15. Applies to the GitHub Pages homepage, product guide, and shared
chrome around the preserved workspace. This page-specific direction supersedes
the earlier master palette for these surfaces; it does not change SDK theme
resolution or the host-owned sample workspace's identity.

## Identity

- Light-first white and near-white (`#fafaff`) surfaces; ink `#171b30`.
- Violet `#6942d6` for primary actions, lavender for integration signals.
- Navy `#111426` for architecture and interactive demonstration sections.
- System-native sans-serif stack, no third-party fonts or font requests.
- Consistent 7–12px corner radii, fine neutral borders, restrained shadows.
- The original symbol connects two modular square components to a circular
  Assistant signal. Its navy tile works as a favicon and at documentation sizes.
- The CSS hero and feature illustrations are explicitly illustrative, not live
  controls or fabricated health claims. The live panel is clearly separated.

## Shared components and assets

`examples/example/public/product.css`, `product.js`, and `assistant-symbol.svg`
provide shared header/footer styling, progressive mobile navigation and identity.
The mobile menu supports Escape and focus restoration. With JS off, links remain
visible. The same files are copied to the Pages root by the existing assembly.
`integration-preview.svg` is the homepage's responsive, original product diagram.
All shipped art is CSS or compact SVG, without a new image or icon dependency.

`src/landing.css` defines the product layout, feature cards, architecture graph,
code blocks, guide navigation, and live SDK panel. The sample app retains its
existing UI and SDK-driven theme studio, with text contrast corrections.

## Interaction and accessibility

- Keyboard-visible focus, named navigation landmarks, skip links, semantic
  headings, real anchors and buttons, and reduced-motion support.
- Large touch targets for navigation and live controls; safe-area padding and
  no zoom restrictions. Hover feedback is gated by pointer capability.
- Code blocks scroll independently and are keyboard focusable, even without JS.
- Clipboard controls are progressive enhancements, with success/failure feedback.
- The theme selector configures the real shared SDK instance; installation and
  diagnostics delegate to the actual PWA runtime. No worker is registered.
- Automated axe WCAG A/AA checks passed on homepage and guide at desktop/mobile,
  and the workspace at mobile. This does not replace a screen-reader or hardware
  accessibility review.

## Screenshots

Screenshots capture the locally assembled production site at the real
`/you-ge-assistant/` base path. They are review evidence only, not deployed assets.

- [Homepage desktop](screenshots/playground-desktop.png)
- [Homepage mobile](screenshots/homepage-mobile.png)
- [Product hero desktop](screenshots/landing-hero.png)
- [Complete product guide desktop](screenshots/landing-desktop.png)
- [Complete product guide mobile](screenshots/landing-mobile.png)
- [Actual Assistant interface](screenshots/assistant-live.png)
