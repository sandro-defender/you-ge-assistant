import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAssistant } from '../packages/assistant-sdk/src/index.js';

const html = readFileSync(new URL('../examples/example/launcher-demo.html', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../examples/example/public/launcher-demo.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../examples/example/launcher-demo.css', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../examples/example/vite.config.js', import.meta.url), 'utf8');

test('launcher demo loads the actual SDK state bundle and classic launcher renderer in order', () => {
  const state = html.indexOf('src="assistant-state.js"');
  const widget = html.indexOf('src="assistant-widget.js"');
  const demo = html.indexOf('src="launcher-demo.js"');
  assert.ok(state >= 0 && state < widget && widget < demo, 'SDK, widget, then host controls load in sequence');
  assert.match(html, /<main id="main" class="demo-shell">/);
  assert.match(html, /Northstar Workspace/);
  assert.match(html, /launcher-demo-logo\.svg/);
  assert.match(vite, /launcherDemo: path\.join\(exampleRoot, 'launcher-demo\.html'\)/);
});

test('scenario controls use SDK-backed installability, connectivity and action lifecycle state', () => {
  for (const state of ['idle', 'install', 'network', 'multiple']) {
    assert.match(html, new RegExp(`data-scenario="${state}"`));
  }
  assert.match(controls, /api\.configure\(\{[\s\S]*?launcher: launcherConfig\(\)/);
  assert.match(controls, /api\.setConnectivity\(!offline\)/);
  assert.match(controls, /api\.completeAction\('install'\)/);
  assert.match(controls, /api\.completeAction\(id\)/);
  assert.match(controls, /api\.subscribe\(render\)/);
  assert.match(controls, /window\.PWA = canInstall \|\| installed \? pwa : null/);
  assert.match(html, /getState: \(\) => \(\{ \.\.\.snapshot \}\)/, 'installability is supplied through the supported PWA snapshot shape');
  assert.match(html, /promptInstall: async/);
});

class EventTargetHarness {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    return true;
  }
}

test('demo scenarios resolve through the centralized SDK action and completion lifecycle', () => {
  const root = new EventTargetHarness();
  const document = new EventTargetHarness();
  const stored = new Map();
  document.visibilityState = 'visible';
  root.location = {
    href: 'https://demo.example/launcher-demo.html',
    origin: 'https://demo.example',
    hostname: 'demo.example',
    protocol: 'https:',
    pathname: '/launcher-demo.html',
  };
  root.navigator = { onLine: true, language: 'en', userAgent: 'Demo browser' };
  root.localStorage = {
    getItem(key) { return stored.get(key) ?? null; },
    setItem(key, value) { stored.set(key, String(value)); },
    removeItem(key) { stored.delete(key); },
  };
  root.URL = URL;
  root.Date = Date;
  root.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  root.document = document;

  const assistant = createAssistant({
    projectId: 'launcher-demo-test',
    launcher: {
      size: 68,
      animation: { enabled: true, triggerCategories: ['installation', 'connectivity', 'recovery'], stopWhenViewed: false },
    },
  }, { root, document });

  assert.equal(assistant.getState().appearance.launcher.attention.active, false, 'idle has no PWA adapter or actionable notice');
  root.PWA = {
    snapshot: { canInstall: true, installed: false },
    getState() { return { ...this.snapshot }; },
    canInstall() { return this.snapshot.canInstall; },
    isInstalled() { return this.snapshot.installed; },
  };
  document.dispatchEvent({ type: 'pwa:installable' });
  assert.ok(assistant.getState().availableActions.some((action) => action.id === 'install'));
  assert.equal(assistant.getState().appearance.launcher.attention.active, true, 'installation is an eligible SDK action');

  assistant.setConnectivity(false);
  let state = assistant.getState();
  assert.ok(state.notifications.some((notice) => notice.id === 'network:offline'));
  assert.ok(state.availableActions.some((action) => action.id === 'diagnostics'));
  assert.ok(state.availableActions.some((action) => action.id === 'recovery'));
  assert.equal(state.appearance.launcher.attention.active, true, 'network actions join installation under one attention state');
  assert.ok(state.appearance.launcher.attention.eligibleActionIds.includes('install'));
  assert.ok(state.appearance.launcher.attention.eligibleActionIds.includes('recovery'));

  assert.equal(assistant.completeAction('install'), true);
  state = assistant.getState();
  assert.equal(state.appearance.launcher.attention.active, true, 'completing install leaves network recovery attention active');
  assert.ok(!state.appearance.launcher.attention.eligibleActionIds.includes('install'));
  assert.ok(state.appearance.launcher.attention.eligibleActionIds.includes('recovery'));

  root.PWA.snapshot = { canInstall: false, installed: true };
  document.dispatchEvent({ type: 'pwa:installed' });
  assistant.setConnectivity(true);
  state = assistant.getState();
  assert.equal(state.appearance.launcher.attention.active, false, 'resolving connectivity removes all remaining eligible actions');
  assert.deepEqual(state.notifications, []);
  assistant.destroy();
});

test('appearance controls change the real launcher configuration and retain accessible static states', () => {
  for (const id of ['animation-enabled', 'launcher-shape', 'logo-fit', 'logo-zoom', 'outline-color', 'outline-speed', 'outline-intensity']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(controls, /api\.configure\(\{ launcher: launcherConfig\(\) \}\)/);
  assert.match(controls, /stopWhenViewed: false/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /No service worker required/);
  assert.doesNotMatch(controls, /serviceWorker\.register|fetch\s*\(/);
});
