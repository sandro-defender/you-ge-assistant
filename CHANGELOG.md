# Changelog

## 1.1.1 (kit) — 2026-11-14 · precache integrity and cache refresh

Kit `1.1.0 → 1.1.1` (`progressier.js` `VERSION`, `PWA.version`, root
`package.json`, SDK `KIT_COMPAT_VERSION` and the regenerated
`assistant-state.js`). **SDK package unchanged at `0.2.0`**; nothing is tagged,
released, published or deployed by this change. Details:
[`PRECACHE_INTEGRITY.md`](PRECACHE_INTEGRITY.md).

- **New cache generation.** Worker caches are now `…:static:v1.1.1` and
  `…:pages:v1.1.1`. Existing `1.1.0` installations install the new worker beside
  the running one, show one update notice, and retire the `1.1.0` caches on
  activation. This also delivers, deterministically, the precached files that
  had changed under `1.1.0` without a version change.
- **Service-worker install is all-or-nothing.** `progressier.js` downloads the
  whole precache manifest, reading every body, before storing any of it, within
  a 120 s deadline. Previously every failure was swallowed, which could activate
  an incomplete shell after an update.
- **Required and optional precache assets.** `offline.html`, `offline.css`,
  `offline.js`, `pwa.css`, the default icon and `icons/icon-512.png` are
  required: a missing one fails the install. The domain, diagnostics, Assistant
  and QR files are optional and skipped only on 404/410 (or a host's HTML
  fallback page). 401, 403, 408, 409, 429, 5xx, network failures and timeouts
  fail the install for every asset; the installed version stays active and the
  browser retries.
- **Deployment note.** `pwa.css` must be deployed under the worker scope even
  with `data-no-css` or a custom `data-css`; the earlier "unless `data-no-css`"
  exception is withdrawn. Hosts that answer missing files with 403 must deploy
  the optional files or answer 404.
- **Diff-aware precache integrity gate.** `scripts/precache-integrity.mjs`
  (`npm run check`, `npm run check:precache`, CI) reads the precache list from
  the worker's install handler and fails when a precached file was modified,
  added, removed or renamed since the merge base without a synchronized, higher
  kit version, or when the kit-version declarations (worker, client,
  `package.json`, SDK `KIT_COMPAT_VERSION`) disagree.
- **Identity cleanup.** Remaining Progressier wording in comments (including the
  last two in `pwa.css`), check messages and reference/parity framing now
  describes You.Ge Assistant and its legacy compatibility contracts, inventoried
  in [`COMPATIBILITY_CONTRACTS.md`](COMPATIBILITY_CONTRACTS.md). No identifier,
  selector, storage key or path was renamed.

## 1.1.0 (kit) / SDK 0.2.0 — 2026-11-07 · adaptive theming

Kit `1.0.5 → 1.1.0`, SDK `0.1.1 → 0.2.0` (additive, minor for both). The SDK
release is **prepared in-repo, not staged and not published**.

- **Four theme modes with a validated public config.** `theme` now also accepts
  `{ mode: 'auto' | 'light' | 'dark' | 'custom', inheritHost, tokens, host,
  variables }` next to the unchanged 0.x string form. Every value is validated
  field by field with safe fallbacks and reported through the existing
  `meta.warnings` channel; `getConfig().theme` still returns the mode string and
  the validated record travels in `getConfig().themeConfig`. No new runtime
  dependency, no version change, no new initialization API.
- **Optional host adaptation.** `inheritHost: true` reads only accent,
  background, surface, text, muted text, border, font family, radius and
  integrator-supplied `--youge-*` variables — never layout, position, z-index,
  offsets, launcher size or motion. Every inherited colour passes a contrast
  guard; unusable host values are replaced with the Assistant's own and reported.
- **CSS isolation without Shadow DOM.** A narrow layout guard with a matching
  `[hidden]` rule, an inheritance boundary built from inherited private
  properties, a subtree control reset and scoped selectors only (no universal
  selector, no `:root`, no `!important` inside the reset).
- **Five notification tiers** (`critical`, `error`, `warning`, `info`,
  `success`) themed across fill, derived label ink, stripe width, glyph and title
  weight, plus per-tier accessible labels. The level is a presentation field
  derived from the unchanged priority ladder: ordering, suppression,
  persistence, acknowledgement and events are untouched, and the notification
  engine was not rewritten.
- **One definition, two renderers.** `NOTIFICATION_LEVEL_SHAPES`,
  `NOTIFICATION_LEVEL_ICONS`, `NOTIFICATION_LEVEL_LABELS`,
  `normalizeNotificationLevel()`, `notificationLevelMarkup()` and the
  `notificationLevelElement(level, createElement)` React helper are exported from
  the SDK, so the DOM widget and the React example share glyphs and wording.
