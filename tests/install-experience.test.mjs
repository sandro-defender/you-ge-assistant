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
  set className(value) {
    this._className = String(value || '');
  }

  hasClass(name) {
    return this.classList.contains(name) || this._className.split(/\s+/).includes(name);
  }

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
  matches(selector) {
    const text = String(selector || '').trim();
    if (!text) return false;
    return text.split(',').some((part) => {
      const s = part.trim();
      if (s.startsWith('.')) return this.hasClass(s.slice(1).split(':')[0]);
      const attrMatch = /^\[([^\]=]+)(?:="?([^"\]]*)"?)?\]$/.exec(s);
      if (attrMatch) {
        if (!this.hasAttribute(attrMatch[1])) return false;
        return attrMatch[2] === undefined ? true : this.getAttribute(attrMatch[1]) === attrMatch[2];
      }
      if (s.startsWith('#')) return this.id === s.slice(1);
      return this.tagName.toLowerCase() === s.toLowerCase();
    });
  }
  querySelector(selector) {
    return findAll(this, (node) => node !== this && node.matches(selector))[0] || null;
  }
  querySelectorAll(selector) {
    return findAll(this, (node) => node !== this && node.matches(selector));
  }
  contains(target) {
    let cur = target;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }
  closest(selector) {
    let cur = this;
    while (cur) {
      if (cur.matches(selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
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
      return findAll(doc.body, (node) => node !== doc.body && node.matches(selector))[0] || null;
    },
    querySelectorAll(selector) {
      const pool = options.installButtons || [];
      if (!pool.length) {
        return findAll(doc.body, (node) => node !== doc.body && node.matches(selector));
      }
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

  const swListeners = new Map();
  const defaultRegistration = options.registration || createFakeRegistration();
  const serviceWorker = {
    registerCalls: [],
    controller: options.controller !== undefined ? options.controller : null,
    ready: Promise.resolve(defaultRegistration),
    register(url, opts) {
      serviceWorker.registerCalls.push([url, opts]);
      if (options.registerError) return Promise.reject(options.registerError);
      return Promise.resolve(defaultRegistration);
    },
    addEventListener(type, listener) {
      const list = swListeners.get(type) || [];
      list.push(listener);
      swListeners.set(type, list);
    },
    removeEventListener(type, listener) {
      swListeners.set(type, (swListeners.get(type) || []).filter((entry) => entry !== listener));
    },
    dispatch(type, event = {}) {
      for (const listener of swListeners.get(type) || []) {
        listener(event);
      }
    },
  };

  let reloadCalls = 0;
  const location = {
    href: 'https://example.test/',
    hostname: 'example.test',
    origin: 'https://example.test',
    protocol: 'https:',
    pathname: '/',
    search: '',
    reload() { reloadCalls += 1; },
  };

  let nowMs = options.initialNow ?? 1_700_000_000_000;
  let nextTimerId = 1;
  const timers = new Map();
  const RealDate = Date;
  class FakeDate extends RealDate {
    static now() { return nowMs; }
  }

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
  if (options.domainConfig) {
    win.YouGeDomain = {
      resolve: () => options.domainConfig,
    };
  }
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
    Date: options.fakeClock ? FakeDate : Date,
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
    setTimeout(fn, ms = 0) {
      if (!options.fakeTimers) return 0;
      const id = nextTimerId++;
      timers.set(id, { fn, at: nowMs + ms });
      return id;
    },
    clearTimeout(id) {
      if (options.fakeTimers) timers.delete(id);
    },
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
  return {
    context,
    win,
    doc,
    navigator,
    media,
    serviceWorker,
    registration: defaultRegistration,
    windowListeners,
    documentListeners,
    events,
    get reloadCalls() { return reloadCalls; },
    advanceTime(ms) {
      nowMs += ms;
      if (!options.fakeTimers) return;
      for (const [id, entry] of [...timers.entries()].sort((a, b) => a[1].at - b[1].at)) {
        if (entry.at <= nowMs) {
          timers.delete(id);
          entry.fn();
        }
      }
    },
    pendingTimerCount() { return timers.size; },
  };
}

function createFakeWorker(initialState = 'installing') {
  const listeners = new Map();
  const messages = [];
  return {
    state: initialState,
    messages,
    postMessage(msg) { messages.push(msg); },
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    setState(nextState) {
      this.state = nextState;
      for (const fn of listeners.get('statechange') || []) fn({ target: this });
    },
  };
}

function createFakeRegistration(overrides = {}) {
  const listeners = new Map();
  const reg = {
    scope: 'https://example.test/',
    waiting: null,
    installing: null,
    active: null,
    updateCalls: 0,
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    dispatch(type, event = {}) {
      for (const fn of listeners.get(type) || []) fn(event);
    },
    update() {
      reg.updateCalls += 1;
      return Promise.resolve(reg);
    },
    ...overrides,
  };
  return reg;
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

/* ------------------------------------------------------------------ *
 * Stage 4 regressions (2026-11): SW update lifecycle & diagnostics UX
 * ------------------------------------------------------------------ */

test('detects pre-existing reg.waiting on register when controlled and supports auto-update', async () => {
  const waiting = createFakeWorker('installed');
  const reg = createFakeRegistration({ waiting });
  const observedStates = [];
  const harness = createContext({
    controller: { state: 'activated' },
    registration: reg,
    fakeTimers: true,
  });
  harness.win.PWA.onChange((state) => observedStates.push(state.hasUpdate));

  await harness.win.PWA.register();

  assert.equal(harness.win.PWA.hasUpdate(), true);
  assert.equal(harness.win.PWA.getState().hasUpdate, true);
  assert.equal(observedStates.at(-1), true, 'onChange receives hasUpdate: true');
  assert.equal(harness.events.filter((e) => e.type === 'pwa:update').length, 1);
  assert.equal(waiting.messages.length, 0, 'does not auto-apply without data-auto-update');

  // With data-auto-update="true", registration immediately posts SKIP_WAITING
  const autoWaiting = createFakeWorker('installed');
  const autoReg = createFakeRegistration({ waiting: autoWaiting });
  const autoHarness = createContext({
    controller: { state: 'activated' },
    registration: autoReg,
    dataset: { autoUpdate: 'true' },
    fakeTimers: true,
  });
  await autoHarness.win.PWA.register();
  assert.equal(autoWaiting.messages.length, 1);
  assert.equal(autoWaiting.messages[0].type, 'SKIP_WAITING');
});

test('updatefound emits pwa:update only after an existing controller is present, then applyUpdate reloads once', async () => {
  // 1. First install (no controller) must NOT signal an update
  const firstInstallReg = createFakeRegistration();
  const firstHarness = createContext({ controller: null, registration: firstInstallReg, fakeTimers: true });
  await firstHarness.win.PWA.register();
  const initialWorker = createFakeWorker('installing');
  firstInstallReg.installing = initialWorker;
  firstInstallReg.dispatch('updatefound');
  initialWorker.setState('installed');
  assert.equal(firstHarness.win.PWA.hasUpdate(), false);
  assert.equal(firstHarness.events.filter((e) => e.type === 'pwa:update').length, 0);

  // 2. Controlled update -> installed -> applyUpdate() -> controllerchange triggers single reload & cancels 3s fallback
  const reg = createFakeRegistration();
  const harness = createContext({ controller: { state: 'activated' }, registration: reg, fakeTimers: true });
  await harness.win.PWA.register();

  const nextWorker = createFakeWorker('installing');
  reg.installing = nextWorker;
  reg.dispatch('updatefound');
  reg.waiting = nextWorker;
  nextWorker.setState('installed');

  assert.equal(harness.win.PWA.hasUpdate(), true);
  assert.equal(harness.events.filter((e) => e.type === 'pwa:update').length, 1);

  const applied = await harness.win.PWA.applyUpdate();
  assert.equal(applied, true);
  assert.equal(nextWorker.messages.length, 1);
  assert.equal(nextWorker.messages[0].type, 'SKIP_WAITING');

  // Simulate normal controllerchange activation before the 3000ms fallback
  reg.waiting = null;
  harness.serviceWorker.controller = nextWorker;
  harness.serviceWorker.dispatch('controllerchange');
  assert.equal(harness.reloadCalls, 1, 'controllerchange reloads the page once');
  assert.equal(harness.win.PWA.hasUpdate(), false, 'update state clears after controllerchange');

  // Advancing past 3000ms must NOT trigger a duplicate second reload
  harness.advanceTime(3500);
  assert.equal(harness.reloadCalls, 1, 'fallback timer is cancelled once controllerchange fires');
});

test('applyUpdate triggers a 3000ms fallback reload if controllerchange never fires and returns false on postMessage failure', async () => {
  const waiting = createFakeWorker('installed');
  const reg = createFakeRegistration({ waiting });
  const harness = createContext({ controller: { state: 'activated' }, registration: reg, fakeTimers: true });
  await harness.win.PWA.register();

  assert.equal(await harness.win.PWA.applyUpdate(), true);
  assert.equal(harness.reloadCalls, 0);
  harness.advanceTime(3000);
  assert.equal(harness.reloadCalls, 1, '3000ms safety net reloads if controllerchange does not arrive');
  harness.advanceTime(5000);
  assert.equal(harness.reloadCalls, 1);

  // postMessage error keeps waiting update available and returns false without reloading
  const brokenWorker = {
    state: 'installed',
    postMessage() { throw new Error('channel closed'); },
    addEventListener() {},
  };
  const errReg = createFakeRegistration({ waiting: brokenWorker });
  const errHarness = createContext({ controller: { state: 'activated' }, registration: errReg, fakeTimers: true });
  await errHarness.win.PWA.register();
  assert.equal(await errHarness.win.PWA.applyUpdate(), false);
  assert.equal(errHarness.win.PWA.hasUpdate(), true, 'valid waiting worker stays reported after transient postMessage throw');
  errHarness.advanceTime(3500);
  assert.equal(errHarness.reloadCalls, 0);
});

test('clears stale updateAvailable without reload loop when waiting worker disappears via applyUpdate, controllerchange or statechange', async () => {
  const waiting = createFakeWorker('installed');
  const reg = createFakeRegistration({ waiting });
  const harness = createContext({ controller: { state: 'activated' }, registration: reg, fakeTimers: true });
  const states = [];
  harness.win.PWA.onChange((s) => states.push(s.hasUpdate));
  await harness.win.PWA.register();
  assert.equal(harness.win.PWA.hasUpdate(), true);

  // Case A: waiting worker disappears before user triggers applyUpdate()
  reg.waiting = null;
  const applied = await harness.win.PWA.applyUpdate();
  assert.equal(applied, false);
  assert.equal(harness.reloadCalls, 0, 'missing waiting worker must not trigger a reload loop');
  assert.equal(harness.win.PWA.hasUpdate(), false, 'stale updateAvailable is cleared');
  assert.equal(states.at(-1), false, 'subscribers observe hasUpdate: false');

  // Case B: external controllerchange (without applyUpdate) clears stale update state with zero reloads
  const worker2 = createFakeWorker('installed');
  reg.installing = worker2;
  reg.dispatch('updatefound');
  reg.waiting = worker2;
  worker2.setState('installed');
  assert.equal(harness.win.PWA.hasUpdate(), true);

  reg.waiting = null;
  harness.serviceWorker.dispatch('controllerchange');
  assert.equal(harness.reloadCalls, 0, 'unsolicited controllerchange does not force reload');
  assert.equal(harness.win.PWA.hasUpdate(), false);

  // Case C: waiting worker transitions to redundant
  const worker3 = createFakeWorker('installed');
  reg.installing = worker3;
  reg.dispatch('updatefound');
  reg.waiting = worker3;
  worker3.setState('installed');
  assert.equal(harness.win.PWA.hasUpdate(), true);

  reg.waiting = null;
  worker3.setState('redundant');
  assert.equal(harness.win.PWA.hasUpdate(), false);
  assert.equal(states.at(-1), false);

  // Case D: a newer installing worker turning redundant does NOT clear an older still-waiting worker
  const olderWaiting = createFakeWorker('installed');
  reg.waiting = olderWaiting;
  const failingNew = createFakeWorker('installing');
  reg.installing = failingNew;
  reg.dispatch('updatefound');
  failingNew.setState('redundant');
  assert.equal(harness.win.PWA.hasUpdate(), true, 'valid waiting worker stays preserved');
});

test('visibilitychange throttles registration.update to once per hour and reconciles cleared waiting state', async () => {
  const waiting = createFakeWorker('installed');
  const reg = createFakeRegistration({ waiting });
  const harness = createContext({
    controller: { state: 'activated' },
    registration: reg,
    fakeTimers: true,
    fakeClock: true,
  });
  await harness.win.PWA.register();
  assert.equal(harness.win.PWA.hasUpdate(), true);

  // Within 1h window -> throttled
  harness.advanceTime(30 * 60 * 1000);
  harness.doc.dispatch('visibilitychange');
  assert.equal(reg.updateCalls, 0, 'update check is throttled below 1 hour');

  // Past 1h window -> registration.update() runs and reconciles cleared reg.waiting
  reg.waiting = null;
  harness.advanceTime(31 * 60 * 1000);
  harness.doc.dispatch('visibilitychange');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(reg.updateCalls, 1);
  assert.equal(harness.win.PWA.hasUpdate(), false, 'reconciles stale update when registration.update finishes with no waiting worker');
});

test('showNetworkDiagnostics manages click trigger, singleton reuse, dnsRecovery toggle, concurrency lock and removal lifecycle', async () => {
  const trigger = new FakeNode('button');
  trigger.setAttribute('data-pwa-diagnostics', '');
  let resolveCheck;
  let checks = 0;

  const harness = createContext({
    fakeTimers: true,
    domainConfig: {
      identity: { name: 'Diag App', shortName: 'Diag', description: '' },
      branding: { icon: '/icon.png', themeColor: '#155eef' },
      pwa: { enabled: true, basePath: '/' },
      domain: { hostname: 'diag.example.test', origin: 'https://diag.example.test', protocol: 'https:', pathname: '/', basePath: '/', configured: true },
      features: { installation: true, diagnostics: true, dnsRecovery: false },
      diagnostics: {},
    },
  });
  harness.doc.body.appendChild(trigger);
  harness.win.YouGeDns = {
    check() {
      checks += 1;
      return new Promise((resolve) => { resolveCheck = resolve; });
    },
  };

  // 1. Click trigger opens singleton dialog and respects dnsRecovery: false
  harness.doc.dispatch('click', { target: trigger });
  const flow = harness.doc.querySelector('[data-pwa-diagnostics-dialog]');
  assert.ok(flow, 'clicking [data-pwa-diagnostics] opens dialog');
  assert.equal(harness.win.PWA.showNetworkDiagnostics(), flow, 'second call returns existing singleton');

  const recovery = findAll(flow, (n) => n.hasClass('pwa-diagnostics-recovery'))[0];
  assert.ok(recovery);
  assert.equal(recovery.hidden, true, 'dnsRecovery: false hides recovery guide');

  // 2. Concurrent clicks while check is in-flight only execute one check
  const runBtn = findAll(flow, (n) => n.hasClass('pwa-flow-btn'))[0];
  runBtn.dispatch('click');
  runBtn.dispatch('click');
  assert.equal(checks, 1, 'concurrent run while in-flight is ignored');
  assert.equal(runBtn.disabled, true);

  resolveCheck({ classification: 'normal_connectivity', message: 'Healthy DNS.' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(runBtn.disabled, false);

  // 3. Close button, Escape key, and backdrop click all remove the dialog after 300ms
  const closeBtn = findAll(flow, (n) => n.getAttribute('aria-label') === 'Close')[0];
  closeBtn.dispatch('click');
  assert.ok(flow.classList.contains('removing'));
  harness.advanceTime(300);
  assert.equal(harness.doc.querySelector('[data-pwa-diagnostics-dialog]'), null, 'close button removes dialog');

  const flow2 = harness.win.PWA.showNetworkDiagnostics();
  harness.doc.dispatch('keydown', { key: 'Escape' });
  harness.advanceTime(300);
  assert.equal(harness.doc.querySelector('[data-pwa-diagnostics-dialog]'), null, 'Escape removes dialog');

  const flow3 = harness.win.PWA.showNetworkDiagnostics();
  flow3.dispatch('click', { target: flow3 });
  harness.advanceTime(300);
  assert.equal(harness.doc.querySelector('[data-pwa-diagnostics-dialog]'), null, 'backdrop click removes dialog');
});
