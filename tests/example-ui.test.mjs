import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../example/example.js', import.meta.url), 'utf8');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeNode {
  constructor(id = '') {
    this.id = id;
    this.textContent = '';
    this.innerHTML = '';
    this.checked = false;
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.parent = new FakeNodeListItem();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this, ...event });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  closest(selector) {
    return selector === 'li' ? this.parent : null;
  }
}

class FakeNodeListItem {
  constructor() {
    this.classList = new FakeClassList();
  }
}

function currentDateKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function createPage({ initialStorage = {}, storageBlocked = false, online = true } = {}) {
  const ids = [
    'today-date', 'connection-status', 'connection-label', 'shift-toggle', 'shift-state',
    'shift-footnote', 'task-count', 'task-progress', 'task-progress-fill',
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode(id)]));
  const checklist = Object.fromEntries(
    ['handover', 'briefing', 'priorities'].map((id) => [id, new FakeNode('task-' + id)]),
  );
  const storage = new Map(Object.entries(initialStorage));
  const notifications = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const document = {
    getElementById(id) {
      return nodes[id] || null;
    },
    querySelector(selector) {
      if (selector === '.panel-footnote') return nodes.checklistFootnote;
      const match = /^\[data-checklist-item="([^"]+)"\]$/.exec(selector);
      return match ? checklist[match[1]] || null : null;
    },
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    },
  };
  nodes.checklistFootnote = new FakeNode('checklist-footnote');

  const localStorage = {
    getItem(key) {
      if (storageBlocked) throw new Error('storage disabled');
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      if (storageBlocked) throw new Error('storage disabled');
      storage.set(key, String(value));
    },
  };
  const window = {
    localStorage,
    PWA: { notify: (message) => notifications.push(message) },
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
  };
  const navigator = { onLine: online };
  vm.runInNewContext(source, { window, document, navigator, Intl, Date, String, Boolean });
  for (const listener of documentListeners.get('DOMContentLoaded') || []) listener();

  return { nodes, checklist, storage, notifications, windowListeners, navigator };
}

test('Staff Space initializes date and connection status, and check-in toggles and persists', () => {
  const page = createPage();
  assert.ok(page.nodes['today-date'].textContent.length > 0);
  assert.equal(page.nodes['connection-label'].textContent, 'Connected');
  assert.equal(page.nodes['shift-state'].textContent, 'Not checked in');
  assert.equal(page.nodes['shift-toggle'].getAttribute('aria-pressed'), 'false');

  page.nodes['shift-toggle'].dispatch('click');
  assert.equal(page.nodes['shift-state'].textContent, 'On shift');
  assert.equal(page.nodes['shift-toggle'].getAttribute('aria-pressed'), 'true');
  assert.match(page.nodes['shift-toggle'].innerHTML, /End sample shift/);
  assert.equal(page.storage.get('staff-space-example:check-in:' + currentDateKey()), '1');
  assert.match(page.nodes['shift-footnote'].textContent, /saved on this device/);

  page.nodes['shift-toggle'].dispatch('click');
  assert.equal(page.nodes['shift-state'].textContent, 'Not checked in');
  assert.equal(page.storage.get('staff-space-example:check-in:' + currentDateKey()), '0');
  assert.equal(page.notifications.length, 2);
});

