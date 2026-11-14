# Migrating from the vendored SDK copy to the published package

> **Audience:** `staff.you.ge` (and any consumer that vendors a copy of the
> SDK under `packages/assistant-sdk/` with a `VENDORING.md` pin, as done in
> `staff.you.ge` PR #249).
>
> **Status:** `@youge/assistant-sdk@0.1.0` is **published** (2026-11-06 —
> staged via the GitHub Actions `stage` job, then approved by the owner on
> npmjs.com with 2FA; see [`RELEASE.md`](RELEASE.md) §4). The first version is
> now on npm, so this migration plan is executable. Nothing in this document
> modifies `staff.you.ge`.
>
> **0.1.1 (published 2026-11-07):** additive release — new `./browser`
> subpath (Android in-app browser detection + Chrome handoff) and the
> widget's launcher auto-scale/manual-adjustment.
>
> **0.2.0 (prepared 2026-11-07, not staged):** additive release — adaptive
> theming (`theme` object config, `./theme` subpath, notification level
> metadata, React `resolveAppearanceTheme`/`notificationLevelElement`).
> Nothing in the 0.1.0 vendored-copy contract changes; a vendored `0.1.0`
> or `0.1.1` pin keeps working unchanged.

Compatibility references: **SDK `0.1.0`** (public API per [`README.md`](README.md)),
**kit compatibility `1.2.0`** (`KIT_COMPAT_VERSION` in the repository; the published `0.2.0` reports `1.1.0`), **config schema `1`**.

---

## 1. What the vendor pin is

`staff.you.ge` keeps a **vendored copy** of the SDK sources at
`staff.you.ge/packages/assistant-sdk/`, with `staff.you.ge/packages/assistant-sdk/VENDORING.md`
recording the pin (source repository `sandro-defender/you-ge-assistant` —
recorded there before the GitHub repository rename — the pinned
commit, and the SDK version). PR #249 introduced that copy so the staff app can
consume the SDK before any package registry existed.

> **Inspection note:** `staff.you.ge` is a private repository that this
> repository's automation cannot read (GitHub API returns *Resource not
> accessible by integration*). This plan is written against the vendor-pin
> model recorded there and against SDK `0.1.0` as the compatibility reference.
> Before executing the migration, re-verify the exact contents of
> `staff.you.ge/packages/assistant-sdk/VENDORING.md` (pinned commit and version)
> in the consumer repository and confirm they match `0.1.0`.

## 2. Why move to the versioned package

| Vendored copy | Published package |
| --- | --- |
| Updates are manual copy commits | Updates are a one-line version bump with semver guarantees |
| Drift between consumer copy and upstream is invisible | `CHANGELOG.md` + semver describe every change |
| No lockfile entry; hard to audit which code ships | Exact version + lockfile integrity hash |
| Deep imports into copied internals possible | `exports` map is the only surface; internals unreachable |

The published files are **the same modules** the vendor pin copies: the package
is buildless, `src/` is the runtime, and the vendored copy was taken from that
same tree. Replacing the vendor pin with the package is therefore a path change,
not a code change.

## 3. Drop-in replacement mapping

The import surface is identical. Only specifiers change:

| Vendored import (relative path) | Published package import |
| --- | --- |
| `.../packages/assistant-sdk/src/index.js` | `@youge/assistant-sdk` |
| `.../packages/assistant-sdk/src/domain/index.js` | `@youge/assistant-sdk/domain` |
| `.../packages/assistant-sdk/src/config/index.js` | `@youge/assistant-sdk/config` |
| `.../packages/assistant-sdk/src/diagnostics/index.js` | `@youge/assistant-sdk/diagnostics` |
| `.../packages/assistant-sdk/src/installation/index.js` | `@youge/assistant-sdk/installation` |
| `.../packages/assistant-sdk/src/adapters/react.js` | `@youge/assistant-sdk/react` |

Rules:

- Import **only** the package subpaths above. Deep paths such as
  `@youge/assistant-sdk/src/core/constants.js` are blocked by the `exports`
  map (by design).
