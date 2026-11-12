/*!
 * @youge/assistant-sdk/config — configuration validation and LKG pipeline
 * ------------------------------------------------------------------------
 * Resolution order:
 *   bundled defaults -> validated published revision (or LKG fallback) -> project overrides
 *
 * Remote configuration fetch is intentionally out of scope for Phase 2.
 * Published configuration is strictly data-only JSON: no executable functions,
 * no javascript:/script payloads, and no secret credentials.
 */

import {
  ICONS,
  POSITIONS,
  PRIORITY,
  SCHEMA_VERSION,
  STORAGE_PREFIXES,
} from '../core/constants.js';
import {
  clampNumber,
  clone,
  inspectConfigSafety,
  isExecutableString,
  sanitizePlainData,
  safeText,
} from '../core/sanitize.js';
import { normalizeTheme } from '../theme/index.js';

export const BUNDLED_DEFAULTS = {
  enabled: true,
  project: null,
  projectId: '',
  domain: '',
  position: 'bottom-right',
  offsets: { x: 20, y: 20 },
  modules: {
    installation: true,
    diagnostics: true,
    recovery: true,
    failover: true,
    help: true,
    updates: true,
    chromeHandoff: true,
  },
  notifications: {
    dismissible: true,
    suppressRepeats: true,
    criticalPersistent: true,
  },
  branding: {
    name: '',
    shortName: '',
    icon: '',
    themeColor: '',
  },
  actions: [],
  features: [],
  // The documented public shape of `theme`. It is resolved into a stable record
  // by `src/theme/index.js`; the flat `themeMode` string preserves the original
  // 0.x `theme: 'auto' | 'light' | 'dark'` contract for `getConfig().theme`.
  theme: {
    mode: 'auto',
    inheritHost: false,
    tokens: {},
    host: {},
    variables: {},
  },
  themeMode: 'auto',
};

export function normalizeActions(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 20).map(function (entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (isExecutableString(entry.id) || isExecutableString(entry.label) || isExecutableString(entry.message)) return null;
    const id = safeText(entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return {
      id: id,
      label: safeText(entry.label, 60) || id,
      message: safeText(entry.message, 200),
      icon: ICONS.indexOf(entry.icon) !== -1 ? entry.icon : 'custom',
      priority: clampNumber(entry.priority, PRIORITY.info, 1, 5),
      kind: entry.kind === 'help' ? 'help' : 'custom',
      event: 'youge:action',
    };
  }).filter(Boolean);
}

export function normalizeFeatures(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 20).map(function (entry) {
    if (!entry || typeof entry !== 'object') return null;
    if (isExecutableString(entry.id) || isExecutableString(entry.label) || isExecutableString(entry.message)) return null;
    const id = safeText(entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return {
      id: id,
      label: safeText(entry.label, 60) || id,
      message: safeText(entry.message, 200),
    };
  }).filter(Boolean);
}

function normalizeProjectConfig(raw) {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rawId = raw.id;
  if (typeof rawId !== 'string') return null;
  const id = safeText(rawId, 80).trim();
  return id && rawId.length <= 80 && id === rawId.trim() ? { id: id } : null;
}

function parseSchemaMajor(version) {
  if (version === undefined || version === null) return SCHEMA_VERSION;
  if (typeof version === 'number') {
    return Number.isInteger(version) ? version : -1;
  }
  if (typeof version === 'string') {
    const match = /^(\d+)(?:\.\d+){0,2}$/.exec(version.trim());
    return match ? Number(match[1]) : -1;
  }
  return -1;
}

