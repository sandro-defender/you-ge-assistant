// Required / optional precache policy and upgrade safety of the service worker.
// Seam: the worker's install / activate / fetch / message events, a scripted
// network, and the Cache Storage state left behind (PRECACHE_INTEGRITY.md §3).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPTIONAL_PRECACHE,
  PRECACHED,
  REQUIRED_PRECACHE,
  bootWorker,
  createCacheStorage,
  createNetwork,
  workerSourceAt,
  workerVersion,
} from './support/service-worker-harness.mjs';

const SCOPE = 'https://app.test/';
const PREVIOUS_KIT = '1.1.0';
const PRECACHE_TIMEOUT_MS = 120000;
const url = (path) => new URL(path, SCOPE).href;
const shell = (release, { without = [] } = {}) =>
  Object.fromEntries(
    PRECACHED.filter((path) => !without.includes(path)).map((path) => [url(path), `/${path}@${release}`])
  );

/** An origin whose active worker is the previous kit, fully installed from `release`. */
async function installedOrigin({ version = PREVIOUS_KIT, release = 'r1' } = {}) {
  const caches = createCacheStorage();
  const network = createNetwork({ release });
  const active = bootWorker({ caches, network, source: workerSourceAt(version) });
  await active.install();
  await active.activate();
  return { caches, network, active };
}

/** Install the current worker over an existing installation after `breakNetwork`. */
async function updateAttempt(breakNetwork) {
  const origin = await installedOrigin();
  origin.network.release = 'r2';
  breakNetwork(origin.network);
  const next = bootWorker({ caches: origin.caches, network: origin.network });
  let error = null;
  try {
    await next.install();
  } catch (caught) {
    error = caught;
  }
  return { ...origin, next, error };
}

/** A failed update leaves the installed version exactly as it was. */
async function assertInstalledVersionIntact({ caches, network, active, next }, label) {
  assert.deepEqual(await caches.snapshot(active.staticCache), shell('r1'), `${label}: the active cache is untouched`);
  assert.equal(await caches.snapshot(next.staticCache), null, `${label}: no cache is left behind for the failed version`);
  assert.equal(next.calls.skipWaiting, 0, `${label}: the failed worker never asks to take over`);
  assert.equal(next.calls.claim, 0);
  network.offline = true;
  const served = await active.request('pwa.css');
  assert.equal(await served.text(), '/pwa.css@r1', `${label}: the active worker still serves its own shell offline`);
  network.offline = false;
}

/* ------------------------------------------------------------------ *
 * Classification
 * ------------------------------------------------------------------ */

test('the worker precaches exactly the documented required and optional assets', async () => {
  const caches = createCacheStorage();
  const network = createNetwork();
  const worker = bootWorker({ caches, network });

  await worker.install();

  assert.deepEqual(
    network.requests.map((request) => request.path).sort(),
    PRECACHED.map((path) => `/${path}`).sort()
  );
  assert.equal(REQUIRED_PRECACHE.length + OPTIONAL_PRECACHE.length, 13);
});

for (const asset of REQUIRED_PRECACHE) {
  test(`required asset ${asset}: a deployment that does not ship it (404) cannot install`, async () => {
    const attempt = await updateAttempt((network) => network.status(`/${asset}`, 404));

    assert.ok(attempt.error, 'install rejects');
    assert.match(attempt.error.message, new RegExp(asset.replace(/[.]/g, '\\.')), 'the error names the asset');
    assert.match(attempt.error.message, /required/i);
    assert.match(attempt.error.message, /404/);
    await assertInstalledVersionIntact(attempt, asset);
  });
}

for (const asset of OPTIONAL_PRECACHE) {
  test(`optional asset ${asset}: a deployment that does not ship it (404) installs without it`, async () => {
    const attempt = await updateAttempt((network) => network.status(`/${asset}`, 404));

    assert.equal(attempt.error, null);
    assert.deepEqual(await attempt.caches.snapshot(attempt.next.staticCache), shell('r2', { without: [asset] }));
  });
}

