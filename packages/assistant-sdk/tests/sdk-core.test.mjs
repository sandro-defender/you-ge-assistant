import assert from 'node:assert/strict';
import test from 'node:test';
import YouGeAssistantDefault, {
  BUNDLED_DEFAULTS,
  CHROME_OFFER_STORAGE_KEY,
  CHROME_PACKAGE,
  DOMAIN_DEFAULTS,
  EVENT_NAMES,
  KIT_COMPAT_VERSION,
  PRIORITY,
  SCHEMA_VERSION,
  SDK_VERSION,
  YouGeAssistant,
  attachAssistant,
  bridgePwaGlobals,
  buildChromeIntentUrl,
  buildManifest,
  chromeHandoffInstructions,
  createAssistant,
  createChromeHandoff,
  createDiagnosticsIntegration,
  createDomainResolver,
  deriveInstallationState,
  detectInAppBrowser,
  getGlobalAssistant,
  isChromeHandoffCandidate,
  readToolkitSummary,
  requestPwaUpdate,
  resolveAssistantConfig,
  resolveDomain,
  validatePublishedConfig,
} from '../src/index.js';
import * as domainSubpath from '../src/domain/index.js';
import * as configSubpath from '../src/config/index.js';
import * as diagnosticsSubpath from '../src/diagnostics/index.js';
import * as installationSubpath from '../src/installation/index.js';
import * as browserSubpath from '../src/browser/index.js';
import * as reactSubpath from '../src/adapters/react.js';

function makeEventTarget() {
  const map = new Map();
  return {
    addEventListener(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      const set = map.get(type);
      if (set) set.delete(fn);
    },
    dispatchEvent(event) {
      const set = map.get(event.type);
      if (set) Array.from(set).forEach((fn) => fn(event));
      return true;
    },
    count(type) {
      return map.has(type) ? map.get(type).size : 0;
    },
  };
}

function makeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(k) { return data.has(String(k)) ? data.get(String(k)) : null; },
    setItem(k, v) { data.set(String(k), String(v)); },
    removeItem(k) { data.delete(String(k)); },
    _data: data,
  };
}

function makeHostEnv(overrides = {}) {
  const doc = Object.assign({ visibilityState: 'visible' }, makeEventTarget());
  const root = Object.assign({
    document: doc,
    location: {
      href: 'https://workspace.example.com/',
      hostname: 'workspace.example.com',
      origin: 'https://workspace.example.com',
      protocol: 'https:',
      pathname: '/',
    },
    navigator: { onLine: true },
    localStorage: makeStorage(),
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
  }, makeEventTarget(), overrides);
  return { root, doc, storage: root.localStorage };
}

test('exposes explicit, documented public exports on root and subpath entry points', () => {
  assert.equal(YouGeAssistantDefault, YouGeAssistant);
  assert.equal(typeof SDK_VERSION, 'string');
  assert.equal(KIT_COMPAT_VERSION, '1.2.0');
  assert.equal(SCHEMA_VERSION, 1);
  assert.deepEqual(PRIORITY, { critical: 1, auth: 2, backup: 3, install: 4, info: 5 });
  assert.equal(typeof YouGeAssistant.create, 'function');
  assert.equal(typeof YouGeAssistant.attach, 'function');
  assert.equal(typeof YouGeAssistant.getGlobal, 'function');
  assert.equal(typeof createAssistant, 'function');
  assert.equal(typeof attachAssistant, 'function');
  assert.equal(typeof getGlobalAssistant, 'function');
  assert.equal(typeof resolveAssistantConfig, 'function');
  assert.equal(typeof validatePublishedConfig, 'function');
  assert.equal(typeof resolveDomain, 'function');
  assert.equal(typeof buildManifest, 'function');
  assert.equal(typeof createDomainResolver, 'function');
  assert.equal(typeof createDiagnosticsIntegration, 'function');
  assert.equal(typeof deriveInstallationState, 'function');
  assert.equal(typeof requestPwaUpdate, 'function');
  assert.equal(typeof bridgePwaGlobals, 'function');
  assert.equal(typeof readToolkitSummary, 'function');
  assert.ok(BUNDLED_DEFAULTS && DOMAIN_DEFAULTS && EVENT_NAMES);

  assert.equal(typeof domainSubpath.resolveDomain, 'function');
  assert.equal(typeof configSubpath.resolveAssistantConfig, 'function');
  assert.equal(typeof diagnosticsSubpath.createDiagnosticsIntegration, 'function');
  assert.equal(typeof installationSubpath.deriveInstallationState, 'function');
  assert.equal(typeof installationSubpath.requestPwaUpdate, 'function');
  assert.equal(typeof reactSubpath.createReactAdapter, 'function');

  // 0.1.1: Android in-app browser detection + Chrome handoff are first-class
  // SDK exports, reachable from the root entry, the frozen static and the
  // dedicated ./browser subpath.
  assert.equal(typeof detectInAppBrowser, 'function');
  assert.equal(typeof isChromeHandoffCandidate, 'function');
  assert.equal(typeof buildChromeIntentUrl, 'function');
  assert.equal(typeof chromeHandoffInstructions, 'function');
  assert.equal(typeof createChromeHandoff, 'function');
  assert.equal(typeof YouGeAssistant.detectInAppBrowser, 'function');
  assert.equal(typeof YouGeAssistant.buildChromeIntentUrl, 'function');
  assert.equal(typeof YouGeAssistant.createChromeHandoff, 'function');
  assert.equal(typeof browserSubpath.detectInAppBrowser, 'function');
  assert.equal(typeof browserSubpath.buildChromeIntentUrl, 'function');
  assert.equal(typeof browserSubpath.createChromeHandoff, 'function');
  assert.equal(CHROME_PACKAGE, 'com.android.chrome');
  assert.equal(CHROME_OFFER_STORAGE_KEY, 'youge-assistant:chrome-offer-dismissed');
});

