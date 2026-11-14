# Repository inventory and structure

## Baseline

The verified baseline is PR #37's merge commit `f7189e182ccaada85693ebb3373395a37982f515` on `main` (PR #37 is merged). The working branch started at that exact commit with a clean worktree and no open PRs. Before this inventory was added, the repository root contained **46 files** and **12 directories**.

This is a structural refactor only. Public runtime files remain at their current root URLs; the reorganized source examples still assemble to the existing Pages URLs. No product behavior or version is changed.

## Complete root-file inventory and disposition

Each entry below was inspected at the root before files moved. “References” names important consumers; repository-wide markdown/source references were also searched during implementation.

| Current path | Classification | Disposition / destination | Why; references to update | Contract sensitivity |
|---|---|---|---|---|
| `.editorconfig` | Essential project/configuration | Retain at root | Editor tooling discovers it from root. | Root convention. |
| `.gitattributes` | Essential project/configuration | Retain at root | Git behavior and attributes apply repository-wide. | Root convention. |
| `.gitignore` | Essential project/configuration | Retain at root | Git/npm/build ignore conventions are root-scoped. | Root convention. |
| `ADAPTIVE_THEME_AUDIT.md` | Historical/reference documentation | `docs/architecture/ADAPTIVE_THEME_AUDIT.md` | Related theming/architecture records, README, source comments; update links and path-based checks. | Documentation path only. |
| `AGENTS.md` | Essential contributor/agent instructions | Retain at root | Agent tooling and contributors expect the canonical instructions at root; update its internal links. | Root convention. |
| `AGENT_HANDOFF.md` | Essential handoff/governance | Retain at root | Current state and next-agent handoff must be easy to find. Update structural references and current status. | Root convention. |
| `ARCHITECTURE_AUDIT.md` | Historical/reference documentation | `docs/architecture/ARCHITECTURE_AUDIT.md` | README, AGENTS, architecture/foundation records, static checks/tests; update links and file reads. | Documentation path only. |
| `ASSISTANT_ARCHITECTURE.md` | Architecture documentation | `docs/architecture/ASSISTANT_ARCHITECTURE.md` | README, AGENTS, audits, design docs, examples, static checks/tests; update links and file reads. | Documentation path only. |
| `CHANGELOG.md` | Essential release/history documentation | Retain at root | Conventional release-note discovery path. | Root convention. |
| `COMPATIBILITY_CONTRACTS.md` | Compatibility/reference documentation | `docs/reference/COMPATIBILITY_CONTRACTS.md` | Runtime comments, README, AGENTS, handoff, reference README, tests and other docs; update all links/reads. | Its contents define public contracts; moving the file does not change contracts. |
| `DESIGN_FOUNDATION.md` | Design/contributor documentation | `docs/guides/DESIGN_FOUNDATION.md` | README, AGENTS, SDK/example notices, design-system source, changelog and static checks/tests; update links/reads. | Documentation path only. |
| `DNS_RECOVERY.md` | Operations/integration guide | `docs/guides/DNS_RECOVERY.md` | README/integration and architecture references; update links. | Documentation path only. |
| `FOUNDATION_AUDIT.md` | Historical/reference documentation | `docs/architecture/FOUNDATION_AUDIT.md` | Architecture and design documentation references; update links. | Documentation path only. |
| `INSTALLATION_EXPERIENCE.md` | Integration/SDK guide | `docs/guides/INSTALLATION_EXPERIENCE.md` | AGENTS, architecture, SDK and README links; update links. | Public behavior is documented, file path itself is not a runtime URL. |
| `INTEGRATION.md` | Integration/migration guide | `docs/guides/INTEGRATION.md` | README, AGENTS and handoff references; update links. | Documentation path only. |
| `LICENSE` | Essential project/legal file | Retain at root | Conventional license discovery and package metadata. | Root convention. |
| `MULTI_DOMAIN.md` | Integration/architecture guide | `docs/guides/MULTI_DOMAIN.md` | README, AGENTS and domain docs; update links. | Documentation path only. |
| `NEXT_AGENT_PROMPT.md` | Essential agent handoff | Retain at root | Canonical next task is intentionally accessible at root; refresh for this PR. | Root convention. |
| `PARITY.md` | Historical/reference material | Retain at root, unchanged | Explicitly retained by repository governance; its evidence/report location is intentionally not reorganized. | Owner-protected; no relocation. |
| `PHASE1_AUDIT_PLAN.md` | Historical/reference documentation | `docs/architecture/PHASE1_AUDIT_PLAN.md` | Later audit plans and architecture references; update links/path mentions. | Historical content retained. |
| `PHASE2_IMPLEMENTATION_PLAN.md` | Historical/reference documentation | `docs/architecture/PHASE2_IMPLEMENTATION_PLAN.md` | Later review and architecture references; update links/path mentions. | Historical content retained. |
| `POST_PHASE2_ARCHITECTURE_REVIEW.md` | Historical/reference documentation | `docs/architecture/POST_PHASE2_ARCHITECTURE_REVIEW.md` | Precache/compatibility and historical links; update links/path mentions. | Historical content retained. |
| `PRECACHE_INTEGRITY.md` | Operations/release documentation | `docs/operations/PRECACHE_INTEGRITY.md` | AGENTS, workflow and release/integration docs; update links and static path checks. | Documents critical runtime/version policy; content unchanged except links/layout descriptions. |
| `README.md` | Essential project documentation | Retain at root | Repository landing page. Update links and structure overview. | Root convention. |
| `THEMING.md` | SDK/user guide | `docs/guides/THEMING.md` | README, widget, package and audit references; update links. | Documentation path only. |
| `WIDGET.md` | SDK/architecture guide | `docs/guides/WIDGET.md` | README, AGENTS, SDK/example docs, architecture and static checks; update links/reads. | Documents public widget contracts; path itself is not a runtime URL. |
| `assistant-state.js` | Generated public runtime asset | Retain at `/assistant-state.js` | SDK synchronizer writes it; Pages and examples copy/serve it; contract inventory and integration snippets reference it. | **Public URL and generated SDK/runtime boundary; do not relocate.** |
| `assistant-widget.css` | Public runtime asset | Retain at `/assistant-widget.css` | Pages and example runtime copy and widget stylesheet link. | **Public URL; do not relocate.** |
| `assistant-widget.js` | Public runtime asset | Retain at `/assistant-widget.js` | Pages and example runtime copy and browser integrations. | **Public URL; do not relocate.** |
| `browserconfig.xml` | Public runtime/manifest asset | Retain at `/browserconfig.xml` | Pages and example assembly; browser tile metadata. | **Public URL and scope-sensitive paths; do not relocate.** |
| `dns-diagnostics.js` | Public runtime asset | Retain at `/dns-diagnostics.js` | Integration snippets, Pages and example runtime copy. | **Public URL; do not relocate.** |
| `domain-config.js` | Public runtime asset | Retain at `/domain-config.js` | Classic browser integration, Pages and example runtime copy. | **Public URL; do not relocate.** |
| `domain-registry.js` | Public runtime asset | Retain at `/domain-registry.js` | Classic browser integration, Pages and example runtime copy. | **Public URL; do not relocate.** |
| `favicon.ico` | Public runtime/branding asset | Retain at `/favicon.ico` | Pages and example runtime copy, browser references. | **Public URL; do not relocate.** |
| `manifest-handler.js` | Server-side source/edge helper | Retain at root | `functions/manifest.webmanifest.js`, static checks and tests import/read it. | Not a published runtime URL, but avoid unnecessary module-path churn. |
| `manifest.webmanifest` | Public runtime asset | Retain at `/manifest.webmanifest` | HTML, Pages and host integration. | **Public URL and install identity/protocol contract; do not relocate.** |
| `offline.css` | Public offline runtime asset | Retain at `/offline.css` | Offline HTML, Pages/example copies and worker precache. | **Public URL and precache contract; do not relocate.** |
| `offline.html` | Public offline runtime asset | Retain at `/offline.html` | Service-worker fallback, Pages/example copies and tests. | **Public URL, scope and precache contract; do not relocate.** |
| `offline.js` | Public offline runtime asset | Retain at `/offline.js` | Offline HTML, Pages/example copies and worker precache. | **Public URL and precache contract; do not relocate.** |
| `package.json` | Essential project/build configuration | Retain at root | npm scripts and package version/workspace-independent checks. | Root npm configuration and kit version declaration. |
| `progressier.js` | Public compatibility runtime asset | Retain at `/progressier.js` | Legacy registration compatibility; Pages and example copies; worker import behavior. | **Public service-worker URL/scope contract; never redirect or alias.** |
| `pwa.css` | Public runtime asset | Retain at `/pwa.css` | `pwa.js`, Pages/example copies and integration tags. | **Public URL and precache contract; do not relocate.** |
| `pwa.js` | Public runtime entry point | Retain at `/pwa.js` | Integrations, Pages/example copies, worker/runtime asset references. | **Public URL, base-path resolution and precache contract; do not relocate.** |
| `qrcode.js` | Public optional runtime asset | Retain at `/qrcode.js` | Runtime loader and Pages/example copies. | **Public URL; do not relocate.** |
| `snippet.html` | Copy-paste integration example | `docs/guides/snippet.html` | README, widget/architecture docs, tests and static checks; update links and test paths. It is not fetched by the runtime. | Documentation/example path only; embedded asset URLs stay unchanged. |
| `you-ge-sw.js` | Canonical public service worker | Retain at `/you-ge-sw.js` | Registration, precache, Pages/example copies and worker lifecycle tests. | **Critical public URL, scope, update and integrity contract; do not relocate.** |

