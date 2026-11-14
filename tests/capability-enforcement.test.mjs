/*!
 * CD-1 — capability enforcement across the classic runtime.
 *
 * These tests run the real `assistant-state.js`, `assistant-widget.js`,
 * `pwa.js`, `dns-diagnostics.js` and `offline.js` sources in a VM with a
 * counting `fetch`, so "no diagnostic network traffic" is measured, not
 * inferred from hidden markup. Cloudflare DoH is the only diagnostic transport
 * (`https://cloudflare-dns.com/dns-query`), so every request is counted.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readRepo = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

/* ------------------------------------------------------------------ *
 * Minimal sandbox
 * ------------------------------------------------------------------ */

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

function makeElement(tag = 'div', extras = {}) {
  const attrs = new Map();
  return Object.assign({
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
  }, extras);
}

/**
 * A window that can run the real classic sources.
 * `withAssistant` mounts `assistant-state.js` (+ the widget) with the given
 * global configuration; `network` counts every fetch the page performs.
 */
function makeSandbox(options = {}) {
  const href = options.href || 'https://app.example.com/';
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
    getElementById: () => null,
  }, makeEventTarget());

  const storageMap = new Map();
  const localStorage = {
    getItem(k) { return storageMap.has(String(k)) ? storageMap.get(String(k)) : null; },
    setItem(k, v) { storageMap.set(String(k), String(v)); },
    removeItem(k) { storageMap.delete(String(k)); },
  };

  const network = {
    requests: [],
    dns: 0,
    probes: 0,
    async fetch(input, init) {
      const target = String(input);
      network.requests.push({ url: target, init });
      if (target.startsWith('https://cloudflare-dns.com/dns-query')) {
        network.dns += 1;
        const type = new URL(target).searchParams.get('type');
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              Status: 0,
              Answer: type === 'A' ? [{ name: url.hostname, type: 1, data: '192.0.2.10' }] : [{ name: url.hostname, type: 28, data: '2001:db8::10' }],
            };
          },
        };
      }
      network.probes += 1;
      return { ok: true, status: 200, async json() { return {}; } };
    },
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
    fetch: network.fetch,
    AbortController,
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
    TypeError,
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
    network,
  }, makeEventTarget());

  win.window = win;
  win.self = win;
  win.top = win;
  win.globalThis = win;
  vm.createContext(win);

  if (options.assistant !== false) {
    win.YOU_GE_ASSISTANT_CONFIG = options.config || {};
    vm.runInContext(readRepo('src/assistant/assistant-state.js'), win, { filename: 'assistant-state.js' });
  }
  if (options.widget) {
    vm.runInContext(readRepo('src/assistant/assistant-widget.js'), win, { filename: 'assistant-widget.js' });
  }
  vm.runInContext(readRepo('src/domain/dns-diagnostics.js'), win, { filename: 'dns-diagnostics.js' });
  if (options.pwa) {
    vm.runInContext(readRepo('src/runtime/pwa.js'), win, { filename: 'pwa.js' });
  }
  return { win, doc, network, url };
}

/** A page element that the toolkit's delegated handlers will recognise. */
function toolkitButton(attribute) {
  const attrs = new Map();
  const node = {
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name) : null),
    setAttribute: (name, value) => attrs.set(name, String(value)),
    hasAttribute: (name) => attrs.has(name),
    preventDefault() {},
    closest(selector) {
      const names = String(selector).match(/\[([^\]=\s]+)/g) || [];
      return names.some((entry) => attrs.has(entry.slice(1))) ? node : null;
    },
  };
  node.setAttribute(attribute, '');
  return node;
}

function click(win, target) {
  let prevented = 0;
  const event = { type: 'click', target, preventDefault() { prevented += 1; } };
  win.document.dispatchEvent(event);
  return prevented;
}

/* ------------------------------------------------------------------ *
 * 1. The DoH transport refuses a disabled capability
 * ------------------------------------------------------------------ */

