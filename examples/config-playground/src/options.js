/**
 * Local-only playground options and example generation.
 *
 * The option names are a subset of the public `@youge/assistant-sdk` config
 * surface (see packages/assistant-sdk/src/config/index.d.ts) plus three
 * explicitly labelled full-runtime presentation switches from AGENTS.md §5.
 * This module intentionally has no imports and no side effects so it can be
 * unit-tested directly from Node.
 */

export const SETTINGS_KEY = 'youge:config-playground:settings:v1';

export const DEFAULTS = Object.freeze({
  enabled: true,
  locale: 'auto',
  themeMode: 'auto',
  inheritHost: false,
  position: 'bottom-right',
  presentation: 'manual',
  installLocale: 'auto',
  installationDetection: true,
  installationGuidance: true,
  diagnostics: true,
  offlineDiagnostics: true,
  cacheDiagnostics: true,
  recovery: true,
  failover: true,
  updates: true,
  updateDetection: true,
  updateNotifications: true,
  autoUpdate: true,
  userUpdate: true,
  chromeHandoff: true,
  runtimeToolbox: false,
  runtimeInstallBanner: false,
  runtimeAutoUpdate: false,
});

export const POSITIONS = Object.freeze(['bottom-right', 'bottom-left', 'top-right', 'top-left']);
export const THEME_MODES = Object.freeze(['auto', 'light', 'dark']);
export const PRESENTATIONS = Object.freeze(['manual', 'auto']);
export const CORE_LOCALES = Object.freeze(['en', 'ka', 'ru', 'fr', 'it', 'de', 'sv', 'nl', 'no', 'da', 'et', 'es']);
/** Component-only locales verified in the vendored <pwa-install> runtime. */
export const INSTALL_EXTRA_LOCALES = Object.freeze(['zh-CN', 'ja', 'ko', 'pl', 'tr']);

const BOOLEAN_KEYS = Object.freeze(Object.keys(DEFAULTS).filter((key) => typeof DEFAULTS[key] === 'boolean'));
const LOCALE_PATTERN = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;

function canonicalLocale(value, allowed) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim().replace(/_/g, '-');
  if (cleaned.toLowerCase() === 'auto') return 'auto';
  if (!LOCALE_PATTERN.test(cleaned)) return '';
  return allowed.find((candidate) => candidate.toLowerCase() === cleaned.toLowerCase()) || '';
}

/**
 * Accept only known keys and supported values. Anything else (including
 * credentials accidentally present in stored JSON) is dropped and reported.
 */
export function normalizeSettings(input) {
  const settings = { ...DEFAULTS };
  const ignored = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (input !== undefined && input !== null) ignored.push('root');
    return { settings, ignored };
  }
  for (const key of Object.keys(input)) {
    if (!(key in DEFAULTS)) {
      ignored.push(key);
      continue;
    }
    const value = input[key];
    if (BOOLEAN_KEYS.includes(key)) {
      if (typeof value === 'boolean') settings[key] = value;
      else ignored.push(key);
    } else if (key === 'position') {
      if (POSITIONS.includes(value)) settings[key] = value;
      else ignored.push(key);
    } else if (key === 'themeMode') {
      if (THEME_MODES.includes(value)) settings[key] = value;
      else ignored.push(key);
    } else if (key === 'presentation') {
      if (PRESENTATIONS.includes(value)) settings[key] = value;
      else ignored.push(key);
    } else if (key === 'locale') {
      const locale = canonicalLocale(value, CORE_LOCALES);
      if (locale) settings[key] = locale;
      else ignored.push(key);
    } else if (key === 'installLocale') {
      const locale = canonicalLocale(value, [...CORE_LOCALES, ...INSTALL_EXTRA_LOCALES]);
      if (locale) settings[key] = locale;
      else ignored.push(key);
    }
  }
  return { settings, ignored };
}

/** The exact public SDK input represented by the playground settings. */
export function buildSdkConfig(settings) {
  const value = normalizeSettings(settings).settings;
  const config = {
    project: { id: 'my-app' },
    enabled: value.enabled,
    locale: value.locale,
    position: value.position,
    modules: {
      installationDetection: value.installationDetection,
      installationGuidance: value.installationGuidance,
      diagnostics: value.diagnostics,
      offlineDiagnostics: value.offlineDiagnostics,
      cacheDiagnostics: value.cacheDiagnostics,
      recovery: value.recovery,
      failover: value.failover,
      updates: value.updates,
      updateDetection: value.updateDetection,
      updateNotifications: value.updateNotifications,
      autoUpdate: value.autoUpdate,
      userUpdate: value.userUpdate,
      chromeHandoff: value.chromeHandoff,
    },
    installExperience: {
      presentation: value.presentation,
      locale: value.installLocale,
    },
  };
  if (value.themeMode !== 'auto') {
    config.theme = value.inheritHost
      ? { mode: value.themeMode, inheritHost: true }
      : value.themeMode;
  } else if (value.inheritHost) {
    config.theme = { mode: 'auto', inheritHost: true };
  }
  return config;
}

export function buildSdkExample(settings) {
  const config = buildSdkConfig(settings);
  return [
    "import { YouGeAssistant } from '@youge/assistant-sdk';",
    '',
    '// Replace "my-app" with your own stable project id. This example uses only',
    '// the public package entrypoint and never starts or registers a worker.',
    `const assistant = YouGeAssistant.create(${JSON.stringify(config, null, 2)});`,
    '',
    'assistant.subscribe((state) => {',
    "  console.log('Assistant state', state);",
    '});',
    '',
    '// Call this when your host application unmounts the Assistant:',
    '// assistant.destroy();',
    '',
  ].join('\n');
}

/** The full-runtime example is deliberately separate from the SDK example. */
export function buildRuntimeExample(settings) {
  const value = normalizeSettings(settings).settings;
  const attributes = [
    `data-install-presentation="${value.presentation}"`,
    `data-install-locale="${value.installLocale}"`,
  ];
  if (value.runtimeInstallBanner) attributes.push('data-install-banner');
  if (value.runtimeToolbox) attributes.push('data-toolbox');
  if (value.runtimeAutoUpdate) attributes.push('data-auto-update');
  const modules = {
    installation: value.installationGuidance,
    diagnostics: value.diagnostics,
    recovery: value.recovery,
    failover: value.failover,
    updates: value.updates,
  };
  return [
    '<!-- Full You.Ge Assistant runtime — a separate integration from the SDK. -->',
    '<script>',
    '  window.YOU_GE_ASSISTANT_CONFIG = ' + JSON.stringify({
      projectId: 'my-app',
      locale: value.locale,
      position: value.position,
      modules,
    }, null, 2).split('\n').join('\n  ') + ';',
    '</script>',
    `<script src="/pwa.js" defer ${attributes.join(' ')}></script>`,
    '<script src="/assistant-state.js" defer></script>',
    '<script src="/assistant-widget.js" defer></script>',
    '',
  ].join('\n');
}
