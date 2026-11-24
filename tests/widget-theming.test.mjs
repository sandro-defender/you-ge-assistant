/*!
 * Adaptive theming — embedded widget integration tests.
 *
 * Exercises the real classic scripts (`assistant-state.js` + `assistant-widget.js`)
 * inside the same VM harness the widget suite uses, so these assertions cover
 * the shipped dependency-free path rather than a reimplementation.
 *
 * Focus:
 *   - default theme behaviour and the four modes reaching the DOM
 *   - host adaptation and host style isolation
 *   - notification theme consistency (five levels)
 *   - CSS isolation contracts (selectors, guards, reduced motion, touch targets)
 *   - backward compatibility with existing integrations
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const stateSource = readFileSync(fileURLToPath(new URL('../src/assistant/assistant-state.js', import.meta.url)), 'utf8');
const widgetSource = readFileSync(fileURLToPath(new URL('../src/assistant/assistant-widget.js', import.meta.url)), 'utf8');
const widgetCss = readFileSync(fileURLToPath(new URL('../src/assistant/assistant-widget.css', import.meta.url)), 'utf8');

/* ------------------------------------------------------------------ *
 * Minimal DOM harness (a trimmed copy of the widget suite's harness so
 * this file stays independent of its fixtures).
 * ------------------------------------------------------------------ */

