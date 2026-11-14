/**
 * Behavioral regression tests for the existing PWA installation experience.
 *
 * pwa.js is evaluated unmodified in a small, dependency-free DOM harness. This
 * verifies the real event flow rather than only grepping for source tokens:
 * beforeinstallprompt capture, native prompt(), userChoice, appinstalled,
 * already-installed behavior, platform detection, iOS/generic instructions,
 * dismissal, banner state, service worker registration and the on-demand
 * network diagnostics dialog's event contract.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../pwa.js', import.meta.url), 'utf8');

const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
const IPADOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
  contains(name) { return this.values.has(name); }
}

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.classList = new ClassList();
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    this.listeners = new Map();
    this.textContent = '';
    this.innerHTML = '';
    this._className = '';
    this.id = '';
    this.hidden = false;
    this.shadow = null;
    this.focused = false;
  }

  get className() { return this._className; }
  set className(value) { this._className = value; }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((entry) => entry !== child); child.parentNode = null; return child; }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener));
  }
  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) {
      listener({ target: this, preventDefault() {}, ...event });
    }
  }
  attachShadow() { this.shadow = new FakeNode('shadow-root'); return this.shadow; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  matches() { return false; }
  contains() { return false; }
  closest() { return null; }
  focus() { this.focused = true; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  get isConnected() { return Boolean(this.parentNode); }
}

class FakeCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

function allNodes(node, result = []) {
  result.push(node);
  for (const child of node.children || []) allNodes(child, result);
  if (node.shadow) allNodes(node.shadow, result);
  return result;
}

function findAll(node, predicate) {
  return allNodes(node).filter(predicate);
}

function textOf(node) {
  return findAll(node, (entry) => entry.tagName !== 'STYLE')
    .map((entry) => entry.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findHelpHost(context) {
  return context.doc.created.find((node) => node.hasAttribute('data-pwa-help') && node.parentNode === context.doc.body) || null;
}

function findSheet(host) {
  return host?.shadow ? host.shadow.children.find((node) => node.className === 'sheet') || null : null;
}

function createContext(options = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const events = [];
  const created = [];
  const media = { matches: Boolean(options.standalone), media: '', addEventListener() {}, addListener() {} };

  const doc = {
    currentScript: Object.assign(new FakeNode('script'), {
      src: 'https://example.test/pwa.js',
      dataset: options.dataset || {},
    }),
    head: new FakeNode('head'),
    body: new FakeNode('body'),
    documentElement: new FakeNode('html'),
    title: '',
    readyState: 'loading',
    cookie: '',
    referrer: options.referrer || '',
    visibilityState: 'visible',
    activeElement: null,
    created,
    events,
    createElement(tag) {
      const node = new FakeNode(tag);
      created.push(node);
      return node;
    },
    createDocumentFragment() { return new FakeNode('fragment'); },
    querySelector(selector) {
      if (selector === '[data-pwa-help]') return findHelpHost({ doc });
      return null;
    },
    querySelectorAll(selector) {
      const pool = options.installButtons || [];
      if (!pool.length) return [];
      const text = String(selector);
      if (text.charAt(0) === '.') {
        const className = text.slice(1).split(':')[0];
        return pool.filter((node) => node.classList.contains(className) && !node.classList.contains('captured'));
      }
      const attribute = /^\[([^\]=]+)/.exec(text);
      if (!attribute) return [];
      return pool.filter((node) => node.hasAttribute(attribute[1]));
    },
    addEventListener(type, listener) {
      const list = documentListeners.get(type) || [];
      list.push(listener);
      documentListeners.set(type, list);
    },
    removeEventListener(type, listener) {
      documentListeners.set(type, (documentListeners.get(type) || []).filter((entry) => entry !== listener));
    },
    dispatchEvent(event) { events.push(event); },
    dispatch(type, event = {}) {
      for (const listener of documentListeners.get(type) || []) {
        listener({ target: doc.body, preventDefault() {}, ...event });
      }
    },
  };

  const serviceWorker = {
    registerCalls: [],
    controller: null,
    ready: Promise.resolve({ scope: 'https://example.test/' }),
    register(url, opts) {
      serviceWorker.registerCalls.push([url, opts]);
      return Promise.resolve({
        scope: 'https://example.test/',
        addEventListener() {},
        update() { return Promise.resolve(); },
      });
    },
    addEventListener() {},
  };

  const location = {
    href: 'https://example.test/',
    hostname: 'example.test',
    origin: 'https://example.test',
    protocol: 'https:',
    pathname: '/',
    search: '',
    reload() {},
  };

  const win = {
    location,
    screen: { width: options.screenWidth || 500 },
    isSecureContext: true,
    self: null,
    top: null,
    matchMedia(query) {
      return { ...media, media: query, matches: query.includes('standalone') ? media.matches : false };
    },
    addEventListener(type, listener) {
      const list = windowListeners.get(type) || [];
      list.push(listener);
      windowListeners.set(type, list);
    },
    removeEventListener(type, listener) {
      windowListeners.set(type, (windowListeners.get(type) || []).filter((entry) => entry !== listener));
    },
    dispatch(type, event = {}) {
      for (const listener of windowListeners.get(type) || []) {
        listener({ preventDefault() {}, ...event });
      }
    },
    localStorage: { getItem() { return null; }, setItem() {} },
    requestAnimationFrame() {},
    PushManager: function PushManager() {},
    Notification: { permission: 'default' },
  };
  win.self = win;
  win.top = win;

  const navigator = {
    userAgent: options.userAgent || CHROME_UA,
    maxTouchPoints: options.maxTouchPoints || 0,
    standalone: Boolean(options.iosStandalone),
    platform: 'Linux',
    onLine: true,
    serviceWorker,
    vibrate() {},
    permissions: { query() { return Promise.resolve({ state: 'prompt' }); } },
  };

  const context = {
    window: win,
    document: doc,
    navigator,
    location,
    screen: win.screen,
    Notification: win.Notification,
    PushManager: win.PushManager,
    CustomEvent: FakeCustomEvent,
    URL,
    URLSearchParams,
    Promise,
    Set,
    Map,
    console,
    Date,
    Math,
    JSON,
    RegExp,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    TypeError,
    setTimeout() { return 0; },
    clearTimeout() {},
    setInterval() { return 0; },
    clearInterval() {},
    requestAnimationFrame() {},
    Image: function Image() {},
    MessageChannel: function MessageChannel() { this.port1 = {}; this.port2 = {}; },
    fetch() { return Promise.resolve({ ok: false, status: 503, json() { return Promise.resolve({}); } }); },
    AbortController: function AbortController() {
      this.signal = {};
      this.abort = function abort() {};
    },
  };

  for (const node of options.installButtons || []) doc.body.appendChild(node);

  vm.runInNewContext(source, context);
  assert.ok(win.PWA && win.PWA.__pwaKit, 'pwa.js exposes window.PWA');
  return { context, win, doc, navigator, media, serviceWorker, windowListeners, documentListeners, events };
}

function deferredPrompt(outcome = 'accepted') {
  const calls = { prevented: 0, prompted: 0 };
  return {
    calls,
    event: {
      preventDefault() { calls.prevented += 1; },
      prompt() { calls.prompted += 1; },
      userChoice: Promise.resolve({ outcome }),
    },
  };
}

test('captures beforeinstallprompt and triggers the native browser prompt on a user action', async () => {
  const harness = createContext({ userAgent: CHROME_UA });
  const { calls, event } = deferredPrompt('accepted');

  harness.win.dispatch('beforeinstallprompt', event);

  assert.equal(calls.prevented, 1, 'the browser event is deferred, not auto-fired');
  assert.equal(harness.win.PWA.canInstall(), true);
  assert.equal(harness.win.PWA.getState().canInstall, true);
  assert.ok(harness.events.some((entry) => entry.type === 'pwa:installable'), 'pwa:installable is dispatched');

  const result = await harness.win.PWA.promptInstall();

  assert.equal(calls.prompted, 1, 'event.prompt() is called exactly once');
  assert.equal(result.outcome, 'accepted');
  assert.equal(harness.win.PWA.isInstalled(), true, 'accepted userChoice marks the app installed');
  assert.equal(harness.win.PWA.canInstall(), false, 'the deferred event cannot be reused');

  const second = await harness.win.PWA.promptInstall();
  assert.equal(second.outcome, 'already-installed');
  assert.equal(calls.prompted, 1, 'no second native prompt is attempted');
});

test('a dismissed userChoice leaves the app uninstallable and keeps manual instructions available', async () => {
  const harness = createContext();
  const { calls, event } = deferredPrompt('dismissed');
  harness.win.dispatch('beforeinstallprompt', event);

  const result = await harness.win.PWA.promptInstall();

  assert.equal(result.outcome, 'dismissed');
  assert.equal(calls.prompted, 1);
  assert.equal(harness.win.PWA.isInstalled(), false);
  assert.equal(harness.win.PWA.canInstall(), false);
});

test('appinstalled marks the app installed without a native prompt', async () => {
  const harness = createContext();
  harness.win.dispatch('appinstalled');
  assert.equal(harness.win.PWA.isInstalled(), true);
  assert.equal(harness.win.PWA.isStandalone(), false);
  assert.ok(harness.events.some((entry) => entry.type === 'pwa:installed'));
  assert.equal((await harness.win.PWA.promptInstall()).outcome, 'already-installed');
});

test('standalone detection covers display modes, iOS standalone, iPadOS and Android TWA', () => {
  assert.equal(createContext({ standalone: true }).win.PWA.isStandalone(), true, 'display-mode: standalone');
  assert.equal(createContext({ iosStandalone: true }).win.PWA.isStandalone(), true, 'navigator.standalone');
  assert.equal(createContext({ referrer: 'android-app://com.example/' }).win.PWA.isStandalone(), true, 'android-app referrer');
  assert.equal(createContext({ userAgent: IPADOS_UA, maxTouchPoints: 5 }).win.PWA.isIOS(), true, 'iPadOS desktop mode');
  assert.equal(createContext().win.PWA.isStandalone(), false, 'ordinary browser tab');
  assert.equal(createContext().win.PWA.getState().hostname, 'example.test', 'domain detection is exposed');
  assert.equal(createContext().win.PWA.getState().origin, 'https://example.test');
});

test('iOS shows manual Safari instructions with accessible dialog semantics and dismisses cleanly', async () => {
  const harness = createContext({ userAgent: IPHONE_UA });
  assert.equal(harness.win.PWA.isIOS(), true);
  assert.equal(harness.win.PWA.isSafari(), true);

  const result = await harness.win.PWA.promptInstall();
  assert.equal(result.outcome, 'instructions', 'no fake programmatic install is claimed');

  const host = findHelpHost(harness);
  assert.ok(host, 'an instructions sheet is displayed');
  const sheet = findSheet(host);
  assert.ok(sheet, 'the sheet is inside the shadow root');
  assert.equal(sheet.getAttribute('role'), 'dialog');
  assert.equal(sheet.getAttribute('aria-modal'), 'true');
  assert.match(sheet.getAttribute('aria-label'), /Install/, 'aria-label fallback is preserved');
  assert.equal(sheet.getAttribute('aria-labelledby'), 'pwa-install-title');
  assert.equal(sheet.getAttribute('aria-describedby'), 'pwa-install-steps');

  const text = textOf(sheet);
  assert.match(text, /Share button/);
  assert.match(text, /Add to Home Screen/);
  assert.match(text, /On iOS the app must be added from Safari/);
  assert.match(text, /Install .* on iPhone or iPad/);

  const styleText = host.shadow.children.find((node) => node.tagName === 'STYLE')?.textContent || '';
  assert.match(styleText, /\.close:focus-visible,\.ok:focus-visible/, 'visible focus ring for modal controls');
  assert.match(styleText, /min-width:44px;min-height:44px/, '44px close target');
  assert.match(styleText, /prefers-reduced-motion:reduce/, 'reduced-motion support');
  assert.match(styleText, /#475569/, 'contrast-safe note color');

  const close = findAll(sheet, (node) => node.className === 'close')[0];
  assert.equal(close.getAttribute('aria-label'), 'Close installation instructions');
  close.dispatch('click');
  assert.equal(findHelpHost(harness), null, 'close removes the sheet');

  await harness.win.PWA.showInstallHelp('ios');
  assert.ok(findHelpHost(harness), 'the sheet can be shown again');
  harness.doc.dispatch('keydown', { key: 'Escape' });
  assert.equal(findHelpHost(harness), null, 'Escape removes the sheet');

  harness.win.PWA.showInstallHelp('ios');
  const currentHost = findHelpHost(harness);
  const backdrop = currentHost?.shadow?.children?.find((node) => node.className === 'backdrop')
    || findAll(harness.doc.body, (node) => node.className === 'backdrop')[0];
  assert.ok(backdrop, 'backdrop exists');
  backdrop.dispatch('click');
  assert.equal(findHelpHost(harness), null, 'backdrop click removes the sheet');
});

test('unsupported browsers receive generic manual instructions, not a programmatic install claim', async () => {
  const harness = createContext({ userAgent: CHROME_UA });
  assert.equal(harness.win.PWA.isIOS(), false);
  assert.equal(harness.win.PWA.isSafari(), false);

  const result = await harness.win.PWA.promptInstall();
  assert.equal(result.outcome, 'instructions');

  const sheet = findSheet(findHelpHost(harness));
  const text = textOf(sheet);
  assert.match(text, /browser menu/);
  assert.match(text, /Install app/);
  assert.doesNotMatch(text, /must be added from Safari/);
  assert.match(text, /Install You.Ge Assistant/);
});

test('install banner dismissal is persisted with the legacy cookie name', () => {
  const harness = createContext();
  const banner = harness.win.PWA.showInstallBanner({});
  assert.ok(banner, 'banner is displayed for an eligible browser');

  const buttons = findAll(banner, (node) => node.tagName === 'BUTTON');
  assert.equal(buttons.length, 2, 'install and Not now actions');
  buttons[1].dispatch('click');

  assert.match(harness.doc.cookie, /progressierinstallbanner/, 'dismissal is stored');
  assert.equal(harness.win.PWA.showInstallBanner({}), null, 'dismissed banner is not shown again immediately');
});

test('registers the legacy worker path with a computed same-origin scope', async () => {
  const harness = createContext();
  const ready = harness.win.PWA.register();
  await ready;

  assert.equal(harness.serviceWorker.registerCalls.length, 1);
  const [url, options] = harness.serviceWorker.registerCalls[0];
  assert.equal(url, 'https://example.test/progressier.js', '/progressier.js worker path is preserved');
  assert.equal(options.scope, '/', 'scope is computed from the manifest/worker directory');
});

/* ------------------------------------------------------------------ *
 * Audit regressions (2026-11): markup-injection and permission-API hardening
 * ------------------------------------------------------------------ */

