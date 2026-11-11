# Project agent skills

This directory holds the agent skills available to You.Ge Assistant development, following the cross-client `.agents/skills/` convention: each skill is its own folder containing a `SKILL.md` (YAML frontmatter with at least `name` and `description`) plus optional supporting files. The skill folder name must match the `name` field in its `SKILL.md`. A `README.md` at this level is ignored by discovery (it is not a skill folder).

## Installed skills

| Skill | Upstream source | License | When to invoke |
| --- | --- | --- | --- |
| `mobile-native` | https://github.com/emilkowalski/skills (`skills/mobile-native/SKILL.md`) | MIT | Mobile-first and PWA UI work: touch interactions, mobile navigation, safe areas, viewport/keyboard behavior, responsive layouts on the web PWA and the React example. |
| `break-ui` | https://github.com/emilkowalski/skills (`skills/break-ui/SKILL.md` + `CATALOG.md`) | MIT | UI edge-case testing: long labels and content, empty and error states, large datasets, extreme values, overflow, unusual but realistic interactions. Worst-case fixture stays dev-only; runs through existing fixtures and the Node.js test runner; no new dependencies. |
| `tdd` | https://github.com/mattpocock/skills (`skills/engineering/tdd/SKILL.md` + `tests.md` + `mocking.md`) | MIT | Implementation and regression tests: red → green → refactor, one vertical slice at a time, tests at public interfaces/seams. Uses the existing `node --test` runner and project conventions; must not assume Vitest or another framework. |

## How skills are used

Skills are read-only guidance. Arena discovers them by scanning `.agents/skills/*/SKILL.md` and loads a skill when a task matches its description. Supporting files resolve relative to the skill folder. Skills add no runtime dependencies, introduce no build step, and do not change application behavior or the PWA toolkit.

## Skills evaluated but not installed

| Skill | Upstream source | Reason not installed |
| --- | --- | --- |
| `grill-me` | https://github.com/mattpocock/skills | No current `SKILL.md` exists in the upstream repository (only `docs/productivity/grill-me.md`; the upstream `skills/deprecated/` bucket states retired skills are deleted, not kept). Not installed until a verifiable upstream `SKILL.md` exists. |
| `to-spec` | https://github.com/mattpocock/skills (`skills/engineering/to-spec/SKILL.md`) | `disable-model-invocation: true` — it cannot be model-invoked, and its workflow publishes specs to a project issue tracker with triage labels, an external tracker integration/side effect this task does not require. |

Do not install `to-tickets`, `code-review`, `diagnosing-bugs`, or the entire Matt Pocock collection unless a concrete task justifies them.

## Optional future skills (do not install by default)

Emil animate, Emil review-animations, Emil improve-animations, Emil prototype, Jakob Krehel better-interface, Vercel vercel-react-best-practices, Benji Taylor stageshow. Install only when a concrete task justifies them. Do not add `animate-expo` to this web PWA project; do not use Stageshow as a replacement for production UI engineering.

## Priority rules

1. `ui-ux-pro-max-skill` remains the mandatory design authority for interface changes (see AGENTS.md); it takes priority over any skill for UI decisions.
2. `mobile-native` takes priority for mobile- and PWA-specific work.
3. `break-ui` applies before UI changes land, to catch edge cases early.
4. `tdd` applies to implementation and regression testing.
5. No skill overrides the dependency-free core toolkit, existing PWA/offline/service-worker behavior, design tokens and theme architecture, or existing React Bits constraints.

## License notices

Upstream license texts are copied into each skill folder (`LICENSE`). The skill `SKILL.md` files are kept verbatim from their upstream sources; nothing in them was modified.
