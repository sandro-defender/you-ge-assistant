import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUNDLED_DEFAULTS,
  EVENT_NAMES,
  YouGeAssistant,
  bindElectricBorder,
  createElectricBorder,
  deriveLauncherAttention,
  normalizeLauncherConfig,
} from '../src/index.js';

const ACTIONABLE = (id, kind, priority = 4) => ({ id, kind, priority });

test('framework-independent WebGL renderer is exported and safely returns null without DOM/WebGL2', () => {
  assert.equal(createElectricBorder(null), null);
  assert.equal(bindElectricBorder(null, { getState() {}, subscribe() {} }), null);
  const children = [];
  const canvas = {
    className: '',
    style: {},
    setAttribute() {},
    addEventListener() {},
    getContext(type) { assert.equal(type, 'webgl2'); return null; },
    parentNode: null,
  };
  const document = {
    visibilityState: 'visible',
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return canvas;
    },
  };
  const container = {
    appendChild(node) { children.push(node); node.parentNode = this; },
    removeChild(node) { children.splice(children.indexOf(node), 1); node.parentNode = null; },
  };
  assert.equal(createElectricBorder(container, { document, window: {} }), null);
  assert.deepEqual(children, [], 'unsupported WebGL removes its inert canvas and leaves the host launcher usable');
  let subscriptions = 0;
  assert.equal(bindElectricBorder(container, {
    getState() { return {}; },
    subscribe() { subscriptions += 1; return () => {}; },
  }, { document, window: {} }), null);
  assert.equal(subscriptions, 0, 'a failed renderer mount does not leak a state subscription');
  assert.deepEqual(children, []);
});
const NOTICE = (id, actionId, priority = 4) => ({ id, actionId, priority });

function attentionState({ notifications = [], availableActions = [], viewed = [], dismissed = [], acknowledged = [], completed = [] } = {}) {
  return { notifications, availableActions, viewed, dismissed, acknowledged, completed };
}

test('launcher appearance defaults are backward-compatible and animation is opt-in', () => {
  assert.equal(BUNDLED_DEFAULTS.launcher.size, 56);
  assert.equal(BUNDLED_DEFAULTS.launcher.appearance.shape, 'circle');
  assert.equal(BUNDLED_DEFAULTS.launcher.appearance.logoFit, 'contain');
  assert.equal(BUNDLED_DEFAULTS.launcher.appearance.logoPosition.x, 50);
  assert.equal(BUNDLED_DEFAULTS.launcher.animation.enabled, false);
  const state = YouGeAssistant.create({ bindEvents: false }).getState();
  assert.equal(state.appearance.launcher.attention.active, false);
});

test('launcher normalizer clamps dimensions and supports logo fit, zoom, position, crop radius and shape', () => {
  const config = normalizeLauncherConfig({
    size: 500,
    logo: '/staff/mark.svg',
    appearance: {
      shape: 'rounded-square',
      logoFit: 'cover',
      logoScale: 8,
      logoPosition: { x: -20, y: 125 },
      logoBorderRadius: '18px',
      logoSize: 120,
      border: { width: 99, color: '#c084fc', style: 'dashed' },
    },
  });
  assert.equal(config.size, 128);
  assert.equal(config.sizeConfigured, true);
  assert.equal(config.logo, '/staff/mark.svg');
  assert.equal(config.appearance.shape, 'rounded-square');
  assert.equal(config.appearance.logoFit, 'cover');
  assert.equal(config.appearance.logoScale, 2.5);
  assert.deepEqual(config.appearance.logoPosition, { x: 0, y: 100 });
  assert.equal(config.appearance.logoBorderRadius, '18px');
  assert.equal(config.appearance.logoSize, 100);
  assert.equal(config.appearance.border.width, 8);
  assert.equal(config.appearance.border.style, 'dashed');
  assert.equal(normalizeLauncherConfig({ logo: 'https://elsewhere.example/mark.png' }).logo, '');
  assert.equal(normalizeLauncherConfig({ logo: 'javascript:alert(1)' }).logo, '');
  assert.equal(normalizeLauncherConfig({ appearance: { shape: 'triangle', logoFit: 'warp' } }).appearance.shape, 'circle');
  assert.equal(normalizeLauncherConfig({ appearance: { shape: 'square', logoFit: 'fill' } }).appearance.logoFit, 'fill');
});

