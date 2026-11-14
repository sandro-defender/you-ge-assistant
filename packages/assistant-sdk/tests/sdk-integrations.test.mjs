import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  YouGeAssistant,
  bridgePwaGlobals,
  readToolkitSummary,
  requestPwaUpdate,
} from '../src/index.js';
import { requestPwaUpdate as requestPwaUpdateSubpath } from '../src/installation/index.js';
import {
  FALLBACK_ASSISTANT_STATE,
  createReactAdapter,
  dispatchAssistantAction,
  getExternalStoreBindings,
} from '../src/adapters/react.js';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function collectJsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectJsFiles(full, out);
    else if (full.endsWith('.js') || full.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

test('integrates with existing diagnostics runners on-demand and single-flight without polling', async () => {
  let dnsCalls = 0;
  const fakeDns = {
    check(ctx) {
      dnsCalls += 1;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            hostname: ctx.hostname,
            classification: 'normal_connectivity',
            message: 'Healthy DNS and app probe.',
          });
        }, 10);
      });
    },
  };

  const assistant = YouGeAssistant.create({
    projectId: 'diag-project',
    domain: 'app.example.com',
    dns: fakeDns,
    bindEvents: false,
  });

  // No diagnostic runs automatically upon initialization.
  assert.equal(dnsCalls, 0);
  assert.equal(assistant.getState().network.dns.status, 'idle');

  // Concurrent explicit calls share one in-flight promise.
  const p1 = assistant.runDiagnostics();
  const p2 = assistant.runDiagnostics();
  assert.equal(p1, p2);
  assert.equal(assistant.getState().network.dns.status, 'running');

  const result = await p1;
  assert.equal(dnsCalls, 1);
  assert.equal(result.classification, 'normal_connectivity');
  assert.equal(assistant.getState().network.dns.classification, 'normal_connectivity');
  assert.equal(assistant.getState().network.dns.status, 'complete');

  assistant.destroy();
});

test('integrates with window.PWA installation flow and supports lazy pwa:ready binding without competing prompts', async () => {
  const listeners = new Map();
  const doc = {
    visibilityState: 'visible',
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(ev) { if (listeners.has(ev.type)) listeners.get(ev.type)(ev); },
  };
  const root = {
    document: doc,
    location: { hostname: 'pwa.example.com', origin: 'https://pwa.example.com', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true },
    addEventListener() {},
    removeEventListener() {},
  };

  // Start before window.PWA exists (simulating deferred pwa.js load)
  const assistant = YouGeAssistant.create({ projectId: 'lazy-pwa' }, { root });
  assert.equal(assistant.getState().installation.support, 'none');
  assert.equal((await assistant.requestInstall()).outcome, 'unsupported');

  // Now pwa.js finishes loading and publishes window.PWA + pwa:ready
  let promptCalls = 0;
  let onChangeCallback = null;
  const pwaState = { installed: false, standalone: false, canInstall: true, ios: false, safari: false };
  root.PWA = {
    __pwaKit: true,
    version: '1.1.0',
    config: { features: { installation: true, diagnostics: true } },
    getState: () => ({ ...pwaState }),
    canInstall: () => pwaState.canInstall,
    isInstalled: () => pwaState.installed,
    isIOS: () => false,
    isSafari: () => false,
    onChange(cb) {
      onChangeCallback = cb;
      return () => { onChangeCallback = null; };
    },
    promptInstall() {
      promptCalls += 1;
      pwaState.installed = true;
      pwaState.canInstall = false;
      if (onChangeCallback) onChangeCallback({ ...pwaState });
      return Promise.resolve({ outcome: 'accepted' });
    },
  };

  doc.dispatchEvent({ type: 'pwa:ready' });
  assert.equal(assistant.getState().installation.support, 'native');
  assert.equal(assistant.getState().installation.nativeAvailable, true);

  const installResult = await assistant.requestInstall();
  assert.equal(installResult.outcome, 'accepted');
  assert.equal(promptCalls, 1, 'delegates directly to PWA.promptInstall');
  assert.equal(assistant.getState().installation.status, 'installed');

  const summary = readToolkitSummary(root);
  assert.equal(summary.hasPwaToolkit, true);
  assert.equal(summary.pwaVersion, '1.1.0');

  assistant.destroy();
  assert.equal(onChangeCallback, null, 'destroy unsubscribes from PWA.onChange');
});