test('checklist restores stored values, updates progress, and reacts to connection changes', () => {
  const today = currentDateKey();
  const page = createPage({
    initialStorage: { ['staff-space-example:checklist:' + today + ':handover']: '1' },
  });
  assert.equal(page.checklist.handover.checked, true);
  assert.equal(page.nodes['task-count'].textContent, '1 of 3 done');
  assert.equal(page.nodes['task-progress'].getAttribute('aria-valuenow'), '1');

  page.checklist.briefing.checked = true;
  page.checklist.briefing.dispatch('change');
  assert.equal(page.nodes['task-count'].textContent, '2 of 3 done');
  assert.equal(page.nodes['task-progress'].getAttribute('aria-valuenow'), '2');
  assert.equal(page.nodes['task-progress-fill'].style.width, (2 / 3) * 100 + '%');
  assert.equal(page.checklist.briefing.parent.classList.contains('is-complete'), true);
  assert.equal(page.storage.get('staff-space-example:checklist:' + today + ':briefing'), '1');

  page.navigator.onLine = false;
  page.windowListeners.get('offline')[0]();
  assert.equal(page.nodes['connection-label'].textContent, 'Working offline');
  assert.equal(page.nodes['connection-status'].getAttribute('aria-label'), 'You are offline');
  page.navigator.onLine = true;
  page.windowListeners.get('online')[0]();
  assert.equal(page.nodes['connection-label'].textContent, 'Connected');
});

test('storage failures are reported instead of claiming sample changes were saved', () => {
  const page = createPage({ storageBlocked: true });
  assert.match(page.nodes['shift-footnote'].textContent, /storage is unavailable/i);
  assert.match(page.nodes.checklistFootnote.textContent, /may not persist/i);

  page.nodes['shift-toggle'].dispatch('click');
  page.checklist.priorities.checked = true;
  page.checklist.priorities.dispatch('change');
  assert.match(page.nodes['shift-footnote'].textContent, /may not persist/i);
  assert.match(page.nodes.checklistFootnote.textContent, /may not persist/i);
  assert.equal(page.nodes['task-count'].textContent, '1 of 3 done');
});