function extractLayerOverrides(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};

  if (source.enabled !== undefined) out.enabled = source.enabled !== false;
  if (source.project !== undefined) out.project = normalizeProjectConfig(source.project);
  if (source.projectId !== undefined) out.projectId = safeText(source.projectId, 80);
  if (typeof source.domain === 'string') out.domain = safeText(source.domain, 253);
  if (source.position !== undefined && POSITIONS.indexOf(source.position) !== -1) {
    out.position = source.position;
  }
  if (source.offsets && typeof source.offsets === 'object') {
    out.offsets = {};
    if (source.offsets.x !== undefined) out.offsets.x = clampNumber(source.offsets.x, BUNDLED_DEFAULTS.offsets.x, 0, 160);
    if (source.offsets.y !== undefined) out.offsets.y = clampNumber(source.offsets.y, BUNDLED_DEFAULTS.offsets.y, 0, 160);
  }
  if (source.modules && typeof source.modules === 'object') {
    out.modules = {};
    Object.keys(BUNDLED_DEFAULTS.modules).forEach(function (key) {
      if (source.modules[key] !== undefined) out.modules[key] = source.modules[key] !== false;
    });
  }
  if (source.notifications && typeof source.notifications === 'object') {
    out.notifications = {};
    if (source.notifications.dismissible !== undefined) {
      out.notifications.dismissible = source.notifications.dismissible !== false;
    }
    if (source.notifications.suppressRepeats !== undefined) {
      out.notifications.suppressRepeats = source.notifications.suppressRepeats !== false;
    }
    if (source.notifications.criticalPersistent !== undefined) {
      out.notifications.criticalPersistent = source.notifications.criticalPersistent !== false;
    }
  }
  if (source.branding && typeof source.branding === 'object') {
    out.branding = {};
    if (source.branding.name !== undefined) out.branding.name = safeText(source.branding.name, 80);
    if (source.branding.shortName !== undefined) out.branding.shortName = safeText(source.branding.shortName, 40);
    if (source.branding.icon !== undefined) {
      const iconStr = String(source.branding.icon || '');
      out.branding.icon = isExecutableString(iconStr) || /^\s*(?:javascript|data|blob):/i.test(iconStr)
        ? ''
        : safeText(iconStr, 200);
    }
    if (source.branding.themeColor !== undefined) {
      out.branding.themeColor = /^#[0-9a-f]{3,8}$/i.test(source.branding.themeColor || '')
        ? source.branding.themeColor
        : '';
    }
  }
  if (Array.isArray(source.actions)) out.actions = normalizeActions(source.actions);
  if (Array.isArray(source.features)) out.features = normalizeFeatures(source.features);
  // `theme` accepts both the original string form (`'auto' | 'light' | 'dark'`)
  // and the object form (`{ mode, inheritHost, tokens, host, variables }`).
  // Anything else — an unsupported mode, an array, a number — is ignored here
  // and reported by `resolveAssistantConfig` as a warning, so a bad value can
  // never reach the DOM.
  if (source.theme !== undefined) {
    const theme = normalizeTheme(source.theme);
    // An unsupported string mode ('neon') normalizes back to `auto`, which is
    // also the bundled default: the Assistant identity is kept and the mode is
    // never forwarded to the DOM as-is.
    out.theme = {
      mode: theme.mode,
      inheritHost: theme.inheritHost,
      tokens: theme.tokens,
      host: theme.host,
      variables: theme.variables,
    };
    out.themeMode = theme.mode;
  }
  if (source.domainRegistry && typeof source.domainRegistry === 'object' && !Array.isArray(source.domainRegistry)) {
    out.domainRegistry = sanitizePlainData(source.domainRegistry);
  }
  return out;
}

function applyLayer(base, layer) {
  if (!layer || typeof layer !== 'object') return base;
  if (layer.enabled !== undefined) base.enabled = layer.enabled;
  if (layer.project !== undefined) base.project = clone(layer.project);
  if (layer.projectId) base.projectId = layer.projectId;
  if (layer.domain) base.domain = layer.domain;
  if (layer.position) base.position = layer.position;
  if (layer.offsets) {
    if (layer.offsets.x !== undefined) base.offsets.x = layer.offsets.x;
    if (layer.offsets.y !== undefined) base.offsets.y = layer.offsets.y;
  }
  if (layer.modules) {
    Object.keys(layer.modules).forEach(function (key) {
      base.modules[key] = layer.modules[key];
    });
  }
  if (layer.notifications) {
    Object.keys(layer.notifications).forEach(function (key) {
      base.notifications[key] = layer.notifications[key];
    });
  }
  if (layer.branding) {
    Object.keys(layer.branding).forEach(function (key) {
      if (layer.branding[key] !== undefined) base.branding[key] = layer.branding[key];
    });
  }
  if (layer.actions !== undefined) base.actions = clone(layer.actions);
  if (layer.features !== undefined) base.features = clone(layer.features);
  if (layer.theme) {
    base.theme = clone(layer.theme);
    base.themeMode = layer.theme.mode || 'auto';
  }
  if (layer.themeMode) base.themeMode = layer.themeMode;
  if (layer.domainRegistry) base.domainRegistry = clone(layer.domainRegistry);
  return base;
}

