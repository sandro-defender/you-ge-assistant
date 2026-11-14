#!/usr/bin/env node
/**
 * Precache integrity gate for the You.Ge Assistant service worker.
 *
 *   node scripts/precache-integrity.mjs [--base <ref>] [--root <dir>]
 *   npm run check:precache
 *
 * Installed workers store the app shell in a cache named after the kit version
 * (`…:static:v<VERSION>`). A precached file that changes while the version stays
 * the same is therefore refreshed only opportunistically. This gate compares the
 * working tree with the merge base of the branch and fails when:
 *
 *   - a precached asset was modified, added to or removed from the precache
 *     list (renames and the generated Assistant bundle included) without a
 *     synchronized, higher kit version;
 *   - the kit-version declarations (`you-ge-sw.js` VERSION, `pwa.js`
 *     PWA.version, root `package.json` version and, when the SDK is in the
 *     repository, its KIT_COMPAT_VERSION) disagree;
 *   - the worker lists a precache asset that does not exist.
 *
 * The precache list is not duplicated here: it is read by running the worker's
 * own install handler in an isolated VM, for the base and for the working tree.
 * Documentation, tests and files the worker does not precache never trigger it.
 *
 * The base is `--base` / PRECACHE_INTEGRITY_BASE when given (CI passes the pull
 * request base or the pre-push commit), otherwise the default branch. The diff
 * always starts at `git merge-base <base> HEAD`. An explicit base that cannot be
 * resolved is an error; with no base and no git history the diff is skipped and
 * only the static rules run.
 *
 * No dependencies, no network. Exits 1 on failure.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const WORKER = 'you-ge-sw.js';
const LEGACY_WORKER = 'progressier.js';
const CLIENT = 'pwa.js';
const PACKAGE = 'package.json';
/** SDK source constant naming the kit version the SDK is compatible with. */
const SDK_CONSTANTS = 'packages/assistant-sdk/src/core/constants.js';

/** Precached files that are build output: the fix is to regenerate, not hand-edit. */
const GENERATED = {
  'assistant-state.js': 'generated bundle: rebuilt from packages/assistant-sdk/src by `npm run sync:sdk`',
};

const VERSION_LABELS = {
  worker: `${WORKER} VERSION`,
  client: `${CLIENT} PWA.version`,
  package: `${PACKAGE} version`,
  sdkCompat: `${SDK_CONSTANTS} KIT_COMPAT_VERSION`,
};

/* ------------------------------------------------------------------ *
 * Reading the kit
 * ------------------------------------------------------------------ */

/**
 * Kit-version declarations found in the given sources (null when absent).
 * `sdkConstants` is optional: a kit deployed without the SDK package has no
 * such declaration, so the key is reported only when the file exists. The SDK
 * package's own version (SDK_VERSION) is a separate release line and is not read.
 */
export function readKitVersions({ worker, client, pkg, sdkConstants }) {
  const match = (source, pattern) => {
    const hit = source == null ? null : pattern.exec(source);
    return hit ? hit[1] : null;
  };
  let packageVersion = null;
  try {
    packageVersion = pkg == null ? null : JSON.parse(pkg).version || null;
  } catch (error) {
    packageVersion = null;
  }
  return {
    worker: match(worker, /const VERSION = '([^']+)'/),
    client: match(client, /^\s*version:\s*'([^']+)'/m),
    package: packageVersion,
    ...(sdkConstants == null
      ? {}
      : { sdkCompat: match(sdkConstants, /export const KIT_COMPAT_VERSION = '([^']+)'/) }),
  };
}

/**
 * Run the worker's install handler in an isolated VM and report what it asks
 * to store, as sorted scope-relative paths, plus the scripts it imports.
 * Works for any implementation style (Cache.add, Cache.addAll, fetch + put).
 */