test('bridgePwaGlobals connects domain resolver and singleton state without overwriting existing window.PWA', () => {
  const existingPwa = { __pwaKit: true, version: '1.1.0', getState: () => ({}) };
  const root = {
    PWA: existingPwa,
    location: { hostname: 'bridge.example.com', origin: 'https://bridge.example.com', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true },
  };

  const bridged = bridgePwaGlobals({
    root,
    domainRegistry: {
      'bridge.example.com': { identity: { name: 'Bridged App' } },
    },
    assistantConfig: { projectId: 'bridged-project', bindEvents: false },
  });

  assert.equal(bridged.bridged, true);
  assert.equal(root.PWA, existingPwa, 'existing window.PWA is untouched');
  assert.equal(bridged.assistant.getState().project.name, 'Bridged App');
  assert.equal(root.YouGeAssistant, bridged.assistant);

  bridged.assistant.destroy();
});

test('optional React adapter works via injected useSyncExternalStore with memoized selectors and SSR fallback', () => {
  const assistant = YouGeAssistant.create({
    projectId: 'react-adapter-test',
    features: [{ id: 'f1', label: 'Feature 1' }],
    bindEvents: false,
  });

  // Minimal synchronous simulation of React's useSyncExternalStore
  let subscribedCleanup = null;
  function fakeUseSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    assert.equal(typeof getServerSnapshot, 'function');
    assert.equal(getServerSnapshot(), FALLBACK_ASSISTANT_STATE);
    subscribedCleanup = subscribe(() => {});
    return getSnapshot();
  }

  const adapter = createReactAdapter({
    useSyncExternalStore: fakeUseSyncExternalStore,
    assistant,
  });

  const fullState = adapter.useAssistant();
  assert.equal(fullState.project.id, 'react-adapter-test');
  const badgeCount = adapter.useAssistant((s) => s.badge.count);
  assert.equal(badgeCount, 1);

  const bindings = getExternalStoreBindings(assistant, (s) => ({ count: s.badge.count }));
  const firstSelected = bindings.getSnapshot();
  const secondSelected = bindings.getSnapshot();
  assert.equal(firstSelected, secondSelected, 'selector output is cached while state snapshot is unchanged');

  if (subscribedCleanup) subscribedCleanup();
  assistant.destroy();
});

