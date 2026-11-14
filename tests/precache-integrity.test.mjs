// Diff-aware precache integrity gate (R1).
// Seam: `runPrecacheIntegrity({ root, baseRef })` / the CLI, exercised against
// real throw-away git repositories that contain the real worker and client.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { extractPrecacheManifest, runPrecacheIntegrity } from '../scripts/precache-integrity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'scripts', 'precache-integrity.mjs');

const PRECACHED = [
  'assistant-state.js', 'assistant-widget.css', 'assistant-widget.js',
  'dns-diagnostics.js', 'domain-config.js', 'domain-registry.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'offline.css', 'offline.html', 'offline.js', 'pwa.css', 'qrcode.js',
];
const KIT_VERSION_FILES = ['progressier.js', 'pwa.js', 'package.json'];
const SDK_CONSTANTS = 'packages/assistant-sdk/src/core/constants.js';
/** One line of the worker's precache manifest, as written in progressier.js. */
const QR_ENTRY = "  { url: new URL('qrcode.js', SCOPE_URL).href, required: false },\n";

/** A throw-away git repository holding the real kit runtime on `main`. */
function createKitRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'youge-precache-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  const repo = {
    dir,
    git,
    read: (path) => readFileSync(join(dir, path), 'utf8'),
    write(path, content) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    },
    append(path, text) {
      repo.write(path, repo.read(path) + text);
    },
    replace(path, from, to) {
      const before = repo.read(path);
      assert.ok(before.includes(from), `${path} contains ${from}`);
      repo.write(path, before.replace(from, to));
    },
    commit(message) {
      git('add', '-A');
      git('commit', '-q', '-m', message);
      return git('rev-parse', 'HEAD');
    },
    /** Bump the kit version in the given declarations (all three by default). */
    bump(version, files = KIT_VERSION_FILES) {
      if (files.includes('progressier.js')) repo.replace('progressier.js', /const VERSION = '[^']+'/.exec(repo.read('progressier.js'))[0], `const VERSION = '${version}'`);
      if (files.includes('pwa.js')) repo.replace('pwa.js', /version: '[^']+'/.exec(repo.read('pwa.js'))[0], `version: '${version}'`);
      if (files.includes('package.json')) repo.replace('package.json', /"version": "[^"]+"/.exec(repo.read('package.json'))[0], `"version": "${version}"`);
    },
    check: (options = {}) => runPrecacheIntegrity({ root: dir, baseRef: 'main', ...options }),
  };
  for (const path of [...PRECACHED, ...KIT_VERSION_FILES, 'manifest-handler.js']) {
    cpSync(join(root, path), join(dir, path), { recursive: true });
  }
  repo.write('README.md', '# Fixture\n');
  repo.write('tests/sample.test.mjs', '// sample\n');
  git('-c', 'init.defaultBranch=main', 'init', '-q');
  repo.commit('base');
  git('checkout', '-q', '-b', 'feature');
  return repo;
}

const kitVersion = /const VERSION = '([^']+)'/.exec(readFileSync(join(root, 'progressier.js'), 'utf8'))[1];
const nextPatch = kitVersion.replace(/\d+$/, (patch) => String(Number(patch) + 1));

test('the precache manifest is read from the worker\'s real install behaviour', async () => {
  const manifest = await extractPrecacheManifest(readFileSync(join(root, 'progressier.js'), 'utf8'));
  assert.deepEqual(manifest.precache, PRECACHED);
  assert.deepEqual(manifest.imports, ['domain-config.js', 'domain-registry.js']);
});

test('a changed precached asset without a kit-version change is rejected with the asset and the owner action', async (t) => {
  const repo = createKitRepo(t);
  repo.append('pwa.css', '\n.changed { color: red; }\n');
  repo.commit('style change');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.changes.map((change) => [change.path, change.kind]), [['pwa.css', 'modified']]);
  assert.match(result.report, /pwa\.css/);
  assert.match(result.report, new RegExp(`progressier\\.js.*VERSION.*${kitVersion.replaceAll('.', '\\.')}`));
  assert.match(result.report, /pwa\.js.*PWA\.version/);
  assert.match(result.report, /owner authori[sz]ation/i);
});

