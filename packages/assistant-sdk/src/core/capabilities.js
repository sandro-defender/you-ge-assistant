/*!
 * @youge/assistant-sdk — module capability enforcement
 * ----------------------------------------------------
 * One authority for legacy and PWA Assistant capability gates:
 *
 *   modules.diagnostics · modules.recovery · modules.failover · modules.help
 *   plus PWA module gates and optional named extension flags
 *
 * Every consumer — the state engine, actions, notifications, the diagnostics
 * adapter, the DOM widget, the React adapter and the classic runtime files —
 * asks these helpers instead of re-implementing the booleans, so the checks
 * cannot drift apart and a renderer cannot invent an alternate activation path.
 *
 * Defaults are preserved: a capability is enabled unless the resolved
 * configuration explicitly says `false`.
 */

/** Capabilities a project can switch off with `modules.<name>: false`. */
export const GATED_CAPABILITIES = ['diagnostics', 'recovery', 'failover', 'help'];
Object.freeze(GATED_CAPABILITIES);

/**
 * Action id → capability. Ids are the documented action contract published in
 * `state.availableActions`, so a notice action and a panel action with the same
 * id are gated identically.
 */
export const CAPABILITY_ACTION_IDS = Object.freeze({
  diagnostics: 'diagnostics',
  recovery: 'recovery',
  'backup-status': 'failover',
  help: 'help',
});

/** Action `kind` → capability, for project-supplied actions with a new id. */
export const CAPABILITY_ACTION_KINDS = Object.freeze({
  diagnostics: 'diagnostics',
  recovery: 'recovery',
  backup: 'failover',
  help: 'help',
});

/**
 * Notification id → capability the notice *is* (as opposed to a notice that
 * merely links to a gated action). Disabling the capability removes the notice.
 */
export const CAPABILITY_NOTICE_IDS = Object.freeze({
  'api:backup-active': 'failover',
});

/**
 * Is `capability` enabled in a resolved `modules` record?
 *
 * Unknown names and a missing record are enabled: the helpers are also used by
 * renderers holding partial or hand-built state, where the documented default
 * is "on".
 */
export function isCapabilityEnabled(modules, capability) {
  const name = String(capability == null ? '' : capability);
  const pwaCapabilities = ['installationDetection', 'installationGuidance', 'updateDetection', 'updateNotifications', 'autoUpdate', 'userUpdate', 'offlineDiagnostics', 'cacheDiagnostics'];
  const record = modules && typeof modules === 'object' ? modules : null;
  if (GATED_CAPABILITIES.indexOf(name) === -1 && pwaCapabilities.indexOf(name) === -1) {
    return !record || !record.extensions || record.extensions[name] !== false;
  }
  return !record || record[name] !== false;
}

/** Resolve the capability that an action id (and optional kind) belongs to. */
export function capabilityForAction(actionOrId, kind) {
  if (actionOrId && typeof actionOrId === 'object') {
    const byId = CAPABILITY_ACTION_IDS[String(actionOrId.id || '')];
    if (byId) return byId;
    return CAPABILITY_ACTION_KINDS[String(actionOrId.kind || '')] || null;
  }
  const id = String(actionOrId == null ? '' : actionOrId);
  const byId = CAPABILITY_ACTION_IDS[id];
  if (byId) return byId;
  return CAPABILITY_ACTION_KINDS[String(kind == null ? '' : kind)] || null;
}

/** Is this action (id + kind, or an action object) allowed by `modules`? */
export function isActionAllowed(modules, actionOrId, kind) {
  const capability = capabilityForAction(actionOrId, kind);
  return !capability || isCapabilityEnabled(modules, capability);
}

/** Filter a list of actions down to the capabilities `modules` allows. */
export function gateActions(modules, actions) {
  if (!Array.isArray(actions)) return [];
  return actions.filter(function (action) { return isActionAllowed(modules, action); });
}

/**
 * Gate one notification.
 *
 * - a notice that *is* gated capability UI is removed (`null`);
 * - a notice whose linked action is gated keeps its content but loses
 *   `actionId`, so a critical connectivity notice still reports the real
 *   condition without exposing an unreachable action;
 * - everything else is returned unchanged (the original object identity).
 */
export function gateNotification(modules, notification) {
  if (!notification || typeof notification !== 'object') return null;
  const noticeCapability = CAPABILITY_NOTICE_IDS[String(notification.id || '')];
  if (noticeCapability && !isCapabilityEnabled(modules, noticeCapability)) return null;
  if (!notification.actionId) return notification;
  if (isActionAllowed(modules, notification.actionId)) return notification;
  const copy = Object.assign({}, notification);
  delete copy.actionId;
  return copy;
}

/** Gate a list of notifications. */
export function gateNotifications(modules, notifications) {
  if (!Array.isArray(notifications)) return [];
  return notifications.map(function (notification) {
    return gateNotification(modules, notification);
  }).filter(Boolean);
}

/**
 * The published `state.capabilities` record. Shape is unchanged from the
 * documented 0.x/0.2 contract: a boolean per module key.
 */
export function capabilitiesRecord(modules) {
  const record = modules && typeof modules === 'object' ? modules : {};
  return {
    installation: record.installation !== false,
    diagnostics: record.diagnostics !== false,
    recovery: record.recovery !== false,
    failover: record.failover !== false,
    help: record.help !== false,
    updates: record.updates !== false,
    chromeHandoff: record.chromeHandoff !== false,
    installationDetection: record.installationDetection !== false,
    installationGuidance: record.installationGuidance !== false,
    updateDetection: record.updateDetection !== false,
    updateNotifications: record.updateNotifications !== false,
    autoUpdate: record.autoUpdate !== false,
    userUpdate: record.userUpdate !== false,
    offlineDiagnostics: record.offlineDiagnostics !== false,
    cacheDiagnostics: record.cacheDiagnostics !== false,
  };
}