test('Cloudflare DoH is never requested when modules.diagnostics is disabled', async () => {
  const { win, network } = makeSandbox({
    config: { projectId: 'cap-off', domain: 'app.example.com', modules: { diagnostics: false } },
  });
  assert.equal(win.YouGeAssistant.isCapabilityEnabled('diagnostics'), false);

  const result = await win.YouGeDns.check({ hostname: 'app.example.com', origin: 'https://app.example.com', basePath: '/', online: true });

  assert.equal(result.status, 'disabled');
  assert.equal(result.classification, 'disabled');
  assert.equal(result.dohAvailable, false);
  assert.equal(network.dns, 0, 'no Cloudflare DNS-over-HTTPS request');
  assert.equal(network.probes, 0, 'no application or backend probe');
  assert.deepEqual(network.requests, [], 'no network request of any kind');
  assert.equal(win.YouGeAssistant.getState().network.dns.checkedAt, null, 'the engine never published a verdict');
});

test('the DoH transport still runs when the capability is enabled (control)', async () => {
  const { win, network } = makeSandbox({
    config: { projectId: 'cap-on', domain: 'app.example.com' },
  });
  const result = await win.YouGeDns.check({ hostname: 'app.example.com', origin: 'https://app.example.com', basePath: '/', online: true });
  assert.equal(result.classification, 'normal_connectivity');
  assert.ok(network.dns > 0, 'the A/AAAA lookups were performed');
  assert.ok(network.probes > 0, 'the application probe was performed');
});

test('a toolkit-only page (no Assistant) keeps the existing DoH behavior', async () => {
  const { win, network } = makeSandbox({ assistant: false });
  const result = await win.YouGeDns.check({ hostname: 'app.example.com', origin: 'https://app.example.com', basePath: '/', online: true });
  assert.equal(result.classification, 'normal_connectivity');
  assert.ok(network.dns > 0, 'the engine fails open when no Assistant is loaded');
});

/* ------------------------------------------------------------------ *
 * 2. Toolkit API and delegated hooks cannot bypass the flag
 * ------------------------------------------------------------------ */

test('PWA.runNetworkDiagnostics() returns disabled and makes no request', async () => {
  const { win, network } = makeSandbox({
    pwa: true,
    config: { projectId: 'pwa-off', domain: 'app.example.com', modules: { diagnostics: false } },
  });

  const result = await win.PWA.runNetworkDiagnostics();
  assert.equal(result.status, 'disabled');
  assert.equal(result.classification, 'disabled');
  assert.deepEqual(network.requests, []);

  const enabled = makeSandbox({ pwa: true, config: { projectId: 'pwa-on', domain: 'app.example.com' } });
  const ok = await enabled.win.PWA.runNetworkDiagnostics();
  assert.equal(ok.classification, 'normal_connectivity');
  assert.ok(enabled.network.dns > 0, 'the control run does reach DoH');
});

test('PWA.showNetworkDiagnostics() opens no dialog and the delegated click makes no request', () => {
  const { win, network } = makeSandbox({
    pwa: true,
    config: { projectId: 'dialog-off', domain: 'app.example.com', modules: { diagnostics: false } },
  });

  assert.equal(win.PWA.showNetworkDiagnostics(), null, 'no diagnostics dialog is created');

  // The documented delegation contract: the widget (or any host markup) sets
  // `data-pwa-diagnostics`, and pwa.js owns the click.
  const prevented = click(win, toolkitButton('data-pwa-diagnostics'));
  assert.equal(prevented, 1, 'the toolkit handler recognised the hook');
  assert.deepEqual(network.requests, [], 'clicking the delegated hook performs no diagnostic work');

  const enabled = makeSandbox({ pwa: true, config: { projectId: 'dialog-on', domain: 'app.example.com' } });
  assert.doesNotThrow(() => enabled.win.PWA.showNetworkDiagnostics());
  assert.deepEqual(enabled.network.requests, [], 'opening the dialog still does not probe until the user starts it');
});

test('an end-to-end page cannot start diagnostics from a notice or a stale button', async () => {
  const { win, network } = makeSandbox({
    pwa: true,
    widget: true,
    config: { projectId: 'page-off', domain: 'app.example.com', modules: { diagnostics: false } },
  });

  // A failing DNS verdict arrives from an unrelated source (an application
  // event); it must not resurrect the gated action.
  win.document.dispatchEvent(new win.CustomEvent('pwa:diagnostics', {
    detail: { status: 'error', classification: 'dns_resolution_failure', message: 'NXDOMAIN.' },
  }));
  const state = win.YouGeAssistant.getState();
  assert.ok(state.notifications.some((notice) => notice.id === 'dns:failure'), 'the condition is reported');
  assert.equal(state.notifications.some((notice) => notice.actionId === 'diagnostics'), false);
  assert.equal(state.availableActions.some((action) => action.id === 'diagnostics'), false);

  // Manual API calls, the delegated hook and the widget's action handler.
  const manual = await win.YouGeAssistant.runDiagnostics();
  assert.equal(manual.status, 'disabled');
  click(win, toolkitButton('data-pwa-diagnostics'));
  win.YouGeAssistantWidget.open();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(network.requests, [], 'no diagnostic request was made by any path');
});

