/*!
 * @youge/assistant-sdk/domain — domain resolution and manifest validation
 * ------------------------------------------------------------------------
 * Hostname detection is public configuration input only, never authentication.
 * Unknown or unlisted domains always receive neutral, same-origin defaults.
 */

import { clone, merge, safeRelativeUrl, safeText } from '../core/sanitize.js';

export const DOMAIN_DEFAULTS = {
  identity: {
    name: 'You.Ge Assistant',
    shortName: 'You.Ge',
    description: 'Your installable, offline-ready web assistant.',
  },
  branding: {
    themeColor: '#155eef',
    backgroundColor: '#f8fafc',
    iconSet: 'default',
    icon: 'icons/icon-192.png',
    appleTouchIcon: 'icons/apple-touch-icon.png',
    splashIcon: 'icons/icon-512.png',
    favicon: 'icons/favicon-32.png',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  pwa: {
    enabled: true,
    startUrl: './?launchedfrom=homescreen',
    scope: './',
    display: 'standalone',
    id: './',
  },
  features: {
    installation: true,
    offline: true,
    sharing: true,
    push: true,
    badges: true,
    qr: true,
    diagnostics: true,
    dnsRecovery: true,
  },
  instructions: {},
  metadata: {},
  project: null,
};

const KNOWN_COMPOUND_SUFFIXES = {
  'co.uk': true, 'org.uk': true, 'ac.uk': true, 'gov.uk': true,
  'com.au': true, 'net.au': true, 'org.au': true,
  'co.nz': true, 'com.br': true, 'com.cn': true, 'com.sg': true,
  'co.jp': true, 'co.in': true, 'com.tr': true, 'com.mx': true,
};

const VALID_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i;
const VALID_COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const VALID_COLOR_FUNCTION = /^(?:rgba?|hsla?)\([\d\s.,%]+\)$/i;
const CSS_COLOR_NAMES = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor').split(/\s+/));
const META_KEYS = {
  'og:title': true, 'og:description': true, 'og:image': true, 'og:type': true,
  'og:site_name': true, 'og:url': true, 'twitter:card': true, 'twitter:title': true,
  'twitter:description': true, 'twitter:image': true,
};

function isValidIpv4(hostname) {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
  return hostname.split('.').every(function (part) {
    const octet = Number(part);
    return octet >= 0 && octet <= 255;
  });
}

function isValidIpv6(hostname) {
  if (!/^\[[0-9a-f:.]+\]$/i.test(hostname)) return false;
  try {
    return new URL('http://' + hostname).hostname.toLowerCase() === hostname.toLowerCase();
  } catch (error) {
    return false;
  }
}

/**
 * Normalize a runtime host, host:port value or absolute URL to a hostname.
 * URL parsing also canonicalizes IDNs and IPv6; ports, paths, case and a final
 * DNS dot are not part of the returned host. Unsupported protocols and invalid
 * host syntax produce an empty string rather than a misleading match.
 */
export function normalizeHost(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) return '';

  let candidate = raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    // Keep explicit protocols so ftp:, file: and other schemes are rejected.
  } else if (candidate.slice(0, 2) === '//') {
    candidate = 'https:' + candidate;
  } else {
    // A bare IPv6 address must be bracketed before URL can distinguish it from
    // a hostname and port. Bracketed IPv6 with a port already parses directly.
    if (candidate.indexOf(':') !== -1 && candidate.charAt(0) !== '[' &&
        /^[0-9a-f:.]+$/i.test(candidate) && !/^[^:]+:\d{1,5}$/.test(candidate)) {
      candidate = '[' + candidate + ']';
    }
    candidate = 'http://' + candidate;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (url.username || url.password) return '';
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!hostname) return '';
    if (hostname.charAt(0) === '[') return isValidIpv6(hostname) ? hostname : '';
    if (isValidIpv4(hostname) || VALID_HOST.test(hostname)) return hostname;
    return '';
  } catch (error) {
    return '';
  }
}

export function detectRuntimeHostname(locationLike) {
  let location = locationLike;
  if (!location) {
    try { location = typeof globalThis !== 'undefined' ? globalThis.location : null; }
    catch (error) { location = null; }
  }
  if (typeof location === 'string') return normalizeHost(location);
  if (!location || typeof location !== 'object') return '';
  for (const key of ['hostname', 'host', 'href', 'origin']) {
    let value;
    try { value = location[key]; }
    catch (error) { continue; }
    const hostname = normalizeHost(value);
    if (hostname) return hostname;
  }
  return '';
}

