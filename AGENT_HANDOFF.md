# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base:** `main` at `8b8e95eff16731527586b281a256b66e38972288` (PR #36 merged)
**Branch:** `arena/ff5bf457-you-ge-assistant` (active)
**PR:** none opened for this audit-only pass (audit report delivered directly; only `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` updated).
**Working tree:** clean apart from `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md`. No runtime, SDK, test, script, workflow or version file was modified.

Permanent contributor rules live in [`AGENTS.md`](AGENTS.md) (Repository Development Rules); they are not duplicated here. `AGENTS.md` was not modified in this pass; minor stale notes inside `AGENTS.md` are recorded under **Documentation inconsistencies** below for owner review.

## Verified post-PR #36 baseline (queried live on 2026-11-14)

- **PR #36 is MERGED into `main`.** Title: "Post-PR #35 handoff finalization and repository-identity follow-up" (`arena/a56adc21-you-ge-assistant` → `main`). Merged **2026-11-14T18:22:14Z**; merge commit **`8b8e95eff16731527586b281a256b66e38972288`**, which is the verified `main` tip. Open PRs: **0**.
- **Post-merge CI on `8b8e95e` passed:** [`check` run 43626223204](https://github.com/sandro-defender/you-ge-assistant/actions/runs/43626223204) — `completed` / `success`; [`pages` run 43626223189](https://github.com/sandro-defender/you-ge-assistant/actions/runs/43626223189) — `completed` / `success`.
- **GitHub Pages deployment completed:** deployment `7791834293` (environment `github-pages`, sha `8b8e95e`) reached state `success` at **2026-11-14T18:22:44Z**. Site: <https://sandro-defender.github.io/you-ge-assistant/> (example at `/example/`).
- **CI green and a successful Pages deployment do not prove live browser behavior.** No real-browser verification has been performed. Live worker installation at `1.1.1`, replacement of `1.1.0` caches, offline fallback, real Cloudflare DoH/CSP behavior and Android `intent://` handoff remain **unverified** outside Node VM/mocked-DOM tests.
- **No tag, no release, no new SDK publication occurred.** GitHub tags: none. GitHub releases: none. npm `@youge/assistant-sdk` latest remains `0.2.0` (published `2026-11-07T11:36:56.359Z`).

## Versions

| Version | Value | Status |
| --- | --- | --- |
| Kit (`progressier.js` `VERSION`, `pwa.js` `PWA.version`, root `package.json`, SDK `KIT_COMPAT_VERSION`, generated `assistant-state.js`) | **`1.1.1`** | Synchronized across all declarations (PR #35). |
| SDK package (`packages/assistant-sdk/package.json`, `SDK_VERSION`) | **`0.2.0`** | In-repo source includes 15 modified files under `src/` plus `README.md` from PRs #30–#35 since the 2026-11-07 npm `0.2.0` tarball (`applyUpdate`, `requestPwaUpdate`, `AbortSignal` diagnostics cancellation + `cancelled`, `modules.updates: false`, `dnsIdentity` basePath/probe invalidation, `KIT_COMPAT_VERSION = '1.1.1'`). Any future npm release requires an owner-authorized semver bump. |

Further kit, package or SDK version changes require explicit owner authorization (`AGENTS.md`).

## Post-PR #36 architecture & product-quality audit summary

Full evidence, line numbers and reproduction traces were delivered in the post-PR #36 audit report. Summary of active backlog items on `main` (`8b8e95e`):

### Confirmed defects

1. **`CD-2` (High — SDK React adapter & `.d.ts` contracts, non-precached):**
   - `createUseAssistant` (`packages/assistant-sdk/src/adapters/react.js:141-156`) passes `selector = null` to `getExternalStoreBindings` and runs `selector(state)` *after* `useSyncExternalStore`, so React compares full `AssistantState` references and re-renders every `useAssistant(selector)` consumer on unrelated state transitions (contradicting `packages/assistant-sdk/README.md:148-150`).
   - `FALLBACK_ASSISTANT_STATE.project` (`react.js:20-31`) omits four non-optional `AssistantProjectInfo` fields (`detectedHostname`, `matchedRegistryKey`, `projectIdSource`, `domainValidation` — `src/index.d.ts:154-169`), crashing SSR callers that read `state.project.domainValidation`.
   - `createReactAdapter` (`react.js:264-268, 285`) does not check `isDestroyed()` on its cached instance, `ReactAdapterOptions` (`react.d.ts:30-37`) omits `createElement?`, and `ThemeResolutionContext` (`src/theme/index.d.ts:104-111`) omits `seedPrimary?`.
2. **`CD-3` (High — `bridgePwaGlobals` SDK global parity, non-precached):**
   - `bridgePwaGlobals()` (`packages/assistant-sdk/src/adapters/pwa-kit.js:34-40`) exposes only `{ version, domain, attach }` on `window.YouGeAssistantSDK`, omitting `resolveTheme`, `normalizeTheme`, `NOTIFICATION_LEVEL_ICONS`, `createChromeHandoff`, `detectInAppBrowser`, etc. When paired with `assistant-widget.js` (`:293, 715`), adaptive theming (`0.2.0`) and Android Chrome handoff (`0.1.1`) silently turn off — and loading `assistant-state.js` afterward cannot populate them because `assistant-state.js:14-17` exits early once `YouGeAssistant.__state` exists.
3. **`CD-1` (High — Module capability gating across SDK state + widget, touches precached files):**
   - `modules.diagnostics: false`, `modules.recovery: false`, `modules.failover: false` and `modules.help: false` do not gate the `"Diagnostics & recovery"` section, `"Run network diagnostics"` button (`[data-pwa-diagnostics]`), or `"Recovery guidance"` `<details>` in `assistant-widget.js:589-612` (or `example/src/main.jsx:369-378`), nor notice `actionId` attachment/rendering in `packages/assistant-sdk/src/assistant/index.js:413-467` and `assistant-widget.js:493-507`.
4. **`CD-4` (Medium — `Escape` collision & focus stranding with `[data-pwa-help]`, touches precached files):**
   - `toolkitDialogOpen()` (`assistant-widget.js:882-891`) checks `.pwa-flow` only, missing `[data-pwa-help]` mounted by `pwa.js:905-1021` (`showHelp`). Pressing `Escape` while manual install instructions are open closes both surfaces and restores focus onto a button inside the closing `[hidden]` panel (`example/src/main.jsx:218-235` also lacks a toolkit-dialog guard).
5. **`CD-5` (Medium — `offline.html` hardcoded Assistant branding, touches precached files):**
   - `offline.html:46-54` sets `YOU_GE_ASSISTANT_CONFIG.branding` to `'You.Ge Assistant'` / `'icons/icon-192.png'`, overriding custom `domain-registry.js` branding in `src/assistant/index.js:308-311` while `offline.js:17-50` displays the custom domain's brand on the same page.
6. **`CD-6` (Medium — `dns-diagnostics.js` mixed RCODE / `possible_dns_interference` edge cases, touches precached files):**
   - Mixed DoH RCODEs `[0, 3]` fall through to `classification: 'unknown'` even when `answers.length > 0 && app.ok` (`dns-diagnostics.js:443-473`); `[0, 2]` with `!app.ok` classifies as `'cloudflare_doh_unavailable'`; and `[validDns=1, dnsErrors=1]` with `!app.ok` (`:467-469, 485`) emits `classification: 'possible_dns_interference'` with `possibleDnsInterference: false` and `"not enough evidence"` copy while triggering critical DNS failure notices in the SDK/widget.
7. **`CD-7` (Low — Widget `destroy()` media listener cleanup, touches precached files):**
   - `watchScheme()` (`assistant-widget.js:343-355`) registers a `matchMedia('(prefers-color-scheme: dark)')` listener that `destroy()` (`:1002-1017`) never removes.

> **Precache gate constraint (`PRECACHE_INTEGRITY.md`):** `CD-2` and `CD-3` live entirely in non-precached SDK adapter/type files and can land on kit `1.1.1` with zero version bump. `CD-1`, `CD-4`, `CD-5`, `CD-6` and `CD-7` modify precached files (`assistant-state.js`, `assistant-widget.js`, `offline.html`, `dns-diagnostics.js`) and must be batched only when the owner authorizes a synchronized kit-version bump (`1.1.1 → 1.1.2`).

### Architectural risks, documentation drift & improvement opportunities

- **`AR-1` (High):** npm `@youge/assistant-sdk@0.2.0` predates PRs #30–#35 while `package.json` still reads `0.2.0`; `README.md` documents post-`0.2.0` APIs alongside `npm install @youge/assistant-sdk`, and `sdk-release-prep.yml` will block on version uniqueness until an authorized bump.
- **`AR-2` (Medium):** Classic `domain-config.js` (~720 lines) and `packages/assistant-sdk/src/domain/index.js` (~812 lines) are maintained separately (aligned today via `tests/sdk-integration.test.mjs`, unlike generated `assistant-state.js`).
- **`AR-3` / `IMP-1` / `IMP-2` (Low–Medium):** `scripts/verify-deployment.mjs:105-115` requires leading-slash `/pwa.js` in HTML and fails on relative-path pages such as `demo/index.html` (`src="pwa.js"`); `scripts/check.mjs:96-109` omits `assistant-state.js`, `assistant-widget.js`, `functions/manifest.webmanifest.js` and `example/vite.config.js` from its standalone `node --check` list (covered in `.github/workflows/check.yml:34`).
- **`DOC-3` (Low):** Stale status lines in `packages/assistant-sdk/MIGRATION.md:16,67-75,91`, `packages/assistant-sdk/RELEASE.md:55,60`, `WIDGET.md:57,328,363,386`, and `THEMING.md:62,72`.
- **`DOC-4` (Low — `AGENTS.md` owner-attention notes, untouched):** `AGENTS.md:200` still says SDK publishing is *"not yet executed"*; `AGENTS.md:95,860-861` call `ui-ux-pro-max-skill` mandatory and reference a removed `§2` while `:32` notes it is not installed in `.agents/skills/`; `:203` says `46` widget tests (actual: `47`).

## GitHub repository identity — owner action required (blocked by GitHub App permissions)

Verified live via `gh api repos/sandro-defender/you-ge-assistant` on 2026-11-14 — unchanged because the Arena GitHub App token lacks `administration:write` (`HTTP 403`):

- Description: `"Self-hosted, Progressier-compatible PWA kit: manifest, service worker, install UI, QR, offline, share target, push and badge. No build step, no dependencies."`
- Topics: `install-prompt`, `javascript`, `offline-first`, `progressier`, `pwa`, `service-worker`, `web-manifest`, `web-push`.

Owner command to apply the authorized change (or edit Settings → General manually):

```sh
gh repo edit sandro-defender/you-ge-assistant \
  --description "You.Ge Assistant: dependency-free multi-domain PWA toolkit and SDK — install UI, offline, sharing, push, badges, QR and diagnostics." \
  --remove-topic progressier --add-topic you-ge-assistant
```

## Remaining Progressier references in tracked files

Verified via full tracked-file grep scan (`COMPATIBILITY_CONTRACTS.md` §1–§4). Zero unexplained Progressier product-branding references exist in tracked files; all remaining occurrences are preserved technical compatibility contracts (`/progressier.js`, `window.progressier`, `.progressier-*` selectors, 15 `--progressier*` CSS variables, banner cookies, IndexedDB stores, manifest `id`, migration host checks) or preserved historical/reference records (`reference/`, `PARITY.md`, dated audit docs).

## Remaining owner-level work

1. **Live browser & deployment verification:** Run the real-browser acceptance checklist in `AGENTS.md` §15 on <https://sandro-defender.github.io/you-ge-assistant/> and `/example/` (`1.1.1` worker activation, `1.1.0 → 1.1.1` cache replacement, install/relaunch, offline reload). Note: `scripts/verify-deployment.mjs` currently expects root-absolute `/pwa.js` in HTML (`IMP-1`).
2. **Repository metadata:** Run the `gh repo edit` command above to remove obsolete Progressier wording/topic on GitHub.
3. **Future kit `1.1.2` bump authorization:** Required when scheduling precached-runtime fixes (`CD-1`, `CD-4`, `CD-5`, `CD-6`, `CD-7`).
4. **SDK semver bump & release decision:** Decide whether/when to bump `@youge/assistant-sdk` (`0.2.1` / `0.3.0`) after landing `CD-2` + `CD-3` so npm matches `main`.
5. **`reference/` and `PARITY.md`** retirement/restructuring and `AGENTS.md` doc-drift cleanup (`DOC-4`), if desired.

## Validation (this audit pass)

- `node scripts/check.mjs`: **passed** (all static contracts, manifest/icon dimensions, version sync `1.1.1`, precache integrity gate — 13 precached assets unchanged since `8b8e95e`).
- `node packages/assistant-sdk/scripts/validate-package.mjs`: **passed** (`@youge/assistant-sdk@0.2.0`, `KIT_COMPAT_VERSION = 1.1.1`, 23 packed files, 27/27 release-workflow gates).
- Read-only npm tarball diff (`npm pack @youge/assistant-sdk@0.2.0` into temporary `/tmp` dir vs `packages/assistant-sdk`): verified 15 `src/` files + `README.md` changed since the 2026-11-07 `0.2.0` release.
- Tracked-file Progressier branding scan: clean (compatibility contracts and historical records only).
- `git diff --check`: clean.
- Full `npm test` not re-run (no code/test files changed; post-merge `check` run `43626223204` on `8b8e95e` is green). Real-browser testing was **not** performed.

## Next action

Execute [`NEXT_AGENT_PROMPT.md`](NEXT_AGENT_PROMPT.md): harden `@youge/assistant-sdk` React and PWA-kit adapter contracts (`CD-2` + `CD-3`) — a small, self-contained, non-precached SDK slice requiring no kit or SDK version bump.
