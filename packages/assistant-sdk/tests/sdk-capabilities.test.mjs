/*!
 * CD-1 — module capability enforcement (SDK).
 *
 * Behavioral matrix for `modules.diagnostics`, `modules.recovery`,
 * `modules.failover` and `modules.help`: each independently disabled, all four
 * at once, all enabled, missing/partial configuration, default and backward
 * compatibility, direct API calls, indirect activation through configuration,
 * notifications, events and callbacks, and asynchronous/initialization-order
 * edge cases.
 *
 * Every test asserts behavior (what the SDK does), never the presence of a flag
 * or of a conditional statement.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUNDLED_DEFAULTS,
  GATED_CAPABILITIES,
  YouGeAssistant,
  capabilitiesRecord,
  capabilityForAction,
  createAssistant,
  disabledDiagnosticsResult,
  isActionAllowed,
  isCapabilityEnabled,
} from '../src/index.js';
import { createDiagnosticsIntegration } from '../src/diagnostics/index.js';
import { dispatchAssistantAction } from '../src/adapters/react.js';

const ALL_GATED = ['diagnostics', 'recovery', 'failover', 'help'];

/** A minimal environment: no DOM, no storage, no PWA, no events bound. */
function makeAssistant(config = {}, env = {}) {
  return createAssistant(Object.assign({ bindEvents: false }, config), Object.assign({ root: {} }, env));
}

function actionIds(state) {
  return state.availableActions.map((action) => action.id);
}

function noticeIds(state) {
  return state.notifications.map((notice) => notice.id);
}

/** A connectivity failure state: the condition that offers every gated action. */
function withFailures(assistant) {
  assistant.setConnectivity(false);
  assistant.setDnsResult({ status: 'complete', classification: 'dns_resolution_failure', message: 'NXDOMAIN.' });
  assistant.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup', reason: 'Using backup.' });
  assistant.setSessionStatus({ state: 'issue', message: 'Sign in again.' });
  return assistant;
}

/* ------------------------------------------------------------------ *
 * 1. Pure policy
 * ------------------------------------------------------------------ */

test('the four gated capabilities are the only ones the policy constrains', () => {
  assert.deepEqual([...GATED_CAPABILITIES].sort(), [...ALL_GATED].sort());
  for (const name of ALL_GATED) assert.equal(isCapabilityEnabled({}, name), true, name);
  // `installation`, `updates` and `chromeHandoff` are not gated by CD-1.
  for (const name of ['installation', 'updates', 'chromeHandoff', 'unknown']) {
    assert.equal(isCapabilityEnabled({ installation: false, updates: false, chromeHandoff: false }, name), true, name);
  }
  assert.equal(isCapabilityEnabled({ diagnostics: false }, 'diagnostics'), false);
  assert.equal(isCapabilityEnabled({ diagnostics: 'false' }, 'diagnostics'), true, 'only an explicit boolean false disables');
  assert.equal(isCapabilityEnabled(null, 'diagnostics'), true, 'missing configuration keeps the documented default');
});

test('actions and notices resolve to the same capability through one mapping', () => {
  assert.equal(capabilityForAction('diagnostics'), 'diagnostics');
  assert.equal(capabilityForAction('recovery'), 'recovery');
  assert.equal(capabilityForAction('backup-status'), 'failover');
  assert.equal(capabilityForAction('help'), 'help');
  assert.equal(capabilityForAction({ id: 'custom-id', kind: 'help' }), 'help');
  assert.equal(capabilityForAction({ id: 'custom-id', kind: 'backup' }), 'failover');
  assert.equal(capabilityForAction('open-help'), null, 'an unrelated id carries no capability');
  assert.equal(capabilityForAction('custom', 'custom'), null);

  assert.equal(isActionAllowed({ help: false }, { id: 'open-help', kind: 'help' }), false);
  assert.equal(isActionAllowed({ help: false }, { id: 'open-help', kind: 'custom' }), true);
});

/* ------------------------------------------------------------------ *
 * 2. Defaults, missing and partial configuration (backward compatibility)
 * ------------------------------------------------------------------ */

test('omitted, empty, null and partial module configuration keep every capability enabled', () => {
  const variants = [
    {},
    { modules: undefined },
    { modules: null },
    { modules: {} },
    { modules: { installation: true } },
    { modules: { diagnostics: true, unknownFlag: false } },
  ];
  for (const config of variants) {
    const assistant = makeAssistant(config);
    const state = assistant.getState();
    assert.deepEqual(state.capabilities, capabilitiesRecord(BUNDLED_DEFAULTS.modules), JSON.stringify(config));
    for (const name of ALL_GATED) {
      assert.equal(assistant.isCapabilityEnabled(name), true, `${name} stays enabled for ${JSON.stringify(config)}`);
    }
    assert.ok(actionIds(state).includes('diagnostics'), 'the diagnostics action is still offered');
    assistant.destroy();
  }
});

