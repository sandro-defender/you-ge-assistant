# Phase 1 — Multi-domain intelligence: audit and implementation plan

**Audit date:** 2026-11-11<br />
**Baseline:** `300685030b488431fae48dea1c0e46f4e338a4e6` (`main`)<br />
**Branch:** `arena/da5228b9-you-ge-assistant`
**Scope:** extend the existing domain resolver, SDK configuration/state, classic runtime bridge and tests. This is not a rewrite or the start of Phase 2.

## Skills disclosure

- **Found, read:** `.agents/skills/tdd/`, `.agents/skills/mobile-native/`, and `.agents/skills/break-ui/` (including their relevant test/mocking and catalog guidance).
- **Actually applied so far:** TDD's test-first/red-green guidance was used for the URL-string `Assistant.location` regression and registry-derived Last-Known-Good recovery: each new behavior test failed against the old integration, then passed after its fix. The broader implementation was not completed as one strict red-green sequence; the remaining targeted tests were added alongside implementation and are recorded transparently here. The two UI skills were read but not applied because no UI change was needed.
- **`ui-ux-pro-max-skill`:** referenced by repository guidance but absent from the installed skill inventory. It was not downloaded or installed. The audit found no need for a UI change, so no UI design work is planned.

## Audit findings

1. **Keep the existing framework-independent SDK as the source of state.** `packages/assistant-sdk` already provides host/domain resolution, a data-only config pipeline, `create`/`attach`, `configure`, `getState`, subscriptions, lifecycle cleanup and project-scoped persistence. React remains an optional adapter; the core has no runtime dependencies, network calls, worker registration or polling.
2. **Extend—not duplicate—the resolver.** The SDK resolver in `packages/assistant-sdk/src/domain/` already handles normalized lowercase hostnames, root/subdomain context, exact and wildcard entries, path scopes, safe unknown-host defaults and manifests. The classic `domain-config.js` resolver is also consumed by `pwa.js` and imported by the service worker. Existing integration tests compare SDK/classic resolver behavior; that boundary must remain covered.
3. **Hostname edge cases need a reliable shared contract.** Current normalization trims, lowercases and removes a trailing dot, but does not parse URL/host-port inputs. `resolveDomain` treats a string as a hostname rather than as a URL. IPv6 is recognized as an IP for root-domain reporting but cannot match the DNS-label-only registry matcher. Preserve actual browser `Location` behavior while covering normalized URL, port, IPv4/IPv6, localhost, custom-domain and nested-subdomain inputs.
4. **Precedence exists but is under-specified.** Registry matching currently prefers exact-host path entries, then exact host, then matching wildcard path entries, then wildcard host entries. Path/suffix specificity is used, but equal-specificity ties inherit object insertion order. The SDK config pipeline already layers bundled defaults → valid published config (or project-scoped LKG) → explicit local overrides. Make domain and project identity precedence explicit and deterministic without changing legacy `domain`/`projectId` callers.
5. **Validation is safe-by-default but hard to diagnose.** `validateDomainConfig` returns a sanitized config and silently replaces invalid values; callers do not receive structured issue codes/paths/messages. Add an additive detailed validation result and registry-key validation while keeping the existing validator’s return contract intact.
6. **Project state needs identity provenance.** `projectId` can be supplied to the Assistant, otherwise state derives identity from host plus base path. Domain registry entries do not yet map aliases to a shared project ID. `AssistantState.project` exposes the resolved host but not the separately detected runtime host, matched registry key, project-ID source or domain-config validation feedback. `configure()` already recomputes state and reloads project-scoped notice storage; tests should pin those updates and isolation.
7. **PWA and worker boundaries are already separated.** `pwa.js` consumes the resolved public domain config; `progressier.js` imports the classic resolver and independently scopes its existing caches by hostname and worker scope. The SDK bridge does not register a service worker. Preserve worker URL, cache behavior, install identity, storage keys, manifest behavior and `window.PWA`/`window.progressier` contracts. No worker failover, retries or staff-specific behavior is in scope.
8. **No configuration UI exists in this checkout.** The React example is a design/foundation preview, not a project/domain management interface. The only UI mentions project registration as future dashboard work. This feature belongs in the SDK/runtime API and documentation; no unrelated UI is warranted.
9. **The public-suffix helper is deliberately limited.** Existing root-domain derivation recognizes a small compound-suffix list; it is informational and must not be described or used as a full Public Suffix List or security boundary.

## Proposed implementation contract

