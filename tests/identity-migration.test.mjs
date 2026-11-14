import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { createCacheStorage, createNetwork } from './support/service-worker-harness.mjs';
import { runPrecacheIntegrity } from '../scripts/precache-integrity.mjs';
import { createAssistant } from '../packages/assistant-sdk/src/index.js';
import { readToolkitSummary } from '../packages/assistant-sdk/src/adapters/pwa-kit.js';

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
  let skipWaitingCount = 0;
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
    skipWaiting: () => {
      skipWaitingCount += 1;
      return Promise.resolve();
    },
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
    network,
    getBadge: () => badgeCount,
    getSkipWaitingCount: () => skipWaitingCount,
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

test('Phase 1: progressier.js acts as a subpath-safe importScripts shim to canonical you-ge-sw.js with update and offline parity', async () => {
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

  // Update check: SKIP_WAITING message triggers skipWaiting() through the shim
  await sw.message({ type: 'SKIP_WAITING' });
  assert.equal(sw.getSkipWaitingCount(), 1, 'SKIP_WAITING triggers skipWaiting through progressier.js shim');

  // Offline navigation under subpath serves precached /portal/offline.html
  sw.network.offline = true;
  const navReq = new Request('https://app.test/portal/orders', { headers: { accept: 'text/html' } });
  Object.defineProperty(navReq, 'mode', { value: 'navigate' });
  const offlineRes = await sw.request(navReq);
  assert.ok(offlineRes, 'offline navigation returns precached fallback response');
  assert.equal(await offlineRes.text(), '/portal/offline.html@r1');
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

/* ------------------------------------------------------------------ *
 * Phase 2 — Client runtime, SDK bridge, SW cutover, storage, URLs & manifests
 * ------------------------------------------------------------------ */

function createCookieJar(initialCookies = {}) {
  const store = new Map(Object.entries(initialCookies));
  return {
    get() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set(raw) {
      const firstPair = String(raw || '').split(';')[0] || '';
      const eq = firstPair.indexOf('=');
      if (eq === -1) return;
      const key = firstPair.slice(0, eq).trim();
      const val = firstPair.slice(eq + 1).trim();
      store.set(key, val);
    },
    map: store,
  };
}

class DomNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this._classSet = new Set();
    this._className = '';
    this.style = {
      props: new Map(),
      setProperty(k, v) { this.props.set(k, String(v)); },
      getPropertyValue(k) { return this.props.get(k) || ''; },
      removeProperty(k) { this.props.delete(k); },
    };
    this.listeners = new Map();
    this.textContent = '';
    this.innerHTML = '';
    this.hidden = false;
    this.shadow = null;
  }

  get isConnected() {
    let cur = this;
    while (cur.parentNode) cur = cur.parentNode;
    return cur.tagName === 'HTML' || Boolean(this.parentNode);
  }

  get className() { return this._className; }
  set className(val) {
    this._className = String(val || '');
    this._classSet = new Set(this._className.split(/\s+/).filter(Boolean));
  }

  get classList() {
    const sync = () => { this._className = [...this._classSet].join(' '); };
    return {
      add: (...names) => { names.forEach((n) => n && this._classSet.add(n)); sync(); },
      remove: (...names) => { names.forEach((n) => this._classSet.delete(n)); sync(); },
      contains: (n) => this._classSet.has(n),
      toggle: (n, force) => {
        const next = force === undefined ? !this._classSet.has(n) : Boolean(force);
        if (next) this._classSet.add(n);
        else this._classSet.delete(n);
        sync();
        return next;
      },
    };
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  hasAttribute(k) { return this.attributes.has(k); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; return child; }
  attachShadow() { this.shadow = new DomNode('shadow-root'); return this.shadow; }
  addEventListener(type, fn) {
    const arr = this.listeners.get(type) || [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== fn));
  }
  click() {
    for (const fn of this.listeners.get('click') || []) {
      fn({ target: this, preventDefault() {}, stopPropagation() {} });
    }
  }
  matches(selector) {
    return String(selector || '')
      .split(',')
      .some((part) => {
        const s = part.trim();
        if (!s) return false;
        if (s.startsWith('.')) {
          const [cls, pseudo] = s.slice(1).split(':not(');
          if (!this._classSet.has(cls)) return false;
          if (pseudo && pseudo.startsWith('.')) {
            const excluded = pseudo.replace(/\)$/, '').slice(1);
            if (this._classSet.has(excluded)) return false;
          }
          return true;
        }
        const attr = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(s);
        if (attr) {
          if (!this.hasAttribute(attr[1])) return false;
          return attr[2] === undefined ? true : this.getAttribute(attr[1]) === attr[2];
        }
        return this.tagName.toLowerCase() === s.toLowerCase();
      });
  }
  closest(selector) {
    let cur = this;
    while (cur) {
      if (cur.matches && cur.matches(selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  querySelectorAll(selector) {
    const out = [];
    const walk = (n) => {
      for (const child of n.children || []) {
        if (child.matches(selector)) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function bootPwaClient({
  href = 'https://example.test/',
  scriptSrc = null,
  dataset = {},
  cookies = {},
  localStorageSeed = {},
  indexedDB = createFakeIndexedDB(),
  getRegistration = undefined,
  notificationPermission = 'default',
  readyState = 'loading',
} = {}) {
  const url = new URL(href);
  const jar = createCookieJar(cookies);
  const storageMap = new Map(Object.entries(localStorageSeed));
  const docEvents = [];
  const docListeners = new Map();
  const winListeners = new Map();
  const registerCalls = [];
  let replacedHref = null;
  let historyStateUrl = null;
  const timers = [];

  const head = new DomNode('head');
  const body = new DomNode('body');
  const documentElement = new DomNode('html');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const script = new DomNode('script');
  script.src = scriptSrc || new URL('pwa.js', url.origin + '/').href;
  script.dataset = { ...dataset };

  const doc = {
    currentScript: script,
    head,
    body,
    documentElement,
    readyState,
    visibilityState: 'visible',
    referrer: '',
    createElement: (tag) => new DomNode(tag),
    createDocumentFragment: () => new DomNode('fragment'),
    querySelector: (sel) => documentElement.querySelector(sel),
    querySelectorAll: (sel) => documentElement.querySelectorAll(sel),
    addEventListener(type, fn) {
      const list = docListeners.get(type) || [];
      list.push(fn);
      docListeners.set(type, list);
    },
    removeEventListener(type, fn) {
      docListeners.set(type, (docListeners.get(type) || []).filter((f) => f !== fn));
    },
    dispatchEvent(event) {
      docEvents.push(event);
      for (const fn of docListeners.get(event.type) || []) fn(event);
      return true;
    },
  };
  Object.defineProperty(doc, 'cookie', {
    get: () => jar.get(),
    set: (val) => jar.set(val),
  });

  const swRegistration = {
    scope: url.origin + '/',
    installing: null,
    waiting: null,
    active: {},
    addEventListener() {},
    pushManager: { getSubscription: async () => null },
  };
  const serviceWorker = {
    controller: null,
    ready: Promise.resolve(swRegistration),
    register(swUrl, opts) {
      registerCalls.push({ swUrl, opts });
      return Promise.resolve(swRegistration);
    },
    addEventListener() {},
  };
  if (getRegistration !== undefined) {
    serviceWorker.getRegistration = getRegistration;
  }

  class CustomEventPolyfill {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  const location = {
    href: url.href,
    origin: url.origin,
    protocol: url.protocol,
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    replace(next) { replacedHref = next; },
    reload() {},
  };

  const sandbox = {
    URL, URLSearchParams, Promise, Uint8Array, ArrayBuffer, Blob, File,
    CustomEvent: CustomEventPolyfill,
    atob, btoa, encodeURIComponent, decodeURIComponent, console, queueMicrotask,
    indexedDB,
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
      removeItem: (k) => storageMap.delete(k),
    },
    Notification: {
      permission: notificationPermission,
      requestPermission: async () => notificationPermission,
    },
    PushManager: function PushManager() {},
    document: doc,
    navigator: {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0.0.0 Safari/537.36',
      language: 'en-US',
      onLine: true,
      serviceWorker,
    },
    location,
    history: {
      replaceState(_state, _title, nextUrl) {
        historyStateUrl = nextUrl;
        const resolved = new URL(nextUrl, url.origin);
        location.href = resolved.href;
        location.pathname = resolved.pathname;
        location.search = resolved.search;
        location.hash = resolved.hash;
      },
    },
    screen: { width: 1280, height: 800 },
    isSecureContext: true,
    getComputedStyle: (el) => ({
      getPropertyValue: (prop) => el.style.getPropertyValue(prop),
    }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout() {},
    requestAnimationFrame(fn) {
      timers.push({ fn, ms: 16 });
      return timers.length;
    },
    cancelAnimationFrame() {},
    setInterval: () => 1,
    clearInterval() {},
    addEventListener(type, fn) {
      const list = winListeners.get(type) || [];
      list.push(fn);
      winListeners.set(type, list);
    },
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(read('pwa.js'), context, { filename: 'pwa.js' });

  return {
    win: sandbox,
    doc,
    body,
    jar,
    storageMap,
    docEvents,
    registerCalls,
    timers,
    getReplacedHref: () => replacedHref,
    getHistoryStateUrl: () => historyStateUrl,
    fireWindowLoad() {
      for (const fn of winListeners.get('load') || []) fn();
    },
    flushTimers() {
      const copy = timers.splice(0, timers.length);
      for (const item of copy) item.fn();
    },
  };
}

test('Phase 2: pwa.js exposes canonical window.YouGePWA alongside window.PWA and binds cleanly in @youge/assistant-sdk', () => {
  const client = bootPwaClient();
  assert.ok(client.win.YouGePWA, 'window.YouGePWA is defined as canonical global');
  assert.equal(client.win.YouGePWA.__youGePwaKit, true);
  assert.equal(client.win.YouGePWA, client.win.PWA, 'window.PWA aliases window.YouGePWA');
  assert.ok(client.win.progressier, 'legacy window.progressier migration shim remains available');

  // SDK binds cleanly when ONLY window.YouGePWA is present (no window.PWA)
  const youGeOnlyRoot = {
    YouGePWA: {
      __youGePwaKit: true,
      version: '1.2.0',
      getState: () => ({ standalone: false, installed: false, canInstall: true, hasUpdate: false }),
      onChange: () => () => {},
    },
    location: { href: 'https://app.you.ge/', origin: 'https://app.you.ge', hostname: 'app.you.ge', protocol: 'https:', pathname: '/' },
  };
  const summary = readToolkitSummary(youGeOnlyRoot);
  assert.equal(summary.hasPwaToolkit, true, 'readToolkitSummary recognizes window.YouGePWA');
  assert.equal(summary.pwaVersion, '1.2.0');

  const assistant = createAssistant({ projectId: 'youge-only' }, { root: youGeOnlyRoot, bindEvents: false });
  assert.equal(assistant.getState().installation.canInstall, true, 'SDK reads install capability from window.YouGePWA');
  assistant.destroy();
});

test('Phase 2: SW registration uses clean canonical cutover to you-ge-sw.js (root and subpath) while keeping explicit data-sw="/progressier.js" compatibility', async () => {
  const pwaSource = read('pwa.js');
  assert.doesNotMatch(pwaSource, /legacy-preserved|swMigrationMode|isLegacyWorkerScriptUrl/, 'pwa.js contains no automatic legacy-worker preservation logic');

  // 1. Fresh/default install -> registers canonical you-ge-sw.js directly without getRegistration lookup
  let getRegistrationCalled = false;
  const fresh = bootPwaClient({
    getRegistration: async () => {
      getRegistrationCalled = true;
      return undefined;
    },
  });
  await fresh.win.YouGePWA.register();
  assert.equal(getRegistrationCalled, false, 'default registration does not probe getRegistration to preserve legacy workers');
  assert.equal(fresh.registerCalls.length, 1);
  assert.equal(fresh.registerCalls[0].swUrl, 'https://example.test/you-ge-sw.js');
  assert.equal(fresh.registerCalls[0].opts.scope, '/');
  assert.equal('swMigrationMode' in fresh.win.YouGePWA.config, false);

  // 2. Clean canonical cutover: even if a prior /progressier.js worker exists on scope, omitted data-sw registers /you-ge-sw.js
  const cutover = bootPwaClient({
    getRegistration: async () => ({
      scope: 'https://example.test/',
      active: { scriptURL: 'https://example.test/progressier.js', state: 'activated' },
    }),
  });
  await cutover.win.YouGePWA.register();
  assert.equal(cutover.registerCalls.length, 1);
  assert.equal(cutover.registerCalls[0].swUrl, 'https://example.test/you-ge-sw.js', 'default registration always uses canonical you-ge-sw.js');

  // 3. Subpath deployment -> resolves you-ge-sw.js and scope relative to pwa.js directory
  const subpath = bootPwaClient({
    href: 'https://example.test/portal/dashboard',
    scriptSrc: 'https://example.test/portal/pwa.js',
  });
  await subpath.win.YouGePWA.register();
  assert.equal(subpath.registerCalls.length, 1);
  assert.equal(subpath.registerCalls[0].swUrl, 'https://example.test/portal/you-ge-sw.js');
  assert.equal(subpath.registerCalls[0].opts.scope, '/portal/');

  // 4. Explicit data-sw="/progressier.js" (and subpath data-sw="progressier.js") still registers the compatibility shim
  const explicitLegacy = bootPwaClient({
    dataset: { sw: '/progressier.js' },
  });
  await explicitLegacy.win.YouGePWA.register();
  assert.equal(explicitLegacy.registerCalls.length, 1);
  assert.equal(explicitLegacy.registerCalls[0].swUrl, 'https://example.test/progressier.js');

  const subpathLegacy = bootPwaClient({
    href: 'https://example.test/portal/',
    scriptSrc: 'https://example.test/portal/pwa.js',
    dataset: { sw: 'progressier.js' },
  });
  await subpathLegacy.win.YouGePWA.register();
  assert.equal(subpathLegacy.registerCalls.length, 1);
  assert.equal(subpathLegacy.registerCalls[0].swUrl, 'https://example.test/portal/progressier.js');
  assert.equal(subpathLegacy.registerCalls[0].opts.scope, '/portal/');
});

test('Phase 2: banner cookies and welcome localStorage migrate legacy dismissals and mirror writes for rollback safety', () => {
  const recentIso = encodeURIComponent(new Date().toISOString());

  // Existing legacy install-banner cookie suppresses banner and promotes to canonical cookie
  const migrated = bootPwaClient({
    cookies: {
      'progressierinstallbannerexample.test/': recentIso,
    },
    dataset: { welcome: '' },
    localStorageSeed: { 'pwakit:welcome': '1' },
  });
  assert.equal(migrated.win.YouGePWA.showInstallBanner({}), null, 'legacy cookie dismissal honored');
  assert.equal(migrated.jar.map.has('youge_install_banner_example.test/'), true, 'legacy cookie promoted to canonical cookie');

  migrated.fireWindowLoad();
  migrated.flushTimers();
  assert.equal(migrated.storageMap.get('youge-pwa:welcome'), '1', 'legacy pwakit:welcome promoted to youge-pwa:welcome');
  assert.equal(migrated.body.querySelector('.pwa-flow'), null, 'welcome dialog suppressed after legacy migration');

  // Fresh dismissal writes canonical cookie AND mirrors legacy cookie for safe rollback to 1.1.1
  const fresh = bootPwaClient({ notificationPermission: 'default' });
  const installBanner = fresh.win.YouGePWA.showInstallBanner({});
  assert.ok(installBanner, 'install banner shown when undismissed');
  const buttons = installBanner.querySelectorAll('button');
  buttons[1].click(); // "Not now"
  assert.equal(fresh.jar.map.has('youge_install_banner_example.test/'), true, 'canonical install cookie written');
  assert.equal(fresh.jar.map.has('progressierinstallbannerexample.test/'), true, 'legacy install cookie mirrored for rollback');

  const pushBanner = fresh.win.YouGePWA.showPushBanner({});
  assert.ok(pushBanner, 'push banner shown when undismissed');
  pushBanner.querySelectorAll('button')[0].click(); // "Not now"
  assert.equal(fresh.jar.map.has('youge_push_banner_example.test/'), true, 'canonical push cookie written');
  assert.equal(fresh.jar.map.has('progressierpushbannerexample.test/'), true, 'legacy push cookie mirrored for rollback');
});

test('Phase 2: pwa.js consumeSharedFile reads canonical you-ge-shared-files first and falls back to legacy progressiersharedfiles', async () => {
  // 1. Canonical DB hit
  const canonicalIdb = createFakeIndexedDB({
    'you-ge-shared-files': {
      'shared-files': [
        { id: 'canon-1', title: 'Canonical Share', url: 'https://example.test/a', text: 'canon' },
      ],
    },
  });
  const c1 = bootPwaClient({
    href: 'https://example.test/?launchedfrom=share&fileid=canon-1',
    indexedDB: canonicalIdb,
    readyState: 'complete',
  });
  c1.flushTimers();
  const sharedCanon = await c1.win.YouGePWA.consumeSharedFile();
  assert.equal(sharedCanon.title, 'Canonical Share');
  assert.equal(canonicalIdb.dump('you-ge-shared-files', 'shared-files').length, 0, 'consumed record removed');

  // 2. Legacy in-flight DB fallback (share written by 1.1.1 worker right before client upgraded)
  const legacyIdb = createFakeIndexedDB({
    progressiersharedfiles: {
      progressiersharedfiles: [
        { id: 'leg-1', title: 'In-flight Legacy Share', url: 'https://example.test/b', text: 'legacy' },
      ],
    },
  });
  const c2 = bootPwaClient({
    href: 'https://example.test/?launchedfrom=share&fileid=leg-1',
    indexedDB: legacyIdb,
    readyState: 'complete',
  });
  c2.flushTimers();
  const sharedLegacy = await c2.win.YouGePWA.consumeSharedFile();
  assert.equal(sharedLegacy.title, 'In-flight Legacy Share');
  assert.equal(legacyIdb.dump('progressiersharedfiles', 'progressiersharedfiles').length, 0, 'consumed legacy record removed');
});

test('Phase 2: canonical events, query parameters, declarative attributes, and manifest IDs/protocols work alongside legacy aliases', () => {
  // 1. Canonical youge:pwa:ready emitted alongside pwa:ready without duplicate SDK triggers
  const client = bootPwaClient();
  const eventTypes = client.docEvents.map((e) => e.type);
  assert.ok(eventTypes.includes('youge:pwa:ready'), 'canonical youge:pwa:ready dispatched');
  assert.ok(eventTypes.includes('pwa:ready'), 'legacy pwa:ready dispatched');

  const assistant = createAssistant({ projectId: 'dedup-check' }, {
    root: client.win,
    document: client.doc,
  });
  let emissions = 0;
  assistant.subscribe(() => { emissions += 1; });
  emissions = 0;
  const canonUpdate = new client.win.CustomEvent('youge:pwa:update', { detail: {} });
  const bridgedLegacyUpdate = new client.win.CustomEvent('pwa:update', { detail: {} });
  bridgedLegacyUpdate.__youGeBridged = true;
  client.doc.dispatchEvent(canonUpdate);
  client.doc.dispatchEvent(bridgedLegacyUpdate);
  assert.equal(emissions, 1, 'bridged legacy pwa:update does not double-emit after canonical youge:pwa:update');
  assistant.destroy();

  // 2. Canonical ?youge-install=1 QR parameter + legacy ?pswutlzoq=install support
  const canonQr = bootPwaClient({ href: 'https://example.test/?youge-install=1' });
  canonQr.flushTimers();
  assert.ok(canonQr.body.querySelector('.pwa-flow'), '?youge-install=1 opens install request flow');
  assert.equal(canonQr.getHistoryStateUrl(), '/', '?youge-install=1 cleaned from URL after opening');
  assert.equal(canonQr.win.YouGePWA.getInstallUrl('https://example.test/'), 'https://example.test/?youge-install=1');

  const legacyQr = bootPwaClient({ href: 'https://example.test/?pswutlzoq=install' });
  legacyQr.flushTimers();
  assert.ok(legacyQr.body.querySelector('.pwa-flow'), 'legacy ?pswutlzoq=install still opens install request flow');
  assert.equal(legacyQr.getHistoryStateUrl(), '/', 'legacy ?pswutlzoq=install cleaned from URL after opening');

  // 3. Canonical ?youge-protocol-redirect and ?youge-redirect alongside legacy params
  const protoClient = bootPwaClient({
    href: 'https://example.test/?launchedfrom=homescreen&youge-protocol-redirect=%2Ftasks%2F42',
  });
  assert.equal(protoClient.getReplacedHref(), 'https://example.test/tasks/42');

  const b64 = btoa('https://example.test/inbox').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const redirectClient = bootPwaClient({
    href: `https://example.test/?youge-redirect=${b64}`,
  });
  assert.equal(redirectClient.getReplacedHref(), 'https://example.test/inbox');

  // 4. Generic fallback manifest.webmanifest vs staff.you.ge registry manifest id
  const fallbackManifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(fallbackManifest.id, '/', 'generic root fallback manifest uses canonical "/" id');
  const protocols = (fallbackManifest.protocol_handlers || []).map((p) => p.protocol);
  assert.ok(protocols.includes('web+youge'), 'canonical web+youge protocol handler declared');
  assert.ok(protocols.includes('web+pwa'), 'web+pwa protocol handler declared');
  assert.ok(protocols.includes('web+loldwyhv'), 'legacy web+loldwyhv handler retained during compatibility window');

  const registrySource = read('domain-registry.js');
  assert.match(registrySource, /'staff\.you\.ge'[\s\S]*id:\s*'\/HIPSBNVemXtM8VMwRfWs'/, 'staff.you.ge preserves its installed app id');
});

/* ------------------------------------------------------------------ *
 * Phase 3: CSS custom properties, selectors, examples, CI & scripts
 * ------------------------------------------------------------------ */

test('Phase 3: pwa.css defines canonical --youge-pwa-* custom properties with --progressier* fallback and canonical .youge-* selectors', () => {
  const css = read('pwa.css');
  const expectedVars = [
    ['--youge-pwa-bg', '--progressierBg'],
    ['--youge-pwa-text', '--progressierTxt'],
    ['--youge-pwa-font', '--progressierFont'],
    ['--youge-pwa-text-weight', '--progressierTextFontWeight'],
    ['--youge-pwa-btn-weight', '--progressierBtnFontWeight'],
    ['--youge-pwa-heading-weight', '--progressierHeadingFontWeight'],
    ['--youge-pwa-letter-spacing', '--progressierLetterSpacing'],
    ['--youge-pwa-hover', '--progressierHover'],
    ['--youge-pwa-element', '--progressierElement'],
    ['--youge-pwa-border', '--progressierBorderColor'],
    ['--youge-pwa-shadow', '--progressierBoxShadow'],
    ['--youge-pwa-accent', '--progressierAccent'],
    ['--youge-pwa-accent-text', '--progressierAccentText'],
    ['--youge-pwa-focus', '--progressierFocus'],
    ['--youge-pwa-note', '--progressierNote'],
  ];
  for (const [canon, legacy] of expectedVars) {
    assert.ok(
      css.includes(`${canon}: var(${legacy},`),
      `pwa.css defines ${canon} with fallback to ${legacy}`,
    );
  }

  for (const selector of [
    '.youge-install-button',
    '.youge-subscribe-button',
    '.youge-install-banner',
    '.youge-push-banner',
    '.youge-offline-alert',
    '.youge-prompt-overlay',
    '.youge-prompt-reload-button',
    '.youge-qr',
    '.youge-toolbox',
    '.youge-pos-left',
    '.youge-pos-right',
    '.youge-pos-center',
    '.youge-pos-top',
    '.youge-pos-middle',
    'data-youge-pwa-forced-theme="light"',
  ]) {
    assert.ok(css.includes(selector), `pwa.css includes canonical selector ${selector}`);
  }
});

test('Phase 3: pwa.js applyTheme, buttons, banners, alerts, reload prompt, and toolbox emit canonical .youge-* classes and --youge-pwa-* tokens', () => {
  const client = bootPwaClient({ notificationPermission: 'default' });
  const canonBtn = client.doc.createElement('button');
  canonBtn.className = 'youge-install-button';
  canonBtn.setAttribute('data-install', 'Install Workspace');
  client.body.appendChild(canonBtn);

  client.win.YouGePWA.scanButtons();
  assert.equal(canonBtn.classList.contains('captured'), true, 'canonical .youge-install-button captured by scanButtons');
  assert.match(canonBtn.innerHTML, /Install Workspace/);

  client.win.YouGePWA.applyTheme({
    background: '#101828',
    text: '#f8fafc',
    accent: '#155eef',
    accentText: '#ffffff',
    focus: '#2563eb',
    note: '#475467',
  });
  const rootStyle = client.doc.documentElement.style;
  assert.equal(rootStyle.getPropertyValue('--youge-pwa-bg'), '#101828');
  assert.equal(rootStyle.getPropertyValue('--progressierBg'), '#101828');
  assert.equal(rootStyle.getPropertyValue('--youge-pwa-accent'), '#155eef');
  assert.equal(rootStyle.getPropertyValue('--progressierAccent'), '#155eef');
  assert.equal(rootStyle.getPropertyValue('--youge-pwa-focus'), '#2563eb');
  assert.equal(rootStyle.getPropertyValue('--youge-pwa-note'), '#475467');

  const installBanner = client.win.YouGePWA.showInstallBanner({ preview: true, color: '#0f766e', btnColor: '#ffffff' });
  assert.equal(installBanner.classList.contains('youge-install-banner'), true);
  assert.equal(installBanner.classList.contains('progressier-install-banner'), true);
  assert.equal(installBanner.style.getPropertyValue('--youge-pwa-accent'), '#0f766e');
  assert.equal(installBanner.style.getPropertyValue('--progressierAccent'), '#0f766e');

  const pushBanner = client.win.YouGePWA.showPushBanner({ preview: true, color: '#1d4ed8', btnColor: '#ffffff' });
  assert.equal(pushBanner.classList.contains('youge-push-banner'), true);
  assert.equal(pushBanner.classList.contains('progressier-push-banner'), true);
  assert.equal(pushBanner.style.getPropertyValue('--youge-pwa-accent'), '#1d4ed8');

  const offlineAlert = client.win.YouGePWA.showOfflineAlert({});
  assert.equal(offlineAlert.classList.contains('youge-offline-alert'), true);
  assert.equal(offlineAlert.classList.contains('progressier-offline-alert'), true);

  const reloadPrompt = client.win.YouGePWA.showReloadPrompt();
  assert.equal(reloadPrompt.classList.contains('youge-prompt-overlay'), true);
  assert.equal(reloadPrompt.classList.contains('progressier-prompt-overlay'), true);

  client.win.YouGePWA.enableToolbox({ position: 'bottom-left' });
  client.win.YouGePWA.showToolbox();
  const toolbox = client.body.querySelector('.youge-toolbox');
  assert.ok(toolbox, 'floating toolbox carries canonical .youge-toolbox class');
  assert.equal(toolbox.classList.contains('youge-pos-left'), true);
  assert.equal(toolbox.classList.contains('progressier-left'), true);
});

test('Phase 3: demo, example, snippet, Vite config, CI workflows, and verification scripts adopt canonical you-ge-sw.js and .youge-install-button', () => {
  assert.match(read('demo/index.html'), /class="youge-install-button"/);
  assert.match(read('example/index.html'), /class="youge-install-button install-button"/);
  assert.match(read('example/example.css'), /\.youge-install-button\.install-button/);
  assert.match(read('snippet.html'), /data-sw="\/you-ge-sw\.js"/);
  assert.match(read('example/vite.config.js'), /'you-ge-sw\.js'/);
  assert.match(read('.github/workflows/pages.yml'), /you-ge-sw\.js/);
  assert.match(read('.github/workflows/check.yml'), /you-ge-sw\.js/);
  assert.match(read('scripts/check.mjs'), /'you-ge-sw\.js'/);
  assert.match(read('scripts/verify-deployment.mjs'), /\/you-ge-sw\.js/);
});

/* ------------------------------------------------------------------ *
 * Phase 4: Governance, compatibility window & removal policy docs
 * ------------------------------------------------------------------ */

test('Phase 4: COMPATIBILITY_CONTRACTS.md and AGENTS.md establish canonical You.Ge Assistant identifiers and a concrete legacy removal policy', () => {
  const contracts = read('COMPATIBILITY_CONTRACTS.md');
  for (const token of [
    'you-ge-sw.js',
    'window.YouGePWA',
    '--youge-pwa-',
    '.youge-install-button',
    'you-ge-shared-files',
    'you-ge-notifications',
    'you-ge-pwa-meta',
    'youge_install_banner_',
    'youge:pwa:',
    'web+youge',
    'Compatibility Period',
    'Removal Policy',
    '2027-11-14',
    '2.0.0',
  ]) {
    assert.ok(contracts.includes(token), `COMPATIBILITY_CONTRACTS.md documents ${token}`);
  }

  const agents = read('AGENTS.md');
  assert.match(agents, /Current runtime version:\s*\*\*1\.2\.0\*\*/);
  assert.match(agents, /you-ge-sw\.js/);
  assert.match(agents, /window\.YouGePWA/);
  assert.match(agents, /temporary migration compatibility only/i);
});