test('a changed precached asset with a synchronized kit-version bump passes', async (t) => {
  const repo = createKitRepo(t);
  repo.append('pwa.css', '\n.changed { color: red; }\n');
  repo.bump(nextPatch);
  repo.commit('style change with bump');

  const result = await repo.check();

  assert.equal(result.status, 'pass');
  assert.deepEqual(result.changes.map((change) => change.path), ['pwa.css']);
  assert.match(result.report, new RegExp(`${kitVersion.replaceAll('.', '\\.')} → ${nextPatch.replaceAll('.', '\\.')}`));
});

test('documentation, tests and files outside the precache list never require a version change', async (t) => {
  const repo = createKitRepo(t);
  repo.append('README.md', '\nMore docs.\n');
  repo.write('docs/GUIDE.md', '# Guide\n');
  repo.append('tests/sample.test.mjs', '// more tests\n');
  repo.append('manifest-handler.js', '\n// not precached\n');
  repo.append('pwa.js', '\n// the page client is always fetched from the network\n');
  repo.commit('docs, tests and non-precached runtime');

  const result = await repo.check();

  assert.equal(result.status, 'pass');
  assert.deepEqual(result.changes, []);
});

test('a worker change that leaves the precache list alone passes without a bump', async (t) => {
  const repo = createKitRepo(t);
  repo.append('progressier.js', '\n// worker-only change: browsers reinstall the worker by byte comparison\n');
  repo.commit('worker comment');

  const result = await repo.check();

  assert.equal(result.status, 'pass');
  assert.deepEqual(result.changes, []);
});

test('adding an asset to the precache list requires a bump', async (t) => {
  const repo = createKitRepo(t);
  repo.write('extra-shell.js', '// new shell asset\n');
  repo.replace('progressier.js', QR_ENTRY, `${QR_ENTRY}  { url: new URL('extra-shell.js', SCOPE_URL).href, required: false },\n`);
  repo.commit('precache one more asset');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.changes.map((change) => [change.path, change.kind]), [['extra-shell.js', 'added']]);
  assert.match(result.report, /extra-shell\.js.*added to the precache list/);

  repo.bump(nextPatch);
  repo.commit('bump');
  assert.equal((await repo.check()).status, 'pass');
});

test('removing an asset from the precache list requires a bump', async (t) => {
  const repo = createKitRepo(t);
  repo.replace('progressier.js', QR_ENTRY, '');
  repo.commit('stop precaching the QR library');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.changes.map((change) => [change.path, change.kind]), [['qrcode.js', 'removed']]);
  assert.match(result.report, /qrcode\.js.*removed from the precache list/);
});

test('a renamed precached asset is reported as a rename', async (t) => {
  const repo = createKitRepo(t);
  renameSync(join(repo.dir, 'offline.css'), join(repo.dir, 'offline-page.css'));
  repo.replace('progressier.js', "new URL('offline.css', SCOPE_URL)", "new URL('offline-page.css', SCOPE_URL)");
  repo.commit('rename the offline stylesheet');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.deepEqual(
    result.changes.map((change) => [change.path, change.kind]),
    [['offline-page.css', 'added'], ['offline.css', 'removed']],
  );
  assert.match(result.report, /offline-page\.css.*renamed from offline\.css/);
});

test('a listed asset that no longer exists is rejected even with a bump', async (t) => {
  const repo = createKitRepo(t);
  rmSync(join(repo.dir, 'qrcode.js'));
  repo.bump(nextPatch);
  repo.commit('delete a listed asset');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.match(result.report, /qrcode\.js.*missing/);
});

test('a regenerated Assistant bundle is identified as generated and requires a bump', async (t) => {
  const repo = createKitRepo(t);
  repo.append('assistant-state.js', '\n// regenerated\n');
  repo.commit('regenerate the Assistant bundle');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.match(result.report, /assistant-state\.js.*generated.*npm run sync:sdk/);
});

test('unsynchronized kit-version declarations are rejected', async (t) => {
  const repo = createKitRepo(t);
  repo.append('pwa.css', '\n.changed {}\n');
  repo.bump(nextPatch, ['progressier.js']);
  repo.commit('bump only the worker');

  const workerOnly = await repo.check();
  assert.equal(workerOnly.status, 'fail');
  assert.match(workerOnly.report, /not synchronized/);
  assert.match(workerOnly.report, new RegExp(`progressier\\.js.*${nextPatch.replaceAll('.', '\\.')}`));
  assert.match(workerOnly.report, new RegExp(`pwa\\.js.*${kitVersion.replaceAll('.', '\\.')}`));

  repo.bump(nextPatch, ['pwa.js']);
  repo.commit('bump the client, forget package.json');
  const withoutPackage = await repo.check();
  assert.equal(withoutPackage.status, 'fail');
  assert.match(withoutPackage.report, /package\.json/);

  repo.bump(nextPatch, ['package.json']);
  repo.commit('bump package.json');
  assert.equal((await repo.check()).status, 'pass');
});