test('410 Gone is the only other answer that means an optional asset is not deployed', async () => {
  const attempt = await updateAttempt((network) => network.status('/qrcode.js', 410));

  assert.equal(attempt.error, null);
  assert.deepEqual(await attempt.caches.snapshot(attempt.next.staticCache), shell('r2', { without: ['qrcode.js'] }));
});

/* ------------------------------------------------------------------ *
 * Unsuccessful responses are never mistaken for "not deployed"
 * ------------------------------------------------------------------ */

for (const status of [401, 403, 404, 408, 409, 410, 429, 500, 502, 503, 504]) {
  test(`a required asset answered with HTTP ${status} fails the install`, async () => {
    const attempt = await updateAttempt((network) => network.status('/offline.js', status));

    assert.ok(attempt.error, 'install rejects');
    assert.match(attempt.error.message, /offline\.js/);
    assert.match(attempt.error.message, new RegExp(String(status)));
    await assertInstalledVersionIntact(attempt, `HTTP ${status}`);
  });
}

for (const status of [400, 401, 403, 405, 408, 409, 429, 500, 502, 503, 504]) {
  test(`an optional asset answered with HTTP ${status} fails the install instead of being skipped`, async () => {
    const attempt = await updateAttempt((network) => network.status('/assistant-widget.js', status));

    assert.ok(attempt.error, 'install rejects: only 404/410 mean "not deployed"');
    assert.match(attempt.error.message, /assistant-widget\.js/);
    assert.match(attempt.error.message, new RegExp(String(status)));
    await assertInstalledVersionIntact(attempt, `HTTP ${status}`);
  });
}

for (const status of [204, 206]) {
  test(`a success status other than 200 (HTTP ${status}) is not stored as an asset`, async () => {
    const attempt = await updateAttempt((network) => network.status('/pwa.css', status));

    assert.ok(attempt.error, 'install rejects');
    assert.match(attempt.error.message, /pwa\.css/);
    assert.match(attempt.error.message, new RegExp(`HTTP ${status}`));
    await assertInstalledVersionIntact(attempt, `HTTP ${status}`);
  });
}

test('a host that answers a missing required script with its HTML page cannot install', async () => {
  const attempt = await updateAttempt((network) => network.htmlFallback('/offline.js'));

  assert.ok(attempt.error, 'install rejects: an HTML document is not offline.js');
  assert.match(attempt.error.message, /offline\.js/);
  assert.match(attempt.error.message, /HTML/);
  await assertInstalledVersionIntact(attempt, 'HTML fallback');
});

test('a host that answers a missing optional asset with its HTML page installs without it', async () => {
  const attempt = await updateAttempt((network) => network.htmlFallback('/qrcode.js'));

  assert.equal(attempt.error, null);
  assert.deepEqual(
    await attempt.caches.snapshot(attempt.next.staticCache),
    shell('r2', { without: ['qrcode.js'] }),
    'the HTML page is never cached under the script URL'
  );
});

/* ------------------------------------------------------------------ *
 * Network failure, truncated bodies and timeouts
 * ------------------------------------------------------------------ */

for (const asset of ['offline.html', 'qrcode.js']) {
  test(`losing the connection while fetching ${asset} fails the install`, async () => {
    const attempt = await updateAttempt((network) => network.fail(`/${asset}`));

    assert.ok(attempt.error, 'install rejects, required or optional');
    await assertInstalledVersionIntact(attempt, asset);
  });
}

for (const asset of ['pwa.css', 'assistant-state.js']) {
  test(`a response for ${asset} that breaks off mid-body fails the install before anything is stored`, async () => {
    const attempt = await updateAttempt((network) => network.truncate(`/${asset}`));

    assert.ok(attempt.error, 'install rejects');
    await assertInstalledVersionIntact(attempt, asset);
  });
}

