/*!
 * Intelligent Floating Assistant — centralized state + DOM renderer tests.
 * Uses a small VM harness so the classic scripts are exercised without a
 * browser, without network access and without a second state implementation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const stateSource = readFileSync(fileURLToPath(new URL('../src/assistant/assistant-state.js', import.meta.url)), 'utf8');
const widgetSource = readFileSync(fileURLToPath(new URL('../src/assistant/assistant-widget.js', import.meta.url)), 'utf8');
const widgetCss = readFileSync(fileURLToPath(new URL('../src/assistant/assistant-widget.css', import.meta.url)), 'utf8');
const mainJsx = readFileSync(fileURLToPath(new URL('../examples/example/src/main.jsx', import.meta.url)), 'utf8');
const demoHtml = readFileSync(fileURLToPath(new URL('../examples/demo/index.html', import.meta.url)), 'utf8');
const exampleHtml = readFileSync(fileURLToPath(new URL('../examples/example/index.html', import.meta.url)), 'utf8');
const offlineHtml = readFileSync(fileURLToPath(new URL('../src/offline/offline.html', import.meta.url)), 'utf8');
const snippetHtml = readFileSync(fileURLToPath(new URL('../docs/guides/snippet.html', import.meta.url)), 'utf8');

function makeTarget() {
  const listeners = new Map();
  return {
    _listeners: listeners,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      const set = listeners.get(type);
      if (set) set.delete(listener);
    },
    _fire(event) {
      const set = listeners.get(event.type);
      if (set) Array.from(set).forEach((listener) => listener(event));
    },
    dispatchEvent(event) {
      this._fire(event);
      return true;
    },
    listenerCount(type) {
      const set = listeners.get(type);
      return set ? set.size : 0;
    },
  };
}

class FakeNode {
  constructor(tag, ownerDocument) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = ownerDocument || null;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this._className = '';
    this._textContent = '';
    this._innerHTML = '';
    this.hidden = false;
    this._listeners = new Map();
    this.style = {
      setProperty(name, value) { this[name] = value; },
    };
    const self = this;
    const classes = new Set();
    function sync() { self._className = Array.from(classes).join(' '); }
    this.classList = {
      add(...names) { names.forEach((name) => classes.add(name)); sync(); },
      remove(...names) { names.forEach((name) => classes.delete(name)); sync(); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name); else classes.delete(name);
        sync();
        return shouldAdd;
      },
    };
  }

  get className() { return this._className; }
  set className(value) {
    this._className = String(value || '');
    const classes = new Set(this._className.split(/\s+/).filter(Boolean));
    const self = this;
    function sync() { self._className = Array.from(classes).join(' '); }
    this.classList = {
      add(...names) { names.forEach((name) => classes.add(name)); sync(); },
      remove(...names) { names.forEach((name) => classes.delete(name)); sync(); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) classes.add(name); else classes.delete(name);
        sync();
        return shouldAdd;
      },
    };
  }

  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get textContent() { return this._textContent; }
  set textContent(value) { this._textContent = String(value == null ? '' : value); this.children = []; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) { this._innerHTML = String(value == null ? '' : value); }
  get firstChild() { return this.children[0] || null; }

  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null; }
  hasAttribute(name) { return this.attributes.has(String(name)); }
  removeAttribute(name) { this.attributes.delete(String(name)); }

  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  matches(selector) {
    return String(selector).split(',').some((part) => {
      const text = part.trim();
      const attr = /^\[([^\]=]+)(?:=["']([^"']*)["'])?\]$/.exec(text);
      if (attr) {
        if (!this.hasAttribute(attr[1])) return false;
        return attr[2] === undefined || this.getAttribute(attr[1]) === attr[2];
      }
      const className = /^\.([\w-]+)$/.exec(text);
      if (className) return this.classList.contains(className[1]);
      const idName = /^#([\w-]+)$/.exec(text);
      if (idName) return this.id === idName[1];
      const tagName = /^[a-zA-Z][\w-]*$/.exec(text);
      if (tagName) return this.tagName === tagName[0].toUpperCase();
      return false;
    });
  }
  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches && current.matches(selector)) return current;
      current = current.parentNode;
    }
    return null;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }
  querySelectorAll(selector, out = []) {
    for (const child of this.children) {
      if (child.matches(selector)) out.push(child);
      child.querySelectorAll(selector, out);
    }
    return out;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    const set = this._listeners.get(type);
    if (set) set.delete(listener);
  }
  _fire(event) {
    const set = this._listeners.get(event.type);
    if (set) Array.from(set).forEach((listener) => listener(event));
  }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function makeDocument(rich) {
  const target = makeTarget();
  const doc = Object.assign({
    readyState: 'complete',
    visibilityState: 'visible',
    activeElement: null,
  }, target);
  if (!rich) {
    doc.body = { appendChild() {}, removeChild() {}, contains() { return false; } };
    doc.createElement = () => ({ setAttribute() {}, appendChild() {}, style: { setProperty() {} } });
    doc.getElementById = () => null;
    doc.querySelector = () => null;
    return doc;
  }
  doc.body = new FakeNode('body', doc);
  doc.createElement = (tag) => new FakeNode(tag, doc);
  doc.getElementById = (id) => findById(doc.body, id);
  doc.querySelector = (selector) => doc.body.querySelector(selector);
  return doc;
}

function makeStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    clear() { map.clear(); },
    _map: map,
  };
}

function makePwa(initial = {}) {
  const pwaState = Object.assign({
    installed: false, standalone: false, canInstall: false, ios: false, safari: false,
    hostname: 'example.test', origin: 'https://example.test',
  }, initial);
  let changeListener = null;
  const calls = { diagnostics: 0, install: 0, showDialog: 0, applyUpdate: 0 };
  return {
    state: pwaState,
    calls,
    config: { features: { installation: true, diagnostics: true } },
    getState() { return Object.assign({}, pwaState); },
    onChange(listener) {
      changeListener = listener;
      listener(this.getState());
      return () => { if (changeListener === listener) changeListener = null; };
    },
    isInstalled() { return pwaState.installed || pwaState.standalone; },
    canInstall() { return pwaState.canInstall; },
    isIOS() { return pwaState.ios; },
    isSafari() { return pwaState.safari; },
    promptInstall() { calls.install += 1; return Promise.resolve({ outcome: 'accepted' }); },
    runNetworkDiagnostics() { calls.diagnostics += 1; return Promise.resolve({ classification: 'normal_connectivity', message: 'OK' }); },
    showNetworkDiagnostics() { calls.showDialog += 1; return {}; },
    applyUpdate() { calls.applyUpdate += 1; },
    emitChange() { if (changeListener) changeListener(this.getState()); },
  };
}

function createContext(options = {}) {
  const document = makeDocument(Boolean(options.richDocument));
  const win = Object.assign({}, makeTarget());
  const storage = options.storage || makeStorage();
  const pwa = options.pwa === null ? null : (options.pwa || makePwa(options.pwaState));
  win.window = win;
  win.self = win;
  win.document = document;
  win.location = {
    href: options.href || 'https://example.test/',
    hostname: 'example.test',
    origin: 'https://example.test',
    protocol: 'https:',
    pathname: '/',
  };
  win.navigator = { onLine: options.online !== false };
  if (options.userAgent !== undefined) win.navigator.userAgent = options.userAgent;
  win.localStorage = storage;
  win.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
  win.URL = URL;
  win.Date = Date;
  win.Promise = Promise;
  win.JSON = JSON;
  win.Set = Set;
  win.Map = Map;
  win.Math = Math;
  win.Object = Object;
  win.Array = Array;
  win.String = String;
  win.Number = Number;
  win.Boolean = Boolean;
  win.RegExp = RegExp;
  win.Error = Error;
  win.isFinite = isFinite;
  win.parseInt = parseInt;
  win.parseFloat = parseFloat;
  win.encodeURIComponent = encodeURIComponent;
  win.decodeURIComponent = decodeURIComponent;
  win.console = console;
  win.matchMedia = () => ({ matches: Boolean(options.reducedMotion) });
  win.requestAnimationFrame = (fn) => { fn(); return 1; };
  win.setTimeout = (fn) => { fn(); return 1; };
  win.clearTimeout = () => {};
  win.YOU_GE_ASSISTANT_CONFIG = options.config || {};
  win.PWA = pwa;
  win.YouGeDomain = {
    // Mirrors a real registry: the resolved hostname follows the location the
    // assistant asks about, so domain reconfiguration is observable.
    resolve: (loc = {}) => {
      const hostname = loc.hostname || 'example.test';
      const origin = loc.origin || 'https://' + hostname;
      return {
        identity: { name: 'Example Project', shortName: 'Example', description: '' },
        branding: { icon: 'icons/icon-192.png', themeColor: '#155eef' },
        pwa: { basePath: '/' },
        domain: { hostname, origin, protocol: 'https:', pathname: '/', basePath: '/', configured: true },
        features: { installation: true, diagnostics: true },
      };
    },
  };
  vm.createContext(win);
  vm.runInContext(stateSource, win, { filename: 'assistant-state.js' });
  return { win, document, storage, pwa, api: win.YouGeAssistant };
}

function loadWidget(ctx) {
  vm.runInContext(widgetSource, ctx.win, { filename: 'assistant-widget.js' });
  return ctx.win.YouGeAssistantWidget;
}

function fire(document, node, type, props = {}) {
  const event = Object.assign({ type, target: node, detail: undefined }, props);
  let current = node;
  while (current) {
    if (current._fire) current._fire(event);
    current = current.parentNode;
  }
  document._fire(event);
  return event;
}

function noticeIds(state) { return state.notifications.map((notice) => notice.id); }

/* ------------------------------------------------------------------ *
 * 1–3. Installation capability / already installed / unsupported
 * ------------------------------------------------------------------ */

test('installable browser advertises a native install action at priority 4', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  const state = ctx.api.getState();
  assert.equal(state.installation.support, 'native');
  assert.equal(state.installation.status, 'available');
  assert.equal(state.installation.nativeAvailable, true);
  assert.ok(noticeIds(state).includes('install:available'));
  assert.equal(state.notifications.find((n) => n.id === 'install:available').priority, 4);
  assert.ok(state.availableActions.some((action) => action.id === 'install'));
});

test('already-installed PWA suppresses install suggestions and badges', () => {
  const ctx = createContext({ pwaState: { installed: true, standalone: true, canInstall: true } });
  const state = ctx.api.getState();
  assert.equal(state.installation.status, 'installed');
  assert.equal(noticeIds(state).includes('install:available'), false);
  assert.equal(state.availableActions.some((action) => action.id === 'install'), false);
  assert.equal(state.badge.count, 0);
});

test('unsupported installation browser and disabled module suppress install suggestions', () => {
  const unsupported = createContext({ pwa: null });
  assert.equal(unsupported.api.getState().installation.support, 'none');
  assert.equal(noticeIds(unsupported.api.getState()).includes('install:available'), false);

  const disabled = createContext({
    pwaState: { canInstall: true },
    config: { modules: { installation: false } },
  });
  assert.equal(disabled.api.getState().installation.support, 'none');
  assert.equal(disabled.api.getState().capabilities.installation, false);
});

test('iOS Safari gets platform-specific manual instructions, generic browsers get generic help', () => {
  const ios = createContext({ pwaState: { ios: true, safari: true } });
  assert.equal(ios.api.getState().installation.support, 'manual-ios');
  assert.equal(ios.api.getState().installation.nativeAvailable, false);

  const generic = createContext({ pwaState: { ios: false, safari: false } });
  assert.equal(generic.api.getState().installation.support, 'manual-generic');
});

/* ------------------------------------------------------------------ *
 * 4–7. Network, DNS, primary/backup endpoints and recovery
 * ------------------------------------------------------------------ */