test('host-supplied install button labels are escaped, never parsed as HTML', () => {
  const payload = '<img src=x onerror="window.__pwned = 1">';
  const installButton = new FakeNode('button');
  installButton.classList.add('progressier-install-button');
  installButton.setAttribute('data-install', payload);

  createContext({ installButtons: [installButton] });

  assert.match(installButton.innerHTML, /&lt;img src=x onerror=/, 'the label is rendered as escaped text');
  assert.doesNotMatch(installButton.innerHTML, /<img /, 'no element is parsed out of a label attribute');
  assert.match(installButton.innerHTML, /class="pwa-btn-label"/, 'the button markup structure is preserved');
});

test('push permission requests support callback-only browsers and never throw', async () => {
  const legacy = createContext();
  legacy.win.Notification.requestPermission = function requestPermission(callback) { callback('granted'); };
  assert.equal(await legacy.win.PWA.requestPushPermission(), 'granted', 'the callback channel is honoured');

  const promised = createContext();
  promised.win.Notification.requestPermission = function requestPermission() { return Promise.resolve('granted'); };
  assert.equal(await promised.win.PWA.requestPushPermission(), 'granted', 'the promise channel is honoured');

  const unsupported = createContext();
  assert.equal(await unsupported.win.PWA.requestPushPermission(), 'denied', 'a browser without the API resolves instead of throwing');

  const revoked = createContext();
  revoked.win.Notification.permission = 'default';
  revoked.win.Notification.requestPermission = function requestPermission() { return Promise.reject(new Error('blocked')); };
  assert.equal(await revoked.win.PWA.requestPushPermission(), 'denied', 'a rejected request resolves denied');
});