test('the SDK kit-compatibility version is part of the synchronized set when the SDK is in the repository', async (t) => {
  const repo = createKitRepo(t);
  repo.write(SDK_CONSTANTS, `export const SDK_VERSION = '0.2.0';\nexport const KIT_COMPAT_VERSION = '${kitVersion}';\n`);
  repo.commit('add the SDK package');
  repo.git('branch', '-f', 'main', 'HEAD');
  assert.equal((await repo.check()).status, 'pass', 'an agreeing SDK declaration passes');

  repo.append('pwa.css', '\n.changed {}\n');
  repo.bump(nextPatch);
  repo.commit('bump the kit, forget KIT_COMPAT_VERSION');

  const forgotten = await repo.check();
  assert.equal(forgotten.status, 'fail');
  assert.match(forgotten.report, /not synchronized/);
  assert.match(forgotten.report, new RegExp(`constants\\.js.*KIT_COMPAT_VERSION.*${kitVersion.replaceAll('.', '\\.')}`));
  assert.match(forgotten.report, new RegExp(`progressier\\.js.*${nextPatch.replaceAll('.', '\\.')}`));

  repo.replace(SDK_CONSTANTS, `KIT_COMPAT_VERSION = '${kitVersion}'`, `KIT_COMPAT_VERSION = '${nextPatch}'`);
  repo.commit('bump KIT_COMPAT_VERSION');
  const synchronized = await repo.check();
  assert.equal(synchronized.status, 'pass', synchronized.report);

  repo.replace(SDK_CONSTANTS, `export const KIT_COMPAT_VERSION = '${nextPatch}';\n`, '');
  repo.commit('drop the declaration');
  const dropped = await repo.check();
  assert.equal(dropped.status, 'fail');
  assert.match(dropped.report, /KIT_COMPAT_VERSION/);
});

test('the SDK package version is not a kit-version declaration', async (t) => {
  const repo = createKitRepo(t);
  repo.write(SDK_CONSTANTS, `export const SDK_VERSION = '0.2.0';\nexport const KIT_COMPAT_VERSION = '${kitVersion}';\n`);
  repo.write('packages/assistant-sdk/package.json', '{ "name": "@youge/assistant-sdk", "version": "0.2.0" }\n');
  repo.commit('add the SDK package');

  const result = await repo.check();

  assert.equal(result.status, 'pass', 'SDK 0.2.0 beside a different kit version is not a mismatch');
});

test('every kit-version declaration in this repository agrees, and the SDK package version stays separate', () => {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const declarations = {
    'progressier.js VERSION': /const VERSION = '([^']+)'/.exec(read('progressier.js'))[1],
    'pwa.js PWA.version': /^\s*version:\s*'([^']+)'/m.exec(read('pwa.js'))[1],
    'package.json version': JSON.parse(read('package.json')).version,
    'SDK KIT_COMPAT_VERSION': /export const KIT_COMPAT_VERSION = '([^']+)'/.exec(read(SDK_CONSTANTS))[1],
    'assistant-state.js KIT_COMPAT_VERSION (generated)': /const KIT_COMPAT_VERSION = '([^']+)'/.exec(read('assistant-state.js'))[1],
  };
  assert.deepEqual([...new Set(Object.values(declarations))], [kitVersion], JSON.stringify(declarations, null, 2));

  const sdkPackage = JSON.parse(read('packages/assistant-sdk/package.json')).version;
  const sdkConstant = /export const SDK_VERSION = '([^']+)'/.exec(read(SDK_CONSTANTS))[1];
  assert.equal(sdkPackage, sdkConstant, 'the SDK package version has its own pair of declarations');
  assert.notEqual(sdkPackage, kitVersion, 'the SDK release line is independent of the kit version');
});

