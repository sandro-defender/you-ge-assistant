/*!
 * SDK <-> Toolkit compatibility and integration tests.
 * Verifies that @youge/assistant-sdk works standalone AND seamlessly alongside
 * pwa.js, domain-config.js, dns-diagnostics.js, assistant-state.js and
 * assistant-widget.js with a single state source and a single service worker.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  YouGeAssistant,
  attachAssistant,
  bridgePwaGlobals,
  detectRuntimeHostname,
  resolveDomain,
  validateDomainConfigDetailed,
  validateDomainRegistry,
} from '../packages/assistant-sdk/src/index.js';
import { buildBrowserStateScript } from '../scripts/sync-sdk-browser.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readRepo = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

function makeEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = listeners.get(type);
      if (set) set.delete(fn);
    },
    dispatchEvent(event) {
      const set = listeners.get(event.type);
      if (set) Array.from(set).forEach((fn) => fn(event));
      return true;
    },
    listenerCount(type) {
      return listeners.has(type) ? listeners.get(type).size : 0;
    },
  };
}

function makeElement(tag = 'div') {
  const attrs = new Map();
  return {
    tagName: String(tag).toUpperCase(),
    children: [],
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    setAttribute(k, v) { attrs.set(String(k), String(v)); },
    getAttribute(k) { return attrs.has(String(k)) ? attrs.get(String(k)) : null; },
    hasAttribute(k) { return attrs.has(String(k)); },
    appendChild(child) { this.children.push(child); return child; },
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

function makeSandboxWindow(href = 'https://app.example.com/') {
  const url = new URL(href);
  const doc = Object.assign({
    visibilityState: 'visible',
    readyState: 'complete',
    cookie: '',
    title: 'Sandbox App',
    body: makeElement('body'),
    head: makeElement('head'),
    documentElement: makeElement('html'),
    createElement: (tag) => makeElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
  }, makeEventTarget());

  const storageMap = new Map();
  const localStorage = {
    getItem(k) { return storageMap.has(String(k)) ? storageMap.get(String(k)) : null; },
    setItem(k, v) { storageMap.set(String(k), String(v)); },
    removeItem(k) { storageMap.delete(String(k)); },
  };

  const win = Object.assign({
    document: doc,
    location: {
      href: url.href,
      hostname: url.hostname,
      origin: url.origin,
      protocol: url.protocol,
      pathname: url.pathname,
    },
    navigator: { onLine: true, userAgent: 'Mozilla/5.0 Chrome/128.0' },
    localStorage,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
    },
    URL,
    Date,
    Promise,
    JSON,
    Set,
    Map,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    isFinite,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
  }, makeEventTarget());

  win.window = win;
  win.self = win;
  win.top = win;
  win.isSecureContext = true;
  win.globalThis = win;
  vm.createContext(win);
  return { win, doc, localStorage };
}

test('assistant-state.js stays deterministically synchronized with @youge/assistant-sdk', () => {
  const current = readRepo('assistant-state.js');
  const expected = buildBrowserStateScript();
  assert.equal(current, expected, 'assistant-state.js matches canonical SDK build');
});

test('ESM and classic SDK expose Phase 1 hostname detection and validation APIs', () => {
  assert.equal(detectRuntimeHostname('http://127.0.0.1:5173/preview'), '127.0.0.1');
  const detailed = validateDomainConfigDetailed({ project: { id: 'x'.repeat(81) } });
  assert.equal(detailed.valid, false);
  assert.ok(detailed.issues.some((issue) => issue.code === 'invalid_project_id'));
  const registry = validateDomainRegistry({ 'bad host': {} });
  assert.equal(registry.valid, false);
  assert.ok(registry.issues.some((issue) => issue.code === 'invalid_registry_key'));

  const { win } = makeSandboxWindow('https://portal.example.com/');
  vm.runInContext(readRepo('assistant-state.js'), win, { filename: 'assistant-state.js' });
  const classic = win.YouGeAssistantSDK;
  assert.equal(classic.detectRuntimeHostname('http://localhost:5173/app'), 'localhost');
  const classicConfig = classic.validateDomainConfigDetailed({ project: { id: 'x'.repeat(81) } });
  assert.equal(classicConfig.valid, false);
  assert.ok(classicConfig.issues.some((issue) => issue.code === 'invalid_project_id'));
  const classicRegistry = classic.validateDomainRegistry({ 'bad host': {} });
  assert.equal(classicRegistry.valid, false);
  assert.ok(classicRegistry.issues.some((issue) => issue.code === 'invalid_registry_key'));
});

test('classic assistant-state.js and ESM @youge/assistant-sdk share one singleton in either load order', () => {
  // Order 1: classic assistant-state.js loads first, then ESM attachAssistant runs
  const envA = makeSandboxWindow('https://alpha.example.com/');
  envA.win.YOU_GE_ASSISTANT_CONFIG = { projectId: 'alpha-classic', branding: { name: 'Alpha Classic' } };
  vm.runInContext(readRepo('assistant-state.js'), envA.win, { filename: 'assistant-state.js' });

  const classicInstance = envA.win.YouGeAssistant;
  assert.ok(classicInstance && classicInstance.__state);
  const esmAttached = attachAssistant({ theme: 'dark' }, { root: envA.win });
  assert.equal(esmAttached, classicInstance, 'ESM attach reuses classic global instance');
  assert.equal(esmAttached.getState().project.id, 'alpha-classic');
  assert.equal(esmAttached.getState().appearance.theme, 'dark');
  assert.equal(envA.win.listenerCount('offline'), 1, 'no duplicate window listener');
  assert.equal(envA.doc.listenerCount('youge:endpoint-status'), 1, 'no duplicate document listener');
  esmAttached.destroy();

  // Order 2: ESM attachAssistant runs first, then classic assistant-state.js loads
  const envB = makeSandboxWindow('https://beta.example.com/');
  const esmFirst = YouGeAssistant.attach({ projectId: 'beta-esm', branding: { name: 'Beta ESM' } }, { root: envB.win });
  vm.runInContext(readRepo('assistant-state.js'), envB.win, { filename: 'assistant-state.js' });

  assert.equal(envB.win.YouGeAssistant, esmFirst, 'classic script respects existing SDK singleton');
  assert.equal(envB.win.listenerCount('offline'), 1);
  assert.equal(envB.doc.listenerCount('youge:endpoint-status'), 1);
  esmFirst.destroy();
});

test('SDK domain resolver matches domain-config.js across exact, wildcard, subpath and unknown hosts', () => {
  const { win } = makeSandboxWindow('https://portal.example.com/');
  vm.runInContext(readRepo('domain-registry.js'), win, { filename: 'domain-registry.js' });
  vm.runInContext(readRepo('domain-config.js'), win, { filename: 'domain-config.js' });

  const registry = {
    'portal.example.com': {
      project: { id: 'portal-project' },
      identity: { name: 'Portal', shortName: 'Portal' },
      branding: { themeColor: '#1d4ed8', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/', scope: '/', startUrl: '/?home=1', id: '/portal' },
    },
    '*.workspace.example.org/app/': {
      project: { id: 'workspace-project' },
      identity: { name: 'Workspace Subpath', shortName: 'Work' },
      branding: { themeColor: '#0f766e', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/app/', scope: './', startUrl: './?launch=1', id: './' },
    },
  };

  const cases = [
    { hostname: 'portal.example.com', origin: 'https://portal.example.com', protocol: 'https:', pathname: '/' },
    { hostname: 'eu.workspace.example.org', origin: 'https://eu.workspace.example.org', protocol: 'https:', pathname: '/app/tasks' },
    { hostname: 'unknown.example.net', origin: 'https://unknown.example.net', protocol: 'https:', pathname: '/any' },
  ];

  for (const loc of cases) {
    const fromClassic = JSON.parse(JSON.stringify(win.YouGeDomain.resolve(loc, registry)));
    const fromSdk = JSON.parse(JSON.stringify(resolveDomain(loc, registry)));
    assert.deepEqual(fromSdk.identity, fromClassic.identity);
    assert.deepEqual(fromSdk.project, fromClassic.project);
    assert.deepEqual(fromSdk.domain, fromClassic.domain);
    assert.deepEqual(fromSdk.pwa, fromClassic.pwa);
    assert.deepEqual(fromSdk.features, fromClassic.features);
  }

  const invalidRegistry = {
    'portal.example.com': {
      project: { id: 'x'.repeat(81) },
      branding: { themeColor: 'not-a-color' },
      pwa: { startUrl: 'javascript:alert(1)' },
    },
  };
  const invalidLocation = { hostname: 'portal.example.com', origin: 'https://portal.example.com', pathname: '/' };
  const invalidClassic = JSON.parse(JSON.stringify(win.YouGeDomain.resolve(invalidLocation, invalidRegistry)));
  const invalidSdk = JSON.parse(JSON.stringify(resolveDomain(invalidLocation, invalidRegistry)));
  assert.deepEqual(invalidSdk.project, invalidClassic.project);
  assert.deepEqual(invalidSdk.domain, invalidClassic.domain);
  assert.deepEqual(invalidSdk.branding, invalidClassic.branding);
  assert.deepEqual(invalidSdk.pwa, invalidClassic.pwa);
});

test('SDK integrates with real dns-diagnostics.js on-demand without background network requests', async () => {
  const { win } = makeSandboxWindow('https://probe.example.com/');
  let networkProbes = 0;
  win.AbortController = AbortController;
  win.fetch = async (input) => {
    networkProbes += 1;
    const target = String(input);
    if (target.includes('cloudflare-dns.com')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { Status: 0, Answer: [{ name: 'probe.example.com', type: 1, data: '93.184.216.34' }] };
        },
      };
    }
    return { ok: true, status: 200, async json() { return {}; } };
  };

  vm.runInContext(readRepo('dns-diagnostics.js'), win, { filename: 'dns-diagnostics.js' });

  const assistant = YouGeAssistant.create({
    projectId: 'dns-real',
    domain: 'probe.example.com',
  }, { root: win });

  assert.equal(networkProbes, 0, 'zero probes until explicitly requested');

  const diag = await assistant.runDiagnostics();
  assert.ok(networkProbes > 0, 'delegated to real YouGeDns.check on demand');
  assert.equal(diag.classification, 'normal_connectivity');
  assert.equal(assistant.getState().network.dns.classification, 'normal_connectivity');

  assistant.destroy();
});

test('a failed pwa.js diagnostics dialog reaches centralized state as a critical connectivity notice', async () => {
  const { win } = makeSandboxWindow('https://probe.example.com/');
  win.AbortController = AbortController;
  win.fetch = async () => { throw new TypeError('Failed to fetch'); };
  vm.runInContext(readRepo('dns-diagnostics.js'), win, { filename: 'dns-diagnostics.js' });
  vm.runInContext(readRepo('pwa.js'), win, { filename: 'pwa.js' });

  const assistant = YouGeAssistant.create({ projectId: 'modal-failure', domain: 'probe.example.com' }, { root: win });
  assert.equal(assistant.getState().network.dns.status, 'idle');

  // The real dialog dispatches `pwa:diagnostics` on both resolution and
  // rejection (see tests/install-experience.test.mjs); the state layer must
  // turn either shape into a usable classification.
  const result = await win.PWA.runNetworkDiagnostics();
  assert.equal(result.classification, 'application_host_unavailable');
  win.document.dispatchEvent(new win.CustomEvent('pwa:diagnostics', { detail: result }));

  let state = assistant.getState();
  assert.equal(state.network.dns.classification, 'application_host_unavailable');
  assert.ok(state.notifications.some((n) => n.id === 'network:unreachable'), 'a total online failure raises a critical notice');
  assert.ok(state.availableActions.some((a) => a.id === 'diagnostics'));

  // The rejection shape pwa.js publishes must classify the same way.
  win.document.dispatchEvent(new win.CustomEvent('pwa:diagnostics', {
    detail: { hostname: 'probe.example.com', classification: 'error', status: 'error', failed: true, message: 'Network down' },
  }));
  state = assistant.getState();
  assert.equal(state.network.dns.status, 'error');
  assert.equal(state.network.dns.message, 'Network down');
  assert.ok(state.notifications.some((n) => n.id === 'network:unreachable'));

  assistant.destroy();
});

test('bridgePwaGlobals + pwa.js registers canonical /you-ge-sw.js and preserves window.YouGePWA / window.PWA / window.progressier contracts', () => {
  const { win } = makeSandboxWindow('https://tenant.example.com/');
  const swRegistrations = [];
  win.navigator.serviceWorker = {
    register(swUrl, opts) {
      swRegistrations.push({ swUrl, opts });
      return Promise.resolve({ installing: null, waiting: null, active: {}, addEventListener() {} });
    },
    addEventListener() {},
  };
  win.matchMedia = () => ({ matches: false, addEventListener() {} });
  win.MutationObserver = class { observe() {} disconnect() {} };

  // Initialize SDK bridge BEFORE pwa.js loads (no domain-config.js loaded!)
  const bridged = bridgePwaGlobals({
    root: win,
    domainRegistry: {
      'tenant.example.com': {
        identity: { name: 'Tenant Portal', shortName: 'Tenant' },
        branding: { themeColor: '#155eef', icon: 'icons/icon-192.png' },
      },
    },
    assistantConfig: { projectId: 'tenant-portal' },
  });

  // Load pwa.js into the same window
  vm.runInContext(readRepo('pwa.js'), win, { filename: 'pwa.js' });

  assert.equal(win.YouGePWA.__youGePwaKit, true, 'canonical window.YouGePWA exposed');
  assert.equal(win.PWA.__pwaKit, true, 'window.PWA alias preserved');
  assert.equal(typeof win.progressier.install, 'function', 'window.progressier compatibility surface preserved');
  assert.equal(typeof win.progressier.push.subscribe, 'function', 'window.progressier.push surface preserved');
  assert.equal(swRegistrations.length, 1, 'exactly one service worker registered');
  assert.match(swRegistrations[0].swUrl, /you-ge-sw\.js$/, 'canonical /you-ge-sw.js path registered on fresh install');
  assert.equal(bridged.assistant.getState().project.name, 'Tenant Portal');
  // After pwa:ready, installation support transitions from none -> manual-generic
  assert.equal(bridged.assistant.getState().installation.support, 'manual-generic');

  bridged.assistant.destroy();
});

test('classic and SDK domain validation agree on diagnostics probe path safety', () => {
  const { win } = makeSandboxWindow('https://portal.example.com/');
  vm.runInContext(readRepo('domain-config.js'), win, { filename: 'domain-config.js' });

  const config = {
    diagnostics: { appProbePath: 'javascript:alert(1)', backendProbePath: 'health' },
  };
  const classic = JSON.parse(JSON.stringify(win.YouGeDomain.validateConfigDetailed(config)));
  const sdk = JSON.parse(JSON.stringify(validateDomainConfigDetailed(config)));
  assert.equal(classic.valid, false);
  assert.equal(sdk.valid, false);
  assert.deepEqual(sdk.issues.map((issue) => [issue.code, issue.path]), classic.issues.map((issue) => [issue.code, issue.path]));
  assert.deepEqual(sdk.config.diagnostics, classic.config.diagnostics);
  assert.deepEqual(sdk.config.diagnostics, { backendProbePath: 'health' });

  const registry = {
    'portal.example.com': { diagnostics: { appProbePath: 'https://evil.example/manifest.webmanifest' } },
  };
  const classicRegistry = JSON.parse(JSON.stringify(win.YouGeDomain.validateRegistry(registry)));
  const sdkRegistry = validateDomainRegistry(registry);
  assert.equal(classicRegistry.valid, false);
  assert.equal(sdkRegistry.valid, false);
  assert.deepEqual(
    sdkRegistry.issues.map((issue) => [issue.code, issue.path]),
    classicRegistry.issues.map((issue) => [issue.code, issue.path]),
  );
  assert.deepEqual(sdkRegistry.registry, classicRegistry.registry);
});

test('end-to-end pwa.js and YouGeAssistant stay synchronized across updatefound, applyUpdate, controllerchange and stale-worker clearing', async () => {
  const { win } = makeSandboxWindow('https://app.example.com/');
  let reloadCalls = 0;
  win.location.reload = () => { reloadCalls += 1; };
  win.matchMedia = () => ({ matches: false, addEventListener() {} });
  win.MutationObserver = class { observe() {} disconnect() {} };

  const swListeners = new Map();
  const makeWorker = (state) => {
    const workerListeners = new Map();
    return {
      state,
      messages: [],
      postMessage(msg) { this.messages.push(msg); },
      addEventListener(type, fn) {
        if (!workerListeners.has(type)) workerListeners.set(type, []);
        workerListeners.get(type).push(fn);
      },
      setState(next) {
        this.state = next;
        (workerListeners.get('statechange') || []).forEach((fn) => fn({ target: this }));
      },
    };
  };

  const regListeners = new Map();
  const initialWaiting = makeWorker('installed');
  const reg = {
    scope: 'https://app.example.com/',
    waiting: initialWaiting,
    installing: null,
    addEventListener(type, fn) {
      if (!regListeners.has(type)) regListeners.set(type, []);
      regListeners.get(type).push(fn);
    },
    dispatch(type, ev = {}) {
      (regListeners.get(type) || []).forEach((fn) => fn(ev));
    },
    update() { return Promise.resolve(reg); },
  };

  win.navigator.serviceWorker = {
    controller: { state: 'activated' },
    ready: Promise.resolve(reg),
    register() { return Promise.resolve(reg); },
    addEventListener(type, fn) {
      if (!swListeners.has(type)) swListeners.set(type, []);
      swListeners.get(type).push(fn);
    },
    dispatch(type, ev = {}) {
      (swListeners.get(type) || []).forEach((fn) => fn(ev));
    },
  };

  vm.runInContext(readRepo('pwa.js'), win, { filename: 'pwa.js' });
  await win.PWA.ready;

  const assistant = YouGeAssistant.create({ projectId: 'sw-e2e', domain: 'app.example.com' }, { root: win });
  assert.equal(assistant.getState().network.updateAvailable, true);
  assert.ok(assistant.getState().notifications.some((n) => n.id === 'app:update'));

  // Apply waiting update via Assistant API -> SKIP_WAITING -> controllerchange -> reload + clear state
  const applyResult = await assistant.applyUpdate();
  assert.deepEqual(applyResult, { applied: true, outcome: 'applied' });
  assert.equal(initialWaiting.messages.length, 1);
  assert.equal(initialWaiting.messages[0].type, 'SKIP_WAITING');

  reg.waiting = null;
  win.navigator.serviceWorker.controller = initialWaiting;
  win.navigator.serviceWorker.dispatch('controllerchange');
  assert.equal(reloadCalls, 1);
  assert.equal(win.PWA.getState().hasUpdate, false);
  assert.equal(assistant.getState().network.updateAvailable, false);
  assert.equal(assistant.getState().notifications.some((n) => n.id === 'app:update'), false);

  // Second update arrives via updatefound -> installed, then disappears externally before apply
  const nextWorker = makeWorker('installing');
  reg.installing = nextWorker;
  reg.dispatch('updatefound');
  reg.waiting = nextWorker;
  nextWorker.setState('installed');
  assert.equal(assistant.getState().network.updateAvailable, true);

  reg.waiting = null;
  const staleResult = await assistant.applyUpdate();
  assert.deepEqual(staleResult, { applied: false, outcome: 'no-waiting-worker' });
  assert.equal(reloadCalls, 1, 'disappeared waiting worker does not reload');
  assert.equal(win.PWA.getState().hasUpdate, false);
  assert.equal(assistant.getState().network.updateAvailable, false);

  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * Stage 5.3 / D6 — the DNS verdict belongs to the effective probe identity
 * ------------------------------------------------------------------ */

