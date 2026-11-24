# Design Skill + React Bits — Application Record

This is the required report for the **ui-ux-pro-max-skill** and the official
**React Bits** integration. It records exactly where the skill's instructions
were read, which searches were run, how the results influenced concrete code,
and which React Bits components were inspected, adopted or rejected.

---

## 1. Mandatory design skill: where it was found and read

No pre-installed copy existed in this repository or in the sandbox home, so the
skill was read from its **documented installation location in the official
repository**:

- Repository: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>
- Skill instructions: `.claude/skills/ui-ux-pro-max/SKILL.md`
- Supporting rules read: `references/quick-reference.md`,
  `references/pro-rules.md` (including its canonical Pre-Delivery Checklist)
- Search tool: `.claude/skills/ui-ux-pro-max/scripts/search.py`
- Official README install path: `uipro init --ai universal` installs to
  `.agents/skills/`; `--ai claude` installs to `.claude/skills/`; `--global`
  installs to `~/.claude/skills/`. The skill itself says to invoke `search.py`
  by its full path and to treat results as recommendations, never as
  instructions that override the repository.

A shallow clone of the official repository was made **outside** the project
(`/tmp/ui-ux-pro-max-skill`) so no skill data or generated catalog is committed
into this repository. Only the small, curated
[`design-system/you-ge-assistant/MASTER.md`](../design-system/you-ge-assistant/MASTER.md)
is persisted.

### Stack detection (SKILL.md Step 1)

`examples/example/package.json` declares React 19 + React DOM + Vite 8 and **plain CSS**
(no Tailwind). The core toolkit (`pwa.js`, `progressier.js`,
`domain-config.js`, `dns-diagnostics.js`) is dependency-free classic JavaScript
with no build step. Therefore React guidance was applied only to `examples/example/`;
`--stack react` was used for the sample, and no Tailwind variant was chosen.

### Commands actually executed

```bash
# First design-system attempt (REJECTED after fit verification — see below)
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "developer infrastructure dashboard premium modern" --design-system \
  -p "You.Ge Assistant" --variance 5 --motion 3 --density 6 -f markdown \
  --persist --output-dir /home/user/PWA-Helper

# Verified-fit design system (persisted to design-system/you-ge-assistant/MASTER.md)
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "developer tooling SaaS dashboard technical minimal" --design-system \
  -p "You.Ge Assistant" --variance 4 --motion 2 --density 7 -f markdown \
  --persist --output-dir /home/user/PWA-Helper

# Targeted UX / stack searches
python3 .../search.py "reduced motion accessible animation" --domain ux -n 5
python3 .../search.py "status indicator loading feedback" --domain ux -n 5
python3 .../search.py "modal focus trap keyboard close" --domain ux -n 4
python3 .../search.py "touch target size 44px" --domain ux -n 4
python3 .../search.py "effect cleanup reduced motion" --stack react -n 4
```

**Fit verification:** the first query returned *Liquid Glass* + a
Cormorant/Montserrat luxury palette and scroll-triggered storytelling. That does
not match a developer-infrastructure product, would add an external Google Fonts
request, and its "premium" interpretation conflicts with a technical tool. It
was **rejected and regenerated**; `MASTER.md` now contains the verified
`SaaS (General)` / Glassmorphism result with Plus Jakarta Sans, motion 2/10,
density 7/10. The palette/font replacement itself was also **not applied**: the
existing example already has a coherent green brand and system-font stack, and
SKILL.md explicitly says search results are recommendations that must not
override repository rules. The applied subset is the accessibility, motion,
feedback, hierarchy and responsive guidance.

## 2. Exactly how the skill influenced the work