export async function extractPrecacheManifest(workerSource) {
  const scope = 'https://precache-integrity.invalid/kit/';
  const requested = new Set();
  const imports = new Set();
  const listeners = {};
  const record = (input) => requested.add(typeof input === 'string' ? input : input.url);
  const cache = {
    add: async (request) => void record(request),
    addAll: async (requests) => void requests.forEach(record),
    put: async (request) => void record(request),
    match: async () => undefined,
    keys: async () => [],
    delete: async () => false,
  };
  const sandbox = {
    URL, Request, Response, Headers, AbortController, setTimeout, clearTimeout, atob,
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    crypto: globalThis.crypto,
    navigator: {},
    caches: {
      open: async () => cache,
      has: async () => false,
      keys: async () => [],
      delete: async () => false,
      match: async () => undefined,
    },
    fetch: async (input) => {
      record(input);
      return new Response('', { status: 200 });
    },
    location: new URL(WORKER, scope),
    registration: { scope },
    clients: { claim: async () => {}, matchAll: async () => [] },
    skipWaiting: async () => {},
    // Imported scripts are recorded, not executed: the default (registry-free)
    // configuration is what the list is derived from.
    importScripts: (...urls) => urls.forEach((url) => imports.add(String(url))),
    addEventListener: (type, handler) => {
      listeners[type] = handler;
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInContext(workerSource, vm.createContext(sandbox), { filename: WORKER, timeout: 5000 });
  if (typeof listeners.install !== 'function') throw new Error(`${WORKER} registers no install handler`);

  const pending = [];
  listeners.install({ waitUntil: (promise) => pending.push(promise) });
  let timer;
  await Promise.race([
    Promise.all(pending),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${WORKER} install handler did not settle`)), 5000);
    }),
  ]).finally(() => clearTimeout(timer));

  const relative = (href) => {
    const url = new URL(href);
    return url.href.startsWith(scope) ? decodeURIComponent(url.pathname.slice(new URL(scope).pathname.length)) : url.href;
  };
  return {
    precache: [...new Set([...requested].map(relative))].sort(),
    imports: [...new Set([...imports].map(relative))].sort(),
  };
}

/* ------------------------------------------------------------------ *
 * Pure evaluation
 * ------------------------------------------------------------------ */

function parseVersion(value) {
  const hit = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value || ''));
  return hit ? hit.slice(1).map(Number) : null;
}

/** 1 when a > b, -1 when a < b, 0 when equal, null when either is not x.y.z. */
function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function describeChange(change) {
  const notes = [];
  if (change.kind === 'modified') notes.push('modified');
  if (change.kind === 'added') notes.push('added to the precache list');
  if (change.kind === 'removed') notes.push('removed from the precache list');
  if (change.renamedFrom) notes.push(`renamed from ${change.renamedFrom}`);
  if (change.renamedTo) notes.push(`renamed to ${change.renamedTo}`);
  if (GENERATED[change.path]) notes.push(GENERATED[change.path]);
  return `${change.path} — ${notes.join('; ')}`;
}

/**
 * Compare two kit snapshots. A snapshot is
 * `{ versions, precache: string[], blobs: { [path]: id|null } }`; `base` is null
 * when there is nothing to diff against (static rules only).
 */
export function evaluatePrecacheIntegrity({ base, head, renames = {} }) {
  const errors = [];
  const changes = [];
  const version = head.versions.worker;

  /* Rule 1 — one kit version, declared identically everywhere. */
  const declared = Object.entries(head.versions);
  const missing = declared.filter(([, value]) => !value);
  if (missing.length) {
    errors.push(
      `Kit version declaration missing: ${missing.map(([key]) => VERSION_LABELS[key]).join(', ')}.\n` +
        'Action: restore the declaration; every kit-version constant must exist and agree.',
    );
  } else if (new Set(declared.map(([, value]) => value)).size > 1) {
    errors.push(
      'Kit version declarations are not synchronized:\n' +
        declared.map(([key, value]) => `  - ${VERSION_LABELS[key]}: ${value}`).join('\n') +
        '\nAction: set all of them to the same value in one change. They name the worker caches and identify the client build.',
    );
  }

  /* Rule 2 — every listed asset exists, or installs would silently skip it. */
  const absent = head.precache.filter((path) => !/^[a-z]+:/i.test(path) && head.blobs[path] == null);
  if (absent.length) {
    errors.push(
      'Precache assets listed by the worker are missing from the repository:\n' +
        absent.map((path) => `  - ${path} — missing`).join('\n') +
        `\nAction: restore the file or remove it from the precache list in ${WORKER} (a list change needs a kit-version bump).`,
    );
  }

  /* Rule 3 — precache changes need a synchronized, higher kit version. */
  if (base && base.precache) {
    const inBase = new Set(base.precache);
    const inHead = new Set(head.precache);
    const renamedFrom = Object.fromEntries(Object.entries(renames).map(([from, to]) => [to, from]));
    for (const path of [...new Set([...base.precache, ...head.precache])].sort()) {
      if (inBase.has(path) && !inHead.has(path)) {
        changes.push({ path, kind: 'removed', ...(renames[path] ? { renamedTo: renames[path] } : {}) });
      } else if (!inBase.has(path) && inHead.has(path)) {
        changes.push({ path, kind: 'added', ...(renamedFrom[path] ? { renamedFrom: renamedFrom[path] } : {}) });
      } else if ((base.blobs[path] || null) !== (head.blobs[path] || null)) {
        changes.push({ path, kind: 'modified' });
      }
    }

    const order = compareVersions(version, base.versions.worker);
    const versionLine =
      `Kit version: ${VERSION_LABELS.worker} ${version || 'missing'} (base ${base.versions.worker || 'missing'}), ` +
      `${VERSION_LABELS.client} ${head.versions.client || 'missing'} (base ${base.versions.client || 'missing'}).`;
    if (base.versions.worker && order === null) {
      errors.push(`${versionLine}\nAction: use plain x.y.z kit versions so they can be ordered.`);
    } else if (order === -1) {
      errors.push(
        `${versionLine}\nThe kit version moved backwards. Action: choose a version higher than ${base.versions.worker}; ` +
          'an older value can collide with caches that installed workers already retired.',
      );
    } else if (changes.length && order === 0) {
      errors.push(
        'Precached runtime assets changed without a synchronized kit-version change:\n' +
          changes.map((change) => `  - ${describeChange(change)}`).join('\n') +
          `\n${versionLine}\n` +
          `Why: installed service workers keep these files in a cache named after the kit version (…:static:v${version}). ` +
          'With the version unchanged, existing installations keep serving their cached copies until a background ' +
          'revalidation happens to replace them, and never while offline.\n' +
          'Required owner action: authorize a synchronized kit-version bump and apply it in this change — ' +
          `\`const VERSION\` in ${WORKER}, \`version:\` (PWA.version) in ${CLIENT}, \`version\` in ${PACKAGE} and ` +
          `\`KIT_COMPAT_VERSION\` in ${SDK_CONSTANTS} (then \`npm run sync:sdk\`) must move to the ` +
          'same higher value (PRECACHE_INTEGRITY.md lists the pinned tests and documentation lines). ' +
          'Kit-version changes require explicit owner authorization (AGENTS.md, "Git and PR safety"); do not bump without it. ' +
          'If the asset change is unintended, revert it instead.',
      );
    }
  }

  return { ok: errors.length === 0, errors, changes, version, baseVersion: base ? base.versions.worker : null };
}

/* ------------------------------------------------------------------ *
 * Git plumbing
 * ------------------------------------------------------------------ */

function createGit(root, env) {
  return (args, options = {}) => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        env: { ...process.env, ...env },
        encoding: options.buffer ? 'buffer' : 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      return null;
    }
  };
}

