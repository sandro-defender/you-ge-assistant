import test from 'node:test';
import assert from 'node:assert/strict';
import { YouGeAssistant } from '../src/index.js';

test('independent update controls preserve detection and manual application', async () => {
  let calls = 0;
  const pwa = { getState: () => ({ hasUpdate: true }), applyUpdate() { calls++; return true; } };
  const a = YouGeAssistant.create({ modules: { updateNotifications: false } }, { pwa, bindEvents: false });
  assert.equal(a.getState().network.updateAvailable, true);
  assert.equal(a.getState().notifications.some(n => n.id === 'app:update'), false);
  assert.equal((await a.applyUpdate()).applied, true);
  a.configure({ modules: { userUpdate: false } });
  assert.equal((await a.applyUpdate()).outcome, 'disabled');
  assert.equal(calls, 1);
  a.destroy();
});

test('offline and cache diagnostics are independently gated and read-only', async () => {
  let cacheCalls = 0;
  const pwa = { runCacheDiagnostics() { cacheCalls++; return Promise.resolve({ status: 'ok' }); } };
  const a = YouGeAssistant.create({ modules: { offlineDiagnostics: false } }, { pwa, navigator: { onLine: false }, bindEvents: false });
  assert.equal((await a.runOfflineDiagnostics()).status, 'disabled');
  assert.equal((await a.runCacheDiagnostics()).status, 'ok');
  a.configure({ modules: { cacheDiagnostics: false } });
  assert.equal((await a.runCacheDiagnostics()).status, 'disabled');
  assert.equal((await a.runOfflineDiagnostics()).status, 'offline');
  assert.equal(cacheCalls, 1);
  a.destroy();
});

test('installation controls and extensible flags resolve through existing configuration', async () => {
  let prompts = 0;
  const pwa = { getState: () => ({ installed: true, canInstall: true }), promptInstall() { prompts++; return { outcome: 'instructions' }; } };
  const a = YouGeAssistant.create({ modules: { installationDetection: false, extensions: { reports: false, invalid: 'no' } } }, { pwa, bindEvents: false });
  assert.equal(a.getState().installation.installed, false);
  assert.equal(a.getState().installation.status, 'available');
  assert.equal((await a.requestInstall()).outcome, 'instructions');
  assert.equal(a.isCapabilityEnabled('reports'), false);
  assert.equal(a.isCapabilityEnabled('invalid'), true);
  a.configure({ modules: { installationGuidance: false } });
  assert.equal((await a.requestInstall()).outcome, 'unsupported');
  assert.equal(a.getState().installation.installed, true, 'detection remains enabled');
  assert.equal(prompts, 1);
  a.destroy();
});

test('disabled update detection does not disable manual update or diagnostics', async () => {
  let applied = 0;
  const pwa = { getState: () => ({ hasUpdate: true }), applyUpdate() { applied++; return true; } };
  const a = YouGeAssistant.create({ modules: { updateDetection: false } }, { pwa, navigator: { onLine: true }, bindEvents: false });
  assert.equal(a.getState().network.updateAvailable, false);
  assert.equal((await a.applyUpdate()).applied, true);
  assert.equal((await a.runOfflineDiagnostics()).status, 'online');
  assert.equal((await a.runCacheDiagnostics()).status, 'unavailable');
  assert.equal(applied, 1);
  a.destroy();
});

test('settings are boolean validated and user-update disabling keeps notification', () => {
  const pwa = { getState: () => ({ hasUpdate: true }) };
  const a = YouGeAssistant.create({ modules: { userUpdate: false, updateNotifications: 'false' } }, { pwa, bindEvents: false });
  assert.equal(a.getConfig().modules.updateNotifications, true);
  assert.ok(a.getState().notifications.some(n => n.id === 'app:update'));
  assert.equal(a.getState().availableActions.some(action => action.id === 'update'), false);
  a.destroy();
});