test('the kit version may not move backwards', async (t) => {
  const repo = createKitRepo(t);
  repo.append('pwa.css', '\n.changed {}\n');
  repo.bump('0.0.1');
  repo.commit('downgrade');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.match(result.report, /higher/);
});

test('a version bump without precache changes is allowed', async (t) => {
  const repo = createKitRepo(t);
  repo.bump(nextPatch);
  repo.commit('release bump');

  assert.equal((await repo.check()).status, 'pass');
});

test('changes are measured from the merge base, not from the latest commit or the tip of main', async (t) => {
  const repo = createKitRepo(t);
  repo.append('dns-diagnostics.js', '\n// change in an early commit\n');
  repo.commit('early precached change');
  repo.append('README.md', '\nLater docs-only commit.\n');
  repo.commit('docs');

  const early = await repo.check();
  assert.equal(early.status, 'fail', 'an older commit on the branch still counts');
  assert.deepEqual(early.changes.map((change) => change.path), ['dns-diagnostics.js']);

  // A docs-only branch must not be blamed for precached changes that landed on
  // main (with their own bump) after it forked.
  const forkPoint = repo.git('rev-parse', 'main');
  repo.git('checkout', '-q', 'main');
  repo.append('offline.js', '\n// landed on main\n');
  repo.bump(nextPatch);
  repo.commit('main moves on');
  repo.git('checkout', '-q', '-b', 'docs-only', forkPoint);
  repo.append('README.md', '\nDocs.\n');
  repo.commit('docs only');

  const docsOnly = await repo.check();
  assert.equal(docsOnly.status, 'pass');
  assert.equal(docsOnly.base, forkPoint);
  assert.deepEqual(docsOnly.changes, []);
});

test('uncommitted working-tree changes to a precached asset are caught locally', async (t) => {
  const repo = createKitRepo(t);
  repo.append('offline.html', '\n<!-- uncommitted -->\n');

  const result = await repo.check();

  assert.equal(result.status, 'fail');
  assert.deepEqual(result.changes.map((change) => change.path), ['offline.html']);
});

test('without an explicit base the default branch is used, and an unresolvable required base fails loudly', async (t) => {
  const repo = createKitRepo(t);
  repo.append('qrcode.js', '\n// changed\n');
  repo.commit('change');

  const defaulted = await runPrecacheIntegrity({ root: repo.dir });
  assert.equal(defaulted.status, 'fail', 'falls back to the local main branch');

  const optional = await runPrecacheIntegrity({ root: repo.dir, baseRef: 'no-such-ref' });
  assert.equal(optional.status, 'fail', 'an explicit base that cannot be resolved is never skipped');
  assert.match(optional.report, /no-such-ref/);
  assert.match(optional.report, /fetch-depth: 0/);
});

test('outside a git checkout the diff is skipped but version synchronization is still enforced', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'youge-precache-nogit-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const path of [...PRECACHED, ...KIT_VERSION_FILES]) cpSync(join(root, path), join(dir, path), { recursive: true });
  const env = { GIT_CEILING_DIRECTORIES: dirname(dir) };

  const skipped = await runPrecacheIntegrity({ root: dir, env });
  assert.equal(skipped.status, 'skipped');

  writeFileSync(join(dir, 'pwa.js'), readFileSync(join(dir, 'pwa.js'), 'utf8').replace(`version: '${kitVersion}'`, "version: '0.0.0'"));
  const mismatch = await runPrecacheIntegrity({ root: dir, env });
  assert.equal(mismatch.status, 'fail');
  assert.match(mismatch.report, /not synchronized/);
});

test('the CLI exits non-zero with the report on failure and zero with a one-line summary on success', (t) => {
  const repo = createKitRepo(t);
  const run = () => spawnSync(process.execPath, [cli, '--root', repo.dir, '--base', 'main'], { encoding: 'utf8' });

  const clean = run();
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(clean.stdout.trim().split('\n').length, 1, 'success is a single concise line');
  assert.match(clean.stdout, /13 precached assets unchanged/);

  repo.append('assistant-widget.js', '\n// changed\n');
  repo.commit('change');
  const failing = run();
  assert.equal(failing.status, 1);
  assert.match(failing.stderr, /assistant-widget\.js/);
});

test('this repository itself passes the gate against its merge base when history is available', async () => {
  const result = await runPrecacheIntegrity({ root });
  assert.notEqual(result.status, 'fail', result.report);
});