const ZERO_SHA = /^0+$/;

/** Resolve the commit to diff from: `{ commit }`, `{ error }` or `{ skipped }`. */
function resolveBase(git, baseRef) {
  if (git(['rev-parse', '--is-inside-work-tree']) == null || git(['rev-parse', '--verify', '-q', 'HEAD^{commit}']) == null) {
    return baseRef
      ? { error: `Base "${baseRef}" was requested but this is not a git checkout with history.` }
      : { skipped: 'not a git checkout' };
  }
  const explicit = baseRef && !ZERO_SHA.test(baseRef) ? baseRef : null;
  const candidates = explicit ? [explicit] : ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master'];
  for (const candidate of candidates) {
    if (git(['rev-parse', '--verify', '-q', `${candidate}^{commit}`]) == null) continue;
    const mergeBase = git(['merge-base', candidate, 'HEAD']);
    if (mergeBase) return { commit: mergeBase.trim(), ref: candidate };
    if (explicit) break;
  }
  if (explicit) {
    return {
      error:
        `Base "${explicit}" cannot be resolved to a merge base with HEAD.\n` +
        'Action: fetch full history before running the gate (actions/checkout with `fetch-depth: 0`, or `git fetch --unshallow`) ' +
        'and pass a commit or ref that exists locally.',
    };
  }
  return { skipped: 'no default branch (origin/main, main, …) found to compare with' };
}

/* ------------------------------------------------------------------ *
 * Orchestration
 * ------------------------------------------------------------------ */

/**
 * Run the gate for the kit at `root`.
 * Resolves `{ status: 'pass'|'fail'|'skipped', report, summary, changes, base, precache }`.
 */
