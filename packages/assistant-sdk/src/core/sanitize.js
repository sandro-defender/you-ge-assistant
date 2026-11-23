/*!
 * @youge/assistant-sdk — pure sanitization and security validation helpers
 */

function isUnsafeKey(key) {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

const SECRET_KEY_PATTERN = /^(?:secret|secrets|api[_-]?key|private[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|bearer|authorization|credentials|vapid[_-]?private[_-]?key|signing[_-]?key|encryption[_-]?key|cookie|token)$/i;

const EXECUTABLE_STRING_PATTERN = /(?:^\s*(?:javascript|vbscript|data\s*:\s*text\/javascript)\s*:|<\s*script\b|\beval\s*\(|\bnew\s+Function\s*\()/i;

export function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    const copy = {};
    Object.keys(value).forEach(function (key) {
      if (isUnsafeKey(key)) return;
      copy[key] = clone(value[key]);
    });
    return copy;
  }
  return value;
}

/**
 * Deep-freeze a value tree so it can be published to external callers as an
 * immutable snapshot. Every nested object and array is frozen exactly once per
 * state change (not per read), and shared references stay safe because state
 * builders hand out copies (`clone`) of anything that also lives in config.
 */
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach(function (key) {
      deepFreeze(value[key]);
    });
  }
  return value;
}

export function merge(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
  Object.keys(source).forEach(function (key) {
    if (isUnsafeKey(key)) return;
    const value = source[key];
    if (value === undefined) return;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
      merge(target[key], value);
    } else {
      target[key] = clone(value);
    }
  });
  return target;
}

export function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safeText(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, max || 120);
}

export function safeRelativeUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(value)) {
    return false;
  }
  let path = value.split(/[?#]/)[0];
  try {
    path = decodeURIComponent(path);
  } catch (error) {
    return false;
  }
  return !path.split('/').some(function (part) { return part === '..'; });
}

export function safeSameOriginIcon(value, fallback, baseHref, UrlCtor) {
  if (!value) return fallback;
  const URLImpl = UrlCtor || URL;
  try {
    const base = new URLImpl(baseHref || 'https://localhost/');
    const url = new URLImpl(String(value), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
    if (url.origin !== base.origin) return fallback;
    return url.pathname + url.search;
  } catch (error) {
    return fallback;
  }
}

export function isSecretKey(key) {
  return SECRET_KEY_PATTERN.test(String(key || '').trim());
}

export function isExecutableString(value) {
  return typeof value === 'string' && EXECUTABLE_STRING_PATTERN.test(value);
}

export function inspectConfigSafety(value, options) {
  const opts = options || {};
  const allowServiceFunctions = Boolean(opts.allowServiceFunctions);
  const report = {
    hasFunction: false,
    hasExecutableString: false,
    secretKeys: [],
  };

  function visit(node, path, depth) {
    if (depth > 12 || node == null) return;
    if (typeof node === 'function') {
      if (allowServiceFunctions && path === 'services.diagnostics') return;
      report.hasFunction = true;
      return;
    }
    if (typeof node === 'string') {
      if (isExecutableString(node)) report.hasExecutableString = true;
      return;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], path + '[' + i + ']', depth + 1);
      }
      return;
    }
    if (typeof node === 'object') {
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (isUnsafeKey(key)) continue;
        if (isSecretKey(key)) {
          report.secretKeys.push(path ? path + '.' + key : key);
        }
        visit(node[key], path ? path + '.' + key : key, depth + 1);
      }
    }
  }

  visit(value, '', 0);
  return report;
}

export function sanitizePlainData(value, depth) {
  const level = depth || 0;
  if (level > 12 || value == null) return null;
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value === 'string') {
    return isExecutableString(value) ? '' : value;
  }
  if (typeof value === 'number') {
    return isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value
      .map(function (item) { return sanitizePlainData(item, level + 1); })
      .filter(function (item) { return item !== undefined; });
  }
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (key) {
      if (isUnsafeKey(key) || isSecretKey(key)) return;
      const cleaned = sanitizePlainData(value[key], level + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    });
    return out;
  }
  return undefined;
}

export const INSTALL_EXPERIENCE_DEFAULTS = Object.freeze({
  enabled: true,
  presentation: 'manual',
  locale: 'auto',
  installDescription: '',
  disableInstallDescription: false,
  disableScreenshots: false,
  disableScreenshotsApple: false,
  disableScreenshotsChrome: false,
  manualHowTo: false,
  disableChrome: false,
  disableClose: false,
  disableAndroidFallback: false,
  useLocalStorage: false,
  manifestUrl: '',
  manifestId: '',
  styles: Object.freeze({}),
});

const INSTALL_EXPERIENCE_BOOLEAN_KEYS = [
  'enabled',
  'disableInstallDescription',
  'disableScreenshots',
  'disableScreenshotsApple',
  'disableScreenshotsChrome',
  'manualHowTo',
  'disableChrome',
  'disableClose',
  'disableAndroidFallback',
  'useLocalStorage',
];

function isSafeInstallStyleValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return false;
  if (/[;{}<>\\]/.test(trimmed)) return false;
  if (/(?:url|expression|javascript|vbscript|data)\s*[:(]/i.test(trimmed)) return false;
  return true;
}