/* ------------------------------------------------------------------ *
 * 3. Recovery, failover and help — automatic and manual internal paths
 * ------------------------------------------------------------------ */

test('recovery and failover disabled: no action or notice can be surfaced by events or reconfigure', async () => {
  const { win } = makeSandbox({
    pwa: true,
    config: { projectId: 'gated', domain: 'app.example.com', modules: { recovery: false, failover: false, help: false } },
  });
  const assistant = win.YouGeAssistant;

  win.dispatchEvent({ type: 'offline' });
  assistant.setDnsResult({ status: 'complete', classification: 'dns_resolution_failure', message: 'NXDOMAIN.' });
  assistant.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'Using backup.' });
  assistant.setSessionStatus({ state: 'issue', message: 'Sign in again.' });

  let state = assistant.getState();
  assert.equal(state.availableActions.some((action) => action.id === 'recovery'), false);
  assert.equal(state.availableActions.some((action) => action.id === 'backup-status'), false);
  assert.equal(state.notifications.some((notice) => notice.id === 'api:backup-active'), false);
  assert.equal(state.notifications.some((notice) => notice.actionId === 'help'), false);
  assert.equal(state.notifications.some((notice) => notice.actionId === 'recovery'), false);

  // A later reconfiguration that omits the flags must not silently re-enable
  // them: merged configuration keeps the explicit values.
  assistant.configure({ branding: { name: 'Renamed' } });
  state = assistant.getState();
  assert.equal(state.capabilities.recovery, false);
  assert.equal(state.capabilities.failover, false);
  assert.equal(state.capabilities.help, false);
  assert.equal(state.availableActions.some((action) => action.id === 'backup-status'), false);

  // Explicitly enabling restores them (the flags are live, not sticky).
  assistant.configure({ modules: { recovery: true, failover: true, help: true } });
  state = assistant.getState();
  assert.equal(state.availableActions.some((action) => action.id === 'recovery'), true);
  assert.equal(state.availableActions.some((action) => action.id === 'backup-status'), true);
  assert.equal(state.notifications.some((notice) => notice.actionId === 'help'), true);
});

test('help disabled: no alternate event or configuration path exposes help', () => {
  const { win } = makeSandbox({
    config: {
      projectId: 'help-off',
      domain: 'app.example.com',
      modules: { help: false },
      actions: [
        { id: 'support', label: 'Contact support', kind: 'help' },
        { id: 'help', label: 'Help', kind: 'custom' },
        { id: 'docs', label: 'Docs', kind: 'custom' },
      ],
    },
  });
  const assistant = win.YouGeAssistant;
  win.document.dispatchEvent(new win.CustomEvent('youge:session-status', { detail: { state: 'issue', message: 'Expired.' } }));

  const state = assistant.getState();
  assert.equal(state.availableActions.some((action) => action.id === 'support'), false, 'a help-kind project action is gated');
  assert.equal(state.availableActions.some((action) => action.id === 'help'), false, 'a gated action id is gated');
  assert.equal(state.availableActions.some((action) => action.id === 'docs'), true, 'unrelated actions keep working');
  assert.equal(state.notifications.some((notice) => notice.actionId === 'help'), false);
  assert.ok(state.notifications.some((notice) => notice.id === 'session:issue'), 'the session condition is still reported');
});

/* ------------------------------------------------------------------ *
 * 4. Asynchronous and initialization-order paths
 * ------------------------------------------------------------------ */

test('disabling diagnostics before the run starts prevents every request', async () => {
  const { win, network } = makeSandbox({
    pwa: true,
    config: { projectId: 'race', domain: 'app.example.com' },
  });
  const pending = win.YouGeAssistant.runDiagnostics();
  win.YouGeAssistant.configure({ modules: { diagnostics: false } });
  const result = await pending;

  assert.equal(result.status, 'disabled');
  assert.deepEqual(network.requests, [], 'the runner never started');
  assert.equal(win.YouGeAssistant.getState().network.dns.classification, 'disabled');
});