test('network failure raises a persistent critical connectivity notice', () => {
  const ctx = createContext();
  ctx.win.dispatchEvent({ type: 'offline' });
  const state = ctx.api.getState();
  assert.equal(state.network.online, false);
  assert.ok(noticeIds(state).includes('network:offline'));
  const notice = state.notifications.find((n) => n.id === 'network:offline');
  assert.equal(notice.priority, 1);
  assert.equal(notice.critical, true);
  assert.equal(notice.dismissible, false);
  assert.equal(state.badge.tone, 'critical');
  assert.equal(ctx.api.dismiss('network:offline'), false);
});

test('DNS failure classification raises a critical DNS notice with diagnostics action', () => {
  const ctx = createContext();
  ctx.api.setDnsResult({ classification: 'dns_resolution_failure', message: 'NXDOMAIN returned.' });
  const state = ctx.api.getState();
  assert.ok(noticeIds(state).includes('dns:failure'));
  assert.equal(state.notifications.find((n) => n.id === 'dns:failure').priority, 1);
  assert.ok(state.availableActions.some((action) => action.id === 'diagnostics'));
  assert.ok(state.availableActions.some((action) => action.id === 'recovery'));
});

test('primary API failure is critical; backup activation is priority 3; primary recovery is info', () => {
  const ctx = createContext();
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'inactive', active: 'primary', reason: 'Primary timeout.' });
  assert.ok(noticeIds(ctx.api.getState()).includes('api:primary-failed'));
  assert.equal(ctx.api.getState().badge.tone, 'critical');

  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'Using backup.' });
  let state = ctx.api.getState();
  assert.ok(noticeIds(state).includes('api:backup-active'));
  assert.equal(state.notifications.find((n) => n.id === 'api:backup-active').priority, 3);

  ctx.api.setEndpointStatus({ primary: 'healthy', backup: 'inactive', active: 'primary' });
  state = ctx.api.getState();
  assert.equal(noticeIds(state).includes('api:backup-active'), false);
  assert.ok(noticeIds(state).includes('api:primary-restored'));
  assert.equal(state.notifications.find((n) => n.id === 'api:primary-restored').priority, 5);
});

test('published project events update session, endpoint and DNS state without polling', () => {
  const ctx = createContext();
  ctx.document.dispatchEvent(new ctx.win.CustomEvent('youge:session-status', { detail: { state: 'issue', message: 'Session expired.' } }));
  assert.equal(ctx.api.getState().network.session.state, 'issue');
  assert.equal(ctx.api.getState().notifications.find((n) => n.id === 'session:issue').priority, 2);

  ctx.document.dispatchEvent(new ctx.win.CustomEvent('youge:endpoint-status', { detail: { primary: 'failed', backup: 'active', active: 'backup' } }));
  assert.equal(ctx.api.getState().network.endpoints.backup, 'active');

  ctx.document.dispatchEvent(new ctx.win.CustomEvent('youge:dns-result', { detail: { classification: 'dns_records_missing', message: 'No A/AAAA records.' } }));
  assert.equal(ctx.api.getState().network.dns.classification, 'dns_records_missing');
  assert.ok(noticeIds(ctx.api.getState()).includes('dns:failure'));
});

/* ------------------------------------------------------------------ *
 * 8–11. Priority, dismissal, repeats, project scoping
 * ------------------------------------------------------------------ */

test('multiple simultaneous notifications are ordered by the fixed priority ladder', () => {
  const ctx = createContext({
    pwaState: { canInstall: true },
    config: {
      features: [{ id: 'new-insights', label: 'Connection insights', message: 'New capability.' }],
    },
  });
  ctx.win.dispatchEvent({ type: 'offline' });
  ctx.api.setSessionStatus({ state: 'issue', message: 'Session expired.' });
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  const state = ctx.api.getState();
  const priorities = state.notifications.map((n) => n.priority);
  assert.deepEqual([...new Set(priorities)], [1, 2, 3, 4, 5]);
  assert.equal(priorities[0], 1);
  assert.equal(priorities[priorities.length - 1], 5);
  assert.equal(state.badge.count, state.notifications.length);
  assert.equal(state.badge.tone, 'critical');
});

test('non-critical suggestions can be dismissed; critical recovery needs acknowledgement', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  assert.equal(ctx.api.dismiss('install:available'), true);
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);
  assert.equal(ctx.api.getState().badge.count, 0);

  ctx.win.dispatchEvent({ type: 'offline' });
  assert.equal(ctx.api.dismiss('network:offline'), false);
  assert.equal(ctx.api.acknowledge('network:offline'), true);
  assert.equal(noticeIds(ctx.api.getState()).includes('network:offline'), false);
});

test('dismissed suggestions stay suppressed until the condition resolves, then can reappear', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  assert.equal(ctx.api.dismiss('install:available'), true);
  ctx.pwa.emitChange();
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);

  // Install the app: the install condition resolves and clears suppression.
  ctx.pwa.state.installed = true;
  ctx.pwa.state.canInstall = false;
  ctx.pwa.emitChange();
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);

  // A later fresh installable state is a new condition and is shown again.
  ctx.pwa.state.installed = false;
  ctx.pwa.state.canInstall = true;
  ctx.pwa.emitChange();
  assert.ok(noticeIds(ctx.api.getState()).includes('install:available'));
});

test('multi-page navigation keeps dismissals through project-scoped storage; projects stay isolated', () => {
  const storage = makeStorage();
  const first = createContext({ storage, pwaState: { canInstall: true }, config: { projectId: 'project-a' } });
  assert.equal(first.api.dismiss('install:available'), true);

  const second = createContext({ storage, pwaState: { canInstall: true }, config: { projectId: 'project-a' } });
  assert.equal(noticeIds(second.api.getState()).includes('install:available'), false, 'dismissal survives navigation');

  second.api.configure({ projectId: 'project-b', branding: { name: 'Project B' } });
  const stateB = second.api.getState();
  assert.equal(stateB.project.id, 'project-b');
  assert.equal(stateB.project.name, 'Project B');
  assert.ok(noticeIds(stateB).includes('install:available'), 'a different project has its own notice state');
  assert.ok(Array.from(storage._map.keys()).some((key) => key.includes('project-a')));
  assert.ok(Array.from(storage._map.keys()).some((key) => key.includes('project-b')));
});

/* ------------------------------------------------------------------ *
 * 12–14. SDK configuration, lifecycle, diagnostics, runtime widget
 * ------------------------------------------------------------------ */

test('SDK configuration controls branding, position, offsets, modules, theme, actions and features', () => {
  const ctx = createContext({
    config: {
      projectId: 'custom-project',
      position: 'bottom-left',
      offsets: { x: 32, y: 40 },
      theme: 'dark',
      branding: { name: 'Custom Brand', shortName: 'Custom', icon: 'icons/icon-192.png', themeColor: '#123456' },
      modules: { failover: false, updates: false },
      actions: [{ id: 'open-help', label: 'Open help', icon: 'help', kind: 'help', priority: 5 }],
      features: [{ id: 'new-capability', label: 'New capability', message: 'Available now.' }],
    },
  });
  const state = ctx.api.getState();
  assert.equal(state.project.id, 'custom-project');
  assert.equal(state.project.name, 'Custom Brand');
  assert.equal(state.appearance.position, 'bottom-left');
  assert.equal(state.appearance.offsets.x, 32);
  assert.equal(state.appearance.offsets.y, 40);
  assert.equal(state.appearance.theme, 'dark');
  assert.equal(state.capabilities.failover, false);
  assert.equal(state.capabilities.updates, false);
  assert.ok(state.availableActions.some((action) => action.id === 'open-help'));
  assert.ok(noticeIds(state).includes('feature:new-capability'));
  assert.equal(state.notifications.find((n) => n.id === 'feature:new-capability').priority, 5);
});

test('PWA update event produces an update action; app-installed event changes install state', () => {
  const ctx = createContext({ pwaState: { canInstall: true } });
  ctx.document.dispatchEvent(new ctx.win.CustomEvent('pwa:update', { detail: {} }));
  let state = ctx.api.getState();
  assert.ok(noticeIds(state).includes('app:update'));
  assert.ok(state.availableActions.some((action) => action.id === 'update'));
  ctx.document.dispatchEvent(new ctx.win.CustomEvent('pwa:update', { detail: {} }));
  state = ctx.api.getState();
  assert.equal(state.notifications.filter((notice) => notice.id === 'app:update').length, 1);
  assert.equal(state.availableActions.filter((action) => action.id === 'update').length, 1);

  ctx.document.dispatchEvent(new ctx.win.CustomEvent('pwa:installed', { detail: {} }));
  state = ctx.api.getState();
  assert.equal(state.installation.status, 'available'); // PWA.getState still reports not installed
  ctx.pwa.state.installed = true;
  ctx.document.dispatchEvent(new ctx.win.CustomEvent('pwa:installed', { detail: {} }));
  assert.equal(ctx.api.getState().installation.status, 'installed');
});

test('diagnostics are single-flight and delegated, never duplicated', async () => {
  const ctx = createContext();
  const first = ctx.api.runDiagnostics();
  const second = ctx.api.runDiagnostics();
  assert.equal(first, second, 'concurrent calls share one promise');
  await Promise.all([first, second]);
  assert.equal(ctx.pwa.calls.diagnostics, 1);
  assert.equal(ctx.api.getState().network.dns.classification, 'normal_connectivity');
});

test('listeners bind once, reconfiguration does not duplicate them, and destroy cleans up', () => {
  const ctx = createContext();
  assert.equal(ctx.win.listenerCount('offline'), 1);
  assert.equal(ctx.document.listenerCount('youge:endpoint-status'), 1);
  ctx.api.configure({ projectId: 'still-one' });
  ctx.api.configure({ projectId: 'still-two' });
  assert.equal(ctx.win.listenerCount('offline'), 1);
  assert.equal(ctx.document.listenerCount('youge:endpoint-status'), 1);
  ctx.api.destroy();
  assert.equal(ctx.win.listenerCount('offline'), 0);
  assert.equal(ctx.document.listenerCount('youge:endpoint-status'), 0);
});

test('state core has no fetch, service worker registration, polling, dashboard host or heavy deps', () => {
  const code = stateSource.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /\bfetch\s*\(/);
  assert.doesNotMatch(code, /\.register\s*\(/);
  assert.doesNotMatch(code, /setInterval\s*\(/);
  assert.doesNotMatch(code, /staff\.you\.ge/);
  assert.doesNotMatch(code, /\bimport\s/);
  assert.doesNotMatch(code, /ogl|gsap|three|WebGL/);
});

test('widget CSS enforces fixed placement, safe areas, 44px targets, mobile viewport and reduced motion', () => {
  assert.match(widgetCss, /\.youge-assistant-widget\s*\{[^}]*position:\s*fixed/s);
  assert.match(widgetCss, /env\(safe-area-inset/);
  assert.match(widgetCss, /min-height:\s*44px/);
  assert.match(widgetCss, /max-width:\s*480px/);
  assert.match(widgetCss, /100dvh/);
  assert.match(widgetCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(widgetCss, /@keyframes youge-electric-flow/);
  assert.match(widgetCss, /data-attention="active"[^}]*animation: youge-electric-flow/);
  assert.match(widgetCss, /data-attention="static"[^}]*stroke-dasharray: none/);
  assert.match(widgetCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?data-attention="active"[^}]*animation: none/s);
  assert.match(widgetCss, /\.youge-fab\[data-attention="active"\] \.youge-electric-border path \{ animation:/);
});

test('every participating page integrates the widget; React example uses React Bits + centralized state', () => {
  for (const [label, html] of [['demo', demoHtml], ['example', exampleHtml], ['offline', offlineHtml], ['snippet', snippetHtml]]) {
    assert.match(html, /assistant-state\.js/, `${label} loads centralized state`);
    assert.match(html, /YOU_GE_ASSISTANT_CONFIG/, `${label} initializes SDK configuration`);
  }
  assert.match(demoHtml, /assistant-widget\.js/);
  assert.match(offlineHtml, /assistant-widget\.js/);
  assert.match(snippetHtml, /assistant-widget\.js/);
  assert.match(mainJsx, /useSyncExternalStore/);
  for (const name of ['GlareHover', 'SpotlightCard', 'LatticeLoader']) {
    assert.match(mainJsx, new RegExp(name));
  }
  assert.match(mainJsx, /data-pwa-install/);
  assert.match(mainJsx, /data-pwa-diagnostics/);
});

test('DOM renderer mounts a persistent FAB, does not auto-open, and supports click/Escape/keyboard', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.ok(root, 'floating root is mounted');
  assert.equal(root.getAttribute('data-youge-widget'), '');
  const fab = root.querySelector('[data-role="toggle"]');
  const panel = ctx.document.getElementById('youge-assistant-panel');
  assert.ok(fab && panel);
  assert.equal(panel.hidden, true, 'panel never auto-opens');
  assert.equal(fab.getAttribute('aria-expanded'), 'false');
  assert.equal(fab.getAttribute('aria-controls'), 'youge-assistant-panel');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'false');
  assert.ok(root.querySelector('[role="status"]') || root.querySelector('[aria-live]'));

  fire(ctx.document, fab, 'click');
  assert.equal(panel.hidden, false);
  assert.equal(fab.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.classList.contains('is-open'), true);

  ctx.document.dispatchEvent(Object.assign(new ctx.win.CustomEvent('keydown'), { key: 'Escape', type: 'keydown' }));
  assert.equal(fab.getAttribute('aria-expanded'), 'false');
  widget.destroy();
  assert.equal(widget.getRoot(), null);
  assert.equal(ctx.document.listenerCount('keydown'), 0);
});

