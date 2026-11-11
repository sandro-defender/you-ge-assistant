# Phase 1 — Multi-domain intelligence: audit and implementation plan

**Audit date:** 2026-11-11<br />
**Baseline:** `300685030b488431fae48dea1c0e46f4e338a4e6` (`main`)<br />
**Branch:** `arena/da5228b9-you-ge-assistant`
**Scope:** extend the existing domain resolver, SDK configuration/state, classic runtime bridge and tests. This is not a rewrite or the start of Phase 2.

## Skills disclosure

- **Found, read:** `.agents/skills/tdd/`, `.agents/skills/mobile-native/`, and `.agents/skills/break-ui/` (including their relevant test/mocking and catalog guidance).
- **Actually applied so far:** none to implementation; this commit contains only the completed audit and plan. TDD will be applied test-first to the implementation. The two UI skills are not applicable unless UI work becomes necessary.
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
- [ ] Add behavior tests first for normalized detection (URLs, ports, custom/nested hosts, localhost and IPv4/IPv6), registry precedence/ties, validation results and failures.
- [ ] Implement additive type-safe project configuration and project-ID precedence; test project changes, subscriptions, persistence isolation and legacy `projectId`/`domain` compatibility.
- [ ] Keep SDK and classic resolver parity; test PWA/worker, manifest, install and cache-scope regressions.
- [ ] Update SDK/API and multi-domain documentation with custom-domain and multi-subdomain examples.
- [ ] Run all repository and SDK tests, typechecks, available lint/build checks, package validation/dry-run, PWA/service-worker regression checks and `git diff --check`; report unavailable gates and limitations.

## Baseline quality gates (before implementation)

- `npm run check` — **passed**; includes static checks, package validation and all **321** repository + SDK tests.
- `cd packages/assistant-sdk && npm test && npm pack --dry-run` — **passed**; **80** SDK tests and package dry-run.
- `cd example && npm ci && npm run typecheck && npm run build` — **passed**; TypeScript and production build succeeded. Vite printed existing warnings that the classic `<script>` runtime files are external and cannot be bundled without `type="module"`; those scripts intentionally remain classic.
- `git diff --check` — **passed** on the clean baseline.
- **Lint:** unavailable; no lint script or ESLint/Prettier/Biome configuration is present.
- Recent `main` CI check and Pages workflow — **success**. No live multi-host deployment integration environment is configured; verify runtime behavior through the repository’s deterministic tests and build gates.