export function isIpAddress(hostname) {
  const host = normalizeHost(hostname);
  return Boolean(host && (host.charAt(0) === '[' ? isValidIpv6(host) : isValidIpv4(host)));
}

export function rootDomain(hostname) {
  const host = normalizeHost(hostname);
  if (!host || host === 'localhost' || isIpAddress(host) || host.indexOf('.') === -1) return host;
  if (host.endsWith('.localhost')) return 'localhost';
  const labels = host.split('.');
  const lastTwo = labels.slice(-2).join('.');
  const count = KNOWN_COMPOUND_SUFFIXES[lastTwo] ? 3 : 2;
  return labels.length <= count ? host : labels.slice(-count).join('.');
}

export function normalizePath(value, fallback) {
  const path = String(value || fallback || '/').trim();
  if (!path || path.charAt(0) !== '/') return null;
  if (path.indexOf('\\') !== -1 || /[\u0000-\u001f]/.test(path)) return null;
  const normalized = path.replace(/\/+/g, '/');
  const parts = normalized.split('/');
  if (parts.some(function (part) {
    try {
      const decoded = decodeURIComponent(part);
      return decoded === '.' || decoded === '..' || decoded.indexOf('/') !== -1 || decoded.indexOf(String.fromCharCode(92)) !== -1;
    } catch (error) {
      return true;
    }
  })) return null;
  return normalized.charAt(normalized.length - 1) === '/' ? normalized : normalized + '/';
}

const NAVIGATION_SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Validate a navigation target that came from page markup or a push payload.
 *
 * Push payloads and host attributes are data, not instructions: this keeps only
 * http(s) absolute URLs and root/relative paths, and rejects script-capable
 * schemes (`javascript:`, `data:`, `blob:`, `filesystem:`), control characters
 * that URL parsers strip (`javascript\u0000:`), and network-path forms such as
 * `//evil.example` or `\evil.example`. Anything unsafe yields the fallback.
 */
