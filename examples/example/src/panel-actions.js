/* Where each Assistant action is offered in the sample panel.
 *
 * The SDK publishes the same action in more than one place on purpose: a notice
 * names the action that resolves it (`notice.actionId`) and `availableActions`
 * lists everything the project can do. A renderer that draws both draws the
 * same button several times. This module decides, for one state snapshot,
 * where each action id is rendered, with the same rule the DOM widget
 * (`assistant-widget.js`) uses:
 *
 *   1. its own panel entry (network diagnostics, installation, recovery
 *      guidance),
 *   2. otherwise the first notice that refers to it,
 *   3. otherwise the list of extra actions.
 *
 * One deliberate exception: the "Installation available" card keeps its install
 * button beside the panel entry. The card is the invitation; the entry is what
 * remains once the card is dismissed.
 *
 * It is plain data in, plain data out — no React, no SDK import — so the rule
 * is unit-tested with the repository's Node test runner.
 */

/* The guidance behind the SDK's `recovery` action. Without it the action was a
 * button that announced `youge:action` and showed nothing. */
export const RECOVERY_STEPS = Object.freeze([
  'Confirm this device is connected, then run network diagnostics again.',
  'If a backup endpoint is configured, let the project switch to it.',
  'If DNS results disagree, check DNS propagation before changing provider settings.',
  'Contact the project support channel if the primary API stays unavailable.',
]);

/* Actions a notice offers even though a panel entry offers them too. */
const NOTICE_AND_PANEL_ACTIONS = new Set(['install']);

function enabled(capabilities, name) {
  return !capabilities || capabilities[name] !== false;
}

/**
 * @param {object} state Assistant state snapshot.
 * @param {(id: string, kind?: string) => boolean} [isActionEnabled] Capability
 *   check for an action id (the SDK's `capabilityForAction` policy). Defaults to
 *   "enabled", which is the SDK default for a state without capabilities.
 */
export function planPanelActions(state, isActionEnabled) {
  const snapshot = state || {};
  const allowed = typeof isActionEnabled === 'function' ? isActionEnabled : () => true;
  const capabilities = snapshot.capabilities;
  const notifications = Array.isArray(snapshot.notifications) ? snapshot.notifications : [];
  const availableActions = Array.isArray(snapshot.availableActions) ? snapshot.availableActions : [];

  const showDiagnostics = enabled(capabilities, 'diagnostics');
  const showInstall = Boolean(snapshot.installation && snapshot.installation.status === 'available');
  // Recovery guidance appears when the SDK publishes the recovery action, i.e.
  // while there is a connection problem to recover from.
  const showRecovery = enabled(capabilities, 'recovery') && RECOVERY_STEPS.length > 0 &&
    availableActions.some((action) => action && action.id === 'recovery');

  const claimed = new Set();
  if (showDiagnostics) claimed.add('diagnostics');
  if (showInstall) claimed.add('install');
  if (showRecovery) claimed.add('recovery');

  const noticesWithAction = new Set();
  const offeredOnNotice = new Set();
  notifications.forEach((notice) => {
    if (!notice || !notice.actionId || !allowed(notice.actionId)) return;
    const id = notice.actionId;
    if (NOTICE_AND_PANEL_ACTIONS.has(id)) {
      if (offeredOnNotice.has(id)) return; // once among notices
      offeredOnNotice.add(id);
    } else if (claimed.has(id)) {
      return;
    }
    claimed.add(id); // never again in the extra list
    noticesWithAction.add(notice.id);
  });

  const extraActions = availableActions.filter((action) => {
    if (!action || action.id == null || claimed.has(action.id)) return false;
    claimed.add(action.id);
    return true;
  });

  return { showDiagnostics, showInstall, showRecovery, noticesWithAction, extraActions };
}