| Skill rule (source) | Concrete change in this PR |
| --- | --- |
| **Priority 1 — Accessibility**: contrast 4.5:1, visible focus, aria-labels, no removed focus rings (`SKILL.md`, `quick-reference.md` §1) | `pwa.js` install sheet: added `:focus-visible` rings for close/primary buttons, `aria-labelledby`/`aria-describedby`, descriptive close label, contrast-safe `.note` color `#475569` with no 0.7 opacity. `pwa.css`: restored a visible `:focus-visible` ring over the legacy banner's `outline: 0 !important`. New React UI uses inline SVG with `aria-hidden`, `role="status"`, `aria-live="polite"`, `aria-busy`, `aria-describedby`. |
| **Priority 2 — Touch & interaction**: 44px targets, 8px spacing, `touch-action`, feedback (`quick-reference.md` §2) | Install sheet close target raised to 44×44 with `touch-action: manipulation`; new CTA/empty-state buttons have `min-height: 44px` and ≥8px gaps; disabled empty-state action is visibly non-interactive. Existing Escape/backdrop/focus-restore behavior is preserved. |
| **Priority 3 — Performance**: lazy loading, no CLS, no layout thrash (`SKILL.md` priority table) | Three adopted components are CSS/DOM-only with **zero runtime dependencies**; `SpotlightCard` runs with `ambient={false}`, `flare={false}`, `grain={0}`, proximity-limited rAF, and cleans up observers/listeners. `LatticeLoader` appears only during a 320ms capability check. No new WebGL, shader, font or network request. Static HTML fallback prevents invisible content. |
| **Priority 4/6 — Style, typography and color**: consistency, semantic tokens, no emoji icons (`MASTER.md`, `pro-rules.md`) | New UI reuses `--brand`, `--surface`, `--muted`, `--line`, `--shadow` tokens and one SVG icon family with consistent 1.75 stroke; no emoji or mixed icon styles; status conveyed by text **and** dot, never color alone. |
| **Priority 5 — Layout & responsive**: mobile-first, no horizontal scroll (`quick-reference.md` §5) | `.foundation-grid` uses `repeat(3, minmax(0, 1fr))`, collapses to one column at 900px, controls go full-width at 600px; `.foundation-section` uses `min(100% - 32px, 1120px)`. |
| **Priority 7 — Animation**: motion conveys meaning, reduced motion (`ux` search: "Reduced Motion", "Excessive Motion", "Continuous Animation", "Duration Timing") | One 180ms panel entrance, one 180ms connection toast, 160ms color transitions only. `example.css` global reduced-motion rule, inline `@media (prefers-reduced-motion:reduce)` in the shadow-DOM sheet, and reduced-motion overrides in **all three** vendored stylesheets. `SpotlightCard`'s internal `reduce` flag and `GlareHover`'s `reduced` guard are retained. No continuous decorative animation. |
| **Priority 8 — Forms & feedback**: loading feedback, `aria-busy`, progressive disclosure (`ux` search: "Loading Indicators", "Submit Feedback") | `LatticeLoader` + `aria-busy` while capabilities are read; `role="status"` connection line; notification toast with `aria-live="polite"`; empty state explains why the action is disabled. |
| **Priority 9 — Navigation**: predictable, deep-linkable, no overloaded nav | The existing two-link native nav was kept. The floating assistant panel gained a subtle 180ms entrance, retains `aria-expanded`/`aria-controls`, Escape/outside-click close and focus restoration. |
| **React stack guidance**: clean up effects, correct dependencies (`--stack react`) | `FoundationPreview.tsx` and `useOnlineStatus` in `main.jsx` return cleanups for `setTimeout` and `online`/`offline` listeners, with correct dependency arrays. |

**Pre-delivery checklist (`pro-rules.md`):** applied for this web surface —
no emoji icons, consistent SVG strokes, `cursor: pointer` on controls, visible
focus, reduced motion, 375/768/1024/1440 responsive intent, stable hover states
without layout shift, and semantic tokens. Native 44pt/48dp and safe-area rules
are documented as platform-specific and were not misapplied as a universal web
conformance claim (`quick-reference.md` `web-target-size`: 24 CSS px minimum;
we use 44px where practical).

---

## 3. React Bits: official documentation read

- <https://reactbits.dev/get-started/introduction> — 217 components in five
  categories; four flavours (`JS-CSS`, `JS-TW`, `TS-CSS`, `TS-TW`); principles
  *You own the code*, *Props first*, *Nothing to depend on*, *Your stack*;
  "Use motion with care" (two or three effects per page, plan for mobile, test
  real devices); MIT + Commons Clause license.
- <https://reactbits.dev/get-started/installation> — install source with
  `npx shadcn@latest add @react-bits/<Name>-TS-CSS` or
  `npx jsrepo@latest add https://reactbits.dev/r/<Name>-TS-CSS`, or copy the
  Code tab source by hand and install only that component's dependencies.
  React Bits is **not** an npm package.
- <https://github.com/DavidHDev/react-bits> — official source, registry JSON
  (`public/r/<Name>-TS-CSS.json`) and `LICENSE.md`.

The TS-CSS flavour was chosen to match the TypeScript preference and the
project's existing plain-CSS conventions. Sources were copied into
`examples/example/src/react-bits/` and are owned here; no CLI or component-collection
dependency was added.

## 4. Components inspected, adopted and rejected

| Component | Registry dependencies | Decision | Reason |
| --- | --- | --- | --- |
| **SpotlightCard** (TS-CSS) | none | **Adopted** | Pointer/keyboard-focus-driven card highlight for the three foundation cards; no continuous animation, respects reduced motion, cleans up listeners. |
| **GlareHover** (TS-CSS) | none | **Adopted** | One subtle hover/focus sweep on the install CTA; `mode="hover"`, `playOnce`, reduced-motion guard. Not a loop. |
| **LatticeLoader** (TS-CSS) | none | **Adopted** | Accessible `role="status"` loading indicator for the short capability check; infinite animation is a loading indicator only, and our local CSS stops it under reduced motion. |
| FadeContent, AnimatedContent, ScrollReveal, StaggeredMenu | `gsap@^3.13.0` | Not used | Would add a new runtime animation dependency for effects we can achieve with 160–180ms CSS. |
| StatusMark, SwipeToast | `motion@^12.23.12` (+ hugeicons for SwipeToast) | Not used | New runtime dependency; status/toast needs are met with text + SVG + `aria-live` and existing CSS. |
| Stepper, FlowingMenu, AnimatedList | `@hugeicons/react`, `@hugeicons/core-free-icons` | Not used | Icon-library dependencies and large sources for a read-only preview with no wizard/list data. |
| PillNav, GooeyNav, BubbleMenu, CardNav | none (but 22–31 KB source each) | Not used | The current navigation is two native anchors; replacing it with a large animated nav would add complexity and risk without material UX gain. |
| BorderGlow, StarBorder, PixelCard, HoloCard, ClickSpark, SpecularButton, BounceCards | none | Not used | Decorative continuous glows, canvas spark effects or oversized button choreography. `SKILL.md` "Continuous Animation" and React Bits "two or three per page" argue against them here. |
| Aurora, Balatro, Galaxy, DarkVeil and other shader/canvas backgrounds | varies (`ogl`, `three`, `three`) | Not used | Explicitly excluded: no excessive 3D/WebGL/shader effects or continuously running backgrounds. |
| Tailwind (`*-TS-TW`) variants | — | Not used | This example uses plain CSS; introducing Tailwind would be a new styling system. |