export function safeNavigationUrl(value, fallback) {
  const safeFallback = typeof fallback === 'string' && fallback ? fallback : '/';
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return safeFallback;
  const scheme = NAVIGATION_SCHEME.exec(raw);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    return name === 'http' || name === 'https' ? raw : safeFallback;
  }
  const authority = raw.split(/[?#]/)[0];
  if (authority.indexOf('\\') !== -1) return safeFallback;
  if (raw.charAt(0) === '/' && raw.charAt(1) === '/') return safeFallback;
  return raw;
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isValidColor(value) {
  const color = String(value == null ? '' : value).trim().toLowerCase();
  return VALID_COLOR_HEX.test(color) || VALID_COLOR_FUNCTION.test(color) || CSS_COLOR_NAMES.has(color);
}

export function validateDomainConfig(raw) {
  const safeInput = isRecord(raw) ? raw : {};
  const config = merge(clone(DOMAIN_DEFAULTS), {
    identity: safeInput.identity,
    branding: safeInput.branding,
    pwa: safeInput.pwa,
    features: safeInput.features,
    instructions: safeInput.instructions,
    metadata: safeInput.metadata,
    shortcuts: safeInput.shortcuts,
    diagnostics: safeInput.diagnostics,
    project: safeInput.project,
  });

  ['identity', 'branding', 'pwa', 'features', 'instructions', 'metadata', 'diagnostics'].forEach(function (key) {
    if (!isRecord(config[key])) config[key] = clone(DOMAIN_DEFAULTS[key] || {});
  });

  if (safeInput.project && typeof safeInput.project === 'object' && !Array.isArray(safeInput.project)) {
    const projectId = safeText(safeInput.project.id, 80).trim();
    config.project = projectId ? { id: projectId } : null;
  } else {
    config.project = null;
  }

  if (typeof config.identity.name !== 'string' || !config.identity.name.trim()) {
    config.identity.name = DOMAIN_DEFAULTS.identity.name;
  }
  if (typeof config.identity.shortName !== 'string' || !config.identity.shortName.trim()) {
    config.identity.shortName = DOMAIN_DEFAULTS.identity.shortName;
  }
  if (typeof config.identity.description !== 'string') {
    config.identity.description = DOMAIN_DEFAULTS.identity.description;
  }

  const safeMetadata = {};
  if (config.metadata && typeof config.metadata === 'object' && !Array.isArray(config.metadata)) {
    Object.keys(config.metadata).forEach(function (key) {
      const value = config.metadata[key];
      if (META_KEYS[key.toLowerCase()] && typeof value === 'string') {
        safeMetadata[key.toLowerCase()] = value.replace(/[\u0000-\u001f]/g, '').slice(0, 512);
      }
    });
  }
  config.metadata = safeMetadata;

  if (config.pwa.basePath != null) config.pwa.basePath = normalizePath(config.pwa.basePath, '/') || null;
  if (!isValidColor(config.branding.themeColor)) config.branding.themeColor = DOMAIN_DEFAULTS.branding.themeColor;
  if (!isValidColor(config.branding.backgroundColor)) config.branding.backgroundColor = DOMAIN_DEFAULTS.branding.backgroundColor;

  config.pwa.scope = String(config.pwa.scope || './');
  if (config.pwa.scope.charAt(0) === '/') config.pwa.scope = normalizePath(config.pwa.scope, '/') || './';
  else if (!/^\.{1,2}\/?$/.test(config.pwa.scope) || config.pwa.scope.indexOf('..') !== -1) config.pwa.scope = './';

  config.pwa.startUrl = String(config.pwa.startUrl || './');
  config.pwa.id = String(config.pwa.id || './');
  if (!safeRelativeUrl(config.pwa.startUrl)) config.pwa.startUrl = './';
  if (!safeRelativeUrl(config.pwa.id)) config.pwa.id = './';

  ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
    if (typeof config.branding[key] !== 'string' || !safeRelativeUrl(config.branding[key]) || /^\s*(?:javascript|data|blob):/i.test(config.branding[key])) {
      config.branding[key] = DOMAIN_DEFAULTS.branding[key];
    }
  });

  if (!/^(standalone|fullscreen|minimal-ui|browser)$/.test(config.pwa.display)) config.pwa.display = 'standalone';
  if (!Array.isArray(config.branding.icons) || !config.branding.icons.length) {
    config.branding.icons = clone(DOMAIN_DEFAULTS.branding.icons);
  }
  config.branding.icons = config.branding.icons.filter(function (icon) {
    return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) &&
      !/^\s*(?:javascript|data|blob):/i.test(icon.src) &&
      typeof icon.sizes === 'string' && /^\d+x\d+(?:\s+\d+x\d+)*$/.test(icon.sizes);
  });
  if (!config.branding.icons.length) config.branding.icons = clone(DOMAIN_DEFAULTS.branding.icons);

  config.shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.filter(function (shortcut) {
    return shortcut && typeof shortcut.name === 'string' && shortcut.name.trim() &&
      typeof shortcut.url === 'string' && safeRelativeUrl(shortcut.url);
  }).map(function (shortcut) {
    const safe = { name: shortcut.name, url: shortcut.url };
    if (typeof shortcut.short_name === 'string') safe.short_name = shortcut.short_name;
    if (typeof shortcut.description === 'string') safe.description = shortcut.description;
    if (Array.isArray(shortcut.icons)) {
      safe.icons = shortcut.icons.filter(function (icon) {
        return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) && typeof icon.sizes === 'string';
      }).map(function (icon) {
        return { src: icon.src, sizes: icon.sizes, type: icon.type || 'image/png' };
      });
    }
    return safe;
  }) : [];

  config.features = merge(clone(DOMAIN_DEFAULTS.features), config.features || {});
  Object.keys(DOMAIN_DEFAULTS.features).forEach(function (key) {
    config.features[key] = config.features[key] !== false;
  });
  config.pwa.enabled = config.pwa.enabled !== false;
  return config;
}

function domainIssue(code, path, message) {
  return { code: code, path: path, message: message };
}