test('SDK package has zero runtime dependencies, zero React import in core, zero fetch, zero SW register and zero polling', () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies, undefined, 'no mandatory runtime dependencies');
  assert.equal(pkg.peerDependenciesMeta?.react?.optional, true, 'React peer is optional');

  const files = collectJsFiles(join(pkgRoot, 'src'));
  assert.ok(files.length >= 10);

  for (const file of files) {
    const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${file} makes no network fetch calls`);
    assert.doesNotMatch(source, /serviceWorker\.register|\.register\s*\(/, `${file} never registers a service worker`);
    assert.doesNotMatch(source, /\bsetInterval\s*\(/, `${file} never polls on an interval`);
    assert.doesNotMatch(source, /from\s+['"]react['"]|require\(['"]react['"]\)/, `${file} has no runtime import of react`);
    assert.doesNotMatch(source, /react-bits|ogl|gsap|three/, `${file} has no UI library dependency`);
    assert.doesNotMatch(source, /\beval\s*\(|\bnew\s+Function\s*\(/, `${file} never evaluates dynamic code`);
    assert.doesNotMatch(source, /staff\.you\.ge|workers\.dev/, `${file} contains no hardcoded project hostnames`);
  }
});

/* ------------------------------------------------------------------ *
 * Audit regressions (2026-11): toolkit-driven update state + React bindings
 * ------------------------------------------------------------------ */

test('a waiting service-worker update surfaces from the toolkit snapshot, not only from events', () => {
  const root = {
    document: null,
    location: { hostname: 'update.example.com', origin: 'https://update.example.com', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true },
    addEventListener() {},
    removeEventListener() {},
  };

  // Case 1: the update was discovered before the assistant existed, so no
  // `pwa:update` event can ever reach it.
  const pwaState = { installed: false, standalone: false, canInstall: false, hasUpdate: true };
  root.PWA = {
    __pwaKit: true,
    config: { features: {} },
    getState: () => ({ ...pwaState }),
    onChange(listener) { listener(this.getState()); return () => {}; },
  };
  const assistant = YouGeAssistant.create({ projectId: 'update-seed' }, { root });
  assert.equal(assistant.getState().network.updateAvailable, true, 'the waiting worker is visible without an event');
  assert.ok(assistant.getState().notifications.some((n) => n.id === 'app:update'), 'the update notice is raised');
  assert.ok(assistant.getState().availableActions.some((a) => a.id === 'update'), 'the apply-update action is offered');

  // Case 2: once the toolkit no longer reports a waiting worker it clears.
  pwaState.hasUpdate = false;
  assistant.setUpdateAvailable(false);
  assert.equal(assistant.getState().network.updateAvailable, false);
  assert.equal(assistant.getState().notifications.some((n) => n.id === 'app:update'), false);
  assistant.destroy();
});

test('external-store bindings resolve the assistant once instead of re-attaching per snapshot', () => {
  let resolutions = 0;
  let configures = 0;
  const assistant = YouGeAssistant.create({ projectId: 'resolve-once', bindEvents: false });
  const originalConfigure = assistant.configure;
  assistant.configure = (options) => { configures += 1; return originalConfigure(options); };

  // The pattern documented for hosts: a getter that attaches (and therefore
  // configures) the shared instance. React calls getSnapshot on every render.
  const getter = () => {
    resolutions += 1;
    assistant.configure({ projectId: 'resolve-once' });
    return assistant;
  };

  const bindings = getExternalStoreBindings(getter, null, FALLBACK_ASSISTANT_STATE);
  const first = bindings.getSnapshot();
  const second = bindings.getSnapshot();
  const unsubscribe = bindings.subscribe(() => {});

  assert.equal(resolutions, 1, 'the instance getter must not run once per snapshot');
  assert.equal(configures, 1, 'a per-render re-configure would loop React and rewrite storage');
  assert.equal(first, second, 'useSyncExternalStore sees a stable snapshot while state is unchanged');

  unsubscribe();
  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * Stage 3 regressions (2026-11): cancellation hygiene in the adapter
 * ------------------------------------------------------------------ */

function manualSignal() {
  const listeners = new Set();
  const removed = [];
  return {
    aborted: false,
    removed,
    get listenerCount() { return listeners.size; },
    addEventListener(type, listener) { listeners.add(listener); },
    removeEventListener(type, listener) { removed.push(type); listeners.delete(listener); },
    abort() { this.aborted = true; Array.from(listeners).forEach((listener) => listener({ type: 'abort' })); },
  };
}

test('a cancelled diagnostics run records cancellation and never reports a synthetic error', async () => {
  const controller = new AbortController();
  let runnerSignal = null;
  const assistant = YouGeAssistant.create({
    projectId: 'cancel-run',
    bindEvents: false,
    services: {
      diagnostics: (options) => {
        runnerSignal = options && options.signal;
        // A real probe settles when its signal aborts; simulate exactly that.
        return new Promise((resolve, reject) => {
          if (!options || !options.signal) return;
          options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { kind: 'cancelled' })), { once: true });
        });
      },
    },
  });

  const running = assistant.runDiagnostics({ signal: controller.signal });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(runnerSignal && typeof runnerSignal.addEventListener === 'function', 'the runner receives an abortable signal');
  assert.equal(runnerSignal.aborted, false);
  controller.abort();
  assert.equal(runnerSignal.aborted, true, 'the caller cancellation reaches the delegated runner');
  const result = await running;

  assert.equal(result.status, 'cancelled');
  assert.equal(result.cancelled, true);
  assert.equal(result.failed, false);
  assert.equal(assistant.getState().network.dns.status, 'cancelled');
  assert.equal(
    assistant.getState().notifications.some((n) => n.id === 'network:unreachable'),
    false,
    'a user cancellation must never raise a critical connection notice'
  );
  assert.equal(assistant.isDestroyed(), false);

  assistant.destroy();
});

test('destroying the assistant while diagnostics are in flight aborts them and they cannot resurrect state', async () => {
  const controller = new AbortController();
  let receivedSignal = null;
  const assistant = YouGeAssistant.create({
    projectId: 'cancel-on-destroy',
    services: {
      diagnostics: (options) => new Promise((resolve) => {
        receivedSignal = options && options.signal;
        setTimeout(() => resolve({ classification: 'normal_connectivity', message: 'late result' }), 5);
      }),
    },
  });

  const running = assistant.runDiagnostics({ signal: controller.signal });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(receivedSignal, 'the delegated runner received an abortable signal');
  assert.equal(receivedSignal.aborted, false);
  assistant.destroy();
  assert.equal(receivedSignal.aborted, true, 'destroy aborts the run it owns');

  const result = await running;
  assert.equal(result.failed, false);
  assert.equal(result.status, 'cancelled');
  assert.equal(assistant.getState().network.dns.status, 'running', 'a destroyed instance never publishes a late result');
});

test('the adapter forwards a caller signal to real runners and cleans the run up on abort', async () => {
  const signal = manualSignal();
  let seenOptions = null;
  const assistant = YouGeAssistant.create({
    projectId: 'forward-signal',
    bindEvents: false,
    services: {
      diagnostics: (options) => {
        seenOptions = options;
        return new Promise((resolve) => setTimeout(() => resolve({ classification: 'normal_connectivity' }), 10));
      },
    },
  });

  const running = assistant.runDiagnostics({ signal });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(seenOptions && typeof seenOptions.signal.addEventListener === 'function', 'the runner receives an abortable signal');
  assert.equal(seenOptions.signal.aborted, false);

  signal.abort();
  assert.equal(seenOptions.signal.aborted, true, 'the caller abort propagates to the runner signal');
  const cancelled = await running;
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.failed, false, 'a cancellation is not a failure');
  assert.equal(assistant.getState().network.dns.status, 'cancelled');
  assert.equal(assistant.getState().network.dns.classification, 'cancelled');
  assert.equal(
    assistant.getState().notifications.some((n) => n.id === 'network:unreachable' || n.id === 'dns:failure'),
    false,
    'cancellation raises no connectivity or DNS notice'
  );

  // A later run is not blocked by the cancelled one.
  const again = await assistant.runDiagnostics();
  assert.equal(again.classification, 'normal_connectivity');
  assert.equal(assistant.getState().network.dns.classification, 'normal_connectivity');
  assert.equal(signal.listenerCount, 0, 'the adapter releases its caller listener');

  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * Stage 4 regressions (2026-11): unified update lifecycle
 * ------------------------------------------------------------------ */

test('requestPwaUpdate delegates safely and classifies applied, no-waiting-worker, disabled, unsupported and error outcomes', async () => {
  assert.equal(requestPwaUpdate, requestPwaUpdateSubpath, 'root entry re-exports installation.requestPwaUpdate');

  assert.deepEqual(await requestPwaUpdate({ pwa: null }), { applied: false, outcome: 'unsupported' });
  assert.deepEqual(await requestPwaUpdate({ pwa: {} }), { applied: false, outcome: 'unsupported' });

  let calls = 0;
  assert.deepEqual(
    await requestPwaUpdate({ enabled: false, pwa: { applyUpdate: () => { calls += 1; return true; } } }),
    { applied: false, outcome: 'disabled' }
  );
  assert.equal(calls, 0, 'disabled update module does not invoke PWA.applyUpdate');

  assert.deepEqual(
    await requestPwaUpdate({ pwa: { applyUpdate: () => Promise.resolve(true) } }),
    { applied: true, outcome: 'applied' }
  );

  assert.deepEqual(
    await requestPwaUpdate({ pwa: { applyUpdate: () => Promise.resolve(false) } }),
    { applied: false, outcome: 'no-waiting-worker' }
  );

  assert.deepEqual(
    await requestPwaUpdate({ pwa: { applyUpdate: () => { throw new Error('sync fail'); } } }),
    { applied: false, outcome: 'error' }
  );

  assert.deepEqual(
    await requestPwaUpdate({ pwa: { applyUpdate: () => Promise.reject(new Error('async fail')) } }),
    { applied: false, outcome: 'error' }
  );
});

test('assistant.applyUpdate delegates to PWA, respects modules.updates and clears stale update state only when no waiting worker remains', async () => {
  const listeners = new Map();
  const doc = {
    visibilityState: 'visible',
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(ev) { if (listeners.has(ev.type)) listeners.get(ev.type)(ev); },
  };
  const pwaState = { installed: true, standalone: true, canInstall: false, hasUpdate: true };
  let onChangeListener = null;
  let applyCalls = 0;
  let nextApplyResult = true;
  const root = {
    document: doc,
    location: { hostname: 'update.example.com', origin: 'https://update.example.com', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true },
    addEventListener() {},
    removeEventListener() {},
    PWA: {
      __pwaKit: true,
      config: { features: {} },
      getState: () => ({ ...pwaState }),
      onChange(cb) {
        onChangeListener = cb;
        cb(this.getState());
        return () => { if (onChangeListener === cb) onChangeListener = null; };
      },
      applyUpdate() {
        applyCalls += 1;
        if (nextApplyResult instanceof Error) return Promise.reject(nextApplyResult);
        return Promise.resolve(nextApplyResult);
      },
    },
  };

  const assistant = YouGeAssistant.create({ projectId: 'apply-update-flow' }, { root });
  doc.dispatchEvent({ type: 'pwa:update' });
  assert.equal(assistant.getState().network.updateAvailable, true);
  assert.ok(assistant.getState().notifications.some((n) => n.id === 'app:update'));
  assert.ok(assistant.getState().availableActions.some((a) => a.id === 'update'));

  // 1. Applying while waiting worker exists delegates and returns applied: true without clearing prematurely
  const applied = await assistant.applyUpdate();
  assert.deepEqual(applied, { applied: true, outcome: 'applied' });
  assert.equal(applyCalls, 1);
  assert.equal(assistant.getState().network.updateAvailable, true, 'stays true while waiting worker has not transitioned yet');

  // 2. If applyUpdate rejects or reports false while hasUpdate is still true, valid update state is preserved
  nextApplyResult = new Error('postMessage error');
  assert.deepEqual(await assistant.applyUpdate(), { applied: false, outcome: 'error' });
  assert.equal(assistant.getState().network.updateAvailable, true);

  nextApplyResult = false;
  assert.deepEqual(await assistant.applyUpdate(), { applied: false, outcome: 'no-waiting-worker' });
  assert.equal(assistant.getState().network.updateAvailable, true, 'does not clear while PWA.getState().hasUpdate is still true');

  // 3. Disabled updates module refuses cleanly without calling PWA
  assistant.configure({ modules: { updates: false } });
  const beforeDisabledCalls = applyCalls;
  assert.deepEqual(await assistant.applyUpdate(), { applied: false, outcome: 'disabled' });
  assert.equal(applyCalls, beforeDisabledCalls);
  assistant.configure({ modules: { updates: true } });

  // 4. Waiting worker disappears -> applyUpdate resolves false + hasUpdate is false -> clears stale notice
  pwaState.hasUpdate = false;
  const snapshots = [];
  const unsub = assistant.subscribe((s) => snapshots.push(s), { immediate: false });
  const staleResult = await assistant.applyUpdate();
  assert.deepEqual(staleResult, { applied: false, outcome: 'no-waiting-worker' });
  assert.equal(assistant.getState().network.updateAvailable, false);
  assert.equal(assistant.getState().notifications.some((n) => n.id === 'app:update'), false);
  assert.equal(assistant.getState().availableActions.some((a) => a.id === 'update'), false);
  assert.equal(snapshots.length, 1, 'clearing stale update state emits one updated snapshot');
  unsub();

  // 5. Lifecycle sync via onChange (true -> false) clears even after pwa:update fired
  pwaState.hasUpdate = true;
  onChangeListener({ ...pwaState });
  doc.dispatchEvent({ type: 'pwa:update' });
  assert.equal(assistant.getState().network.updateAvailable, true);
  pwaState.hasUpdate = false;
  onChangeListener({ ...pwaState });
  assert.equal(assistant.getState().network.updateAvailable, false, 'onChange transition true -> false clears conditions.updateAvailable');

  // 6. Lifecycle sync via visibilitychange when hasUpdate transitioned true -> false without onChange
  pwaState.hasUpdate = true;
  doc.dispatchEvent({ type: 'pwa:update' });
  assert.equal(assistant.getState().network.updateAvailable, true);
  pwaState.hasUpdate = false;
  doc.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(assistant.getState().network.updateAvailable, false);

  assistant.destroy();
  assert.deepEqual(await assistant.applyUpdate(), { applied: false, outcome: 'unsupported' });
});

test('assistant.applyUpdate preserves manual update state when PWA runtime is unavailable or omits hasUpdate', async () => {
  const docListeners = new Map();
  const doc = {
    visibilityState: 'visible',
    addEventListener(type, fn) { docListeners.set(type, fn); },
    removeEventListener(type) { docListeners.delete(type); },
    dispatchEvent(ev) { if (docListeners.has(ev.type)) docListeners.get(ev.type)(ev); },
  };
  const standalone = YouGeAssistant.create({ projectId: 'no-pwa-update' }, {
    root: { document: doc, location: { hostname: 'alone.example', origin: 'https://alone.example', protocol: 'https:', pathname: '/' }, navigator: { onLine: true }, addEventListener() {}, removeEventListener() {} },
  });
  standalone.setUpdateAvailable(true);
  assert.deepEqual(await standalone.applyUpdate(), { applied: false, outcome: 'unsupported' });
  assert.equal(standalone.getState().network.updateAvailable, true, 'manual update state stays intact when runtime is absent');
  standalone.destroy();
});

test('dispatchAssistantAction and React adapter route update actions through AssistantInstance.applyUpdate and fall back to bare PWA mocks', async () => {
  const dispatched = [];
  const doc = {
    dispatchEvent(ev) { dispatched.push(ev); },
  };
  const root = {
    document: doc,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  };

  let pwaDirectCalls = 0;
  const barePwa = { applyUpdate() { pwaDirectCalls += 1; return Promise.resolve(true); } };

  let assistantCalls = 0;
  const assistantWithApply = {
    applyUpdate() { assistantCalls += 1; return Promise.resolve({ applied: true, outcome: 'applied' }); },
  };

  // 1. Routes through assistant.applyUpdate() without touching barePwa directly
  await dispatchAssistantAction('update', 'update', {
    assistant: assistantWithApply,
    pwa: barePwa,
    document: doc,
    root,
  });
  assert.equal(assistantCalls, 1, 'routes through AssistantInstance.applyUpdate');
  assert.equal(pwaDirectCalls, 0, 'does not bypass Assistant API to call PWA.applyUpdate directly');
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, 'youge:action');
  assert.equal(dispatched[0].detail.id, 'update');

  // 2. React adapter dispatchAction uses the same Assistant API path
  const adapter = createReactAdapter({
    useSyncExternalStore: (sub, get) => get(),
    assistant: Object.assign(YouGeAssistant.create({ projectId: 'react-update', bindEvents: false }), {
      applyUpdate() { assistantCalls += 1; return Promise.resolve({ applied: true, outcome: 'applied' }); },
    }),
    env: { root: Object.assign({ PWA: barePwa }, root) },
  });
  await adapter.dispatchAction('update', 'update');
  assert.equal(assistantCalls, 2);
  assert.equal(pwaDirectCalls, 0);

  // 3. Falls back to PWA.applyUpdate when only a bare PWA mock exists
  await dispatchAssistantAction('update', 'update', {
    assistant: { getState: () => ({}) },
    pwa: barePwa,
    document: doc,
    root,
  });
  assert.equal(pwaDirectCalls, 1, 'falls back when AssistantInstance.applyUpdate is absent');
});