- **React example studio** demonstrating all four modes, host adaptation
  (including a low-contrast trap), two custom palettes, a contrast audit and all
  five notification levels from the same tokens; the playground gains an
  Assistant theme section that drives the public `configure()` API, including an
  invalid palette that surfaces the warnings.

- **Circular panel logo.** The identity logo shown when the floating circle is
  pressed is a true circle (`border-radius: 50%`), zoomed from 36px to 44px
  with `object-fit: contain` so the circular mark fills the header and is never
  cropped into a rounded square; the React example panel matches at 40px.

- **Static launcher mark.** The React example's animated `ElectricLogo` canvas
  is removed everywhere: the floating circle shows one simple static zoomed
  mark (44px) with no WebGL runtime — `ogl` is dropped from the example —
  so no icon animation remains anywhere in the widget or the sample.

## 0.1.1 — 2026-11-07

- **Android in-app browser detection + Chrome handoff (reusable SDK
  feature, not project-specific).** New framework-independent
  `packages/assistant-sdk/src/browser/` module exported from the root
  entry, the frozen `YouGeAssistant` static and a new `./browser` subpath
  (paired TypeScript declarations): `detectInAppBrowser(userAgent)`
  classifies Facebook / Messenger / Instagram / Android WebView markers
  (Messenger wins over its FBAN parents; iOS in-apps are identified but
  never candidates; a missing user agent reports `uncertain: true`),
  `isChromeHandoffCandidate()` allows only confident Android restricted
  detections, `buildChromeIntentUrl(url, { packageName })` produces the
  best-effort Android `intent://…#Intent;…` handoff that preserves the
  original pathname, query **and** hash (the full URL also travels
  percent-encoded in `S.browser_fallback_url`; only absolute http(s) URLs
  are accepted), `chromeHandoffInstructions()` returns copy-ready manual
  steps, and `createChromeHandoff()` orchestrates detection → explicit
  `open()` → immediate/lingering failure → manual fallback with
  injectable `location`/`document`/`setTimeout` and a `destroy()` timer
  guard. Nothing navigates unless the caller invokes `open()` on a
  confident candidate: normal Chrome/Safari/other supported browsers,
  iOS in-apps and uncertain detections are never offered and never
  redirected. New `modules.chromeHandoff` config flag (default `true`,
  surfaced as `state.capabilities.chromeHandoff`). The shipped widget
  renders the **Open in Chrome** offer above the launcher for Android
  Facebook/Messenger/Instagram/webview sessions only, with a three-step
  manual fallback (original URL selectable, clipboard copy with a graceful
  manual hint), per-origin dismissal
  (`youge-assistant:chrome-offer-dismissed`) and no overlap with the open
  panel; the React example demonstrates the same SDK flow.
- **Floating Assistant entry point: automatic responsive scaling + manual
  adjustment.** The launcher diameter became a single token
  (`--youge-fab-size`, default 56px) with responsive tiers — 54px below
  480px (exact square/circle regression gates unchanged), 60px at
  ≥768px, 64px at ≥1280px — and the glyph follows `--youge-fab-glyph`;
  the panel gap and the Chrome offer track the launcher at its real size
  while `border-radius: 50%` keeps it a true circle at every tier. A new
  **Adjust icon** section in the panel exposes native range inputs
  (44–72px size, 0–160px horizontal/vertical; 44px touch targets,
  `touch-action: manipulation`, visible focus rings, labels + outputs):
  size applies as an inline override that outranks every media tier,
  horizontal/vertical override the configured offsets, values persist per
  origin as `youge-assistant:fab-adjust` (`{size,x,y}`) across reloads and
  PWA restarts, and **Reset to automatic defaults** clears both the inline
  styles and the stored value. Keyboard, touch and pointer share one
  delegated `input` path; still zero dependencies, no polling and no
  forced motion.