export function validatePublishedConfig(rawInput, options) {
  const opts = options || {};
  let parsed = rawInput;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch (error) {
      return { valid: false, reason: 'invalid_json', warnings: ['invalid_json'] };
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, reason: 'invalid_object', warnings: ['invalid_object'] };
  }

  const safety = inspectConfigSafety(parsed, { allowServiceFunctions: false });
  if (safety.hasFunction) {
    return { valid: false, reason: 'executable_function_rejected', warnings: ['executable_function_rejected'] };
  }
  if (safety.hasExecutableString) {
    return { valid: false, reason: 'executable_code_rejected', warnings: ['executable_code_rejected'] };
  }
  if (safety.secretKeys.length > 0) {
    return {
      valid: false,
      reason: 'secret_fields_rejected',
      secretKeys: safety.secretKeys,
      warnings: ['secret_fields_rejected'],
    };
  }

  const major = parseSchemaMajor(parsed.schemaVersion);
  if (major !== SCHEMA_VERSION) {
    return { valid: false, reason: 'unsupported_schema_version', warnings: ['unsupported_schema_version'] };
  }

  const expectedProjectId = safeText(opts.expectedProjectId || '', 80);
  const declaredProjectId = safeText(parsed.projectId || '', 80);
  const nestedConfig = parsed.config && typeof parsed.config === 'object' && !Array.isArray(parsed.config)
    ? parsed.config
    : null;
  const topProject = normalizeProjectConfig(parsed.project);
  const nestedProject = normalizeProjectConfig(nestedConfig && nestedConfig.project);
  const projectIds = [declaredProjectId, topProject && topProject.id, nestedProject && nestedProject.id].filter(Boolean);
  if ((expectedProjectId && projectIds.some(function (id) { return id !== expectedProjectId; })) ||
      projectIds.some(function (id) { return id !== projectIds[0]; })) {
    return { valid: false, reason: 'project_id_mismatch', warnings: ['project_id_mismatch'] };
  }
  const hasInvalidProject = (parsed.project !== undefined && parsed.project !== null && !topProject) ||
    Boolean(nestedConfig && nestedConfig.project !== undefined && nestedConfig.project !== null && !nestedProject);

  const payload = nestedConfig
    ? Object.assign({}, nestedConfig,
      !nestedConfig.project && topProject ? { project: topProject } : {},
      declaredProjectId ? { projectId: declaredProjectId } : {})
    : parsed;

  return {
    valid: true,
    schemaVersion: SCHEMA_VERSION,
    revision: safeText(parsed.revision || '', 60),
    publishedAt: safeText(parsed.publishedAt || '', 60),
    projectId: declaredProjectId || (nestedProject && nestedProject.id) || (topProject && topProject.id) || expectedProjectId,
    config: extractLayerOverrides(payload),
    warnings: hasInvalidProject ? ['invalid_project_config'] : [],
  };
}

export function lkgStorageKey(projectId) {
  return STORAGE_PREFIXES.lastKnownGood + safeText(projectId || 'default', 80);
}

export function loadLastKnownGood(storage, projectId) {
  const id = safeText(projectId || '', 80);
  if (!storage || !id || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(lkgStorageKey(id));
    if (!raw) return null;
    let record = null;
    try {
      record = JSON.parse(raw);
    } catch (error) {
      return null;
    }
    // A stored recovery record must declare the project it belongs to. Without
    // this, a blob written under this key with no `projectId` would skip the
    // mismatch check and be trusted as this project's last-known-good config.
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    if (safeText(record.projectId || '', 80) !== id) return null;
    const validated = validatePublishedConfig(raw, { expectedProjectId: id });
    return validated.valid ? validated : null;
  } catch (error) {
    return null;
  }
}

export function saveLastKnownGood(storage, projectId, validatedRecord) {
  const id = safeText(projectId || (validatedRecord && validatedRecord.projectId) || '', 80);
  if (!storage || !id || !validatedRecord || !validatedRecord.valid || typeof storage.setItem !== 'function') {
    return false;
  }
  try {
    const record = {
      schemaVersion: SCHEMA_VERSION,
      revision: validatedRecord.revision || '',
      publishedAt: validatedRecord.publishedAt || '',
      projectId: id,
      config: sanitizePlainData(validatedRecord.config || {}),
    };
    storage.setItem(lkgStorageKey(id), JSON.stringify(record));
    return true;
  } catch (error) {
    return false;
  }
}

