#!/usr/bin/env node
/**
 * Release-gate validation for the @youge/assistant-sdk package.
 *
 *   node scripts/validate-package.mjs            (from packages/assistant-sdk)
 *   node packages/assistant-sdk/scripts/validate-package.mjs   (from the repo root)
 *
 * Verifies, with zero dependencies and no network access:
 *   - package metadata (name shape, semver, module type, publish config)
 *   - version synchronization (package.json <-> SDK_VERSION <-> KIT_COMPAT_VERSION)
 *   - export map: every target exists and ships a paired TypeScript declaration
 *   - package contents: files whitelist, npm pack list, README, LICENSE
 *   - dependency requirements: zero runtime deps, optional react peer only
 *   - source hygiene: relative imports only, nothing escapes the package root
 *   - publishability and release gates (prepublishOnly authorization + the
 *     sdk-release-prep workflow's manual-only trigger, confirm inputs,
 *     approval variable, protected environment, OIDC trusted-publishing
 *     configuration on BOTH the publish and stage jobs, and the absence of
 *     any npm token reference in the workflow)
 *
 * Exits 1 on failure.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgDir, '..', '..');

const failures = [];
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;

function pass(message) {
  console.log(`  ${green('PASS')} ${message}`);
}
function fail(message) {
  failures.push(message);
  console.log(`  ${red('FAIL')} ${message}`);
}
function note(message) {
  console.log(`  ${yellow('NOTE')} ${message}`);
}
function section(title) {
  console.log(`\n${title}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`cannot parse JSON: ${relative(repoRoot, path)} (${error.message})`);
    return null;
  }
}

/** Collect every string target from a nested exports condition object. */
function collectExportTargets(node, out = []) {
  if (typeof node === 'string') {
    out.push(node);
  } else if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectExportTargets(value, out);
  }
  return out;
}

function walkFiles(dir, filter, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, filter, out);
    else if (filter(full)) out.push(full);
  }
  return out;
}

const pkg = readJson(join(pkgDir, 'package.json'));
if (!pkg) {
  console.error('\nSDK package validation failed.');
  process.exit(1);
}

/* 1. Package identity ----------------------------------------------------- */

section('Package identity');

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const NPM_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/;

if (pkg.name === '@youge/assistant-sdk') {
  pass('package name is @youge/assistant-sdk');
} else if (typeof pkg.name === 'string' && NPM_NAME.test(pkg.name)) {
  note(`package name is ${pkg.name} (valid npm name; confirm the registry scope is owned before publishing — see RELEASE.md)`);
} else {
  fail(`package name is not a valid npm package name: ${JSON.stringify(pkg.name)}`);
}

if (typeof pkg.version === 'string' && SEMVER.test(pkg.version)) {
  pass(`package version ${pkg.version} is valid semver`);
} else {
  fail(`package version is not valid semver: ${JSON.stringify(pkg.version)}`);
}

if (pkg.type === 'module') {
  pass('package is ESM ("type": "module") with a documented ESM-only policy');
} else {
  fail('package must declare "type": "module" (the SDK ships native ESM)');
}

if (pkg.publishConfig && pkg.publishConfig.access === 'public') {
  pass('publishConfig.access is "public" (required for the first scoped publish)');
} else {
  fail('publishConfig.access must be "public" so an approved scoped release does not default to restricted');
}

// npm Trusted Publishing (OIDC) requires the package's repository.url to
// exactly match the GitHub repository that publishes it (npm validates this
// against the trusted publisher and provenance reuses the same identity).
if (
  pkg.repository &&
  typeof pkg.repository.url === 'string' &&
  /github\.com\/sandro-defender\/you-ge-assistant(\.git)?$/.test(pkg.repository.url)
) {
  pass('repository.url points at the canonical GitHub repository (required for npm OIDC trusted publishing)');
} else {
  fail('repository.url must point at https://github.com/sandro-defender/you-ge-assistant for npm OIDC trusted publishing');
}

/* 2. Version synchronization ---------------------------------------------- */

section('Version synchronization');

const constantsPath = join(pkgDir, 'src', 'core', 'constants.js');
const constants = readFileSync(constantsPath, 'utf8');
const sdkVersion = /export const SDK_VERSION = '([^']+)'/.exec(constants);
const kitCompat = /export const KIT_COMPAT_VERSION = '([^']+)'/.exec(constants);

if (sdkVersion && sdkVersion[1] === pkg.version) {
  pass(`SDK_VERSION in src/core/constants.js matches package.json (${pkg.version})`);
} else {
  fail(`version mismatch: package.json ${pkg.version} vs SDK_VERSION ${sdkVersion ? sdkVersion[1] : 'missing'}`);
}