- **Staging migrated to OIDC — the release workflows are token-free end to
  end (2026-11-07).** The `stage` job of `.github/workflows/sdk-release-prep.yml`
  gained `id-token: write` (npm Trusted Publishing is technically required
  for `npm stage publish`) and lost the temporary `NPM_STAGE_TOKEN` /
  `NODE_AUTH_TOKEN` mechanism entirely: `verify`, `stage` and `publish` all
  authenticate without a stored npm credential, and the workflow contains
  **zero npm token references** (machine-checked — any `NODE_AUTH_TOKEN` or
  `secrets.NPM_*` reference fails `validate-package.mjs` and `check.mjs`).
  The first-publication bootstrap is recorded as **created, used and
  revoked** (`RELEASE.md` §4/§6.4); its temporary secret was already deleted.
  Stage permissions are exactly `contents: read` + `id-token: write`. All
  publication gates are unchanged: manual dispatch only, `action=stage` +
  `confirm_stage=stage` from `main` after `verify`, the protected
  `sdk-npm-publish` environment, `SDK_RELEASE_CONFIRM=publish` (accidental-
  publish guard), and the workflow never runs `npm publish`,
  `npm stage approve` or `npm stage reject`. The npm Trusted Publisher
  connection (owner-configured, after reviewing/merging this change) must
  allow **`npm stage publish` AND `npm publish`** on one connection — owner
  `sandro-defender`, repo `you-ge-assistant`, workflow `sdk-release-prep.yml`,
  environment `sdk-npm-publish` — and npm's **48-hour** first-publish
  validation window applies from connection creation; whether a staged
  publish counts toward that window is documented as **UNVERIFIED** until
  tested (`RELEASE.md` §6.3).
- **Publishing authentication migrated from a long-lived npm token to npm
  Trusted Publishing (OIDC).** `.github/workflows/sdk-release-prep.yml` now
  authenticates the publish job with a short-lived OIDC token minted by
  `id-token: write`; the publish step sets only `SDK_RELEASE_CONFIRM` and the
  verify, stage and OIDC publish paths use **no npm token at all** (the
  workflows contain no npm token reference whatsoever — the temporary
  first-publication `NPM_STAGE_TOKEN` bootstrap was created, used and revoked
  after the 0.1.0 staging).
- **Publish toolchain pinned to the official OIDC requirements:** the publish
  job runs Node `24` (Node ≥ 22.14.0 / npm ≥ 11.5.1), sets
  `registry-url: https://registry.npmjs.org` and `package-manager-cache: false`,
  and adds a guard step that fails the run unless npm ≥ 11.5.1.
- **All existing safeguards preserved:** manual `workflow_dispatch` only;
  `action=publish` **and** `confirm_publish=publish`; `SDK_RELEASE_ENABLED =
  'true'` (left **unset** until the owner explicitly approves); the protected
  `sdk-npm-publish` environment with required reviewers (**owner-configured** —
  its reviewer protection is to be verified, not recreated); and the
  `prepublishOnly` `SDK_RELEASE_CONFIRM=publish` check. `action=verify` remains
  completely non-publishing.
- **Security wording corrected:** `SDK_RELEASE_CONFIRM=publish` (and the other
  in-repo gates) are **accidental-publish guards, not cryptographic
  authorization boundaries**. The real boundaries are npm organization
  permissions / account security (2FA), the protected environment's required
  reviewers, and the npm Trusted Publisher registration. Direct manual
  publishing is not claimed to be impossible — the workflow header, its
  publish-step comment and §4/§5 no longer say that `prepublishOnly` makes a
  direct `npm publish` impossible (`tests/release-security-wording.test.mjs`
  locks the wording in).
- **First-publication procedure corrected (§6.4).** `npm login` is **not** a
  tokenless path: the `npm-login` reference states it *"automatically generates
  a legacy token of `publish` type"* and saves credentials to `.npmrc`, and the
  current *About access tokens* page says legacy tokens were **removed in
  November 2025**. Every "no token"/"tokenless" claim was removed. The
  documented bootstrap now uses a **minimum-permission granular access token**
  created on npmjs.com (website-only), scoped to the package, **Bypass 2FA
  off**, shortest available expiry, used for that one publish and **revoked
  immediately** — never committed, logged or stored in a secret. Two paths are
  documented: **staged publishing** (`npm stage publish` + maintainer approval
  with 2FA — recommended) and direct publishing (deprecated by npm, **removed
  January 2027**). Both set `SDK_RELEASE_CONFIRM=publish` for that one command,
  pass `--access public`, and produce **no OIDC provenance**; a `--tag next`
  pre-release is the way to keep provenance for the real first release. After
  the package exists, the trusted publisher is registered and all subsequent
  releases use OIDC.