test('electric-border is off by default, supports Plasma config and safely falls back for invalid values', () => {
  const enabled = normalizeLauncherConfig({
    animation: { enabled: true, type: 'electric-border', preset: 'plasma', color: '#c084fc', speed: 2, intensity: 0.6 },
  });
  assert.equal(enabled.animation.enabled, true);
  assert.equal(enabled.animation.type, 'electric-border');
  assert.equal(enabled.animation.preset, 'plasma');
  assert.equal(enabled.animation.color, '#c084fc');
  assert.equal(enabled.animation.speed, 2);
  assert.equal(enabled.animation.intensity, 0.6);
  assert.equal(normalizeLauncherConfig({ animation: { enabled: true, color: 'red', speed: 100 } }).animation.color, '#c084fc');
  assert.equal(normalizeLauncherConfig({ animation: { enabled: true, speed: 100 } }).animation.speed, 2.5);
  assert.equal(normalizeLauncherConfig({ animation: { enabled: 'yes', preset: 'other' } }).animation.enabled, false);
});

test('no animation for empty action state, informational notices or actions without a matching notification', () => {
  const config = normalizeLauncherConfig({ animation: { enabled: true } });
  assert.equal(deriveLauncherAttention(attentionState(), config).active, false);
  assert.equal(deriveLauncherAttention(attentionState({
    availableActions: [ACTIONABLE('diagnostics', 'diagnostics')],
    notifications: [NOTICE('feature:tips', undefined)],
  }), config).active, false);
  assert.equal(deriveLauncherAttention(attentionState({
    availableActions: [ACTIONABLE('diagnostics', 'diagnostics')],
  }), config).active, false, 'an always-available shortcut alone does not animate');
});

test('only matching eligible action categories trigger attention and acknowledgements stop it', () => {
  const config = normalizeLauncherConfig({ animation: { enabled: true } });
  const model = attentionState({
    notifications: [NOTICE('network:offline', 'diagnostics')],
    availableActions: [ACTIONABLE('diagnostics', 'diagnostics', 1)],
  });
  assert.deepEqual(deriveLauncherAttention(model, config), {
    active: true,
    eligibleActionIds: ['diagnostics'],
    priority: 1,
  });
  assert.equal(deriveLauncherAttention({ ...model, viewed: ['project:network:offline'] }, config).active, false);
  assert.equal(deriveLauncherAttention({ ...model, dismissed: ['project:network:offline'] }, config).active, false);
  assert.equal(deriveLauncherAttention({ ...model, acknowledged: ['project:network:offline'] }, config).active, false);
  assert.equal(deriveLauncherAttention({ ...model, completed: ['project:network:offline'] }, config).active, false);
  const keepUntilResolved = normalizeLauncherConfig({ animation: { enabled: true, stopWhenViewed: false } });
  assert.equal(deriveLauncherAttention({ ...model, viewed: ['project:network:offline'] }, keepUntilResolved).active, true);
  const filtered = normalizeLauncherConfig({ animation: { enabled: true, triggerCategories: ['installation'] } });
  assert.equal(deriveLauncherAttention(model, filtered).active, false);
});

test('multiple eligible notices keep one attention state until every category is removed or acknowledged', () => {
  const config = normalizeLauncherConfig({ animation: { enabled: true } });
  const model = attentionState({
    notifications: [NOTICE('install:available', 'install', 4), NOTICE('dns:failure', 'recovery', 1)],
    availableActions: [ACTIONABLE('install', 'install', 4), ACTIONABLE('recovery', 'recovery', 1)],
  });
  const result = deriveLauncherAttention(model, config);
  assert.equal(result.active, true);
  assert.deepEqual(result.eligibleActionIds, ['install', 'recovery']);
  assert.equal(result.priority, 1);
  const afterOneDismissed = deriveLauncherAttention({ ...model, dismissed: ['p:install:available'] }, config);
  assert.equal(afterOneDismissed.active, true);
  assert.deepEqual(afterOneDismissed.eligibleActionIds, ['recovery']);
  assert.equal(deriveLauncherAttention({ ...model, viewed: ['p:install:available', 'p:dns:failure'] }, config).active, false);
});