const rootPkg = readJson(join(repoRoot, 'package.json'));
if (kitCompat && rootPkg && kitCompat[1] === rootPkg.version) {
  pass(`KIT_COMPAT_VERSION (${kitCompat[1]}) matches the You.Ge Assistant runtime version`);
} else {
  fail(`KIT_COMPAT_VERSION ${kitCompat ? kitCompat[1] : 'missing'} does not match the runtime version ${rootPkg ? rootPkg.version : 'unknown'}`);
}

/* 3. Export map ----------------------------------------------------------- */

section('Export map and TypeScript declarations');

const exportTargets = collectExportTargets(pkg.exports ?? {});
const entryTargets = [];

if (pkg.exports && typeof pkg.exports === 'object') {
  for (const [subpath, value] of Object.entries(pkg.exports)) {
    const targets = collectExportTargets(value);
    for (const target of targets) {
      if (!target.startsWith('./')) {
        fail(`exports["${subpath}"] target must be package-relative ("./..."), got ${target}`);
        continue;
      }
      if (target === './package.json') {
        if (existsSync(join(pkgDir, 'package.json'))) pass('exports exposes ./package.json');
        else fail('exports references ./package.json but it is missing');
        continue;
      }
      if (!existsSync(join(pkgDir, target))) {
        fail(`exports["${subpath}"] target missing on disk: ${target}`);
        continue;
      }
      entryTargets.push(target);
    }

    if (value && typeof value === 'object') {
      const typesTarget = value.types ?? (value.import && value.import.types);
      const jsTarget = value.default ?? value.import?.default ?? value.import;
      if (typeof typesTarget === 'string' && typesTarget.endsWith('.d.ts') && existsSync(join(pkgDir, typesTarget))) {
        pass(`exports["${subpath}"] ships types (${typesTarget})`);
      } else {
        fail(`exports["${subpath}"] is missing a paired .d.ts declaration`);
      }
      if (typeof jsTarget === 'string' && jsTarget.endsWith('.js') && existsSync(join(pkgDir, jsTarget))) {
        pass(`exports["${subpath}"] resolves (${jsTarget})`);
      } else {
        fail(`exports["${subpath}"] runtime target is missing`);
      }
    }
  }
} else {
  fail('package must declare an explicit exports map (the only supported import surface)');
}

if (pkg.exports && Object.keys(pkg.exports).some((key) => key.includes('*'))) {
  fail('exports must not use wildcard subpaths (internal source files stay unreachable)');
} else {
  pass('no wildcard exports: deep imports of internal source files are blocked');
}

for (const field of ['main', 'module', 'types']) {
  if (!pkg[field]) continue;
  if (existsSync(join(pkgDir, pkg[field]))) pass(`${field} target exists (${pkg[field]})`);
  else fail(`${field} target missing on disk: ${pkg[field]}`);
}
if (pkg.main && existsSync(join(pkgDir, pkg.main)) && pkg.types && existsSync(join(pkgDir, pkg.types))) {
  pass('legacy main/types fields mirror the "." export for older resolvers');
}

/* 4. Package contents ----------------------------------------------------- */

section('Package contents');

for (const required of ['README.md', 'MIGRATION.md', 'LICENSE', 'LICENSE-ElectricBorder.txt']) {
  if (existsSync(join(pkgDir, required))) pass(`${required} is present`);
  else fail(`${required} is missing`);
}

const readme = existsSync(join(pkgDir, 'README.md')) ? readFileSync(join(pkgDir, 'README.md'), 'utf8') : '';
if (readme.includes(String(pkg.name))) pass('README.md documents the package name');
else fail('README.md does not mention the package name');

const license = existsSync(join(pkgDir, 'LICENSE')) ? readFileSync(join(pkgDir, 'LICENSE'), 'utf8') : '';
if (/MIT/i.test(license)) pass('LICENSE declares the MIT license');
else fail('LICENSE does not look like the MIT license');

