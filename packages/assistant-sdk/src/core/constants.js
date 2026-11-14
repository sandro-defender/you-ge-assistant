/*!
 * @youge/assistant-sdk — core constants
 */

export const SDK_VERSION = '0.2.0';
export const KIT_COMPAT_VERSION = '1.1.1';
export const SCHEMA_VERSION = 1;

export const PRIORITY = { critical: 1, auth: 2, backup: 3, install: 4, info: 5 };
Object.freeze(PRIORITY);

export const TONE = { 1: 'critical', 2: 'auth', 3: 'backup', 4: 'install', 5: 'info' };
Object.freeze(TONE);

export const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
Object.freeze(POSITIONS);

// `auto` | `light` | `dark` are the original string modes; `custom` is part of
// the adaptive theming release and is only meaningful with explicit tokens
// (see `src/theme/index.js`). The list stays here so config validation and the
// generated classic bundle share one definition.
export const THEMES = ['auto', 'light', 'dark', 'custom'];
Object.freeze(THEMES);

/** Legacy string modes that need no token payload. */
export const LEGACY_THEME_MODES = ['auto', 'light', 'dark'];
Object.freeze(LEGACY_THEME_MODES);

export const ICONS = ['install', 'diagnostics', 'recovery', 'backup', 'help', 'info', 'update', 'custom'];
Object.freeze(ICONS);

export const EVENT_NAMES = {
  state: 'youge:state',
  action: 'youge:action',
  endpointStatus: 'youge:endpoint-status',
  sessionStatus: 'youge:session-status',
  dnsResult: 'youge:dns-result',
  pwaReady: 'pwa:ready',
  pwaInstallable: 'pwa:installable',
  pwaInstalled: 'pwa:installed',
  pwaUpdate: 'pwa:update',
  pwaDiagnostics: 'pwa:diagnostics',
};
Object.freeze(EVENT_NAMES);

export const STORAGE_PREFIXES = {
  notices: 'youge-assistant:notices:',
  lastKnownGood: 'youge-assistant:lkg:',
};
Object.freeze(STORAGE_PREFIXES);