test('React notice actions reuse the toolkit hooks instead of being inert', () => {
  const jsx = readFileSync(new URL('../example/src/main.jsx', import.meta.url), 'utf8');
  const controls = /<div className="assistant-notice-controls">[\s\S]*?<\/div>/.exec(jsx);
  assert.ok(controls, 'the notice controls still render');
  assert.match(
    controls[0],
    /'data-pwa-install': ''/,
    'an install notice triggers the real install flow through the delegated hook',
  );
  assert.match(
    controls[0],
    /'data-pwa-diagnostics': ''/,
    'a diagnostics notice opens the toolkit diagnostics dialog',
  );
  assert.match(controls[0], /noticeActionLabel\(state, notice\)/, 'the label says what the button does');
  assert.match(jsx, /const NOTICE_ACTION_LABELS = \{/, 'fallback wording lives beside the widget');
  assert.match(jsx, /NOTICE_ACTION_LABELS\[notice\.actionId\] \|\| 'Open'/, 'an unknown action still reads as Open');
});

/* ------------------------------------------------------------------ *
 * Floating entry point refinement (November 2026): the sample button must
 * stay circular, stay clipped to its own circle, and follow the same
 * actionable-tone rule as the shipped widget.
 * ------------------------------------------------------------------ */

const exampleCss = readFileSync(new URL('../example/example.css', import.meta.url), 'utf8');
const widgetCss = readFileSync(new URL('../assistant-widget.css', import.meta.url), 'utf8');
const pwaCss = readFileSync(new URL('../pwa.css', import.meta.url), 'utf8');
const widgetSource = readFileSync(new URL('../example/src/main.jsx', import.meta.url), 'utf8');
const assistantWidgetSource = readFileSync(new URL('../assistant-widget.js', import.meta.url), 'utf8');
const exampleHtml = readFileSync(new URL('../example/index.html', import.meta.url), 'utf8');

function actionableTones(css, selector) {
  return [...new Set([...css.matchAll(new RegExp(`\\.${selector}\\[data-tone="([a-z]+)"\\]`, 'g'))].map((match) => match[1]))].sort();
}

function ruleBody(css, selector) {
  const at = css.indexOf('.' + selector + ' {');
  assert.ok(at >= 0, selector + ' rule exists');
  return css.slice(at, css.indexOf('\n}', at));
}

test('the sample floating button is a clipped circle, not a glowing square', () => {
  const fab = ruleBody(exampleCss, 'assistant-fab');
  assert.match(fab, /border-radius: 50%/, 'still a true circle');
  assert.match(fab, /background: var\(--assistant-fab-fill\)/, 'a single flat fill instead of a lit gradient');
  assert.doesNotMatch(fab, /radial-gradient\(circle at 50% 37%/, 'the bright inner spotlight is gone');
  assert.doesNotMatch(fab, /box-shadow: 0 9px 30px|0 14px 38px/, 'no big bloom shadow at rest or on hover');
  assert.match(fab, /box-shadow: 0 6px 16px/, 'one short elevation shadow instead');

  const stage = ruleBody(exampleCss, 'assistant-fab-stage');
  assert.match(stage, /inset: 0;/, 'the WebGL layer no longer hangs 12px outside the button');
  assert.match(stage, /overflow: hidden;/);
  assert.match(stage, /border-radius: 50%;/, 'the accent is clipped to the disc, so no square edge appears');
  assert.doesNotMatch(exampleCss, /\.assistant-fab-stage canvas|\.electric-logo/, 'the animated logo/canvas layer is gone entirely');
  assert.doesNotMatch(exampleCss, /\.assistant-fab::before \{[^}]*filter: blur\(/, 'the blurred outer halo is removed');
  assert.doesNotMatch(exampleCss, /\.assistant-mark-image \{[^}]*filter: drop-shadow/, 'the mark itself is not glowing');
  assert.match(exampleCss, /\.assistant-fab:focus-visible \{ outline: 3px solid/, 'keyboard focus stays visible');
});

test('the sample panel brand is a true circle, zoomed and never cropped', () => {
  const brand = ruleBody(exampleCss, 'assistant-panel-brand');
  assert.match(brand, /border-radius: 50%/, 'a real circle, not a rounded square');
  assert.doesNotMatch(brand, /border-radius:\s*(?!50%)\d/, 'no competing radius on the logo');
  assert.match(brand, /width: 40px/, 'zoomed up from the old 32px');
  assert.match(brand, /object-fit: contain/, 'the whole mark stays visible');
  assert.match(brand, /flex: none/, 'the circle keeps its size in the header row');
});

test('the sample button shares the shipped widget’s actionable-tone rule', () => {
  assert.deepEqual(
    actionableTones(exampleCss, 'assistant-fab'),
    actionableTones(widgetCss, 'youge-fab'),
    'the sample and the shipped widget must agree on what counts as actionable',
  );
  assert.deepEqual(actionableTones(widgetCss, 'youge-fab'), ['auth', 'critical', 'install']);
  assert.match(widgetSource, /const ACTIONABLE_TONES = new Set\(\['critical', 'auth', 'install'\]\);/, 'and the React code reads the same set');
  assert.match(widgetSource, /const actionable = ACTIONABLE_TONES\.has\(badge\.tone\);/, 'derived from badge tone, never stored separately');
  assert.match(widgetSource, /data-tone=\{badge\.tone\}/, 'the button publishes that tone for CSS to consume');
  for (const calm of ['info', 'backup']) {
    assert.doesNotMatch(exampleCss, new RegExp(`\\.assistant-fab\\[data-tone="${calm}"\\]`), `${calm} stays non-red in both`);
  }
});

test('the sample button shows one static zoomed mark and no logo animation', () => {
  assert.doesNotMatch(widgetSource, /ElectricLogo|electric-logo|LogoBoundary/, 'no animated logo component is mounted');
  assert.doesNotMatch(widgetSource, /setEngaged|\{engaged/, 'and no interaction gate for a logo that no longer animates');
  assert.match(widgetSource, /<img className="assistant-mark-image" src=\{assistantMark\}/, 'one simple static mark is always mounted');
  const mark = ruleBody(exampleCss, 'assistant-mark-image');
  assert.match(mark, /width: 44px/, 'zoomed to 44px inside the 66px circle');
  assert.match(mark, /top: 50%;\s*left: 50%/, 'centred by positioning only');
  assert.doesNotMatch(mark, /animation|transition/, 'the mark itself never animates');
  assert.match(widgetSource, /glareOpacity=\{0\.08\}/, 'the glare highlight is dimmed');
  assert.doesNotMatch(widgetSource, /<script|dangerouslySetInnerHTML/, 'and nothing new is injected');
  assert.match(
    exampleCss,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.assistant-fab:hover, \.assistant-fab:active[^{]*\{ transform: none !important; \}/,
    'reduced motion drops the travel as well as the duration',
  );
});

test('the sample keeps the accessibility contract while restyling', () => {
  assert.match(widgetSource, /aria-controls="assistant-panel"/);
  assert.match(widgetSource, /aria-expanded=\{open\}/);
  assert.match(widgetSource, /aria-haspopup="dialog"/);
  assert.ok(widgetSource.includes('aria-label={open ? '), 'the FAB keeps a spoken label that changes with state');
  assert.ok(
    widgetSource.includes('Open You.Ge Assistant menu') && widgetSource.includes('badge.count ? '),
    'the label still names the alert count and the highest priority in words',
  );
  assert.match(widgetSource, /className="assistant-badge" data-tone=\{badge\.tone\} aria-hidden="true"/, 'the visual chip stays decorative');
  assert.match(widgetSource, /<span className="visually-hidden" role="status" aria-live="polite">/, 'announcements keep their live region');
});

/* ------------------------------------------------------------------ *
 * 0.1.1: the React example demonstrates the Android in-app browser → *
 * Chrome handoff as an opt-in SDK feature — confident detections     *
 * only, explicit user action, manual fallback, no forced redirects.  *
 * ------------------------------------------------------------------ */

test('the React example demonstrates the Chrome handoff without forced redirects', () => {
  assert.match(
    widgetSource,
    /import \{ YouGeAssistant, createChromeHandoff \} from '@youge\/assistant-sdk'/,
    'the handoff helpers come from the SDK root entry',
  );
  assert.match(widgetSource, /handoff\.shouldOffer\(\)/, 'the banner renders only for a confident restricted detection');
  assert.match(
    widgetSource,
    /handoff\.open\(window\.location\.href, setManual\)/,
    'opening Chrome is an explicit user action, never automatic',
  );
  assert.match(
    widgetSource,
    /localStorage\.setItem\(CHROME_OFFER_DISMISS_KEY, '1'\)/,
    'the dismissal persists on this origin',
  );
  assert.match(widgetSource, /chrome-handoff-fallback/, 'a failed handoff shows the manual instructions');
  assert.match(widgetSource, /navigator\.clipboard\.writeText\(instructions\.url\)/, 'the copy action keeps the original URL');
  assert.match(
    widgetSource,
    /\{open \? null : <ChromeHandoffBanner \/>\}/,
    'the offer never covers the open panel',
  );
  assert.doesNotMatch(widgetSource, /location\.href\s*=[^=]/, 'nothing force-redirects the visitor');
  assert.match(widgetSource, /role="region" aria-label="Open in Chrome"/, 'the offer is an announced region');

  assert.match(exampleCss, /\.chrome-handoff \{/, 'the example styles its offer');
  assert.match(exampleCss, /\.chrome-handoff-url \{/, 'the preserved URL is shown, selectable');
  assert.match(exampleCss, /\.chrome-handoff-actions button \{[^}]*min-height: 40px/s, 'touch targets stay comfortable');
});

/* ------------------------------------------------------------------ *
 * These are source-structure contracts, not browser layout tests: the
 * dependency-free Node suite has no CSS layout engine. Inspect rule blocks
 * and responsive/cascade structure rather than matching a property anywhere
 * in a stylesheet.
 * ------------------------------------------------------------------ */

function cssRuleBodies(css, selector) {
  const results = [];
  const blockPattern = /(?:^|[\n}])\s*([^{}]+?)\s*\{([^{}]*)\}/g;
  for (const match of css.matchAll(blockPattern)) {
    const selectorList = match[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (selectorList.includes(selector)) {
      results.push(match[2]);
    }
  }
  return results;
}

function cssDeclarationValues(ruleBody, property) {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'gi');
  return [...ruleBody.matchAll(pattern)].map((match) => match[1].trim());
}

function cssMediaBody(css, query) {
  const marker = `@media ${query} {`;
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `${marker} responsive rule exists`);
  const bodyStart = start + marker.length;
  let depth = 1;
  for (let index = bodyStart; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(bodyStart, index);
    }
  }
  assert.fail(`${marker} responsive rule is closed`);
}

/* ------------------------------------------------------------------ *
 * Mobile Native regression: the effective panel rule must preserve a usable
 * legacy viewport cap, then enhance it with dynamic viewport units.
 * ------------------------------------------------------------------ */

test('the effective assistant-panel rule has a vh fallback and a dvh enhancement', () => {
  const panelRules = cssRuleBodies(exampleCss, '.assistant-panel');
  const maxHeightRules = panelRules
    .map((body) => cssDeclarationValues(body, 'max-height'))
    .filter((values) => values.length);

  assert.deepEqual(
    maxHeightRules,
    [
      [
        'min(60vh, calc(100vh - 104px))',
        'min(60dvh, calc(100dvh - 104px))',
      ],
      [
        'min(72vh, calc(100vh - 104px))',
        'min(72dvh, calc(100dvh - 104px))',
      ],
    ],
    'the later React rule is the active cap; older browsers keep the preceding vh value'
  );
  assert.deepEqual(
    cssDeclarationValues(panelRules[0], 'overflow-y'),
    ['auto'],
    'panel content remains vertically scrollable when capped'
  );
});

/* ------------------------------------------------------------------ *
 * Mobile Native regression: close and action hit areas remain >=44px at
 * base and mobile breakpoints. Check every matching rule to catch overrides.
 * ------------------------------------------------------------------ */

test('the install banner close button stays 44x44px across responsive rules', () => {
  const closeRules = cssRuleBodies(pwaCss, '.progressier-install-banner-close');
  const sizeRules = closeRules.filter((body) =>
    cssDeclarationValues(body, 'width').length || cssDeclarationValues(body, 'height').length
  );
  assert.equal(sizeRules.length, 1, 'only the base close rule sets its dimensions');
  assert.deepEqual(cssDeclarationValues(sizeRules[0], 'width'), ['44px']);
  assert.deepEqual(cssDeclarationValues(sizeRules[0], 'height'), ['44px']);

  const mobileCloseRules = cssRuleBodies(
    cssMediaBody(pwaCss, '(max-width: 800px)'),
    '.progressier-install-banner-close'
  );
  assert.equal(mobileCloseRules.length, 1, 'the mobile override only repositions the close control');
  assert.deepEqual(cssDeclarationValues(mobileCloseRules[0], 'width'), []);
  assert.deepEqual(cssDeclarationValues(mobileCloseRules[0], 'height'), []);
});

test('the install banner action buttons stay 44px tall at base and mobile sizes', () => {
  const selector = '.progressier-install-banner-btns button';
  const buttonRules = cssRuleBodies(pwaCss, selector);
  assert.equal(buttonRules.length, 2, 'there is one base rule and one <=800px override');
  assert.deepEqual(
    buttonRules.map((body) => cssDeclarationValues(body, 'height')),
    [['44px !important'], ['44px !important']],
    'the scoped important height wins consistently at both breakpoints'
  );

  const mobileButtonRules = cssRuleBodies(cssMediaBody(pwaCss, '(max-width: 800px)'), selector);
  assert.equal(mobileButtonRules.length, 1);
  assert.deepEqual(cssDeclarationValues(mobileButtonRules[0], 'height'), ['44px !important']);
});

/* ------------------------------------------------------------------ *
 * Mobile Native baseline: preserve the standard viewport directives while
 * asking supporting browsers to resize the layout viewport for the keyboard.
 * ------------------------------------------------------------------ */

test('the viewport meta keeps existing settings and opts into content resize', () => {
  const viewportTags = [...exampleHtml.matchAll(/<meta[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /name="viewport"/i.test(tag));
  assert.equal(viewportTags.length, 1, 'there is a single viewport declaration');

  const content = /content="([^"]*)"/i.exec(viewportTags[0]);
  assert.ok(content, 'the viewport declaration has a content attribute');
  const settings = Object.fromEntries(content[1].split(',').map((part) => {
    const [name, ...values] = part.trim().split('=');
    return [name.toLowerCase(), values.join('=').trim().toLowerCase()];
  }));
  assert.equal(settings.width, 'device-width');
  assert.equal(settings['initial-scale'], '1');
  assert.equal(settings['viewport-fit'], 'cover');
  assert.equal(settings['interactive-widget'], 'resizes-content');
});

/* ------------------------------------------------------------------ *
 * Break UI regression: long endpoint URLs and DNS classifications wrap in
 * the actual status-value cell, preserving the grid/row layout and vertical
 * scrolling without introducing a horizontal scroller.
 * ------------------------------------------------------------------ */

test('the widget status value cell can shrink and wrap without horizontal scrolling', () => {
  const gridRules = cssRuleBodies(widgetCss, '.youge-status-grid');
  const rowRules = cssRuleBodies(widgetCss, '.youge-status-row');
  const valueRules = cssRuleBodies(widgetCss, '.youge-status-value');
  const panelBodyRules = cssRuleBodies(widgetCss, '.youge-panel-body');
  assert.equal(gridRules.length, 1);
  assert.equal(rowRules.length, 1);
  assert.equal(valueRules.length, 1);
  assert.equal(panelBodyRules.length, 2, 'the base rule and mobile padding override are both present');

  assert.deepEqual(cssDeclarationValues(gridRules[0], 'display'), ['grid']);
  assert.deepEqual(cssDeclarationValues(rowRules[0], 'display'), ['flex']);
  assert.deepEqual(cssDeclarationValues(valueRules[0], 'display'), ['inline-flex']);
  assert.deepEqual(cssDeclarationValues(valueRules[0], 'min-width'), ['0']);
  assert.deepEqual(cssDeclarationValues(valueRules[0], 'overflow-wrap'), ['anywhere']);
  assert.deepEqual(
    panelBodyRules.flatMap((body) => cssDeclarationValues(body, 'overflow-y')),
    ['auto'],
    'the responsive padding rule does not replace vertical-only scrolling'
  );
  for (const [label, body] of [
    ['status grid', gridRules[0]],
    ['status row', rowRules[0]],
    ['status value', valueRules[0]],
    ...panelBodyRules.map((body) => ['panel body', body]),
  ]) {
    assert.ok(
      cssDeclarationValues(body, 'overflow-x').every((value) => !/(?:auto|scroll)/i.test(value)),
      `${label} does not gain horizontal scrolling`
    );
  }

  const statusRowStart = assistantWidgetSource.indexOf('function statusRow(label, value, tone) {');
  assert.ok(statusRowStart >= 0, 'the actual widget renderer builds status rows');
  const statusRowEnd = assistantWidgetSource.indexOf(String.fromCharCode(10) + '  }', statusRowStart);
  assert.ok(statusRowEnd > statusRowStart, 'the status row renderer has a closing block');
  const statusRowBody = assistantWidgetSource.slice(statusRowStart, statusRowEnd);
  assert.ok(statusRowBody.includes("el('span', 'youge-status-value')"));
  assert.ok(
    statusRowBody.includes("valueWrap.appendChild(el('span', '', value))"),
    'the text value is a child of the wrapping cell'
  );
});
