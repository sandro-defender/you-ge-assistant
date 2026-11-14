import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { createCacheStorage, createNetwork } from './support/service-worker-harness.mjs';
import { runPrecacheIntegrity } from '../scripts/precache-integrity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

/**
 * Deterministic in-memory IndexedDB fake implementing the IDBFactory / IDBDatabase /
 * IDBTransaction / IDBObjectStore seam used by you-ge-sw.js and pwa.js.
 */
function createFakeIndexedDB(seed = {}) {
  const databases = new Map();

  for (const [dbName, stores] of Object.entries(seed)) {
    const storeMap = new Map();
    for (const [storeName, records] of Object.entries(stores)) {
      const recordMap = new Map();
      for (const record of records) {
        recordMap.set(record.id, structuredClone(record));
      }
      storeMap.set(storeName, recordMap);
    }
    databases.set(dbName, storeMap);
  }

  function makeRequest(executor) {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
    queueMicrotask(() => executor(req));
    return req;
  }

  return {
    databases: async () => [...databases.keys()].map((name) => ({ name, version: 1 })),
    dump(dbName, storeName) {
      const db = databases.get(dbName);
      if (!db || !db.has(storeName)) return null;
      return [...db.get(storeName).values()].map((item) => structuredClone(item));
    },
    hasDatabase(dbName) {
      return databases.has(dbName);
    },
    open(name) {
      return makeRequest((req) => {
        const isNew = !databases.has(name);
        if (isNew) databases.set(name, new Map());
        const storeMap = databases.get(name);
        const db = {
          name,
          objectStoreNames: {
            contains: (storeName) => storeMap.has(storeName),
          },
          createObjectStore(storeName) {
            if (!storeMap.has(storeName)) storeMap.set(storeName, new Map());
            return {};
          },
          close() {},
          transaction(storeName) {
            if (!storeMap.has(storeName)) {
              throw new Error(`Store "${storeName}" not found in DB "${name}"`);
            }
            const records = storeMap.get(storeName);
            const tx = { oncomplete: null, onerror: null, error: null };
            let pendingOps = 0;
            let finished = false;
            const settle = () => {
              if (finished || pendingOps > 0) return;
              finished = true;
              queueMicrotask(() => {
                if (typeof tx.oncomplete === 'function') tx.oncomplete();
              });
            };
            queueMicrotask(settle);
            return Object.assign(tx, {
              objectStore() {
                return {
                  put(value) {
                    pendingOps += 1;
                    const opReq = { result: value.id, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      records.set(value.id, structuredClone(value));
                      if (typeof opReq.onsuccess === 'function') opReq.onsuccess();
                      pendingOps -= 1;
                      settle();
                    });
                    return opReq;
                  },
                  get(key) {
                    pendingOps += 1;
                    const opReq = { result: undefined, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      opReq.result = records.has(key) ? structuredClone(records.get(key)) : undefined;
                      if (typeof opReq.onsuccess === 'function') opReq.onsuccess();
                      pendingOps -= 1;
                      settle();
                    });
                    return opReq;
                  },
                  delete(key) {
                    pendingOps += 1;
                    const opReq = { result: undefined, onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      records.delete(key);
                      if (typeof opReq.onsuccess === 'function') opReq.onsuccess();
                      pendingOps -= 1;
                      settle();
                    });
                    return opReq;
                  },
                  getAll() {
                    pendingOps += 1;
                    const opReq = { result: [], onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      opReq.result = [...records.values()].map((item) => structuredClone(item));
                      if (typeof opReq.onsuccess === 'function') opReq.onsuccess();
                      pendingOps -= 1;
                      settle();
                    });
                    return opReq;
                  },
                };
              },
            });
          },
        };
        req.result = db;
        if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded();
        if (typeof req.onsuccess === 'function') req.onsuccess();
      });
    },
  };
}

