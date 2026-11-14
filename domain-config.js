/*!
 * domain-config.js — You.Ge Assistant domain detection and public configuration.
 * Safe to load as a classic script before pwa.js. Configure
 * globalThis.YOU_GE_DOMAIN_REGISTRY before this file when embedding the kit.
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
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

  var registry = root.YOU_GE_DOMAIN_REGISTRY || {};
  var KNOWN_COMPOUND_SUFFIXES = {
    'co.uk': true, 'org.uk': true, 'ac.uk': true, 'gov.uk': true,
    'com.au': true, 'net.au': true, 'org.au': true,
    'co.nz': true, 'com.br': true, 'com.cn': true, 'com.sg': true,
    'co.jp': true, 'co.in': true, 'com.tr': true, 'com.mx': true,
  };
  var VALID_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i;
  var VALID_COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  var VALID_COLOR_FUNCTION = /^(?:rgba?|hsla?)\([\d\s.,%]+\)$/i;
  var CSS_COLOR_NAMES = {};
  ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor').split(/\s+/).forEach(function (name) { CSS_COLOR_NAMES[name] = true; });
  var META_KEYS = {
    'og:title': true, 'og:description': true, 'og:image': true, 'og:type': true,
    'og:site_name': true, 'og:url': true, 'twitter:card': true, 'twitter:title': true,
    'twitter:description': true, 'twitter:image': true,
  };

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      var copy = {};
      Object.keys(value).forEach(function (key) { copy[key] = clone(value[key]); });
      return copy;
    }
    return value;
  }

  function merge(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
    Object.keys(source).forEach(function (key) {
      var value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
        merge(target[key], value);
      } else {
        target[key] = clone(value);
      }
    });
    return target;
  }

  function isValidIpv4(hostname) {
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
    return hostname.split('.').every(function (part) {
      var octet = Number(part);
      return octet >= 0 && octet <= 255;
    });
  }

  function isValidIpv6(hostname) {
    if (!/^\[[0-9a-f:.]+\]$/i.test(hostname)) return false;
    try { return new URL('http://' + hostname).hostname.toLowerCase() === hostname.toLowerCase(); }
    catch (error) { return false; }
  }

  function normalizeHost(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) return '';
    var candidate = raw;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
      // Preserve explicit schemes so unsupported protocols are rejected below.
    } else if (candidate.slice(0, 2) === '//') {
      candidate = 'https:' + candidate;
    } else {
      if (candidate.indexOf(':') !== -1 && candidate.charAt(0) !== '[' &&
          /^[0-9a-f:.]+$/i.test(candidate) && !/^[^:]+:\d{1,5}$/.test(candidate)) {
        candidate = '[' + candidate + ']';
      }
      candidate = 'http://' + candidate;
    }
    try {
      var url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      if (url.username || url.password) return '';
      var hostname = url.hostname.toLowerCase().replace(/\.$/, '');
      if (!hostname) return '';
      if (hostname.charAt(0) === '[') return isValidIpv6(hostname) ? hostname : '';
      return isValidIpv4(hostname) || VALID_HOST.test(hostname) ? hostname : '';
    } catch (error) { return ''; }
  }

  function detectRuntimeHostname(locationLike) {
    var location = locationLike;
    if (!location) {
      try { location = root.location || null; }
      catch (error) { location = null; }
    }
    if (typeof location === 'string') return normalizeHost(location);
    if (!location || typeof location !== 'object') return '';
    var keys = ['hostname', 'host', 'href', 'origin'];
    for (var i = 0; i < keys.length; i += 1) {
      var value;
      try { value = location[keys[i]]; }
      catch (error) { continue; }
      var hostname = normalizeHost(value);
      if (hostname) return hostname;
    }
    return '';
  }

  function isIpAddress(hostname) {
    var host = normalizeHost(hostname);
    return Boolean(host && (host.charAt(0) === '[' ? isValidIpv6(host) : isValidIpv4(host)));
  }

  function rootDomain(hostname) {
    var host = normalizeHost(hostname);
    if (!host || host === 'localhost' || isIpAddress(host) || host.indexOf('.') === -1) return host;
    if (host.slice(-'.localhost'.length) === '.localhost') return 'localhost';
    var labels = host.split('.');
    var lastTwo = labels.slice(-2).join('.');
    var count = KNOWN_COMPOUND_SUFFIXES[lastTwo] ? 3 : 2;
    return labels.length <= count ? host : labels.slice(-count).join('.');
  }

  function normalizePath(value, fallback) {
    var path = String(value || fallback || '/').trim();
    if (!path || path.charAt(0) !== '/') return null;
    if (path.indexOf('\\') !== -1 || /[\u0000-\u001f]/.test(path)) return null;
    var normalized = path.replace(/\/+/g, '/');
    var parts = normalized.split('/');
    if (parts.some(function (part) {
      try {
        var decoded = decodeURIComponent(part);
        return decoded === '.' || decoded === '..' || decoded.indexOf('/') !== -1 || decoded.indexOf(String.fromCharCode(92)) !== -1;
      } catch (error) { return true; }
    })) return null;
    return normalized.charAt(normalized.length - 1) === '/' ? normalized : normalized + '/';
  }

  var NAVIGATION_SCHEME = /^([a-z][a-z0-9+.-]*):/i;

  // Validate a navigation target that came from page markup or a push payload.
  // Only http(s) absolute URLs and root/relative paths survive: script-capable
  // schemes (javascript:, data:, blob:), control characters that URL parsers
  // strip, and network-path forms (//evil.example, \evil.example) fall back.
  function safeNavigationUrl(value, fallback) {
    var safeFallback = typeof fallback === 'string' && fallback ? fallback : '/';
    var raw = typeof value === 'string' ? value.trim() : '';
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return safeFallback;
    var scheme = NAVIGATION_SCHEME.exec(raw);
    if (scheme) {
      var name = scheme[1].toLowerCase();
      return name === 'http' || name === 'https' ? raw : safeFallback;
    }
    var authority = raw.split(/[?#]/)[0];
    if (authority.indexOf('\\') !== -1) return safeFallback;
    if (raw.charAt(0) === '/' && raw.charAt(1) === '/') return safeFallback;
    return raw;
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  var DIAGNOSTICS_PROBE_KEYS = ['appProbePath', 'backendProbePath'];

  // Diagnostics probes run same-origin without credentials, so a configured path
  // must stay a plain relative or root-relative path: cross-origin URLs, network
  // paths (//host), script schemes, backslashes and .. traversal are rejected.
  function safeDiagnosticsProbePath(value) {
    if (typeof value !== 'string') return false;
    var probe = value.trim();
    if (!probe || probe !== value) return false;
    if (probe.charAt(0) === '?' || probe.charAt(0) === '#') return false;
    if (/^(?:[a-z]+:|\/\/)/i.test(probe) || probe.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(probe)) return false;
    var path = probe.split(/[?#]/)[0];
    try { path = decodeURIComponent(path); } catch (error) { return false; }
    return !path.split('/').some(function (part) { return part === '..'; });
  }

  function sanitizeDiagnosticsConfig(value) {
    var safe = {};
    if (!isRecord(value)) return safe;
    Object.keys(value).forEach(function (key) {
      if (DIAGNOSTICS_PROBE_KEYS.indexOf(key) === -1) safe[key] = clone(value[key]);
    });
    DIAGNOSTICS_PROBE_KEYS.forEach(function (key) {
      if (safeDiagnosticsProbePath(value[key])) safe[key] = value[key];
    });
    return safe;
  }

  function isValidColor(value) {
    var color = String(value == null ? '' : value).trim().toLowerCase();
    return VALID_COLOR_HEX.test(color) || VALID_COLOR_FUNCTION.test(color) || Object.prototype.hasOwnProperty.call(CSS_COLOR_NAMES, color);
  }

  function validConfig(raw) {
    var safeInput = isRecord(raw) ? raw : {};
    var config = merge(clone(DEFAULTS), safeInput);
    ['identity', 'branding', 'pwa', 'features', 'instructions', 'metadata', 'diagnostics'].forEach(function (key) {
      if (!isRecord(config[key])) config[key] = clone(DEFAULTS[key] || {});
    });
    if (isRecord(safeInput.project)) {
      var projectId = String(safeInput.project.id == null ? '' : safeInput.project.id)
        .replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 80).trim();
      config.project = projectId ? { id: projectId } : null;
    } else {
      config.project = null;
    }
    if (typeof config.identity.name !== 'string' || !config.identity.name.trim()) config.identity.name = DEFAULTS.identity.name;
    if (typeof config.identity.shortName !== 'string' || !config.identity.shortName.trim()) config.identity.shortName = DEFAULTS.identity.shortName;
    if (typeof config.identity.description !== 'string') config.identity.description = DEFAULTS.identity.description;
    var safeMetadata = {};
    if (config.metadata && typeof config.metadata === 'object' && !Array.isArray(config.metadata)) {
      Object.keys(config.metadata).forEach(function (key) {
        var value = config.metadata[key];
        if (META_KEYS[key.toLowerCase()] && typeof value === 'string') {
          safeMetadata[key.toLowerCase()] = value.replace(/[\u0000-\u001f]/g, '').slice(0, 512);
        }
      });
    }
    config.metadata = safeMetadata;
    if (config.pwa.basePath != null) config.pwa.basePath = normalizePath(config.pwa.basePath, '/') || null;
    if (!isValidColor(config.branding.themeColor)) config.branding.themeColor = DEFAULTS.branding.themeColor;
    if (!isValidColor(config.branding.backgroundColor)) config.branding.backgroundColor = DEFAULTS.branding.backgroundColor;
    config.pwa.scope = String(config.pwa.scope || './');
    if (config.pwa.scope.charAt(0) === '/') config.pwa.scope = normalizePath(config.pwa.scope, '/') || './';
    else if (!/^\.{1,2}\/?$/.test(config.pwa.scope) || config.pwa.scope.indexOf('..') !== -1) config.pwa.scope = './';
    config.pwa.startUrl = typeof config.pwa.startUrl === 'string' && config.pwa.startUrl ? config.pwa.startUrl : './';
    config.pwa.id = typeof config.pwa.id === 'string' && config.pwa.id ? config.pwa.id : './';
    function safeRelativeUrl(value) {
      if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(value)) return false;
      var path = value.split(/[?#]/)[0];
      try { path = decodeURIComponent(path); } catch (error) { return false; }
      return !path.split('/').some(function (part) { return part === '..'; });
    }
    if (!safeRelativeUrl(config.pwa.startUrl)) config.pwa.startUrl = './';
    if (!safeRelativeUrl(config.pwa.id)) config.pwa.id = './';
    ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
      if (typeof config.branding[key] !== 'string' || !safeRelativeUrl(config.branding[key]) || /^\s*(?:javascript|data|blob):/i.test(config.branding[key])) {
        config.branding[key] = DEFAULTS.branding[key];
      }
    });
    if (!/^(standalone|fullscreen|minimal-ui|browser)$/.test(config.pwa.display)) config.pwa.display = 'standalone';
    if (!Array.isArray(config.branding.icons) || !config.branding.icons.length) config.branding.icons = clone(DEFAULTS.branding.icons);
    config.branding.icons = config.branding.icons.filter(function (icon) {
      return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) &&
        !/^\s*(?:javascript|data|blob):/i.test(icon.src) &&
        typeof icon.sizes === 'string' && /^\d+x\d+(?:\s+\d+x\d+)*$/.test(icon.sizes);
    });
    if (!config.branding.icons.length) config.branding.icons = clone(DEFAULTS.branding.icons);
    config.shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.filter(function (shortcut) {
      return shortcut && typeof shortcut.name === 'string' && shortcut.name.trim() &&
        typeof shortcut.url === 'string' && safeRelativeUrl(shortcut.url);
    }).map(function (shortcut) {
      var safe = { name: shortcut.name, url: shortcut.url };
      if (typeof shortcut.short_name === 'string') safe.short_name = shortcut.short_name;
      if (typeof shortcut.description === 'string') safe.description = shortcut.description;
      if (Array.isArray(shortcut.icons)) {
        safe.icons = shortcut.icons.filter(function (icon) {
          return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) && typeof icon.sizes === 'string';
        }).map(function (icon) { return { src: icon.src, sizes: icon.sizes, type: icon.type || 'image/png' }; });
      }
      return safe;
    }) : [];
    config.diagnostics = sanitizeDiagnosticsConfig(config.diagnostics);
    config.features = merge(clone(DEFAULTS.features), config.features || {});
    Object.keys(DEFAULTS.features).forEach(function (key) { config.features[key] = config.features[key] !== false; });
    config.pwa.enabled = config.pwa.enabled !== false;
    return config;
  }

  function domainIssue(code, path, message) {
    return { code: code, path: path, message: message };
  }

  function validateConfigDetailed(raw) {
    var issues = [];
    function add(code, path, message) {
      if (!issues.some(function (issue) { return issue.code === code && issue.path === path; })) {
        issues.push(domainIssue(code, path, message));
      }
    }
    function safeRelative(value) {
      if (typeof value !== 'string' || /^(?:[a-z]+:|\/\/)/i.test(value) || value.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(value)) return false;
      var path = value.split(/[?#]/)[0];
      try { path = decodeURIComponent(path); } catch (error) { return false; }
      return !path.split('/').some(function (part) { return part === '..'; });
    }

    try {
      if (raw !== undefined && raw !== null && !isRecord(raw)) {
        add('invalid_domain_config', 'config', 'Domain configuration must be a plain object.');
      }
      var source = isRecord(raw) ? raw : {};
      if (source.project !== undefined && source.project !== null) {
        var projectId = isRecord(source.project) ? source.project.id : undefined;
        var normalizedProjectId = typeof projectId === 'string'
          ? projectId.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 80).trim()
          : '';
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
            add(key === 'themeColor' ? 'invalid_theme_color' : 'invalid_background_color', 'branding.' + key, 'Color must be a supported CSS color token.');
          }
        });
        ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
          var value = source.branding[key];
          if (value !== undefined && !safeRelative(value)) {
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
          var scope = typeof source.pwa.scope === 'string' ? source.pwa.scope : '';
          var validScope = scope.charAt(0) === '/'
            ? Boolean(normalizePath(scope, '/'))
            : /^\.{1,2}\/?$/.test(scope) && scope.indexOf('..') === -1;
          if (!validScope) add('invalid_scope', 'pwa.scope', 'Scope must be ./ or a safe absolute application path.');
        }
        ['startUrl', 'id'].forEach(function (key) {
          var value = source.pwa[key];
          if (value !== undefined && !safeRelative(value)) {
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
          if (typeof source.features[key] !== 'boolean') add('invalid_feature_flag', 'features.' + key, 'Feature flags must use boolean values.');
        });
      }
      if (source.diagnostics !== undefined && !isRecord(source.diagnostics)) {
        add('invalid_diagnostics', 'diagnostics', 'Diagnostics configuration must be an object of safe probe paths.');
      } else if (isRecord(source.diagnostics)) {
        DIAGNOSTICS_PROBE_KEYS.forEach(function (key) {
          var value = source.diagnostics[key];
          if (value !== undefined && !safeDiagnosticsProbePath(value)) {
            add('invalid_diagnostics_probe', 'diagnostics.' + key,
              'Diagnostics probe paths must be safe same-origin relative or root-relative paths.');
          }
        });
      }
    } catch (error) {
      add('invalid_domain_config', 'config', 'Domain configuration could not be read safely.');
    }

    var config;
    try { config = validConfig(raw); }
    catch (error) {
      add('invalid_domain_config', 'config', 'Domain configuration could not be normalized safely.');
      config = validConfig(null);
    }
    return { valid: issues.length === 0, config: config, issues: issues };
  }

  function isRegistryHostname(hostname) {
    var host = normalizeHost(hostname);
    return Boolean(host && (isIpAddress(host) || VALID_HOST.test(host)));
  }

  function normalizeRegistryKey(key) {
    if (typeof key !== 'string') return { valid: false, code: 'invalid_registry_key' };
    var raw = key.trim();
    if (!raw || /[\u0000-\u0020\u007f\\?#]/.test(raw)) return { valid: false, code: 'invalid_registry_key' };
    var slash = raw.indexOf('/');
    var rawPattern = slash === -1 ? raw : raw.slice(0, slash);
    var hasPath = slash !== -1;
    var wildcard = rawPattern.slice(0, 2) === '*.';
    var host = normalizeHost(wildcard ? rawPattern.slice(2) : rawPattern);
    if (!host || !isRegistryHostname(host) || (wildcard && isIpAddress(host))) return { valid: false, code: 'invalid_registry_key' };
    var path = null;
    if (hasPath) {
      path = normalizePath(raw.slice(slash), null);
      if (!path) return { valid: false, code: 'invalid_registry_path' };
    }
    var hostPattern = (wildcard ? '*.' : '') + host;
    return { valid: true, key: hostPattern + (path || ''), hostPattern: hostPattern, path: path };
  }

  function validateRegistry(raw) {
    var normalizedRegistry = {};
    var issues = [];
    function add(code, path, message) { issues.push(domainIssue(code, path, message)); }
    if (raw !== undefined && raw !== null && !isRecord(raw)) {
      add('invalid_registry', 'registry', 'Domain registry must be an object keyed by host patterns and optional paths.');
      return { valid: false, registry: normalizedRegistry, issues: issues };
    }
    var source = isRecord(raw) ? raw : {};
    var keys;
    try { keys = Object.keys(source).sort(); }
    catch (error) {
      add('invalid_registry', 'registry', 'Domain registry keys could not be read safely.');
      return { valid: false, registry: normalizedRegistry, issues: issues };
    }
    keys.forEach(function (key) {
      var normalized = normalizeRegistryKey(key);
      if (!normalized.valid) {
        add(normalized.code, 'registry.' + key, normalized.code === 'invalid_registry_path'
          ? 'Registry path must be absolute and cannot contain traversal or encoded separators.'
          : 'Registry key must be a valid hostname, IP literal or leading-wildcard hostname, optionally followed by a safe path.');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(normalizedRegistry, normalized.key)) {
        add('duplicate_registry_key', 'registry.' + key, 'This key normalizes to an entry already declared as ' + normalized.key + '.');
        return;
      }
      var rawEntry;
      try { rawEntry = source[key]; }
      catch (error) {
        add('invalid_domain_config', 'registry.' + normalized.key, 'Registry entry could not be read safely.');
        return;
      }
      var checked = validateConfigDetailed(rawEntry);
      normalizedRegistry[normalized.key] = checked.config;
      checked.issues.forEach(function (issue) {
        add(issue.code, 'registry.' + normalized.key + (issue.path ? '.' + issue.path : ''), issue.message);
      });
    });
    return { valid: issues.length === 0, registry: normalizedRegistry, issues: issues };
  }

  function hostPatternMatches(pattern, hostname) {
    var host = normalizeHost(hostname);
    if (pattern.slice(0, 2) !== '*.') {
      return pattern === host && isRegistryHostname(pattern) ? { exact: true, specificity: pattern.length } : null;
    }
    var suffix = pattern.slice(2);
    if (!isRegistryHostname(suffix) || isIpAddress(suffix) || host === suffix || host.slice(-(suffix.length + 1)) !== '.' + suffix) return null;
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
    var keys;
    try { keys = Object.keys(source); }
    catch (error) { return null; }
    var currentPath = String(pathname || '/');
    var candidates = [];
    keys.forEach(function (key) {
      var normalized = normalizeRegistryKey(key);
      if (!normalized.valid) return;
      var hostMatch = hostPatternMatches(normalized.hostPattern, hostname);
      if (!hostMatch) return;
      if (normalized.path && currentPath !== normalized.path.slice(0, -1) && !currentPath.startsWith(normalized.path)) return;
      var value;
      try { value = source[key]; }
      catch (error) { return; }
      candidates.push({
        key: key,
        normalizedKey: normalized.key,
        value: value,
        exact: hostMatch.exact,
        specificity: hostMatch.specificity,
        pathLength: normalized.path ? normalized.path.length : 0,
      });
    });
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
    var host = normalizeHost(hostname);
    return Boolean(host && (host === 'localhost' || host.slice(-'.localhost'.length) === '.localhost' || isIpAddress(host)));
  }

  function parseLocationString(value) {
    var raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return {};
    var hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    var isNetworkPath = raw.slice(0, 2) === '//';
    var candidate = raw;
    if (isNetworkPath) candidate = 'https:' + raw;
    else if (!hasScheme) {
      var authority = raw;
      var normalized = normalizeHost(raw);
      if (normalized.charAt(0) === '[' && raw.charAt(0) !== '[' && !/[/?#]/.test(raw)) authority = normalized;
      candidate = 'https://' + authority;
    }
    try {
      var url = new URL(candidate);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { hostname: '' };
      var hostname = normalizeHost(url.hostname);
      if (!hostname) return { hostname: '' };
      var protocol = url.protocol;
      if (!hasScheme && !isNetworkPath && isDevelopmentHost(hostname)) protocol = 'http:';
      var origin = new URL(protocol + '//' + url.host).origin;
      return {
        hostname: hostname,
        origin: origin,
        protocol: protocol,
        pathname: url.pathname || '/',
        port: url.port,
        href: origin + (url.pathname || '/') + url.search + url.hash,
      };
    } catch (error) { return { hostname: normalizeHost(raw) }; }
  }

  function normalizedLocation(locationLike) {
    if (typeof locationLike === 'string') return parseLocationString(locationLike);
    var fallback = {};
    try { fallback = root.location || {}; }
    catch (error) { /* use an empty location */ }
    var location = locationLike || fallback;
    if (!location || typeof location !== 'object') return {};
    var parsed = {};
    try {
      if (typeof location.href === 'string' && location.href) parsed = parseLocationString(location.href);
      else if (typeof location.origin === 'string' && location.origin && location.origin !== 'null') parsed = parseLocationString(location.origin);
      else if (!location.hostname && typeof location.host === 'string') parsed = parseLocationString(location.host);
    } catch (error) { /* fall back to any safely-readable properties */ }
    var combined = {};
    Object.keys(parsed).forEach(function (key) { combined[key] = parsed[key]; });
    try {
      Object.keys(location).forEach(function (key) { combined[key] = location[key]; });
    } catch (error) { return parsed; }
    return combined;
  }

  function normalizedPort(value) {
    var port = String(value == null ? '' : value).replace(/^:/, '');
    if (!port) return '';
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return '';
    return port;
  }

  function resolve(locationLike, optionalRegistry) {
    var location = normalizedLocation(locationLike);
    var hostname = detectRuntimeHostname(location) || 'localhost';
    var protocol = String(location.protocol || 'https:').toLowerCase();
    var origin;
    try {
      var port = normalizedPort(location.port);
      var hostAndPort = hostname + (port ? ':' + port : '');
      origin = location.origin && location.origin !== 'null'
        ? location.origin
        : new URL(protocol + '//' + hostAndPort).origin;
      var parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== 'https:' && parsedOrigin.protocol !== 'http:') throw new Error('unsupported protocol');
      if (normalizeHost(parsedOrigin.hostname) !== hostname) throw new Error('origin hostname mismatch');
      origin = parsedOrigin.origin;
      protocol = parsedOrigin.protocol;
    } catch (error) {
      protocol = protocol === 'http:' || protocol === 'https:' ? protocol : 'https:';
      var safeHost = normalizeHost(hostname) || 'localhost';
      var fallbackPort = normalizedPort(location.port);
      try { origin = new URL(protocol + '//' + safeHost + (fallbackPort ? ':' + fallbackPort : '')).origin; }
      catch (fallbackError) { protocol = 'https:'; origin = 'https://localhost'; }
    }

    var pathname = String(location.pathname || '/');
    if (pathname.charAt(0) !== '/') pathname = '/';
    var source = optionalRegistry || registry;
    var entry = registryEntry(hostname, pathname, source);
    var validation = validateConfigDetailed(entry ? entry.value : null);
    var config = validation.config;
    var basePath = normalizePath(config.pwa.basePath || location.basePath || '/', '/');
    if (!basePath) basePath = '/';
    var domain = rootDomain(hostname);
    var subdomain = hostname === domain ? '' : hostname.slice(0, -(domain.length + 1));

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

  function manifest(config) {
    var resolved = config || resolve();
    var pwa = resolved.pwa;
    var branding = resolved.branding;
    var manifestBase = new URL('manifest.webmanifest', new URL(resolved.domain.basePath, resolved.domain.origin));
    var appScope = new URL(pwa.scope, manifestBase);
    var shortcuts = (resolved.shortcuts || []).filter(function (shortcut) {
      try {
        var destination = new URL(shortcut.url, manifestBase);
        return destination.origin === appScope.origin && destination.pathname.startsWith(appScope.pathname);
      } catch (error) { return false; }
    });
    var output = {
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
        params: { title: 'title', text: 'text', url: 'url', files: [{ name: 'file', accept: ['image/*', 'video/*', 'audio/*', 'text/plain', 'application/pdf'] }] },
      },
    };
    if (resolved.features.sharing === false) delete output.share_target;
    return output;
  }

  root.YouGeDomain = {
    defaults: clone(DEFAULTS),
    resolve: resolve,
    manifest: manifest,
    normalizeHost: normalizeHost,
    detectRuntimeHostname: detectRuntimeHostname,
    normalizePath: normalizePath,
    rootDomain: rootDomain,
    safeNavigationUrl: safeNavigationUrl,
    validateConfig: validConfig,
    validateConfigDetailed: validateConfigDetailed,
    validateRegistry: validateRegistry,
    setRegistry: function (nextRegistry) { registry = nextRegistry && typeof nextRegistry === 'object' && !Array.isArray(nextRegistry) ? nextRegistry : {}; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