## 5. Dependencies introduced and why

| Dependency | Where | Why |
| --- | --- | --- |
| none (runtime) | core toolkit and example | SpotlightCard, GlareHover, LatticeLoader have empty `dependencies` in their official registry entries. The core toolkit stays dependency-free. |
| `typescript@^5.9.3` | `examples/example/` devDependencies | Required for `tsc --noEmit` over the TS-CSS React Bits sources — satisfies "prefer TypeScript" and adds a real type-check gate. |
| `@types/react@^19`, `@types/react-dom@^19` | `examples/example/` devDependencies | Type declarations for React 19 TSX; dev-only, not bundled. |
| existing `react`, `react-dom`, `vite`, `ogl` | `examples/example/` | Unchanged from before this PR. |

`examples/example/package-lock.json` was updated for these dev dependencies. The root
`package.json` still has no dependencies. No component-collection package, CLI,
GSAP, Motion, HugeIcons, Tailwind or WebGL library was installed.

## 6. Performance and accessibility considerations

- **Performance:** three lightweight DOM/CSS components instead of a component
  collection; 21 KB of new JS bundle (315 KB total, ~99 KB gzip for the
  example); no new runtime network requests, fonts or shaders; rAF work is
  proximity-limited and settles; observers and listeners are disconnected on
  unmount; the only continuously animating element is the short-lived loader.
- **Reduced motion:** vendored CSS overrides disable the spotlight, glare and
  loader loop; `example.css` has a global `prefers-reduced-motion` rule; the
  shadow-DOM install sheet disables its new transitions. Essential content and
  all controls work without any animation.
- **Accessibility:** visible focus rings (including the legacy banner that had
  `outline: 0 !important`), 44px min targets where practical, descriptive labels,
  `role="dialog"`/`aria-modal` preserved, focus restoration preserved, SVG icons
  `aria-hidden` with text alternatives, status conveyed by text as well as color,
  `aria-live="polite"` toasts that do not steal focus, disabled action explained
  via `aria-describedby`, and a static no-JS HTML fallback.
- **Responsive:** single-column cards below 900px, full-width actions below
  600px, no fixed pixel container widths, no horizontal scroll.

## 7. Files influenced by the skill / React Bits

- `pwa.js` — install help sheet focus, contrast, touch target, semantics.
- `pwa.css` — banner focus ring and reduced-motion transition rule.
- `examples/example/src/react-bits/*` — vendored, locally adapted TS-CSS sources.
- `examples/example/src/FoundationPreview.tsx` — cards, loading, empty state, status,
  notification and CTA composition.
- `examples/example/src/main.jsx` — panel status/transition, effect cleanup, mount.
- `examples/example/index.html` — static fallback and foundation section.
- `examples/example/example.css` — tokens, responsive layout, reduced motion.
- `examples/example/THIRD_PARTY_NOTICES.md`, `examples/example/README.md`, `examples/example/tsconfig.json`,
  `examples/example/package.json`, `.github/workflows/check.yml` — ownership, license,
  TypeScript and CI gates.
- `design-system/you-ge-assistant/MASTER.md` — persisted verified design system.
- `FOUNDATION_AUDIT.md`, `ASSISTANT_ARCHITECTURE.md`,
  `INSTALLATION_EXPERIENCE.md` — design and UX constraints recorded as
  architecture/security requirements.

The design skill guided hierarchy, consistency, accessibility and responsive
behavior; React Bits supplied the reusable card, CTA and loading source. Neither
overrode the existing application's technical requirements: the PWA install flow
was audited first and its behavior is unchanged.

---

## 8. Intelligent Floating Assistant (Phase 1.5)

The floating Assistant was added as a core widget on the same working branch.
The mandatory `ui-ux-pro-max-skill` was applied again; exact searches are
recorded in [`WIDGET.md`](WIDGET.md) §6. The official React Bits installation
docs were re-read at <https://reactbits.dev/get-started/installation> (source
ownership, per-component dependencies, TS-CSS variant by hand).

### Adopted again, zero new dependencies