export function normalizeConfig(raw) {
  return resolveAssistantConfig(raw).config;
}

export function resolveAssistantConfig(rawInput, context) {
  const ctx = context || {};
  const input = rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) ? rawInput : {};
  const warnings = [];

  const localSafety = inspectConfigSafety(
    Object.assign({}, input, { publishedConfig: undefined }),
    { allowServiceFunctions: true }
  );
  if (localSafety.secretKeys.length > 0) warnings.push('secret_fields_stripped');
  if (localSafety.hasExecutableString) warnings.push('executable_value_stripped');
  if (localSafety.hasFunction) warnings.push('unexpected_function_ignored');

  const servicesIn = input.services && typeof input.services === 'object' ? input.services : {};
  const diagnosticsFn = typeof servicesIn.diagnostics === 'function' ? servicesIn.diagnostics : null;

  const base = clone(BUNDLED_DEFAULTS);
  base.domainRegistry = null;

  const typedProject = normalizeProjectConfig(input.project);
  const legacyProjectId = safeText(input.projectId || '', 80).trim();
  const explicitProjectId = (typedProject && typedProject.id) || legacyProjectId;
  if (input.project !== undefined && input.project !== null && !typedProject) warnings.push('invalid_project_config');
  if (typedProject && legacyProjectId && typedProject.id !== legacyProjectId) warnings.push('project_id_conflict');
  let source = 'defaults';
  let revision = '';
  let publishedAt = '';
  let usedLastKnownGood = false;

  if (input.publishedConfig !== undefined && input.publishedConfig !== null) {
    const validated = validatePublishedConfig(input.publishedConfig, {
      expectedProjectId: explicitProjectId,
    });
    if (validated.valid) {
      applyLayer(base, validated.config);
      source = 'published';
      revision = validated.revision;
      publishedAt = validated.publishedAt;
      const targetProject = explicitProjectId || validated.projectId || ctx.fallbackProjectId || '';
      if (targetProject && ctx.storage) {
        saveLastKnownGood(ctx.storage, targetProject, validated);
      }
    } else {
      warnings.push('published_config_rejected:' + validated.reason);
      const fallbackProject = explicitProjectId || ctx.fallbackProjectId || '';
      const lkg = input.useLastKnownGood !== false
        ? loadLastKnownGood(ctx.storage, fallbackProject)
        : null;
      if (lkg) {
        applyLayer(base, lkg.config);
        source = 'last-known-good';
        revision = lkg.revision;
        publishedAt = lkg.publishedAt;
        usedLastKnownGood = true;
      }
    }
  } else if (input.useLastKnownGood === true) {
    const lookupProject = explicitProjectId || ctx.fallbackProjectId || '';
    const lkg = loadLastKnownGood(ctx.storage, lookupProject);
    if (lkg) {
      applyLayer(base, lkg.config);
      source = 'last-known-good';
      revision = lkg.revision;
      publishedAt = lkg.publishedAt;
      usedLastKnownGood = true;
    }
  }

  const sanitizedOverrides = sanitizePlainData(Object.assign({}, input, {
    publishedConfig: undefined,
    services: undefined,
    window: undefined,
    document: undefined,
    location: undefined,
    navigator: undefined,
    storage: undefined,
    pwa: undefined,
    dns: undefined,
    domainResolver: undefined,
  })) || {};

  // Theme validation feedback is surfaced through the existing meta.warnings
  // channel so a host can see exactly which value was rejected and why.
  if (input.theme !== undefined) {
    normalizeTheme(input.theme).warnings.forEach(function (code) {
      if (warnings.indexOf(code) === -1) warnings.push(code);
    });
  }

  const overrideLayer = extractLayerOverrides(sanitizedOverrides);
  if (Object.keys(overrideLayer).length > 0 && source === 'defaults') {
    source = 'overrides';
  }
  applyLayer(base, overrideLayer);

  base.services = {
    diagnostics: diagnosticsFn,
  };

  return {
    config: base,
    meta: {
      schemaVersion: SCHEMA_VERSION,
      source: source,
      revision: revision,
      publishedAt: publishedAt,
      usedLastKnownGood: usedLastKnownGood,
      warnings: warnings,
    },
  };
}