test('the published capabilities record keeps its documented shape', () => {
  const assistant = makeAssistant({ modules: { help: false } });
  const capabilities = assistant.getState().capabilities;
  assert.deepEqual(Object.keys(capabilities).sort(), [
    'chromeHandoff', 'diagnostics', 'failover', 'help', 'installation', 'recovery', 'updates',
  ]);
  assert.equal(capabilities.help, false);
  assert.equal(capabilities.diagnostics, true);
  assert.equal(assistant.getConfig().modules.help, false, 'getConfig still reports the resolved module record');
  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * 3. Each capability independently disabled
 * ------------------------------------------------------------------ */

test('modules.diagnostics: false removes every diagnostics action and notice link', () => {
  const assistant = withFailures(makeAssistant({ modules: { diagnostics: false } }));
  const state = assistant.getState();
  assert.equal(state.capabilities.diagnostics, false);
  assert.equal(actionIds(state).includes('diagnostics'), false, 'no diagnostics action');
  for (const id of ['network:offline', 'dns:failure', 'api:primary-failed']) {
    const notice = state.notifications.find((n) => n.id === id);
    assert.ok(notice, `${id} still reports the real condition`);
    assert.equal(notice.actionId, undefined, `${id} exposes no diagnostics action`);
  }
  assistant.destroy();
});

test('modules.recovery: false removes recovery guidance and keeps the other capabilities', () => {
  const assistant = withFailures(makeAssistant({ modules: { recovery: false } }));
  const state = assistant.getState();
  assert.equal(state.capabilities.recovery, false);
  assert.equal(actionIds(state).includes('recovery'), false);
  assert.ok(actionIds(state).includes('diagnostics'), 'diagnostics is independent');
  assert.ok(actionIds(state).includes('backup-status'), 'failover is independent');
  assistant.destroy();
});

test('modules.failover: false removes the backup action and the backup notice, not connectivity reporting', () => {
  const assistant = withFailures(makeAssistant({ modules: { failover: false } }));
  const state = assistant.getState();
  assert.equal(state.capabilities.failover, false);
  assert.equal(actionIds(state).includes('backup-status'), false, 'no backup action');
  assert.equal(noticeIds(state).includes('api:backup-active'), false, 'failover UI is not shown');
  assert.ok(noticeIds(state).includes('api:primary-failed'), 'the underlying endpoint failure is still reported');
  assert.equal(state.network.endpoints.active, 'backup', 'observed state is untouched by the UI gate');
  assistant.destroy();
});

test('modules.help: false removes every help entry point', () => {
  const assistant = withFailures(makeAssistant({ modules: { help: false } }));
  const state = assistant.getState();
  assert.equal(state.capabilities.help, false);
  const session = state.notifications.find((n) => n.id === 'session:issue');
  assert.ok(session, 'the session condition is still reported');
  assert.equal(session.actionId, undefined, 'no help action on the notice');
  assert.equal(actionIds(state).includes('help'), false);
  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * 4. All four disabled / all enabled
 * ------------------------------------------------------------------ */

test('with all four capabilities disabled no gated action, notice link or notice remains', () => {
  const assistant = withFailures(makeAssistant({
    modules: { diagnostics: false, recovery: false, failover: false, help: false },
    actions: [
      { id: 'open-help', label: 'Open help', kind: 'help' },
      { id: 'diagnostics', label: 'Run diagnostics', kind: 'diagnostics' },
      { id: 'backup-status', label: 'Backup', kind: 'backup' },
      { id: 'custom', label: 'Custom', kind: 'custom' },
    ],
  }));
  const state = assistant.getState();
  assert.deepEqual(
    actionIds(state).filter((id) => ['diagnostics', 'recovery', 'backup-status', 'help', 'open-help'].includes(id)),
    [],
  );
  assert.deepEqual(actionIds(state), ['custom'], 'only non-gated project actions survive');
  assert.equal(noticeIds(state).includes('api:backup-active'), false);
  for (const notice of state.notifications) {
    assert.ok(
      !notice.actionId || !['diagnostics', 'recovery', 'backup-status', 'help'].includes(notice.actionId),
      `${notice.id} has no gated action`,
    );
  }
  assert.equal(state.notifications.find((n) => n.id === 'session:issue').actionId, undefined);
  assistant.destroy();
});

test('with every capability enabled the full action set and notice links are published', () => {
  const assistant = withFailures(makeAssistant());
  const state = assistant.getState();
  for (const name of ALL_GATED) assert.equal(state.capabilities[name], true, name);
  for (const id of ['diagnostics', 'recovery', 'backup-status']) {
    assert.ok(actionIds(state).includes(id), `${id} action is offered`);
  }
  assert.ok(noticeIds(state).includes('api:backup-active'));
  assert.equal(state.notifications.find((n) => n.id === 'network:offline').actionId, 'diagnostics');
  assert.equal(state.notifications.find((n) => n.id === 'session:issue').actionId, 'help');
  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * 5. Direct SDK calls while a capability is disabled
 * ------------------------------------------------------------------ */

test('runDiagnostics() refuses to run a disabled capability, including an application-owned runner', async () => {
  let runnerCalls = 0;
  const assistant = makeAssistant({
    modules: { diagnostics: false },
    services: { diagnostics: () => { runnerCalls += 1; return { classification: 'normal_connectivity' }; } },
  });

  const result = await assistant.runDiagnostics();
  assert.equal(runnerCalls, 0, 'the application-owned runner is never invoked');
  assert.deepEqual(
    { status: result.status, classification: result.classification },
    { status: 'disabled', classification: 'disabled' },
  );
  assert.equal(assistant.getState().network.dns.classification, 'disabled');
  assert.equal(assistant.getState().network.dns.status, 'disabled');
  assert.equal(
    assistant.getState().notifications.some((notice) => notice.critical),
    false,
    'a disabled capability never raises a critical connectivity notice',
  );
  assistant.destroy();
});

test('a diagnostics run is impossible through the raw integration while its gate is closed', async () => {
  let runnerCalls = 0;
  const controller = createDiagnosticsIntegration({
    isEnabled: () => false,
    services: { diagnostics: () => { runnerCalls += 1; return { classification: 'normal_connectivity' }; } },
  });
  const result = await controller.run();
  assert.equal(runnerCalls, 0);
  assert.equal(result.classification, 'disabled');
});

test('disabledDiagnosticsResult() is the single disabled shape', () => {
  assert.deepEqual(disabledDiagnosticsResult(), {
    status: 'disabled',
    classification: 'disabled',
    message: 'Network diagnostics are disabled for this project.',
    failed: false,
  });
});

/* ------------------------------------------------------------------ *
 * 6. Indirect activation: configuration, notifications and events
 * ------------------------------------------------------------------ */

test('project-supplied actions cannot reintroduce a gated capability', () => {
  const assistant = makeAssistant({
    modules: { diagnostics: false, help: false },
    actions: [
      { id: 'diagnostics', label: 'Diagnostics', kind: 'diagnostics' },
      { id: 'open-help', label: 'Help', kind: 'help' },
      { id: 'custom-runbook', label: 'Runbook', kind: 'custom' },
    ],
  });
  const ids = actionIds(assistant.getState());
  assert.equal(ids.includes('diagnostics'), false, 'a project action with a gated id is dropped');
  assert.equal(ids.includes('open-help'), false, 'a project action with a gated kind is dropped');
  assert.ok(ids.includes('custom-runbook'), 'unrelated project actions keep working');

  assistant.configure({ modules: { diagnostics: true, help: true } });
  const enabled = actionIds(assistant.getState());
  assert.ok(enabled.includes('diagnostics'));
  assert.ok(enabled.includes('open-help'), 'the same configuration is honoured once the capability is enabled');
  assistant.destroy();
});

test('events and callbacks cannot publish a gated action or notice link', () => {
  const assistant = makeAssistant({ modules: { diagnostics: false, help: false, failover: false } });
  const seen = [];
  const unsubscribe = assistant.subscribe((state) => seen.push(state));

  assistant.setDnsResult({ status: 'complete', classification: 'dns_records_missing', message: 'No records.' });
  assistant.setEndpointStatus({ primary: 'failed', backup: 'active', active: 'backup' });
  assistant.setSessionStatus({ state: 'issue', message: 'Sign in again.' });

  assert.ok(seen.length >= 3, 'the callbacks received the state updates');
  const state = assistant.getState();
  for (const notice of state.notifications) {
    assert.ok(!notice.actionId || notice.actionId !== 'diagnostics', 'no diagnostics action via events');
    assert.ok(!notice.actionId || notice.actionId !== 'help', 'no help action via events');
  }
  assert.equal(noticeIds(state).includes('api:backup-active'), false);
  assert.equal(actionIds(state).includes('diagnostics'), false);
  unsubscribe();
  assistant.destroy();
});

test('the React adapter refuses a gated action before announcing it to hosts', async () => {
  const assistant = makeAssistant({ modules: { diagnostics: false, help: false, failover: false } });
  const dispatched = [];
  const doc = { dispatchEvent: (event) => dispatched.push(event.detail) };
  const root = { CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } } };

  for (const [id, kind] of [['diagnostics', 'diagnostics'], ['help', 'help'], ['backup-status', 'backup']]) {
    const result = dispatchAssistantAction(id, kind, { assistant, document: doc, root });
    assert.deepEqual(result, { disabled: true, capability: id === 'backup-status' ? 'failover' : id });
  }
  assert.deepEqual(dispatched, [], 'no youge:action event reached the host');

  const enabled = dispatchAssistantAction('custom', 'custom', { assistant, document: doc, root });
  assert.equal(enabled, undefined);
  assert.equal(dispatched.length, 1, 'non-gated actions still dispatch');
  assert.equal(dispatched[0].id, 'custom');
  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * 7. Asynchronous and initialization-order edge cases
 * ------------------------------------------------------------------ */

test('disabling diagnostics while a run is in flight aborts it, discards the result and reports disabled', async () => {
  let settle;
  let runnerSignal = null;
  const assistant = makeAssistant({
    services: {
      diagnostics: (options) => {
        runnerSignal = options && options.signal;
        return new Promise((resolve, reject) => {
          settle = resolve;
          if (options && options.signal) {
            options.signal.addEventListener('abort', () => {
              reject(Object.assign(new Error('Diagnostics were cancelled.'), { kind: 'cancelled' }));
            }, { once: true });
          }
        });
      },
    },
  });

  const pending = assistant.runDiagnostics();
  assert.equal(assistant.getState().network.dns.status, 'running');
  // The runner is invoked from the adapter's promise chain: let it start.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(runnerSignal, 'the run owns an abortable signal');

  assistant.configure({ modules: { diagnostics: false } });
  assert.equal(runnerSignal.aborted, true, 'the in-flight network work is aborted');
  assert.equal(assistant.getState().network.dns.classification, 'disabled', 'no "running" state is left behind');

  settle({ classification: 'normal_connectivity', status: 'complete' });
  const result = await pending;
  assert.notEqual(result.classification, 'normal_connectivity', 'the late verdict is discarded');
  assert.equal(assistant.getState().network.dns.classification, 'disabled');
  assert.equal(
    assistant.getState().notifications.some((notice) => notice.critical),
    false,
    'a disabled capability never turns into a critical notice',
  );
  assistant.destroy();
});

test('a capability disabled before the runner starts is never started (initialization order)', async () => {
  let runnerCalls = 0;
  const assistant = makeAssistant({
    services: { diagnostics: () => { runnerCalls += 1; return { classification: 'normal_connectivity' }; } },
  });
  assistant.configure({ modules: { diagnostics: false } });
  const result = await assistant.runDiagnostics();
  assert.equal(runnerCalls, 0);
  assert.equal(result.status, 'disabled');

  // Enabling again immediately restores the documented behavior.
  assistant.configure({ modules: { diagnostics: true } });
  const enabled = await assistant.runDiagnostics();
  assert.equal(runnerCalls, 1);
  assert.equal(enabled.classification, 'normal_connectivity');
  assistant.destroy();
});

test('a destroyed instance cannot be re-activated through a capability', async () => {
  const assistant = makeAssistant({ modules: { diagnostics: false } });
  assistant.destroy();
  const result = await assistant.runDiagnostics();
  assert.equal(result.status, 'unavailable');
});

/* ------------------------------------------------------------------ *
 * 8. Global singleton and classic parity
 * ------------------------------------------------------------------ */

test('the global singleton enforces capabilities configured at initialization', () => {
  const root = {};
  const assistant = YouGeAssistant.attach(
    { modules: { diagnostics: false, recovery: false, failover: false, help: false } },
    { root, bindEvents: false },
  );
  assert.equal(assistant.isCapabilityEnabled('diagnostics'), false);
  assert.equal(assistant.isCapabilityEnabled('help'), false);
  assert.equal(assistant.isCapabilityEnabled('installation'), true, 'non-CD-1 capabilities keep their own gates');
  assert.equal(YouGeAssistant.getGlobal(root), assistant);
  assistant.destroy();
});
