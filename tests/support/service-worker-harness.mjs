// Deterministic Node harness for the You.Ge Assistant service worker
// (`progressier.js`). It evaluates the real worker source in a VM context with
// in-memory Cache Storage, a scripted network and the service-worker lifecycle
// events, so install / activate / fetch / message behaviour can be observed at
// the worker's public seam: the events it handles and the caches it leaves.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

export const workerSource = read('progressier.js');
export const workerVersion = /const VERSION = '([^']+)'/.exec(workerSource)[1];

/** The same worker code published under another kit version. */
export function workerSourceAt(version) {
  const next = workerSource.replace(/const VERSION = '[^']+'/, `const VERSION = '${version}'`);
  if (version !== workerVersion && next === workerSource) throw new Error('VERSION constant not found');
  return next;
}

/** Scope-relative assets the worker is documented to precache (AGENTS.md §12). */
export const PRECACHED = [
  'offline.html', 'offline.js', 'offline.css',
  'domain-config.js', 'domain-registry.js', 'dns-diagnostics.js',
  'assistant-state.js', 'assistant-widget.js', 'assistant-widget.css',
  'pwa.css', 'qrcode.js', 'icons/icon-192.png', 'icons/icon-512.png',
];

/** In-memory Cache Storage shared by every worker generation of one origin. */
export function createCacheStorage({ fetch = () => Promise.reject(new TypeError('no network')) } = {}) {
  const stores = new Map();
  const storage = {};
  const keyOf = (request) => (typeof request === 'string' ? request : request.url);
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async match(request) {
        const hit = entries.get(keyOf(request));
        return hit ? hit.response.clone() : undefined;
      },
      async put(request, response) {
        entries.set(keyOf(request), { request, response });
      },
      // Cache.add per the Cache API: fetch, reject on a non-ok response, store.
      async add(request) {
        const response = await storage.fetch(request);
        if (!response.ok) throw new TypeError('Request failed');
        entries.set(keyOf(request), { request, response });
      },
      async keys() {
        return [...entries.values()].map((entry) => entry.request);
      },
      async delete(request) {
        return entries.delete(keyOf(request));
      },
    };
  };
  return Object.assign(storage, {
    fetch,
    open,
    has: async (name) => stores.has(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    async match(request) {
      for (const entries of stores.values()) {
        const hit = entries.get(keyOf(request));
        if (hit) return hit.response.clone();
      }
      return undefined;
    },
    /** Test inspection: `{ url: bodyText }` for one cache, or null when absent. */
    async snapshot(name) {
      if (!stores.has(name)) return null;
      const out = {};
      for (const [url, entry] of stores.get(name)) out[url] = await entry.response.clone().text();
      return out;
    },
    names: () => [...stores.keys()],
  });
}

/**
 * Scripted same-origin network. Every in-scope path answers
 * `<path>@<release>` until a test overrides it with `fail()` or `status()`.
 */
export function createNetwork({ release = 'r1' } = {}) {
  const overrides = new Map();
  const network = {
    release,
    offline: false,
    requests: [],
    fail(path) { overrides.set(path, { error: true }); },
    status(path, status) { overrides.set(path, { status }); },
    restore(path) { overrides.delete(path); },
    async fetch(input) {
      const request = typeof input === 'string' ? new Request(input) : input;
      const url = new URL(request.url);
      network.requests.push({ path: url.pathname, cache: request.cache });
      const override = overrides.get(url.pathname);
      if (network.offline || (override && override.error)) throw new TypeError('Failed to fetch');
      // Same-origin network responses are `basic`; the worker only caches those.
      const sameOrigin = (response) => Object.defineProperty(response, 'type', { value: 'basic' });
      if (override) return sameOrigin(new Response(`status ${override.status}`, { status: override.status }));
      return sameOrigin(new Response(`${url.pathname}@${network.release}`, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }));
    },
  };
  return network;
}

/** Evaluate one worker generation against shared caches and a network. */
export function bootWorker({ caches, network, source = workerSource, scope = 'https://app.test/' } = {}) {
  const listeners = {};
  const calls = { skipWaiting: 0, claim: 0 };
  caches.fetch = (input) => network.fetch(input);
  const sandbox = {
    URL, Request, Response, Headers, AbortController, TypeError, Promise,
    setTimeout, clearTimeout, console, atob,
    crypto: globalThis.crypto,
    navigator: {},
    caches,
    fetch: (input) => network.fetch(input),
    location: new URL('progressier.js', scope),
    registration: { scope },
    clients: {
      claim: async () => { calls.claim += 1; },
      matchAll: async () => [],
    },
    skipWaiting: () => { calls.skipWaiting += 1; return Promise.resolve(); },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    importScripts: (...urls) => {
      for (const url of urls) {
        vm.runInContext(read(new URL(url).pathname.replace(/^\//, '')), context, { filename: url });
      }
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: 'progressier.js' });

  /** Dispatch a lifecycle/message event; resolves or rejects like `waitUntil`. */
  async function dispatch(type, init = {}) {
    const pending = [];
    const event = Object.assign({ waitUntil: (promise) => pending.push(promise) }, init);
    listeners[type](event);
    await Promise.all(pending);
  }

  /** Dispatch a fetch event; resolves with the Response, or null when unhandled. */
  async function request(path, { mode = 'no-cors' } = {}) {
    let response = null;
    const event = {
      request: Object.assign(new Request(new URL(path, scope).href), {}),
      respondWith: (value) => { response = value; },
      waitUntil: () => {},
    };
    if (mode === 'navigate') Object.defineProperty(event.request, 'mode', { value: 'navigate' });
    listeners.fetch(event);
    const settled = await response;
    // Let stale-while-revalidate's background refresh settle before asserting.
    await new Promise((done) => setTimeout(done, 0));
    return settled;
  }

  const host = encodeURIComponent(new URL(scope).hostname);
  const scopeKey = encodeURIComponent(new URL(scope).pathname);
  const version = /const VERSION = '([^']+)'/.exec(source)[1];
  return {
    calls,
    scope,
    version,
    staticCache: `you-ge-assistant:${host}:${scopeKey}:static:v${version}`,
    pageCache: `you-ge-assistant:${host}:${scopeKey}:pages:v${version}`,
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    message: (data) => dispatch('message', { data, ports: [] }),
    request,
  };
}