function bootCustomWorker({
  scriptName = 'you-ge-sw.js',
  scope = 'https://app.test/',
  indexedDB = createFakeIndexedDB(),
  caches = createCacheStorage(),
  network = createNetwork(),
} = {}) {
  const listeners = {};
  const shownNotifications = [];
  let badgeCount = 0;
  caches.fetch = (input) => network.fetch(input);

  const scopeUrl = new URL(scope);
  const resolveRepoScript = (href) => {
    const parsed = new URL(href, new URL(scriptName, scopeUrl));
    const rel = parsed.pathname.startsWith(scopeUrl.pathname)
      ? parsed.pathname.slice(scopeUrl.pathname.length)
      : parsed.pathname.replace(/^\//, '');
    return read(rel);
  };

  const sandbox = {
    URL, Request, Response, Headers, FormData, Blob, File, AbortController, TypeError, Promise,
    Uint8Array, ArrayBuffer, setTimeout, clearTimeout, queueMicrotask, console, atob,
    crypto: globalThis.crypto,
    indexedDB,
    navigator: {
      setAppBadge: async (n) => { badgeCount = n; },
      clearAppBadge: async () => { badgeCount = 0; },
    },
    caches,
    fetch: (input, init) => network.fetch(input, init),
    location: new URL(scriptName, scopeUrl),
    registration: {
      scope: scopeUrl.href,
      showNotification: async (title, options) => { shownNotifications.push({ title, options }); },
      getNotifications: async () => shownNotifications,
    },
    clients: { claim: async () => {}, matchAll: async () => [] },
    skipWaiting: () => Promise.resolve(),
    addEventListener: (type, handler) => { listeners[type] = handler; },
    importScripts: (...urls) => {
      for (const url of urls) {
        vm.runInContext(resolveRepoScript(url), context, { filename: String(url) });
      }
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(read(scriptName), context, { filename: scriptName });

  const waitEvent = async (type, init = {}) => {
    const tasks = [];
    listeners[type]({ ...init, waitUntil: (p) => tasks.push(Promise.resolve(p)) });
    await Promise.all(tasks);
  };

  return {
    indexedDB,
    caches,
    getBadge: () => badgeCount,
    install: () => waitEvent('install'),
    activate: () => waitEvent('activate'),
    push: (payload) =>
      waitEvent('push', {
        data: {
          json: () => payload,
          text: () => JSON.stringify(payload),
        },
      }),
    request(input, init) {
      const request = typeof input === 'string'
        ? new Request(new URL(input, scopeUrl).href, init)
        : input;
      let response = null;
      listeners.fetch({
        request,
        respondWith(value) { response = Promise.resolve(value); },
      });
      return response;
    },
    async message(data) {
      let reply;
      const tasks = [];
      listeners.message({
        data,
        ports: [{ postMessage: (payload) => { reply = payload; } }],
        waitUntil: (p) => tasks.push(Promise.resolve(p)),
      });
      await Promise.all(tasks);
      return reply;
    },
  };
}

test('Phase 1: canonical you-ge-sw.js ships kit 1.2.0 and excludes both worker entrypoints from caching', async () => {
  assert.equal(existsSync(resolve(root, 'you-ge-sw.js')), true, 'you-ge-sw.js must exist as canonical worker');
  const source = read('you-ge-sw.js');
  assert.match(source, /const VERSION = '1\.2\.0'/);

  const sw = bootCustomWorker({ scriptName: 'you-ge-sw.js', scope: 'https://app.test/' });
  await sw.install();
  await sw.activate();

  assert.deepEqual(sw.caches.names(), [
    'you-ge-assistant:app.test:%2F:static:v1.2.0',
    'you-ge-assistant:app.test:%2F:pages:v1.2.0',
  ]);
  assert.equal(await sw.request('you-ge-sw.js'), null, 'canonical worker script is never intercepted/cached');
  assert.equal(await sw.request('progressier.js'), null, 'legacy worker shim is never intercepted/cached');
  assert.equal(await sw.request('pwa.js'), null, 'pwa.js client script is never intercepted/cached');
});

test('Phase 1: progressier.js acts as a subpath-safe importScripts shim to canonical you-ge-sw.js', async () => {
  const shimSource = read('progressier.js');
  assert.match(shimSource, /importScripts\(/, 'progressier.js delegates via importScripts');
  assert.match(shimSource, /you-ge-sw\.js/, 'progressier.js loads canonical you-ge-sw.js');

  const sw = bootCustomWorker({ scriptName: 'progressier.js', scope: 'https://app.test/portal/' });
  await sw.install();
  await sw.activate();

  assert.deepEqual(sw.caches.names(), [
    'you-ge-assistant:app.test:%2Fportal%2F:static:v1.2.0',
    'you-ge-assistant:app.test:%2Fportal%2F:pages:v1.2.0',
  ]);
  assert.equal(await sw.request('progressier.js'), null);
  assert.equal(await sw.request('you-ge-sw.js'), null);
});

test('Phase 1: worker migrates legacy IndexedDB stores idempotently while keeping legacy data intact for rollback', async () => {
  const indexedDB = createFakeIndexedDB({
    progressierSavedPushNotifications: {
      progressierSavedPushNotifications: [
        { id: 'n-old-1', title: 'Legacy 1', body: 'From 1.1.1', timestamp: 1000, read: false, wasClicked: null },
        { id: 'n-old-2', title: 'Legacy 2', body: 'Clicked in 1.1.1', timestamp: 2000, read: true, wasClicked: '2026-11-01T00:00:00.000Z' },
      ],
    },
    progressiersharedfiles: {
      progressiersharedfiles: [
        { id: 'share-inflight', title: 'Shared Doc', url: 'https://app.test/doc', text: 'hello', createdAt: 1500 },
      ],
    },
    pwakit: {
      meta: [
        { id: 'unread', count: 4 },
        { id: 'config', value: { pushEndpoint: '/api/push', applicationServerKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' } },
      ],
    },
  });

  const sw = bootCustomWorker({ scriptName: 'you-ge-sw.js', indexedDB });
  await sw.install();
  await sw.activate();

  // Badge count & notifications migrated to canonical you-ge-* DBs
  const badgeReply = await sw.message({ type: 'GET_BADGE' });
  assert.equal(badgeReply.count, 4, 'unread badge count migrated from pwakit -> you-ge-pwa-meta');

  const notifReply = await sw.message({ type: 'GET_NOTIFICATIONS' });
  assert.equal(notifReply.notifications.length, 2);
  assert.equal(notifReply.notifications[0].id, 'n-old-2');
  assert.equal(notifReply.notifications[1].id, 'n-old-1');

  // Shared file migrated to canonical you-ge-shared-files
  const migratedShares = indexedDB.dump('you-ge-shared-files', 'shared-files');
  assert.equal(migratedShares.length, 1);
  assert.equal(migratedShares[0].id, 'share-inflight');

  // Mark notifications read in canonical DB; re-activating must NOT revert read=true from legacy DB
  await sw.message({ type: 'MARK_NOTIFICATIONS_READ' });
  await sw.activate();
  const afterReactivate = await sw.message({ type: 'GET_NOTIFICATIONS' });
  assert.equal(afterReactivate.notifications.every((item) => item.read === true), true, 'canonical read state is not overwritten by legacy record');

  // Rollback guarantee: legacy DBs still hold original records untouched
  const legacyNotifs = indexedDB.dump('progressierSavedPushNotifications', 'progressierSavedPushNotifications');
  assert.equal(legacyNotifs.length, 2);
  assert.equal(legacyNotifs.find((item) => item.id === 'n-old-1').read, false, 'legacy store preserved untouched for rollback');
  assert.equal(indexedDB.dump('progressiersharedfiles', 'progressiersharedfiles').length, 1);
  assert.equal(indexedDB.dump('pwakit', 'meta').length, 2);

  // Fresh install on clean IndexedDB does not create legacy Progressier DBs
  const cleanIdb = createFakeIndexedDB();
  const freshSw = bootCustomWorker({ scriptName: 'you-ge-sw.js', indexedDB: cleanIdb });
  await freshSw.install();
  await freshSw.activate();
  await freshSw.push({ title: 'Canonical Push', body: 'Stored in canonical DB', unread: 2 });
  assert.equal(cleanIdb.hasDatabase('you-ge-notifications'), true);
  assert.equal(cleanIdb.hasDatabase('progressierSavedPushNotifications'), false, 'clean install never creates legacy notification DB');
  assert.equal(cleanIdb.hasDatabase('progressiersharedfiles'), false, 'clean install never creates legacy share DB');

  // Canonical YOUGE_CONFIG message is accepted alongside PWA_CONFIG
  const cfgReply = await freshSw.message({ type: 'YOUGE_CONFIG', config: { pushEndpoint: '/push-v2' } });
  assert.equal(cfgReply.ok, true);
  assert.equal(
    cleanIdb.dump('you-ge-pwa-meta', 'meta').find((entry) => entry.id === 'config').value.pushEndpoint,
    '/push-v2',
  );
});

test('Phase 1: precache integrity gate passes with kit 1.2.0 across you-ge-sw.js, pwa.js, package.json, and SDK constants', async () => {
  const verdict = await runPrecacheIntegrity({ root });
  assert.equal(verdict.status, 'pass', verdict.report);
  assert.match(verdict.summary, /kit version 1\.1\.1 → 1\.2\.0 synchronized/);
});