- **Staged bootstrap audited against the npm CLI source (§6.4):** the token can
  be scoped to the `@youge` **scope** before `@youge/assistant-sdk` exists — the
  *Organizations* section must not be used, since it grants no package publish
  rights. The safest configuration is **Read and write (stage only)** with
  **Bypass 2FA off**, which npm's token-behavior table confirms is sufficient to
  stage. `npm stage publish` is implemented as `StagePublish extends Publish`,
  so it **does** run `prepublishOnly` and `SDK_RELEASE_CONFIRM=publish` is still
  required (the docs' *Scripts* page is stale on this). `npm stage approve
  <stage-id>` accepts an optional `--otp <code>` and otherwise prompts
  interactively. Staging a new package publishes a public `0.0.0-stage`
  placeholder; the real `0.1.0` stays hidden until a maintainer approves with
  2FA. The credential is supplied only to the stage job's staging step and
  never placed in repo files, history, logs, artifacts or transcripts; its
  only permitted storage is the dedicated `NPM_STAGE_TOKEN` Actions secret,
  deleted immediately after staging.
- **Trusted-publisher limits reconciled (§6.3):** the npm website allows **up
  to 10 trusted publisher connections per package** (independently
  add/deleted); the CLI reference still says one per package. Where the two
  disagree the website UI is treated as authoritative. Also documented: the
  2-day first-publish validation window, immutable connections (delete +
  re-create), automatic provenance over OIDC (no `--provenance` flag needed),
  dist-tag permission (npm ≥ 11.21.0 / 12.2.0) and stage-only as the
  maximum-security posture.
- **First publication staged from GitHub Actions — no PC terminal.**
  `sdk-release-prep.yml` gains a manual-only `stage` job: dispatch with
  `action=stage` **and** `confirm_stage=stage` **from `main`**, after the full
  `verify` job, inside the existing protected `sdk-npm-publish` environment,
  on `ubuntu-latest` with `permissions: contents: read` + `id-token: write`
  (exactly those two — the OIDC migration replaced the original
  least-privilege/no-OIDC setup). It guards **npm ≥ 11.15.0**
  (staged-publishing requirement), runs the package validator immediately
  before `npm stage publish --access public` from `packages/assistant-sdk`,
  and authenticates with **npm Trusted Publishing (OIDC) — no token of any
  kind** (the original bootstrap used the dedicated repository secret
  **`NPM_STAGE_TOKEN`** — granular token: *Read and write (stage only)*,
  `@youge` scope, Bypass 2FA off, owner-created — for the actual 0.1.0
  staging on 2026-11-06; it was created, used and revoked, and the secret is
  deleted).
  `SDK_RELEASE_CONFIRM=publish` is set only for the staging command because
  `npm stage publish` executes the publish lifecycle. The job **stages, never
  publishes**: no `npm publish`, no `npm stage approve`/`reject`, no
  `SDK_RELEASE_ENABLED`; its run summary reports the **stage ID**, the
  **staged-NOT-published** state, the possible public **`0.0.0-stage`
  placeholder**, the OIDC (no-token) authentication, and the owner's approval
  (npmjs.com → Staged Packages → Approve with 2FA) and trusted-publisher
  registration steps. `RELEASE.md` §4/§6.2/§6.4 document the full procedure
  (token → secret → dispatch → approve → revoke → OIDC registration); every
  job — verify, stage and publish — uses **no npm token**.
- **Enforcement extended:** `validate-package.mjs` and the standing contracts
  in `scripts/check.mjs` now also require the OIDC configuration (`id-token:
  write` on both jobs, registry URL, hosted runner, Node 24, canonical
  `repository.url`), the stage-job gates (manual-only + `confirm_stage`,
  `refs/heads/main`, `needs: verify`, protected environment, **exact OIDC
  permissions `contents: read` + `id-token: write`**, token-free authentication
  everywhere — any `NODE_AUTH_TOKEN` / `secrets.NPM_*` reference fails,
  `npm stage publish` only, no approve/reject, staged-NOT-published summary),
  plus structural contracts — **the `verify` job never publishes**, **the
  workflow never claims direct publishing is impossible**, no token material
  (`npm_…` values or `.npmrc`) exists anywhere in the repository, and no
  workflow references any secret at all (except the built-in `GITHUB_TOKEN`).
  `tests/release-gates.test.mjs` gains mutation coverage for these (removing
  the stage job's `id-token: write`, widening its permissions, or reintroducing
  any npm token reference all fail validation); the
  `tests/release-security-wording.test.mjs` suite locks in the corrected
  security wording and the OIDC documentation requirements (bootstrap recorded
  as created/used/revoked, `id-token: write`, 48-hour window, UNVERIFIED).
- **Documentation:** `packages/assistant-sdk/RELEASE.md` gains §6 (OIDC
  requirements, workflow configuration, trusted-publisher registration via
  `npm trust` ≥ 11.15.0, and the first-publish bootstrap); §3/§4/§5/§7/§8
  updated. Verified with **159/159** tests passing.

> **0.1.0 published (2026-11-06)** via the staged-approval flow; the
> temporary bootstrap was created, used and revoked. No GitHub secrets,
> variables, permissions, tags or releases were created or changed by this
> repository's automation, and the `sdk-npm-publish` environment was neither
> created nor modified. The trusted-publisher registration (with its 48-hour
> validation window) and the `SDK_RELEASE_ENABLED` approval remain owner
> actions.

## 0.1.0 — 2026-11-06 (initial release)

First release of **`@youge/assistant-sdk`** — the framework-independent SDK
core for You.Ge Assistant (npm org `youge`, scope `@youge`; corrects the
never-published working name `@you-ge/assistant-sdk`).

- **Public API:** `YouGeAssistant.create()` / `.attach()` / `.getGlobal()`
  shared-singleton lifecycle with `getState`, `subscribe`, `configure`,
  `runDiagnostics`, `requestInstall`, `dismiss`, `acknowledge`, `destroy`;
  subpath exports `./domain`, `./config`, `./diagnostics`, `./installation`,
  `./react`, each with paired TypeScript declarations. Notification priority
  ladder frozen: `1 critical → 2 auth → 3 backup → 4 install → 5 info`.
- **Configuration:** data-only `publishedConfig` validation (schema `1`) with
  bundled defaults → validated published revision → project overrides →
  Last-Known-Good fallback; executable-JS payloads, dangerous URLs and
  secret-shaped keys are rejected before they reach state or storage.
- **Architecture:** zero runtime dependencies (`react` optional peer for the
  `useSyncExternalStore` adapter only), ESM-only, buildless `src/` runtime,
  wildcard-free `exports` map (internal sources unreachable), `sideEffects:
  false`, no `fetch`, no polling, no telemetry, no service-worker registration.
- **Packaging:** MIT license, progressive-disclosure README (quick start →
  subpath table → config/security pipeline → API reference → host-integration
  example), `files` whitelist (19 files, ~33 kB packed / ~132 kB unpacked),
  `publishConfig.access: "public"`, `prepublishOnly` validation **and**
  publish-authorization gate (any `npm publish` without the gated workflow's
  `SDK_RELEASE_CONFIRM` is refused).
- **Release engineering:** `packages/assistant-sdk/scripts/validate-package.mjs`
  (identity, version sync, export map + declarations, tarball contents,
  dependency policy, source hygiene, publishing-gate checks) wired into
  `npm run check`, the `check` workflow and `prepublishOnly`; manual-only
  `sdk-release-prep.yml` release workflow with explicit-authorization publish
  gates; release runbook and registry decision in
  [`packages/assistant-sdk/RELEASE.md`](packages/assistant-sdk/RELEASE.md);
  vendored-copy migration guide in
  [`packages/assistant-sdk/MIGRATION.md`](packages/assistant-sdk/MIGRATION.md).

Release prepared per [`RELEASE.md`](packages/assistant-sdk/RELEASE.md) §4;
npm publication is executed separately by the repository owner (runbook §4 —
staged via GitHub Actions, then approved on npmjs.com) and is **not** claimed
by this entry. The detailed development log follows under *Unreleased*.

## Unreleased

- **Repository rename maintenance (2026-11-06):** the GitHub repository was
  renamed `sandro-defender/PWA-Helper` → **`sandro-defender/you-ge-assistant`**.
  Updated all active GitHub repository URLs, GitHub Pages links
  (`sandro-defender.github.io/you-ge-assistant/`), the clone command, the demo
  footer links, the documented Pages subpath (`/you-ge-assistant/`), and the
  SDK package's npm metadata (`repository`/`homepage`/`bugs`) to the canonical
  URL. The `foundation-contracts` suite now asserts the canonical URL and
  rejects stale `github.com`/`github.io` links. Intentionally kept: session
  branch slugs (`arena/*-pwa-helper`), local sandbox paths
  (`/home/user/PWA-Helper`) in historical command records, and "pwa-helper"
  product language for the existing toolkit. No SDK release logic, package
  version, or runtime behavior changed.
- **Package rename:** the SDK's npm identity is corrected to
  **`@youge/assistant-sdk`** (was `@you-ge/assistant-sdk`, based on an
  incorrect assumption about the organization scope). The final identity is
  confirmed by the project owner: npm user `you-ge`, npm org `youge`, scope
  `@youge`. Nothing was ever published under the old name, so the rename is
  pre-publication and breaks no consumer. Registry verification (2026-11-06):
  `@youge/assistant-sdk` unpublished (404), zero packages under `@youge/*`
  (no third-party conflict), org/scope `youge` exists. Updated consistently
  across package metadata, validation scripts and contracts
  (`validate-package.mjs`, `scripts/check.mjs`), the generated-bundle sync
  script and source headers, tests, the React example (imports, dependency
  key and lockfile), the release workflow header, and all documentation
  (README, RELEASE, MIGRATION, AGENTS, architecture/audit docs, design-skill
  record). Unrelated You.Ge branding is untouched (`you-ge-assistant` root
  package, `YouGeAssistant` API, `youge-assistant:*` storage keys, product
  name You.Ge, `staff.you.ge`). At that point the package still carried
  `"private": true` with all publishing guards intact (the lock is removed
  later, in the 0.1.0 release PR); nothing was published, released or tagged.

- Prepared `@youge/assistant-sdk` for versioned distribution (**release
  preparation only — publishing stays disabled, nothing was published, no
  release or tag created**):
  - Package metadata reviewed and extended (`packages/assistant-sdk/package.json`):
    kept `@youge/assistant-sdk@0.1.0`, ESM-only with paired `.d.ts` per export
    entry, explicit subpath `exports` map with no wildcards (deep imports of
    internal sources stay blocked), `publishConfig.access: "public"`,
    `homepage`/`bugs` added, zero runtime dependencies preserved (`react`
    remains an optional peer). The `"private": true` flag served as the
    accidental-publish lock at the time and is documented as such (removed in
    the 0.1.0 release PR per the runbook).
  - New release gate `packages/assistant-sdk/scripts/validate-package.mjs`
    (zero dependencies, offline): package identity, semver, version
    synchronization (`package.json` ↔ `SDK_VERSION` ↔ `KIT_COMPAT_VERSION` ↔
    runtime version), export-map targets + TypeScript declarations, `files`
    whitelist and `npm pack --dry-run` contents (runtime files only), README/
    LICENSE presence, dependency policy, source hygiene (package-relative
    imports only), and the `private: true` guard. Wired into `npm run check`,
    the `check` workflow and as `prepublishOnly` on the package.
  - Publishing-destination evaluation documented in
    `packages/assistant-sdk/RELEASE.md` with the recommendation **public npm**
    (Cloudflare builds need no auth; GitHub Packages would force a
    `@sandro-defender` scope rename, auth on every install, and token plumbing
    into Cloudflare builds — the secure configuration required for that path is
    recorded there). The registry/name situation recorded at preparation time
    (old scope unregistered) was superseded by the confirmed identity — see the
    package-rename entry below.
  - Release procedure documented (`RELEASE.md`): release runbook with
    version-bump rules, guard-removal checklist and post-publish smoke tests,
    plus the three independent publishing locks (package `private` flag,
    manual-only `workflow_dispatch` release workflow with explicit-approval
    gates, no registry credentials).
  - New `.github/workflows/sdk-release-prep.yml` (**manual dispatch only**, no
    push/PR/merge triggers): full release checklist — SDK tests, build/sync
    verification, package + version validation, "version not already published"
    check and consumer build. The `publish` job is structure-only and requires
    action=publish + confirm input + `SDK_RELEASE_ENABLED` repo variable
    (unset) + protected `sdk-npm-publish` environment + `NPM_TOKEN` secret
    (not configured).
  - Consumer migration guide `packages/assistant-sdk/MIGRATION.md`: how
    `staff.you.ge` replaces its vendored `packages/assistant-sdk` copy (the
    PR #249 vendor pin recorded in its `VENDORING.md`) with the published
    package — drop-in import mapping, exact-version pin, verification
    checklist, stateless rollback and compatibility guarantees (SDK `0.1.0`,
    kit compat `1.0.5`, config schema `1`). `staff.you.ge` was not modified.
  - SDK README updated: release status, registry consumption (ESM-only policy),
    versioning policy, and the validation commands.

- Refined the floating assistant entry point (visual only, no API change):
  - `assistant-widget.css`: `.youge-fab` is now a **true circle**
    (`border-radius: 50%` on a square 56px box, 54px below 480px) with a calm,
    low-saturation fill, a hairline ring, one short elevation shadow and a soft
    inner sheen that is itself circular — no glow, no blur, no `@keyframes`.
    Measured glyph contrast: 9.45:1 (light) and 11.01:1 (dark/auto-dark), up
    from 5.41:1 and **2.23:1** (the old light-blue dark fill was below the 3:1
    non-text floor).
  - The button turns the toolkit's **red only for actionable events**: its
    `data-tone` is the existing `state.badge.tone`, and `critical`, `auth` and
    `install` (connection loss, DNS failure, dead primary endpoint, session
    attention, an available install) paint it with `--youge-critical`. `info`,
    `backup` and `none` stay neutral, so an optional update, a restored
    connection, a feature announcement, a backup endpoint already serving the
    app, a diagnostic in progress, an idle or dismissed assistant never read as
    urgent. No new state, no second source of truth, no polling; the count badge
    (inverted for legibility on red) and the `aria-label` phrase repeat the
    message so color is never the only signal.
  - Two shared motion tokens replace one duration everywhere
    (`--youge-motion-fast: 160ms` for hover/press feedback,
    `--youge-motion-state: 240ms` for the state color/border/shadow change);
    hover travel dropped to 1px and press to `scale(0.98)`;
    `prefers-reduced-motion` removes both durations and the travel while the
    color state still changes.
  - `example/`: the sample launcher keeps its circular geometry but clips the
    `ElectricLogo` layer to the disc (`inset: 0` + `overflow: hidden` +
    `border-radius: 50%`, no `filter: drop-shadow`), loses its blurred outer
    halo, dims the spotlight/glow/flicker/strands and the `GlareHover`
    highlight, no longer chases the cursor, and mounts only while hovered,
    focused or open — an idle assistant now runs no animation loop at all. Its
    fill follows the same actionable-tone list as the shipped widget, asserted by
    a parity test.
  - Tests: `tests/assistant-widget.test.mjs` gained 7 and
    `tests/example-ui.test.mjs` 4 assertions covering the circle, the subdued
    resting state, computed WCAG contrast of the FAB tokens in light/dark/
    auto-dark, the actionable-tone list (and that `info`/`backup`/`none` never
    match), the motion tokens, reduced-motion behavior, the tone following real
    state through dismiss/connectivity changes, and the accessibility contract.
- Fixed the defects found by the November 2026 audit (full findings table in the
  bug-fix pull request). Summary by area:
  - **React adapter**: `getExternalStoreBindings` memoizes the resolved assistant
    instance and caches selector results, so a getter that attaches/configures no
    longer re-configures on every render (`useSyncExternalStore` calls
    `getSnapshot` per render) and subscribers stop re-rendering on unchanged
    state. Selector identity is now stable across emits.
  - **Toolkit rendering**: install-button labels (from `data-install`,
    `data-installed` or config) are HTML-escaped before being composed into the
    button's `innerHTML`, so an untrusted attribute value can no longer inject
    markup into the install button or the push subscribe button. The icon markup
    stays a fixed internal SVG constant.
  - **Navigation safety**: new `safeNavigationUrl` guard (SDK root + `./domain` +
    `DomainResolver`, plus `window.YouGeDomain` in `domain-config.js`) accepts only
    http(s) absolute URLs and root/relative paths. The service worker routes every
    push-payload notification target (including per-action URLs) through it, so a
    payload can no longer drive `client.navigate()`/`openWindow()` into
    `javascript:`/`data:`/`vbscript:` or a protocol-relative cross-origin escape.
  - **Recovery data**: a Last-Known-Good record must declare the `projectId` it is
    read under; an unscoped or foreign record is refused instead of being trusted
    as this project's config, and cross-project config leakage is closed.
  - **Update notice**: the toolkit adapter seeds `network.updateAvailable` from
    `hasUpdate`, so the "apply update" notice and action appear for an already
    waiting worker instead of staying silent.
  - **Notifications**: `requestNotificationPermission` supports the callback-only
    `Notification.requestPermission` signature (older Safari/WebKit), resolves
    exactly once and never throws, so a granted permission is not read as
    `undefined` and subscription flows keep working.
  - **Widget**: notice action buttons reuse the toolkit's delegated hooks
    (`data-pwa-install`, `data-pwa-diagnostics`) and carry the action's real
    wording instead of an inert "Open"; Escape yields to an open toolkit dialog;
    host-supplied appearance values are re-validated before reaching the DOM (no
    `undefinedpx` offsets, only `#hex` brand colors, whitelisted positions/themes);
    `.youge-btn-small` meets the 44px touch-target floor; the auth badge gains
    AA-contrast ink in dark and auto-dark themes.
  - **Offline page**: the connection badge is now a polite atomic live region
    (`role="status" aria-live="polite" aria-atomic="true"`) with the decorative dot
    hidden from assistive tech, so "Connection restored" is announced.
  - **Example app**: the React notice actions use the same toolkit hooks and
    labels, replacing dead "Open" buttons.
  - **Tests/docs**: regression coverage for every item above (`npm test` now runs
    121 tests), README/`react.d.ts` wording on hook resolution, `WIDGET.md`
    interaction notes; the offline example (`example/example.js`) install-button and
    permission paths are covered by the vm-backed install-experience suite.
- Extracted the framework-independent **Phase 2 SDK package** locally at
  `packages/assistant-sdk/` (`@youge/assistant-sdk` v`0.1.0`, `"private": true`
  — prepared for future npm publishing without publishing, releasing or tagging):
  modular ESM core (`core`, `domain`, `config`, `diagnostics`, `installation`,
  `assistant`, `adapters`), subpath exports (`.`, `./domain`, `./config`,
  `./diagnostics`, `./installation`, `./react`), `.d.ts` TypeScript declarations,
  data-only `publishedConfig` + project-scoped Last-Known-Good (`LKG`) fallback
  with executable-code and secret rejection, deterministic browser state sync
  (`scripts/sync-sdk-browser.mjs` → `assistant-state.js`), `example/` consumption
  via `file:../packages/assistant-sdk`, standalone SDK tests
  (`packages/assistant-sdk/tests/`) and toolkit integration tests
  (`tests/sdk-integration.test.mjs`). All `window.PWA`, `/progressier.js`,
  manifest, DNS diagnostics and widget behaviors remain backward-compatible; no
  standalone dashboard, remote config fetch, production API failover or
  `staff.you.ge` change was added.
- Added the You.Ge Assistant platform foundation: a Phase 0 re-audit
  (`FOUNDATION_AUDIT.md`), the future dashboard/SDK/multi-domain/configuration/
  security/failover architecture with a diagram and phased roadmap
  (`ASSISTANT_ARCHITECTURE.md`), and a frozen installation experience record plus
  future SDK install contract (`INSTALLATION_EXPERIENCE.md`). No dashboard, SDK
  package, central config service, failover, `staff.you.ge` integration, npm
  publish or production deployment was added.
- Applied the ui-ux-pro-max-skill design system and adopted three zero-dependency
  React Bits TypeScript + CSS components (`SpotlightCard`, `GlareHover`,
  `LatticeLoader`) in the isolated example; documented every adoption decision
  in `DESIGN_FOUNDATION.md`. Incremental install-sheet and banner accessibility
  improvements (visible focus, 44px close target, contrast-safe note,
  `aria-labelledby`/`aria-describedby`, reduced motion) preserve all behavior.
- Implemented the **Intelligent Floating Assistant** as a reusable core widget:
  `assistant-state.js` (one centralized, event-driven state model and
  configurable SDK API), `assistant-widget.js` / `assistant-widget.css`
  (dependency-free DOM renderer), and a React renderer in `example/src/main.jsx`
  using `useSyncExternalStore` plus the already-vendored React Bits
  `GlareHover`, `SpotlightCard` and `LatticeLoader` sources. Real-condition
  badges, the fixed 1–5 priority ladder, in-place panel, dismissal/acknowledgement,
  project-scoped repeat suppression, safe-area/reduced-motion support and
  single-flight diagnostics are covered by `WIDGET.md` and 24 new tests in
  `tests/assistant-widget.test.mjs`. `pwa.js` install delegation and the single
  `progressier.js` worker remain intact; no dashboard, remote config service,
  production failover or `staff.you.ge` integration was added.
- Added `tests/install-experience.test.mjs` (DOM-harness verification of the
  existing install flow, platform detection, dismissal and worker registration)
  and `tests/foundation-contracts.test.mjs` (manifest, offline, identity,
  security and design contracts). Added an isolated `tsc --noEmit` type-check
  gate for the React example; extended `scripts/check.mjs` and CI accordingly.
  No existing tests were removed or weakened.

- Rebuilt the GitHub Pages user-facing example with an isolated React/Vite app and
  a fixed, interactive React Bits ElectricLogo assistant launcher, persistent
  logo mark, and quick actions; clarified local-storage failures in the sample
  check-in/checklist interactions and added UI regression tests. React, Vite and
  OGL remain out of the core toolkit dependencies.

## 1.0.5 — You.Ge Assistant multi-domain upgrade

- Rebranded the package and default application identity to You.Ge Assistant.
- Added centralized hostname/origin/subdomain/base-path detection and a validated,
  public domain/subdomain configuration registry with safe unknown-host defaults
  and per-domain installation/offline/sharing/push/badge/QR/diagnostic switches.
- Added a host-aware manifest response helper and Cloudflare Pages Functions
  adapter, retaining a static fallback and the existing legacy manifest ID.
- Kept the `/progressier.js` worker path, public PWA API, and legacy IndexedDB
  names. Added hostname/registered-scope/version cache namespaces and scoped
  cleanup; only explicitly public HTML is cached or migrated, and older
  shared-name caches are retained safely.
- Updated offline fallback branding/context, scoped retry URLs, and offline DNS
  recovery guidance.
- Added on-demand Cloudflare DoH A/AAAA diagnostics for the active hostname,
  response validation, bounded retries, deduplication, timeout handling and
  cautious classifications. Added Android Private DNS and iOS DNS-only recovery.
- Added Node unit tests for host resolution, manifest responses and mocked DNS
  outcomes; extended CI/static checks and refreshed multi-domain deployment docs.

### Validation status

The automated tests are mock/unit tests. They do not verify real ISP DNS
interference, deployed Cloudflare CORS behavior, production host routing, or
browser installation on physical Android/iOS devices. Those remain deployment
acceptance checks.
