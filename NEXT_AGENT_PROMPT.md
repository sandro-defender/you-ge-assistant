# Next Agent Prompt — fresh architecture and product-quality audit (post PR #35)

PR [#35](https://github.com/sandro-defender/you-ge-assistant/pull/35) is **merged** into `main` at `86d8ae30ac3816a1bb098ed4750ad313c03a6135` (2026-11-14 15:18 UTC). Post-merge `check` and `pages` runs passed and GitHub Pages published the merge, but **live browser behavior is unverified**. Kit is `1.1.1`; SDK package is `0.2.0`; no tag, release or publication exists. There is no pending work on PR #35 — do not reopen it, wait for its review, or re-verify its merge.

## Task

Perform a fresh, **read-only architecture and product-quality audit** of the current repository, based on the merged `main` state (confirm the tip with `git log -1 main` / `gh api repos/sandro-defender/you-ge-assistant/commits/main`). This is an audit, not an implementation phase: change no runtime, test, script or version file.

First read `AGENTS.md` (Repository Development Rules) and `AGENT_HANDOFF.md` (current state, open owner items, risks). Then:

1. **Inspect the actual implementation**, not just the docs: `pwa.js`, `progressier.js`, `assistant-state.js` / `packages/assistant-sdk/`, `assistant-widget.*`, domain configuration (`domain-registry.js`, `domain-config.js`), `dns-diagnostics.js`, offline files, `scripts/` gates, workflows, `demo/` and `example/`. Check that documentation claims match code.
2. **Identify concrete remaining defects, inconsistencies, risks and quality improvements** — correctness, security/origin boundaries, compatibility-contract handling, precache/update behavior, SDK API coherence, accessibility, test coverage gaps, doc drift.
3. **Prioritize findings by severity and impact** (e.g. critical / high / medium / low), each with file/line evidence and a concrete reproduction or reasoning chain.
4. **Clearly separate confirmed defects** (demonstrated in code or by a focused test/read-only probe) **from speculative architectural risks** (plausible but unproven). Never present a hypothesis as a confirmed bug.
5. **Recommend exactly one best next coherent implementation task**, sized per `AGENTS.md` (one independently verifiable objective), with rationale and acceptance criteria. Do not start it.

Deliver the audit as a report (new markdown document or PR description) and update `AGENT_HANDOFF.md` / `NEXT_AGENT_PROMPT.md` per the handoff rules. Focused read-only probes and existing checks (`node scripts/check.mjs`, targeted `node --test <file>`) are allowed; avoid unnecessary full-suite runs.

## Boundaries

- No implementation, refactoring or fixes during the audit; recommendations only.
- Excluded unless explicitly authorized: Phase 3 dashboard, alternate-domain failover, and unrelated `staff.you.ge`-specific work.
- Do not merge, publish, release, tag, deploy, or bump kit/package/SDK versions. Any precached-file change needs an owner-authorized kit bump; if the integrity gate fails, request authorization — never bypass it.
- You.Ge Assistant is the sole product identity; preserve every compatibility contract in `COMPATIBILITY_CONTRACTS.md` (`/progressier.js`, `window.progressier`, selectors, CSS variables, cookies, storage keys, manifest `id`). Do not remove or restructure `reference/` or `PARITY.md`.
- Live deployment verification and the blocked GitHub-metadata update are owner-level items tracked in `AGENT_HANDOFF.md`; report their status, do not silently absorb them into the audit.