// The registry entry is what changes the effective app/backend probe targets,
// because the diagnostics context is built from the resolved domain config.
function probeRegistry(basePath, diagnostics) {
  return {
    'app.example.com/portal/': {
      project: { id: 'dns-identity-project' },
      pwa: { basePath },
      diagnostics,
    },
  };
}

function identityAssistant(extra) {
  return YouGeAssistant.create(Object.assign({
    location: 'https://app.example.com/portal/',
    domainRegistry: probeRegistry('/portal/', { appProbePath: 'manifest.webmanifest', backendProbePath: '/health' }),
    bindEvents: false,
  }, extra || {}));
}

function setVerdict(assistant, classification) {
  assistant.setDnsResult({
    status: 'complete',
    classification: classification || 'normal_connectivity',
    message: 'Healthy DNS and app probe.',
    checkedAt: '2026-11-14T00:00:00.000Z',
  });
  return assistant.getState().network.dns;
}

test('a base-path change on the same host and project invalidates the DNS verdict (D6)', () => {
  const assistant = identityAssistant();
  assert.equal(assistant.getState().project.basePath, '/portal/');
  setVerdict(assistant);
  assert.equal(assistant.getState().network.dns.classification, 'normal_connectivity');

  assistant.configure({ domainRegistry: probeRegistry('/other/', { appProbePath: 'manifest.webmanifest', backendProbePath: '/health' }) });

  const state = assistant.getState();
  assert.equal(state.project.basePath, '/other/', 'the effective base path moved');
  assert.equal(state.project.id, 'dns-identity-project', 'the project identity is unchanged');
  assert.equal(state.network.dns.status, 'idle', 'a verdict from another base path is stale');
  assert.equal(state.network.dns.classification, 'unknown');
  assert.equal(state.network.dns.checkedAt, null, 'the previous check timestamp is discarded');
  assert.equal(state.notifications.some((n) => n.id === 'dns:failure'), false);

  assistant.destroy();
});