/* ------------------------------------------------------------------ *
 * Stage 3 regressions (2026-11): diagnostics dialog event contract
 * ------------------------------------------------------------------ */

function diagnosticsContext() {
  const harness = createContext();
  return harness;
}

function retryButtonOf(flow) {
  return findAll(flow, (node) => node.tagName === 'BUTTON')[0] || null;
}

test('the diagnostics dialog publishes pwa:diagnostics when the check succeeds', async () => {
  const harness = diagnosticsContext();
  let checks = 0;
  harness.win.YouGeDns = {
    check() {
      checks += 1;
      return Promise.resolve({ classification: 'normal_connectivity', message: 'DNS resolved and the app responded.' });
    },
  };

  const flow = harness.win.PWA.showNetworkDiagnostics();
  assert.ok(flow, 'the dialog is created');
  assert.equal(flow.getAttribute('role'), 'dialog');
  assert.equal(flow.getAttribute('aria-modal'), 'true');

  retryButtonOf(flow).dispatch('click');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(checks, 1, 'the network check runs only on the user action');
  const events = harness.events.filter((entry) => entry.type === 'pwa:diagnostics');
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.classification, 'normal_connectivity');
  assert.notEqual(events[0].detail.failed, true);
});

test('a rejected diagnostics check still publishes pwa:diagnostics with a consistent failure result', async () => {
  const harness = diagnosticsContext();
  harness.win.YouGeDns = {
    check() {
      return Promise.reject(new Error('Network down'));
    },
  };

  const flow = harness.win.PWA.showNetworkDiagnostics();
  retryButtonOf(flow).dispatch('click');
  await new Promise((resolve) => setTimeout(resolve, 0));

  const events = harness.events.filter((entry) => entry.type === 'pwa:diagnostics');
  assert.equal(events.length, 1, 'the state layer must never miss a failed modal check');
  const detail = events[0].detail;
  assert.equal(detail.failed, true);
  assert.equal(detail.classification, 'error');
  assert.equal(detail.status, 'error');
  assert.match(detail.message, /Network down/);
  assert.match(textOf(flow), /could not complete/i, 'the dialog still explains the failure to the user');
});

test('a diagnostics module that is missing does not publish a misleading result', async () => {
  const harness = diagnosticsContext();
  harness.win.YouGeDns = undefined;

  const flow = harness.win.PWA.showNetworkDiagnostics();
  retryButtonOf(flow).dispatch('click');
  await new Promise((resolve) => setTimeout(resolve, 0));

  const events = harness.events.filter((entry) => entry.type === 'pwa:diagnostics');
  assert.equal(events.length, 1);
  assert.equal(events[0].detail.classification, 'unknown');
  assert.equal(events[0].detail.status, 'unavailable');
  assert.match(events[0].detail.message, /not loaded/i);
});