The root directories `demo/`, `example/`, and `design-system/` are reorganized as described below. `functions/`, `icons/`, `reference/`, `scripts/`, `tests/`, `packages/`, `examples/`, `.agents/`, and `.github/` remain at root for runtime/deployment conventions, existing tooling/package boundaries, or established organizational purpose.

## Directory moves

| Current path | Destination | Reason | Important references | Contract impact |
|---|---|---|---|---|
| `demo/` | `examples/demo/` | First-party Pages feature-test playground. | `.github/workflows/pages.yml`, tests and docs. Pages assembly continues copying this source to the same site root. | Source path changes; public URL stays `/`. |
| `example/` | `examples/example/` | Independent Vite/React example belongs alongside other examples. | npm file dependency, lockfile, Vite shared-runtime path, CI/Pages working directories, tests and docs. | Source path changes; deployed URL remains `/example/`; runtime files remain at their existing public paths. |
| `design-system/` | `docs/design-system/` | Design reference belongs with design documentation. | AGENTS, design guide and internal design links. | Documentation path only. |

## Target layout

```text
/
├── .agents/                 # repository agent skills
├── .github/                 # CI and Pages workflows
├── docs/
│   ├── architecture/        # architecture, audits and historical plans
│   ├── design-system/       # first-party design guidance/reference
│   ├── guides/              # integration, theming, widget, SDK/user guides
│   ├── operations/          # precache and operational policy
│   └── reference/           # compatibility contracts
├── examples/
│   ├── demo/                # Pages feature-test source, emitted at site root
│   ├── example/             # independent React/Vite Pages app at /example/
│   └── push-server/         # optional backend example
├── functions/               # Cloudflare Pages Functions route (path-sensitive)
├── icons/                   # public /icons/* assets
├── packages/assistant-sdk/  # independently packaged SDK
├── reference/               # preserved third-party compatibility evidence
├── scripts/                 # repository check/build/support tooling
├── tests/                   # repository tests and support harnesses
├── public runtime files     # retained at root to preserve exact URLs/contracts
├── AGENTS.md                # permanent contributor/agent rules + integration guide
├── AGENT_HANDOFF.md         # authoritative current state
├── CHANGELOG.md             # release history
├── LICENSE                  # legal/project metadata
├── NEXT_AGENT_PROMPT.md     # next task prompt
├── PARITY.md                # explicitly preserved reference report
├── README.md                # repository landing page
└── package.json             # root npm scripts and kit version
```

Classic runtime scripts are intentionally not moved into `src/`: they are shipped directly at stable root-relative URLs, including the service worker's scope and precache contract. Future internal modules should use a new source directory only when a clear build/copy boundary exists and the generated public URLs are explicitly verified.

## Placement conventions

- New source code goes in its existing package boundary (`packages/assistant-sdk/src/` for SDK modules; `examples/<app>/src/` for example-only UI). Do not move stable root runtime assets into those source trees.
- New public runtime files stay at their documented root URL (or under `icons/` for `/icons/*`) unless a separately reviewed build/copy change preserves the exact URL, scope, and integrity behavior.
- Tests and test-only harnesses belong under `tests/` or `packages/assistant-sdk/tests/`; fixtures belong under a dedicated test fixture subtree.
- User/architecture docs belong in the appropriate `docs/` category. Root `README.md`, `AGENTS.md`, `AGENT_HANDOFF.md`, `NEXT_AGENT_PROMPT.md`, `CHANGELOG.md`, `LICENSE`, `PARITY.md`, and `package.json` remain at root for discoverability, conventions, or explicit preservation.
- Keep `functions/` at root because Cloudflare Pages discovers functions from that directory; preserve `reference/` and `PARITY.md` under repository governance.
