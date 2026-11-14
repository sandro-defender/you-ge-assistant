// Service-worker cache refresh and upgrade behaviour (R1).
// Seam: the lifecycle events `progressier.js` handles (install, activate,
// fetch, message) and the Cache Storage state they leave behind.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRECACHED,
  bootWorker,
  createCacheStorage,
  createNetwork,
  workerSourceAt,
  workerVersion,
} from './support/service-worker-harness.mjs';

const SCOPE = 'https://app.test/';
const url = (path) => new URL(path, SCOPE).href;
const expectedShell = (release) =>
  Object.fromEntries(PRECACHED.map((path) => [url(path), `/${path}@${release}`]));

/** An origin whose active worker is kit `version`, fully installed from `release`. */
async function installedOrigin({ version = '1.0.9', release = 'r1' } = {}) {
  const caches = createCacheStorage();
  const network = createNetwork({ release });
  const active = bootWorker({ caches, network, source: workerSourceAt(version) });
  await active.install();
  await active.activate();
  return { caches, network, active };
}

test('a first install precaches the complete app shell straight from the network', async () => {
  const caches = createCacheStorage();
  const network = createNetwork({ release: 'r1' });
  const worker = bootWorker({ caches, network });

  await worker.install();

  assert.equal(worker.staticCache, `you-ge-assistant:app.test:%2F:static:v${workerVersion}`);
  assert.deepEqual(await caches.snapshot(worker.staticCache), expectedShell('r1'));
  assert.ok(network.requests.length >= PRECACHED.length);
  assert.ok(
    network.requests.every((request) => request.cache === 'reload'),
    'precache requests bypass the HTTP cache so a new worker never stores a stale copy',
  );
});

test('a newly installed worker waits: it only takes over when the page sends SKIP_WAITING', async () => {
  const { caches, network } = await installedOrigin();
  network.release = 'r2';
  const next = bootWorker({ caches, network, source: workerSourceAt('9.9.9') });

  await next.install();
  assert.equal(next.calls.skipWaiting, 0, 'install never skips waiting on its own');
  assert.equal(next.calls.claim, 0);

  await next.message({ type: 'SKIP_WAITING' });
  assert.equal(next.calls.skipWaiting, 1);
});

test('an updated kit version installs beside the active cache and leaves it untouched until activation', async () => {
  const { caches, network, active } = await installedOrigin({ release: 'r1' });
  network.release = 'r2';
  const next = bootWorker({ caches, network, source: workerSourceAt('9.9.9') });

  await next.install();

  assert.deepEqual(await caches.snapshot(active.staticCache), expectedShell('r1'), 'the active worker still owns release r1');
  assert.deepEqual(await caches.snapshot(next.staticCache), expectedShell('r2'), 'the waiting worker holds a complete release r2');
  network.offline = true;
  const served = await active.request('assistant-state.js');
  assert.equal(await served.text(), '/assistant-state.js@r1', 'pages controlled by the active worker keep its code');
});

test('activation retires only this app\'s previous-version caches', async () => {
  const { caches, network, active } = await installedOrigin();
  const foreign = [
    'you-ge-assistant:other.test:%2F:static:v1.0.9', // another host sharing the storage
    'you-ge-assistant:app.test:%2Fadmin%2F:static:v1.0.9', // another scope on this origin
    'pwa-static-1.0.4', // legacy shared name: may belong to another app
    'third-party-cache',
  ];
  for (const name of foreign) await caches.open(name);
  await (await caches.open(active.pageCache)).put(new Request(url('dashboard')), new Response('page'));
  network.release = 'r2';
  const next = bootWorker({ caches, network, source: workerSourceAt('9.9.9') });

  await next.install();
  await next.activate();

  assert.deepEqual(caches.names().sort(), [...foreign, next.staticCache, next.pageCache].sort());
  assert.equal(next.calls.claim, 1, 'the activated worker claims open pages');
});