export async function runPrecacheIntegrity({ root, baseRef = '', env = {} } = {}) {
  const at = (path) => join(root, path);
  const readHead = (path) => (existsSync(at(path)) ? readFileSync(at(path), 'utf8') : null);
  const git = createGit(root, env);
  const fail = (report, extra = {}) => ({ status: 'fail', report, summary: report.split('\n')[0], changes: [], base: null, precache: [], ...extra });

  const headWorker = readHead(WORKER);
  if (headWorker == null) return fail(`${WORKER} is missing; the precache list cannot be read.`);
  const legacyShim = readHead(LEGACY_WORKER);
  if (legacyShim == null) {
    return fail(`${LEGACY_WORKER} legacy compatibility shim is missing; existing installations at /${LEGACY_WORKER} require it during the migration period.`);
  }
  if (!legacyShim.includes('importScripts') || !legacyShim.includes(WORKER) || /const VERSION\s*=/.test(legacyShim)) {
    return fail(`${LEGACY_WORKER} must delegate to ${WORKER} via importScripts without declaring an independent VERSION constant.`);
  }
  let headManifest;
  try {
    headManifest = await extractPrecacheManifest(headWorker);
  } catch (error) {
    return fail(`The precache list could not be read from ${WORKER}: ${error.message}\nAction: keep the install handler runnable; the gate executes it to learn which files are precached.`);
  }
  if (!headManifest.precache.length) return fail(`${WORKER} precaches nothing; the offline shell would be empty.`);

  const base = resolveBase(git, baseRef);
  if (base.error) return fail(`Precache integrity check cannot run.\n${base.error}`, { precache: headManifest.precache });

  let baseSnapshot = null;
  let renames = {};
  if (base.commit) {
    const show = (path) => git(['show', `${base.commit}:./${path}`]);
    const baseWorkerName = show(WORKER) != null ? WORKER : LEGACY_WORKER;
    const baseWorker = show(baseWorkerName);
    if (baseWorker != null) {
      let baseManifest;
      try {
        baseManifest = await extractPrecacheManifest(baseWorker);
      } catch (error) {
        return fail(`The precache list could not be read from ${baseWorkerName} at base ${base.commit.slice(0, 7)}: ${error.message}`);
      }
      const tracked = [...new Set([...baseManifest.precache, ...headManifest.precache])];
      const blobs = {};
      for (const path of tracked) {
        const id = git(['rev-parse', '--verify', '-q', `${base.commit}:./${path}`]);
        blobs[path] = id ? id.trim() : null;
      }
      baseSnapshot = {
        versions: readKitVersions({ worker: baseWorker, client: show(CLIENT), pkg: show(PACKAGE), sdkConstants: show(SDK_CONSTANTS) }),
        precache: baseManifest.precache,
        blobs,
      };
      const status = git(['diff', '--name-status', '-M', base.commit, '--']) || '';
      for (const line of status.split('\n')) {
        const [code, from, to] = line.split('\t');
        if (/^R/.test(code || '') && from && to) renames[from] = to;
      }
    }
  }

  // Head blobs come from the working tree so uncommitted edits count too.
  // Outside git the content hash is irrelevant: only existence is checked.
  const tracked = [...new Set([...(baseSnapshot ? baseSnapshot.precache : []), ...headManifest.precache])];
  const headBlobs = {};
  for (const path of tracked) {
    if (/^[a-z]+:/i.test(path) || !existsSync(at(path))) headBlobs[path] = null;
    else if (base.commit) headBlobs[path] = (git(['hash-object', '--', path]) || 'unhashable').trim();
    else headBlobs[path] = 'present';
  }

  const head = {
    versions: readKitVersions({ worker: headWorker, client: readHead(CLIENT), pkg: readHead(PACKAGE), sdkConstants: readHead(SDK_CONSTANTS) }),
    precache: headManifest.precache,
    blobs: headBlobs,
  };
  const verdict = evaluatePrecacheIntegrity({ base: baseSnapshot, head, renames });
  const shared = { changes: verdict.changes, base: base.commit || null, precache: headManifest.precache };
  const range = base.commit ? `base ${base.commit.slice(0, 7)} → working tree` : 'no base';

  if (!verdict.ok) {
    const report = [`Precache integrity check failed (${range}).`, '', verdict.errors.join('\n\n')].join('\n');
    return { status: 'fail', report, summary: `precache integrity failed (${range})`, ...shared };
  }

  const count = headManifest.precache.length;
  if (!baseSnapshot) {
    const reason = base.skipped || `base ${base.commit.slice(0, 7)} has no ${WORKER}`;
    const summary = `precache integrity: diff skipped (${reason}); kit version ${verdict.version} synchronized, ${count} precached assets present`;
    return { status: 'skipped', report: summary, summary, ...shared };
  }
  const bumped = verdict.baseVersion !== verdict.version;
  const versionText = bumped
    ? `kit version ${verdict.baseVersion} → ${verdict.version} synchronized`
    : `kit version ${verdict.version} synchronized`;
  const changeText = verdict.changes.length
    ? `${verdict.changes.length} of ${count} precached assets changed (${verdict.changes.map((change) => change.path).join(', ')})`
    : `${count} precached assets unchanged`;
  const summary = `precache integrity: ${changeText} since ${base.commit.slice(0, 7)}; ${versionText}`;
  return { status: 'pass', report: summary, summary, ...shared };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index === -1 ? '' : args[index + 1] || '';
  };
  const root = resolve(option('--root') || join(dirname(fileURLToPath(import.meta.url)), '..'));
  const baseRef = option('--base') || process.env.PRECACHE_INTEGRITY_BASE || '';
  const result = await runPrecacheIntegrity({ root, baseRef });
  if (result.status === 'fail') {
    console.error(result.report);
    process.exit(1);
  }
  console.log(result.summary);
}
