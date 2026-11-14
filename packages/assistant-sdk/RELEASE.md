# `@youge/assistant-sdk` — Release Preparation & Publishing Decision

> **Current registry status (verified 2026-11-14):** npm reports
> `@youge/assistant-sdk@0.2.0` as the current version. The detailed preparation
> and verification records below describe the 2026-11-07 release work and are
> historical; they do not describe the current registry state. This Stage 5.4
> task did not stage, publish, release, or change package metadata. The
> repository's release workflow remains manually authorized and gated; nothing
> is published automatically on push, pull request, or merge.
>
> **Release-auth history:** 0.1.0 and 0.1.1 were staged by the manual GitHub
> Actions `stage` job and made public only after owner approval on npmjs.com.
> The initial publication used a temporary stage-only `NPM_STAGE_TOKEN`, which
> was created, used, and revoked. Since the 2026-11-07 OIDC migration, staging
> and publishing use npm Trusted Publishing (OIDC) and no npm token. See the
> runbook and historical verification details below.

This document records (1) the package-metadata review, (2) the evaluation of
publishing destinations with a recommendation, (3) the release procedure to
use **once a release is explicitly approved**, (4) the **npm Trusted
Publishing (OIDC) migration**, (5) the verification results of this
preparation pass, and (6) the required owner follow-ups.

Related documents: [`README.md`](README.md) (public API and consumption) ·
[`MIGRATION.md`](MIGRATION.md) (staff.you.ge vendored-copy migration) ·
[`../../CHANGELOG.md`](../../CHANGELOG.md).

---

## 1. Current state