| Component | New use | Local adaptation |
| --- | --- | --- |
| `GlareHover` | Hover-only feedback around the React example's floating launcher. | `mode="hover"`, `playOnce`; root `overflow: visible` and a circular `clip-path` on the glare so the existing logo stage is not clipped. Reduced-motion override retained. |
| `SpotlightCard` | Connection-status card inside the Assistant panel. | Light theme, `ambient=false`, `flare=false`, `grain=0`, project tokens override the vendored skin; reduced-motion override retained. |
| `LatticeLoader` | Bounded diagnostics "checking" state. | Rendered only while `network.dns.status === 'running'`; `role="status"`, reduced-motion override retained. |

`examples/example/src/main.jsx` now consumes `window.YouGeAssistant` through
`useSyncExternalStore`, so the React example and the dependency-free
`assistant-widget.js` renderer share one state model. No GSAP, Motion,
HugeIcons, Tailwind, shaders, continuous WebGL backgrounds or component
collections were added. The example's launcher shows one static zoomed mark —
the former `ElectricLogo`/`ogl` animation was removed on request: no canvas,
no arcs, nothing that mounts on hover or while the panel is open. It is
clipped to the button's circle, and the widget itself still introduces no
WebGL effect.

### Skill influence on the widget UI

- **Accessibility CRITICAL:** one `role="status" aria-live="polite"` region with
  a complete contextual phrase; labelled FAB, `aria-expanded`, `aria-controls`,
  Escape/close route, focus restoration, 3px `:focus-visible` outlines.
- **Touch CRITICAL:** 56px launcher, 44px controls, 8px gaps,
  `cursor: pointer`, `touch-action: manipulation`, press feedback,
  `env(safe-area-inset-*)` offsets; playground uses `bottom-left` to avoid the
  existing toolbox.
- **Performance HIGH:** one stable snapshot, deferred classic scripts, no
  polling, no `fetch`, no duplicate SW registration, offline-shell precache.
- **Style/layout HIGH:** consistent inline SVG icon set (no emoji), semantic
  tokens, single elevation scale, 480px clamp, `100dvh` max-height, no
  horizontal scroll, light/dark tokens defined together.
- **Animation/feedback MEDIUM:** shared motion tokens (160ms feedback, 240ms
  state change) instead of one duration everywhere, no looping badge or
  bounce, `@media (prefers-reduced-motion: reduce)` fallback, empty state,
  progressive-disclosure recovery guidance.
- **Pre-delivery checklist:** 375/768/1024/1440px responsive contracts, 4.5:1
  contrast tokens, visible focus, descriptive labels, no obscured focus.

The `--design-system` query again returned the SaaS/General direction already
persisted in `MASTER.md`. Its Glassmorphism, Google Font and GSAP scroll-reveal
suggestions were deliberately rejected: the repository uses system fonts and
plain CSS, and the user excluded unnecessary dependencies and heavy animation.
`MASTER.md` was not overwritten (no `--force`).

### Files influenced

`assistant-state.js`, `assistant-widget.js`, `assistant-widget.css`,
`examples/example/src/main.jsx`, `examples/example/example.css`, `examples/example/index.html`,
`examples/demo/index.html`, `offline.html`, `offline.js`, `docs/guides/snippet.html`,
`progressier.js`, `examples/example/vite.config.js`, `.github/workflows/pages.yml`,
`.github/workflows/check.yml`, `scripts/check.mjs`,
`tests/assistant-widget.test.mjs`, `WIDGET.md`, `README.md`, `AGENTS.md`,
`CHANGELOG.md`, `ASSISTANT_ARCHITECTURE.md`, `examples/example/README.md`,
`examples/example/THIRD_PARTY_NOTICES.md`.

---

## 9. Phase 2 — `@youge/assistant-sdk` extraction and developer UX

### Skill resources consulted and queries executed

Read directly from `nextlevelbuilder/ui-ux-pro-max-skill`:
- `.claude/skills/ui-ux-pro-max/SKILL.md`
- `.claude/skills/ui-ux-pro-max/references/quick-reference.md`
- `.claude/skills/ui-ux-pro-max/references/pro-rules.md`

Executed targeted search queries with `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`:
- `--domain ux` (`developer sdk documentation progressive disclosure status feedback`) → surfaced `error-recovery`, `touch-target-size`, `form-labels`
- `--domain product` (`developer sdk infrastructure tool`) → matched `Developer Tool / IDE` (clean hierarchy, calm contrast, scannable progressive disclosure, zero visual noise)
- `--stack react` (`useSyncExternalStore hook state subscription cleanup`) → surfaced `useEffectCleanup` (`removeEventListener` + unsubscribe symmetry on teardown) and `memo-deps`
- `--domain react` (`external store state subscription re-render`) → surfaced `rerender-defer-reads` (subscribe only to needed slices; memoize selector snapshots so unchanged renders stay O(1))

### How guidance influenced Phase 2 implementation

1. **Tear-free React external-store ergonomics (`@youge/assistant-sdk/react`):**
   Applied `useEffectCleanup` and `rerender-defer-reads` to `getExternalStoreBindings()` and `createUseAssistant()`. Selector results are cached against `(lastState, lastSelected)` with `Object.is`, preventing spurious React 18/19 re-renders and infinite selector loops while keeping `react` completely out of SDK runtime dependencies.