export function validateDomainConfigDetailed(raw) {
  const issues = [];
  const add = function (code, path, message) {
    if (!issues.some(function (issue) { return issue.code === code && issue.path === path; })) {
      issues.push(domainIssue(code, path, message));
    }
  };

  try {
    if (raw !== undefined && raw !== null && !isRecord(raw)) {
      add('invalid_domain_config', 'config', 'Domain configuration must be a plain object.');
    }
    const source = isRecord(raw) ? raw : {};
    if (source.project !== undefined && source.project !== null) {
      const projectId = isRecord(source.project) ? source.project.id : undefined;
      const normalizedProjectId = typeof projectId === 'string' ? safeText(projectId, 80).trim() : '';
      if (typeof projectId !== 'string' || !normalizedProjectId || projectId.length > 80 || normalizedProjectId !== projectId.trim()) {
        add('invalid_project_id', 'project.id', 'Project configuration requires a non-empty, safe string id of at most 80 characters.');
      }
    }

    if (source.identity !== undefined && !isRecord(source.identity)) {
      add('invalid_identity', 'identity', 'Identity configuration must be an object.');
    } else if (isRecord(source.identity)) {
      ['name', 'shortName'].forEach(function (key) {
        if (source.identity[key] !== undefined && (typeof source.identity[key] !== 'string' || !source.identity[key].trim())) {
          add('invalid_identity_field', 'identity.' + key, 'Identity labels must be non-empty strings.');
        }
      });
      if (source.identity.description !== undefined && typeof source.identity.description !== 'string') {
        add('invalid_identity_field', 'identity.description', 'Identity description must be a string.');
      }
    }

    if (source.branding !== undefined && !isRecord(source.branding)) {
      add('invalid_branding', 'branding', 'Branding configuration must be an object.');
    } else if (isRecord(source.branding)) {
      ['themeColor', 'backgroundColor'].forEach(function (key) {
        if (source.branding[key] !== undefined && !isValidColor(source.branding[key])) {
          add(key === 'themeColor' ? 'invalid_theme_color' : 'invalid_background_color', 'branding.' + key,
            'Color must be a supported CSS color token.');
        }
      });
      ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
        const value = source.branding[key];
        if (value !== undefined && (typeof value !== 'string' || !safeRelativeUrl(value) || /^\s*(?:javascript|data|blob):/i.test(value))) {
          add('unsafe_icon_url', 'branding.' + key, 'Icon URLs must be safe same-origin relative paths.');
        }
      });
    }

    if (source.pwa !== undefined && !isRecord(source.pwa)) {
      add('invalid_pwa_config', 'pwa', 'PWA configuration must be an object.');
    } else if (isRecord(source.pwa)) {
      if (source.pwa.basePath !== undefined && source.pwa.basePath !== null && !normalizePath(source.pwa.basePath, '/')) {
        add('invalid_base_path', 'pwa.basePath', 'Base path must be an absolute path without traversal segments.');
      }
      if (source.pwa.scope !== undefined) {
        const scope = typeof source.pwa.scope === 'string' ? source.pwa.scope : '';
        const validScope = scope.charAt(0) === '/'
          ? Boolean(normalizePath(scope, '/'))
          : /^\.{1,2}\/?$/.test(scope) && scope.indexOf('..') === -1;
        if (!validScope) add('invalid_scope', 'pwa.scope', 'Scope must be ./ or a safe absolute application path.');
      }
      ['startUrl', 'id'].forEach(function (key) {
        const value = source.pwa[key];
        if (value !== undefined && (typeof value !== 'string' || !safeRelativeUrl(value))) {
          add(key === 'startUrl' ? 'unsafe_start_url' : 'unsafe_manifest_id', 'pwa.' + key,
            'Manifest URL values must be safe relative paths and cannot escape the application scope.');
        }
      });
      if (source.pwa.display !== undefined && !/^(standalone|fullscreen|minimal-ui|browser)$/.test(String(source.pwa.display))) {
        add('invalid_display_mode', 'pwa.display', 'Display mode must be standalone, fullscreen, minimal-ui or browser.');
      }
    }

    if (source.features !== undefined && !isRecord(source.features)) {
      add('invalid_features', 'features', 'Feature flags must be an object of booleans.');
    } else if (isRecord(source.features)) {
      Object.keys(source.features).sort().forEach(function (key) {
        if (typeof source.features[key] !== 'boolean') {
          add('invalid_feature_flag', 'features.' + key, 'Feature flags must use boolean values.');
        }
      });
    }
  } catch (error) {
    add('invalid_domain_config', 'config', 'Domain configuration could not be read safely.');
  }

  let config;
  try {
    config = validateDomainConfig(raw);
  } catch (error) {
    add('invalid_domain_config', 'config', 'Domain configuration could not be normalized safely.');
    config = validateDomainConfig(null);
  }
  return { valid: issues.length === 0, config: config, issues: issues };
}

