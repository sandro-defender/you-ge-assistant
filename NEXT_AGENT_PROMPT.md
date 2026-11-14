# Next Agent Prompt — CD-1 module capability enforcement

This is the planned implementation task **after PR #39 (Deep Repository Structure Cleanup) is reviewed and merged**. Do not begin until PR #39 is merged and the owner authorizes any required kit-version change for precached runtime assets. First read `AGENTS.md`, `AGENT_HANDOFF.md`, [`docs/reference/COMPATIBILITY_CONTRACTS.md`](docs/reference/COMPATIBILITY_CONTRACTS.md), and [`docs/operations/PRECACHE_INTEGRITY.md`](docs/operations/PRECACHE_INTEGRITY.md).

Current versions: You.Ge Assistant kit **`1.2.0`**, SDK package **`0.2.0`** (SDK publishing remains deferred). CD-1 changes the generated `src/assistant/assistant-state.js` and other precached paths; the integrity gate may therefore require a synchronized kit bump to **`1.2.1`**. Obtain explicit owner authorization before changing any version. Never bypass or weaken the precache gate.

## Objective

Enforce `modules` capability flags consistently across the SDK assistant model and every renderer so disabled capabilities are not displayed or actionable:

- `modules.diagnostics: false`
- `modules.recovery: false`
- `modules.failover: false`
- `modules.help: false`

Audit and fix the current gaps in `src/assistant/assistant-widget.js`, `examples/example/src/main.jsx`, and `packages/assistant-sdk/src/assistant/index.js`, plus any related rendering/state APIs. Preserve the centralized single-state model; do not add polling, duplicate state, extra fetches, worker registration, or unrelated features.

## Acceptance criteria

- Add regression tests first for all four module flags in the SDK and each affected renderer.
- `diagnostics`, `recovery`, `failover`, and `help` UI/actions are absent or disabled when the corresponding capability is false, and remain available when true.
- Notice/action rendering cannot expose a gated capability through an alternate action path.
- Keep classic browser `src/assistant/assistant-state.js` byte-synchronized from the SDK via `npm run sync:sdk`; never hand-edit the generated bundle.
- Preserve all public APIs and compatibility contracts unless an intentional API change is separately approved.

## Verification

After owner authorization and implementation, run focused tests, `npm run sync:sdk`, `node scripts/sync-sdk-browser.mjs --check`, `npm run check:precache`, `npm run test:sdk`, relevant root tests, `node packages/assistant-sdk/scripts/validate-package.mjs`, example typecheck/build, `npm run build`, and full `npm run check`. Report the synchronized version, CI result, public-path/precache integrity, and any browser testing accurately.

## Boundaries

- No CD-1 implementation is included in PR #39.
- Do not bump SDK package version, publish, release, tag, deploy, or merge without explicit owner authorization.
- Keep the PR scope to CD-1; schedule other audit items separately.