2. **Live, calm SDK telemetry in `examples/example/src/FoundationPreview.tsx` & `examples/example/src/main.jsx`:**
   Kept the verified calm SaaS/Developer-Tool visual hierarchy from `MASTER.md` and the already-vendored zero-dependency TS-CSS React Bits components (`SpotlightCard`, `GlareHover`, `LatticeLoader`) without visual churn. Wired both `main.jsx` and `FoundationPreview.tsx` directly to `@youge/assistant-sdk` and `@youge/assistant-sdk/react` so the live status bar (`role="status"`) and Resilience card surface real SDK state (`SDK v0.1.0`, active origin, live install capability, and resolved config source `defaults | overrides | published | last-known-good`) while preserving the static no-JS HTML fallback, inline SVG icons, 44px touch targets, and `@media (prefers-reduced-motion: reduce)`.
3. **Progressive-disclosure developer documentation (`packages/assistant-sdk/README.md`):**
   Structured SDK docs from immediate 30-second Quick Start (`YouGeAssistant.create`, `YouGeAssistant.attach`, optional React hook) → subpath table → configuration/LKG security pipeline → complete method/priority tables → illustrative generic host integration, with explicit non-goals and unpublished-package transparency.


## 10. Phase 3 — release preparation & documentation DX (2026-11-06)

No visual/UI surface changed in this phase (no widget, example or stylesheet
edits); the mandatory `ui-ux-pro-max-skill` was applied to **developer
experience**: SDK documentation, release/migration guides and the validation
tool's feedback design.

### Skill resources consulted and queries executed

Read directly from `nextlevelbuilder/ui-ux-pro-max-skill`
(clone at `/tmp/ui-ux-pro-max-skill`, not committed):
- `.claude/skills/ui-ux-pro-max/SKILL.md` (query contract, workflow, priority table)
- `.claude/skills/ui-ux-pro-max/references/pro-rules.md` (pre-delivery checklist)

Executed targeted search queries with `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`:
- `--domain ux` (`developer sdk documentation progressive disclosure status feedback`) → "Submit Feedback — show loading then success/error state" (every command documents its success signal and failure exit); "Heading Line Balance" (bounded measures, no forced breaks)
- `--domain product` (`developer sdk infrastructure tool error message documentation`) → matched **API Developer Portal** ("Quick Start + Interactive Docs", scannable hierarchy) and **Developer Tool / IDE** ("Minimal & Direct + Documentation")

### How guidance influenced the release-preparation deliverables

1. **Progressive disclosure in `packages/assistant-sdk/README.md`:** status box
   first (what is true *now* — unpublished, publishing disabled), then
   installation in two clearly separated contexts (registry "after the first
   approved release" vs. local `file:`), with deep policy (semver, registry
   decision, runbook) deferred to `RELEASE.md`/`MIGRATION.md` links.
2. **Scannable decision tables in `RELEASE.md`:** the GitHub Packages vs public
   npm comparison follows the "Quick Start + Interactive Docs" pattern —
   recommendation and its reasons before the exhaustive table; the three
   publishing locks get an explicit status table instead of prose.