| Item | Value | Notes |
| --- | --- | --- |
| Package name | `@youge/assistant-sdk` | Scope `@youge` (npm org `youge`, npm user `you-ge`) — confirmed by the project owner, see [§2](#2-package-identity-decisions); npm registry currently reports `0.2.0` (verified 2026-11-14) |
| Version | `0.2.0` (current registry version as of 2026-11-14) | Synced with `SDK_VERSION` in `src/core/constants.js` and the `check.mjs` release-ready gate |
| Visibility | published (`0.1.0`, `0.1.1`, `0.2.0`) | `"private": true` lock removed in the 0.1.0 release PR per [§4](#4-release-runbook-when-a-release-is-approved) step 1; every future publish path stays gated ([§5](#5-publishing-remains-disabled)) |
| Publish config | `publishConfig.access: "public"` | Ready for an approved first scoped publish |
| Module system | ESM only (`"type": "module"`) | Buildless: `src/` **is** the published runtime |
| TypeScript | Paired `.d.ts` per export entry | `.`, `./domain`, `./config`, `./diagnostics`, `./installation`, `./browser`, `./react` |
| Export map | Explicit subpaths, no wildcards | Deep imports like `@youge/assistant-sdk/src/...` are **blocked** |
| Runtime dependencies | **Zero** | `react >= 18` is an optional peer only (for `./react`) |
| License | MIT ([`LICENSE`](LICENSE)) | Matches the repository license |
| Packed size | 21 files, 38.0 kB tarball / 147.4 kB unpacked | `npm pack --dry-run` (2026-11-07) |
| Kit compatibility | `KIT_COMPAT_VERSION = 1.1.1` in the repository source | Matches the You.Ge Assistant runtime version (`pwa.js` / `progressier.js`). The published `0.2.0` tarball was built at kit `1.1.0` and reports `1.1.0`; the constant is informational and changes in a published package only with the next SDK release |
| Config schema | `SCHEMA_VERSION = 1` | Data-only `publishedConfig` pipeline, LKG fallback |
| **Publishing auth** | **npm Trusted Publishing (OIDC) everywhere: the `stage` and `publish` jobs both carry `id-token: write`; no npm token reference exists anywhere in the workflows. First publication (0.1.0, 2026-11-06) used the temporary `NPM_STAGE_TOKEN` bootstrap — created, used and revoked** | Verify, stage and publish use no npm token at all; the bootstrap token was a temporary credential, not the future publishing method — [§4](#4-release-runbook-when-a-release-is-approved), [§6](#6-npm-trusted-publishing-oidc), [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important) |

Why the package was marked `private`: Phase 2 (PR #7) extracted the SDK
locally and explicitly wanted to make an accidental `npm publish` impossible
until a real release decision was made. That lock held through the release
preparation (PR #9) and identity correction (PR #10), and is removed only now,
in the approved 0.1.0 release PR, exactly as [§4](#4-release-runbook-when-a-release-is-approved)
step 1 prescribes.

## 2. Package identity decisions

### Name

**Final package identity (confirmed by the project owner, 2026-11-06):**

| Role | Identity |
| --- | --- |
| npm user | `you-ge` |
| npm organization | `youge` |
| npm scope | `@youge` |
| **Package** | **`@youge/assistant-sdk`** |

The previous name `@you-ge/assistant-sdk` was based on an incorrect assumption
about the organization scope. It was **never published**, so the rename to
`@youge/assistant-sdk` happened before first publication and breaks no
consumer (the vendored `staff.you.ge` copy predates any registry pin).

Registry verification (2026-11-06, `registry.npmjs.org`) — identity available,
no conflict:

- `@youge/assistant-sdk` is **unpublished** (registry returns 404).
- Zero packages exist under `@youge/*` (`scope:youge` search) — no third party
  squats the scope or the name.
- The org/scope `youge` **exists**: `GET /-/org/youge/user` returns a member
  map, while a nonexistent-org control returns `{"error":"Scope not found"}`.

**No account, org, scope or token was created, claimed or modified by this
task.** Ownership of the org `youge` stays with the project owner's npm user
`you-ge` (owner-side fact; verify publish rights on npmjs.com before the first
release).

GitHub Packages note (conclusion unchanged): the `@youge` scope still cannot
be published from `sandro-defender/you-ge-assistant`, because GitHub Packages
requires the npm scope to match the **publishing repository's owner**
(`@sandro-defender/*`). Public npm therefore remains the recommended
destination ([§3](#3-publishing-destination-evaluation)).

### Version

- Pre-1.0 semver (`0.2.0` prepared; `0.1.0` published 2026-11-06) signals the API is
  extracted-and-tested but not yet frozen by a public release. Policy:
  - **patch** — bug fixes, no API or state-model change;
  - **minor** — additive API (new exports, new optional options);
  - **major** — breaking API change (also bumps `SCHEMA_VERSION` if the config
    contract changes).
- Version synchronization is machine-checked
  (`packages/assistant-sdk/scripts/validate-package.mjs`): `package.json` ↔
  `SDK_VERSION` ↔ `KIT_COMPAT_VERSION` ↔ the runtime version.
- Never publish a version that already exists on the registry; the release
  workflow re-checks this at run time.

### Module system & types

- **ESM-only, no CommonJS build — deliberate.** The SDK is dependency-free and
  buildless; a CJS artifact would introduce a build step and a second runtime
  shape to test. Consumers are modern bundlers (Vite, Next, webpack, Rollup,
  esbuild) and Node ≥ 18 ESM; CJS hosts can `await import('@youge/assistant-sdk')`.
  This is documented in the README so nobody discovers it at runtime.
- TypeScript declarations ship next to every entry point and are wired through
  the `types` condition of each `exports` entry plus the legacy top-level
  `types` field.

### Export map & contents

- The `exports` map is the **only** supported import surface. It has no `./*`
  wildcard, so internal source files cannot be imported by path — consumers can
  never depend on repository internals.
- The `files` whitelist ships `src/`, `README.md`, `LICENSE` (npm always adds
  `package.json`). Tests, validation scripts and repository metadata are
  excluded from the tarball (verified via `npm pack --dry-run --json`).
- Every source module uses package-relative imports only; nothing references
  repository-specific paths outside the package.

## 3. Publishing destination evaluation

| Criterion | **Public npm** (`registry.npmjs.org`) | GitHub Packages (`npm.pkg.github.com`) |
| --- | --- | --- |
| Package visibility | Public by default with `publishConfig.access: "public"`; free | Public packages possible, but **every install still needs authentication** |
| Authentication to **install** | None — anonymous, cache-friendly | `read:packages` token required for **all** consumers, even public packages |
| Authentication to **publish** | **npm Trusted Publishing (OIDC) from GitHub Actions** — no stored token | `GITHUB_TOKEN`/PAT with `write:packages`, OIDC-friendly |
| GitHub Actions compatibility | `actions/setup-node` + `registry-url` + `id-token: write`; provenance automatic over OIDC | Same pattern with `registry-url: npm.pkg.github.com` |
| **Cloudflare build compatibility** | **Frictionless** — `npm ci` works in Cloudflare Pages/Workers builds with no secrets | Requires a build secret (see below) and `.npmrc` plumbing on every build |
| staff.you.ge installation | Exact-version pin, works in any CI and locally, no onboarding | Every dev + CI + Cloudflare build needs a token before `npm ci` works |
| Long-term maintenance | Default ecosystem path; lockfiles, Dependabot, provenance | Extra auth surface, token rotation, broken forks/PRs without secrets |
| Ownership & naming | Scope `@youge` (org `youge`, user `you-ge`) is confirmed and verified available ([§2](#2-package-identity-decisions)) | Scope must match the **publishing repository's owner** — `sandro-defender/you-ge-assistant` can only publish `@sandro-defender/*`, so the `@youge` name **cannot be published from this repository at all** |

### Recommendation: **public npm** (`registry.npmjs.org`), scoped package, `access: public`

Reasons, in order:

1. **Cloudflare builds need zero configuration.** staff.you.ge builds on
   Cloudflare; with public npm, `npm ci` just works. With GitHub Packages every
   build would need a `read:packages` token.
2. **The `@youge/assistant-sdk` name is only possible on npm.** GitHub Packages
   would force `@sandro-defender/assistant-sdk` (scope must match the repo
   owner) and could not honor the `You-ge` brand scope.
3. **Consumer friction**: staff.you.ge pins the same way as any npm dependency;
   no `.npmrc`, no token rotation, no broken contributor or fork builds.
4. **Maintenance**: npm Trusted Publishing (OIDC) gives signed, source-linked
   releases with **no long-lived token secret** to rotate or leak.

### If GitHub Packages were ever required — the secure configuration

(Not recommended; recorded so the decision is reproducible.)

- Publish from a repository owned by the scope owner, and accept the
  `@sandro-defender/assistant-sdk` name.
- In Cloudflare build settings, store a **masked** secret (e.g.
  `NPM_TOKEN`) holding a fine-scoped token with `read:packages` only.
- Generate `.npmrc` **during the build**, never commit it:
  `printf '//npm.pkg.github.com/:_authToken=%s\n' "$NPM_TOKEN" > ~/.npmrc`
- Rotate the token on staff changes/leaks; treat fork builds as untrusted (the
  secret must not be exposed to `pull_request` from forks).

## 4. Release runbook (when a release is approved)

Prerequisites: the registry identity `@youge/assistant-sdk` is confirmed and
verified available ([§2](#2-package-identity-decisions)); the maintainer has
decided the registry ([§3](#3-publishing-destination-evaluation)).

1. **Release PR** (one deliberate, reviewable change set) — **DONE (0.1.0
   release PR):**
   - ✅ version set to exactly `0.1.0` in `packages/assistant-sdk/package.json`
     and `SDK_VERSION` in `src/core/constants.js` (already synchronized; no
     bump beyond `0.1.0`);
   - ✅ `CHANGELOG.md` `0.1.0` initial-release entry added;
   - ✅ `"private": true` removed from `packages/assistant-sdk/package.json`;
   - ✅ the two explicit guard assertions updated as intentional review
     signals: `scripts/check.mjs` now asserts release-ready state, and
     `packages/assistant-sdk/scripts/validate-package.mjs` now verifies
     publishability **and** that the workflow publishing gates stay intact;
   - ✅ `npm run check` and `node packages/assistant-sdk/scripts/validate-package.mjs`
     green.
   - **0.1.1 feature-release PR (2026-11-07):** version bumped to `0.1.1` in
     `packages/assistant-sdk/package.json`, `SDK_VERSION`,
     `scripts/check.mjs` and the example lockfile; `CHANGELOG.md` gained the
     `0.1.1` entry (Android Chrome handoff + floating-icon auto-scale/manual
     adjustment); both features documented (README, WIDGET.md, MIGRATION).
     **Status: DONE — staged and published 2026-11-07 (07:04/07:07 UTC)
     via the OIDC `stage` job + owner approval; the `publish` job never
     ran** (§7, §6.6).
2. **Verify** — run the `sdk-release-prep` workflow with `Verify only`
   selected in the single `action` dropdown (manual dispatch only; no typed
   confirmation, no version field — the version is read from
   `packages/assistant-sdk/package.json`). All jobs green. The verify job
   never publishes and uses no npm token. **Status: recorded** — verify runs 42349081896 /
   42349219049 / 42349614361 were green before the 0.1.1 release; the
   2026-11-07 07:18 UTC run (42350738180) fails at "Version has not been
   published yet" because `0.1.1` is on the registry — **expected gate
   behavior until the next release PR bumps the version** (§6.6, §7).
3. **Stage the first publication — DONE (2026-11-06, via the temporary
   bootstrap)** (see [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important)
   for the full detail). This was a **staging** step, not a publication:
   - **3a. Owner created the stage-only token** on npmjs.com (profile menu →
     **Access Tokens** → **Generate New Token** → **Granular Access Token**):
     Packages and scopes = the **`@youge` scope**; Permissions = **Read and
     write (stage only)**; **Bypass two-factor authentication unchecked**;
     shortest available expiry. This token was a **temporary bootstrap
     credential, not the future publishing method** — OIDC replaced it
     (step 6). **Status: DONE — created; later revoked (step 5).**
   - **3b. Owner added the GitHub Actions secret**: repository →
     **Settings → Secrets and variables → Actions → New repository secret** →
     name exactly **`NPM_STAGE_TOKEN`**, value = the token from 3a. (A
     repository secret — the protected `sdk-npm-publish` environment itself
     was not created or modified.) **Status: DONE — and the secret has since
     been deleted (step 5); no npm token reference remains anywhere in this
     repository's workflows.**
   - **3c. Owner dispatched** the `sdk-release-prep` workflow with
     `action: stage` **and** `confirm_stage: stage`, **from the `main`
     branch** (historical record — the interface is now the single
     `action` dropdown with no typed confirmation fields, §6.5). The `stage` job ran only after the full `verify` job
     succeeded, on GitHub-hosted `ubuntu-latest`, inside the protected
     `sdk-npm-publish` environment, and ran the package validator
     immediately before `npm stage publish --access public` from
     `packages/assistant-sdk`, staging exactly `@youge/assistant-sdk@0.1.0`
     with `SDK_RELEASE_CONFIRM=publish` (required because staging executes
     the publish lifecycle) and `NODE_AUTH_TOKEN` from `NPM_STAGE_TOKEN`
     (the bootstrap as it existed on 2026-11-06 — since the 2026-11-07 OIDC
     migration the same staging runs token-free with `id-token: write`,
     [§6.2](#62-workflow-configuration-githubworkflowssdk-release-prep-yml)).
     The job cannot run `npm publish`, cannot approve/reject/promote any
     stage, and sets no `SDK_RELEASE_ENABLED`.
     **Result: 0.1.0 was STAGED, NOT published at this step** — a public
     `0.0.0-stage` placeholder could appear on the package page while the
     real `0.1.0` stayed hidden. The run summary reported the **stage ID**
     and the approval steps below. **Status: DONE (2026-11-06).**
4. **Owner approves the staged `0.1.0` (this — and only this — publishes
   it).** Sign in to npmjs.com with the publishing account, open
   `@youge/assistant-sdk` → **Staged Packages** tab → review the staged
   `0.1.0` → **Approve** → complete the **2FA** prompt. CLI alternative:
   `npm stage list`, `npm stage view <stage-id>`, then
   `npm stage approve <stage-id> --otp <code>` ([§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important)).
   **Status: DONE (2026-11-06) — the owner approved the staged `0.1.0` with
   2FA and it became the public first release.**
5. **Revoke the bootstrap immediately after staging succeeded** (do not wait
   for approval): delete the granular token on npmjs.com (Access Tokens →
   delete, or `npm token revoke <id>`) **and** delete the `NPM_STAGE_TOKEN`
   repository secret. The staged `0.1.0` stayed in npm's staging area —
   revoking the token does not affect a staged version.
   **Status: DONE — the `NPM_STAGE_TOKEN` bootstrap was created, used and
   revoked; the secret is deleted; no npm token remains in this repository.**
6. **Register npm Trusted Publishing (OIDC) — REQUIRED OWNER ACTION BEFORE
   THE NEXT RELEASE** (see [§6](#6-npm-trusted-publishing-oidc) and
   [§6.3](#63-registering-the-trusted-publisher-owner-action)): the package
   now exists (`0.1.0` published), so the trusted-publisher connection can be
   registered — owner `sandro-defender`, repo `you-ge-assistant`, workflow
   filename `sdk-release-prep.yml`, environment `sdk-npm-publish`, allowed
   actions **`npm stage publish` AND `npm publish`** (both jobs of
   `sdk-release-prep.yml` authenticate through this single connection). The
   protected `sdk-npm-publish` **environment** already exists (with required
   reviewers — verify the reviewer protection is actually enforced before the
   next publish run); after step 5 no npm token secret remains — **the verify
   job, the stage job and the OIDC publish job all use no npm token**; and
   the repository variable `SDK_RELEASE_ENABLED = true` is set only when a
   later release is explicitly approved — the explicit "publishing approved"
   switch. ⚠️ npm requires the new connection to complete its **first
   successful publish within 48 hours** of creation or it expires (§6.3), and
   whether a *staged* publish counts toward that window is **UNVERIFIED**
   until tested — register at a moment when a publish can land inside the
   window, and record the validation result in §7.
   **Status: OWNER ACTION — see
   [§8](#8-required-follow-ups-before-the-first-publish).**
   - ⚠️ `SDK_RELEASE_ENABLED` must stay **unset** until the owner explicitly
     approves publication; this repository never sets it, and no automation
     may set it.
7. **Publish later releases** — run `sdk-release-prep` with
   `Publish release to npm` selected in the single `action` dropdown (from
   `main`; there is no typed confirmation field). The `publish-authorization`
   gate job first fails the run with a clear explanation unless
   `SDK_RELEASE_ENABLED = 'true'`; the publish job then runs only with all
   gates from step 6 and only on this manual dispatch. It
   authenticates with the short-lived OIDC token minted by
   `id-token: write` — there is no `NODE_AUTH_TOKEN` to leak. The
   `prepublishOnly` hook aborts any publish attempt that lacks
   `SDK_RELEASE_CONFIRM`, but that is an **accidental-publish guard only**: it
   does not make direct publishing impossible, and a person who already holds
   npm publish rights can publish directly (see
   [§5](#5-publishing-remains-disabled)). **`0.1.0` itself never ran this
   job — it was published by step 4's approval.** **Status: pending step 6 —
   not authorized.**
8. **Post-publish smoke test** — `npm view @youge/assistant-sdk version`,
   install the exact version in a scratch project and in staff.you.ge's
   lockfile (see [`MIGRATION.md`](MIGRATION.md)). **Status: registry view
   confirmed (`0.1.0` present, 2026-11-07); scratch/lockfile install —
   pending owner.**
9. Optionally tag the release commit **after** a successful publish (tags are
   created only as part of an approved release, never by automation on merge).
   **Status: pending step 4 (0.1.0) / step 7 (later releases).**

## 5. Publishing remains disabled

The 0.1.0 release PR removed the package-level `"private": true` lock — that
is runbook step 1 and its intentional review signal. Publishing is still
blocked along every ordinary path: every gate below is closed, and the publish
job requires **all** of them at once. (These are operational guards, not
cryptographic boundaries — see the note at the end of this section.)

| Gate | Mechanism | State |
| --- | --- | --- |
| Workflow trigger | `sdk-release-prep.yml` runs on `workflow_dispatch` **only** (never on push/PR/merge/tag) | **Closed** |
| Explicit authorization | Publish requires selecting `Publish release to npm` **from `main`** after `verify`, the new `publish-authorization` gate job passing (`SDK_RELEASE_ENABLED = 'true'` — not set; repository variables are not readable by this automation — treat as unset) **and** the protected-environment approval. Staging separately requires selecting `Stage release on npm` **from `main`**, after `verify` — and staging still cannot publish anything. One `action` dropdown, no typed confirmation fields | **Closed** |
| Protected environment | `sdk-npm-publish`, **owner-configured with required reviewers**. Verify the reviewer protection is actually enforced before the first publish run (the environment exists — do not recreate it); the `stage` job runs inside it too | **Configured — verify protection** |
| Registry credential | **None anywhere.** The `verify` job publishes nothing and uses no npm token; the `stage` job and the `publish` job both authenticate with npm Trusted Publishing (OIDC) — the runner mints a short-lived token via `id-token: write` — so **no npm token reference exists anywhere in the workflow** (the temporary first-publication `NPM_STAGE_TOKEN` bootstrap was created, used and revoked — §4 steps 3–5, §6.4). The npm-side trusted-publisher registration still has to happen (§6.3) | **Missing — owner action (OIDC registration)** |
| Package-level publish authorization | The `prepublishOnly` hook **refuses any `npm publish` that lacks `SDK_RELEASE_CONFIRM=publish`** — a variable injected only by the gated publish and stage jobs. This is an **accidental-publish guard, not a security boundary**: it stops a stray `npm publish` from a normal shell, but anyone with npm publish rights can set the variable (or pass `--ignore-scripts`) | **Closed (guard only)** |

**Staging is not publishing.** The `stage` job does not open any of the
gates above: it can only place a version in npm's staging area (authenticated
via OIDC since the 2026-11-07 migration). The staged `0.1.0` became a
public, installable version **only** when the owner approved it on npmjs.com
with 2FA (§4 step 4), and the workflow itself can never approve, reject or
promote a stage.

Defense in depth: `validate-package.mjs` fails CI if any workflow gate (or the
OIDC configuration on either job, or the `prepublishOnly` script, or the
version contract, or the stage job's OIDC-permissions / manual-only /
staging-only gates) is removed or weakened; standing contracts in
`scripts/check.mjs` and regression tests in `tests/release-gates.test.mjs`
enforce this by mutation.

**What the in-repo gates are, and are not.** `SDK_RELEASE_CONFIRM=publish`,
the `Publish release to npm` selection, `SDK_RELEASE_ENABLED` (checked
first by the `publish-authorization` gate job) and `SDK_RELEASE_CONFIRM` are
**operational / accidental-publish guards**, not cryptographic authorization
boundaries. They stop an ordinary, accidental or unreviewed publish path; they
do **not** stop a person who already holds npm publish rights, who can set the
environment variable themselves, run `npm publish --ignore-scripts`, or publish
directly. **Direct manual publishing is not claimed to be impossible.** The
real authorization boundaries are:

- **npm organization permissions and account security** — who may publish to
  `@youge/*`, and 2FA on the publishing account;
- **the GitHub Actions protected environment** `sdk-npm-publish` and its
  required reviewers — who may approve the workflow run;
- **the npm Trusted Publisher configuration** — npm only accepts a publish
  whose OIDC identity matches the exact registered workflow and environment,
  so the token-less, workflow-scoped credential is the operative gate.

## 6. npm Trusted Publishing (OIDC)

Publishing **and staging** authenticate with **npm Trusted Publishing**
(OpenID Connect) instead of a long-lived npm token. npm issues a short-lived,
workflow-scoped credential on every run; nothing is stored in a secret. This
implements the OpenSSF *trusted publishers* standard. Both the `stage` job and
the `publish` job of `sdk-release-prep.yml` use it (§6.2); since the
2026-11-07 migration the workflow contains **no npm token reference at all**.

### 6.1 Requirements (official npm docs)

| Requirement | Value | Where it lives |
| --- | --- | --- |
| npm CLI | **≥ 11.5.1** | `docs.npmjs.com/trusted-publishers` |
| Node | **≥ 22.14.0** | same |
| CI provider | GitHub Actions on **GitHub-hosted** runners (self-hosted not supported) | `runs-on: ubuntu-latest` |
| OIDC permission | `id-token: write` | publish **and** stage jobs' `permissions` |
| Registry URL | `registry-url: https://registry.npmjs.org` | `actions/setup-node` |
| Build cache | `package-manager-cache: false` (recommended for release builds) | `actions/setup-node` |
| `repository.url` | must exactly match `https://github.com/sandro-defender/you-ge-assistant` | `packages/assistant-sdk/package.json` (machine-checked) |
| npm auth token (any job) | **none — no npm token reference exists anywhere in the workflow.** `verify` publishes nothing and uses no npm token; the stage and publish jobs both mint the OIDC token via `id-token: write`. The temporary first-publication `NPM_STAGE_TOKEN` bootstrap was created, used and revoked (§6.4) | machine-checked |
| Provenance | generated automatically over OIDC; the `--provenance` flag is optional (kept explicit here) | publish step |
| `npm stage publish` CLI | npm CLI **≥ 11.15.0** (runs in the workflow's stage job — guarded there; Node 24 ships npm ≥ 11.19.1) and Node ≥ 22.14.0 | docs.npmjs.com/staged-publishing |
| `npm trust` CLI | npm CLI **≥ 11.15.0** (owner action — §6.3) | owner machine |
| GitHub environment | `sdk-npm-publish` (optional on npm; used here for approval) — publish **and** stage jobs | publish/stage jobs |

### 6.2 Workflow configuration (`.github/workflows/sdk-release-prep.yml`)

The `publish` job now:

- runs on `ubuntu-latest` (GitHub-hosted);
- declares `permissions: contents: read` + `id-token: write`;
- pins `node-version: 24` (ships npm ≥ 11.5.1) and sets
  `registry-url: https://registry.npmjs.org` with `package-manager-cache: false`;
- adds a guard step that fails the run unless `npm -v` is ≥ 11.5.1;
- sets **no** npm auth token env — only `SDK_RELEASE_CONFIRM: publish`;
- runs `npm publish --access public --provenance`.

The `stage` job (first-publication staging — fully OIDC since 2026-11-07)
now:

- runs only on manual dispatch selecting `Stage release on npm`,
  **from `main`**, and only after `needs: verify`
  succeeds — never on push, pull_request or merge (the workflow has no such
  triggers), so the per-run OIDC credential is never exposed to PR or
  untrusted-branch runs;
- runs on `ubuntu-latest` inside the existing protected `sdk-npm-publish`
  environment (created and configured by the owner — never recreated or
  modified here), with `permissions: contents: read` + `id-token: write`
  **exactly** — OIDC is technically required for `npm stage publish`, and no
  other permission is granted (machine-checked: exactly those two keys);
- pins `node-version: 24` and guards **npm ≥ 11.15.0** (the staged-publishing
  requirement) with an explicit failing check;
- runs `node packages/assistant-sdk/scripts/validate-package.mjs`
  **immediately before** staging;
- runs `npm stage publish --access public` from `packages/assistant-sdk` with
  `SDK_RELEASE_CONFIRM=publish` (staging executes the publish lifecycle, so the
  package's `prepublishOnly` guard requires it — accidental-publish guard only)
  and **no token of any kind**: npm detects the GitHub Actions OIDC
  environment and exchanges the runner's short-lived ID token (minted via
  `id-token: write`) for a workflow- and environment-scoped credential —
  there is no `NODE_AUTH_TOKEN` and no npm secret to leak, echo, interpolate
  into command text, persist or upload (machine-checked: any
  `NODE_AUTH_TOKEN` / `secrets.NPM_*` reference anywhere in the workflow fails
  validation);
- never runs `npm publish`, never runs `npm stage approve` / `npm stage
  reject` (approval is the owner's decision on npmjs.com — short-lived trust
  tokens cannot run them anyway), never sets `SDK_RELEASE_ENABLED`, and
  contains no npm token reference;
- writes a run summary that reports the **stage ID**, the **staged-NOT-
  published** state, the possible public **`0.0.0-stage` placeholder**, the
  OIDC (no-token) authentication, and the owner's approval +
  trusted-publisher registration steps.

The `Verify only` selection is unchanged and remains completely
non-publishing (and token-free).

### 6.3 Registering the trusted publisher (owner action)

A trusted publisher is configured **from the package's settings page** on
npmjs.com (or with the `npm trust` CLI). `@youge/assistant-sdk` **now exists**
on the registry (`0.1.0` published 2026-11-06), so the connection can be
registered at any time — but mind the **48-hour validation window** below: a
newly created connection must complete its first successful publish within 48
hours or it expires and must be re-created. Before the package existed,
registration was impossible — that constraint, and how the first publication
bootstrapped around it, is recorded in
[§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important).

`npm trust` prerequisites (official `npm-trust` docs, npm CLI 12):

- **npm CLI ≥ 11.15.0** (`npm install -g npm@^11.15.0`, or run via `npx npm@latest`);
- **write permission** on the package;
- **2FA enabled** on the account (granular tokens with *bypass 2FA* are **not**
  accepted for `npm trust`; legacy basic auth is also not accepted);
- **the package must already exist** on the registry.

#### Configure it on the website (preferred)

Open npmjs.com → `@youge/assistant-sdk` → **Settings** → **Trusted publisher**
→ **GitHub Actions** and enter:

| Field | Value |
| --- | --- |
| Organization or user | `sandro-defender` |
| Repository | `you-ge-assistant` |
| Workflow filename | `sdk-release-prep.yml` (filename only — no `.github/workflows/` path) |
| Environment name | `sdk-npm-publish` |
| Allowed actions | **`npm stage publish` AND `npm publish`** — both must be enabled on this single connection: the workflow's `stage` job runs `npm stage publish`, and the (disabled-until-approved) `publish` job runs `npm publish`; dist-tags are not needed |

#### Or from the CLI

```bash
npm trust github @youge/assistant-sdk \
  --repo sandro-defender/you-ge-assistant \
  --file sdk-release-prep.yml \
  --environment sdk-npm-publish \
  --allow-stage-publish --allow-publish --yes
```

`npm trust github` accepts `--repo/--repository`, `--env/--environment`,
`--allow-publish`, `--allow-stage-publish` (alias `--allow-staged-publish`),
plus `--dry-run`, `--json`, `--registry` and `-y/--yes`; at least one of the
two `--allow-*` flags is required (this workflow needs **both** — see the
*Allowed actions* row above). The first request needs 2FA.

**Reconciling the documented limits (important).** The npm website's
*Trusted publishers* page states that **each package can have up to 10
trusted publisher connections at the same time**, each added or deleted
independently. The CLI reference for `npm trust` still says *"the registry only
supports one configuration per package"* and instructs you to
`npm trust list` → `npm trust revoke --id <id>` → create a new one in order to
replace it. Where the two disagree, **trust the website UI** — it is the
current, UI-backed behaviour — and use the CLI for `list`/`revoke`. This
workflow needs exactly one connection.

**Other current behaviours worth knowing:**

- **A newly created trusted publisher must complete its first successful
  publish within 2 days**, or it expires and must be re-created.
- **Existing connections cannot be edited** — the provider and required fields
  are fixed once created; delete the connection and create a new one to change
  them.
- **Provenance is generated automatically** when publishing via OIDC from
  GitHub Actions or GitLab CI/CD, so the `--provenance` flag is not required
  (the workflow keeps it explicit). It requires a public repository and a
  public package; it is not supported for CircleCI.
- **Dist-tags** (`npm dist-tag`) over OIDC require npm CLI ≥ 11.21.0 / 12.2.0
  and need **"Allow npm dist-tag"** selected for that connection (disabled by
  default); it is independent of the publish/stage permission.
- **Stage-only permissions are the maximum-security posture**: allow
  `npm stage publish` but not `npm publish`, so every CI-published version is
  reviewed and approved by a maintainer with 2FA.
- npm does **not** validate the configuration when it is saved; mismatches only
  surface at publish time. Double-check the repository, the workflow filename
  (exact, including the `.yml` extension) and the environment.
- **`repository.url` in `package.json` must exactly match the GitHub
  repository** — machine-checked by `validate-package.mjs`.

#### The 48-hour validation window — and what is UNVERIFIED

npm requires a newly created trusted publisher to complete its **first
successful publish within 48 hours** (2 days) of creating the connection, or
the connection expires and must be deleted and re-created (npm docs *Trusted
publishers*; the expiry has been enforced since 2026-10-02). This is a hard
operational constraint on **when** the owner registers the connection:

- ⚠️ **UNVERIFIED:** whether a *staged* publish (`npm stage publish`) that a
  maintainer later approves counts as that "first successful publish" is
  **not documented by npm and must be treated as UNVERIFIED until tested**
  (it is explicitly flagged as unknown by consumers of the npm documentation).
- `0.1.0` was published on 2026-11-06 through the staged-approval path *before*
  any trusted-publisher connection existed, so it cannot satisfy a window that
  starts when the connection is created.
- Practical consequence: either (a) **register the connection immediately
  before the next release** so its first OIDC publish lands inside the
  48-hour window, or (b) register now and confirm with npm whether a staged +
  approved publish satisfies the window before it lapses (otherwise the
  connection expires and is simply re-created later — npm does not validate
  the configuration at save time; mismatches surface at publish time as
  `ENEEDAUTH`).
- Record the validation outcome (date + method + result) in §7 so the next
  release inherits a verified fact instead of an assumption.

#### Recommended: restrict token access once trusted publishing works

Package **Settings** → **Publishing access** → **"Require two-factor
authentication and disallow tokens"**, then revoke any automation tokens that
are no longer needed. This only affects traditional token authentication;
trusted publishers keep working because they use OIDC.

### 6.4 The first publish of a new package cannot use OIDC (important)

npm only allows a trusted publisher to be configured **for a package that
already exists** on the registry (`npm-trust` docs: *"Package must exist: The
package you're configuring must already exist on the npm registry."*).
When this runbook was first written, `@youge/assistant-sdk` was unpublished,
so the **first** release could not use OIDC and had to be bootstrapped — by
the GitHub Actions `stage` job below (no PC terminal required; **DONE:
`0.1.0` staged and approved on 2026-11-06**, with the temporary
`NPM_STAGE_TOKEN` **created, used and revoked**, §4 steps 3–5), or, as a
deprecated fallback, by hand from a PC terminal (Path B). The package now
exists (`0.1.0` is published), so from now on the Trusted Publisher
connection can be registered (§6.3) and every release — staging included —
runs on OIDC with **no npm token** (§6.2). This section is kept as the
record of how the first publication was bootstrapped and as the reference
for the staging mechanics (Path A) that every release still uses.

#### Do not rely on `npm login` for this step

`npm login` (with the default `--auth-type=web`, or `--auth-type=legacy`)
**saves credentials to `.npmrc`**, and the npm CLI reference states that it
*"automatically generates a legacy token of `publish` type"*. That token is a
long-lived credential that sits on disk until you run `npm logout`. This is
**not** a tokenless path and must not be described as one.

There is also a conflict inside npm's own documentation: the current *About
access tokens* page says that **as of November 2025 only granular access tokens
are supported and legacy access tokens have been removed**, while the (older)
`npm-login` reference still describes the legacy-token behaviour above. Because
the two disagree, do **not** depend on `npm login` producing a usable,
least-privilege credential. The path below avoids that ambiguity entirely.

#### Recommended: a minimum-permission granular access token

As of November 2025 npm supports **granular access tokens** only. They can be
scoped to specific packages **or scopes**, restricted by IP range, given a
**short expiry**, and — importantly for this step — granted **write** access so
they can publish. Granular tokens cannot be created from the CLI yet: create one
on npmjs.com. The CLI reference documents the granular options, but the website's
*Creating and viewing access tokens* page states CLI support *"will be added in
the future"* — **prefer the website UI**.

**Can the token be scoped before the package exists? — yes, to the `@youge`
scope.** Granular tokens are not limited to individual packages: the *Creating
and viewing access tokens* page says to choose *"up to 50 specific packages or
scopes"*. The `@youge` scope is already registered on the registry (org/scope
`youge` exists), so the token **can** be limited to `@youge` before
`@youge/assistant-sdk` exists. Once the package exists, narrow it further to
`@youge/assistant-sdk` itself.

Two scoping traps to avoid:

- **Do not use the *Organizations* section of the form.** Granting a token
  access to an organization only lets it manage that organization's settings,
  teams and members — npm states explicitly that *"It does not give the token
  the right to publish packages managed by the organization."* Use the
  **Packages and scopes** section instead.
- **If the dropdown does not offer the `@youge` scope before the package
  exists, stop and verify** (with npm support or the owner) rather than silently
  falling back to **All Packages**. All Packages is broad enough that it should
  only be accepted deliberately, with the shortest expiry, and revoked
  immediately.

Create the token on npmjs.com → profile menu → **Access Tokens** →
**Generate New Token** → **Granular Access Token**, with the **minimum** set
of permissions:

| Setting | Value | Why |
| --- | --- | --- |
| Token name | e.g. `first-publish-0.1.0` | easy to identify and revoke |
| Packages and scopes | `@youge` scope (or `@youge/assistant-sdk` once it exists) | least privilege — never "All Packages" |
| Permissions | **Read and write (stage only)** | a stage-only token cannot push a version live by itself |
| Bypass two-factor authentication | **unchecked (false)** | not needed — see below |
| Allowed IP ranges | leave unset — the job runs on GitHub-hosted `ubuntu-latest` runners, whose egress IPs change | IP pinning would break the stage job |
| Expiration | the **shortest** available date (must be ≥ 1 day in the future) | the token should not outlive the task |

**No `Bypass 2FA` is needed, and it should stay off.** The `npm stage`
documentation's token-behavior table states that a granular access token
**without** bypass **can stage** (`npm publish` would prompt for 2FA instead),
and npm's own best practice is to *"create a GAT without bypass and use
`npm stage publish`"*. Bypass is only relevant to *direct* publishing, and
setting it to true overrides account- and package-level 2FA — leave it off.

Then use it **only** for the staging run (owner step 3 below) and **revoke it
immediately after staging succeeded** — approval of the staged version can
happen later and does not need the token.

> ⚠️ **Credential hygiene (bootstrap history).** During the first
> publication the token's only permitted storage was the dedicated GitHub
> Actions secret **`NPM_STAGE_TOKEN`**, referenced solely by this workflow's
> `stage` job inside the protected `sdk-npm-publish` environment and deleted
> immediately after staging. It never appeared in repository files, a
> committed `.npmrc`, shell history, CI logs or artifacts, or any
> chat/agent transcript. Nothing in this repository ever created, stored or
> requested its value. **That bootstrap is complete: `NPM_STAGE_TOKEN` was
> created, used and revoked (§4 steps 3–5), the secret is deleted, and no
> npm token reference remains anywhere in this repository's workflows.**
> Ordinary runs need no credential at all: the `Verify only` checklist and
> the OIDC `stage` and publish jobs all use **no npm token**.

Two paths, in order of preference.

**Does `npm stage publish` run the package's `prepublishOnly`? — yes, verified
rather than assumed.** `npm stage publish` is implemented in the npm CLI as
`StagePublish extends Publish` (`npm/cli` → `lib/commands/stage/publish.js`), so
it runs the **entire `npm publish` lifecycle**, including `prepublishOnly`
(before packing), `prepack` / `prepare` / `postpack` (during packing) and
`publish` / `postpublish` (after the registry call). The only difference is that
staging calls the registry with `stage: true` and **bypasses the 2FA prompt**,
deferring proof-of-presence to the approve step. Staging also respects
`"private": true` and refuses with `EPRIVATE`.

Caveat: the npm docs' *Scripts* page still says `prepublishOnly` runs *"ONLY on
`npm publish`"* and lists no `npm stage` entry in its lifecycle order. That page
predates the stage subcommand; the CLI source above is authoritative. **The
workflow's staging command therefore keeps `SDK_RELEASE_CONFIRM=publish`** —
the package's `prepublishOnly` refuses without it (§5).

**Path A — GitHub Actions staging (recommended, implemented).** The `stage`
job of `sdk-release-prep.yml` runs `npm stage publish --access public` for
you; you never touch a PC terminal. `npm stage publish` uploads the version to
a staging area; it does **not** go live, and a maintainer with 2FA must approve
it. It works for brand-new packages: npm exposes a public `0.0.0-stage`
placeholder, while the real version stays hidden until approved. Requires
**npm CLI ≥ 11.15.0** and Node ≥ 22.14.0 (both enforced by the job's guard
step on Node 24). Since the 2026-11-07 OIDC migration the job authenticates
with **npm Trusted Publishing (OIDC)** (`id-token: write`) and references **no
token at all** (§6.2); steps 1, 2 and 5 below document the one-time bootstrap
that preceded the migration and are now historical.

**Owner procedure (all on the website):**

1. **Create the stage-only token** — the granular token table above
   (`@youge` scope, **Read and write (stage only)**, **Bypass 2FA** unchecked,
   shortest expiry). **Status: DONE (2026-11-06) — created for the first
   staging, later revoked (step 5); no longer needed, staging now runs on
   OIDC.**
2. **Add the GitHub Actions secret** — repository → **Settings → Secrets and
   variables → Actions → New repository secret** → name exactly
   **`NPM_STAGE_TOKEN`**, value = the token. This was a **temporary bootstrap
   credential, not the future publishing method**: once the package exists,
   npm Trusted Publishing (OIDC) takes over (§6.3) and the secret is deleted.
   (Repository secret only — the protected `sdk-npm-publish` environment is
   not created or modified.) **Status: DONE — and the secret has since been
   deleted; no npm token reference remains anywhere in the workflow.**
3. **Dispatch the workflow** — `sdk-release-prep`, select
   `Stage release on npm` from the single `action` dropdown, from the
   **`main`** branch. The job re-runs the
   full verify checklist first (`needs: verify`), then the package validator
   immediately before staging, then stages exactly `@youge/assistant-sdk@0.1.0`
   with public access. The run summary reports the **stage ID** and states
   explicitly that **0.1.0 is staged, not published** — including the possible
   public `0.0.0-stage` placeholder on a brand-new package. The job cannot run
   `npm publish` and cannot approve, reject or promote a stage.
   **Status: DONE (2026-11-06) — `0.1.0` staged; the run summary reported
   the stage ID.**
4. **Review and approve on npmjs.com with account 2FA** — open the package →
   **Staged Packages** tab → review the staged `0.1.0` → **Approve** → 2FA.
   This — and only this — publishes `0.1.0`. (CLI alternative in the next
   paragraph.) **Status: DONE (2026-11-06) — approved with 2FA; `0.1.0`
   became the public first release.**
5. **Revoke immediately after staging succeeded** — delete the granular token
   (npmjs.com → Access Tokens → delete, or `npm token revoke <id>`) **and**
   delete the `NPM_STAGE_TOKEN` secret. The staged version is unaffected.
   **Status: DONE — `NPM_STAGE_TOKEN` created, used and revoked; the secret
   is deleted.**
6. **Register OIDC** (§6.3) so every later release — staging included —
   publishes with no token. **Status: OWNER ACTION — unblocked now that the
   package exists; mind the 48-hour validation window (§6.3).**

**`npm stage approve` syntax (verified).** `npm stage approve <stage-id>` takes
`--otp <code>` (a two-factor one-time password) and `--registry`. If `--otp` is
omitted and the registry challenges for a one-time password, npm **prompts
interactively** — so the flag is optional, not required. `npm stage reject
<stage-id>` accepts the same flags. `npm stage list`, `npm stage view` and
`npm stage download` take only `--json` / `--registry` and **do not** require
2FA; `npm stage list` and `npm stage view` accept an optional `<package-spec>`.
These are **owner-run review commands** — the workflow itself never executes
approve or reject (machine-checked).

**What happens to the version.** Staging a package that does not yet exist
publishes a public **`0.0.0-stage` placeholder**; the staged `0.1.0` and its
contents stay hidden until a maintainer approves it. Approval can happen in the
CLI or on npmjs.com (**Staged Packages** tab → **Approve**) and **always prompts
for 2FA**. After approval, the staged `0.1.0` is published to the package page.

Two constraints to keep in mind:

- **Staged versions share the same semver unique index as published ones** —
  once `0.1.0` is staged, that name+version can never be published again.
- **The `--tag` is immutable** for a staged package. A pre-release must carry
  its tag explicitly (`npm stage publish --tag next`), exactly as for
  `npm publish`.

**Path B — direct publish from a PC terminal (fallback, deprecated).** Run
`SDK_RELEASE_CONFIRM=publish npm publish --access public` yourself in
`packages/assistant-sdk` with the same granular token in the environment. The
workflow deliberately never takes this path. Note that **direct publishing with
a granular access token is being deprecated**: npm has announced it will be
removed in **January 2027**, so prefer Path A.

Both paths:

- pass `--access public` explicitly so the scoped package is public;
- **do not** add `--provenance`: a manual publish produces **no OIDC
  provenance**, and `--provenance` must not be claimed for it;
- must not reuse a name+version combination — npm never allows republishing an
  exact name+version. So if provenance on the very first version matters,
  bootstrap a **pre-release** instead: publish e.g. `0.1.0-rc.1` by hand under
  the `next` tag (`--tag next`), register the trusted publisher, then publish
  the real `0.1.0` through the OIDC workflow so the public `latest` release
  carries provenance.

#### After the package exists: register OIDC and use it for every release

1. **Register the trusted publisher** (§6.3) — the website form or
   `npm trust github ...`.
2. **Restrict token access** (recommended, §6.3): package **Settings** →
   **Publishing access** → *"Require two-factor authentication and disallow
   tokens"*, then revoke any automation tokens.
3. **Publish subsequent versions via the workflow** (§4 step 7) — the publish
   job authenticates with the short-lived OIDC token and produces provenance
   automatically.

#### If none of this is acceptable to the owner

If the owner would rather not create and revoke a granular token at all, stop
here and ask: the remaining alternative is an interactive browser login
(`npm login`), which persists a legacy publish token to `.npmrc` and needs
`npm logout` afterwards — and npm's own docs disagree about whether legacy
tokens still exist. **Owner approval is required before any such credential is
created.** This repository does not create, store or request it.

### 6.5 What is enforced automatically

`packages/assistant-sdk/scripts/validate-package.mjs` — and the standing
contracts in `scripts/check.mjs`, plus the mutation tests in
`tests/release-gates.test.mjs` and `tests/release-security-wording.test.mjs`
— fail if any of the following is weakened:

- `id-token: write` present on the publish job, the stage job and the
  `oidc-check` job (the stage and oidc-check jobs' permissions must be
  **exactly** `contents: read` + `id-token: write` — nothing more, nothing
  less); verify and publish-authorization hold no `id-token` at all;
- `registry-url: https://registry.npmjs.org` on the publish job;
- the publish job runs on a GitHub-hosted runner (`ubuntu-latest`);
- the publish job pins Node 24 (npm ≥ 11.5.1 / Node ≥ 22.14);
- **any** npm token reference appears anywhere in the workflow —
  `NODE_AUTH_TOKEN`, `secrets.NPM_TOKEN`, `secrets.NPM_STAGE_TOKEN` or any
  other `secrets.NPM_*` fails validation (verify, stage and publish all
  authenticate without a stored npm credential);
- the `stage` job loses any staging gate: the `Stage release on npm`
  selection, the `refs/heads/main` guard, `needs: verify`, the
  protected `sdk-npm-publish` environment, its exact OIDC permissions, the
  npm ≥ 11.15.0 guard, `npm stage publish` (never a direct `npm publish`),
  the absence of `npm stage approve`/`reject`, the validator immediately
  before staging, `SDK_RELEASE_CONFIRM: publish` on the staging step, or the
  staged-NOT-published summary with the `0.0.0-stage` placeholder;
- `repository.url` matches the canonical GitHub repository;
- the `verify` job contains no `npm publish` step (it stays non-publishing);
- `SDK_RELEASE_ENABLED` is never hardcoded in the workflow (it stays a
  repository variable);
- the workflow does **not** claim the in-repo gates make direct publishing
  impossible, and frames `SDK_RELEASE_CONFIRM` as an accidental-publish guard
  (an explicit standing contract in `scripts/check.mjs`);
- the manual-only trigger with its single `action` dropdown (the four
  labeled options; no typed confirmation inputs), `SDK_RELEASE_ENABLED`, the
  protected `sdk-npm-publish` environment, the main-only
  `publish-authorization` gate job (fails loudly when `SDK_RELEASE_ENABLED`
  is missing), the `refs/heads/main` guards on stage/publish/oidc-check and
  `SDK_RELEASE_CONFIRM: publish` are all intact;
- any token-shaped value (`npm_…`) or committed `.npmrc` appears anywhere in
  the repository, and no workflow references any secret at all except the
  built-in `GITHUB_TOKEN` (`tests/release-gates.test.mjs`).

### 6.6 Non-mutating verification of npm Trusted Publishing (OIDC)

**Question this section answers:** after every temporary npm token was
removed, is there a *safe* way to prove — through this repository's GitHub
Actions workflow — that npm Trusted Publishing accepts this
repository/workflow/environment identity **without** publishing, staging,
approving, rejecting or changing any dist-tag, and without creating or
requesting any npm token?

**Answer: yes — and it is implemented** (the `Verify OIDC trusted publishing` selection +
`scripts/oidc-trust-check.mjs`). The proof is npm's own documented
token-exchange operation — the exact first step every OIDC-authorized
publish performs; running it alone changes nothing on the registry.

#### Findings (investigated 2026-11-07)

1. **`npm whoami` cannot answer the question** — npm's Trusted Publishing
   docs state explicitly that `npm whoami` (or any npm CLI output) is **not**
   a check of Trusted Publishing permissions; only a real OIDC-authorized
   registry operation can prove the configuration.
2. **`npm view` / `npm install` prove nothing about OIDC** — they are
   anonymous registry reads; and receiving a GitHub OIDC JWT on a runner
   proves only GitHub's side (layer 2 below), never that npm accepts it.
3. **The documented, non-mutating proof exists:** npm's Registry API
   specification (api-docs.npmjs.com — the "Learn more" target of the
   Trusted Publishers docs) documents
   `POST /-/npm/v1/oidc/token/exchange/package/{package_name}` — *"Exchange a
   valid OIDC id_token … for a short-lived npm registry access token for the
   specified package"* — authorized **only** by the OIDC `id_token`
   (Bearer), audience `npm:registry.npmjs.org`; responses `201` (success),
   `400`, `401`, `404`, `500`. The npm CLI performs this identical call in
   `lib/utils/oidc.js` *before* `npm publish`, `npm stage publish` or
   dist-tag operations; exchange failures surface misleadingly as
   404/`ENEEDAUTH` (npm/cli#9088 — open issue documenting that wording).
4. **A `201` proves the Trusted Publisher match** — repository
   `sandro-defender/you-ge-assistant` + workflow `sdk-release-prep.yml` +
   environment `sdk-npm-publish` for `@youge/assistant-sdk`; any other status
   means no matching configuration or an invalid identity. The exchange only
   mints a short-lived, package-scoped credential **in memory** — nothing is
   published, staged or tagged, the credential is discarded with the
   process, and no token is written to the log, to disk or to GitHub Secrets.
5. **Rejected alternatives:** `npm publish --dry-run` cannot prove via exit
   code (a refused exchange only warns and still exits 0), it runs
   `prepublishOnly` (which requires `SDK_RELEASE_CONFIRM=publish` — the
   accidental-publish guard only the gated jobs may set), and success
   detection would depend on undocumented verbose-log wording — log-scraping
   an undocumented line is not a reliable test.

#### The four distinct layers — never conflate them

| # | Layer | How it is proven | Status in this repository |
| - | ----- | ---------------- | ------------------------- |
| 1 | **Ordinary npm authentication** (tokens, `npm login`) | Not applicable — no npm token exists or is used anywhere in the workflows (only the historical, revoked `NPM_STAGE_TOKEN` bootstrap, §6.4) | ✅ token-free by construction |
| 2 | **GitHub OIDC token availability** | `id-token: write` on the job → `ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN` present. Necessary but **never sufficient** — a minted JWT proves nothing about npm | ✅ available to the `stage`, `publish` and `oidc-check` jobs |
| 3 | **Successful npm Trusted Publisher authentication** | The documented exchange returning **201** for this package + identity — what the `Verify OIDC trusted publishing` selection measures (and what the 0.1.1 stage run at 07:04 UTC exercised live) | ✅ implemented (`scripts/oidc-trust-check.mjs`) |
| 4 | **Actual publishing permission** | Only an actual registry-accepted `npm stage publish` / `npm publish` proves it. Recorded: `npm stage publish` accepted 2026-11-07 07:04 UTC (run 42349730622, stage job SUCCESS), owner-approved 07:07 UTC; the `npm publish` action itself remains **unexercised** and stays owner-gated | ⚠️ stage action proven; publish action pending its future approved release |

#### Safe operating instructions (the implemented check)

1. GitHub → Actions → **sdk-release-prep** → **Run workflow**: select
   `Verify OIDC trusted publishing` (the only field — one `action` dropdown;
   dispatch from the `main` branch).
2. The `oidc-check` job runs alone (the `verify` checklist is skipped for
   this selection) and **only from the `main` branch** — its condition
   requires BOTH `action == 'Verify OIDC trusted publishing'` AND
   `github.ref == 'refs/heads/main'` (the
   same main-only gate as the `stage` job): the job holds `id-token: write`,
   so modified code dispatched from any other branch must never receive that
   permission. It runs inside the protected `sdk-npm-publish` environment (an
   environment approval may be requested if required reviewers are
   configured), on `ubuntu-latest`, Node 24, npm ≥ 11.5.1, with
   `permissions: contents: read` + `id-token: write` **only** — no
   `registry-url`, no `.npmrc`, no secret of any kind.
3. The job runs `node scripts/oidc-trust-check.mjs`, which performs exactly
   two HTTP calls: GET GitHub's id_token endpoint (audience
   `npm:registry.npmjs.org`), then POST the documented exchange above with
   that id_token as the Bearer credential. Output contains only the HTTP
   status, the expiry timestamp and npm's error message (redacted) — never
   any token.
4. **PASS (exit 0)** = exchange `201` → layers 2 + 3 verified for this exact
   package/workflow/environment. **FAIL (exit 1)** with stage
   `no-id-token-permission` (job lost `id-token: write`),
   `id-token-request-failed` (GitHub side), or `exchange-failed` (HTTP
   400/401/404/… → npm did not accept the identity — check the Trusted
   Publisher configuration; npm/cli#9088 explains why the raw 404 wording is
   misleading).
5. What the check **never** does: no `npm publish`, no `npm stage`, no
   approval/rejection, no `npm dist-tag`, no version bump, no npm token
   creation, no GitHub secret, no registry data change of any kind — by
   construction (GET + POST-to-exchange only) **and** by the contracts in
   `scripts/check.mjs` and `tests/release-gates.test.mjs` (the `oidc-check`
   job block must contain no npm command, no `secrets.` reference, no
   `SDK_RELEASE_ENABLED`/`SDK_RELEASE_CONFIRM`, no `registry-url`).

#### What only an explicitly approved registry operation can prove next

Layer 4's `npm publish` action (and the dist-tag permission, default-off in
the Trusted Publisher configuration) can only be exercised by a future,
explicitly approved release: select `Stage release on npm` for a version not yet
on the registry (registry effect: **one staged version record** — invisible
to installers, no dist-tag change; the owner later approves or rejects it),
then select `Publish release to npm` with `SDK_RELEASE_ENABLED=true` after approval
(registry effect: the staged version becomes public and `latest` moves to
it). This alternative is **not implemented or executed** here — it requires
explicit approval per [§4](#4-release-runbook-when-a-release-is-approved)
and the standing restrictions.

## 7. Verification results (2026-11-06)

### Release-preparation pass (PR #9/#10 era)

| Check | Command | Result |
| --- | --- | --- |
| Static checks + all tests | `npm run check` (root) | ✅ 261 static assertions + 132/132 tests pass |
| Standalone SDK tests | `npm test` (in `packages/assistant-sdk`) | ✅ 33/33 pass (4 suites) |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync |
| Package & version validation | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ all sections pass |
| Pack contents | `npm pack --dry-run` | ✅ 19 files, 32.4 kB packed / 129.7 kB unpacked |
| Consumer build | `npm ci && npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK |
| Release workflow | `.github/workflows/sdk-release-prep.yml` | ✅ created; publish job disabled (locks above) |
| Registry state (post-rename) | `registry.npmjs.org` lookups | `@youge/assistant-sdk` unpublished (404); `@youge/*` empty (no conflict); org/scope `youge` exists |
| Name consistency | repo-wide `@you-ge` grep | ✅ only intentional rename-history mentions remain (CHANGELOG rename entry, this file §2) |

### 0.1.0 release-PR pass

| Check | Result |
| --- | --- |
| Version `0.1.0` not yet on npm | ✅ `GET /@youge%2fassistant-sdk` → HTTP 404 (2026-11-06) |
| Identity consistency | ✅ `@youge/assistant-sdk@0.1.0` in metadata; `SDK_VERSION` `0.1.0`; `KIT_COMPAT_VERSION` `1.0.5` |
| Full test suite + contracts | ✅ see the release PR for the run log |
| Publishability + workflow-gate validation | ✅ `validate-package.mjs` "Publishability and release gates" section passes |
| GitHub environment inventory | ✅ `sdk-npm-publish` **owner-configured** with required reviewers (verified 2026-11-06); the reviewer protection itself is not readable by automation (HTTP 403) — owner confirms it before the first publish run |
| `SDK_RELEASE_ENABLED` visibility | ⚠️ not readable by automation (HTTP 403); treat as unconfigured, owner verifies |
| Consumer install smoke test (packed tarball, exact name/version) | ✅ see the release PR for the run log |

### OIDC trusted-publishing migration pass

| Check | Command | Result |
| --- | --- | --- |
| Workflow OIDC config | `grep -n "id-token: write\|registry-url\|node-version: 24"` | ✅ publish job has `id-token: write`, `registry-url: https://registry.npmjs.org`, `node-version: 24`, `package-manager-cache: false`, npm ≥ 11.5.1 guard |
| No long-lived token | `grep -n "NODE_AUTH_TOKEN\|secrets.NPM_TOKEN" .github/workflows/sdk-release-prep.yml` | ✅ no matches — publish step sets only `SDK_RELEASE_CONFIRM` |
| Validator OIDC gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ 12/12 release-workflow gates pass |
| Standing contracts | `npm run check` | ✅ 273 static assertions + **152/152** tests pass, 0 fail |
| `verify` job stays non-publishing | mutation tests (`release-gates.test.mjs`) | ✅ validator and `check.mjs` both fail when the verify job gains an `npm publish` step |
| Approval variable not hardcoded | mutation test (`release-gates.test.mjs`) | ✅ validator fails when `SDK_RELEASE_ENABLED` is set in the workflow |
| Registry identity unchanged | `npm view @youge/assistant-sdk version` | ✅ HTTP 404 — still unpublished; **not published by this task** |
| `Verify only` non-publishing | workflow review | ✅ verify job runs checks only; no publish path |
| Trusted publisher registration | owner action | ⚠️ **not done** — requires the package to exist first (§6.4); no secrets created or modified |
| `sdk-npm-publish` environment | owner-configured | ✅ exists with required reviewers; **not created or changed by this task** |

### npm-authentication / security-wording documentation pass (2026-11-07)

Corrections made after review, with the official npm docs (npm CLI 12 /
npmjs.com) as the source of truth:

| Finding | Correction |
| --- | --- |
| `npm login` was documented as a **tokenless** first-publish path | The `npm-login` reference states it *"automatically generates a legacy token of `publish` type"* and saves credentials to `.npmrc`. Removed every "no token"/"tokenless" claim; documented credential hygiene and `npm logout`. |
| Legacy vs granular tokens | The current *About access tokens* page says legacy tokens were **removed in November 2025** and only granular access tokens are supported — an internal conflict with the `npm-login` page. Documented the conflict and stopped relying on `npm login`. |
| No short-lived publish credential was offered | Granular access tokens (website-only creation, ≤ 50 packages/scopes, short expiry, optional CIDR) **can** publish. Documented the minimum-permission token and **immediate revocation**. |
| Direct token publishing treated as permanent | npm is **deprecating direct publishing with a granular access token — removed January 2027**. Documented **staged publishing** (`npm stage publish` + maintainer approval with 2FA) as the recommended path. |
| `prepublishOnly` described as making direct publishing impossible | Reworded in the workflow header, the publish-step comment and §4/§5 to an **accidental-publish guard only**, with the real boundaries listed. |
| Trusted-publisher limit stated as one config per package | The website's *Trusted publishers* page allows **up to 10 connections per package**; the CLI reference still says one. Documented both and prefers the website UI. |
| Trusted-publisher behaviour gaps | Added the 2-day first-publish validation window, immutable connections (delete + re-create), automatic provenance (no `--provenance` needed), dist-tag permission (npm ≥ 11.21.0 / 12.2.0), and stage-only as the maximum-security posture. |

| Check | Command | Result |
| --- | --- | --- |
| Static checks + all tests | `npm run check` (root) | ✅ **275** static `PASS`, **165/165** tests pass, 0 fail |
| Validator OIDC gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ 12/12 release-workflow gates pass |
| Security-wording contracts | `node --test tests/release-security-wording.test.mjs` | ✅ 13/13 pass |
| Standalone SDK tests | `npm test` (in `packages/assistant-sdk`) | ✅ 29/29 pass |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync |
| Pack contents | `npm pack --dry-run` | ✅ 19 files, 33.5 kB packed / 132.4 kB unpacked |
| Consumer build | `npm ci && npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK |
| Registry identity unchanged | `npm view @youge/assistant-sdk version` | ✅ HTTP 404 — still unpublished; **not published by this task** |

### Staged-bootstrap audit (2026-11-07)

The first-publish staged bootstrap was audited against the current official npm
documentation **and the npm CLI source**, not assumed:

| # | Question | Verified answer |
| --- | --- | --- |
| 1 | Can a granular stage-only token be restricted to the `@youge` scope before `@youge/assistant-sdk` exists? | **Yes.** Granular tokens can be limited to *"up to 50 specific packages or scopes"*, and the `@youge` scope is already registered. Use the **Packages and scopes** section — the *Organizations* section only grants org-management rights and *"does not give the token the right to publish packages managed by the organization."* |
| 2 | What is the safest available permission configuration? | **Read and write (stage only)**, scoped to `@youge` (narrow to `@youge/assistant-sdk` once it exists), **Bypass 2FA unchecked**. npm's token-behavior table states a GAT **without** bypass can stage, and npm's own best practice is to *"create a GAT without bypass and use `npm stage publish`"*. |
| 3 | Does `SDK_RELEASE_CONFIRM=publish npm stage publish --access public` run `prepublishOnly`? | **Yes.** `npm/cli` implements `npm stage publish` as `StagePublish extends Publish` (`lib/commands/stage/publish.js`), so it runs the whole `npm publish` lifecycle: `prepublishOnly`, `prepack` / `prepare` / `postpack`, `publish` / `postpublish`. The only difference is `stage: true` on the registry call, which bypasses the 2FA prompt. Note the npm docs' *Scripts* page still says `prepublishOnly` runs *"ONLY on `npm publish`"* and lists no `npm stage` entry — that page predates the subcommand; the CLI source is authoritative. |
| 4 | Exact `npm stage approve` syntax; is `--otp` supported? | `npm stage approve <stage-id>` takes **`--otp <code>`** and `--registry`. `--otp` is **optional** — if omitted and the registry challenges, npm **prompts interactively**. `npm stage reject <stage-id>` takes the same flags. `npm stage list` / `view` / `download` take only `--json` / `--registry` and need **no** 2FA. |
| 5 | Placeholder `0.0.0-stage` behaviour | Staging a package that does not exist publishes a public **`0.0.0-stage` placeholder**; the staged `0.1.0` and its contents stay hidden until a maintainer approves with 2FA (CLI or npmjs.com → Staged Packages → Approve), after which `0.1.0` is published to the package page. Staged versions share the **same semver unique index** as published ones, and the **`--tag` is immutable** once staged. |
| 6 | Credential exposure | The documented procedure supplies the token only to the stage job's staging step (as the `NODE_AUTH_TOKEN` env that setup-node's `registry-url` `.npmrc` reads) and states explicitly that it must never appear in repository files, a committed `.npmrc`, shell history, CI logs or artifacts, or any chat/agent transcript; its only permitted storage is the dedicated **`NPM_STAGE_TOKEN`** Actions secret, deleted immediately after staging. No token was created by this work. |

No token was created, no publish or staging was performed, and no workflow was
dispatched for this audit.

### GitHub Actions first-publication staging implementation pass (2026-11-06)

The first-publication staging flow was implemented as a separate `stage` job
in `sdk-release-prep.yml` and verified against the current official npm and
GitHub documentation (not assumed):

| Check | Command / source | Result |
| --- | --- | --- |
| npm CLI requirement for staging | docs.npmjs.com/staged-publishing | ✅ **npm ≥ 11.15.0** and **Node ≥ 22.14.0** — guarded by an explicit failing step in the stage job |
| Node 24 bundled npm (setup-node toolchain) | `nodejs/node` `deps/npm/package.json` on `v24.x` | ✅ npm **11.19.1** ≥ 11.15.0 (guard kept regardless) |
| Stage-only token semantics | docs.npmjs.com/about-access-tokens, docs.npmjs.com/creating-and-viewing-access-tokens | ✅ *Read and write (stage only)*, scoped, no bypass — direct publish rejected (`E_STAGE_REQUIRED`), maintainer 2FA approval required |
| GitHub Actions npm authentication | docs.github.com (Publishing Node.js packages / Building and testing Node.js) + `actions/setup-node` source (`src/authutil.ts`, v4 tag) | ✅ `registry-url` makes setup-node write `$RUNNER_TEMP/.npmrc` containing `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` and export `NPM_CONFIG_USERCONFIG`; the token is supplied as the step's `NODE_AUTH_TOKEN` env (npm expands the placeholder — verified locally) |
| `npm stage publish` output / lifecycle | `npm/cli` `lib/commands/stage/publish.js`, `lib/commands/publish.js` | ✅ prints `+ <name>@<version> (staged with id <uuid>)` (the run summary parses it) and runs the full publish lifecycle (`StagePublish extends Publish`) |
| Approval on the website | docs.npmjs.com/staged-publishing | ✅ npmjs.com → **Staged Packages** tab → **Approve**, always prompts for 2FA |
| Stage job gates | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ all **27** release-workflow gates pass (incl. stage-job gates: `Stage release on npm` selection (no typed confirmation), `refs/heads/main`, `needs: verify`, protected environment, least-privilege, env-only token, `npm stage publish` only, no approve/reject, npm ≥ 11.15.0, staged-NOT-published summary; plus the single-dropdown, publish main-gate and `publish-authorization` gates) |
| Standing contracts | `node scripts/check.mjs` | ✅ all pass |
| Release-gate mutation tests | `node --test tests/release-gates.test.mjs` | ✅ 39/39 pass |
| Security-wording tests | `node --test tests/release-security-wording.test.mjs` | ✅ 15/15 pass |
| Full root suite | `npm run check` | ✅ see the PR run log |
| Registry state | `npm view @youge/assistant-sdk version` | HTTP 404 — **not staged, not published** |
| Secrets / environments / variables / tags | — | **none created, modified or requested by this task** |
| Dispatches / staging / publishing | — | **none executed by this task** |

### OIDC trusted-publishing staging migration pass (2026-11-07)

| Check | Command | Result |
| --- | --- | --- |
| Stage job OIDC permissions | workflow review + `validate-package.mjs` + mutations | ✅ exactly `contents: read` + `id-token: write`; validation fails when `id-token: write` is removed or an extra permission is added |
| Token-free workflows | `grep -rn 'NODE_AUTH_TOKEN\|secrets\.NPM' .github/workflows/` | ✅ zero matches — no npm token reference anywhere in any workflow |
| `verify` and `publish` jobs untouched | `git diff` job-block comparison | ✅ both jobs byte-identical; every publish OIDC gate unweakened |
| `check.yml` / `pages.yml` | `git status` / `git diff` | ✅ unchanged |
| Static checks + all tests | `npm run check` (root) | ✅ All checks passed; **188/188** tests, 0 fail |
| Release-gate mutation tests | `node --test tests/release-gates.test.mjs` | ✅ **40/40** pass (incl. missing/stage-widened OIDC permissions, token reinsertion, secret-reference mutations, publish-safety preserved) |
| Security-wording tests | `node --test tests/release-security-wording.test.mjs` | ✅ **16/16** pass (bootstrap recorded as created/used/revoked; `id-token: write`, 48-hour, UNVERIFIED, `stage only` documentation contracts) |
| Package & version validation | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ all release-workflow gates pass |
| Standalone SDK tests | `npm test` (in `packages/assistant-sdk`) | ✅ 29/29 pass |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync |
| Pack contents | `npm pack --dry-run` | ✅ 19 files |
| Consumer build | `npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK |
| Workflow YAML parse | `npx js-yaml .github/workflows/sdk-release-prep.yml` | ✅ parses |
| Shell syntax of run blocks | `bash -n` on every `run:` block (5 block + 9 single-line) | ✅ all OK |
| Trusted publisher registration | owner action | ⚠️ **not done at that pass** — completed later on 2026-11-07; validation outcome recorded in §7 (non-mutating verification pass) and §8 item 6 (staged-counts-as-first-publish moot for this connection — the staged+approved publish landed inside the 48-hour window) |
| Secrets / environments / variables / tags / dispatches / publishes | — | **none created, modified or executed by this task** |
| Registry state | `npm view @youge/assistant-sdk` (2026-11-07) | ✅ `0.1.0` published via the staged-approval path with the `0.0.0-stage` placeholder; unchanged by this task |

### 0.1.1 feature-release preparation pass (2026-11-07)

| Check | Command | Result |
| --- | --- | --- |
| Static contracts + full test suite | `npm run check` (root) | ✅ All checks passed; **215/215** tests, 0 fail (was 188 at 0.1.0) |
| New browser-feature tests | `node --test packages/assistant-sdk/tests/sdk-browser.test.mjs` | ✅ 15/15 — UA table (Android Chrome / Facebook / Messenger / Instagram / WebView / iOS / unknown), intent URL query+hash preservation, failed handoff, delayed fallback, destroy |
| Widget feature tests | `node --test tests/assistant-widget.test.mjs` | ✅ 46/46 — responsive tiers, manual size/position clamp+persist, reload, reset, touch/mouse/keyboard path, offer + manual fallback + dismissal |
| React example demonstration | `node --test tests/example-ui.test.mjs` | ✅ 9/9 incl. no-forced-redirect regression |
| Package & version validation | `node packages/assistant-sdk/scripts/validate-package.mjs` | ✅ `@youge/assistant-sdk@0.1.1` ready; exports↔types↔files↔pack gates pass |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync (`browser/index.js` added to `SOURCE_MODULES`) |
| Pack contents | `npm pack --dry-run` | ✅ 21 files (38.0 kB tarball / 147.4 kB unpacked) |
| Consumer build | `npm run typecheck && npm run build` (in `example/`) | ✅ `tsc --noEmit` clean, `vite build` OK; lockfile refreshed to `0.1.1` |
| Workflows / tokens / OIDC gates | `git diff --stat .github/` + token grep | ✅ **untouched** — no workflow, secret, environment, permission or gate change; no token reference added |
| Stage / approve / publish / dispatch / release | — | **none executed** — `0.1.1` is prepared only; the owner runs `verify` → `stage` → approve → publish manually after merge |

### 0.2.0 adaptive-theming preparation pass (2026-11-07)

| Check | Command | Result |
| --- | --- | --- |
| Version synchronization | `package.json`, `SDK_VERSION`, `KIT_COMPAT_VERSION` | ✅ `@youge/assistant-sdk@0.2.0`, `SDK_VERSION = 0.2.0`, `KIT_COMPAT_VERSION = 1.1.0` (kit `1.1.0`); `validate-package.mjs` passes |
| Static contracts + full suite | `npm run check` (root) | ✅ All checks passed; **307/307** tests, 0 fail (was 215 at 0.1.1) |
| New theming suites | `node --test packages/assistant-sdk/tests/sdk-theme.test.mjs tests/widget-theming.test.mjs tests/example-theme.test.mjs` | ✅ 35 + 27 + 11 |
| Browser-bundle sync | `node scripts/sync-sdk-browser.mjs --check` | ✅ in sync (`theme/index.js` + level helpers) |
| Pack contents | `npm pack --dry-run` | ✅ 23 files (54.9 kB tarball / 203.3 kB unpacked) — includes `src/theme/` |
| Consumer build | `npm run typecheck && npm run build` (in `example/`) | ✅ clean; lockfile refreshed to `0.2.0` |
| Workflows / tokens / OIDC gates | `git diff .github/` + token grep | ✅ only a comment refreshed; no gate, permission, secret or environment change; still no npm token anywhere |
| Stage / approve / publish / dispatch / release | — | **none executed** — `0.2.0` is prepared in-repo only; the owner runs `verify` → `stage` → approve manually after merge |

### Non-mutating Trusted Publishing verification pass (2026-11-07)

| Check | Result |
| --- | --- |
| Failed run root cause (42350738180, 07:18 UTC) | ✅ **expected gate behavior, not an OIDC failure**: `verify`'s "Version has not been published yet" step saw `0.1.1` on the registry (published 07:07 UTC). The stage run 42349730622 (07:04 UTC) had already completed `npm stage publish` with the stage job SUCCESS — live proof of the stage action's Trusted Publishing authentication (§6.6) |
| Non-mutating test feasibility | ✅ **supported** — npm's documented `exchangeOidcToken` operation (api-docs.npmjs.com) called with the GitHub id_token; `npm whoami` ruled out by npm's own docs; dry-run exit code and log-scraping ruled out (§6.6 findings 1–5) |
| Implementation | ✅ `scripts/oidc-trust-check.mjs` + the `oidc-check` job (selection `Verify OIDC trusted publishing`) (protected environment, `id-token: write`, Node 24, npm ≥ 11.5.1 guard, no `registry-url`, no secrets); the job block contains no npm command of any kind |
| Static contracts | ✅ `scripts/check.mjs` — 5 new oidc-check/script contracts pass (manual action, protected environment + OIDC + Node 24, no credential/release-variable in the job, script targets the documented exchange and fails unless 201, GET+POST only); `validate-package.mjs` unchanged and green |
| New tests | ✅ `tests/oidc-trust-check.test.mjs` **12/12** (201 success, 401/404/201-without-token failures, fail-closed without `id-token: write`, audience `npm:registry.npmjs.org`, exact exchange URL, no credential in any output, exit codes 0/1) · `tests/release-gates.test.mjs` **43/43** incl. 3 new oidc-check job/script contract tests · wording contracts untouched and green |
| Workflow YAML | ✅ parses (`js-yaml`); workflow wording bans clean (no completion-of-publishing claims, no token references, no approve/reject command) |
| Full suite | ✅ `npm run check` (root) — all static assertions + **230/230** tests pass; SDK `validate-package.mjs` ✅ PASS |
| Registry effect of this pass | ✅ **none** — no registry command was executed; versions remain `0.0.0-stage`, `0.1.0`, `0.1.1`; dist-tags remain `{latest: 0.1.1}` |

### One-dropdown release interface pass (2026-11-07)

| Check | Result |
| --- | --- |
| Interface | ✅ single `action` choice input with exactly four labeled options — `Verify only`, `Stage release on npm`, `Publish release to npm`, `Verify OIDC trusted publishing`; `confirm_stage`, `confirm_publish` and every other manual input removed — the user picks one option and clicks Run workflow |
| Version handling | ✅ version always read from `packages/assistant-sdk/package.json` (no version input, no automatic bump); the verify job's uniqueness gate still stops with "already exists on the registry — bump the version" when needed |
| Authorization model preserved | ✅ OIDC / npm Trusted Publishing, protected `sdk-npm-publish` environment (required reviewers), `SDK_RELEASE_CONFIRM: publish` supplied by the workflow itself, npm provenance, no npm tokens or secrets anywhere, main-branch-only release execution |
| `SDK_RELEASE_ENABLED` loud failure | ✅ new main-only `publish-authorization` job (contents: read only — no environment, no `id-token`, no npm command) fails the run with an explicit explanation when the variable is not `'true'`, before the publish job can request the protected environment; it never sets or enables the variable |
| New protection | ✅ `publish` now also requires `github.ref == 'refs/heads/main'` (previously stage-only); `needs: [verify, publish-authorization]` |
| Summaries | ✅ every selection writes `GITHUB_STEP_SUMMARY`: selected operation, package, version, verification result, staging/publish result, next action and the direct npm package link; staging says **Waiting for approval**, never publication |
| Tests | ✅ `npm run check` — all static assertions + **314/314** tests (release-gates **53/53**, incl. single-input contract, four selection truth tables, needs chains, stage/publish path separation, OIDC-permission scope, loud-authorization-gate and summary contracts); `validate-package.mjs` **27/27** gates PASS; security-wording contracts green; workflow YAML parses (`js-yaml`) |
| Registry effect | ✅ **none** — no publish, no stage, no dist-tag, no npm account, GitHub environment, reviewer or variable change; SDK version untouched (`0.2.0`) |

## 8. Required follow-ups (before the first publish)

Owner actions remaining (nothing in this repository can complete them):

1. **npmjs.com:** confirm the publishing npm user (`you-ge`) has publish
   rights on the org `youge` (registry APIs do not expose org membership).
2. **Verify the `sdk-npm-publish` environment** the owner created actually
   enforces its required-reviewer protection (the environment exists; this
   automation cannot read its protection rules — HTTP 403 — so the owner
   confirms it before the first staging/publish run). Do **not** recreate it.
3. ~~Stage the first publication~~ — **DONE (2026-11-06).** `0.1.0` was
   staged by the manual GitHub Actions `stage` job using the temporary
   `NPM_STAGE_TOKEN` bootstrap (granular, stage only, `@youge` scope) —
   see [§4](#4-release-runbook-when-a-release-is-approved) step 3 and
   [§6.4](#64-the-first-publish-of-a-new-package-cannot-use-oidc-important).
   The credential was **created, used and revoked**; nothing further to do —
   the workflow's `stage` job now stages token-free via OIDC.
4. ~~Approve the staged `0.1.0`~~ — **DONE (2026-11-06).** The owner
   approved the staged `0.1.0` on npmjs.com with account 2FA (Staged
   Packages tab → Approve); it became the public first release
   ([§4](#4-release-runbook-when-a-release-is-approved) step 4).
5. ~~Revoke the bootstrap~~ — **DONE.** The granular token and the
   `NPM_STAGE_TOKEN` repository secret were deleted
   ([§4](#4-release-runbook-when-a-release-is-approved) step 5); no npm
   token reference remains anywhere in this repository's workflows.
6. ~~Register the npm Trusted Publisher~~ — **DONE (2026-11-07).** The
   owner added the connection exactly as specified in
   [§6.3](#63-registering-the-trusted-publisher-owner-action): owner
   `sandro-defender`, repo `you-ge-assistant`, workflow filename
   `sdk-release-prep.yml`, environment `sdk-npm-publish`, allowed actions
   **`npm stage publish` AND `npm publish`** (one connection serves both
   jobs). **Validation outcome (recorded 2026-11-07):** the `stage` job's
   OIDC token exchange was accepted at 07:04 UTC (run 42349730622) and the
   owner's 2FA approval published `0.1.1` at 07:07 UTC — the **48-hour**
   first-publish window was met, and the staged-counts question is moot for
   this connection (the staged+approved publish landed inside the window
   regardless). The ongoing non-mutating re-check is the
   `Verify OIDC trusted publishing` selection (job `oidc-check`)
   ([§6.6](#66-non-mutating-verification-of-npm-trusted-publishing-oidc)).
   Then keep `SDK_RELEASE_ENABLED` **unset** until
   a later release is explicitly approved, and once the owner is satisfied
   **restrict token access** (Settings → Publishing access → "Require
   two-factor authentication and disallow tokens") — no npm token exists in
   this repository anymore.
7. **Later releases** — run `sdk-release-prep` with `Publish release to npm`
   selected from the single dropdown ([§4](#4-release-runbook-when-a-release-is-approved)
   step 7), then the post-publish smoke tests (step 8) and optional tag
   (step 9). (`0.1.0` and `0.1.1` both completed at §4 step 4 — owner
   approval of a staged version, not this job; `0.1.1` additionally proved
   the OIDC stage path end-to-end.)
8. Migrate staff.you.ge off the vendored copy per
   [`MIGRATION.md`](MIGRATION.md) after the first published version.

---

*Release-preparation documentation reviewed with the `ui-ux-pro-max-skill`
guidance. The skill's "When to Apply" section says to skip it for
infrastructure/DevOps work that does not change how something looks, feels,
moves or is interacted with — this first-publication staging work is
infrastructure/DevOps only, so its design-system search workflow was not run
(no UI surface changed and none may change). Its documentation guidance
(status first, scannable tables, atomic runbook steps with explicit
guard/failure states) was used to structure the staging procedure above.
Skill record: [`../../DESIGN_FOUNDATION.md`](../../DESIGN_FOUNDATION.md) §10,
§13 and §14.*
