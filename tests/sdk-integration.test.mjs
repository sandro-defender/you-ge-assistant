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

test('bridgePwaGlobals + pwa.js preserves single /progressier.js registration and window.PWA / window.progressier contracts', () => {
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

  assert.equal(win.PWA.__pwaKit, true, 'window.PWA preserved');
  assert.equal(typeof win.progressier.install, 'function', 'window.progressier compatibility surface preserved');
  assert.equal(typeof win.progressier.push.subscribe, 'function', 'window.progressier.push surface preserved');
  assert.equal(swRegistrations.length, 1, 'exactly one service worker registered');
  assert.match(swRegistrations[0].swUrl, /progressier\.js$/, 'legacy /progressier.js path preserved');
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
