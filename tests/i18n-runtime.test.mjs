import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const CORE_LOCALES = ['en', 'ka', 'ru', 'fr', 'it', 'de', 'sv', 'nl', 'no', 'da', 'et', 'es'];

const read = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

function makeEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      const set = listeners.get(event.type);
      if (set) Array.from(set).forEach((fn) => fn(event));
      return true;
    },
  };
}

class FakeNode {
  constructor(tag, ownerDocument) {
    this.tagName = String(tag).toUpperCase();
    this.nodeType = 1;
    this.ownerDocument = ownerDocument || null;
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.attributes = new Map();
    this._className = '';
    this._textContent = '';
    this._innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this._listeners = new Map();
    this.style = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
    const self = this;
    const classes = new Set();
    const sync = () => { self._className = Array.from(classes).join(' '); };
    this.classList = {
      add(...names) { names.forEach((n) => classes.add(n)); sync(); },
      remove(...names) { names.forEach((n) => classes.delete(n)); sync(); },
      contains(n) { return classes.has(n); },
      toggle(n, force) {
        const on = force === undefined ? !classes.has(n) : Boolean(force);
        if (on) classes.add(n); else classes.delete(n);
        sync();
        return on;
      },
    };
  }
  get className() { return this._className; }
  set className(v) {
    this._className = String(v || '');
    const classes = new Set(this._className.split(/\s+/).filter(Boolean));
    const self = this;
    const sync = () => { self._className = Array.from(classes).join(' '); };
    this.classList = {
      add(...names) { names.forEach((n) => classes.add(n)); sync(); },
      remove(...names) { names.forEach((n) => classes.delete(n)); sync(); },
      contains(n) { return classes.has(n); },
      toggle(n, force) {
        const on = force === undefined ? !classes.has(n) : Boolean(force);
        if (on) classes.add(n); else classes.delete(n);
        sync();
        return on;
      },
    };
  }
  get isConnected() {
    let cur = this;
    while (cur && cur.parentNode) cur = cur.parentNode;
    return Boolean(this.ownerDocument && cur === this.ownerDocument.documentElement);
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join('');
  }
  set textContent(v) { this._textContent = String(v == null ? '' : v); this.children.length = 0; }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v == null ? '' : v);
    this.children.length = 0;
  }
  get firstChild() { return this.children[0] || null; }
  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  attachShadow() {
    this.shadowRoot = new FakeNode('#shadow-root', this.ownerDocument);
    this.shadowRoot.host = this;
    return this.shadowRoot;
  }
  appendChild(child) {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  contains(node) { return node === this || this.children.some((c) => c.contains && c.contains(node)); }
  matches(selector) {
    return String(selector).split(',').some((part) => {
      let s = part.trim();
      const notMatch = /^(.*):not\(([^)]+)\)$/.exec(s);
      if (notMatch) {
        if (this.matches(notMatch[2])) return false;
        s = notMatch[1].trim();
      }
      if (!s) return true;
      const tokens = s.match(/(?:^[a-zA-Z][\w-]*|#[-\w]+|\.[-\w]+|\[[^\]]+\])/g);
      if (!tokens || tokens.join('') !== s) return false;
      return tokens.every((tok) => {
        if (tok.startsWith('[')) {
          const attr = /^\[([^\]=]+)(?:=["']([^"']*)["'])?\]$/.exec(tok);
          if (!attr || !this.hasAttribute(attr[1])) return false;
          return attr[2] === undefined || this.getAttribute(attr[1]) === attr[2];
        }
        if (tok.startsWith('.')) {
          const cls = tok.slice(1);
          return this.classList.contains(cls) || this._className.split(/\s+/).includes(cls);
        }
        if (tok.startsWith('#')) return this.id === tok.slice(1);
        return this.tagName === tok.toUpperCase();
      });
    });
  }
  closest(sel) {
    let cur = this;
    while (cur) {
      if (cur.matches && cur.matches(sel)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }
  querySelector(sel) {
    for (const c of this.children) {
      if (c.nodeType === 1 && c.matches(sel)) return c;
      const hit = c.querySelector ? c.querySelector(sel) : null;
      if (hit) return hit;
    }
    return null;
  }
  querySelectorAll(sel, out = []) {
    for (const c of this.children) {
      if (c.nodeType === 1 && c.matches(sel)) out.push(c);
      if (c.querySelectorAll) c.querySelectorAll(sel, out);
    }
    return out;
  }
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { this._listeners.get(type)?.delete(fn); }
  _fire(ev) {
    const set = this._listeners.get(ev.type);
    if (set) Array.from(set).forEach((fn) => fn(ev));
  }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const hit = findById(c, id);
    if (hit) return hit;
  }
  return null;
}

function collectText(node) {
  if (!node) return '';
  if (node.nodeType === 3) return node.data || '';
  const own = node._textContent || '';
  const kids = (node.children || []).map(collectText).join(' ');
  const htmlText = (node._innerHTML || '').replace(/<[^>]+>/g, ' ');
  return [own, kids, htmlText].filter(Boolean).join(' ');
}

function makeRichDocument() {
  const target = makeEventTarget();
  const doc = Object.assign({
    readyState: 'complete',
    visibilityState: 'visible',
    activeElement: null,
    title: 'Test',
    baseURI: 'https://example.test/',
  }, target);
  doc.documentElement = new FakeNode('html', doc);
  doc.head = new FakeNode('head', doc);
  doc.body = new FakeNode('body', doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  doc.createElement = (tag) => new FakeNode(tag, doc);
  doc.createElementNS = (_ns, tag) => new FakeNode(tag, doc);
  doc.createTextNode = (txt) => ({
    nodeType: 3,
    data: String(txt == null ? '' : txt),
    get textContent() { return this.data; },
    set textContent(v) { this.data = String(v == null ? '' : v); },
    contains() { return false; },
  });
  doc.getElementById = (id) => findById(doc.documentElement, id);
  doc.querySelector = (sel) => doc.documentElement.querySelector(sel);
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);
  return doc;
}

test('pwa-install.js includes native Georgian (ka) and Estonian (et) across 35 total locales plus nb/nn/ca/zh/RTL normalization and accessible close controls', () => {
  const src = read('src/runtime/pwa-install.js');
  const wtMatch = /wt=\[([^\]]+)\]/.exec(src);
  assert.ok(wtMatch, 'wt target locales array exists');
  const targetLocales = JSON.parse(`[${wtMatch[1]}]`);
  assert.equal(targetLocales.length, 34, '34 non-English target locales (+ en = 35 total)');
  assert.ok(targetLocales.includes('ka'), 'includes Georgian (ka)');
  assert.ok(targetLocales.includes('et'), 'includes Estonian (et)');
  assert.ok(targetLocales.includes('ru'), 'includes Russian (ru)');
  assert.ok(targetLocales.includes('no'), 'includes Norwegian (no)');

  const dictMatches = [...src.matchAll(/([A-Za-z0-9_$]+)=\{s05b70c60d4ea8317:/g)];
  assert.equal(dictMatches.length, 34, 'all 34 non-English locale dictionaries exist');
  let refKeys = null;
  for (const m of dictMatches) {
    const start = m.index + m[1].length + 1;
    const end = src.indexOf('}', start) + 1;
    const dict = vm.runInNewContext(`(${src.slice(start, end)})`);
    const keys = Object.keys(dict).sort();
    if (!refKeys) refKeys = keys;
    assert.equal(keys.length, 25, `${m[1]} has all 25 @lit/localize strings`);
    assert.deepEqual(keys, refKeys, `${m[1]} matches canonical key set`);
    for (const k of keys) {
      assert.ok(typeof dict[k] === 'string' && dict[k].trim().length > 0, `${m[1]}.${k} is non-empty`);
    }
  }

  assert.match(src, /"nb"===a\.slice\(0,2\)\|\|"nn"===a\.slice\(0,2\)\?"no":/, 'normalizes nb/nn to no');
  assert.match(src, /"ca"===a\|\|"ca-es"===a\?"ca-ES":/, 'normalizes ca and ca-es to ca-ES');
  assert.match(src, /"zh"===a\|\|"zh-cn"===a\|\|"zh-hans"===a\?"zh-CN":/, 'normalizes zh-hans to zh-CN');
  assert.match(src, /"zh-hk"===a\?"zh-HK":"zh-tw"===a\|\|"zh-hant"===a\?"zh-TW":/, 'normalizes zh-hant to zh-TW');
  assert.match(src, /sa=\(\)=>\{const e=String\(ea\(\)\|\|""\)\.slice\(0,2\)\.toLowerCase\(\);return\["ar","he","fa","ur"\]\.includes\(e\)\}/, 'RTL check handles subtags safely');
  assert.match(src, /async _applyLocale\(e\)\{const t=\(e\?\?this\.locale\?\?""\)\.trim\(\);await ia\(t\|\|"auto"\),this\._isRTL=sa\(\)\}/, '_applyLocale delegates auto/empty to ia() so navigator.languages[0] applies');
  assert.match(src, /navigator\.languages\)\&\&navigator\.languages\.length\&\&navigator\.languages\[0\]/, 'prefers navigator.languages[0]');
  const closeTitleMatches = src.match(/title="\$\{\(\{[^\n]*et:"Sulge"[^\n]*ka:"დახურვა"[^\n]*ru:"Закрыть"[^\n]*\|\|"Close"\)\}"/g) || [];
  const closeAriaMatches = src.match(/aria-label="\$\{\(\{[^\n]*et:"Sulge"[^\n]*ka:"დახურვა"[^\n]*ru:"Закрыть"[^\n]*\|\|"Close"\)\}"/g) || [];
  assert.equal(closeTitleMatches.length, 2, 'both Chrome (Wa) and Apple (Ga) close buttons define localized title');
  assert.equal(closeAriaMatches.length, 2, 'both Chrome (Wa) and Apple (Ga) close buttons define localized aria-label');
  assert.doesNotMatch(src, /alt="icon"/, 'decorative dialog icons use empty alt text rather than hardcoded English');
});