export function normalizeInstallLocale(value, fallback) {
  if (typeof value !== 'string') return fallback || 'auto';
  const trimmed = value.trim().replace(/_/g, '-');
  if (!trimmed || trimmed.toLowerCase() === 'auto') return 'auto';
  if (/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(trimmed)) return trimmed;
  return fallback || 'auto';
}

export function normalizeInstallExperience(raw, fallbackConfig) {
  const base = fallbackConfig && typeof fallbackConfig === 'object'
    ? clone(fallbackConfig)
    : clone(INSTALL_EXPERIENCE_DEFAULTS);
  base.styles = base.styles && typeof base.styles === 'object' && !Array.isArray(base.styles) ? base.styles : {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

  INSTALL_EXPERIENCE_BOOLEAN_KEYS.forEach(function (key) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key];
  });
  if (raw.presentation === 'manual' || raw.presentation === 'auto') {
    base.presentation = raw.presentation;
  }
  if (raw.locale !== undefined) {
    base.locale = normalizeInstallLocale(raw.locale, base.locale);
  }
  if (typeof raw.installDescription === 'string' && !isExecutableString(raw.installDescription)) {
    base.installDescription = safeText(raw.installDescription, 280).trim();
  }
  if (typeof raw.manifestId === 'string' && !isExecutableString(raw.manifestId)) {
    base.manifestId = safeText(raw.manifestId, 180).trim();
  }
  if (typeof raw.manifestUrl === 'string') {
    const candidate = raw.manifestUrl.trim();
    if (!candidate) base.manifestUrl = '';
    else if (safeRelativeUrl(candidate) && !isExecutableString(candidate)) base.manifestUrl = safeText(candidate, 200);
  }
  if (raw.styles && typeof raw.styles === 'object' && !Array.isArray(raw.styles)) {
    const safeStyles = Object.assign({}, base.styles);
    Object.keys(raw.styles).slice(0, 20).forEach(function (prop) {
      if (isUnsafeKey(prop) || !/^--[a-zA-Z0-9_-]{1,50}$/.test(prop)) return;
      if (isSafeInstallStyleValue(raw.styles[prop])) {
        safeStyles[prop] = raw.styles[prop].trim();
      }
    });
    base.styles = safeStyles;
  }
  return base;
}

export function inspectInstallExperienceIssues(raw, prefix) {
  const issues = [];
  const basePath = prefix || 'installExperience';
  if (raw === undefined) return issues;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push({
      code: 'invalid_install_experience',
      path: basePath,
      message: 'Install experience configuration must be a plain object.',
    });
    return issues;
  }
  INSTALL_EXPERIENCE_BOOLEAN_KEYS.forEach(function (key) {
    if (raw[key] !== undefined && typeof raw[key] !== 'boolean') {
      issues.push({
        code: 'invalid_install_flag',
        path: basePath + '.' + key,
        message: 'Install experience flags must use boolean values.',
      });
    }
  });
  if (raw.presentation !== undefined && raw.presentation !== 'manual' && raw.presentation !== 'auto') {
    issues.push({
      code: 'invalid_install_presentation',
      path: basePath + '.presentation',
      message: 'Install presentation must be "manual" or "auto".',
    });
  }
  if (raw.locale !== undefined) {
    const cleanedLocale = typeof raw.locale === 'string' ? raw.locale.trim().replace(/_/g, '-') : '';
    const validLocale = typeof raw.locale === 'string' &&
      (cleanedLocale.toLowerCase() === 'auto' || /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(cleanedLocale));
    if (!validLocale) {
      issues.push({
        code: 'invalid_install_locale',
        path: basePath + '.locale',
        message: 'Install locale must be "auto" or a valid BCP-47 language tag.',
      });
    }
  }
  if (raw.manifestUrl !== undefined) {
    const validUrl = typeof raw.manifestUrl === 'string' &&
      (raw.manifestUrl.trim() === '' || (safeRelativeUrl(raw.manifestUrl.trim()) && !isExecutableString(raw.manifestUrl)));
    if (!validUrl) {
      issues.push({
        code: 'unsafe_install_manifest_url',
        path: basePath + '.manifestUrl',
        message: 'Install manifest URL must be a safe relative path.',
      });
    }
  }
  if (raw.styles !== undefined) {
    if (!raw.styles || typeof raw.styles !== 'object' || Array.isArray(raw.styles)) {
      issues.push({
        code: 'invalid_install_styles',
        path: basePath + '.styles',
        message: 'Install styles must be a plain object of CSS custom properties.',
      });
    } else {
      Object.keys(raw.styles).forEach(function (key) {
        if (isUnsafeKey(key)) return;
        if (!/^--[a-zA-Z0-9_-]{1,50}$/.test(key) || !isSafeInstallStyleValue(raw.styles[key])) {
          issues.push({
            code: 'unsafe_install_style',
            path: basePath + '.styles.' + key,
            message: 'Install styles must use safe CSS custom property names and values.',
          });
        }
      });
    }
  }
  return issues;
}