- No API changes are required: `YouGeAssistant.create/attach/getGlobal`,
  `bridgePwaGlobals`, the state/notification priority ladder, the config
  pipeline and all event names are unchanged between the vendored `0.1.0` copy
  and the published `0.1.0` package.

## 4. Migration steps (in staff.you.ge)

1. **Pin the exact version** in `staff.you.ge/package.json`:
   ```json
   {
     "dependencies": {
       "@youge/assistant-sdk": "0.1.0"
     }
   }
   ```
   Use an **exact pin** (no `^`/`~`) to mirror the vendor-pin semantics; upgrades
   become deliberate edits, like the old `VENDORING.md` bumps.
2. **Rewrite imports** to the package subpaths ([§3](#3-drop-in-replacement-mapping)).
3. **Delete the vendored copy**: `staff.you.ge/packages/assistant-sdk/` (the
   sources and `VENDORING.md`) once no import references it.
4. **`npm ci`** — with the package on public npm (the recommended registry,
   [`RELEASE.md`](RELEASE.md) §3) no authentication is needed in local dev or
   in Cloudflare builds.
5. **Verify** with the checklist in [§5](#5-verification-checklist).

## 5. Verification checklist

- [ ] `package.json` pins the exact SDK version; the lockfile contains exactly
      that version and an integrity hash.
- [ ] `grep -r "packages/assistant-sdk" staff.you.ge/src` finds **no** remaining
      vendored-path imports.
- [ ] `YouGeAssistant.version` reported at runtime equals the pinned version.
- [ ] `YouGeAssistant.kitCompatVersion` is compatible with the staff app's PWA
      kit line (currently `1.1.x`).
- [ ] Type-check, unit tests and production build pass (`tsc`, test runner,
      `vite build` / Cloudflare build).
- [ ] Behavior unchanged vs the vendor pin:
      - single centralized state instance (`attach` shares `window` singleton);
      - single service worker registration (`/you-ge-sw.js` on fresh installs, or preserved `/progressier.js` shim on upgraded legacy installs);
      - notification priority ladder `1 critical → 2 auth → 3 backup → 4 install
        → 5 info` unchanged;
      - config pipeline `defaults → published → overrides → last-known-good`
        unchanged (`SCHEMA_VERSION 1`, LKG keys
        `youge-assistant:lkg:<projectId>` unchanged);
      - no new network traffic, polling or telemetry (SDK contains no `fetch`).
- [ ] Install prompts still delegate to `window.PWA.promptInstall()` (the SDK
      never registers a competing install flow).
- [ ] Optional: diff the resolved package contents against the last vendored
      commit (`npm diff --diff=@youge/assistant-sdk@0.1.0` or checksum the
      `src/` trees) for byte-level confidence.

## 6. Rollback

Stateless and immediate:

1. Revert `package.json`/lockfile to the pre-migration state.
2. Restore `staff.you.ge/packages/assistant-sdk/` from the pinned commit
   recorded in `VENDORING.md`.
3. Revert the import rewrites.

No data migration is involved: `localStorage` keys
(`youge-assistant:notices:<projectId>`, `youge-assistant:lkg:<projectId>`) and
the state model are identical in both modes.

## 7. Compatibility guarantees

- The public API listed in [`README.md`](README.md) is stable across `0.1.x`
  (patches: fixes only; minors: additive; [`RELEASE.md`](RELEASE.md) §2).
- `SCHEMA_VERSION 1` and the data-only config validation rules do not change in
  `0.x`.
- The SDK keeps **zero** runtime dependencies; `react` stays an optional peer.
- Classic-script pages (`assistant-state.js` / `window.YouGeAssistant`) remain
  synchronized with the package (`npm run sync:sdk`), so mixed integrations
  keep one state model.

---

*Migration documentation written with `ui-ux-pro-max-skill` DX guidance
(atomic steps, explicit success signals per step, checklist with observable
outcomes, rollback first-class). Skill record:
[`../../DESIGN_FOUNDATION.md`](../../DESIGN_FOUNDATION.md) §10.*
