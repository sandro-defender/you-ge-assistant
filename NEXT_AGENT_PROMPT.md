# Next Agent Prompt — Phase 2, Stage 2: Diagnostics Probe Path Safety, Subpath Resolution & Localhost/IP Hardening

**Repository:** `sandro-defender/you-ge-assistant` (`/home/user/you-ge-assistant`)
**Plan reference:** `PHASE2_IMPLEMENTATION_PLAN.md` (§3, Stage 2)

---

## Objective

Complete **one small, independently verifiable task** — **Phase 2, Stage 2**: harden `dns-diagnostics.js` and domain validation for subpath `backendProbePath` resolution, bounded `response.json()` timeouts, localhost/IP-literal dev hosts, and `diagnostics` probe-path validation in `packages/assistant-sdk/src/domain/index.js` + `domain-config.js`.

**Do not implement Phase 2 Stages 3–4, modify `pwa.js` or `progressier.js` behavior, bump package versions, touch CI/release workflows, or delete `reference/`/`PARITY.md`.**

---

## Startup & State Verification

1. Read `AGENTS.md`, `AGENT_HANDOFF.md`, and `PHASE2_IMPLEMENTATION_PLAN.md` (§3 Stage 2) first.
2. Verify live Git state before acting (`git status --short --branch`, `git rev-parse HEAD`, `gh pr list --state open`), stay strictly on the session's active branch, and preserve all existing uncommitted work.

---

## Exact Scope

Inspect only the relevant files:
- `dns-diagnostics.js`
- `packages/assistant-sdk/src/domain/index.js`
- `domain-config.js`
- `tests/dns-diagnostics.test.mjs`, `packages/assistant-sdk/tests/sdk-domain.test.mjs`, `tests/domain-config.test.mjs`, `tests/sdk-integration.test.mjs`

Implement with TDD (focused tests first, red → green):
1. `dns-diagnostics.js`:
   - Resolve relative `backendProbePath` against `new URL(basePath, origin)` (consistent with `appProbePath`, while leading-`/` root-relative paths continue resolving against `origin`), keeping strict same-origin enforcement.
   - Keep `response.json()` inside the active `timeoutMs` timer/`AbortController` scope so hung JSON streams reject with `'timeout'`.
   - Detect local loopback / IP-literal hostnames (`localhost`, `*.localhost`, IPv4, bracketed IPv6): skip public Cloudflare DoH queries for non-public/literal addresses, run the same-origin app/backend probes normally, and return a clear classification/message without false `NXDOMAIN` `'inconclusive'` noise.
2. `packages/assistant-sdk/src/domain/index.js` & `domain-config.js`:
   - Validate and sanitize `diagnostics.appProbePath` and `diagnostics.backendProbePath` (must be safe relative or root-relative strings; reject cross-origin URLs, script schemes, backslashes, or `..` traversal), emitting `invalid_diagnostics_probe` issues in `validateDomainConfigDetailed()` and safe fallback in `validateDomainConfig()`.
3. Regenerate `assistant-state.js` via `npm run sync:sdk` if `packages/assistant-sdk/src/domain/index.js` changes.
4. Update `AGENT_HANDOFF.md` and `NEXT_AGENT_PROMPT.md` (pointing to **Phase 2 — Stage 3** in `PHASE2_IMPLEMENTATION_PLAN.md`).

---

## Verification

Run and report only actually executed checks:
- `git diff --check`
- `node --test tests/dns-diagnostics.test.mjs tests/domain-config.test.mjs tests/sdk-integration.test.mjs`
- `npm run test:sdk`
- `node scripts/sync-sdk-browser.mjs --check`
- `node packages/assistant-sdk/scripts/validate-package.mjs`
- `npm run check`

---

## Stop Conditions

- Stop after Stage 2 changes, tests, `assistant-state.js` sync (if needed), and handoff updates are verified.
- Do **not** start Stage 3 or Stage 4, commit/push unless instructed, merge PRs, bump versions, or publish to npm.