test('assistant state derives install and connectivity attention and persists viewed/completed lifecycle', () => {
  const pwaState = { installed: false, standalone: false, canInstall: true, ios: false, safari: false };
  const pwa = {
    __pwaKit: true,
    getState: () => ({ ...pwaState }),
    canInstall: () => pwaState.canInstall,
    isInstalled: () => pwaState.installed,
    isIOS: () => false,
    isSafari: () => false,
  };
  const storageMap = new Map();
  const storage = {
    getItem(key) { return storageMap.get(key) ?? null; },
    setItem(key, value) { storageMap.set(key, value); },
  };
  const assistant = YouGeAssistant.create({
    projectId: 'launcher-pwa', pwa, storage, bindEvents: false,
    launcher: { animation: { enabled: true } },
  });
  assert.equal(assistant.getState().notifications.some((notice) => notice.id === 'install:available'), true);
  assert.equal(assistant.getState().appearance.launcher.attention.active, true);
  assert.deepEqual(assistant.getState().appearance.launcher.attention.eligibleActionIds, ['install']);
  assert.equal(assistant.markViewed('install:available'), true);
  assert.equal(assistant.getState().appearance.launcher.attention.active, false);
  assert.ok(assistant.getState().viewed.some((key) => key.endsWith(':install:available')));
  assert.equal(assistant.markViewed('install:available'), false, 'repeated viewing does not emit another state change');

  // Reconfigure into a network issue and verify completion can clear one of the
  // currently actionable notification states without hiding ordinary content.
  assistant.configure({ launcher: { animation: { enabled: true } } });
  assistant.setConnectivity(false);
  const active = assistant.getState();
  assert.equal(active.appearance.launcher.attention.active, true);
  assert.ok(active.appearance.launcher.attention.eligibleActionIds.includes('diagnostics'));
  assert.equal(assistant.completeAction('diagnostics'), true);
  assert.equal(assistant.getState().appearance.launcher.attention.active, false);
  assert.equal(assistant.getState().notifications.some((notice) => notice.id === 'network:offline'), true);
  assert.equal(assistant.completeAction('missing-action'), false);
  assert.equal(EVENT_NAMES.actionCompleted, 'youge:action:complete');
  assistant.setConnectivity(true);
  assert.equal(assistant.getState().appearance.launcher.attention.active, false);
  assistant.destroy();
});

test('a real recovery action can trigger attention when diagnostics is capability-gated', () => {
  const assistant = YouGeAssistant.create({
    modules: { diagnostics: false, recovery: true },
    launcher: { animation: { enabled: true, triggerCategories: ['recovery'] } },
    bindEvents: false,
  });
  assistant.setConnectivity(false);
  const state = assistant.getState();
  const notice = state.notifications.find((entry) => entry.id === 'network:offline');
  assert.equal(notice.actionId, undefined, 'the disabled diagnostics action is not exposed as a notice link');
  assert.ok(notice.actionIds.includes('recovery'), 'the notice metadata links the real recovery action');
  assert.ok(state.availableActions.some((action) => action.id === 'recovery'));
  assert.equal(state.appearance.launcher.attention.active, true);
  assert.deepEqual(state.appearance.launcher.attention.eligibleActionIds, ['recovery']);
  assert.equal(assistant.markViewed('network:offline'), true);
  assert.equal(assistant.getState().appearance.launcher.attention.active, false);
  assistant.destroy();
});

test('action-completion DOM events update shared attention and are removed on destroy', () => {
  const listeners = new Map();
  const doc = {
    visibilityState: 'visible',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent(event) { if (listeners.has(event.type)) listeners.get(event.type)(event); },
  };
  const root = {
    document: doc,
    location: { hostname: 'events.example', origin: 'https://events.example', protocol: 'https:', pathname: '/' },
    navigator: { onLine: true },
    addEventListener() {},
    removeEventListener() {},
  };
  const assistant = YouGeAssistant.create({ launcher: { animation: { enabled: true } } }, { root });
  assistant.setConnectivity(false);
  assert.equal(assistant.getState().appearance.launcher.attention.active, true);
  doc.dispatchEvent({ type: EVENT_NAMES.actionCompleted, detail: { actionId: 'diagnostics' } });
  assert.equal(assistant.getState().appearance.launcher.attention.active, false);
  assert.ok(assistant.getState().completed.some((key) => key.endsWith(':network:offline')));
  assert.equal(listeners.has(EVENT_NAMES.actionCompleted), true);
  assistant.destroy();
  assert.equal(listeners.has(EVENT_NAMES.actionCompleted), false);
});

test('animation configuration can be disabled independently while launcher appearance remains', () => {
  const assistant = YouGeAssistant.create({
    launcher: { size: 72, appearance: { shape: 'square', logoFit: 'cover' }, animation: { enabled: false } },
    bindEvents: false,
  });
  assert.equal(assistant.getState().appearance.launcher.size, 72);
  assert.equal(assistant.getState().appearance.launcher.appearance.shape, 'square');
  assert.equal(assistant.getState().appearance.launcher.animation.enabled, false);
  assert.equal(assistant.getState().appearance.launcher.attention.active, false);
  assistant.destroy();
});