test('dns-diagnostics.js supports all 12 core locales with complete keys and localized check() output', async () => {
  const src = read('src/domain/dns-diagnostics.js');
  const ctx = {
    location: { href: 'https://example.test/', hostname: 'example.test', origin: 'https://example.test' },
    navigator: { onLine: true, language: 'en-US' },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ Status: 0, Answer: [{ type: 1, data: '93.184.216.34' }] }),
    }),
    AbortController,
    setTimeout,
    clearTimeout,
    URL,
    Date,
    Promise,
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'dns-diagnostics.js' });

  const enRes = await ctx.YouGeDns.check({
    hostname: 'example.test',
    origin: 'https://example.test',
    online: true,
    locale: 'en',
  });
  const kaRes = await ctx.YouGeDns.check({
    hostname: 'example.test',
    origin: 'https://example.test',
    online: true,
    locale: 'ka',
  });
  const etRes = await ctx.YouGeDns.check({
    hostname: 'example.test',
    origin: 'https://example.test',
    online: true,
    locale: 'et',
  });

  assert.equal(enRes.classification, 'normal_connectivity');
  assert.equal(kaRes.locale, 'ka');
  assert.equal(etRes.locale, 'et');
  assert.ok(enRes.caveat && kaRes.caveat && etRes.caveat, 'includes localized caveats');
  assert.notEqual(kaRes.message, enRes.message);
  assert.notEqual(etRes.message, enRes.message);
  assert.notEqual(kaRes.caveat, enRes.caveat);
  assert.notEqual(etRes.caveat, enRes.caveat);

  const tableMatch = /var DNS_MESSAGES = (\{[\s\S]*?\n  \});/.exec(src);
  assert.ok(tableMatch, 'DNS_MESSAGES table found');
  const table = vm.runInNewContext(`(${tableMatch[1]})`);
  const enKeys = Object.keys(table.en);
  for (const loc of CORE_LOCALES) {
    assert.ok(table[loc], `DNS_MESSAGES defines ${loc}`);
    assert.deepEqual(Object.keys(table[loc]).sort(), [...enKeys].sort(), `DNS_MESSAGES.${loc} matches English keys`);
  }
});