test('changed app or backend probe paths invalidate the DNS verdict (D6)', () => {
  const cases = [
    { label: 'app probe path', diagnostics: { appProbePath: 'probe.json', backendProbePath: '/health' } },
    { label: 'backend probe path', diagnostics: { appProbePath: 'manifest.webmanifest', backendProbePath: '/healthz' } },
    { label: 'backend probe removed', diagnostics: { appProbePath: 'manifest.webmanifest' } },
  ];

  for (const testCase of cases) {
    const assistant = identityAssistant();
    setVerdict(assistant, 'dns_records_missing');
    assert.ok(assistant.getState().notifications.some((n) => n.id === 'dns:failure'), `${testCase.label} precondition`);

    assistant.configure({ domainRegistry: probeRegistry('/portal/', testCase.diagnostics) });

    const state = assistant.getState();
    assert.equal(state.project.id, 'dns-identity-project', testCase.label);
    assert.equal(state.network.dns.status, 'idle', `${testCase.label} change invalidates the verdict`);
    assert.equal(state.network.dns.classification, 'unknown', testCase.label);
    assert.equal(state.notifications.some((n) => n.id === 'dns:failure'), false, `${testCase.label} clears the notice`);
    assistant.destroy();
  }
});

test('unrelated configuration changes and repeated identical configuration keep the DNS verdict (D6)', () => {
  const assistant = identityAssistant();
  setVerdict(assistant);

  assistant.configure({ branding: { name: 'Renamed' } });
  assistant.configure({ theme: 'dark' });
  assistant.configure({ modules: { recovery: false } });
  let state = assistant.getState();
  assert.equal(state.network.dns.classification, 'normal_connectivity', 'unrelated changes keep the verdict');
  assert.equal(state.network.dns.checkedAt, '2026-11-14T00:00:00.000Z');

  // Repeating the very same identity is not a change.
  assistant.configure({ domainRegistry: probeRegistry('/portal/', { appProbePath: 'manifest.webmanifest', backendProbePath: '/health' }) });
  assistant.configure({ domainRegistry: probeRegistry('/portal/', { appProbePath: 'manifest.webmanifest', backendProbePath: '/health' }) });
  state = assistant.getState();
  assert.equal(state.network.dns.classification, 'normal_connectivity', 'an unchanged identity does not reset state');
  assert.equal(state.network.dns.status, 'complete');

  // A path-equivalent probe declaration is also the same identity.
  assistant.configure({ domainRegistry: probeRegistry('/portal/', { appProbePath: './manifest.webmanifest', backendProbePath: '/health' }) });
  assert.equal(assistant.getState().network.dns.classification, 'normal_connectivity', 'equivalent probe paths are not a change');

  assistant.destroy();
});