test('DOM renderer badge is real, prioritized and updates from centralized state', () => {
  const ctx = createContext({ richDocument: true, config: { modules: { installation: false } } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const badge = root.querySelector('.youge-badge');
  assert.ok(badge, 'badge element is rendered');
  assert.equal(badge.hidden, true, 'no badge when there are no alerts');

  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  const state = ctx.api.getState();
  assert.ok(state.badge.count >= 2);
  assert.equal(state.badge.tone, 'critical');
  assert.match(root.querySelector('[data-role="toggle"]').getAttribute('aria-label'), /alerts/);
  assert.equal(badge.hidden, false);
  assert.equal(badge.getAttribute('data-tone'), 'critical');
  widget.destroy();
});

test('DOM renderer dismisses suggestions, acknowledges critical alerts, and dispatches project actions once', () => {
  const ctx = createContext({
    richDocument: true,
    pwaState: { canInstall: true },
    config: { actions: [{ id: 'open-help', label: 'Open help', kind: 'help', priority: 5 }] },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');
  fire(ctx.document, fab, 'click');

  const dismiss = root.querySelector('[data-dismiss="install:available"]');
  assert.ok(dismiss, 'install suggestion has a dismiss control');
  fire(ctx.document, dismiss, 'click');
  assert.equal(noticeIds(ctx.api.getState()).includes('install:available'), false);

  ctx.win.dispatchEvent({ type: 'offline' });
  const acknowledge = root.querySelector('[data-acknowledge="network:offline"]');
  assert.ok(acknowledge, 'critical recovery has an acknowledge control');
  assert.equal(ctx.api.dismiss('network:offline'), false);
  fire(ctx.document, acknowledge, 'click');
  assert.equal(noticeIds(ctx.api.getState()).includes('network:offline'), false);

  const actions = [];
  ctx.document.addEventListener('youge:action', (event) => actions.push(event.detail));
  const help = root.querySelector('[data-action="open-help"]');
  assert.ok(help, 'project-specific action is rendered');
  fire(ctx.document, help, 'click');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].id, 'open-help');
  assert.equal(actions[0].source, 'widget');
  widget.destroy();
});

test('install and diagnostics actions delegate once to existing pwa.js, with no duplicate requests', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');
  fire(ctx.document, fab, 'click');

  let installs = 0;
  ctx.document.addEventListener('click', (event) => {
    if (event.target.closest('[data-pwa-install]')) installs += 1;
  });
  const installButton = root.querySelector('[data-pwa-install]');
  assert.ok(installButton);
  assert.equal(installButton.getAttribute('data-action'), 'install');
  fire(ctx.document, installButton, 'click');
  assert.equal(installs, 1, 'pwa.js delegation receives exactly one install click');
  assert.equal(ctx.pwa.calls.install, 0, 'widget does not call promptInstall itself');

  const diagnosticsButton = root.querySelector('[data-pwa-diagnostics]');
  assert.ok(diagnosticsButton);
  assert.equal(diagnosticsButton.getAttribute('data-action'), 'diagnostics');
  fire(ctx.document, diagnosticsButton, 'click');
  assert.equal(ctx.pwa.calls.diagnostics, 0, 'existing diagnostics dialog owns the network check');
  widget.destroy();
});

test('widget renderer has no network, polling, SW registration, auto-open or heavy runtime dependencies', () => {
  const code = widgetSource.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /\bfetch\s*\(/);
  assert.doesNotMatch(code, /\.register\s*\(/);
  assert.doesNotMatch(code, /setInterval\s*\(/);
  assert.doesNotMatch(code, /\bimport\s/);
  assert.doesNotMatch(code, /ogl|gsap|three/);
  assert.match(code, /getContext\('webgl2'/, 'the electric renderer uses the browser WebGL API directly');
  assert.match(code, /if \(!gl \|\| !program\)/, 'unsupported WebGL falls back without blocking the classic launcher');
  assert.doesNotMatch(code, /staff\.you\.ge/);
  assert.match(code, /api\.subscribe\(onState\)/);
  assert.match(code, /api\.subscribe\(onState\)/);
  const afterOnState = code.split('function onState')[1] || '';
  assert.doesNotMatch(afterOnState, /openPanel\(\s*\);/, 'state updates never open the panel');
});

/* ------------------------------------------------------------------ *
 * Audit regressions (2026-11): working notice actions, Escape ownership,
 * defensive appearance handling and touch/contrast CSS floors
 * ------------------------------------------------------------------ */

// Updated by the duplicated-UI audit (2026-11-15, end of this file): connection
// notices no longer repeat the diagnostics button — it lives in its section —
// while the install card keeps its own action. What these two tests protect is
// unchanged: the action a notice refers to is never inert.
test('a diagnostics notice is backed by one working toolkit control, never an inert button', () => {
  const ctx = createContext({ richDocument: true });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  ctx.api.setDnsResult({ status: 'complete', classification: 'dns_resolution_failure', message: 'NXDOMAIN for this hostname.' });
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');

  const notice = root.querySelectorAll('.youge-notice').find(
    (node) => node.querySelector('.youge-notice-title').textContent === 'DNS resolution problem');
  assert.ok(notice, 'the DNS notice is rendered');
  assert.match(notice.querySelector('.youge-notice-message').textContent, /NXDOMAIN/);

  const actions = root.querySelectorAll('[data-action="diagnostics"]');
  assert.equal(actions.length, 1, 'the diagnostics the notice refers to exists exactly once');
  assert.equal(actions[0].hasAttribute('data-pwa-diagnostics'), true, 'and carries the delegated diagnostics hook');
  assert.match(actions[0].querySelector('.youge-btn-label').textContent, /diagnostics/i);
  widget.destroy();
});

test('an install notice action reuses the toolkit install flow and its real wording', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');

  const notice = root.querySelectorAll('.youge-notice').find(
    (node) => node.querySelector('.youge-notice-title').textContent === 'Installation available');
  assert.ok(notice, 'the install notice is rendered');
  const action = notice.querySelector('[data-pwa-install]');
  assert.ok(action, 'the notice itself has an install action, not only the section below it');
  assert.equal(action.getAttribute('data-action'), 'install');
  assert.match(action.querySelector('.youge-btn-label').textContent, /Install this app/, 'wording comes from the real capability');
  assert.equal(root.querySelectorAll('[data-pwa-install]').length, 2, 'the card and the Installation section, and no third copy');
  widget.destroy();

  // A host-built state can report an install notice without the installation
  // section's precondition. The notice is then the only entry point — still
  // with the toolkit hook and the published wording, and still not listed twice.
  const host = createContext({ richDocument: true });
  const base = host.api.getState();
  host.api.destroy();
  const state = Object.assign({}, base, {
    installation: { status: 'unknown', support: 'native' },
    notifications: [
      { id: 'install:available', priority: 4, tone: 'install', title: 'Installation available', message: 'Install from here.', actionId: 'install' },
    ],
    availableActions: [{ id: 'install', label: 'Install this app', icon: 'install', kind: 'install' }],
  });
  host.win.YouGeAssistant = { getState: () => state, subscribe(fn) { fn(state); return () => {}; }, dismiss() {}, acknowledge() {} };
  const hostWidget = loadWidget(host);
  const hostRoot = hostWidget.getRoot();
  fire(host.document, hostRoot.querySelector('[data-role="toggle"]'), 'click');
  const noticeButtons = hostRoot.querySelectorAll('[data-action="install"]');
  assert.equal(noticeButtons.length, 1, 'still one control');
  assert.ok(noticeButtons[0].closest('.youge-notice'), 'on the notice, because no section offers it');
  assert.equal(noticeButtons[0].hasAttribute('data-pwa-install'), true, 'with the delegated install hook');
  assert.match(noticeButtons[0].querySelector('.youge-btn-label').textContent, /Install this app/);
  hostWidget.destroy();
});

test('Escape stays with an open toolkit dialog and still closes the panel on its own', () => {
  const ctx = createContext({ richDocument: true });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const panel = ctx.document.getElementById('youge-assistant-panel');
  const escape = () => ctx.document.dispatchEvent(Object.assign(new ctx.win.CustomEvent('keydown'), { key: 'Escape', type: 'keydown' }));

  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');
  assert.equal(panel.hidden, false, 'panel opens');

  const flow = ctx.document.createElement('div');
  flow.classList.add('pwa-flow');
  ctx.document.body.appendChild(flow);
  escape();
  assert.equal(panel.hidden, false, 'Escape while a toolkit dialog is on top must not close the panel behind it');

  ctx.document.body.removeChild(flow);

  const installHost = ctx.document.createElement('pwa-install');
  installHost.isInstallAvailable = true;
  installHost.isDialogHidden = false;
  ctx.document.body.appendChild(installHost);
  escape();
  assert.equal(panel.hidden, false, 'Escape while <pwa-install> dialog is open must not close the panel behind it');

  installHost.isDialogHidden = true;
  escape();
  assert.equal(root.querySelector('[data-role="toggle"]').getAttribute('aria-expanded'), 'false', 'Escape still closes the panel when nothing else is open');
  widget.destroy();
});

test('hand-built appearance values are re-validated before they reach the DOM', () => {
  // This host replaces window.YouGeAssistant with its own state object, so the
  // widget's SDK theme resolver is unreachable. Nothing may be trusted: not the
  // position, not the theme mode, not the offsets, not the brand colour.
  const ctx = createContext({ richDocument: true });
  const state = {
    enabled: true,
    project: { name: 'Odd Host', hostname: 'host.test' },
    network: { online: true, endpoints: {}, dns: {} },
    installation: { status: 'unavailable', support: 'none' },
    notifications: [],
    availableActions: [],
    badge: { count: 0, tone: 'none', label: 'No alerts' },
    appearance: {
      position: 'middle-right',
      theme: 'neon',
      offsets: { x: 'lots' },
      themeColor: 'red; background-image: url(//evil.test/x)',
    },
  };
  ctx.win.YouGeAssistant = { getState: () => state, subscribe(fn) { fn(state); return () => {}; } };
  const widget = loadWidget(ctx);
  const root = widget.getRoot();

  assert.equal(root.getAttribute('data-position'), 'bottom-right', 'unsupported positions fall back');
  assert.equal(root.getAttribute('data-theme'), 'auto', 'unsupported themes fall back');
  assert.equal(root.style['--youge-offset-x'], '20px', 'a non-numeric offset never becomes "undefinedpx"');
  assert.equal(root.style['--youge-offset-y'], '20px');
  // The SDK theme resolver validates the appearance payload: the injected
  // colour never reaches a style property, and the Assistant's own identity is
  // applied instead (auto mode, light scheme fallback).
  assert.equal(root.style['--youge-brand'], '#155eef', 'the injected colour is replaced by the validated default');
  assert.ok(!String(root.style['--youge-brand']).includes('url('), 'never a declaration payload');
  assert.equal(root.getAttribute('data-scheme'), 'light', 'the resolved scheme is published for CSS');
  assert.equal(root.getAttribute('data-theme-inherit'), null, 'nothing is inherited without inheritHost');
  widget.destroy();
});

test('a hand-built state with a valid hex brand colour still applies it', () => {
  // Positive control for the guard above: the same path accepts a real colour.
  const ctx = createContext({ richDocument: true });
  const state = {
    enabled: true,
    project: { name: 'Odd Host', hostname: 'host.test' },
    network: { online: true, endpoints: {}, dns: {} },
    installation: { status: 'unavailable', support: 'none' },
    notifications: [],
    availableActions: [],
    badge: { count: 0, tone: 'none', label: 'No alerts' },
    appearance: {
      position: 'bottom-left', theme: 'dark', offsets: { x: 24, y: 24 }, themeColor: '#123456',
      // The SDK resolver falls back to the Assistant's dark-adapted brand for a
      // project colour that is not legible on the dark surface (see the
      // seedPrimary contrast guard), so this fixture exercises the fallback
      // writer explicitly: no theme record means no resolver-owned brand token.
      themeConfig: null,
    },
  };
  ctx.win.YouGeAssistant = { getState: () => state, subscribe(fn) { fn(state); return () => {}; } };
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(root.getAttribute('data-theme'), 'dark');
  // A validated hex is accepted, but the theme system still protects contrast:
  // #123456 on the dark surface would fail AA, so the dark-adapted Assistant
  // brand is used instead of an unreadable project colour.
  assert.equal(root.style['--youge-brand'], '#84adff', 'an unreadable project colour is contrast-guarded');
  assert.equal(root.style['--youge-offset-x'], '24px');
  widget.destroy();
});

test('widget CSS holds the touch-target floor and dark-mode badge contrast', () => {
  assert.match(widgetCss, /\.youge-btn-small \{[^}]*min-height:\s*44px/, 'small notice buttons stay 44px targets');
  assert.match(widgetCss, /\.youge-badge\[data-tone="auth"\] \{ background: var\(--youge-auth\); color: #ffffff; \}/, 'light auth badge clears AA');
  assert.match(widgetCss, /\[data-theme="dark"\] \.youge-badge\[data-tone="auth"\]/, 'explicit dark theme flips badge ink');
  assert.match(widgetCss, /\[data-theme="auto"\] \.youge-badge\[data-tone="auth"\]/, 'auto dark theme must flip badge ink too');
});

/* ------------------------------------------------------------------ *
 * Floating entry point visuals (November 2026 refinement): circular,
 * restrained, and red only for events the user can act on.
 * ------------------------------------------------------------------ */

function fabRule() {
  const block = /\.youge-fab \{([\s\S]*?)\n\}/.exec(widgetCss);
  assert.ok(block, 'the .youge-fab rule exists');
  return block[1];
}

function tokensOf(cssBlock) {
  const map = Object.create(null);
  for (const match of cssBlock.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    map[`--${match[1]}`] = match[2].trim();
  }
  return map;
}

function tokenValue(cssBlock, name) {
  const tokens = tokensOf(cssBlock);
  let value = tokens[name];
  const indirect = /^var\((--[a-z-]+)\)$/.exec(value || '');
  if (indirect) value = tokens[indirect[1]];
  return value;
}

function channelLuminance(hex) {
  const body = hex.replace('#', '');
  const full = body.length === 3 ? body.replace(/./g, (c) => c + c) : body;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [high, low] = [channelLuminance(a), channelLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const lightTokens = () => /\.youge-assistant-widget \{([\s\S]*?)\n\}/.exec(widgetCss)[1];
const darkTokens = () => /\.youge-assistant-widget\[data-theme="dark"\] \{([\s\S]*?)\n\}/.exec(widgetCss)[1];
const autoDarkTokens = () => /@media \(prefers-color-scheme: dark\) \{\s*\.youge-assistant-widget\[data-theme="auto"\] \{([\s\S]*?)\n  \}/.exec(widgetCss)[1];

test('the floating entry point is a true circle at every size', () => {
  const rule = fabRule();
  assert.match(rule, /--youge-launcher-radius: 50%/, 'the backward-compatible default is a real circle');
  assert.match(rule, /border-radius: var\(--youge-launcher-radius\)/, 'validated per-instance shape controls the radius');
  assert.match(widgetCss, /\.youge-fab\[data-shape="circle"\] \{ --youge-launcher-radius: 50%; \}/);
  assert.match(widgetCss, /\.youge-fab\[data-shape="rounded-square"\]/);
  assert.match(widgetCss, /\.youge-fab\[data-shape="square"\]/);
  assert.doesNotMatch(widgetCss, /\.youge-fab[^{]*\{[^}]*border-radius:\s*1[68]px/, 'the old 18px radius is gone');

  const compact = /@media \(max-width: 480px\) \{([\s\S]*?)\n\}/.exec(widgetCss)[1];
  assert.match(compact, /\.youge-fab \{ width: 54px; height: 54px; \}/, 'the small-screen variant stays a square box, so 50% stays a circle');
  assert.doesNotMatch(compact, /\.youge-fab \{[^}]*border-radius/, 'it never re-declares a different radius');

  assert.match(widgetCss, /\.youge-fab::before \{[^}]*inset: 0;[^}]*border-radius: var\(--youge-launcher-radius\)/, 'the decorative light follows the configured shape');
  assert.match(widgetCss, /\.youge-fab::before \{[^}]*pointer-events: none/, 'and cannot swallow a click');
  assert.match(widgetCss, /\.youge-fab \.youge-icon \{ position: relative; z-index: 1; \}/, 'the glyph stays above the sheen');
  assert.match(widgetCss, /\.youge-badge \{[\s\S]*?z-index: 2;/, 'the count badge stays above both');
});

test('the panel identity logo is a true circle, zoomed and never cropped', () => {
  const block = /\.youge-brand-image \{([\s\S]*?)\n\}/.exec(widgetCss);
  assert.ok(block, 'the .youge-brand-image rule exists');
  const rule = block[1];
  assert.match(rule, /border-radius: 50%/, 'a real circle, not a rounded square');
  assert.doesNotMatch(rule, /border-radius:\s*(?!50%)\d/, 'no competing radius on the logo');
  assert.match(rule, /width: 44px/, 'zoomed up from the old 36px so the mark fills the header');
  assert.match(rule, /object-fit: contain/, 'the whole mark stays visible — nothing is cropped');
  assert.match(rule, /flex: none/, 'the circle never squeezes in the identity row');
  assert.match(widgetSource, /brandIcon\.width = 44;/, 'the markup keeps its intrinsic size in sync');
  assert.match(widgetSource, /brandIcon\.height = 44;/, 'the markup keeps its intrinsic size in sync');
});

test('the resting button is subdued: no glow, no blur, no continuous animation', () => {
  const rule = fabRule();
  assert.doesNotMatch(rule, /filter:|blur\(|text-shadow/, 'no glow or blur on the resting button');
  assert.doesNotMatch(rule, /box-shadow:\s*var\(--youge-shadow\)/, 'the 40px panel shadow is no longer used for the entry point');
  assert.match(widgetCss, /--youge-fab-shadow: 0 4px 10px/, 'depth is one short elevation step');
  assert.match(widgetCss, /@keyframes youge-electric-flow/, 'the opt-in effect is available');
  assert.match(widgetCss, /\.youge-fab\[data-attention="active"\] \.youge-electric-border path \{ animation:/, 'only an active actionable state animates the outline');
  assert.doesNotMatch(rule, /animation:/, 'the resting button itself never animates');
  assert.match(widgetCss, /\.youge-fab:hover \{ transform: translateY\(-1px\);/, 'hover travel stays under 2px');
  assert.match(widgetCss, /\.youge-fab:active \{ transform: translateY\(0\) scale\(0\.98\); \}/, 'press feedback survives, gently');
  const bg = tokenValue(lightTokens(), '--youge-fab-bg');
  assert.ok(channelLuminance(bg) < 0.16, `the default fill stays dark (${bg})`);
});

test('the button clears the text-contrast floor in light, dark and auto-dark', () => {
  for (const [label, block] of [['light', lightTokens()], ['dark', darkTokens()], ['auto-dark', autoDarkTokens()]]) {
    const bg = tokenValue(block, '--youge-fab-bg');
    const ink = tokenValue(block, '--youge-fab-ink');
    const actionBg = tokenValue(block, '--youge-fab-action-bg');
    const actionInk = tokenValue(block, '--youge-fab-action-ink');
    assert.ok(contrastRatio(ink, bg) >= 4.5, `${label}: glyph ink on the resting fill is ${contrastRatio(ink, bg).toFixed(2)}:1`);
    assert.ok(contrastRatio(actionInk, actionBg) >= 4.5, `${label}: glyph ink on the red fill is ${contrastRatio(actionInk, actionBg).toFixed(2)}:1`);
  }
  // The inverted chip has to read against the red fill too.
  assert.ok(contrastRatio('#ffffff', '#b42318') >= 4.5, 'the count chip stays legible on the light-theme red');
});

test('red is reserved for actionable events, by tone not by alert count', () => {
  const tones = [...new Set([...widgetCss.matchAll(/\.youge-fab\[data-tone="([a-z]+)"\]/g)].map((match) => match[1]))].sort();
  assert.deepEqual(tones, ['auth', 'critical', 'install'], 'the actionable list is exactly the events the user can act on');
  for (const calm of ['info', 'backup', 'none']) {
    assert.doesNotMatch(widgetCss, new RegExp(`\\.youge-fab\\[data-tone="${calm}"\\]`), `${calm} must never turn the button red`);
  }
  assert.match(widgetCss, /\.youge-fab\[data-tone="critical"\] \.youge-badge/, 'the count chip inverts instead of going red-on-red');
});

test('the state change is a smooth transition built from shared motion tokens', () => {
  assert.match(widgetCss, /--youge-motion-fast: 160ms;/);
  assert.match(widgetCss, /--youge-motion-state: 240ms;/);
  const rule = fabRule();
  assert.match(rule, /transition:\s*\n?\s*transform var\(--youge-motion-fast\)/, 'interaction feedback uses the fast token');
  assert.match(rule, /background-color var\(--youge-motion-state\) ease/, 'the color state change uses the state token');
  assert.match(rule, /border-color var\(--youge-motion-state\) ease/);
  assert.doesNotMatch(rule, /transition:[^;]*\bwidth|transition:[^;]*\bheight/, 'no layout-affecting property animates');

  const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(widgetCss)[1];
  assert.match(reduced, /transition-duration: 0\.01ms !important/, 'reduced motion drops the transition');
  assert.match(reduced, /\.youge-fab:hover, \.youge-fab:active[^{]*\{ transform: none !important; \}/, 'and removes the travel, keeping the color message');
});

test('the button reflects the badge tone as events appear and are dismissed', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');

  assert.equal(fab.getAttribute('data-tone'), 'install', 'an install action is actionable');
  ctx.api.dismiss('install:available');
  assert.equal(fab.getAttribute('data-tone'), 'none', 'dismissing the event clears the color again');
  ctx.api.setConnectivity(false);
  assert.equal(fab.getAttribute('data-tone'), 'critical', 'losing the connection is actionable');
  assert.match(fab.getAttribute('aria-label'), /1 alert/, 'and the count still says so in words, not only in color');
  widget.destroy();
});

test('informational alerts and in-progress checks keep the button calm', () => {
  // Installed already, so the only event left is the optional update: an alert
  // that must not make the entry point shout.
  const ctx = createContext({ richDocument: true, pwaState: { hasUpdate: true, installed: true, standalone: true } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');

  assert.equal(root.querySelector('.youge-badge').hidden, false, 'the update notice is still counted');
  assert.equal(fab.getAttribute('data-tone'), 'info', 'an optional update is not something to act on now');
  ctx.api.setDnsResult({ status: 'running', classification: 'pending', message: 'Checking this connection.' });
  assert.equal(fab.getAttribute('data-tone'), 'info', 'a running diagnostic never turns the button red');
  widget.destroy();
});

/* ------------------------------------------------------------------ *
 * 0.1.1 feature release: responsive auto-scaling + manual icon       *
 * adjustment (size / horizontal / vertical), and the Android         *
 * in-app browser → Chrome handoff offer.                             *
 * ------------------------------------------------------------------ */

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const ANDROID_FACEBOOK_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/460.0.0.36.107;]';
const ANDROID_MESSENGER_UA =
  'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 [FBAN/MessengerForAndroid;FBAV/431.0.0.29.119;]';
const ANDROID_INSTAGRAM_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36 Instagram 312.0.0.0.0 Android';
const IOS_FACEBOOK_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.36.107;]';
const HANDOFF_HREF = 'https://example.test/staff/home?tab=2&next=%2Fdeep#section-4';

function openPanelViaToggle(ctx, root) {
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');
}

test('the floating entry point scales automatically across phone, tablet and desktop sizes', () => {
  // One token owns the diameter; the responsive tiers restate it.
  assert.match(widgetCss, /\.youge-assistant-widget \{[^}]*--youge-fab-size: 56px/, 'default diameter is a single root token');
  assert.match(widgetCss, /@media \(max-width: 480px\)[\s\S]*?--youge-fab-size: 54px/, 'phone tier');
  assert.match(widgetCss, /@media \(min-width: 768px\)[\s\S]*?--youge-fab-size: 60px/, 'tablet tier');
  assert.match(widgetCss, /@media \(min-width: 1280px\)[\s\S]*?--youge-fab-size: 64px/, 'desktop tier');
  // The element itself follows the token so a manual override can win.
  const rule = (/\.youge-fab \{[\s\S]*?\n\}/.exec(widgetCss) || [''])[0];
  assert.match(rule, /width: var\(--youge-fab-size\)/);
  assert.match(rule, /height: var\(--youge-fab-size\)/);
  assert.doesNotMatch(rule, /width: 56px/, 'the base rule is not a fixed pixel size');
  // …and stays a true circle at every tier (border-radius: 50% on the square box).
  assert.match(rule, /--youge-launcher-radius: 50%/);
  assert.match(rule, /border-radius: var\(--youge-launcher-radius\)/);
  // The glyph and the panel gap follow the same token.
  assert.match(widgetCss, /\.youge-fab \.youge-icon svg \{ width: var\(--youge-fab-glyph, 26px\)/);
  assert.match(widgetCss, /var\(--youge-offset-y\) \+ var\(--youge-fab-size\) \+ 10px \+ env\(safe-area-inset-bottom/);
  // The compact tier keeps its exact square measurement (circle regression gate).
  assert.match(widgetCss, /\.youge-fab \{ width: 54px; height: 54px; \}/);
});

test('manual size and position adjustments apply immediately, clamp and persist', () => {
  const ctx = createContext({ richDocument: true });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  openPanelViaToggle(ctx, root);

  const sizeInput = root.querySelector('[data-adjust="size"]');
  const xInput = root.querySelector('[data-adjust="x"]');
  const yInput = root.querySelector('[data-adjust="y"]');
  assert.ok(sizeInput && xInput && yInput, 'the adjust section renders three labelled ranges');

  sizeInput.value = '80'; // above the 72px maximum → clamped
  fire(ctx.document, sizeInput, 'input');
  const fab = root.querySelector('[data-role="toggle"]');
  assert.equal(fab.style.width, '72px', 'the manual size lands on the FAB as an inline override');
  assert.equal(fab.style.height, '72px');
  assert.equal(root.style['--youge-fab-size'], '72px', 'panel gap and offer follow the manual size');
  assert.ok(fab.style['--youge-fab-glyph'], 'the glyph scales with the manual size');
  assert.match(String(fab.style['--youge-fab-glyph']), /^\d+px$/);
  assert.equal(root.querySelector('#youge-adjust-size-out').textContent, '72px');

  xInput.value = '-5'; // below 0 → clamped
  fire(ctx.document, xInput, 'input');
  assert.equal(root.style['--youge-offset-x'], '0px');
  yInput.value = '200'; // above 160 → clamped
  fire(ctx.document, yInput, 'input');
  assert.equal(root.style['--youge-offset-y'], '160px');

  const saved = JSON.parse(ctx.storage.getItem('youge-assistant:fab-adjust'));
  assert.deepEqual(saved, { size: 72, x: 0, y: 160 }, 'every adjustment persists on this origin');
  widget.destroy();
});

test('manual adjustments survive a reload and the sliders reflect the stored values', () => {
  const storage = makeStorage({
    'youge-assistant:fab-adjust': JSON.stringify({ size: 64, x: 30, y: 44 }),
  });
  const ctx = createContext({ richDocument: true, storage });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');
  assert.equal(fab.style.width, '64px', 'stored size applied on mount (page reload / PWA restart)');
  assert.equal(fab.style.height, '64px');
  assert.equal(root.style['--youge-offset-x'], '30px');
  assert.equal(root.style['--youge-offset-y'], '44px');

  openPanelViaToggle(ctx, root);
  assert.equal(root.querySelector('[data-adjust="size"]').value, '64');
  assert.equal(root.querySelector('[data-adjust="x"]').value, '30');
  assert.equal(root.querySelector('[data-adjust="y"]').value, '44');
  assert.equal(root.querySelector('#youge-adjust-size-out').textContent, '64px');
  widget.destroy();
});

test('reset returns the icon to automatic defaults and clears the stored adjustment', () => {
  const storage = makeStorage({
    'youge-assistant:fab-adjust': JSON.stringify({ size: 70, x: 90, y: 100 }),
  });
  const ctx = createContext({ richDocument: true, storage });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  const fab = root.querySelector('[data-role="toggle"]');
  assert.equal(fab.style.width, '70px', 'starts from the stored manual size');

  openPanelViaToggle(ctx, root);
  fire(ctx.document, root.querySelector('[data-adjust-reset]'), 'click');

  assert.equal(fab.style.width, '', 'inline size override cleared');
  assert.equal(fab.style.height, '');
  assert.equal(root.style['--youge-offset-x'], '20px', 'configured/default offset restored');
  assert.equal(root.style['--youge-offset-y'], '20px');
  assert.equal(ctx.storage.getItem('youge-assistant:fab-adjust'), null, 'persistence cleared');
  assert.equal(root.querySelector('[data-adjust="size"]').value, '56', 'slider back to the automatic diameter');
  assert.equal(root.querySelector('#youge-adjust-size-out').textContent, '56px');
  widget.destroy();
});

test('touch, mouse and keyboard share one delegated input path with 44px touch targets', () => {
  // Behaviour: one 'input' listener on the panel root drives every range,
  // regardless of whether it was driven by pointer, touch or arrow keys.
  const ctx = createContext({ richDocument: true });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  openPanelViaToggle(ctx, root);
  fire(ctx.document, root.querySelector('[data-adjust="size"]'), 'input', {});
  fire(ctx.document, root.querySelector('[data-adjust="x"]'), 'input', {});
  widget.destroy();

  // Structure/CSS: native ranges keep keyboard semantics; targets are touch-safe.
  assert.match(widgetCss, /\.youge-adjust-row input\[type="range"\] \{[^}]*min-height: 44px/s);
  assert.match(widgetCss, /\.youge-adjust-row input\[type="range"\] \{[^}]*touch-action: manipulation/s);
  assert.match(widgetCss, /\.youge-adjust > summary \{[^}]*min-height: 44px/s);
  assert.match(widgetCss, /\.youge-adjust-row input\[type="range"\]:focus-visible \{[^}]*outline: 3px solid var\(--youge-focus\)/s);
  assert.match(widgetCss, /\.youge-adjust-label \{/);
});

test('Android Facebook in-app browsers get an Open in Chrome offer that preserves the full URL', () => {
  const timers = [];
  const ctx = createContext({
    richDocument: true,
    userAgent: ANDROID_FACEBOOK_UA,
    href: HANDOFF_HREF,
  });
  ctx.win.setTimeout = (fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  };
  const assigned = [];
  ctx.win.location.assign = (url) => assigned.push(url);
  const widget = loadWidget(ctx);
  const root = widget.getRoot();

  const offer = root.querySelector('.youge-chrome-offer');
  assert.ok(offer, 'the offer region exists in the widget root');
  assert.equal(offer.hidden, false, 'confident Android Facebook in-app → offer shown');
  assert.match(root.querySelector('[data-chrome-text]').textContent, /in-app browser|Chrome/i);
  assert.equal(root.querySelector('[data-chrome-open]').textContent, 'Open in Chrome');

  fire(ctx.document, root.querySelector('[data-chrome-open]'), 'click');
  assert.equal(assigned.length, 1, 'the handoff attempts exactly one intent URL');
  assert.match(assigned[0], /^intent:\/\//);
  assert.match(assigned[0], /package=com\.android\.chrome/);
  assert.ok(
    assigned[0].startsWith('intent://example.test/staff/home?tab=2&next=%2Fdeep#section-4#Intent;'),
    'pathname, query and hash are preserved in the handoff URL'
  );
  assert.ok(assigned[0].includes(encodeURIComponent(HANDOFF_HREF)), 'the original URL survives in the fallback slot');

  // The page is still visible after the delay in this simulation → manual fallback.
  assert.equal(root.querySelector('[data-chrome-fallback]').hidden, true, 'waits for the delay first');
  assert.equal(timers.length, 1);
  timers[0].fn();
  const fallback = root.querySelector('[data-chrome-fallback]');
  assert.equal(fallback.hidden, false, 'still in the app → manual instructions shown');
  assert.equal(root.querySelector('.youge-chrome-offer-steps').children.length, 3, 'three copy-ready steps');
  assert.match(root.querySelector('.youge-chrome-offer-steps').children.map((li) => li.textContent).join(' '), /Chrome/);
  assert.equal(root.querySelector('.youge-chrome-offer-url').textContent, HANDOFF_HREF, 'original URL shown verbatim');
  widget.destroy();
});

test('a failed Chrome handoff shows manual instructions with the original URL and a copy action', () => {
  const ctx = createContext({
    richDocument: true,
    userAgent: ANDROID_FACEBOOK_UA,
    href: HANDOFF_HREF,
    // No location.assign at all: the handoff cannot leave the app.
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(root.querySelector('.youge-chrome-offer').hidden, false);

  fire(ctx.document, root.querySelector('[data-chrome-open]'), 'click');
  const fallback = root.querySelector('[data-chrome-fallback]');
  assert.equal(fallback.hidden, false, 'immediate manual fallback when the attempt cannot run');
  assert.equal(root.querySelector('.youge-chrome-offer-steps').children.length, 3);
  assert.equal(root.querySelector('.youge-chrome-offer-url').textContent, HANDOFF_HREF);
  assert.match(root.querySelector('.youge-chrome-offer-steps').children.map((li) => li.textContent).join(' '), /Chrome/);

  // Clipboard is unavailable in this environment → the graceful manual hint.
  fire(ctx.document, root.querySelector('[data-chrome-copy]'), 'click');
  assert.match(root.querySelector('.youge-chrome-offer-status').textContent, /Select the address/);
  widget.destroy();
});

test('supported browsers, iOS in-apps and uncertain detections never see the offer', () => {
  for (const userAgent of [ANDROID_CHROME_UA, IOS_FACEBOOK_UA, undefined]) {
    const ctx = createContext({
      richDocument: true,
      userAgent,
      href: 'https://example.test/',
    });
    const widget = loadWidget(ctx);
    const offer = widget.getRoot().querySelector('.youge-chrome-offer');
    assert.equal(offer.hidden, true, `no offer for ${String(userAgent).slice(0, 24) || 'an unknown user agent'}`);
    widget.destroy();
  }
  // Identification uncertainty must never navigate either: no assign spy set,
  // no crash, offer stays hidden.
});

test('Messenger and Instagram in-app browsers also get the offer', () => {
  for (const userAgent of [ANDROID_MESSENGER_UA, ANDROID_INSTAGRAM_UA]) {
    const ctx = createContext({ richDocument: true, userAgent, href: 'https://example.test/' });
    const widget = loadWidget(ctx);
    assert.equal(widget.getRoot().querySelector('.youge-chrome-offer').hidden, false, userAgent.slice(0, 40));
    widget.destroy();
  }
});

test('the offer hides while the panel is open and persists its dismissal across reloads', () => {
  const storage = makeStorage();
  const makeLoaded = () => {
    const ctx = createContext({ richDocument: true, userAgent: ANDROID_FACEBOOK_UA, href: 'https://example.test/', storage });
    return { ctx, widget: loadWidget(ctx) };
  };

  let { ctx, widget } = makeLoaded();
  let root = widget.getRoot();
  const offer = root.querySelector('.youge-chrome-offer');
  assert.equal(offer.hidden, false);

  openPanelViaToggle(ctx, root);
  assert.equal(offer.hidden, true, 'the offer never covers the open panel');
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click'); // close
  assert.equal(offer.hidden, false, 'the offer returns when the panel closes');

  fire(ctx.document, root.querySelector('[data-chrome-dismiss]'), 'click');
  assert.equal(offer.hidden, true, 'Not now hides the offer');
  assert.equal(ctx.storage.getItem('youge-assistant:chrome-offer-dismissed'), '1', 'dismissal persists');
  widget.destroy();

  // Same origin, fresh page load → still dismissed.
  ({ ctx, widget } = makeLoaded());
  assert.equal(widget.getRoot().querySelector('.youge-chrome-offer').hidden, true, 'dismissal survives a reload');
  widget.destroy();
});

/* ------------------------------------------------------------------ *
 * Stage 3 regressions (2026-11): stale DNS state on reconfiguration
 * ------------------------------------------------------------------ */

test('reconfiguring the project or domain resets stale DNS state to idle', () => {
  const ctx = createContext({ config: { projectId: 'dns-test-project' } });
  ctx.api.setDnsResult({ classification: 'dns_resolution_failure', message: 'NXDOMAIN returned.' });
  assert.equal(ctx.api.getState().network.dns.classification, 'dns_resolution_failure');
  assert.ok(ctx.api.getState().notifications.some((n) => n.id === 'dns:failure'));

  ctx.api.configure({ projectId: 'other-project' });
  let state = ctx.api.getState();
  assert.equal(state.project.id, 'other-project');
  assert.equal(state.network.dns.status, 'idle', 'a new project cannot inherit the previous DNS verdict');
  assert.equal(state.network.dns.classification, 'unknown');
  assert.equal(state.network.dns.checkedAt, null);
  assert.equal(state.notifications.some((n) => n.id === 'dns:failure'), false);

  ctx.api.setDnsResult({ classification: 'application_host_unavailable', message: 'No response.' });
  ctx.api.configure({ domain: 'other.example.com' });
  state = ctx.api.getState();
  assert.equal(state.network.dns.status, 'idle', 'a new domain cannot inherit the previous DNS verdict');
  assert.equal(state.network.dns.classification, 'unknown');
});

test('unrelated configuration updates keep a valid DNS verdict', () => {
  const ctx = createContext({ config: { projectId: 'dns-test-project' } });
  ctx.api.setDnsResult({
    status: 'complete',
    classification: 'normal_connectivity',
    message: 'Healthy DNS and app probe.',
    checkedAt: '2026-11-14T00:00:00.000Z',
  });

  ctx.api.configure({ branding: { name: 'Renamed' } });
  ctx.api.configure({ theme: 'dark' });
  ctx.api.configure({ position: 'bottom-left' });

  const state = ctx.api.getState();
  assert.equal(state.project.id, 'dns-test-project', 'the project identity is unchanged');
  assert.equal(state.network.dns.classification, 'normal_connectivity', 'valid state is not thrown away');
  assert.equal(state.network.dns.checkedAt, '2026-11-14T00:00:00.000Z');
  assert.equal(state.appearance.theme, 'dark');
});

test('a stale DNS verdict is dropped when the resolved hostname changes even if the project id matches', () => {
  const ctx = createContext({ config: { projectId: 'dns-test-project' } });
  ctx.api.setDnsResult({ classification: 'dns_records_missing', message: 'No A/AAAA records.' });

  ctx.api.configure({ projectId: 'dns-test-project', domain: 'moved.example.com' });
  const state = ctx.api.getState();
  assert.equal(state.project.hostname, 'moved.example.com');
  assert.equal(state.network.dns.status, 'idle');
  assert.equal(state.network.dns.classification, 'unknown');
});

test('DOM widget routes update actions through AssistantInstance.applyUpdate and falls back to bare PWA mocks', async () => {
  // 1. Standard path: widget delegates through AssistantInstance.applyUpdate()
  const ctx = createContext({ richDocument: true, pwaState: { hasUpdate: true, installed: true, standalone: true } });
  let assistantApplyCalls = 0;
  const originalApply = ctx.api.applyUpdate;
  ctx.api.applyUpdate = () => {
    assistantApplyCalls += 1;
    return typeof originalApply === 'function' ? originalApply() : Promise.resolve({ applied: true, outcome: 'applied' });
  };
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');

  const actions = [];
  ctx.document.addEventListener('youge:action', (event) => actions.push(event.detail));
  const updateButton = root.querySelector('[data-action="update"]');
  assert.ok(updateButton, 'update button is rendered for app:update');
  fire(ctx.document, updateButton, 'click');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(assistantApplyCalls, 1, 'widget calls AssistantInstance.applyUpdate()');
  assert.equal(ctx.pwa.calls.applyUpdate, 1, 'AssistantInstance delegates to PWA.applyUpdate()');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].id, 'update');
  widget.destroy();

  // 2. Fallback path: host replaces window.YouGeAssistant with a bare state object lacking applyUpdate()
  const fallbackCtx = createContext({ richDocument: true, pwaState: { hasUpdate: true } });
  const stateSnapshot = fallbackCtx.api.getState();
  fallbackCtx.api.destroy();
  fallbackCtx.win.YouGeAssistant = {
    getState: () => stateSnapshot,
    subscribe: (fn) => { fn(stateSnapshot); return () => {}; },
    dismiss: () => false,
    acknowledge: () => false,
    runDiagnostics: () => Promise.resolve({}),
  };
  const fallbackWidget = loadWidget(fallbackCtx);
  const fallbackRoot = fallbackWidget.getRoot();
  fire(fallbackCtx.document, fallbackRoot.querySelector('[data-role="toggle"]'), 'click');
  fire(fallbackCtx.document, fallbackRoot.querySelector('[data-action="update"]'), 'click');
  assert.equal(fallbackCtx.pwa.calls.applyUpdate, 1, 'falls back to PWA.applyUpdate when Assistant API lacks applyUpdate');
  fallbackWidget.destroy();
});

test('update notice and rendered action follow the updates module across reconfiguration (D2)', async () => {
  const ctx = createContext({
    richDocument: true,
    config: { modules: { updates: false } },
    pwaState: { hasUpdate: true, installed: true, standalone: true },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');
  const assertUpdateUI = (visible) => {
    const state = ctx.api.getState();
    assert.equal(state.notifications.some((n) => n.id === 'app:update'), visible);
    assert.equal(state.availableActions.some((a) => a.id === 'update'), visible);
    assert.equal(Boolean(root.querySelector('[data-action="update"]')), visible);
  };

  assertUpdateUI(false);
  assert.equal((await ctx.api.applyUpdate()).outcome, 'disabled');
  assert.equal(ctx.pwa.calls.applyUpdate, 0);

  ctx.api.configure({ modules: { updates: true } });
  assertUpdateUI(true);
  fire(ctx.document, root.querySelector('[data-action="update"]'), 'click');
  assert.equal(ctx.pwa.calls.applyUpdate, 1);

  ctx.api.configure({ modules: { updates: false } });
  assertUpdateUI(false);
  ctx.api.setUpdateAvailable(true);
  assertUpdateUI(false);
  ctx.api.configure({ modules: { updates: true } });
  assertUpdateUI(true);

  ctx.pwa.state.hasUpdate = false;
  ctx.pwa.emitChange();
  assertUpdateUI(false);
  widget.destroy();
  ctx.api.destroy();
});

/* ------------------------------------------------------------------ *
 * Stage 5.3 / D3 + D6 — classic bundle parity
 * ------------------------------------------------------------------ */

function useRegistry(ctx, basePath, diagnostics) {
  // Removing the stub resolver makes the classic bundle resolve through the
  // public registry the host configured — the same seam a real page uses.
  delete ctx.win.YouGeDomain;
  ctx.api.configure({
    domainRegistry: {
      'example.test': {
        project: { id: 'dns-parity-project' },
        pwa: { basePath },
        diagnostics,
      },
    },
  });
}

test('the classic bundle invalidates a DNS verdict when the effective probe identity changes (D6 parity)', () => {
  const ctx = createContext({ config: { projectId: 'dns-parity-project' } });
  useRegistry(ctx, '/portal/', { appProbePath: 'manifest.webmanifest', backendProbePath: 'health' });
  assert.equal(ctx.api.getState().project.basePath, '/portal/');

  const setVerdict = () => ctx.api.setDnsResult({
    status: 'complete',
    classification: 'dns_resolution_missing',
    message: 'stale verdict',
    checkedAt: '2026-11-14T00:00:00.000Z',
  });
  const assertKept = (label) => {
    const state = ctx.api.getState();
    assert.equal(state.network.dns.status, 'complete', label);
    assert.equal(state.network.dns.classification, 'dns_resolution_missing', label);
    assert.equal(state.network.dns.checkedAt, '2026-11-14T00:00:00.000Z', label);
  };
  const assertReset = (label) => {
    const state = ctx.api.getState();
    assert.equal(state.network.dns.status, 'idle', `${label} clears the stale verdict`);
    assert.equal(state.network.dns.classification, 'unknown', label);
    assert.equal(state.network.dns.checkedAt, null, label);
  };

  setVerdict();
  ctx.api.configure({ branding: { name: 'Renamed' } });
  assertKept('an unrelated change keeps the verdict');

  ctx.api.configure({});
  assertKept('repeating an unchanged identity keeps the verdict');

  useRegistry(ctx, '/portal/', { appProbePath: './manifest.webmanifest', backendProbePath: 'health' });
  assertKept('an equivalent probe path spelling keeps the verdict');

  useRegistry(ctx, '/portal/', { appProbePath: 'probe.json', backendProbePath: 'health' });
  assertReset('changing the app probe path');

  setVerdict();
  useRegistry(ctx, '/portal/', { appProbePath: 'probe.json', backendProbePath: 'healthz' });
  assertReset('changing the backend probe path');

  setVerdict();
  useRegistry(ctx, '/portal/', { appProbePath: 'probe.json' });
  assertReset('removing the backend probe');

  setVerdict();
  useRegistry(ctx, '/other/', { appProbePath: 'probe.json' });
  assertReset('changing the base path');

  ctx.api.destroy();
});

/* ------------------------------------------------------------------ *
 * CD-1 — capability enforcement in the DOM renderer.
 *
 * The widget renders from the centralized state and asks the SDK for the
 * action -> capability mapping. These tests assert what is rendered and what a
 * click does, not that a conditional exists.
 * ------------------------------------------------------------------ */

const ALL_GATED_OFF = { diagnostics: false, recovery: false, failover: false, help: false };

function firstAction(root, id) {
  return Boolean(root.querySelector('[data-action="' + id + '"]'));
}

function statusLabels(ctx) {
  const root = ctx.win.YouGeAssistantWidget.getRoot();
  return root.querySelectorAll('.youge-status-row').map((row) => row.children[0].textContent);
}

function noticeByTitle(root, title) {
  return root.querySelectorAll('.youge-notice').find(
    (node) => node.querySelector('.youge-notice-title') &&
      node.querySelector('.youge-notice-title').textContent === title,
  );
}

function openPanelOf(ctx) {
  const root = ctx.win.YouGeAssistantWidget.getRoot();
  fire(ctx.document, root.querySelector('[data-role="toggle"]'), 'click');
  return root;
}

test('all four capabilities disabled: no diagnostics, recovery or failover UI at all', () => {
  const ctx = createContext({
    richDocument: true,
    config: {
      modules: ALL_GATED_OFF,
      actions: [{ id: 'open-help', label: 'Open help', kind: 'help', priority: 5 }],
    },
  });
  loadWidget(ctx);
  ctx.win.dispatchEvent({ type: 'offline' });
  const root = openPanelOf(ctx);

  assert.equal(firstAction(root, 'diagnostics'), false, 'no diagnostics button');
  assert.equal(Boolean(root.querySelector('[data-pwa-diagnostics]')), false, 'no delegated diagnostics hook');
  assert.equal(Boolean(root.querySelector('.youge-recovery')), false, 'no recovery guidance');
  assert.equal(firstAction(root, 'recovery'), false);
  assert.equal(firstAction(root, 'backup-status'), false);
  assert.equal(firstAction(root, 'open-help'), false, 'a help-kind project action is not exposed');
  assert.equal(statusLabels(ctx).includes('Backup'), false, 'the failover status row is hidden');
  assert.equal(statusLabels(ctx).includes('DNS'), true, 'connectivity reporting stays intact');

  // The critical connectivity notice still reports reality, without an action.
  const offlineNotice = noticeByTitle(root, 'No connection');
  assert.ok(offlineNotice, 'the offline notice is still rendered');
  assert.equal(Boolean(offlineNotice.querySelector('[data-action]')), false, 'the notice exposes no diagnostics action');
  assert.ok(offlineNotice.querySelector('[data-acknowledge="network:offline"]'), 'acknowledgement still works');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('each capability can be disabled on its own in the renderer', () => {
  const diagnosticsOff = createContext({ richDocument: true, config: { modules: { diagnostics: false } } });
  loadWidget(diagnosticsOff);
  const diagnosticsRoot = openPanelOf(diagnosticsOff);
  assert.equal(firstAction(diagnosticsRoot, 'diagnostics'), false);
  assert.equal(Boolean(diagnosticsRoot.querySelector('[data-pwa-diagnostics]')), false);
  assert.ok(diagnosticsRoot.querySelector('.youge-recovery'), 'recovery stays available');
  diagnosticsOff.win.YouGeAssistantWidget.destroy();

  const recoveryOff = createContext({ richDocument: true, config: { modules: { recovery: false } } });
  loadWidget(recoveryOff);
  const recoveryRoot = openPanelOf(recoveryOff);
  assert.equal(Boolean(recoveryRoot.querySelector('.youge-recovery')), false);
  assert.equal(firstAction(recoveryRoot, 'diagnostics'), true, 'diagnostics stays available');
  recoveryOff.win.YouGeAssistantWidget.destroy();

  const failoverOff = createContext({ richDocument: true, config: { modules: { failover: false } } });
  loadWidget(failoverOff);
  failoverOff.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  const failoverRoot = openPanelOf(failoverOff);
  assert.equal(statusLabels(failoverOff).includes('Backup'), false);
  assert.equal(firstAction(failoverRoot, 'backup-status'), false);
  failoverOff.win.YouGeAssistantWidget.destroy();

  const helpOff = createContext({
    richDocument: true,
    config: { modules: { help: false }, actions: [{ id: 'open-help', label: 'Open help', kind: 'help' }] },
  });
  loadWidget(helpOff);
  helpOff.api.setSessionStatus({ state: 'issue', message: 'Sign in again.' });
  const helpRoot = openPanelOf(helpOff);
  assert.equal(firstAction(helpRoot, 'open-help'), false);
  assert.equal(firstAction(helpRoot, 'help'), false);
  const sessionNotice = noticeByTitle(helpRoot, 'Session needs attention');
  assert.ok(sessionNotice, 'the session condition is still reported');
  assert.equal(Boolean(sessionNotice.querySelector('[data-action]')), false, 'the session notice exposes no help action');
  helpOff.win.YouGeAssistantWidget.destroy();
});

test('with every capability enabled the renderer offers the complete action set', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  loadWidget(ctx);
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  const root = openPanelOf(ctx);

  assert.equal(firstAction(root, 'diagnostics'), true, 'diagnostics button');
  assert.equal(Boolean(root.querySelector('[data-pwa-diagnostics]')), true, 'delegated diagnostics hook');
  assert.equal(Boolean(root.querySelector('.youge-recovery')), true, 'recovery guidance');
  assert.equal(firstAction(root, 'backup-status'), true, 'failover action');
  assert.equal(statusLabels(ctx).includes('Backup'), true);
  const backupNotice = noticeByTitle(root, 'Backup connection active');
  assert.ok(backupNotice, 'the backup notice is rendered');
  assert.ok(backupNotice.querySelector('[data-action="backup-status"]'), 'the notice keeps its action');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('a click on a stale gated action node cannot dispatch or run diagnostics', () => {
  const ctx = createContext({ richDocument: true, config: { modules: ALL_GATED_OFF } });
  loadWidget(ctx);
  const root = openPanelOf(ctx);

  const dispatched = [];
  ctx.document.addEventListener('youge:action', (event) => dispatched.push(event.detail));

  // A node that survived a re-render (or a host-injected button) still routes
  // through the widget's delegated handler.
  const stale = ctx.document.createElement('button');
  stale.setAttribute('data-action', 'diagnostics');
  stale.setAttribute('data-pwa-diagnostics', '');
  root.appendChild(stale);
  fire(ctx.document, stale, 'click');
  assert.deepEqual(dispatched, [], 'no gated action is announced to the host');

  const staleFailover = ctx.document.createElement('button');
  staleFailover.setAttribute('data-action', 'backup-status');
  root.appendChild(staleFailover);
  fire(ctx.document, staleFailover, 'click');
  assert.deepEqual(dispatched, [], 'failover is gated the same way');
  ctx.win.YouGeAssistantWidget.destroy();
});

/* ------------------------------------------------------------------ *
 * Duplicated-UI audit (2026-11-15): one entry point per action
 *
 * Reproduced in Chromium on the assembled Pages site: the panel offered
 * "Installation instructions" three times (notice, Installation section,
 * Available actions) and "Run network diagnostics" two to three times; the
 * Available-actions copies carried no toolkit hook and opened nothing.
 *
 * Contract (owner decision, 2026-11-15), pinned at the rendered panel:
 *   - "Available actions" never repeats an action that has a control elsewhere;
 *   - installation is offered in two deliberate places — the "Installation
 *     available" card, which is the invitation, and the Installation section,
 *     which stays after the card is dismissed;
 *   - network diagnostics and recovery guidance live only in "Diagnostics &
 *     recovery"; connection cards explain without repeating the button;
 *   - no section renders without content.
 * ------------------------------------------------------------------ */

function controlsFor(root, id) {
  return root.querySelectorAll('[data-action="' + id + '"]');
}

function sectionTitles(root) {
  return root.querySelectorAll('.youge-section-title').map((node) => node.textContent);
}

function sectionByTitle(root, title) {
  return root.querySelectorAll('.youge-section').find(
    (node) => node.querySelector('.youge-section-title') &&
      node.querySelector('.youge-section-title').textContent === title,
  );
}

function installControls(root) {
  const all = controlsFor(root, 'install');
  return {
    all,
    card: all.filter((node) => node.closest('.youge-notice')),
    section: all.filter((node) => !node.closest('.youge-notice') && node.closest('.youge-section') === sectionByTitle(root, 'Installation')),
    listed: all.filter((node) => node.closest('.youge-action-list')),
  };
}

test('installation is offered on its card and in its section, never a third time; diagnostics has one control', () => {
  const ctx = createContext({ richDocument: true });
  loadWidget(ctx);
  const root = openPanelOf(ctx);

  const card = noticeByTitle(root, 'Installation available');
  assert.ok(card, 'the precondition: an install notice is showing');

  const install = installControls(root);
  assert.equal(install.all.length, 2, 'two installation entry points, not three');
  assert.equal(install.card.length, 1, 'the card keeps its call to action');
  assert.equal(install.card[0].closest('.youge-notice'), card);
  assert.equal(install.section.length, 1, 'the Installation section keeps its button');
  assert.equal(install.listed.length, 0, 'the action list does not repeat it');
  install.all.forEach((node) => {
    assert.equal(node.hasAttribute('data-pwa-install'), true, 'every install control carries the toolkit hook');
    assert.match(node.querySelector('.youge-btn-label').textContent, /^Installation instructions$/, 'and the same wording');
  });
  assert.equal(root.querySelectorAll('[data-pwa-install]').length, 2, 'no other delegated install hook in the panel');

  const diagnostics = controlsFor(root, 'diagnostics');
  assert.equal(diagnostics.length, 1, 'one diagnostics entry point');
  assert.equal(diagnostics[0].closest('.youge-section'), sectionByTitle(root, 'Diagnostics & recovery'));
  assert.equal(diagnostics[0].hasAttribute('data-pwa-diagnostics'), true);
  assert.equal(root.querySelectorAll('[data-pwa-diagnostics]').length, 1, 'one delegated diagnostics hook in the panel');

  // Dismissing the card leaves the section as the remaining entry point.
  fire(ctx.document, root.querySelector('[data-dismiss="install:available"]'), 'click');
  const after = installControls(root);
  assert.equal(after.all.length, 1, 'installation stays reachable after the card is dismissed');
  assert.equal(after.section.length, 1);
  ctx.win.YouGeAssistantWidget.destroy();
});

test('a connection problem adds notices, not second diagnostics or recovery controls', () => {
  const ctx = createContext({ richDocument: true, pwaState: { canInstall: true } });
  loadWidget(ctx);
  ctx.win.dispatchEvent({ type: 'offline' });
  ctx.api.setEndpointStatus({ primary: 'failed' });
  const root = openPanelOf(ctx);

  const state = ctx.api.getState();
  assert.equal(state.availableActions.some((action) => action.id === 'recovery'), true, 'the SDK still publishes recovery');
  assert.equal(state.availableActions.some((action) => action.id === 'diagnostics'), true, 'and diagnostics');

  assert.equal(controlsFor(root, 'diagnostics').length, 1, 'offline does not multiply the diagnostics button');
  assert.equal(controlsFor(root, 'install').length, 2, 'installation keeps its card and its section, nothing more');
  assert.equal(root.querySelectorAll('.youge-recovery').length, 1, 'one recovery guidance block');
  assert.equal(controlsFor(root, 'recovery').length, 0, 'and no second, inert "Recovery guidance" button');

  // The notices still explain the condition and stay acknowledgeable.
  const offline = noticeByTitle(root, 'No connection');
  assert.ok(offline, 'the critical notice is rendered');
  assert.match(offline.querySelector('.youge-notice-message').textContent, /cannot reach the network/);
  assert.equal(Boolean(offline.querySelector('[data-action]')), false, 'it points at the section instead of repeating its button');
  assert.ok(offline.querySelector('[data-acknowledge="network:offline"]'), 'acknowledgement is unchanged');
  const api = noticeByTitle(root, 'Primary API unavailable');
  assert.ok(api);
  assert.equal(Boolean(api.querySelector('[data-action]')), false);
  const install = noticeByTitle(root, 'Installation available');
  assert.ok(install.querySelector('[data-dismiss="install:available"]'), 'dismissal is unchanged');
  assert.ok(install.querySelector('[data-action="install"]'), 'the install card keeps its own action');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('other notice actions are offered once: on the notice, then in the list after dismissal', () => {
  const ctx = createContext({
    richDocument: true,
    pwaState: { hasUpdate: true, installed: true, standalone: true },
    config: { features: [{ id: 'priority', label: 'Live connection priority', message: 'New.' }] },
  });
  loadWidget(ctx);
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  const root = openPanelOf(ctx);

  // Contextual actions without a dedicated section stay on their notice…
  const backup = controlsFor(root, 'backup-status');
  assert.equal(backup.length, 1, 'backup status is offered once');
  assert.ok(backup[0].closest('.youge-notice'), 'on the notice that reports it');
  const update = controlsFor(root, 'update');
  assert.equal(update.length, 1, 'the update action is offered once');
  assert.ok(update[0].closest('.youge-notice'));
  const feature = controlsFor(root, 'feature:priority');
  assert.equal(feature.length, 1, 'a project feature notice keeps its Open action');

  // …and move to the action list when the notice is dismissed, so the action
  // is never lost and never doubled.
  fire(ctx.document, root.querySelector('[data-dismiss="app:update"]'), 'click');
  const moved = controlsFor(root, 'update');
  assert.equal(moved.length, 1, 'still exactly one update control after dismissal');
  assert.equal(moved[0].closest('.youge-notice'), null);
  assert.equal(moved[0].closest('.youge-section'), sectionByTitle(root, 'More actions'));
  fire(ctx.document, moved[0], 'click');
  assert.equal(ctx.pwa.calls.applyUpdate, 1, 'and it still applies the update, once');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('the action list holds only what has no other home and disappears when empty', () => {
  const bare = createContext({ richDocument: true });
  loadWidget(bare);
  const bareRoot = openPanelOf(bare);
  assert.equal(bare.api.getState().availableActions.length > 0, true, 'the SDK publishes built-in actions');
  assert.equal(Boolean(bareRoot.querySelector('.youge-action-list')), false, 'built-in actions are not listed a second time');
  assert.equal(sectionTitles(bareRoot).includes('More actions'), false, 'so the empty section is not rendered');
  assert.equal(sectionTitles(bareRoot).includes('Available actions'), false);
  bare.win.YouGeAssistantWidget.destroy();

  const project = createContext({
    richDocument: true,
    config: { actions: [{ id: 'open-help', label: 'Open help', kind: 'help', priority: 5 }] },
  });
  loadWidget(project);
  const projectRoot = openPanelOf(project);
  const list = projectRoot.querySelector('.youge-action-list');
  assert.ok(list, 'a project action brings the section back');
  assert.deepEqual(list.children.map((node) => node.getAttribute('data-action')), ['open-help']);
  assert.equal(sectionTitles(projectRoot).includes('More actions'), true);
  project.win.YouGeAssistantWidget.destroy();
});

test('a hand-built state that repeats an action id still renders one control per action', () => {
  const ctx = createContext({ richDocument: true });
  const base = ctx.api.getState();
  ctx.api.destroy();
  const state = Object.assign({}, base, {
    installation: { status: 'unavailable', support: 'none' },
    notifications: [
      { id: 'a', priority: 2, tone: 'auth', title: 'Sign in again', message: 'Session expired.', actionId: 'help' },
      { id: 'b', priority: 5, tone: 'info', title: 'Need a hand?', message: 'Support is online.', actionId: 'help' },
    ],
    availableActions: [
      { id: 'export', label: 'Export data', kind: 'custom' },
      { id: 'export', label: 'Export data', kind: 'custom' },
      { id: 'install', label: 'Installation instructions', kind: 'install' },
    ],
  });
  ctx.win.YouGeAssistant = { getState: () => state, subscribe(fn) { fn(state); return () => {}; }, dismiss() {}, acknowledge() {} };
  loadWidget(ctx);
  const root = openPanelOf(ctx);

  assert.equal(controlsFor(root, 'export').length, 1, 'a repeated list entry renders once');
  assert.equal(controlsFor(root, 'help').length, 1, 'two notices sharing an action show it once');
  assert.ok(controlsFor(root, 'help')[0].closest('.youge-notice'), 'on the first of them');
  // No Installation section exists in this state, so the published install
  // action is the only entry point: it stays, and it must not be inert.
  const install = controlsFor(root, 'install');
  assert.equal(install.length, 1);
  assert.equal(install[0].hasAttribute('data-pwa-install'), true, 'a listed toolkit action carries its delegated hook');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('no section renders without content: no empty steps, no empty installation or action section', () => {
  // The offline shell disables installation; nothing can be installed there.
  const ctx = createContext({ richDocument: true, pwa: null, config: { modules: { installation: false, updates: false } } });
  loadWidget(ctx);
  const root = openPanelOf(ctx);

  assert.equal(sectionTitles(root).includes('Installation'), false, 'no section that only says installation is unavailable');
  root.querySelectorAll('.youge-section').forEach((section) => {
    const content = section.children.filter((node) =>
      !node.matches('.youge-section-title') && !node.matches('.youge-section-desc'));
    const title = section.querySelector('.youge-section-title').textContent;
    assert.equal(content.length > 0, true, 'section "' + title + '" has content beyond its heading');
  });

  const steps = root.querySelectorAll('.youge-steps');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].children.length > 0, true, 'recovery guidance is never an empty list');
  steps[0].children.forEach((item) => {
    assert.equal(item.tagName, 'LI');
    assert.equal(item.textContent.trim().length > 20, true, 'every numbered step carries its instruction');
  });

  // One statement of the empty state, not a description and a second sentence.
  const attention = sectionByTitle(root, 'What needs attention');
  assert.equal(attention.querySelectorAll('.youge-notice').length, 0);
  assert.equal(attention.children.length, 2, 'heading plus one empty-state line');
  assert.match(attention.querySelector('.youge-empty').textContent, /All clear/);
  ctx.win.YouGeAssistantWidget.destroy();

  // An installed app has nothing to install either.
  const installed = createContext({ richDocument: true, pwaState: { installed: true, standalone: true } });
  loadWidget(installed);
  assert.equal(sectionTitles(openPanelOf(installed)).includes('Installation'), false);
  installed.win.YouGeAssistantWidget.destroy();
});

test('each remaining control triggers its action once, through one listener', () => {
  const ctx = createContext({ richDocument: true });
  loadWidget(ctx);
  loadWidget(ctx); // a second script inclusion must not mount or bind again
  const root = openPanelOf(ctx);
  assert.equal(ctx.document.body.querySelectorAll('[data-youge-widget]').length, 1, 'one widget root');
  assert.equal(root._listeners.get('click').size, 1, 'one delegated click listener');

  const actions = [];
  let delegatedInstalls = 0;
  let delegatedDiagnostics = 0;
  ctx.document.addEventListener('youge:action', (event) => actions.push(event.detail.id));
  ctx.document.addEventListener('click', (event) => {
    if (event.target.closest('[data-pwa-install]')) delegatedInstalls += 1;
    if (event.target.closest('[data-pwa-diagnostics]')) delegatedDiagnostics += 1;
  });

  const install = installControls(root);
  fire(ctx.document, install.card[0], 'click');
  assert.deepEqual(actions, ['install'], 'the card button announces one action');
  assert.equal(delegatedInstalls, 1, 'and the toolkit sees one install click');
  fire(ctx.document, install.section[0], 'click');
  assert.deepEqual(actions, ['install', 'install'], 'the section button announces one action');
  assert.equal(delegatedInstalls, 2, 'one toolkit click per press, never two');
  assert.equal(ctx.pwa.calls.install, 0, 'the widget does not prompt a second time itself');
  actions.length = 0;
  actions.push('install');

  fire(ctx.document, controlsFor(root, 'diagnostics')[0], 'click');
  assert.deepEqual(actions, ['install', 'diagnostics']);
  assert.equal(delegatedDiagnostics, 1, 'the toolkit sees one diagnostics click');
  assert.equal(ctx.pwa.calls.diagnostics, 0, 'the toolkit dialog owns the check; no parallel run');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('a state update keeps open disclosures open and focus on the same control', () => {
  const ctx = createContext({ richDocument: true });
  loadWidget(ctx);
  const root = openPanelOf(ctx);

  root.querySelector('.youge-recovery').open = true;
  root.querySelector('.youge-adjust').open = true;
  // The card and the section carry the same action; focus must come back to
  // the one the user was on, not to its look-alike.
  installControls(root).section[0].focus();

  ctx.win.dispatchEvent({ type: 'offline' }); // re-renders the open panel

  assert.equal(root.querySelector('.youge-recovery').open, true, 'recovery guidance does not snap shut while being read');
  assert.equal(root.querySelector('.youge-adjust').open, true, 'nor does the icon adjustment');
  let focused = ctx.document.activeElement;
  assert.equal(focused.getAttribute('data-action'), 'install');
  assert.equal(root.contains(focused), true, 'focus is on a live node');
  assert.equal(focused, installControls(root).section[0], 'the section button, not the card button above it');

  installControls(root).card[0].focus();
  ctx.win.dispatchEvent({ type: 'online' });
  focused = ctx.document.activeElement;
  assert.equal(focused, installControls(root).card[0], 'and focus on the card button stays on the card button');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('dismissing a notice keeps focus in the panel, and a re-render never takes focus from the page', () => {
  const ctx = createContext({ richDocument: true });
  loadWidget(ctx);
  const root = openPanelOf(ctx);

  const dismiss = root.querySelector('[data-dismiss="install:available"]');
  dismiss.focus();
  fire(ctx.document, dismiss, 'click');
  assert.equal(Boolean(root.querySelector('[data-dismiss="install:available"]')), false, 'the notice is gone');
  assert.equal(root.contains(ctx.document.activeElement), true, 'focus did not fall out of the dialog');
  assert.equal(ctx.document.activeElement.getAttribute('data-role'), 'close');

  // A host control that happens to use the same attribute keeps its focus.
  const hostButton = ctx.document.createElement('button');
  hostButton.setAttribute('data-action', 'diagnostics');
  ctx.document.body.appendChild(hostButton);
  hostButton.focus();
  ctx.win.dispatchEvent({ type: 'offline' });
  assert.equal(ctx.document.activeElement, hostButton, 'the widget leaves host focus alone');
  ctx.win.YouGeAssistantWidget.destroy();
});

test('the panel disclosures do not take their box or type from host details/summary rules', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../src/assistant/assistant-widget.css', import.meta.url), 'utf8');
  const rule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(css);
    assert.ok(match, `${selector} has a rule`);
    return match[1];
  };
  // Every property the /example/ host sets on bare `details` and `summary`
  // (padding, border, border-radius, font-size, line-height) is stated by the
  // widget's own class rule, which outranks an element selector.
  for (const selector of ['.youge-recovery', '.youge-adjust']) {
    const body = rule(selector);
    assert.match(body, /(?:^|[\s;])padding:\s*0\b/, `${selector} owns its padding`);
    assert.match(body, /(?:^|[\s;])margin:\s*0\b/, `${selector} owns its margin`);
    assert.match(body, /font-size:\s*inherit/, `${selector} keeps the panel font size`);
    assert.match(body, /line-height:\s*inherit/, `${selector} keeps the panel line height`);
    assert.match(body, /(?:^|[\s;])border:/, `${selector} owns its border`);
    assert.match(body, /border-radius:/, `${selector} owns its radius`);
  }
  for (const selector of ['.youge-recovery summary', '.youge-adjust > summary']) {
    const body = rule(selector);
    assert.match(body, /line-height:\s*1\.5/, `${selector} owns its line height`);
    assert.match(body, /font-size:/, `${selector} owns its font size`);
  }
});