test('pwa.js exposes all 12 locales, updates wording/buttons cleanly and avoids recursion with YouGeAssistant', () => {
  const pwaSource = read('src/runtime/pwa.js');
  const document = makeRichDocument();
  const installBtn = document.createElement('button');
  installBtn.className = 'youge-install-button';
  installBtn.classList.add('youge-install-button');
  document.body.appendChild(installBtn);

  const pwaInstallEl = document.createElement('pwa-install');
  document.body.appendChild(pwaInstallEl);

  const storage = new Map();
  let assistantSetLocaleCount = 0;
  const assistantLocaleCalls = [];
  const win = Object.assign(makeEventTarget(), {
    document,
    location: { href: 'https://example.test/', hostname: 'example.test', origin: 'https://example.test', pathname: '/', search: '' },
    navigator: { languages: ['en-US'], language: 'en-US', userAgent: 'Chrome/120', onLine: true, serviceWorker: undefined },
    screen: { width: 1200, height: 800 },
    isSecureContext: true,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    matchMedia: () => ({ matches: false }),
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    URL,
    Date,
    Promise,
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout: (fn) => { return 1; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    YouGeAssistant: {
      setLocale(loc) {
        assistantSetLocaleCount += 1;
        assistantLocaleCalls.push(loc);
        // Simulate YouGeAssistant firing back youge:locale-change while pwa.js syncs
        document.dispatchEvent(new win.CustomEvent('youge:locale-change', {
          detail: { locale: loc === 'auto' ? 'en' : loc, configuredLocale: loc },
        }));
      },
    },
  });
  win.window = win;
  win.self = win;
  win.HTMLAnchorElement = function () {};
  vm.createContext(win);
  vm.runInContext(pwaSource, win, { filename: 'pwa.js' });

  const languages = win.PWA.wording.languages;
  for (const loc of CORE_LOCALES) {
    assert.ok(languages.includes(loc), `pwa.js supports ${loc}`);
  }

  assert.equal(win.PWA.setLanguage('ka'), 'ka');
  assert.equal(win.PWA.getLanguage(), 'ka');
  const kaLabel = win.PWA.wording.get('install');
  assert.notEqual(kaLabel, 'Install');
  assert.ok(collectText(installBtn).includes(kaLabel), 'install button renders Georgian label');

  assert.equal(win.PWA.setLanguage('nb-NO'), 'no');
  assert.equal(win.PWA.getLanguage(), 'no');

  assert.equal(win.PWA.setLanguage('et'), 'et');
  assert.equal(win.PWA.getLanguage(), 'et');
  assert.ok(collectText(installBtn).includes(win.PWA.wording.get('install')), 'button cache updates across language switches');
  assert.equal(assistantSetLocaleCount, 3, 'no infinite loop when YouGeAssistant echoes youge:locale-change');
  assert.deepEqual(assistantLocaleCalls, ['ka', 'nb-NO', 'et']);

  assert.equal(win.PWA.setLanguage('en'), 'en');
  assert.equal(win.PWA.wording.get('install'), 'Install');
});

test('assistant-widget.js sets lang/dir and localizes panel, status, alerts and Chrome handoff across locales', () => {
  const stateSource = read('src/assistant/assistant-state.js');
  const widgetSource = read('src/assistant/assistant-widget.js');
  const document = makeRichDocument();
  const storage = new Map();
  const win = Object.assign(makeEventTarget(), {
    document,
    location: { href: 'https://example.test/', hostname: 'example.test', origin: 'https://example.test', protocol: 'https:', pathname: '/' },
    navigator: {
      languages: ['en-US'],
      language: 'en-US',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
      onLine: false,
    },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    URL,
    Date,
    Promise,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (fn) => { fn(); return 1; },
    setTimeout: () => 1,
    clearTimeout: () => {},
    YOU_GE_ASSISTANT_CONFIG: { projectId: 'widget-i18n', locale: 'ka' },
    PWA: {
      getState: () => ({ installed: false, standalone: false, canInstall: false }),
      onChange: () => () => {},
      isInstalled: () => false,
      canInstall: () => false,
      isIOS: () => false,
      isSafari: () => false,
    },
  });
  win.window = win;
  win.self = win;
  vm.createContext(win);
  vm.runInContext(stateSource, win, { filename: 'assistant-state.js' });
  vm.runInContext(widgetSource, win, { filename: 'assistant-widget.js' });

  const rootEl = document.getElementById('youge-assistant-root');
  assert.ok(rootEl, 'widget root mounted');
  assert.equal(rootEl.getAttribute('lang'), 'ka');
  assert.equal(rootEl.getAttribute('dir'), 'ltr');
  win.YouGeAssistantWidget.open();
  const kaText = collectText(rootEl);
  assert.ok(!kaText.includes('Connection status'), 'widget status heading localized out of English');
  assert.ok(!kaText.includes('Open in Chrome'), 'Chrome handoff localized out of English');

  win.YouGeAssistant.setLocale('et');
  assert.equal(rootEl.getAttribute('lang'), 'et');
  const etText = collectText(rootEl);
  assert.notEqual(etText, kaText);

  win.YouGeAssistant.setLocale('en');
  assert.equal(rootEl.getAttribute('lang'), 'en');
  const enText = collectText(rootEl);
  assert.ok(enText.includes('Connection status'));
  assert.ok(enText.includes('Open in Chrome') || enText.includes('Open this page in Chrome'));
});

test('offline.js updates offline.html copy across locales and forwards locale to YouGeDns.check', async () => {
  const offlineHtml = read('src/offline/offline.html');
  const offlineJs = read('src/offline/offline.js');
  const document = makeRichDocument();

  const ids = [
    'appName', 'domainLabel', 'currentDomain', 'dot', 'statusText',
    'headline', 'message', 'retryLink', 'diagnosticsButton', 'diagnosticsResult',
    'recoveryGuide', 'recoverySummary', 'recoveryAndroid', 'recoveryAndroidLink',
    'recoveryIos', 'recoveryIosLink', 'recoveryAndroidApp', 'recoveryIosApp', 'hint',
  ];
  for (const id of ids) {
    assert.ok(offlineHtml.includes(`id="${id}"`), `offline.html preserves #${id}`);
    const tag = id === 'diagnosticsButton' ? 'button' : 'span';
    const el = document.createElement(tag);
    el.id = id;
    document.body.appendChild(el);
  }

  let dnsCalls = [];
  const win = Object.assign(makeEventTarget(), {
    document,
    location: { href: 'https://example.test/', hostname: 'example.test', origin: 'https://example.test', reload() {} },
    navigator: { languages: ['ka-GE', 'en-US'], language: 'ka-GE', onLine: false },
    YouGeDns: {
      check(input, opts) {
        dnsCalls.push({ input, opts });
        return Promise.resolve({ classification: 'normal_connectivity', message: 'OK-ka', caveat: 'caveat-ka' });
      },
    },
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    setTimeout: () => 1,
    URL,
    Promise,
  });
  win.window = win;
  win.self = win;
  vm.createContext(win);
  vm.runInContext(offlineJs, win, { filename: 'offline.js' });

  assert.equal(document.documentElement.lang, 'ka');
  const kaHeadline = document.getElementById('headline').textContent;
  assert.notEqual(kaHeadline, 'No connection');

  // Switch locale via pwa:language and verify live update
  win.navigator.languages = ['et-EE'];
  win.navigator.language = 'et-EE';
  win.YouGeAssistant = { getLocale: () => 'et', isCapabilityEnabled: () => true };
  document.dispatchEvent(new win.CustomEvent('youge:locale-change', { detail: { locale: 'et' } }));
  assert.equal(document.documentElement.lang, 'et');
  const etHeadline = document.getElementById('headline').textContent;
  assert.notEqual(etHeadline, kaHeadline);
  assert.notEqual(etHeadline, 'No connection');

  // Trigger diagnostics and verify locale forwarded to YouGeDns.check
  document.getElementById('diagnosticsButton')._fire({ type: 'click' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(dnsCalls.length, 1);
  assert.equal(dnsCalls[0].input.locale, 'et');
});

test('examples cover all 12 locales with complete key parity and working runtime locale switches', () => {
  // 1. examples/example/src/i18n.js
  const i18nSrc = read('examples/example/src/i18n.js');
  const i18nMatch = /const EXAMPLE_TRANSLATIONS = (\{[\s\S]*?\n\});/.exec(i18nSrc);
  assert.ok(i18nMatch, 'EXAMPLE_TRANSLATIONS found');
  const exTable = vm.runInNewContext(`(${i18nMatch[1]})`);
  const exEnKeys = Object.keys(exTable.en);
  for (const loc of CORE_LOCALES) {
    assert.ok(exTable[loc], `examples i18n defines ${loc}`);
    assert.deepEqual(
      Object.keys(exTable[loc]).filter((k) => !exEnKeys.includes(k)),
      [],
      `examples i18n ${loc} has no extra stray keys`
    );
    assert.deepEqual(
      exEnKeys.filter((k) => !Object.prototype.hasOwnProperty.call(exTable[loc], k)),
      [],
      `examples i18n ${loc} has every English key`
    );
  }
  assert.doesNotMatch(i18nSrc, /sdkTranslate\(key,\s*params/, 'tExample forwards (locale, key, params) in order');

  // 2. examples/demo/index.html inline scripts, 12 locales in DEMO_I18N + DEMO_CHROME, and #language-select
  const demoHtml = read('examples/demo/index.html');
  for (const loc of CORE_LOCALES) {
    assert.ok(demoHtml.includes(`<option value="${loc}">`), `playground selector lists ${loc}`);
  }
  const scripts = [...demoHtml.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 2, 'demo inline scripts count matches');
  scripts.forEach((m) => new Function(m[1]));

  const demoI18nMatch = /var DEMO_I18N = (\{[\s\S]*?\n        \});/.exec(scripts[1][1]);
  const demoChromeMatch = /var DEMO_CHROME = (\{[\s\S]*?\n        \});/.exec(scripts[1][1]);
  assert.ok(demoI18nMatch && demoChromeMatch, 'DEMO_I18N and DEMO_CHROME defined');
  const demoI18n = vm.runInNewContext(`(${demoI18nMatch[1]})`);
  const demoChrome = vm.runInNewContext(`(${demoChromeMatch[1]})`);
  const demoI18nKeys = Object.keys(demoI18n.en);
  const demoChromeKeys = Object.keys(demoChrome.en);
  for (const loc of CORE_LOCALES) {
    assert.deepEqual(
      demoI18nKeys.filter((k) => !Object.prototype.hasOwnProperty.call(demoI18n[loc], k)),
      [],
      `DEMO_I18N.${loc} matches English keys`
    );
    assert.deepEqual(
      demoChromeKeys.filter((k) => !Object.prototype.hasOwnProperty.call(demoChrome[loc], k)),
      [],
      `DEMO_CHROME.${loc} matches English keys`
    );
  }

  // 3. examples/example/example.js VM check across locales
  const exampleJs = read('examples/example/example.js');
  const exDoc = makeRichDocument();
  const makeEl = (id, tag = 'div') => {
    const el = exDoc.createElement(tag);
    el.id = id;
    exDoc.body.appendChild(el);
    return el;
  };
  const shiftState = makeEl('shift-state', 'span');
  const shiftToggle = makeEl('shift-toggle', 'button');
  const taskCount = makeEl('task-count', 'span');
  const taskProgress = makeEl('task-progress', 'div');
  const taskFill = makeEl('task-progress-fill', 'span');
  taskProgress.appendChild(taskFill);
  const connLabel = makeEl('connection-label', 'span');
  const connPill = makeEl('connection-status', 'span');
  const todayDate = makeEl('today-date', 'span');

  const exWin = Object.assign(makeEventTarget(), {
    document: exDoc,
    navigator: { languages: ['en-US'], language: 'en-US', onLine: true },
    Date,
    Intl,
    JSON,
    YouGeAssistant: {
      _loc: 'en',
      getLocale() { return this._loc; },
    },
  });
  exWin.window = exWin;
  exWin.self = exWin;
  vm.createContext(exWin);
  vm.runInContext(exampleJs, exWin, { filename: 'example.js' });
  exDoc.dispatchEvent({ type: 'DOMContentLoaded' });
  assert.equal(shiftState.textContent, 'Not checked in');
  assert.equal(taskCount.textContent, '0 of 3 done');

  exWin.YouGeAssistant._loc = 'ka';
  exWin.dispatchEvent({ type: 'youge:locale-change', detail: { locale: 'ka' } });
  assert.notEqual(shiftState.textContent, 'Not checked in');
  assert.notEqual(taskCount.textContent, '0 of 3 done');
  assert.notEqual(connLabel.textContent, 'Connected');

  exWin.YouGeAssistant._loc = 'en';
  exWin.dispatchEvent({ type: 'youge:locale-change', detail: { locale: 'en' } });
  assert.equal(shiftState.textContent, 'Not checked in');
  assert.equal(taskCount.textContent, '0 of 3 done');
  assert.equal(connLabel.textContent, 'Connected');
});

test('pwa.js and YouGeAssistant sync startup config, independent <pwa-install> locales, Georgian/Russian dialogs, and switch cleanly without duplicate events', async () => {
  const stateSource = read('src/assistant/assistant-state.js');
  const pwaSource = read('src/runtime/pwa.js');
  const document = makeRichDocument();

  const pwaInstallEl = document.createElement('pwa-install');
  pwaInstallEl.showDialog = () => { pwaInstallEl.isDialogHidden = false; };
  pwaInstallEl.hideDialog = () => { pwaInstallEl.isDialogHidden = true; };
  pwaInstallEl.isDialogHidden = true;
  pwaInstallEl.isInstallAvailable = true;
  document.body.appendChild(pwaInstallEl);

  const storage = new Map();
  const localeChangeEvents = [];
  const pwaLanguageEvents = [];

  const win = Object.assign(makeEventTarget(), {
    document,
    YOU_GE_ASSISTANT_CONFIG: { projectId: 'audit-sync', locale: 'ka' },
    location: { href: 'https://example.test/', hostname: 'example.test', origin: 'https://example.test', pathname: '/', search: '' },
    navigator: { languages: ['en-US'], language: 'en-US', userAgent: 'Chrome/120', onLine: true, serviceWorker: undefined },
    screen: { width: 1200, height: 800 },
    isSecureContext: true,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    matchMedia: () => ({ matches: false }),
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    URL,
    Date,
    Promise,
    MutationObserver: class { observe() {} disconnect() {} },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
  });
  win.window = win;
  win.self = win;
  win.HTMLAnchorElement = function () {};
  win.customElements = { get: (tag) => (tag === 'pwa-install' ? function MockPwaInstall() {} : undefined) };

  document.addEventListener('youge:locale-change', (e) => localeChangeEvents.push(e.detail));
  document.addEventListener('pwa:language', (e) => pwaLanguageEvents.push(e.detail));

  vm.createContext(win);
  // Load pwa.js FIRST (before assistant-state.js) to prove startup config sync works regardless of load order
  vm.runInContext(pwaSource, win, { filename: 'pwa.js' });
  assert.equal(win.PWA.getLanguage(), 'ka', 'pwa.js honors YOU_GE_ASSISTANT_CONFIG.locale before assistant-state.js loads');
  assert.equal(win.PWA.getState().installLocale, 'ka', 'PWA state exposes configured locale immediately');
  await win.PWA.showInstallDialog();
  assert.equal(pwaInstallEl.locale, 'ka', '<pwa-install> inherits configured locale instead of auto fallback');
  win.PWA.hideInstallDialog();

  vm.runInContext(stateSource, win, { filename: 'assistant-state.js' });
  const assistant = win.YouGeAssistant.attach();
  assert.equal(assistant.getLocale(), 'ka');

  // Verify Georgian install sheets/banners/QR localize cleanly with LTR direction and decorative banner alt=""
  win.PWA.showInstallHelp('ios');
  const iosSheetKa = document.querySelector('[data-pwa-help]');
  assert.ok(iosSheetKa && iosSheetKa.shadowRoot, 'iOS help sheet mounted in shadowRoot');
  const iosInnerKa = iosSheetKa.shadowRoot.querySelector('.sheet');
  assert.equal(iosInnerKa.getAttribute('dir'), null, 'Georgian sheet keeps default LTR direction');
  const iosTextKa = collectText(iosInnerKa);
  assert.ok(!iosTextKa.includes('Share') && !iosTextKa.includes('Add to Home Screen'), 'Georgian iOS help has no silent English fallback');
  assert.equal(iosInnerKa.querySelector('button.close').getAttribute('aria-label'), win.PWA.wording.get('helpCloseLabel'));
  assert.equal(iosInnerKa.querySelector('button.ok').textContent, win.PWA.wording.get('gotIt'));
  iosInnerKa.querySelector('button.close')._fire({ type: 'click' });

  const installBannerKa = win.PWA.showInstallBanner({ preview: true });
  assert.ok(installBannerKa);
  assert.equal(installBannerKa.querySelector('img').alt, '', 'install banner icon is decorative');
  assert.ok(collectText(installBannerKa).includes(win.PWA.wording.get('notNow')));

  // Switch assistant -> Russian (ru): exactly 1 youge:locale-change and 1 pwa:language
  localeChangeEvents.length = 0;
  pwaLanguageEvents.length = 0;
  assistant.setLocale('ru');
  assert.equal(assistant.getLocale(), 'ru');
  assert.equal(win.PWA.getLanguage(), 'ru');
  assert.equal(pwaInstallEl.locale, 'ru');
  assert.equal(localeChangeEvents.length, 1, 'setLocale(ru) fires youge:locale-change once');
  assert.equal(pwaLanguageEvents.length, 1, 'setLocale(ru) fires pwa:language once');

  win.PWA.showInstallHelp('generic');
  const genericSheetRu = document.querySelector('[data-pwa-help]');
  assert.ok(genericSheetRu && genericSheetRu.shadowRoot, 'Russian generic help sheet mounted');
  const genericInnerRu = genericSheetRu.shadowRoot.querySelector('.sheet');
  const genericTextRu = collectText(genericInnerRu);
  assert.ok(!genericTextRu.includes('Install') && !genericTextRu.includes('Open your browser'), 'Russian generic help has no silent English fallback');
  assert.equal(genericInnerRu.querySelector('button.close').getAttribute('aria-label'), win.PWA.wording.get('helpCloseLabel'));
  assert.equal(genericInnerRu.querySelector('button.ok').textContent, win.PWA.wording.get('gotIt'));
  genericInnerRu.querySelector('button.close')._fire({ type: 'click' });

  // Switch PWA -> English (en): exactly 1 youge:locale-change and 1 pwa:language (no bounce)
  localeChangeEvents.length = 0;
  pwaLanguageEvents.length = 0;
  win.PWA.setLanguage('en');
  assert.equal(win.PWA.getLanguage(), 'en');
  assert.equal(assistant.getLocale(), 'en');
  assert.equal(localeChangeEvents.length, 1, 'PWA.setLanguage(en) fires youge:locale-change once');
  assert.equal(pwaLanguageEvents.length, 1, 'PWA.setLanguage(en) fires pwa:language once');

  // Repeating identical setLanguage emits 0 duplicate events
  win.PWA.setLanguage('en');
  assert.equal(pwaLanguageEvents.length, 1, 'duplicate setLanguage(en) emits no extra pwa:language');

  // Non-shared install-only <pwa-install> locale (e.g. Ukrainian 'uk', Arabic 'ar') operates independently
  win.PWA.configureInstallExperience({ locale: 'uk' });
  assert.equal(pwaInstallEl.locale, 'uk', '<pwa-install> accepts install-only locale uk');
  assert.equal(win.PWA.getLanguage(), 'en', 'wording stays cleanly on supported 12-locale code');
  win.PWA.configureInstallExperience({ locale: 'ar' });
  assert.equal(pwaInstallEl.locale, 'ar', '<pwa-install> accepts RTL install-only locale ar');
  assert.equal(win.PWA.getLanguage(), 'en', 'non-shared RTL install locale does not corrupt shared wording');

  // Switching back to 'auto' follows navigator.languages[0]
  win.navigator.languages = ['ka-GE'];
  win.navigator.language = 'ka-GE';
  win.PWA.configureInstallExperience({ locale: 'auto' });
  assistant.setLocale('auto');
  assert.equal(assistant.getLocale(), 'ka');
  assert.equal(win.PWA.getLanguage(), 'ka');
});

test('examples/example/src/i18n.js resolveExampleLocale honors explicit ka/ru even when navigator is en-US', async () => {
  const sdkI18n = await import('../packages/assistant-sdk/src/core/i18n.js');
  const rawI18n = read('examples/example/src/i18n.js');
  const transformed = rawI18n
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*'@youge\/assistant-sdk\/i18n';/, '')
    .replace(/export\s*\{[^}]*\};/, '')
    .replace(/\bexport function /g, 'function ');

  const sandbox = {
    DEFAULT_LOCALE: sdkI18n.DEFAULT_LOCALE,
    SUPPORTED_LOCALES: sdkI18n.SUPPORTED_LOCALES,
    LOCALE_METADATA: sdkI18n.LOCALE_METADATA,
    resolveLocale: sdkI18n.resolveLocale,
    isRtlLocale: sdkI18n.isRtlLocale,
    sdkTranslate: sdkI18n.translate,
    navigator: { languages: ['en-US'], language: 'en-US' },
    document: { documentElement: { lang: 'en' } },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${transformed}\nthis.__exports = { resolveExampleLocale, getLocaleDirection, buildLocaleOptions, tExample };`,
    sandbox
  );

  const { resolveExampleLocale, getLocaleDirection, buildLocaleOptions, tExample } = sandbox.__exports;
  assert.equal(resolveExampleLocale('ka'), 'ka', 'explicit Georgian never silently falls back to English');
  assert.equal(resolveExampleLocale('ru'), 'ru', 'explicit Russian never silently falls back to English');
  assert.equal(resolveExampleLocale('nb-NO'), 'no');
  assert.equal(resolveExampleLocale('auto'), 'en');
  assert.equal(getLocaleDirection('ka'), 'ltr');
  assert.equal(getLocaleDirection('ru'), 'ltr');
  assert.equal(buildLocaleOptions('ka')[0].label, 'ავტო (ბრაუზერი)');
  assert.equal(buildLocaleOptions('ru')[0].label, 'Авто (браузер)');
  assert.notEqual(tExample('ka', 'openAssistant'), tExample('en', 'openAssistant'));
  assert.notEqual(tExample('ru', 'openAssistant'), tExample('en', 'openAssistant'));
});