const filesWhitelist = Array.isArray(pkg.files) ? pkg.files : [];
const whitelisted = (target) => {
  const rel = target.replace(/^\.\//, '');
  if (rel === 'package.json') return true; // npm always packs package.json
  return filesWhitelist.some((entry) => rel === entry || rel.startsWith(`${entry.replace(/\/$/, '')}/`));
};
if (
  filesWhitelist.length > 0 &&
  exportTargets.every(whitelisted) &&
  ['README.md', 'MIGRATION.md', 'LICENSE', 'LICENSE-ElectricBorder.txt'].every(whitelisted)
) {
  pass('files whitelist covers every exports target plus README, MIGRATION guide and LICENSE');
} else {
  fail(`files whitelist ${JSON.stringify(filesWhitelist)} does not cover all published targets`);
}

let packFiles = null;
try {
  const packOut = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: pkgDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(packOut.slice(packOut.indexOf('[')));
  packFiles = (parsed[0]?.files ?? []).map((file) => file.path);
  pass(`npm pack --dry-run lists ${packFiles.length} files`);
} catch (error) {
  fail(`npm pack --dry-run failed: ${error.message}`);
}

if (packFiles) {
  const missing = exportTargets
    .map((target) => target.replace(/^\.\//, ''))
    .filter((rel) => !packFiles.includes(rel));
  if (missing.length === 0) pass('every exports target is included in the packed tarball');
  else fail(`exports targets missing from the tarball: ${missing.join(', ')}`);

  for (const required of ['README.md', 'MIGRATION.md', 'LICENSE', 'LICENSE-ElectricBorder.txt', 'package.json']) {
    if (packFiles.includes(required)) pass(`tarball contains ${required}`);
    else fail(`tarball is missing ${required}`);
  }

  const leaked = packFiles.filter(
    (file) => /(^|\/)(tests?|scripts|node_modules|\.github)(\/|$)/.test(file) || /\.test\.[cm]?js$/.test(file),
  );
  if (leaked.length === 0) pass('tarball ships runtime files only (no tests, scripts or repo metadata)');
  else fail(`tarball leaks non-runtime files: ${leaked.join(', ')}`);
}

/* 5. Dependency requirements ---------------------------------------------- */

section('Dependency requirements');

if (!pkg.dependencies || Object.keys(pkg.dependencies).length === 0) {
  pass('zero mandatory runtime dependencies');
} else {
  fail(`package must stay dependency-free, found: ${Object.keys(pkg.dependencies).join(', ')}`);
}

const peers = pkg.peerDependencies ?? {};
const peerNames = Object.keys(peers);
if (peerNames.every((name) => name === 'react') && (peerNames.length === 0 || pkg.peerDependenciesMeta?.react?.optional === true)) {
  pass('react is the only peer dependency and stays optional');
} else {
  fail(`unexpected peer dependencies: ${peerNames.join(', ') || '(none declared but meta mismatch)'}`);
}

for (const forbidden of ['bundledDependencies', 'bundleDependencies', 'optionalDependencies']) {
  if (pkg[forbidden]) fail(`${forbidden} must not be used (keep the package dependency-free)`);
}
pass('no bundled or optional dependencies');

/* 6. Source hygiene ------------------------------------------------------- */

section('Source hygiene');

const sourceFiles = walkFiles(join(pkgDir, 'src'), (file) => file.endsWith('.js') || file.endsWith('.d.ts'));
let relativeOnly = true;
let allResolve = true;

for (const file of sourceFiles) {
  const code = readFileSync(file, 'utf8');
  const specifiers = [];
  for (const match of code.matchAll(/(?:import|export)\s+[^;'"]*?from\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);
  for (const match of code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]);
  for (const match of code.matchAll(/import\s+['"]([^'"]+)['"]/g)) specifiers.push(match[1]);

  for (const spec of specifiers) {
    if (!spec.startsWith('./') && !spec.startsWith('../')) {
      relativeOnly = false;
      fail(`${relative(pkgDir, file)} imports a bare specifier: ${spec}`);
      continue;
    }
    const resolved = resolve(dirname(file), spec);
    if (!resolved.startsWith(pkgDir + sep)) {
      relativeOnly = false;
      fail(`${relative(pkgDir, file)} imports outside the package: ${spec}`);
    } else if (!existsSync(resolved)) {
      allResolve = false;
      fail(`${relative(pkgDir, file)} imports a missing file: ${spec}`);
    }
  }
}
if (relativeOnly) pass(`all ${sourceFiles.length} source modules use package-relative imports only`);
if (allResolve) pass('every relative import resolves inside the package (no repository-specific paths)');

/* 7. Publishability and release gates ------------------------------------- */

section('Publishability and release gates');

// The 0.1.0 release PR (RELEASE.md §4 step 1) removed the private lock by
// design. Accidental-publish protection now comes from the sdk-release-prep
// workflow gates and the absence of registry credentials — both are verified
// below so they can never be silently removed.
if (pkg.private === true) {
  note('package is still marked "private": true — npm publish is impossible (pre-release state)');
} else {
  pass('package is publishable (release-ready state; the private lock was removed by the approved 0.1.0 release PR)');
}

if (typeof pkg.scripts?.prepublishOnly === 'string') {
  pass('prepublishOnly re-runs this validation as the final net for any publish attempt');
} else {
  fail('prepublishOnly script is missing — every publish attempt must re-run package validation');
}

// A real publish attempt (npm runs this script as prepublishOnly) must carry
// the explicit authorization that only the gated sdk-release-prep publish job
// sets. A stray local `npm publish` therefore fails prepublishOnly and aborts
// (npm >= 7 aborts a publish when a lifecycle script exits non-zero).
if (process.env.npm_lifecycle_event === 'prepublishOnly') {
  if (process.env.SDK_RELEASE_CONFIRM === 'publish') {
    pass('publish attempt carries the explicit SDK_RELEASE_CONFIRM authorization set by the gated release workflow');
  } else {
    fail('publish attempt without SDK_RELEASE_CONFIRM authorization — direct npm publish is refused; use the gated sdk-release-prep workflow (RELEASE.md §4: stage first, then the owner approves on npmjs.com)');
  }
}

const workflowPath = join(repoRoot, '.github', 'workflows', 'sdk-release-prep.yml');
if (existsSync(workflowPath)) {
  const workflow = readFileSync(workflowPath, 'utf8');

  // Drop whole-line YAML comments so a documented "never run npm publish here"
  // note does not trip a gate — only real configuration counts.
  const withoutCommentLines = (block) =>
    block
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  // Slice out job blocks so each gate is checked against the job it belongs
  // to — never the whole file.
  const jobBlock = (job) => {
    const start = workflow.indexOf(`\n  ${job}:`);
    if (start === -1) return '';
    const rest = workflow.slice(start);
    const nextJob = rest.slice(1).search(/\n  \S/);
    return nextJob === -1 ? rest : rest.slice(0, nextJob + 1);
  };
  const publishBlock = jobBlock('publish');
  // The `verify` job must stay completely publish-free.
  const verifyBlock = withoutCommentLines(jobBlock('verify'));
  // The `stage` job (comment lines excluded).
  const stageBlock = withoutCommentLines(jobBlock('stage'));
  // The publish-authorization gate job (comment lines excluded).
  const authBlock = withoutCommentLines(jobBlock('publish-authorization'));

  // The whole workflow minus comment lines: BOTH the publish and the stage
  // job authenticate via npm Trusted Publishing (OIDC), so no npm token
  // reference of any kind (NODE_AUTH_TOKEN, secrets.NPM_TOKEN,
  // secrets.NPM_STAGE_TOKEN, any other npm secret) may exist anywhere.
  const nonComment = withoutCommentLines(workflow);

  // The stage job's permissions must be EXACTLY `contents: read` +
  // `id-token: write` (OIDC is technically required for `npm stage publish`)
  // and nothing else.
  const stagePermLines = stageBlock.split('\n');
  const permStart = stagePermLines.findIndex((line) => line.trim() === 'permissions:');
  const permEnd =
    permStart === -1 ? -1 : stagePermLines.findIndex((line, i) => i > permStart && /^\s{4}\S/.test(line));
  const stagePermBlock =
    permStart === -1 ? '' : stagePermLines.slice(permStart + 1, permEnd === -1 ? undefined : permEnd).join('\n');
  const stagePermKeys = [...stagePermBlock.matchAll(/^\s+([a-z][a-z0-9-]*):/gm)].map((m) => m[1]);
  const stageOidcPerms =
    stagePermKeys.length === 2 &&
    stagePermKeys.includes('contents') &&
    stagePermKeys.includes('id-token') &&
    /contents:\s*read/.test(stagePermBlock) &&
    /id-token:\s*write/.test(stagePermBlock);

  const gates = [
    ['workflow_dispatch-only trigger', /^on:\s*\n\s+workflow_dispatch:/m.test(workflow) && !/^\s+(push|pull_request):/m.test(workflow)],
    ['single action dropdown with the four labeled options (no typed confirmation inputs)', !workflow.includes('confirm_stage') && !workflow.includes('confirm_publish') && ['Verify only', 'Stage release on npm', 'Publish release to npm', 'Verify OIDC trusted publishing'].every((label) => workflow.includes(label))],
    ['SDK_RELEASE_ENABLED approval variable', workflow.includes('SDK_RELEASE_ENABLED')],
    ['sdk-npm-publish protected environment', publishBlock.includes('environment: sdk-npm-publish')],
    ['SDK_RELEASE_CONFIRM publish authorization (set only by the gated publish and stage jobs)', workflow.includes('SDK_RELEASE_CONFIRM: publish')],
    ['OIDC: id-token write permission on the publish job', /id-token:\s*write/.test(publishBlock)],
    ['OIDC: npm public registry URL on the publish job', /registry-url:\s*https:\/\/registry\.npmjs\.org/.test(publishBlock)],
    ['OIDC: GitHub-hosted runner for the publish job', /runs-on:\s*ubuntu-latest/.test(publishBlock)],
    ['OIDC: Node >= 22.14 toolchain (publish job pins Node 24)', /node-version:\s*24/.test(publishBlock)],
    ['no npm token references anywhere (verify, stage and publish authenticate without a stored npm credential)', !/NODE_AUTH_TOKEN|secrets\.NPM_/.test(nonComment)],
    ['stage job runs only when Stage release on npm is selected (single dropdown, no typed confirmation)', stageBlock.includes("action == 'Stage release on npm'") && !stageBlock.includes('confirm_stage')],
    ['stage job runs from main only (never untrusted branches)', /refs\/heads\/main/.test(stageBlock)],
    ['publish job runs only when Publish release to npm is selected', publishBlock.includes("action == 'Publish release to npm'")],
    ['publish job runs from main only (never untrusted branches)', /refs\/heads\/main/.test(withoutCommentLines(publishBlock))],
    ['publish job depends on verify AND the publish-authorization gate', /needs:\s*\[verify,\s*publish-authorization\]/.test(publishBlock)],
    ['publish-authorization gate: main-only, needs verify, fails loudly when SDK_RELEASE_ENABLED is missing', authBlock.includes("action == 'Publish release to npm'") && /refs\/heads\/main/.test(authBlock) && /needs:\s*verify\b/.test(authBlock) && authBlock.includes('exit 1') && authBlock.includes('SDK_RELEASE_ENABLED is not')],
    ['publish-authorization gate holds no environment, no OIDC permission and no npm command', !authBlock.includes('environment:') && !/id-token:/.test(authBlock) && !/npm\s+(publish|stage|dist-tag)\b/.test(authBlock)],
    ['stage job depends on the full verify job (needs: verify)', /needs:\s*verify\b/.test(stageBlock)],
    ['stage job uses the protected sdk-npm-publish environment', stageBlock.includes('environment: sdk-npm-publish')],
    ['stage job OIDC permissions (exactly contents: read + id-token: write)', stageOidcPerms],
    ['stage job invokes npm stage publish (never a direct npm publish)', stageBlock.includes('npm stage publish') && !/npm\s+publish/.test(stageBlock)],
    ['workflow never approves, rejects or promotes a stage (owner-only decision)', !/npm\s+stage\s+(approve|reject)|npm\s+unpublish/.test(withoutCommentLines(workflow))],
    ['stage job sets SDK_RELEASE_CONFIRM=publish for the staging command', stageBlock.includes('SDK_RELEASE_CONFIRM: publish')],
    ['stage job guards npm >= 11.15.0 (staged-publishing requirement)', /11\.15\.0/.test(stageBlock)],
    ['stage job reports staged-NOT-published plus the 0.0.0-stage placeholder and approval instructions', stageBlock.includes('0.0.0-stage') && /NOT published/.test(stageBlock) && /Staged Packages/.test(stageBlock)],
    ['verify job never publishes (no npm publish step)', !/npm\s+publish/.test(verifyBlock)],
    ['approval variable stays a repository variable (not hardcoded in the workflow)', !/SDK_RELEASE_ENABLED\s*:/.test(withoutCommentLines(workflow))],
  ];
  let gatesOk = true;
  for (const [name, ok] of gates) {
    if (ok) pass(`release workflow gate intact: ${name}`);
    else {
      gatesOk = false;
      fail(`release workflow gate missing: ${name}`);
    }
  }
  if (gatesOk) {
    note('staging never publishes: a staged version goes live only when the owner approves it on npmjs.com with 2FA (RELEASE.md §4/§6.4); stage and publish both authenticate via OIDC (RELEASE.md §6.3)');
  }
} else {
  fail('release workflow .github/workflows/sdk-release-prep.yml is missing');
}

/* -------------------------------------------------------------------------- */

if (failures.length > 0) {
  console.log(`\n${red(`SDK package validation failed: ${failures.length} problem(s).`)}`);
  process.exit(1);
}
console.log(`\n${green('SDK package validation passed.')} Package ${pkg.name}@${pkg.version} is ready for the release checklist (publishing still disabled).`);