test('a precache request that never answers times out, aborts the others and fails the install', async () => {
  const origin = await installedOrigin();
  origin.network.release = 'r2';
  origin.network.hang('/assistant-state.js');
  origin.network.requests.length = 0;
  const next = bootWorker({ caches: origin.caches, network: origin.network, manualTimers: true });

  let outcome = 'pending';
  let error = null;
  const installing = next.install().then(
    () => { outcome = 'installed'; },
    (caught) => { outcome = 'failed'; error = caught; }
  );

  await next.timers.advance(PRECACHE_TIMEOUT_MS - 1);
  assert.equal(outcome, 'pending', 'a slow install is allowed to continue until the deadline');
  assert.equal(await origin.caches.snapshot(next.staticCache), null, 'nothing is stored while an asset is outstanding');

  await next.timers.advance(1);
  await installing;

  assert.equal(outcome, 'failed');
  assert.match(error.message, /timed out/i);
  assert.ok(
    origin.network.requests.every((request) => request.signal.aborted),
    'every precache request is aborted'
  );
  assert.deepEqual(next.timers.armed(), [], 'no timer is left running');
  await assertInstalledVersionIntact({ ...origin, next }, 'timeout');
});

test('a completed install leaves no timer behind', async () => {
  const caches = createCacheStorage();
  const network = createNetwork();
  const worker = bootWorker({ caches, network, manualTimers: true });

  await worker.install();

  assert.deepEqual(worker.timers.armed(), []);
  assert.deepEqual(await caches.snapshot(worker.staticCache), shell('r1'));
});

/* ------------------------------------------------------------------ *
 * Retry
 * ------------------------------------------------------------------ */

test('after a failed install, a retry installs the complete shell with no leftovers', async () => {
  const attempt = await updateAttempt((network) => network.status('/offline.css', 503));
  assert.ok(attempt.error);
  const { caches, network, active } = attempt;

  // The browser discards the failed worker and evaluates the script again.
  network.restore('/offline.css');
  network.release = 'r3';
  const retry = bootWorker({ caches, network });
  await retry.install();

  assert.deepEqual(await caches.snapshot(retry.staticCache), shell('r3'), 'one release, every asset');
  assert.deepEqual(await caches.snapshot(active.staticCache), shell('r1'), 'still waiting: the active cache is untouched');

  await retry.activate();
  assert.deepEqual(caches.names().sort(), [retry.staticCache, retry.pageCache].sort());
});

test('a retry does not keep an optional asset the deployment stopped shipping', async () => {
  const caches = createCacheStorage();
  const network = createNetwork({ release: 'r1' });
  const first = bootWorker({ caches, network });
  await first.install();
  await first.activate();
  assert.equal((await caches.snapshot(first.staticCache))[url('qrcode.js')], '/qrcode.js@r1');

  // Same kit version, worker script re-evaluated, qrcode.js no longer deployed.
  network.release = 'r2';
  network.status('/qrcode.js', 404);
  const second = bootWorker({ caches, network });
  await second.install();

  assert.deepEqual(
    await caches.snapshot(second.staticCache),
    shell('r2', { without: ['qrcode.js'] }),
    'the cache matches the deployment: no r1 copy of a removed asset beside r2 files'
  );
});

test('a required asset missing on a first install registers no worker cache at all', async () => {
  const caches = createCacheStorage();
  const network = createNetwork();
  network.status('/offline.html', 404);
  const worker = bootWorker({ caches, network });

  await assert.rejects(worker.install(), /offline\.html/);

  assert.deepEqual(caches.names(), []);
});

test('a same-version refresh whose download breaks off mid-body changes nothing in the live cache', async () => {
  const caches = createCacheStorage();
  const network = createNetwork({ release: 'r1' });
  const active = bootWorker({ caches, network });
  await active.install();
  await active.activate();

  network.release = 'r2';
  network.truncate('/assistant-widget.js');
  const refresh = bootWorker({ caches, network });
  await assert.rejects(refresh.install());

  assert.deepEqual(await caches.snapshot(active.staticCache), shell('r1'), 'no r2 file reached the cache the active worker serves from');
});

