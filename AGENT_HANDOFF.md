# Agent Handoff — You.Ge Assistant

**Last updated:** 2026-11-14
**Repository:** `sandro-defender/you-ge-assistant`
**Base branch / commit:** `main` @ `ee83c0ed64b84119a43675f3c9b2c1540e8b57b9` (PR #25 merged 2026-11-14 03:04:04 UTC)
**Active branch:** `arena/976df00e-you-ge-assistant`
**Stage 2 implementation commit:** `f528c15dcc5751704bda7beece08a2aece354818` (`fix(diagnostics): harden probe paths and local host handling`)
**Branch head:** latest docs-only handoff commit on top of `f528c15` (see `git log --oneline -3`)

---

## 1. Repository, Branch & CI State

- **Working tree:** clean; the branch holds exactly two commits (Stage 2 implementation + docs-only handoff update).
- **Open PR:** **#26** — `fix(diagnostics): harden probe paths and local host handling` (`arena/976df00e-you-ge-assistant` → `main`), state `OPEN`, mergeable. Not merged, no release/publish/version change.
- **CI on PR #26:** `static` (check workflow) — **success** on every pushed head so far (`f528c15` run `43550204333`, `40a805c` run `43550304581`, `0184221` run `43550386543`); re-check with `gh pr checks 26` for the newest docs-only head.
- **Merged predecessors:**
  - **Phase 2 — Stage 1** (PR #25, `arena/8464c385-you-ge-assistant`, merge `ee83c0e`): TypeScript contract alignment + `PHASE2_IMPLEMENTATION_PLAN.md`.
  - **Stage 1 identity baseline** (PR #24, merge `59bcb9a`): permanent agent rules + identity cleanup.

---

## 2. Phase 2 — Stage 2 Implementation (this task)

All four Stage 2 items from `PHASE2_IMPLEMENTATION_PLAN.md` §3 are implemented, tested and committed on `arena/976df00e-you-ge-assistant`:

1. **Subpath `backendProbePath` resolution (`dns-diagnostics.js`)** — `probeBaseUrl = new URL(basePath, origin)` is now used for both `appProbePath` and `backendProbePath`; a relative `health` under `/app/` probes `/app/health` while `/health` still resolves against the origin. Cross-origin probes are still rejected (backend URL discarded, app URL falls back to `manifest.webmanifest`).
2. **Bounded body parsing** — `timeoutRequest()` now accepts a response consumer and `fetchWithRetry(..., consume)` runs the consumer inside the raced promise; `query()` body parsing moved into `parseDnsBody(type, response)`. A stalled `response.json()` rejects as `'timeout'`, aborts through the same `AbortController`, and stays bounded by `timeoutMs`.
3. **Local/loopback/IP-literal hosts** — new `IPV4_PATTERN`, `isIpv4Literal()`, `isIpv6Literal()` and `localHostKind()` helpers. `localhost`, `*.localhost`, IPv4 literals and bracketed IPv6 (including `[::1]`, which previously failed hostname validation with `classification: 'unknown'` and issued no probes) skip public Cloudflare DoH, still run same-origin app/backend probes, and classify as `normal_connectivity` / `application_host_unavailable` with a local-host message. Results gain an additive `dohSkipped: boolean` field (always present; `false` for public hosts). Offline (`general_internet_failure`) and `backend_unavailable` precedence, the DoH caveat, headers/privacy options, `possibleDnsInterference` and the `YouGeDns.create` / `check` signatures are unchanged.
4. **Diagnostics probe path validation** — SDK `packages/assistant-sdk/src/domain/index.js` and classic `domain-config.js` add `DIAGNOSTICS_PROBE_KEYS`, `safeDiagnosticsProbePath()` and `sanitizeDiagnosticsConfig()`:
   - `validateDomainConfigDetailed()` / `YouGeDomain.validateConfigDetailed()` emit `invalid_diagnostics_probe` at `diagnostics.appProbePath` / `diagnostics.backendProbePath` for non-strings, empty or whitespace-padded values, cross-origin URLs, `//host` network paths, script schemes, backslashes and `..` traversal, plus `invalid_diagnostics` at `diagnostics` when the value is not an object.
   - `validateDomainConfig()` / `validConfig()` keep only safe probe keys, so the runtime falls back to `manifest.webmanifest` and no backend probe. Unknown `diagnostics` keys still pass through as before.
   - `assistant-state.js` regenerated via `npm run sync:sdk` (additive only, deterministic).
- **Docs:** `DNS_RECOVERY.md` now documents base-path-relative probe resolution, probe validation and local-host behavior.
- **Scope respected:** no `pwa.js` / `progressier.js` / widget / dashboard / DNS-failover / `staff.you.ge` changes, no SDK `.d.ts` or README changes, no dependency, version or workflow changes, no tests weakened.

---

## 3. Project Architecture (unchanged by this task)

- **Classic browser runtime (v`1.1.0`, zero runtime dependencies):** `pwa.js` (`window.PWA`, `window.progressier` shim), `progressier.js` (`/progressier.js` worker), `domain-config.js` / `domain-registry.js` / `manifest-handler.js`, `dns-diagnostics.js` (`window.YouGeDns`), `assistant-state.js` (synced from the SDK) and `assistant-widget.js`/`.css`.
- **Extracted ESM SDK (`@youge/assistant-sdk`, `0.2.0` prepared in-repo, `0.1.1` on npm):** subpaths `.`, `./domain`, `./config`, `./diagnostics`, `./installation`, `./browser`, `./theme`, `./react`.

---

## 4. Completed vs. Pending Work

- **Completed:** Phases 0/1/1.5 (PR #6), SDK extraction & audit fixes (PRs #7, #8), release automation & SDK 0.1.0/0.1.1 (PRs #9–#20), skills & UI/TDD fixes (PRs #21, #22), Phase 1 multi-domain (PR #23), Task 1 + Identity Cleanup Stage 1 (PR #24), Phase 2 audit/plan + Stage 1 (PR #25), **Phase 2 — Stage 2 (PR #26, this task)**.
- **Pending:**
  - **Phase 2 — Stage 3 (next task):** diagnostics state synchronization, online failure classification, `configure()` DNS state reset and optional caller `AbortSignal` (`PHASE2_IMPLEMENTATION_PLAN.md` §3 Stage 3).
  - **Phase 2 — Stage 4:** unified SDK update lifecycle + `pwa.js` behavioral tests.
  - **Identity Cleanup — Stage 2 (awaiting explicit owner sign-off):** retire `reference/` and `PARITY.md`, update `scripts/check.mjs` `originalReference` assertions.
  - **Roadmap Phases 3–5 & `@youge/assistant-sdk@0.2.0` npm release:** owner-dispatched, not started.

---

## 5. Verified Test & Check Results (2026-11-14, after Stage 2 edits)

- `node --test tests/dns-diagnostics.test.mjs tests/domain-config.test.mjs tests/sdk-integration.test.mjs`: **PASS** (39/39; 7 new Stage 2 tests were red before the implementation).
- `npm run test:sdk`: **PASS** (97/97).
- `npm run check`: **PASS** (static contracts + `validate-package.mjs` + **348/348** tests).
- `node scripts/sync-sdk-browser.mjs --check`: **PASS** (`assistant-state.js` in sync).
- `node packages/assistant-sdk/scripts/validate-package.mjs`: **PASS** (`@youge/assistant-sdk@0.2.0`, release gates intact).
- `git diff --check`: **PASS**.
- CI: PR #26 `static` run `43550204333` — **success** (includes `example` `npm ci` / typecheck / build, `node --check` on every script, SDK package dry-run, unit tests, manifest parse).
- **Not run locally:** `tsc --noEmit` (no global `tsc`, `example/node_modules` absent locally); `example/` typecheck/build locally; `npm run verify <url>` (needs a deployed URL).

---

## 6. Remaining Progressier References (Classified)

1. **Required compatibility contracts (preserved intentionally):** `/progressier.js` worker path, `window.PWA` / `window.progressier`, `.progressier-install-button` / `.progressier-subscribe-button` / `.captured` / `.initialized`, `--progressier*` CSS vars, `progressierinstallbanner` / `progressierpushbanner` cookies, `progressierSavedPushNotifications` / `progressiersharedfiles` IndexedDB stores, manifest `id` `/HIPSBNVemXtM8VMwRfWs`, migration scrubbers in `pwa.js` / `scripts/check.mjs` / `scripts/verify-deployment.mjs`.
2. **Historical technical records (kept intact):** `CHANGELOG.md`, `FOUNDATION_AUDIT.md`, `ARCHITECTURE_AUDIT.md`, `ASSISTANT_ARCHITECTURE.md`, `INSTALLATION_EXPERIENCE.md`, `DESIGN_FOUNDATION.md`, `ADAPTIVE_THEME_AUDIT.md`, `PHASE1_AUDIT_PLAN.md`, `WIDGET.md`, `INTEGRATION.md`, `packages/assistant-sdk/{RELEASE,MIGRATION,README}.md`, `examples/push-server/README.md`.
3. **Pending Stage 2 cleanup (awaiting owner authorization):** `reference/` and `PARITY.md`, plus `scripts/check.mjs` `originalReference` checks.

---

## 7. Exact Next Action

Execute `NEXT_AGENT_PROMPT.md` (**Phase 2 — Stage 3: Diagnostics State Synchronization, Online-Failure Classification & Cancellation Hygiene** from `PHASE2_IMPLEMENTATION_PLAN.md` §3) on a fresh task branch from `main` after PR #26 is merged by the owner. Do not merge PR #26, publish packages, bump versions or start Stage 4 from this task.