test('after an update is installed and activated, offline users receive the updated code', async () => {
  const { caches, network } = await installedOrigin({ release: 'r1' });
  network.release = 'r2';
  const next = bootWorker({ caches, network, source: workerSourceAt('9.9.9') });
  await next.install();
  await next.activate();

  network.offline = true;

  for (const path of ['assistant-state.js', 'assistant-widget.js', 'pwa.css', 'dns-diagnostics.js']) {
    const response = await next.request(path);
    assert.equal(await response.text(), `/${path}@r2`, `${path} is served from the updated shell`);
  }
});

test('an update whose precache loses the network fails as a whole and keeps the installed version intact', async () => {
  const { caches, network, active } = await installedOrigin({ release: 'r1' });
  network.release = 'r2';
  network.fail('/assistant-widget.js');
  const next = bootWorker({ caches, network, source: workerSourceAt('9.9.9') });

  await assert.rejects(next.install(), 'the browser discards a worker whose install rejects and retries later');

  assert.deepEqual(await caches.snapshot(active.staticCache), expectedShell('r1'));
  assert.deepEqual(await caches.snapshot(next.staticCache) || {}, {}, 'no half-filled shell is left for the next version');
  assert.equal(next.calls.skipWaiting, 0);
});

test('a server error while precaching fails the install instead of activating an incomplete shell', async () => {
  const { caches, network, active } = await installedOrigin({ release: 'r1' });
  network.release = 'r2';
  network.status('/assistant-state.js', 503);
  const next = bootWorker({ caches, network, source: workerSourceAt('9.9.9') });

  await assert.rejects(next.install());

  assert.deepEqual(await caches.snapshot(active.staticCache), expectedShell('r1'));
  assert.deepEqual(await caches.snapshot(next.staticCache) || {}, {});
});

test('optional assets a deployment does not ship (4xx) never block installation', async () => {
  const caches = createCacheStorage();
  const network = createNetwork({ release: 'r1' });
  network.status('/qrcode.js', 404);
  network.status('/dns-diagnostics.js', 403);
  const worker = bootWorker({ caches, network });

  await worker.install();

  const shell = expectedShell('r1');
  delete shell[url('qrcode.js')];
  delete shell[url('dns-diagnostics.js')];
  assert.deepEqual(await caches.snapshot(worker.staticCache), shell);
});

test('a same-version worker update refreshes the live shell in place, all or nothing', async () => {
  const { caches, network, active } = await installedOrigin({ version: workerVersion, release: 'r1' });

  // The worker script changed but the kit version did not: both generations
  // share one cache name, so a failed re-install must not leave mixed releases.
  network.release = 'r2';
  network.fail('/pwa.css');
  const broken = bootWorker({ caches, network });
  await assert.rejects(broken.install());
  assert.deepEqual(await caches.snapshot(active.staticCache), expectedShell('r1'), 'a failed refresh changes nothing');

  network.restore('/pwa.css');
  const next = bootWorker({ caches, network });
  await next.install();
  assert.deepEqual(await caches.snapshot(active.staticCache), expectedShell('r2'), 'a complete refresh replaces every asset');

  await next.activate();
  assert.deepEqual(caches.names().sort(), [next.staticCache, next.pageCache].sort(), 'the shared cache survives activation');
});

test('without a new worker, a changed asset is served stale once and refreshed for the next load', async () => {
  const { network, active } = await installedOrigin({ release: 'r1' });
  network.release = 'r2'; // assets redeployed; worker script byte-identical

  const first = await active.request('assistant-state.js');
  assert.equal(await first.text(), '/assistant-state.js@r1', 'the cached copy answers the first request');
  const second = await active.request('assistant-state.js');
  assert.equal(await second.text(), '/assistant-state.js@r2', 'the background revalidation updated the cache');

  network.offline = true;
  const untouched = await active.request('offline.css');
  assert.equal(await untouched.text(), '/offline.css@r1', 'assets not requested online stay on the old release');
});

test('the page client and the worker script itself are never answered from the cache', async () => {
  const { active } = await installedOrigin();
  assert.equal(await active.request('pwa.js'), null);
  assert.equal(await active.request('progressier.js'), null);
});