test('a storage failure while writing removes the half-written cache of the new version', async () => {
  const origin = await installedOrigin();
  origin.network.release = 'r2';
  origin.caches.rejectPut = (target) => target.endsWith('/qrcode.js');
  const next = bootWorker({ caches: origin.caches, network: origin.network });

  await assert.rejects(next.install(), /Quota/);

  origin.caches.rejectPut = null;
  await assertInstalledVersionIntact({ ...origin, next }, 'storage failure');

  const retry = bootWorker({ caches: origin.caches, network: origin.network });
  await retry.install();
  assert.deepEqual(await origin.caches.snapshot(retry.staticCache), shell('r2'));
});

/* ------------------------------------------------------------------ *
 * Upgrade from the previous kit version
 * ------------------------------------------------------------------ */

test(`the current kit is a different cache generation from ${PREVIOUS_KIT}`, () => {
  assert.notEqual(workerVersion, PREVIOUS_KIT, 'assets changed under 1.1.0, so the worker must carry a newer kit version');
  const [major, minor, patch] = workerVersion.split('.').map(Number);
  const [oldMajor, oldMinor, oldPatch] = PREVIOUS_KIT.split('.').map(Number);
  assert.ok(
    major > oldMajor || (major === oldMajor && (minor > oldMinor || (minor === oldMinor && patch > oldPatch))),
    `${workerVersion} is newer than ${PREVIOUS_KIT}`
  );
});

test(`an existing ${PREVIOUS_KIT} installation upgrades to a complete new-version cache`, async () => {
  const { caches, network, active } = await installedOrigin({ release: 'deployed-under-1.1.0' });
  assert.equal(active.staticCache, `you-ge-assistant:app.test:%2F:static:v${PREVIOUS_KIT}`);

  network.release = 'current';
  const next = bootWorker({ caches, network });
  await next.install();

  assert.equal(next.staticCache, `you-ge-assistant:app.test:%2F:static:v${workerVersion}`);
  assert.notEqual(next.staticCache, active.staticCache);
  assert.deepEqual(await caches.snapshot(next.staticCache), shell('current'), 'all 13 assets, all from the new deployment');
  assert.equal(
    (await caches.snapshot(next.staticCache))[url('assistant-state.js')],
    '/assistant-state.js@current',
    'the generated Assistant bundle is part of the new cache'
  );

  // Installed but waiting: the old version keeps running on its own cache.
  assert.equal(next.calls.skipWaiting, 0, 'the new worker waits for the page');
  assert.deepEqual(await caches.snapshot(active.staticCache), shell('deployed-under-1.1.0'));
  network.offline = true;
  assert.equal(await (await active.request('assistant-state.js')).text(), '/assistant-state.js@deployed-under-1.1.0');
  network.offline = false;

  // The page shows its update notice and, when the user accepts, sends SKIP_WAITING.
  await next.message({ type: 'SKIP_WAITING' });
  assert.equal(next.calls.skipWaiting, 1);
  await next.activate();

  assert.equal(next.calls.claim, 1);
  assert.deepEqual(caches.names().sort(), [next.staticCache, next.pageCache].sort(), `the ${PREVIOUS_KIT} caches are retired`);

  // Offline after the upgrade: every precached file comes from the new deployment.
  network.offline = true;
  for (const path of PRECACHED.filter((asset) => /\.(?:js|css|png)$/.test(asset))) {
    assert.equal(await (await next.request(path)).text(), `/${path}@current`, `${path} offline`);
  }
  const offlinePage = await next.request('some/page', { mode: 'navigate' });
  assert.match(await offlinePage.text(), /\/offline\.html@current/);
});

test(`a failed upgrade from ${PREVIOUS_KIT} never mixes versions for offline users`, async () => {
  const attempt = await updateAttempt((network) => network.fail('/assistant-widget.css'));
  assert.ok(attempt.error);
  const { caches, network, active } = attempt;

  network.offline = true;
  for (const path of PRECACHED.filter((asset) => /\.(?:js|css|png)$/.test(asset))) {
    assert.equal(await (await active.request(path)).text(), `/${path}@r1`, `${path} still from the installed release`);
  }
  assert.deepEqual(caches.names().sort(), [active.staticCache, active.pageCache].sort());
});