3. **Atomic, observable runbook steps in `RELEASE.md` §4 and `MIGRATION.md`
   §4–5:** each step is one action with its success signal (per "Submit
   Feedback": never leave a step without an observable outcome); the migration
   checklist items are all machine-checkable ("grep finds no vendored-path
   imports", "YouGeAssistant.version equals the pin").
4. **Status feedback in `scripts/validate-package.mjs`:** sectioned
   PASS/FAIL/NOTE output mirrors the skill's feedback-loop rule — every check
   reports a state, the summary repeats the package identity and next action
   ("ready for the release checklist — publishing still disabled"), and exit
   codes make it CI-usable.
5. **Pre-delivery checklist applied to the docs themselves:** prerequisites
   named but never invented (npm scope ownership), secrets never printed,
   rollback documented first-class in `MIGRATION.md` §6.

## 11. Package rename to `@youge/assistant-sdk` — documentation consistency (2026-11-06)

No visual surface changed; the mandatory `ui-ux-pro-max-skill` was applied to
**documentation and developer-facing consistency** during the package rename.

### Skill resources consulted and queries executed

Read from `nextlevelbuilder/ui-ux-pro-max-skill` (fresh clone at
`/tmp/ui-ux-pro-max-skill`, never committed):
- `.claude/skills/ui-ux-pro-max/SKILL.md` (query contract: one dominant intent
  per query, verify domain/fit before applying)

Executed with `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`:
- `--domain ux` (`documentation consistency naming change migration status`) →
  "Submit Feedback — confirm status with loading → success/error state" and
  "Contextual Live Badge Updates — one atomic contextual message, not bare
  numbers"
- `--domain product` (`developer sdk infrastructure tool documentation`) →
  **API Developer Portal** ("Quick Start + Interactive Docs") and
  **Knowledge Base/Documentation** ("clean hierarchy, minimal noise")

### How guidance was applied

1. **Atomic, status-reporting rename steps (Submit Feedback):** every rename
   step reported its verification state immediately — registry gate checks,
   per-file replacement counts, `sync:sdk --check`, lockfile regeneration —
   never a silent bulk edit. The PR progress comment reports results as
   contextual sentences ("86 of 86 identity references migrated, 2 intentional
   history mentions remain"), not bare checkmarks.
2. **Consistency as an observable outcome (Contextual updates):** the
   definition of "done" for the rename is a repo-wide grep result, stated in
   the PR and `RELEASE.md` §6 as one atomic status message.
3. **Quick Start + Interactive Docs kept truthful (API Developer Portal):**
   the README's install snippet, subpath table and import examples all now
   show `@youge/assistant-sdk` first-try-correct — a developer copying from any
   code block must never hit a 404 from a stale name.
4. **Clean hierarchy for the identity decision (Knowledge Base):** `RELEASE.md`
   §2 leads with a small identity table (user → org → scope → package) before
   the verification prose, so the confirmed identity is scannable at a glance.

## 12. 0.1.0 release preparation — release docs & installation DX (2026-11-06)

The mandatory `ui-ux-pro-max-skill` was applied to the **release documentation
and the developer installation experience** (no visual surface changed).

### Skill resources consulted and queries executed

Read from `nextlevelbuilder/ui-ux-pro-max-skill` (clone at
`/tmp/ui-ux-pro-max-skill`, not committed): `.claude/skills/ui-ux-pro-max/SKILL.md`
(query contract and priority table).

Executed with `python3 .claude/skills/ui-ux-pro-max/scripts/search.py`:
- `--domain ux` (`getting started install onboarding setup status`) → *User
  Freedom* (no forced linear tour), *Submit Feedback* (confirm status with
  explicit success/error states), *Contextual Live Badge Updates* (one atomic
  meaningful status, not bare markers)
- `--domain product` (`developer sdk release documentation changelog`) →
  **Changelog / Release Notes** ("Timeline + Version List" pattern,
  version + date headings), **API Developer Portal** ("Quick Start +
  Interactive Docs")

### How guidance was applied

1. **Installation first-try-correct (API Developer Portal / User Freedom):**
   the README leads with the exact `npm install @youge/assistant-sdk@0.1.0`
   command and keeps registry vs local consumption as two clearly-labeled
   fast paths — a consumer never has to read the release runbook to install.
2. **Atomic status per runbook step (Submit Feedback):** every RELEASE.md §4
   step now carries its own explicit status (`DONE`, `to be dispatched`,
   `OWNER ACTION`, `NOT DONE`) — no step leaves the reader guessing what
   happened.
3. **One contextual status sentence (Contextual updates):** the README status
   box and RELEASE.md banner state the release condition as a single precise
   sentence — "release-ready but **not yet published**; publication is the
   owner's runbook steps 3–5" — instead of bare flags.
4. **Version-list changelog pattern (Changelog / Release Notes):** the new
   `## 0.1.0 — 2026-11-06 (initial release)` section uses the product-type
   pattern (version + date heading, grouped scannable bullets: API, config,
   architecture, packaging, release engineering) above the running
   *Unreleased* log.

### Phase 4 — npm Trusted Publishing (OIDC) migration (2026-11-06)

The `ui-ux-pro-max-skill` was consulted for the OIDC migration. Its "When to
Apply" section directs skipping the skill for infrastructure/DevOps work that
does not change how something looks, feels, moves or is interacted with, so the
`--design-system` / `--domain` / `--stack` search workflow was **not** run —
no UI surface changed, and none may change for this infrastructure-only task.
The skill's documentation guidance was applied instead: `RELEASE.md` §6 leads
with requirements, uses scannable decision tables, keeps runbook steps atomic
with explicit guard/failure states, and the migration is recorded as an atomic
changelog entry above the version log. Skill instructions read from
`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`
(`.claude/skills/ui-ux-pro-max/SKILL.md`); no skill data or generated catalog is
committed.

## 13. First-publication GitHub Actions staging (2026-11-06)

The `ui-ux-pro-max-skill` instructions were located and read for this phase:
the repository's own references (`AGENTS.md` — *"the `ui-ux-pro-max-skill` is
mandatory for interface changes"* — and `DESIGN_FOUNDATION.md` §10–§12, plus
`WIDGET.md` §`ui-ux-pro-max-skill`), and the skill's `SKILL.md` from
`https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` (clone not
committed).

**Applicability decision (following the skill's own guidance):** its *When to
Apply* section says to skip the skill for *infrastructure/DevOps work that does
not change how something looks, feels, moves or is interacted with*. This task
— a GitHub Actions staging job, release-gate tests and runbook updates — is
exactly that: no UI surface was added, changed or removed, and none may change.
The skill's `--design-system` / `--domain` / `--stack` search workflow was
therefore **not run**, consistent with the recorded decision for the OIDC
migration (§10, *Phase 4*).

**Documentation guidance applied instead** (the same pattern as §10/§12): status
first (the RELEASE.md banner leads with *staged or published?* state), scannable
decision/verification tables (§6.1 requirements, §7 implementation-pass table),
atomic runbook steps with explicit per-step `Status:` guard states (§4 steps
3–9), and explicit failure/guard wording in the workflow header (what the stage
job can and cannot do, placeholder behaviour, revocation). No skill data or
generated catalog was committed.

## 14. OIDC trusted-publishing staging migration (2026-11-07)

The `ui-ux-pro-max-skill` was again evaluated against its *When to Apply*
section for this phase: migrating the release workflow's staging job from a
temporary `NPM_STAGE_TOKEN` secret to npm Trusted Publishing (OIDC) — workflow
permissions, validator/contract/test updates and runbook/status-doc wording —
is infrastructure/DevOps work with **no UI surface change**, so the skill's
`--design-system` / `--domain` / `--stack` search workflow was **not run**,
consistent with the recorded decisions in §10 (Phase 4) and §13.

**Documentation guidance applied instead** (same pattern as §10/§13): status
first (RELEASE.md banner leads with *published 0.1.0 + token-free OIDC* state),
scannable tables (§6.1 requirements rows, §6.3 trusted-publisher connection +
48-hour window, §7 migration-pass verification table), atomic runbook steps
kept their per-step `Status:` guard states — now marked DONE for the
bootstrap/revoke steps and OWNER ACTION for the trusted-publisher
registration — and explicit guard wording in the workflow header (exact stage
permissions, token-free authentication, never publish/approve/reject). The
first-publication bootstrap is recorded as *created, used and revoked*, and the
staged-publish-counts-as-first-publish question is documented **UNVERIFIED**
until tested. No skill data or generated catalog was committed.

## 15. 0.1.1 feature release — Android Chrome handoff + floating-icon auto-scale/manual adjust (2026-11-07)

The `ui-ux-pro-max-skill` *When to Apply* section **was applied** for this
phase: both features change how the interface looks, behaves and is interacted
with (new offer banner, new panel section, responsive launcher sizing), so the
skill's search workflow was run from a throwaway clone
(`/tmp/ui-ux-pro-max-skill`, not committed — per §1 header policy):

```bash
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "floating action button touch target safe area" --domain ux -n 3
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "range slider visible label accessible" --domain ux -n 3
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "in app browser redirect user consent" --domain ux -n 3
```

**Where the results landed:**

- **Touch target size (High):** every new control clears the web floor with
  margin — widget ranges and the *Adjust icon* summary are `min-height: 44px`,
  offer/adjust gaps are 8px (`touch-spacing`), example handoff buttons are
  40px. No hover-only affordances (`reliance on hover only` anti-pattern).
- **Back button / history (High):** the Chrome handoff never touches session
  history — no `pushState`, no `location.replace`, no automatic navigation;
  `intent://` runs only on an explicit button press and falls back to manual
  steps when it cannot leave the app (navigation-preservation intent behind
  the *Back Button* rule).
- **Input labels (High):** every range has a visible `<label for>` above it
  plus a live `<output>` value — never placeholder-as-label.
- **Compact control semantics (Critical):** native `<button>` and
  `<input type="range">` only (no clickable divs), with 3px `:focus-visible`
  outlines on summary, ranges and offer buttons.
- **Reduced motion (High):** no new `@keyframes`, no `animation:`, and no
  width/height transitions (the existing fab transition contract keeps
  holding); the reduced-motion block stays intact and the offer/adjust UI is
  state-change-only.

**Documentation guidance applied** (same status-first pattern as §10/§14):
RELEASE.md banner now leads with *0.1.1 prepared, NOT staged/published* while
keeping every wording-test phrase; SDK README gains a feature section +
handoff API table + `chromeHandoff` config; WIDGET.md §4/§5/§7/§8 document the
tiers, adjustment storage keys, offer flow, new tests and the one pathological
`#Intent;` hash limitation; CHANGELOG folds the OIDC Unreleased section into
`## 0.1.1 — 2026-11-07` with both feature entries on top.

**Files influenced:** `assistant-widget.js` (offer + adjust section,
persistence, focus preservation), `assistant-widget.css` (`--youge-fab-size`
tiers, panel-gap token, `.youge-chrome-offer` + `.youge-adjust` blocks),
`examples/example/src/main.jsx` + `examples/example/example.css` (React handoff banner),
`packages/assistant-sdk/src/browser/` (new module + types), SDK
`index.js`/`index.d.ts`/`config`/`assistant`/`react` wiring,
`scripts/sync-sdk-browser.mjs` + `assistant-state.js` (bundle), tests
(`sdk-browser` new, widget/example-ui/sdk-core/sdk-config-security extended),
`scripts/check.mjs` (15 new contracts + 0.1.1 gate). No skill data or
generated catalog was committed.

## 16. Unified hub and Configuration Playground (2026-11-19)

The `ui-ux-pro-max-skill` **was applied** to this interface work. Following the
repository-documented path, the official skill was cloned outside the repository
to `/tmp/ui-ux-pro-max-skill` (never committed) and its
`.claude/skills/ui-ux-pro-max/SKILL.md`, `references/quick-reference.md` priority
table and `references/pro-rules.md` canonical pre-delivery checklist were read.
The search tool was run with these verified queries (no `--persist`, so the
existing design-system files were not overwritten):

```bash
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "developer tool documentation landing page clean trustworthy" --design-system \
  --variance 4 --motion 2 --density 7 -p "You.Ge Assistant Hub"
python3 .../search.py "documentation hub navigation clear next step" --domain landing -n 3
python3 .../search.py "visible form labels helper text live preview" --domain ux -n 4
python3 .../search.py "focus visible keyboard controls" --domain ux -n 3
```

Verified results and application:

- **FAQ/Documentation Landing** pattern (hero → popular categories → FAQ →
  support CTA): the root hub opens with one plain-language hero, four real
  destinations, a compact feature directory and four short FAQ disclosures. No
  documentation wall or nested dashboard was added.
- **Form Labels / Input Labels / Submit Feedback** (High): every playground
  control has a visible `<label>`, a short explanation and a `role="status"`
  feedback line; copy and reset actions report their result.
- **Focus States / Focus Not Obscured (AA)**: `:focus-visible` outlines on all
  controls, `scroll-padding-top` for the sticky shared header, and focus-safe
  in-place DOM updates instead of rerendering the form.
- **Touch & responsive**: 44px minimum control height, system fonts, no zoom
  restrictions, `375px`-style single-column breakpoint, safe-area viewport and
  `prefers-reduced-motion` overrides.

The design-system search suggested a dark OLED palette and Google-hosted IBM
Plex/JetBrains fonts. Per `SKILL.md`, results are recommendations; that match
was rejected after fit verification because the page-specific
`docs/design-system/you-ge-assistant/pages/product-website.md` mandates the
light-first navy/violet identity, system fonts and no third-party font request.
The shared `product.css`/`product.js` chrome and the existing SVG symbol were
reused instead of introducing a new component library or emoji icons. No skill
data or generated catalog was added to the repository.

## 17. Configurable launcher attention (2026-11-24)

The `ui-ux-pro-max-skill` was actively used again for the launcher UI: the
official upstream checkout outside the repository was read, including its UX
search workflow, the accessibility/motion rules in `references/quick-reference.md`,
and the pre-delivery guidance in `references/pro-rules.md`. Targeted queries:

```bash
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "actionable attention animation reduced motion accessible launcher touch target" \
  --domain ux --max-results 5
python3 /tmp/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/scripts/search.py \
  "CSS animated launcher focus button performance" --stack react --max-results 5
```

The verified UX results advised honoring reduced motion, limiting the effect to
one context-relevant element, retaining semantic button/focus behavior, and not
relying on color alone. The effect is state-only and absent by default; when
reduced motion is requested it becomes a static border. It has no hit testing,
canvas, WebGL, hover dependency, or continuously running idle loop.

### React Bits compatibility decision

Inspected the actual Electric Border page and current source at
`src/content/Animations/ElectricBorder/ElectricBorder.jsx` and `.css` in
`DavidHDev/react-bits` (source browser reported commit
`ed33ebe4acfe29e60fb759bcccc70a138ce2dcef`, 2026-11-08). It is a React/WebGL
GLSL fragment-shader implementation, uses a canvas, has no npm dependency but
requires the React runtime, and exposes extensive shader parameters, including
Plasma, sparks, cursor surges and interaction settings. The inspected upstream
license is **MIT + Commons Clause v1.0**: its text expressly restricts
redistribution and porting of the components. Copying it into this distributable
SDK or shipping a port was therefore rejected. No React Bits code or runtime
dependency was added.

The SDK owns an original, small CSS/SVG electric-outline treatment instead.
It honors color, speed, intensity, launcher shape and action attention; the
supported effect name is `electric-border`, and the supported color treatment
is `plasma`. It deliberately omits shader noise, sparks, cursor interaction and
intro animation. The renderer applies it only to the launcher perimeter so the
brand mark remains centered and uncovered. It runs only while the shared state
contains eligible notification/action pairs and stops on viewed, completed,
dismissed/acknowledged, unavailable or expired items, unless another eligible
item remains.

### State/API and verification boundaries

The SDK already supplied centralized notices/actions, but not a viewed lifecycle
or a completion signal for host-owned actions. The extension is deliberately
small: `markViewed()` records currently actionable notifications separately
from acknowledgement; `completeAction()` (also the
`youge:action:complete` event) records completed action-linked notices. The
existing state engine still owns installation/network availability and action
priority; renderers contain no duplicate detectors. Per-project notice storage
remains backward-compatible and reads older records without `viewed` or
`completed` keys.

Tests cover normalized configuration, defaults, all shapes/fits, invalid-value
fallbacks, opt-in Plasma styling, real installation/network state, category
filtering, repeated/viewed/completed/dismissed action state, multi-action
priority, static reduced-motion behavior, pointer transparency, semantic
controls and backwards-compatible state configuration. The prior §8 static-only
launcher description is historical: the idle launcher is still unchanged, with
this new optional attention layer activated only for actionable state. No skill
data was committed.