test('initializes with projectId and domain in Node/SSR without browser globals', () => {
  const assistant = YouGeAssistant.create({
    projectId: 'my-project',
    domain: 'portal.example.org',
    bindEvents: false,
  });

  const state = assistant.getState();
  assert.equal(state.enabled, true);
  assert.equal(state.project.id, 'my-project');
  assert.equal(state.project.hostname, 'portal.example.org');
  assert.equal(state.project.origin, 'https://portal.example.org');
  assert.equal(state.project.configured, false);
  assert.equal(state.badge.count, 0);
  assert.equal(state.badge.tone, 'none');
  // 0.1.1: the Chrome handoff capability ships enabled by default and can be
  // turned off through the regular modules config.
  assert.equal(state.capabilities.chromeHandoff, true);

  // Snapshot is strictly JSON-serializable and stable across reads.
  assert.equal(assistant.getState(), state);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);

  assistant.destroy();
  assert.equal(assistant.isDestroyed(), true);
});

test('supports subscribing, immediate vs deferred notifications, unsubscribing and status updates', () => {
  const { root } = makeHostEnv();
  const assistant = YouGeAssistant.create({
    projectId: 'sub-test',
    domain: 'workspace.example.com',
  }, { root });

  const immediateCalls = [];
  const deferredCalls = [];
  const unsubImmediate = assistant.subscribe((state) => immediateCalls.push(state));
  const unsubDeferred = assistant.subscribe((state) => deferredCalls.push(state), { immediate: false });

  assert.equal(immediateCalls.length, 1, 'default subscription delivers initial snapshot');
  assert.equal(deferredCalls.length, 0, 'immediate:false waits for next transition');

  assistant.setConnectivity(false);
  assert.equal(immediateCalls.length, 2);
  assert.equal(deferredCalls.length, 1);
  assert.equal(deferredCalls[0].network.online, false);
  assert.equal(deferredCalls[0].badge.tone, 'critical');

  unsubImmediate();
  assistant.setSessionStatus({ state: 'issue', message: 'Token expired' });
  assert.equal(immediateCalls.length, 2, 'unsubscribed listener receives no further updates');
  assert.equal(deferredCalls.length, 2);

  assistant.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'Failover active' });
  assistant.setUpdateAvailable(true);
  const priorities = assistant.getState().notifications.map((n) => n.priority);
  assert.deepEqual([...new Set(priorities)], [1, 2, 3, 5]);

  unsubDeferred();
  assistant.destroy();
});