function isRegistryHostname(hostname) {
  const host = normalizeHost(hostname);
  return Boolean(host && (isIpAddress(host) || VALID_HOST.test(host)));
}

function normalizeRegistryKey(key) {
  if (typeof key !== 'string') return { valid: false, code: 'invalid_registry_key' };
  const raw = key.trim();
  if (!raw || /[\u0000-\u0020\u007f\\?#]/.test(raw)) return { valid: false, code: 'invalid_registry_key' };

  const slash = raw.indexOf('/');
  const rawPattern = slash === -1 ? raw : raw.slice(0, slash);
  const hasPath = slash !== -1;
  const wildcard = rawPattern.slice(0, 2) === '*.';
  const host = normalizeHost(wildcard ? rawPattern.slice(2) : rawPattern);
  if (!host || !isRegistryHostname(host) || (wildcard && isIpAddress(host))) {
    return { valid: false, code: 'invalid_registry_key' };
  }

  let path = null;
  if (hasPath) {
    path = normalizePath(raw.slice(slash), null);
    if (!path) return { valid: false, code: 'invalid_registry_path' };
  }

  const hostPattern = (wildcard ? '*.' : '') + host;
  return {
    valid: true,
    key: hostPattern + (path || ''),
    hostPattern: hostPattern,
    path: path,
  };
}

export function validateDomainRegistry(raw) {
  const registry = {};
  const issues = [];
  const add = function (code, path, message) {
    issues.push(domainIssue(code, path, message));
  };

  if (raw !== undefined && raw !== null && !isRecord(raw)) {
    add('invalid_registry', 'registry', 'Domain registry must be an object keyed by host patterns and optional paths.');
    return { valid: false, registry: registry, issues: issues };
  }
  const source = isRecord(raw) ? raw : {};
  let keys;
  try {
    keys = Object.keys(source).sort();
  } catch (error) {
    add('invalid_registry', 'registry', 'Domain registry keys could not be read safely.');
    return { valid: false, registry: registry, issues: issues };
  }

  keys.forEach(function (key) {
    const normalized = normalizeRegistryKey(key);
    if (!normalized.valid) {
      const code = normalized.code;
      add(code, 'registry.' + key, code === 'invalid_registry_path'
        ? 'Registry path must be absolute and cannot contain traversal or encoded separators.'
        : 'Registry key must be a valid hostname, IP literal or leading-wildcard hostname, optionally followed by a safe path.');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(registry, normalized.key)) {
      add('duplicate_registry_key', 'registry.' + key,
        'This key normalizes to an entry already declared as ' + normalized.key + '.');
      return;
    }

    let rawEntry;
    try {
      rawEntry = source[key];
    } catch (error) {
      add('invalid_domain_config', 'registry.' + normalized.key, 'Registry entry could not be read safely.');
      return;
    }
    const checked = validateDomainConfigDetailed(rawEntry);
    registry[normalized.key] = checked.config;
    checked.issues.forEach(function (issue) {
      add(issue.code, 'registry.' + normalized.key + (issue.path ? '.' + issue.path : ''), issue.message);
    });
  });

  return { valid: issues.length === 0, registry: registry, issues: issues };
}

function hostPatternMatches(pattern, hostname) {
  const host = normalizeHost(hostname);
  if (pattern.slice(0, 2) !== '*.') {
    return pattern === host && isRegistryHostname(pattern)
      ? { exact: true, specificity: pattern.length }
      : null;
  }
  const suffix = pattern.slice(2);
  if (!isRegistryHostname(suffix) || isIpAddress(suffix) || host === suffix ||
      host.slice(-(suffix.length + 1)) !== '.' + suffix) return null;
  return { exact: false, specificity: suffix.length };
}

function compareRegistryEntries(a, b) {
  if (a.pathLength !== b.pathLength) return b.pathLength - a.pathLength;
  if (a.specificity !== b.specificity) return b.specificity - a.specificity;
  if (a.normalizedKey !== b.normalizedKey) return a.normalizedKey < b.normalizedKey ? -1 : 1;
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return 0;
}

function registryEntry(hostname, pathname, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  let keys;
  try {
    keys = Object.keys(source);
  } catch (error) {
    return null;
  }
  const currentPath = String(pathname || '/');
  const candidates = [];
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const normalized = normalizeRegistryKey(key);
    if (!normalized.valid) continue;
    const hostMatch = hostPatternMatches(normalized.hostPattern, hostname);
    if (!hostMatch) continue;
    if (normalized.path && currentPath !== normalized.path.slice(0, -1) && !currentPath.startsWith(normalized.path)) continue;
    let value;
    try {
      value = source[key];
    } catch (error) {
      continue;
    }
    candidates.push({
      key: key,
      normalizedKey: normalized.key,
      value: value,
      exact: hostMatch.exact,
      specificity: hostMatch.specificity,
      pathLength: normalized.path ? normalized.path.length : 0,
    });
  }

  function best(entries) {
    entries.sort(compareRegistryEntries);
    return entries.length ? entries[0] : null;
  }

  return best(candidates.filter(function (entry) { return entry.exact && entry.pathLength > 0; })) ||
    best(candidates.filter(function (entry) { return entry.exact && entry.pathLength === 0; })) ||
    best(candidates.filter(function (entry) { return !entry.exact && entry.pathLength > 0; })) ||
    best(candidates.filter(function (entry) { return !entry.exact && entry.pathLength === 0; }));
}

function isDevelopmentHost(hostname) {
  const host = normalizeHost(hostname);
  return Boolean(host && (host === 'localhost' || host.endsWith('.localhost') || isIpAddress(host)));
}

function parseLocationString(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return {};
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const isNetworkPath = raw.slice(0, 2) === '//';
  let candidate = raw;
  if (isNetworkPath) {
    candidate = 'https:' + raw;
  } else if (!hasScheme) {
    let authority = raw;
    const normalized = normalizeHost(raw);
    if (normalized.charAt(0) === '[' && raw.charAt(0) !== '[' && !/[/?#]/.test(raw)) authority = normalized;
    candidate = 'https://' + authority;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { hostname: '' };
    const hostname = normalizeHost(url.hostname);
    if (!hostname) return { hostname: '' };
    let protocol = url.protocol;
    if (!hasScheme && !isNetworkPath && isDevelopmentHost(hostname)) protocol = 'http:';
    const origin = new URL(protocol + '//' + url.host).origin;
    return {
      hostname: hostname,
      origin: origin,
      protocol: protocol,
      pathname: url.pathname || '/',
      port: url.port,
      href: origin + (url.pathname || '/') + url.search + url.hash,
    };
  } catch (error) {
    return { hostname: normalizeHost(raw) };
  }
}

function normalizedLocation(locationLike) {
  if (typeof locationLike === 'string') return parseLocationString(locationLike);
  let fallback = {};
  try {
    fallback = typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location : {};
  } catch (error) { /* use an empty location */ }
  const location = locationLike || fallback;
  if (!location || typeof location !== 'object') return {};
  let parsed = {};
  try {
    if (typeof location.href === 'string' && location.href) parsed = parseLocationString(location.href);
    else if (typeof location.origin === 'string' && location.origin && location.origin !== 'null') parsed = parseLocationString(location.origin);
    else if (!location.hostname && typeof location.host === 'string') parsed = parseLocationString(location.host);
  } catch (error) { /* fall back to any safely-readable properties */ }
  try { return Object.assign({}, parsed, location); }
  catch (error) { return parsed; }
}

function normalizedPort(value) {
  const port = String(value == null ? '' : value).replace(/^:/, '');
  if (!port) return '';
  if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return '';
  return port;
}

export function resolveDomain(locationLike, optionalRegistry) {
  const location = normalizedLocation(locationLike);
  const hostname = detectRuntimeHostname(location) || 'localhost';
  let protocol = String(location.protocol || 'https:').toLowerCase();
  let origin;
  try {
    const port = normalizedPort(location.port);
    const hostAndPort = hostname + (port ? ':' + port : '');
    origin = location.origin && location.origin !== 'null'
      ? location.origin
      : new URL(protocol + '//' + hostAndPort).origin;
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== 'https:' && parsedOrigin.protocol !== 'http:') throw new Error('unsupported protocol');
    if (normalizeHost(parsedOrigin.hostname) !== hostname) throw new Error('origin hostname mismatch');
    origin = parsedOrigin.origin;
    protocol = parsedOrigin.protocol;
  } catch (error) {
    protocol = protocol === 'http:' || protocol === 'https:' ? protocol : 'https:';
    const safeHost = normalizeHost(hostname) || 'localhost';
    const port = normalizedPort(location.port);
    try {
      origin = new URL(protocol + '//' + safeHost + (port ? ':' + port : '')).origin;
    } catch (fallbackError) {
      protocol = 'https:';
      origin = 'https://localhost';
    }
  }

  let pathname = String(location.pathname || '/');
  if (pathname.charAt(0) !== '/') pathname = '/';
  const fallbackRegistry = typeof globalThis !== 'undefined' && globalThis.YOU_GE_DOMAIN_REGISTRY
    ? globalThis.YOU_GE_DOMAIN_REGISTRY
    : {};
  const source = optionalRegistry || fallbackRegistry;
  const entry = registryEntry(hostname, pathname, source);
  const validation = validateDomainConfigDetailed(entry ? entry.value : null);
  const config = validation.config;
  let basePath = normalizePath(config.pwa.basePath || location.basePath || '/', '/');
  if (!basePath) basePath = '/';
  const domain = rootDomain(hostname);
  const subdomain = hostname === domain ? '' : hostname.slice(0, -(domain.length + 1));

  config.domain = {
    hostname: hostname,
    origin: origin,
    protocol: protocol,
    subdomain: subdomain,
    rootDomain: domain,
    pathname: pathname,
    basePath: basePath,
    installOrigin: origin,
    matchedRegistryKey: entry ? entry.key : null,
    configured: Boolean(entry),
    projectId: config.project ? config.project.id : null,
    validation: { valid: validation.valid, issues: clone(validation.issues) },
  };
  return config;
}

export function buildManifest(config) {
  const resolved = config || resolveDomain();
  const pwa = resolved.pwa;
  const branding = resolved.branding;
  const manifestBase = new URL('manifest.webmanifest', new URL(resolved.domain.basePath, resolved.domain.origin));
  const appScope = new URL(pwa.scope, manifestBase);
  const shortcuts = (resolved.shortcuts || []).filter(function (shortcut) {
    try {
      const destination = new URL(shortcut.url, manifestBase);
      return destination.origin === appScope.origin && destination.pathname.startsWith(appScope.pathname);
    } catch (error) {
      return false;
    }
  });
  const output = {
    id: pwa.id,
    name: resolved.identity.name,
    short_name: resolved.identity.shortName,
    description: resolved.identity.description,
    start_url: pwa.startUrl,
    scope: pwa.scope,
    display: resolved.pwa.enabled === false || resolved.features.installation === false ? 'browser' : pwa.display,
    theme_color: branding.themeColor,
    background_color: branding.backgroundColor,
    dir: 'auto',
    icons: clone(branding.icons),
    categories: ['utilities', 'productivity'],
    prefer_related_applications: false,
    shortcuts: clone(shortcuts),
    share_target: {
      action: new URL('share-target', new URL(resolved.domain.basePath, resolved.domain.origin)).pathname,
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [{ name: 'file', accept: ['image/*', 'video/*', 'audio/*', 'text/plain', 'application/pdf'] }],
      },
    },
  };
  if (resolved.features.sharing === false) delete output.share_target;
  return output;
}

function cloneRegistry(raw) {
  if (!isRecord(raw)) return {};
  try {
    return clone(raw);
  } catch (error) {
    return {};
  }
}

export function createDomainResolver(initialRegistry) {
  let registry = cloneRegistry(initialRegistry);
  return {
    defaults: clone(DOMAIN_DEFAULTS),
    resolve: function (locationLike, overrideRegistry) {
      return resolveDomain(locationLike, overrideRegistry || registry);
    },
    manifest: function (config) {
      return buildManifest(config || resolveDomain(undefined, registry));
    },
    normalizeHost: normalizeHost,
    detectRuntimeHostname: detectRuntimeHostname,
    normalizePath: normalizePath,
    rootDomain: rootDomain,
    safeNavigationUrl: safeNavigationUrl,
    validateConfig: validateDomainConfig,
    validateConfigDetailed: validateDomainConfigDetailed,
    validateRegistry: validateDomainRegistry,
    setRegistry: function (nextRegistry) {
      registry = cloneRegistry(nextRegistry);
    },
    getRegistry: function () {
      return cloneRegistry(registry);
    },
  };
}