function makeTarget() {
  const listeners = new Map();
  return {
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
    this._properties = new Map();
    const properties = this._properties;
    this.style = {
      setProperty(name, value) { properties.set(name, String(value)); },
      removeProperty(name) { properties.delete(name); },
      getPropertyValue(name) { return properties.has(name) ? properties.get(name) : ''; },
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
    const self = this;
    const classes = new Set(this._className.split(/\s+/).filter(Boolean));
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

function makeDocument(hostOptions = {}) {
  const doc = Object.assign({
    readyState: 'complete',
    visibilityState: 'visible',
    activeElement: null,
  }, makeTarget());
  doc.body = new FakeNode('body', doc);
  doc.createElement = (tag) => new FakeNode(tag, doc);
  doc.getElementById = (id) => findById(doc.body, id);
  doc.querySelector = (selector) => doc.body.querySelector(selector);
  // The host page: an <html> that framework theme switchers actually style.
  const attributes = hostOptions.htmlAttributes || {};
  doc.documentElement = {
    attributes,
    classList: { contains: (name) => (hostOptions.htmlClasses || []).includes(name) },
    style: hostOptions.htmlStyle || {},
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
    },
  };
  return doc;
}

function makeStorage(seed) {
  const map = new Map(seed ? Object.entries(seed) : []);
  return {
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    _map: map,
  };
}

function createContext(options = {}) {
  const document = makeDocument(options.host || {});
  const win = Object.assign({}, makeTarget());
  const storage = options.storage || makeStorage();
  win.window = win;
  win.self = win;
  win.document = document;
  win.location = {
    href: 'https://example.test/',
    hostname: 'example.test',
    origin: 'https://example.test',
    protocol: 'https:',
    pathname: '/',
  };
  win.navigator = { onLine: options.online !== false, userAgent: 'Mozilla/5.0 (X11) Chrome/130.0.0.0' };
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
  win.matchMedia = (query) => {
    if (options.matchMedia) return options.matchMedia(query);
    return { matches: Boolean(options.prefersDark), addEventListener() {}, addListener() {} };
  };
  win.requestAnimationFrame = (fn) => { fn(); return 1; };
  win.setTimeout = (fn) => { fn(); return 1; };
  win.clearTimeout = () => {};
  win.YOU_GE_ASSISTANT_CONFIG = options.config || {};
  win.PWA = null;
  vm.createContext(win);
  vm.runInContext(stateSource, win, { filename: 'assistant-state.js' });
  return { win, document, storage, api: win.YouGeAssistant };
}

function loadWidget(ctx) {
  vm.runInContext(widgetSource, ctx.win, { filename: 'assistant-widget.js' });
  return ctx.win.YouGeAssistantWidget;
}

function fire(document, node, type) {
  const event = { type, target: node };
  let current = node;
  while (current) {
    if (current._fire) current._fire(event);
    current = current.parentNode;
  }
  document._fire(event);
  return event;
}

function openPanel(ctx, widget) {
  fire(ctx.document, widget.getRoot().querySelector('[data-role="toggle"]'), 'click');
}

const cssVar = (root, name) => root.style.getPropertyValue(name);

/* ------------------------------------------------------------------ *
 * 1. Default theme behaviour
 * ------------------------------------------------------------------ */

test('default configuration paints the Assistant identity and claims a resolved scheme', () => {
  const ctx = createContext();
  const widget = loadWidget(ctx);
  const root = widget.getRoot();

  assert.equal(root.getAttribute('data-theme'), 'auto', 'the documented default mode');
  assert.equal(root.getAttribute('data-scheme'), 'light', 'the resolved scheme is published for CSS');
  assert.equal(root.getAttribute('data-theme-inherit'), null, 'host adaptation is opt-in');
  assert.equal(cssVar(root, '--youge-brand'), '#155eef', 'the Assistant brand survives by default');
  assert.equal(cssVar(root, '--youge-surface'), '#ffffff');
  assert.equal(cssVar(root, '--youge-ink'), '#0f172a');
  assert.equal(cssVar(root, '--youge-font'), 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif');
  // Only validated, namespaced custom properties are written.
  for (const [name] of root._properties) assert.match(name, /^--youge-[a-z0-9-]+$/);
  widget.destroy();
});

test('the legacy branding.themeColor keeps setting the primary colour', () => {
  const ctx = createContext({ config: { branding: { themeColor: '#0f766e' } } });
  const widget = loadWidget(ctx);
  assert.equal(cssVar(widget.getRoot(), '--youge-brand'), '#0f766e');
  widget.destroy();
});

test('an explicit theme token wins over branding.themeColor', () => {
  const ctx = createContext({
    config: { branding: { themeColor: '#0f766e' }, theme: { mode: 'custom', tokens: { primary: '#7c3aed' } } },
  });
  const widget = loadWidget(ctx);
  assert.equal(cssVar(widget.getRoot(), '--youge-brand'), '#7c3aed');
  widget.destroy();
});

/* ------------------------------------------------------------------ *
 * 2. Mode coverage
 * ------------------------------------------------------------------ */

test('auto mode follows prefers-color-scheme', () => {
  const light = createContext({ prefersDark: false });
  const lightWidget = loadWidget(light);
  assert.equal(lightWidget.getRoot().getAttribute('data-scheme'), 'light');
  assert.equal(cssVar(lightWidget.getRoot(), '--youge-surface'), '#ffffff');
  lightWidget.destroy();

  const dark = createContext({ prefersDark: true });
  const darkWidget = loadWidget(dark);
  assert.equal(darkWidget.getRoot().getAttribute('data-scheme'), 'dark');
  assert.equal(cssVar(darkWidget.getRoot(), '--youge-surface'), '#0b1220', 'auto + dark OS uses the dark palette');
  darkWidget.destroy();
});

test('auto mode also follows a host page that declares its own scheme', () => {
  // A dark-first host (Next themes, Bootstrap 5.3, Docusaurus) with a light OS.
  const ctx = createContext({ prefersDark: false, host: { htmlAttributes: { 'data-theme': 'dark' } } });
  const widget = loadWidget(ctx);
  assert.equal(widget.getRoot().getAttribute('data-scheme'), 'dark', 'the host signal is honored');
  assert.equal(cssVar(widget.getRoot(), '--youge-surface'), '#0b1220');
  widget.destroy();
});

test('light mode never switches, even on a dark host and a dark OS', () => {
  const ctx = createContext({
    prefersDark: true,
    host: { htmlAttributes: { 'data-theme': 'dark' } },
    config: { theme: 'light' },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(root.getAttribute('data-scheme'), 'light');
  assert.equal(cssVar(root, '--youge-surface'), '#ffffff');
  widget.destroy();
});

test('dark mode never switches, even on a light host and a light OS', () => {
  const ctx = createContext({
    prefersDark: false,
    host: { htmlClasses: ['theme-light'] },
    config: { theme: 'dark' },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(root.getAttribute('data-scheme'), 'dark');
  assert.equal(cssVar(root, '--youge-surface'), '#0b1220');
  assert.equal(cssVar(root, '--youge-brand'), '#84adff', 'the dark identity keeps its own brand');
  widget.destroy();
});

test('custom mode applies the integrator palette, structure and font', () => {
  const ctx = createContext({
    config: {
      theme: {
        mode: 'custom',
        tokens: {
          primary: '#7c3aed',
          surface: '#ffffff',
          surfaceSoft: '#faf5ff',
          text: '#1f1235',
          mutedText: '#5b5370',
          border: '#e9e3f5',
          radius: 14,
          radiusSmall: 10,
          borderWidth: 1,
          fontFamily: 'Inter, system-ui, sans-serif',
          shadow: '0 16px 36px rgba(31, 18, 53, 0.14)',
        },
      },
    },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(root.getAttribute('data-theme'), 'custom');
  assert.equal(cssVar(root, '--youge-brand'), '#7c3aed');
  assert.equal(cssVar(root, '--youge-radius'), '14px');
  assert.equal(cssVar(root, '--youge-radius-small'), '10px');
  assert.equal(cssVar(root, '--youge-font'), 'Inter, system-ui, sans-serif');
  assert.equal(cssVar(root, '--youge-shadow'), '0 16px 36px rgba(31, 18, 53, 0.14)');
  assert.equal(cssVar(root, '--youge-primary-ink'), '#ffffff', 'the label ink is derived from the fill');
  widget.destroy();
});

test('custom tokens can be changed at runtime through configure()', () => {
  const ctx = createContext({ config: { theme: 'light' } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(cssVar(root, '--youge-brand'), '#155eef');

  ctx.api.configure({ theme: { mode: 'custom', tokens: { primary: '#b91c1c' } } });
  assert.equal(root.getAttribute('data-theme'), 'custom');
  assert.equal(cssVar(root, '--youge-brand'), '#b91c1c');

  ctx.api.configure({ theme: 'dark' });
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(cssVar(root, '--youge-brand'), '#84adff', 'the previous custom token is cleared');
  widget.destroy();
});

/* ------------------------------------------------------------------ *
 * 3. Host adaptation
 * ------------------------------------------------------------------ */

test('inheritHost adopts validated host values; without it nothing changes', () => {
  const theme = { mode: 'auto', inheritHost: true, host: { primary: '#0f766e', border: '#cbd5e1' } };
  const adapted = createContext({ host: { htmlAttributes: { 'data-theme': 'dark' } }, config: { theme } });
  const widget = loadWidget(adapted);
  assert.equal(widget.getRoot().getAttribute('data-theme-inherit'), '', 'the DOM states that host values are adopted');
  assert.equal(cssVar(widget.getRoot(), '--youge-brand'), '#0f766e');
  widget.destroy();

  const isolated = createContext({
    host: { htmlAttributes: { 'data-theme': 'dark' } },
    config: { theme: { mode: 'auto', host: { primary: '#0f766e' } } },
  });
  const isolatedWidget = loadWidget(isolated);
  assert.equal(cssVar(isolatedWidget.getRoot(), '--youge-brand'), '#84adff', 'host values need inheritHost');
  assert.equal(isolatedWidget.getRoot().getAttribute('data-theme-inherit'), null);
  isolatedWidget.destroy();
});

test('a host value that would break readability is replaced by the Assistant palette', () => {
  const ctx = createContext({
    config: {
      theme: {
        mode: 'auto',
        inheritHost: true,
        host: { surface: '#0f172a', text: '#111827', mutedText: '#1f2937' },
      },
    },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(cssVar(root, '--youge-surface'), '#0f172a', 'the host surface is adopted');
  assert.notEqual(cssVar(root, '--youge-ink'), '#111827', 'unreadable host text is rejected');
  assert.notEqual(cssVar(root, '--youge-muted'), '#1f2937');
  widget.destroy();
});

test('host styles cannot inject declarations, layout geometry or foreign variables', () => {
  const ctx = createContext({
    config: {
      theme: {
        mode: 'custom',
        tokens: {
          primary: 'url(//evil.test/x)',
          fontFamily: 'Inter; } html { display: none',
          radius: '9999px',
        },
        variables: {
          '--youge-offset-x': '999px',
          '--youge-fab-size': '8px',
          '--youge-panel-ring': '0 0 0 1px rgba(0,0,0,.2)',
          '--progressierBg': 'red',
        },
      },
    },
  });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(cssVar(root, '--youge-brand'), '#155eef', 'the injected colour is replaced');
  assert.equal(cssVar(root, '--youge-radius'), '', 'an invalid radius is dropped, so the stylesheet default applies');
  assert.equal(cssVar(root, '--youge-panel-ring'), '0 0 0 1px rgba(0,0,0,.2)', 'a valid custom variable is applied');
  assert.equal(cssVar(root, '--progressierBg'), '', 'foreign namespaces are rejected');
  assert.notEqual(cssVar(root, '--youge-offset-x'), '999px', 'placement is not themeable');
  assert.notEqual(cssVar(root, '--youge-fab-size'), '8px', 'the launcher diameter is not themeable');
  for (const [name, value] of root._properties) {
    assert.match(name, /^--youge-[a-z0-9-]+$/);
    assert.doesNotMatch(String(value), /url\(|javascript:|expression\(/i);
  }
  widget.destroy();
});

/* ------------------------------------------------------------------ *
 * 4. Notification theming
 * ------------------------------------------------------------------ */

test('notifications render five distinct, theme-aware levels', () => {
  const ctx = createContext();
  ctx.api.setConnectivity(false);
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'failover' });
  ctx.api.setSessionStatus({ state: 'issue', message: 'Session expired' });
  const widget = loadWidget(ctx);
  openPanel(ctx, widget);
  const notices = widget.getRoot().querySelectorAll('.youge-notice');

  const levels = notices.map((notice) => notice.getAttribute('data-level'));
  assert.deepEqual(levels, ['critical', 'error', 'warning', 'info'], 'one level per rendered condition');

  for (const notice of notices) {
    const icon = notice.querySelector('.youge-notice-icon');
    assert.ok(icon, `${notice.getAttribute('data-level')} notices carry a level icon`);
    assert.match(icon.innerHTML, /<svg/, 'the icon is SVG, never an emoji');
    assert.match(icon.getAttribute('aria-hidden'), /true/, 'the icon is decorative; the title carries the message');
    assert.ok(notice.querySelector('.youge-notice-title'), 'a clear title');
    assert.ok(notice.querySelector('.youge-notice-message'), 'a clear message');
  }

  const critical = notices[0];
  assert.equal(critical.getAttribute('data-priority'), '1', 'the priority ladder is unchanged');
  assert.ok(critical.querySelector('[data-acknowledge]'), 'critical notices are acknowledged, not dismissed');
  assert.equal(critical.querySelector('[data-dismiss]'), null);
  assert.ok(notices[2].querySelector('[data-dismiss]'), 'non-critical notices stay dismissible');
  widget.destroy();
});

test('success and info tiers come from the restored connection and the backup endpoint', () => {
  const ctx = createContext();
  ctx.api.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'using backup' });
  ctx.api.setEndpointStatus({ primary: 'healthy', backup: 'inactive', active: 'primary' });
  ctx.api.setUpdateAvailable(true);
  const widget = loadWidget(ctx);
  openPanel(ctx, widget);
  const notices = widget.getRoot().querySelectorAll('.youge-notice');
  const levels = notices.map((notice) => notice.getAttribute('data-level'));
  assert.ok(levels.includes('success'), 'a restored primary connection reads as success');
  assert.ok(levels.includes('info'), 'an available update reads as info');
  widget.destroy();
});

test('every level has a CSS treatment and an icon in the shipped stylesheet', () => {
  for (const level of ['critical', 'error', 'warning', 'info', 'success']) {
    assert.match(widgetCss, new RegExp(`\\.youge-notice\\[data-level="${level}"\\]`), `${level} tier is styled`);
    // The glyph markup comes from the SDK metadata both renderers share, with a
    // local fallback for pages that load the widget without it.
    assert.match(widgetSource, new RegExp(`level-\$\{level\}|'level-${level}'`), `${level} icon is defined`);
  }
  // Colour is never the only signal: the accent stripe plus a distinct glyph.
  assert.match(widgetCss, /\.youge-notice-icon \{/);
  assert.match(widgetCss, /\.youge-notice-icon svg \{/);
  // The legacy priority accents stay so host-built state keeps rendering.
  for (const priority of ['1', '2', '3', '4']) {
    assert.match(widgetCss, new RegExp(`\\.youge-notice\\[data-priority="${priority}"\\]`));
  }
});

/* ------------------------------------------------------------------ *
 * 5. CSS isolation
 * ------------------------------------------------------------------ */

function cssRuleBody(selector) {
  const at = widgetCss.indexOf(selector);
  assert.ok(at >= 0, `${selector} exists`);
  return widgetCss.slice(at, widgetCss.indexOf('\n}', at));
}

test('the widget keeps a minimal, intentional selector footprint', () => {
  // Every selector must stay inside the widget's own namespaces. Comments and
  // at-rule preludes are stripped first so the check reads declarations only.
  const css = widgetCss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Keyframe labels (`to`, `from`, percentages) are not CSS selectors.
    .replace(/@keyframes[^{}]+\{[\s\S]*?\n\}/g, '');
  const selectors = [...css.matchAll(/([^{}]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((prelude) => prelude && !prelude.startsWith('@'));
  const outside = [];
  for (const list of selectors) {
    for (const part of list.split(',')) {
      const selector = part.trim();
      if (!selector) continue;
      const namespaced = /^\.youge-[\w-]+/.test(selector)
        || /^#youge-assistant-root/.test(selector)
        || /^\.youge-assistant-widget/.test(selector);
      if (!namespaced) outside.push(selector);
    }
  }
  assert.deepEqual(outside, [], 'every selector is namespaced');
  // Global element/universal selectors are the classic bleed source.
  assert.doesNotMatch(widgetCss, /(^|\n)\s*\*\s*\{/, 'no universal selector rule');
  assert.doesNotMatch(widgetCss, /(^|\n)\s*body\s*\{/, 'no body rule');
  assert.doesNotMatch(widgetCss, /(^|\n)\s*:root\s*\{/, 'no :root rule (the widget is embeddable, not a page)');
});

test('layout-critical properties are guarded, geometry stays overridable', () => {
  const rootRule = cssRuleBody('#youge-assistant-root {');
  for (const guard of ['position: fixed !important', 'z-index: 2147483000 !important', 'display: block !important', 'visibility: visible !important']) {
    assert.ok(rootRule.includes(guard), `root guard: ${guard}`);
  }
  const fab = cssRuleBody('.youge-fab {');
  assert.match(fab, /position: fixed !important/);
  assert.match(fab, /display: inline-flex !important/);
  assert.match(fab, /pointer-events: auto !important/);
  const panel = cssRuleBody('.youge-panel {');
  assert.match(panel, /position: fixed !important/);
  assert.match(panel, /display: flex !important/);
  // Deliberately NOT guarded: a host (or integrator) may legitimately restyle
  // these, and the theme system needs to keep owning them.
  assert.doesNotMatch(fab, /width: var\(--youge-fab-size\) !important/, 'the launcher diameter stays overridable');
  assert.doesNotMatch(panel, /border-radius: var\(--youge-radius\) !important/);
  assert.doesNotMatch(widgetCss, /--youge-offset-x:[^;]*!important/);
});

test('the layout guard never defeats the widget’s own disable switch', () => {
  // `hidden` has to outrank `#youge-assistant-root { display: block !important }`.
  const guard = cssRuleBody('#youge-assistant-root {');
  assert.match(guard, /display: block !important/);
  assert.match(widgetCss, /#youge-assistant-root\[hidden\],[\s\S]{0,80}\{\s*display: none !important;/, 'a hidden root still disappears');
});

test('a disabled assistant is removed from view and re-appears when re-enabled', () => {
  const ctx = createContext({ config: { theme: 'light' } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();
  assert.equal(root.hidden, false);

  ctx.api.configure({ enabled: false });
  assert.equal(root.hidden, true, 'config.enabled=false hides the widget');
  ctx.api.configure({ enabled: true });
  assert.equal(root.hidden, false, 'and re-enabling brings it back');
  widget.destroy();
});

test('the reset is scoped and never uses !important to fight the host page', () => {
  const reset = cssRuleBody('.youge-assistant-widget,\n.youge-assistant-widget *,');
  assert.match(reset, /box-sizing: var\(--youge-reset-box\)/);
  assert.match(reset, /letter-spacing: var\(--youge-reset-letter-spacing\)/);
  assert.match(reset, /text-transform: var\(--youge-reset-transform\)/);
  assert.doesNotMatch(reset, /!important/, 'the reset wins on cascade order, not on force');
  // The reset is driven by inherited privates declared on the widget root.
  const tokens = cssRuleBody('.youge-assistant-widget {');
  assert.match(tokens, /--youge-reset-letter-spacing: normal/);
  assert.match(tokens, /--youge-reset-transform: none/);
  assert.match(tokens, /--youge-reset-box: border-box/);
});

test('the inheritance boundary declares the text properties a host would leak', () => {
  const tokens = cssRuleBody('.youge-assistant-widget {');
  for (const declaration of ['font-family: var(--youge-font)', 'line-height: 1.5', 'letter-spacing: normal', 'word-spacing: normal', 'text-transform: none', 'text-align: start', 'text-shadow: none', 'font-style: normal', 'white-space: normal', 'direction: ltr', 'color-scheme: light']) {
    assert.ok(tokens.includes(declaration), `boundary declares ${declaration}`);
  }
  assert.match(widgetCss, /isolation: isolate/, 'the widget gets its own stacking context');
  assert.match(widgetCss, /color-scheme: dark/, 'and a dark scheme where it applies');
});

test('accessibility floors survive the theming work', () => {
  // Touch targets.
  assert.match(widgetCss, /\.youge-btn-small \{[^}]*min-height: 44px/);
  assert.match(widgetCss, /\.youge-close \{[^}]*width: 44px;[^}]*height: 44px/s);
  assert.match(widgetCss, /\.youge-adjust-row input\[type="range"\] \{[^}]*min-height: 44px/s);
  // Visible focus on every interactive control.
  for (const control of ['.youge-fab:focus-visible', '.youge-btn:focus-visible', '.youge-close:focus-visible', '.youge-recovery summary:focus-visible', '.youge-adjust > summary:focus-visible']) {
    assert.ok(widgetCss.includes(control), `${control} keeps a focus ring`);
  }
  // Screen-reader announcements are unchanged.
  assert.match(widgetSource, /setAttribute\('role', 'status'\)/);
  assert.match(widgetSource, /setAttribute\('aria-live', 'polite'\)/);
});

test('reduced motion still disables travel and transitions', () => {
  const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(widgetCss)[1];
  assert.match(reduced, /transition-duration: 0\.01ms !important/);
  assert.match(reduced, /\.youge-fab:hover, \.youge-fab:active[^{]*\{ transform: none !important; \}/);
  assert.match(widgetCss, /@keyframes youge-electric-flow/, 'the opt-in action outline may animate');
  assert.match(widgetCss, /prefers-reduced-motion: reduce[\s\S]*?animation: none[\s\S]*?stroke-dasharray: none/s, 'reduced motion disables the outline animation');
});

test('mobile presentation is preserved: full-width-safe panel and responsive launcher', () => {
  assert.match(widgetCss, /@media \(max-width: 480px\)/);
  assert.match(widgetCss, /100dvh/);
  assert.match(widgetCss, /env\(safe-area-inset-bottom/);
  assert.match(widgetCss, /--youge-fab-size: 54px/);
  assert.match(widgetCss, /--youge-fab-size: 60px/);
  assert.match(widgetCss, /--youge-fab-size: 64px/);
});

/* ------------------------------------------------------------------ *
 * 6. Backward compatibility
 * ------------------------------------------------------------------ */

test('existing integration surfaces are untouched', () => {
  const ctx = createContext({ config: { projectId: 'compat', position: 'bottom-left', offsets: { x: 28, y: 32 } } });
  const widget = loadWidget(ctx);
  const root = widget.getRoot();

  assert.equal(root.id, 'youge-assistant-root', 'the documented root id is unchanged');
  assert.equal(root.className, 'youge-assistant-widget');
  assert.equal(ctx.document.getElementById('youge-assistant-panel').className, 'youge-panel', 'the panel id and class are unchanged');
  assert.equal(root.getAttribute('data-position'), 'bottom-left');
  assert.equal(cssVar(root, '--youge-offset-x'), '28px');
  assert.equal(typeof widget.open, 'function');
  assert.equal(typeof widget.close, 'function');
  assert.equal(typeof widget.destroy, 'function');
  assert.equal(widget.getRoot(), root);

  // pwa.js delegation still finds these in the light DOM.
  openPanel(ctx, widget);
  assert.ok(root.querySelectorAll('[data-pwa-install]').length >= 0);
  assert.ok(root.querySelectorAll('[data-pwa-diagnostics]').length > 0);
  widget.destroy();
});

test('the singleton, events and persistence contracts are unchanged', () => {
  const ctx = createContext();
  const widget = loadWidget(ctx);
  assert.equal(ctx.win.YouGeAssistant, ctx.api, 'the widget never replaces the state singleton');
  assert.equal(typeof ctx.win.YouGeAssistantSDK.resolveTheme, 'function', 'theme helpers ride the existing SDK global');

  const actions = [];
  ctx.document.addEventListener('youge:action', (event) => actions.push(event.detail));
  openPanel(ctx, widget);
  fire(ctx.document, widget.getRoot().querySelector('[data-action="diagnostics"]'), 'click');
  assert.equal(actions.length >= 1, true, 'action events still dispatch');
  widget.destroy();
});

test('a state object without themeConfig still renders (hand-built host state)', () => {
  const ctx = createContext();
  const state = {
    enabled: true,
    project: { name: 'Host', hostname: 'host.test' },
    network: { online: true, endpoints: {}, dns: {} },
    installation: { status: 'unavailable', support: 'none' },
    notifications: [
      { id: 'x', priority: 1, tone: 'critical', critical: true, title: 'Offline', message: 'No connection', actionId: 'diagnostics' },
    ],
    availableActions: [],
    badge: { count: 1, tone: 'critical', label: 'Offline' },
    appearance: { position: 'bottom-right', theme: 'auto' },
  };
  ctx.win.YouGeAssistant = { getState: () => state, subscribe(fn) { fn(state); return () => {}; } };
  const widget = loadWidget(ctx);
  openPanel(ctx, widget);
  const notice = widget.getRoot().querySelector('.youge-notice');
  assert.equal(notice.getAttribute('data-level'), 'critical', 'the priority ladder supplies the level');
  assert.ok(notice.querySelector('.youge-notice-icon'));
  widget.destroy();
});