test('a stale in-flight diagnostics run cannot publish after the diagnostic identity changes (D6)', async () => {
  let releaseRun;
  let rejectRun;
  let runnerSignal = null;
  const assistant = identityAssistant({
    services: {
      diagnostics: (options) => {
        runnerSignal = options && options.signal;
        return new Promise((resolve, reject) => {
          releaseRun = resolve;
          rejectRun = reject;
          if (options && options.signal) {
            options.signal.addEventListener('abort', () => {
              reject(Object.assign(new Error('Diagnostics were cancelled.'), { kind: 'cancelled' }));
            }, { once: true });
          }
        });
      },
    },
  });

  const running = assistant.runDiagnostics();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(assistant.getState().network.dns.status, 'running');
  assert.ok(runnerSignal && runnerSignal.aborted === false);

  // Same host, same project id, different base path: a different app target.
  assistant.configure({ domainRegistry: probeRegistry('/other/', { appProbePath: 'manifest.webmanifest', backendProbePath: '/health' }) });

  assert.equal(runnerSignal.aborted, true, 'obsolete in-flight work is cancelled');
  assert.equal(assistant.getState().network.dns.status, 'idle', 'the stale run no longer owns published state');

  // Whatever the abandoned run does afterwards must not reach the state.
  releaseRun({ classification: 'normal_connectivity', message: 'stale result' });
  const settled = await running;
  assert.equal(settled.status, 'cancelled', 'the abandoned run settles as cancelled');

  const state = assistant.getState();
  assert.equal(state.network.dns.status, 'idle', 'a late result from the old target never lands');
  assert.equal(state.network.dns.classification, 'unknown');
  assert.equal(state.notifications.some((n) => n.id === 'dns:failure'), false);

  assistant.destroy();
  void rejectRun;
});

test('a public IP-literal host reaches the real engine as an IP target, never as a development host (D3 end to end)', async () => {
  const { win } = makeSandboxWindow('https://93.184.216.34/');
  const probed = [];
  win.AbortController = AbortController;
  win.fetch = async (input) => {
    probed.push(String(input));
    return { ok: true, status: 200, async json() { return {}; } };
  };
  vm.runInContext(readRepo('dns-diagnostics.js'), win, { filename: 'dns-diagnostics.js' });

  const assistant = YouGeAssistant.create({ projectId: 'ip-literal', domain: '93.184.216.34' }, { root: win });
  const result = await assistant.runDiagnostics();

  assert.equal(probed.filter((url) => url.includes('cloudflare-dns.com')).length, 0, 'public DoH is never queried for an IP literal');
  assert.equal(result.hostKind, 'public-ip');
  assert.equal(result.classification, 'normal_connectivity');
  assert.doesNotMatch(result.message, /local development host/i);
  assert.match(result.message, /IP address 93\.184\.216\.34/);
  assert.equal(assistant.getState().network.dns.classification, 'normal_connectivity');

  assistant.destroy();
});
