// Deterministic Node harness for the You.Ge Assistant service worker
// (`you-ge-sw.js`, plus legacy compatibility entry `progressier.js`). It
// evaluates the real worker source in a VM context with
// in-memory Cache Storage, a scripted network and the service-worker lifecycle
// events, so install / activate / fetch / message behaviour can be observed at
// the worker's public seam: the events it handles and the caches it leaves.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

export const workerSource = read('you-ge-sw.js');
export const legacyWorkerShimSource = read('progressier.js');
export const workerVersion = /const VERSION = '([^']+)'/.exec(workerSource)[1];

/** The same worker code published under another kit version. */
export function workerSourceAt(version) {
  const next = workerSource.replace(/const VERSION = '[^']+'/, `const VERSION = '${version}'`);
  if (version !== workerVersion && next === workerSource) throw new Error('VERSION constant not found');
  return next;
}

/**
 * Scope-relative assets the worker is documented to precache, by policy
 * (PRECACHE_INTEGRITY.md §3). Stated here independently of the worker so the
 * tests fail if the worker's own declaration drifts from the documented one.
 */
export const REQUIRED_PRECACHE = [
  'offline.html', 'offline.js', 'offline.css', 'pwa.css',
  'icons/icon-192.png', 'icons/icon-512.png',
];
export const OPTIONAL_PRECACHE = [
  'domain-config.js', 'domain-registry.js', 'dns-diagnostics.js',
  'assistant-state.js', 'assistant-widget.js', 'assistant-widget.css',
  'qrcode.js',
];
export const PRECACHED = [...REQUIRED_PRECACHE, ...OPTIONAL_PRECACHE];

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
      // Cache.put per the Cache API: the body is read to the end before the
      // entry is committed, so a response whose stream fails is never stored.
      async put(request, response) {
        await response.clone().arrayBuffer();
        if (storage.rejectPut && storage.rejectPut(keyOf(request))) {
          throw new DOMException('Quota exceeded.', 'QuotaExceededError');
        }
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
    /** Test hook: `(url) => boolean`; a matching write fails like a full disk. */
    rejectPut: null,
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

const CONTENT_TYPES = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
};

/**
 * Scripted same-origin network. Every in-scope path answers
 * `<path>@<release>` with the content type of its extension until a test
 * overrides it:
 *   fail(path)        the request rejects (connection lost)
 *   status(path, n)   the server answers HTTP n
 *   hang(path)        the request never settles unless its signal is aborted
 *   truncate(path)    HTTP 200 whose body breaks off mid-stream
 *   htmlFallback(path) HTTP 200 with the host's HTML page instead of the file
 */
export function createNetwork({ release = 'r1' } = {}) {
  const overrides = new Map();
  const network = {
    release,
    offline: false,
    requests: [],
    fail(path) { overrides.set(path, { error: true }); },
    status(path, status) { overrides.set(path, { status }); },
    hang(path) { overrides.set(path, { hang: true }); },
    truncate(path) { overrides.set(path, { truncate: true }); },
    htmlFallback(path) { overrides.set(path, { html: true }); },
    restore(path) { overrides.delete(path); },
    async fetch(input, init) {
      const request = init ? new Request(input, init) : (typeof input === 'string' ? new Request(input) : input);
      const url = new URL(request.url);
      network.requests.push({ path: url.pathname, cache: request.cache, signal: request.signal });
      const override = overrides.get(url.pathname) || {};
      if (network.offline || override.error) throw new TypeError('Failed to fetch');
      if (override.hang) {
        return new Promise((_, reject) => {
          const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
          if (request.signal.aborted) abort();
          else request.signal.addEventListener('abort', abort, { once: true });
        });
      }
      // Same-origin network responses are `basic`; the worker only caches those.
      const sameOrigin = (response) => Object.defineProperty(response, 'type', { value: 'basic' });
      if (override.status) {
        const bodyless = [204, 205, 304].includes(override.status);
        return sameOrigin(new Response(bodyless ? null : `status ${override.status}`, { status: override.status }));
      }
      if (override.html) {
        return sameOrigin(new Response('<!doctype html><title>App</title>', {
          status: 200,
          headers: { 'content-type': CONTENT_TYPES.html },
        }));
      }
      const extension = url.pathname.split('.').pop();
      const headers = { 'content-type': CONTENT_TYPES[extension] || 'application/octet-stream' };
      if (override.truncate) {
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('partial'));
            controller.error(new TypeError('network error'));
          },
        });
        return sameOrigin(new Response(body, { status: 200, headers }));
      }
      return sameOrigin(new Response(`${url.pathname}@${network.release}`, { status: 200, headers }));
    },
  };
  return network;
}

/** Manually advanced timers, so a worker timeout is tested without waiting. */
function createManualTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(callback, delay = 0) {
      const id = nextId++;
      pending.set(id, { at: now + Number(delay), callback });
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    /** Milliseconds until each timer that is still armed. */
    armed: () => [...pending.values()].map((timer) => timer.at - now).sort((a, b) => a - b),
    async advance(ms) {
      now += ms;
      for (const [id, timer] of [...pending]) {
        if (timer.at > now) continue;
        pending.delete(id);
        timer.callback();
      }
      await new Promise((done) => setTimeout(done, 0));
    },
  };
}

/** Evaluate one worker generation against shared caches and a network. */
export function bootWorker({ caches, network, source = workerSource, scope = 'https://app.test/', manualTimers = false } = {}) {
  const listeners = {};
  const calls = { skipWaiting: 0, claim: 0 };
  const timers = manualTimers ? createManualTimers() : null;
  caches.fetch = (input) => network.fetch(input);
  const sandbox = {
    URL, Request, Response, Headers, AbortController, TypeError, Promise,
    setTimeout: timers ? timers.setTimeout : setTimeout,
    clearTimeout: timers ? timers.clearTimeout : clearTimeout,
    console, atob,
    crypto: globalThis.crypto,
    navigator: {},
    caches,
    fetch: (input, init) => network.fetch(input, init),
    location: new URL('you-ge-sw.js', scope),
    registration: { scope },
    clients: {
      claim: async () => { calls.claim += 1; },
      matchAll: async () => [],
    },
    skipWaiting: () => { calls.skipWaiting += 1; return Promise.resolve(); },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    importScripts: (...urls) => {
      const scopePathname = new URL(scope).pathname;
      for (const url of urls) {
        const pathname = new URL(url, scope).pathname;
        const rel = pathname.startsWith(scopePathname)
          ? pathname.slice(scopePathname.length)
          : pathname.replace(/^\//, '');
        vm.runInContext(read(rel), context, { filename: url });
      }
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context, { filename: 'you-ge-sw.js' });

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
    timers,
    install: () => dispatch('install'),
    activate: () => dispatch('activate'),
    message: (data) => dispatch('message', { data, ports: [] }),
    request,
  };
}