- Keep the SDK domain/config/state architecture and existing public behavior. Add reusable hostname normalization/detection and URL/host-port parsing; keep browser origin/protocol/path and safe fallback semantics, including local development hosts and IP literals.
- Keep `validateDomainConfig()` backward compatible. Add detailed config/registry validation that returns a safe normalized value and stable, actionable issues (`code`, `path`, `message`); malformed registry keys/values must not make resolution throw.
- Introduce a typed `ProjectConfig` (`{ id: string }`) as an additive explicit option and allow a registry entry to assign the same project ID to multiple host aliases. Preserve top-level `projectId` as a compatibility alias.
- Project identity order: explicit `project.id` → legacy explicit `projectId` → matched registry project ID → derived normalized host + base path. Registry host precedence: exact host + path → exact host → most-specific matching wildcard + path → most-specific wildcard host; use a stable key tie-breaker. Keep wildcard apex exclusion and safe unknown-host defaults.
- Additive state fields distinguish the actual detected hostname from any legacy explicit domain override and expose the matched key, project-ID source and useful domain validation feedback. `configure()` must emit predictable snapshots, re-key project-scoped notice/LKG state, and keep instances isolated.
- Mirror relevant resolver behavior in `domain-config.js`, keep the SDK/classic parity checks, and regenerate `assistant-state.js` only through `scripts/sync-sdk-browser.mjs`. Do not change PWA or service-worker policy; any shared resolver edits must pass their existing regressions.
- Document a custom-domain alias sharing one project ID and a multi-subdomain wildcard example. No You.Ge/staff host constants or staff-specific failover are to be added.

## Implementation checklist

- [x] Complete repository audit and run baseline quality gates.
- [x] Record audit, compatibility boundaries, and implementation plan before source changes.
- [x] Add behavior tests for normalized detection (URLs, ports, custom/nested hosts, localhost and IPv4/IPv6), registry precedence/ties, validation results/failures, state updates/isolation and backward compatibility. URL-string Assistant-location and registry-derived Last-Known-Good regressions used explicit red/green TDD cycles; other cases were added alongside implementation rather than all being strictly test-first.
- [x] Implement additive typed project configuration and deterministic project-ID precedence; targeted tests cover project changes, subscription snapshots, persistence isolation and legacy `projectId`/`domain` behavior.
- [x] Mirror SDK/classic resolver behavior and regenerate `assistant-state.js` through the sync script. Full classic/ESM parity, manifest, PWA and service-worker checks pass.
- [x] Update SDK/API and multi-domain documentation with custom-domain aliases and multi-subdomain examples.
- [x] Run all repository and SDK tests, typechecks, available lint/build checks, package validation/dry-run, PWA/service-worker regression checks and `git diff --check`; report unavailable gates and limitations below.

## Baseline quality gates (before implementation)

- `npm run check` — **passed**; includes static checks, package validation and all **321** repository + SDK tests.
- `cd packages/assistant-sdk && npm test && npm pack --dry-run` — **passed**; **80** SDK tests and package dry-run.
- `cd example && npm ci && npm run typecheck && npm run build` — **passed**; TypeScript and production build succeeded. Vite printed existing warnings that the classic `<script>` runtime files are external and cannot be bundled without `type="module"`; those scripts intentionally remain classic.
- `git diff --check` — **passed** on the clean baseline.
- **Lint:** unavailable; no lint script or ESLint/Prettier/Biome configuration is present.
- Recent `main` CI check and Pages workflow — **success**. No live multi-host deployment integration environment is configured; verify runtime behavior through the repository’s deterministic tests and build gates.

## Phase 1 implementation verification

- `npm run check` — **passed** after implementation; static/deployment checks and all **338** repository + SDK tests passed, including classic/ESM parity and PWA/service-worker contract coverage.
- `cd packages/assistant-sdk && npm test && npm run validate && npm pack --dry-run` — **passed**; **93** SDK tests, package validation and a 23-file dry-run tarball. No package was published and the version was not changed.
- `cd example && npm ci && npm run typecheck && npm run build` — **passed**; strict example typecheck and production build completed. Vite emitted the expected existing warnings for intentional classic-script runtime files.
- Direct TypeScript declaration and usage checks — **passed** with `skipLibCheck: false`, including `project: { id }`, URL-string `location`, root/domain validation exports and registry typing. A duplicate `THEME_MODES` declaration conflict uncovered by the stricter check was removed.
- `node scripts/sync-sdk-browser.mjs --check` and `git diff --check` — **passed** after regenerating `assistant-state.js` from SDK sources.
- Lint — **unavailable**; the repository has no lint script or ESLint/Prettier/Biome configuration.
- `npm run verify` — requires a deployed URL argument; the command was attempted but no deployment URL/environment is configured, so live deployment verification was not run. No real multi-host deployment was available; deterministic runtime/integration tests and the production build are the available coverage.