test('disabling diagnostics during a run aborts the transport and discards the verdict', async () => {
  const { win, network } = makeSandbox({
    pwa: true,
    config: { projectId: 'late', domain: 'app.example.com' },
  });
  // Make the DoH answer slow so the run is genuinely in flight.
  win.fetch = (input, init) => new Promise((resolve, reject) => {
    network.requests.push({ url: String(input), init });
    if (init && init.signal) {
      init.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError', kind: 'cancelled' }));
      }, { once: true });
    }
  });

  const pending = win.YouGeAssistant.runDiagnostics();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(network.requests.length > 0, 'the diagnostic run had started');

  win.YouGeAssistant.configure({ modules: { diagnostics: false } });
  const result = await pending;

  assert.notEqual(result.classification, 'normal_connectivity', 'a late verdict is never published');
  const state = win.YouGeAssistant.getState();
  assert.equal(state.network.dns.classification, 'disabled');
  assert.equal(state.notifications.some((notice) => notice.critical), false);
});

/* ------------------------------------------------------------------ *
 * 5. Offline shell
 * ------------------------------------------------------------------ */

/** A document with the ids `offline.js` binds to. */
function makeOfflineDocument() {
  const nodes = new Map();
  const ids = [
    'hint', 'statusText', 'headline', 'message', 'dot', 'appName', 'currentDomain',
    'retryLink', 'diagnosticsButton', 'diagnosticsResult', 'recoveryGuide',
  ];
  for (const id of ids) {
    nodes.set(id, makeElement('div', {
      id,
      textContent: '',
      disabled: false,
      hidden: false,
      listeners: new Map(),
      addEventListener(type, fn) { this.listeners.set(type, fn); },
      click() { const fn = this.listeners.get('click'); if (fn) fn({}); },
    }));
  }
  const doc = Object.assign({
    readyState: 'complete',
    visibilityState: 'visible',
    documentElement: makeElement('html'),
    body: makeElement('body'),
    createElement: (tag) => makeElement(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => nodes.get(id) || null,
  }, makeEventTarget());
  doc.title = '';
  return { doc, nodes };
}

function makeOfflineShell(config) {
  const { doc, nodes } = makeOfflineDocument();
  const network = { dns: 0, requests: [], async fetch(input) { network.requests.push(String(input)); network.dns += 1; } };
  const win = Object.assign({
    document: doc,
    location: { href: 'https://app.example.com/', hostname: 'app.example.com', origin: 'https://app.example.com', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true, userAgent: 'Mozilla/5.0 Chrome/128.0' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: network.fetch,
    AbortController,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    URL, Date, Promise, JSON, Set, Map, Math, Object, Array, String, Number, Boolean, RegExp, Error, TypeError,
    isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, console, setTimeout, clearTimeout,
  }, makeEventTarget());
  win.window = win;
  win.self = win;
  win.globalThis = win;
  vm.createContext(win);
  win.YOU_GE_ASSISTANT_CONFIG = config || {};
  vm.runInContext(readRepo('src/assistant/assistant-state.js'), win, { filename: 'assistant-state.js' });
  vm.runInContext(readRepo('src/domain/dns-diagnostics.js'), win, { filename: 'dns-diagnostics.js' });
  vm.runInContext(readRepo('src/offline/offline.js'), win, { filename: 'offline.js' });
  return { win, nodes, network };
}

test('the offline shell hides and refuses its diagnostics button when the capability is disabled', () => {
  const { nodes, network } = makeOfflineShell({ projectId: 'offline-off', domain: 'app.example.com', modules: { diagnostics: false } });
  const button = nodes.get('diagnosticsButton');
  assert.equal(button.hidden, true, 'the button is hidden');
  button.click();
  assert.equal(network.dns, 0, 'clicking the hidden button starts nothing');
  assert.deepEqual(network.requests, []);
});

test('the offline shell keeps its diagnostics button when the capability is enabled (control)', () => {
  const { nodes } = makeOfflineShell({ projectId: 'offline-on', domain: 'app.example.com' });
  assert.equal(nodes.get('diagnosticsButton').hidden, false);
});