test('attachAssistant guarantees a single shared state source and prevents duplicate listeners', () => {
  const { root, doc } = makeHostEnv();

  const first = attachAssistant({
    projectId: 'shared-app',
    branding: { name: 'Shared Workspace' },
  }, { root });
  const second = YouGeAssistant.attach({
    theme: 'dark',
  }, { root });

  assert.equal(first, second, 'attach returns the exact same singleton instance');
  assert.equal(getGlobalAssistant(root), first);
  assert.equal(first.getState().project.id, 'shared-app');
  assert.equal(first.getState().project.name, 'Shared Workspace');
  assert.equal(first.getState().appearance.theme, 'dark');

  assert.equal(root.count('offline'), 1, 'window offline listener bound once');
  assert.equal(doc.count('youge:endpoint-status'), 1, 'document endpoint listener bound once');

  first.destroy();
  assert.equal(root.count('offline'), 0);
  assert.equal(doc.count('youge:endpoint-status'), 0);
  assert.equal(getGlobalAssistant(root), null);
});

test('cleanup and destroy remove all listeners and stop subsequent emissions', () => {
  const { root, doc } = makeHostEnv();
  const assistant = YouGeAssistant.create({ projectId: 'cleanup-check' }, { root });
  let emissions = 0;
  assistant.subscribe(() => { emissions += 1; }, { immediate: false });

  assert.equal(root.count('online'), 1);
  assert.equal(root.count('offline'), 1);
  assert.equal(root.count('storage'), 1);
  assert.equal(doc.count('visibilitychange'), 1);
  assert.equal(doc.count('youge:endpoint-status'), 1);
  assert.equal(doc.count('youge:session-status'), 1);
  assert.equal(doc.count('youge:dns-result'), 1);
  assert.equal(doc.count('pwa:ready'), 1);
  assert.equal(doc.count('pwa:installable'), 1);
  assert.equal(doc.count('pwa:installed'), 1);
  assert.equal(doc.count('pwa:update'), 1);
  assert.equal(doc.count('pwa:diagnostics'), 1);

  assistant.destroy();
  assert.equal(assistant.isDestroyed(), true);
  assert.equal(root.count('online'), 0);
  assert.equal(root.count('offline'), 0);
  assert.equal(root.count('storage'), 0);
  assert.equal(doc.count('visibilitychange'), 0);
  assert.equal(doc.count('youge:endpoint-status'), 0);
  assert.equal(doc.count('pwa:ready'), 0);

  root.dispatchEvent({ type: 'offline' });
  assistant.setConnectivity(false);
  assert.equal(emissions, 0, 'destroyed instance never emits again');
});

/* ------------------------------------------------------------------ *
 * Audit regressions (2026-11): subscription and snapshot semantics
 * ------------------------------------------------------------------ */

test('identical listeners are reference counted so one unsubscribe cannot silence another', () => {
  const { root } = makeHostEnv();
  const assistant = YouGeAssistant.create(
    { projectId: 'refcount-test', domain: 'workspace.example.com' },
    { root }
  );

  const seen = [];
  const shared = (state) => seen.push(state.network.online);
  const first = assistant.subscribe(shared, { immediate: false });
  const second = assistant.subscribe(shared, { immediate: false });

  assistant.setConnectivity(false);
  assert.deepEqual(seen, [false], 'one emit delivers one call while both subscriptions are live');

  first();
  assistant.setConnectivity(true);
  assert.deepEqual(seen, [false, true], 'the other subscription must keep receiving updates after one unsubscribe');

  second();
  assistant.setConnectivity(false);
  assert.deepEqual(seen, [false, true], 'the listener goes silent only when every subscription is released');

  assistant.destroy();
});

test('an unchanged state keeps snapshot identity and does not churn listeners', () => {
  const { root } = makeHostEnv();
  const assistant = YouGeAssistant.create(
    { projectId: 'identity-test', domain: 'workspace.example.com' },
    { root }
  );

  const before = assistant.getState();
  let notifications = 0;
  const unsubscribe = assistant.subscribe(() => { notifications += 1; });
  assert.equal(notifications, 1, 'subscribing delivers the current snapshot immediately');

  assistant.setConnectivity(true);
  assert.equal(notifications, 1, 'an idempotent transition must not re-notify');
  assert.equal(assistant.getState(), before, 'snapshot identity is stable while nothing changed');

  assistant.setConnectivity(false);
  assert.equal(notifications, 2, 'a real change notifies exactly once');
  assert.notEqual(assistant.getState(), before, 'a real change produces a new snapshot');

  unsubscribe();
  assistant.destroy();
});
