/*!
 * assistant-state.js — centralized You.Ge Assistant state model
 * -------------------------------------------------------------
 * Generated from packages/assistant-sdk/src/ via scripts/sync-sdk-browser.mjs.
 * Do not edit by hand; update packages/assistant-sdk/src/ and run:
 *   npm run sync:sdk
 *
 * Single source of truth for the floating assistant widget, React/ESM adapters
 * and project-level consumers. Keeps state calculation separate from DOM
 * rendering, never calls fetch(), never registers a service worker, and never
 * polls on an interval.
 */
(function (root) {
  'use strict';

  if (!root) return;
  if (root.YouGeAssistant && root.YouGeAssistant.__state &&
      (!root.YouGeAssistant.isDestroyed || !root.YouGeAssistant.isDestroyed())) {
    return;
  }

  /* --- core/constants.js --- */

  const SDK_VERSION = '0.2.0';
  const KIT_COMPAT_VERSION = '1.1.0';
  const SCHEMA_VERSION = 1;
  const PRIORITY = { critical: 1, auth: 2, backup: 3, install: 4, info: 5 };
  Object.freeze(PRIORITY);
  const TONE = { 1: 'critical', 2: 'auth', 3: 'backup', 4: 'install', 5: 'info' };
  Object.freeze(TONE);
  const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  Object.freeze(POSITIONS);

  // `auto` | `light` | `dark` are the original string modes; `custom` is part of
  // the adaptive theming release and is only meaningful with explicit tokens
  // (see `src/theme/index.js`). The list stays here so config validation and the
  // generated classic bundle share one definition.
  const THEMES = ['auto', 'light', 'dark', 'custom'];
  Object.freeze(THEMES);

  /** Legacy string modes that need no token payload. */
  const LEGACY_THEME_MODES = ['auto', 'light', 'dark'];
  Object.freeze(LEGACY_THEME_MODES);
  const ICONS = ['install', 'diagnostics', 'recovery', 'backup', 'help', 'info', 'update', 'custom'];
  Object.freeze(ICONS);
  const EVENT_NAMES = {
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
  const STORAGE_PREFIXES = {
    notices: 'youge-assistant:notices:',
    lastKnownGood: 'youge-assistant:lkg:',
  };
  Object.freeze(STORAGE_PREFIXES);

  /* --- core/sanitize.js --- */

  function isUnsafeKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  const SECRET_KEY_PATTERN = /^(?:secret|secrets|api[_-]?key|private[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|bearer|authorization|credentials|vapid[_-]?private[_-]?key|signing[_-]?key|encryption[_-]?key|cookie|token)$/i;

  const EXECUTABLE_STRING_PATTERN = /(?:^\s*(?:javascript|vbscript|data\s*:\s*text\/javascript)\s*:|<\s*script\b|\beval\s*\(|\bnew\s+Function\s*\()/i;
  function clone(value) {
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
  function merge(target, source) {
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
  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }
  function safeText(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, max || 120);
  }
  function safeRelativeUrl(value) {
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
  function safeSameOriginIcon(value, fallback, baseHref, UrlCtor) {
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
  function isSecretKey(key) {
    return SECRET_KEY_PATTERN.test(String(key || '').trim());
  }
  function isExecutableString(value) {
    return typeof value === 'string' && EXECUTABLE_STRING_PATTERN.test(value);
  }
  function inspectConfigSafety(value, options) {
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
  function sanitizePlainData(value, depth) {
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

  /* --- theme/index.js --- */

  const THEME_MODES = ['auto', 'light', 'dark', 'custom'];
  Object.freeze(THEME_MODES);

  /** Public token keys. Colours first, then the non-colour design tokens. */
  const COLOR_TOKEN_KEYS = [
    'primary',
    'onPrimary',
    'background',
    'surface',
    'surfaceSoft',
    'text',
    'mutedText',
    'border',
    'focus',
    'success',
    'info',
    'warning',
    'error',
    'critical',
  ];
  Object.freeze(COLOR_TOKEN_KEYS);
  const THEME_TOKEN_KEYS = COLOR_TOKEN_KEYS.concat([
    'fontFamily',
    'fontSize',
    'radius',
    'radiusSmall',
    'borderWidth',
    'shadow',
  ]);
  Object.freeze(THEME_TOKEN_KEYS);

  /**
   * Public token -> CSS custom property. `error`/`warning`/`success` also drive
   * the legacy tone variables (`--youge-critical`, `--youge-auth`,
   * `--youge-install`) so existing stylesheets and integrations keep working.
   */
  const TOKEN_CSS_VARIABLES = {
    primary: ['--youge-brand'],
    onPrimary: ['--youge-on-brand'],
    background: ['--youge-background'],
    surface: ['--youge-surface'],
    surfaceSoft: ['--youge-surface-soft'],
    text: ['--youge-ink'],
    mutedText: ['--youge-muted'],
    border: ['--youge-line'],
    focus: ['--youge-focus'],
    success: ['--youge-success', '--youge-install'],
    info: ['--youge-info', '--youge-backup'],
    warning: ['--youge-warning', '--youge-auth'],
    error: ['--youge-error', '--youge-critical'],
    // `critical` is the most specific severity token: applied after `error` so an
    // explicit critical colour wins when both are provided.
    critical: ['--youge-critical', '--youge-error'],
    fontFamily: ['--youge-font'],
    fontSize: ['--youge-font-size'],
    radius: ['--youge-radius'],
    radiusSmall: ['--youge-radius-small'],
    borderWidth: ['--youge-border-width'],
    shadow: ['--youge-shadow'],
  };
  Object.freeze(TOKEN_CSS_VARIABLES);

  /**
   * Variables owned by the widget and the layout system. An integrator may not
   * set them through `theme.variables`: they control placement and hit-area
   * geometry, which requirement 3 forbids a host from overriding.
   */
  const PROTECTED_VARIABLES = [
    '--youge-offset-x',
    '--youge-offset-y',
    '--youge-fab-size',
    '--youge-fab-glyph',
    '--youge-motion-fast',
    '--youge-motion-state',
  ];
  Object.freeze(PROTECTED_VARIABLES);

  /** The Assistant's own identity. Never derived from the host. */
  const ASSISTANT_PALETTES = Object.freeze({
    light: Object.freeze({
      primary: '#155eef',
      onPrimary: '#ffffff',
      background: '#ffffff',
      surface: '#ffffff',
      surfaceSoft: '#f8fafc',
      text: '#0f172a',
      mutedText: '#475569',
      border: '#e2e8f0',
      focus: '#155eef',
      success: '#067647',
      info: '#475467',
      warning: '#b54708',
      error: '#b42318',
      critical: '#b42318',
    }),
    dark: Object.freeze({
      primary: '#84adff',
      onPrimary: '#0b1220',
      background: '#0b1220',
      surface: '#0b1220',
      surfaceSoft: '#111c2f',
      text: '#f8fafc',
      mutedText: '#cbd5e1',
      border: '#334155',
      focus: '#84adff',
      success: '#a6f4c5',
      info: '#cbd5e1',
      warning: '#fec84b',
      error: '#fda29b',
      critical: '#fda29b',
    }),
  });

  /**
   * Notification level metadata: the single source of truth shared by the DOM
   * widget and the React example, so both render the same glyph and the same
   * accessible wording for each tier. `glyph` is inner SVG markup only — no
   * scripts, no external references, no `on*` handlers — and `icon` names the
   * legacy icon it replaces where one exists.
   */
  const NOTIFICATION_LEVELS = Object.freeze(['critical', 'error', 'warning', 'info', 'success']);

  const LEVEL_SHAPES = {
    critical: [
      { type: 'path', d: 'M8.6 3h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6z' },
      { type: 'path', d: 'M12 8v5' },
      { type: 'dot', cx: 12, cy: 16.5 },
    ],
    error: [
      { type: 'circle', cx: 12, cy: 12, r: 9 },
      { type: 'path', d: 'M12 7.5v5.5' },
      { type: 'dot', cx: 12, cy: 16.5 },
    ],
    warning: [
      { type: 'path', d: 'M12 3.2 22 20.4H2z' },
      { type: 'path', d: 'M12 9.5v4.6' },
      { type: 'dot', cx: 12, cy: 17.4 },
    ],
    info: [
      { type: 'circle', cx: 12, cy: 12, r: 9 },
      { type: 'path', d: 'M12 11v5.5' },
      { type: 'dot', cx: 12, cy: 7.6 },
    ],
    success: [
      { type: 'circle', cx: 12, cy: 12, r: 9 },
      { type: 'path', d: 'm7.8 12.3 2.9 2.9 5.6-6' },
    ],
  };

  /**
   * Declarative glyph primitives per level.
   *
   * A renderer that cannot use HTML strings (a React tree, for instance) maps
   * these objects onto elements; a renderer that can (the embedded widget) calls
   * `notificationLevelMarkup`. One definition, two renderers, no drift.
   */
  const NOTIFICATION_LEVEL_SHAPES = Object.freeze(
    Object.keys(LEVEL_SHAPES).reduce((acc, level) => {
      acc[level] = Object.freeze(LEVEL_SHAPES[level].map((shape) => Object.freeze(Object.assign({}, shape))));
      return acc;
    }, {})
  );

  /** SVG attributes shared by every level glyph. */
  const NOTIFICATION_LEVEL_SVG_ATTRIBUTES = Object.freeze({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.9',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  function shapeToMarkup(shape) {
    if (shape.type === 'circle') {
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
    }
    if (shape.type === 'dot') {
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r=".9" fill="currentColor" stroke="none"/>`;
    }
    return `<path d="${shape.d}"/>`;
  }

  /**
   * Inner SVG markup for a level. Static, script-free markup built from frozen
   * literals above — never from user input.
   */
  function notificationLevelMarkup(level) {
    const shapes = NOTIFICATION_LEVEL_SHAPES[level];
    if (!shapes) return '';
    return shapes.map(shapeToMarkup).join('');
  }

  /** Inner SVG markup per level. */
  const NOTIFICATION_LEVEL_ICONS = Object.freeze(
    Object.keys(NOTIFICATION_LEVEL_SHAPES).reduce((acc, level) => {
      acc[level] = notificationLevelMarkup(level);
      return acc;
    }, {})
  );

  /** Clamp any value onto a known level (`'info'` when unknown). */
  function normalizeNotificationLevel(level) {
    return Object.prototype.hasOwnProperty.call(NOTIFICATION_LEVEL_SHAPES, level) ? level : 'info';
  }

  /** Accessible label for each level, reused by both renderers. */
  const NOTIFICATION_LEVEL_LABELS = Object.freeze({
    critical: 'Critical',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
    success: 'Success',
  });
  const THEME_DEFAULTS = Object.freeze({
    mode: 'auto',
    inheritHost: false,
    tokens: Object.freeze({}),
    host: Object.freeze({}),
    variables: Object.freeze({}),
  });

  // The system-font stack the Assistant ships with. Kept in sync with the
  // literal in assistant-widget.css so `fontFamily` has an honest default.
  const ASSISTANT_FONT_STACK =
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  /* ------------------------------------------------------------------ *
   * Value validation
   * ------------------------------------------------------------------ */

  const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const FUNCTION_COLOR = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/a-z]*\)$/i;
  const TOKEN_VAR_REFERENCE = /^var\(--youge-[a-z0-9-]{1,48}\)$/;
  const UNSAFE_CSS = /[\\;{}<>]|!\s*important|url\s*\(|expression\s*\(|@import|javascript:/i;
  const FONT_FAMILY = /^[A-Za-z0-9"'][A-Za-z0-9\s,'"_-]{0,118}$/;
  const PX_LENGTH = /^(\d{1,3})px$/;
  const NUMBER = /^\d{1,3}$/;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Bounded safety gate for any CSS value the integrator supplies.
   * Rejects declaration-breaking characters and expression-capable payloads.
   */
  function isSafeCssValue(value, maxLength) {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    if (!text || text.length > (maxLength || 200)) return false;
    if (UNSAFE_CSS.test(text)) return false;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(text)) return false;
    return true;
  }

  /** Accept only a plain hex, a bounded rgb()/hsl() call or one of our own vars. */
  function normalizeColor(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (text.length > 60) return null;
    if (HEX_COLOR.test(text)) return text;
    if (FUNCTION_COLOR.test(text) && isSafeCssValue(text, 60)) return text;
    if (TOKEN_VAR_REFERENCE.test(text)) return text;
    return null;
  }
  function normalizeFontFamily(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim().replace(/\s+/g, ' ');
    if (!FONT_FAMILY.test(text)) return null;
    // A stack with no generic fallback can resolve to nothing on unusual
    // platforms; the Assistant always appends its own generic last resort in CSS.
    return text;
  }
  function normalizeLength(value, min, max) {
    if (typeof value === 'number' && isFinite(value)) return clamp(Math.round(value), min, max);
    /* numeric strings and px strings are handled below */
    if (typeof value !== 'string') return null;
    const text = value.trim();
    const px = PX_LENGTH.exec(text);
    if (px) return clamp(Number(px[1]), min, max);
    const bare = NUMBER.exec(text);
    if (bare) return clamp(Number(bare[1]), min, max);
    return null;
  }
  function normalizeShadow(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!isSafeCssValue(text, 160)) return null;
    if (text.indexOf('px') === -1) return null;
    return text;
  }

  /**
   * Validate one token by key. Returns the CSS string to apply, or `null` when
   * the value is not acceptable (the caller then falls back to the Assistant
   * default). Length tokens are always normalized to a `px` string.
   */
  function normalizeToken(key, value) {
    if (value === undefined || value === null || value === '') return null;
    if (COLOR_TOKEN_KEYS.indexOf(key) !== -1) return normalizeColor(value);
    switch (key) {
      case 'fontFamily':
        return normalizeFontFamily(value);
      case 'fontSize':
        return px(normalizeLength(value, 10, 20));
      case 'radius':
        return px(normalizeLength(value, 0, 28));
      case 'radiusSmall':
        return px(normalizeLength(value, 0, 20));
      case 'borderWidth':
        return px(normalizeLength(value, 0, 3));
      case 'shadow':
        return normalizeShadow(value);
      default:
        return null;
    }
  }

  function px(number) {
    return number === null ? null : number + 'px';
  }

  function normalizeTokenMap(raw, warnings, warningPrefix) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (key) {
      if (THEME_TOKEN_KEYS.indexOf(key) === -1) {
        // Unknown keys are ignored, never forwarded to the DOM.
        warnings.push(warningPrefix + ':unknown_token:' + String(key).slice(0, 40));
        return;
      }
      const value = normalizeToken(key, raw[key]);
      if (value === null) {
        warnings.push(warningPrefix + ':invalid_token:' + key);
        return;
      }
      out[key] = value;
    });
    return out;
  }

  /**
   * Optional custom CSS variables. Restricted to `--youge-*`, to safe values and
   * away from the variables that own placement and hit-area geometry.
   */
  function normalizeThemeVariables(raw, warnings) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    const list = warnings || [];
    Object.keys(raw).forEach(function (key) {
      const name = String(key);
      if (!/^--youge-[a-z0-9-]{1,40}$/.test(name)) {
        list.push('variables:invalid_name:' + name.slice(0, 40));
        return;
      }
      if (PROTECTED_VARIABLES.indexOf(name) !== -1) {
        list.push('variables:protected:' + name);
        return;
      }
      const value = raw[key];
      if (!isSafeCssValue(value, 160)) {
        list.push('variables:invalid_value:' + name);
        return;
      }
      out[name] = String(value).trim();
    });
    return out;
  }

  /**
   * Normalize any accepted `theme` shape into a stable, JSON-safe record.
   *
   * Accepted inputs:
   *   'auto' | 'light' | 'dark'         (0.x string form, unchanged behaviour)
   *   { mode, inheritHost, tokens, host, variables }
   *
   * `mode: 'custom'` is only available through the object form: a bare
   * `'custom'` string has no tokens to apply, so it falls back to `'auto'`.
   */
  function normalizeTheme(raw) {
    const warnings = [];
    let source = raw;

    if (typeof source === 'string') {
      const mode = source.trim().toLowerCase();
      if (mode === 'auto' || mode === 'light' || mode === 'dark') {
        return { mode: mode, inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
      }
      if (mode === 'custom') warnings.push('theme:custom_requires_object');
      else warnings.push('theme:unsupported_mode:' + mode.slice(0, 20));
      return { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
    }

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      if (source !== undefined && source !== null) warnings.push('theme:invalid_object');
      return { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
    }

    let mode = 'auto';
    const requested = source.mode;
    if (requested === undefined || requested === null) {
      // Object form without an explicit mode keeps the documented default.
      mode = 'auto';
    } else if (typeof requested === 'string' && THEME_MODES.indexOf(requested.trim().toLowerCase()) !== -1) {
      mode = requested.trim().toLowerCase();
    } else {
      warnings.push('theme:unsupported_mode:' + String(requested).slice(0, 20));
    }

    let inheritHost = source.inheritHost === true;
    if (source.inheritHost !== undefined && typeof source.inheritHost !== 'boolean') {
      warnings.push('theme:invalid_inherit_host');
      inheritHost = false;
    }

    const tokens = normalizeTokenMap(source.tokens, warnings, 'theme.tokens');
    const host = normalizeTokenMap(source.host, warnings, 'theme.host');
    const variables = normalizeThemeVariables(source.variables, warnings);

    if (mode === 'custom' && Object.keys(tokens).length === 0) {
      warnings.push('theme:custom_without_tokens');
    }

    return {
      mode: mode,
      inheritHost: inheritHost,
      tokens: tokens,
      host: host,
      variables: variables,
      warnings: warnings,
    };
  }

  /* ------------------------------------------------------------------ *
   * Contrast utilities (WCAG 2.1 relative luminance)
   * ------------------------------------------------------------------ */

  function expandHex(hex) {
    const body = String(hex).replace('#', '');
    if (body.length === 3 || body.length === 4) {
      return body.slice(0, 3).replace(/./g, function (c) { return c + c; });
    }
    return body.slice(0, 6);
  }

  /** Relative luminance of a `#rgb`/`#rrggbb` colour; `null` for references. */
  function relativeLuminance(color) {
    if (typeof color !== 'string' || !HEX_COLOR.test(color.trim())) return null;
    const body = expandHex(color.trim());
    const channels = [0, 2, 4].map(function (index) {
      const value = parseInt(body.slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  /** WCAG contrast ratio; `null` when either colour is not a plain hex value. */
  function contrastRatio(a, b) {
    const first = relativeLuminance(a);
    const second = relativeLuminance(b);
    if (first === null || second === null) return null;
    const high = Math.max(first, second);
    const low = Math.min(first, second);
    return (high + 0.05) / (low + 0.05);
  }

  /**
   * Pick the most legible foreground for a fill. References (`var(--…)`) and
   * non-hex values keep the provided default because they cannot be measured.
   */
  function bestInk(background, candidates, fallback) {
    const pool = (candidates && candidates.length ? candidates : ['#ffffff', '#0b1220']);
    if (contrastRatio(background, pool[0]) === null) return fallback || pool[0];
    let best = null;
    let bestRatio = -1;
    for (let i = 0; i < pool.length; i += 1) {
      const ratio = contrastRatio(background, pool[i]);
      if (ratio === null) continue;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = pool[i];
      }
      if (ratio >= 4.5) {
        best = pool[i];
        break;
      }
    }
    return best || fallback || pool[0];
  }

  /* ------------------------------------------------------------------ *
   * Host detection (read-only, defensive)
   * ------------------------------------------------------------------ */

  const SCHEME_ATTRIBUTES = ['data-theme', 'data-color-mode', 'data-bs-theme', 'data-scheme', 'data-user-color-scheme'];
  const DARK_CLASSES = ['dark', 'theme-dark', 'dark-mode', 'dark-theme'];
  const LIGHT_CLASSES = ['light', 'theme-light', 'light-mode', 'light-theme'];

  function readElementScheme(element) {
    if (!element) return null;
    // Every read is guarded: a host page may expose a throwing getter here, and
    // theme detection must never be able to break the widget.
    try {
      if (typeof element.getAttribute === 'function') {
        for (let i = 0; i < SCHEME_ATTRIBUTES.length; i += 1) {
          const value = element.getAttribute(SCHEME_ATTRIBUTES[i]);
          if (value === 'dark') return 'dark';
          if (value === 'light') return 'light';
        }
      }
    } catch (error) { /* ignore and keep looking */ }
    try {
      const list = element.classList;
      if (list && typeof list.contains === 'function') {
        for (let i = 0; i < DARK_CLASSES.length; i += 1) {
          if (list.contains(DARK_CLASSES[i])) return 'dark';
        }
        for (let i = 0; i < LIGHT_CLASSES.length; i += 1) {
          if (list.contains(LIGHT_CLASSES[i])) return 'light';
        }
      }
    } catch (error) { /* ignore */ }
    try {
      const inline = element.style && typeof element.style === 'object' ? element.style.colorScheme : '';
      if (typeof inline === 'string' && inline.trim()) {
        const value = inline.trim().toLowerCase();
        if (value === 'dark') return 'dark';
        if (value === 'light') return 'light';
      }
    } catch (error) { /* ignore */ }
    return null;
  }

  function readComputedScheme(context, element) {
    const getStyle = context.getComputedStyle
      || (context.root && typeof context.root.getComputedStyle === 'function' ? context.root.getComputedStyle : null);
    if (!getStyle || !element) return null;
    try {
      const style = getStyle.call(context.root || null, element);
      const declared = style && style.colorScheme;
      if (typeof declared !== 'string') return null;
      const value = declared.trim().toLowerCase();
      // "light dark" means both are supported: the media query decides.
      if (value === 'dark') return 'dark';
      if (value === 'light') return 'light';
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Resolve the host page's light/dark scheme.
   *
   * Order: an explicit `context.hostScheme`, then the host's own scheme signal
   * (`data-theme`, `data-color-mode`, `data-bs-theme`, `data-scheme`, a
   * dark/light class, an inline `color-scheme`), then the computed
   * `color-scheme`, then `prefers-color-scheme`, then light.
   */
  function detectHostScheme(context) {
    const ctx = context || {};
    if (ctx.hostScheme === 'dark' || ctx.hostScheme === 'light') return ctx.hostScheme;

    const doc = ctx.document || (ctx.root && ctx.root.document) || null;
    const element = doc ? (doc.documentElement || null) : null;
    let fromAttributes = null;
    try {
      fromAttributes = readElementScheme(element) || readElementScheme(doc && doc.body);
    } catch (error) { /* ignore */ }
    if (fromAttributes) return fromAttributes;

    const computed = readComputedScheme(ctx, element);
    if (computed) return computed;

    const query = ctx.matchMedia
      || (ctx.root && typeof ctx.root.matchMedia === 'function' ? ctx.root.matchMedia : null);
    if (typeof query === 'function') {
      try {
        const result = query.call(ctx.root || null, '(prefers-color-scheme: dark)');
        if (result && result.matches === true) return 'dark';
        if (result && result.matches === false) return 'light';
      } catch (error) { /* fall through */ }
    }
    return 'light';
  }

  /**
   * Optionally read the host's typography. Only the font stack is inherited:
   * colours come from explicit `theme.host` values, never from a computed style
   * guess, so a host can never drag contrast down silently.
   */
  function detectHostTypography(context) {
    const ctx = context || {};
    const doc = ctx.document || (ctx.root && ctx.root.document) || null;
    if (!doc || !doc.body) return null;
    const getStyle = ctx.getComputedStyle
      || (ctx.root && typeof ctx.root.getComputedStyle === 'function' ? ctx.root.getComputedStyle : null);
    if (!getStyle) return null;
    try {
      const style = getStyle.call(ctx.root || null, doc.body);
      const family = style && typeof style.fontFamily === 'string' ? style.fontFamily : '';
      const normalized = normalizeFontFamily(family);
      return normalized ? { fontFamily: normalized } : null;
    } catch (error) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * Resolution
   * ------------------------------------------------------------------ */

  const INKABLE_TONES = ['primary', 'success', 'info', 'warning', 'error', 'critical'];

  /**
   * Resolve a theme into the values a renderer needs.
   *
   * @param {unknown} themeInput         raw `theme` value or a normalized record
   * @param {object}  [context]          { document, matchMedia, getComputedStyle, root, hostScheme, seedPrimary }
   *
   * `context.seedPrimary` is a validated colour that acts as the lowest-priority
   * primary — it keeps the long-standing `branding.themeColor` behaviour working
   * without letting it override an explicit `theme.tokens.primary`. It is only
   * accepted as a plain colour value.
   * @returns {{
   *   mode: 'auto'|'light'|'dark'|'custom',
   *   scheme: 'light'|'dark',
   *   inheritHost: boolean,
   *   tokens: Record<string, string>,
   *   variables: Record<string, string>,
   *   warnings: string[],
   * }}
   */
  function resolveTheme(themeInput, context) {
    const ctx = context || {};
    // `normalizeTheme` is idempotent: normalizing an already-normalized record
    // returns the same validated values, so callers may pass either shape.
    const theme = normalizeTheme(themeInput);
    const warnings = (theme.warnings || []).slice();

    const mode = THEME_MODES.indexOf(theme.mode) !== -1 ? theme.mode : 'auto';
    const inheritHost = theme.inheritHost === true;

    // Light/Dark never consult the host or the OS. Auto always detects the
    // host's light/dark scheme (that is what `auto` means); `inheritHost` only
    // controls whether host *values* — colours and typography — are adopted on
    // top of the Assistant's own palette. Custom keeps the integrator's palette
    // on a deterministic light foundation.
    let scheme = 'light';
    if (mode === 'dark') scheme = 'dark';
    else if (mode === 'light' || mode === 'custom') scheme = 'light';
    else scheme = detectHostScheme(ctx);

    const base = Object.assign({}, ASSISTANT_PALETTES[scheme]);
    const hostLayer = {};

    if (mode === 'auto' && inheritHost) {
      Object.keys(theme.host || {}).forEach(function (key) { hostLayer[key] = theme.host[key]; });
      if (!hostLayer.fontFamily) {
        const typography = detectHostTypography(ctx);
        if (typography && typography.fontFamily) hostLayer.fontFamily = typography.fontFamily;
      }
    }

    const merged = Object.assign({}, base, hostLayer, theme.tokens || {});
    // `branding.themeColor` remains a supported way to set the project's primary
    // colour. It ranks below any explicit theme token and below host adaptation.
    if (!hostLayer.primary && !(theme.tokens && theme.tokens.primary)) {
      const seed = ctx.seedPrimary === undefined ? null : normalizeColor(ctx.seedPrimary);
      if (seed) {
        // A project brand colour is a *light-scheme* identity value. On a dark
        // surface it is only kept when it is still legible there; otherwise the
        // Assistant's dark-adapted brand is used, which is what keeps a deep
        // brand blue from becoming unreadable on a dark panel.
        const legible = scheme !== 'dark' || (contrastRatio(seed, base.surface) || 0) >= 4.5;
        if (legible) merged.primary = seed;
        else warnings.push('theme:contrast_guard:seedPrimary');
      }
    }

    // --- Contrast guard: never let a host or integrator value reduce
    // readability below the AA floor for body text. The Assistant's own value is
    // restored per token instead of rejecting the whole theme.
    const surface = merged.surface;
    const guards = [
      ['text', base.text, 4.5],
      ['mutedText', base.mutedText, 4.5],
      ['onPrimary', base.onPrimary, 4.5],
    ];
    guards.forEach(function (entry) {
      const key = entry[0];
      const ratio = contrastRatio(merged[key], key === 'onPrimary' ? merged.primary : surface);
      if (ratio !== null && ratio < entry[2]) {
        warnings.push('theme:contrast_guard:' + key);
        merged[key] = entry[1];
      }
    });

    // A border that matches its surface is invisible: restore the Assistant's.
    const borderRatio = contrastRatio(merged.border, surface);
    if (borderRatio !== null && borderRatio < 1.2) {
      warnings.push('theme:contrast_guard:border');
      merged.border = base.border;
    }

    // The font stack always resolves to something concrete, so the renderer can
    // publish it as a variable instead of leaving the CSS default implicit.
    if (!merged.fontFamily) merged.fontFamily = ASSISTANT_FONT_STACK;

    // Tone inks are derived, never trusted: a fill only keeps a white label when
    // white actually clears 4.5:1 against it.
    const variables = {};
    INKABLE_TONES.forEach(function (tone) {
      if (!merged[tone]) return;
      const ink = bestInk(merged[tone], ['#ffffff', '#0b1220', base.text], base.text);
      variables['--youge-' + tone + '-ink'] = ink;
    });

    Object.keys(merged).forEach(function (key) {
      const targets = TOKEN_CSS_VARIABLES[key];
      if (!targets) return;
      targets.forEach(function (name) { variables[name] = merged[key]; });
    });

    // Integrator variables are applied last: they are explicit opt-in overrides
    // of the (validated) token variables, never of layout geometry.
    Object.keys(theme.variables || {}).forEach(function (name) {
      if (PROTECTED_VARIABLES.indexOf(name) === -1) variables[name] = theme.variables[name];
    });

    const tokens = {};
    Object.keys(merged).forEach(function (key) {
      if (merged[key] !== undefined && merged[key] !== null) tokens[key] = merged[key];
    });

    return {
      mode: mode,
      scheme: scheme,
      inheritHost: mode === 'auto' && inheritHost,
      tokens: tokens,
      variables: variables,
      warnings: warnings,
    };
  }

  /**
   * Convert a resolved theme into `style` assignments for a DOM node.
   * Only `--youge-*` custom properties are ever produced.
   */
  function themeToCssVariables(resolved) {
    const out = {};
    const source = resolved && resolved.variables ? resolved.variables : {};
    Object.keys(source).forEach(function (name) {
      if (/^--youge-[a-z0-9-]+$/.test(name) && isSafeCssValue(source[name], 160)) {
        out[name] = source[name];
      }
    });
    return out;
  }

  /* --- domain/index.js --- */

  const DOMAIN_DEFAULTS = {
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
  function normalizeHost(value) {
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
  function detectRuntimeHostname(locationLike) {
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
  function isIpAddress(hostname) {
    const host = normalizeHost(hostname);
    return Boolean(host && (host.charAt(0) === '[' ? isValidIpv6(host) : isValidIpv4(host)));
  }
  function rootDomain(hostname) {
    const host = normalizeHost(hostname);
    if (!host || host === 'localhost' || isIpAddress(host) || host.indexOf('.') === -1) return host;
    if (host.endsWith('.localhost')) return 'localhost';
    const labels = host.split('.');
    const lastTwo = labels.slice(-2).join('.');
    const count = KNOWN_COMPOUND_SUFFIXES[lastTwo] ? 3 : 2;
    return labels.length <= count ? host : labels.slice(-count).join('.');
  }
  function normalizePath(value, fallback) {
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
  function safeNavigationUrl(value, fallback) {
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

  const DIAGNOSTICS_PROBE_KEYS = ['appProbePath', 'backendProbePath'];

  /**
   * Diagnostics probes run same-origin without credentials, so a configured path
   * must stay a plain relative or root-relative path: cross-origin URLs, network
   * paths (`//host`), script schemes, backslashes and `..` traversal are rejected.
   */
  function safeDiagnosticsProbePath(value) {
    if (typeof value !== 'string') return false;
    const probe = value.trim();
    if (!probe || probe !== value) return false;
    if (probe.charAt(0) === '?' || probe.charAt(0) === '#') return false;
    return safeRelativeUrl(probe);
  }

  function sanitizeDiagnosticsConfig(value) {
    const safe = {};
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
    const color = String(value == null ? '' : value).trim().toLowerCase();
    return VALID_COLOR_HEX.test(color) || VALID_COLOR_FUNCTION.test(color) || CSS_COLOR_NAMES.has(color);
  }
  function validateDomainConfig(raw) {
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

    config.diagnostics = sanitizeDiagnosticsConfig(config.diagnostics);

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
  function validateDomainConfigDetailed(raw) {
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

      if (source.diagnostics !== undefined && !isRecord(source.diagnostics)) {
        add('invalid_diagnostics', 'diagnostics', 'Diagnostics configuration must be an object of safe probe paths.');
      } else if (isRecord(source.diagnostics)) {
        DIAGNOSTICS_PROBE_KEYS.forEach(function (key) {
          const value = source.diagnostics[key];
          if (value !== undefined && !safeDiagnosticsProbePath(value)) {
            add('invalid_diagnostics_probe', 'diagnostics.' + key,
              'Diagnostics probe paths must be safe same-origin relative or root-relative paths.');
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
  function validateDomainRegistry(raw) {
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
  function resolveDomain(locationLike, optionalRegistry) {
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
  function buildManifest(config) {
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
  function createDomainResolver(initialRegistry) {
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

  /* --- config/index.js --- */

  const BUNDLED_DEFAULTS = {
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
  function normalizeActions(raw) {
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
  function normalizeFeatures(raw) {
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
  function validatePublishedConfig(rawInput, options) {
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
  function lkgStorageKey(projectId) {
    return STORAGE_PREFIXES.lastKnownGood + safeText(projectId || 'default', 80);
  }
  function loadLastKnownGood(storage, projectId) {
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
  function saveLastKnownGood(storage, projectId, validatedRecord) {
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
  function normalizeConfig(raw) {
    return resolveAssistantConfig(raw).config;
  }
  function resolveAssistantConfig(rawInput, context) {
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

  /* --- diagnostics/index.js --- */

  const DNS_FAILURE_CLASSIFICATIONS = [
    'nxdomain',
    'dns_resolution_failure',
    'dns_records_missing',
    'possible_dns_interference',
    'dns_failure',
    'dns-error',
    'dns_failed',
    'missing_address_records',
    'servfail',
    'refused',
  ];

  const CONNECTIVITY_FAILURE_CLASSIFICATIONS = [
    'general_internet_failure',
    'application_host_unavailable',
    'backend_unavailable',
    'error',
    'timeout',
  ];
  function dnsFailure(dns) {
    const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
    return DNS_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1;
  }
  function connectivityFailure(dns) {
    const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
    return CONNECTIVITY_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1 || Boolean(dns && dns.failed);
  }
  function normalizeDnsResult(result, DateCtor) {
    const raw = result && typeof result === 'object' ? result : {};
    const DateImpl = DateCtor || Date;
    return {
      status: String(raw.status || 'complete'),
      classification: safeText(raw.classification || 'unknown', 60),
      message: safeText(raw.message || '', 240),
      checkedAt: raw.checkedAt ? safeText(raw.checkedAt, 60) : new DateImpl().toISOString(),
      failed: Boolean(raw.failed),
    };
  }
  function resolveDiagnosticsRunner(options) {
    const opts = options || {};
    if (opts.services && typeof opts.services.diagnostics === 'function') {
      return opts.services.diagnostics;
    }
    const pwa = typeof opts.getPwa === 'function' ? opts.getPwa() : opts.pwa;
    if (pwa && typeof pwa.runNetworkDiagnostics === 'function') {
      return function (runOptions) {
        return pwa.runNetworkDiagnostics(runOptions);
      };
    }
    const dns = typeof opts.getDns === 'function' ? opts.getDns() : opts.dns;
    if (dns && typeof dns.check === 'function') {
      return function (runOptions) {
        const ctx = typeof opts.getContext === 'function' ? opts.getContext() : (opts.context || {});
        return dns.check({
          hostname: ctx.hostname,
          origin: ctx.origin,
          basePath: ctx.basePath || '/',
          online: ctx.online !== false,
        }, runOptions);
      };
    }
    return null;
  }
  function createDiagnosticsIntegration(options) {
    const opts = options || {};
    let inFlight = null;

    function run(runOptions) {
      if (inFlight) return inFlight;
      const runner = resolveDiagnosticsRunner(opts);
      if (!runner) {
        const unavailable = {
          classification: 'unknown',
          message: 'Network diagnostics are not available on this page.',
          status: 'unavailable',
        };
        if (typeof opts.onResult === 'function') opts.onResult(unavailable);
        return Promise.resolve(unavailable);
      }

      if (typeof opts.onStart === 'function') opts.onStart();
      inFlight = Promise.resolve()
        .then(function () { return runner(runOptions); })
        .then(function (result) {
          const safeResult = result && typeof result === 'object' ? result : {};
          if (typeof opts.onResult === 'function') opts.onResult(safeResult);
          return safeResult;
        })
        .catch(function (error) {
          const failed = {
            classification: 'error',
            message: safeText(error && error.message, 200) || 'Diagnostics failed.',
            status: 'error',
            failed: true,
          };
          if (typeof opts.onResult === 'function') opts.onResult(failed);
          return failed;
        })
        .then(function (finalResult) {
          inFlight = null;
          return finalResult;
        });
      return inFlight;
    }

    function clear() {
      inFlight = null;
    }

    return {
      run: run,
      clear: clear,
      isRunning: function () { return Boolean(inFlight); },
    };
  }

  /* --- installation/index.js --- */

  function readPwaSnapshot(pwa) {
    let state = {};
    if (!pwa) return state;
    try {
      if (typeof pwa.getState === 'function') state = pwa.getState() || {};
    } catch (error) {
      state = {};
    }
    return state;
  }
  function deriveInstallationState(options) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    const moduleEnabled = opts.enabled !== false;
    const state = readPwaSnapshot(pwa);

    let installed = Boolean(state.installed || state.standalone);
    let canInstall = Boolean(state.canInstall);
    let ios = Boolean(state.ios);
    let safari = Boolean(state.safari);

    try { if (!installed && pwa && typeof pwa.isInstalled === 'function') installed = Boolean(pwa.isInstalled()); } catch (error) { /* ignore */ }
    try { if (!canInstall && pwa && typeof pwa.canInstall === 'function') canInstall = Boolean(pwa.canInstall()); } catch (error) { /* ignore */ }
    try { if (!ios && pwa && typeof pwa.isIOS === 'function') ios = Boolean(pwa.isIOS()); } catch (error) { /* ignore */ }
    try { if (!safari && pwa && typeof pwa.isSafari === 'function') safari = Boolean(pwa.isSafari()); } catch (error) { /* ignore */ }

    const pwaFeatureAllowed = !pwa || !pwa.config || !pwa.config.features || pwa.config.features.installation !== false;
    const enabled = Boolean(moduleEnabled && pwa && pwaFeatureAllowed);

    let support = 'none';
    if (enabled) {
      if (installed) support = 'installed';
      else if (canInstall) support = 'native';
      else if (ios && safari) support = 'manual-ios';
      else support = 'manual-generic';
    }

    return {
      support: support,
      status: installed ? 'installed' : (support === 'none' ? 'unavailable' : 'available'),
      canInstall: canInstall,
      installed: installed,
      standalone: Boolean(state.standalone),
      ios: ios,
      safari: safari,
      platform: ios ? 'ios' : (canInstall ? 'chromium' : 'generic'),
      nativeAvailable: canInstall,
    };
  }
  function requestPwaInstall(options, promptOptions) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    if (opts.enabled === false || !pwa || typeof pwa.promptInstall !== 'function') {
      return Promise.resolve({ outcome: 'unsupported' });
    }
    try {
      return Promise.resolve(pwa.promptInstall(promptOptions));
    } catch (error) {
      return Promise.resolve({ outcome: 'error' });
    }
  }

  /* --- browser/index.js --- */

  const ANDROID_RE = /Android/i;
  const IOS_RE = /iPhone|iPad|iPod/i;
  // Named restricted in-app browsers. Messenger is tested before Facebook:
  // Messenger webviews carry Facebook's own FBAN/FBAV markers as well.
  const INSTAGRAM_RE = /Instagram/i;
  const MESSENGER_RE = /Messenger/i;
  const FACEBOOK_RE = /\bFBAN\b|\bFBAV\b|\[FB_IAB|\bFB4A\b|\bFacebook\b/i;
  // Android System WebView advertises itself with a `wv)` platform token.
  // Standalone Chrome on Android never carries it.
  const WEBVIEW_RE = /\bwv\)/i;
  const CHROME_PACKAGE = 'com.android.chrome';
  const CHROME_OFFER_STORAGE_KEY = 'youge-assistant:chrome-offer-dismissed';

  /**
   * Classify a user agent for in-app browser restrictions.
   *
   * @param {string} [userAgent]
   * @returns {Readonly<{
   *   ua: string,
   *   android: boolean,
   *   ios: boolean,
   *   inApp: boolean,
   *   restricted: boolean,
   *   uncertain: boolean,
   *   browser: 'facebook' | 'messenger' | 'instagram' | 'webview' | 'none',
   * }>}
   */
  function detectInAppBrowser(userAgent) {
    const ua = typeof userAgent === 'string' ? userAgent : '';
    if (!ua.trim()) {
      return Object.freeze({
        ua: '',
        android: false,
        ios: false,
        inApp: false,
        restricted: false,
        uncertain: true,
        browser: 'none',
      });
    }

    const android = ANDROID_RE.test(ua);
    const ios = IOS_RE.test(ua);

    let browser = 'none';
    if (INSTAGRAM_RE.test(ua)) browser = 'instagram';
    else if (MESSENGER_RE.test(ua)) browser = 'messenger';
    else if (FACEBOOK_RE.test(ua)) browser = 'facebook';
    else if (android && WEBVIEW_RE.test(ua)) browser = 'webview';

    const inApp = browser !== 'none';
    return Object.freeze({
      ua,
      android,
      ios,
      inApp,
      restricted: inApp,
      uncertain: false,
      browser,
    });
  }

  /** True only for a confident Android restricted in-app browser. */
  function isChromeHandoffCandidate(detection) {
    return Boolean(detection && detection.android && detection.restricted && !detection.uncertain);
  }

  /**
   * Build the Android `intent://` URL that asks Chrome to open `url`.
   *
   * The target keeps the original host, pathname, query string and hash
   * (`intent://host/path?query#hash#Intent;…`). The full original URL is also
   * carried percent-encoded in `S.browser_fallback_url` so it survives the
   * intent round-trip. Returns null for anything that is not an absolute
   * http(s) URL — no other scheme is ever handed to the intent handler.
   *
   * @param {string} url
   * @param {{ packageName?: string }} [options]
   * @returns {string | null}
   */
  function buildChromeIntentUrl(url, options) {
    const packageName = (options && options.packageName) || CHROME_PACKAGE;
    if (typeof url !== 'string' || !url) return null;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

    const scheme = parsed.protocol.slice(0, -1);
    // host + pathname + query — everything before the fragment, verbatim.
    const target = parsed.host + parsed.pathname + parsed.search;
    const fragment = parsed.hash ? parsed.hash.slice(1) : '';
    const fallback = encodeURIComponent(url);
    return `intent://${target}${fragment ? `#${fragment}` : ''}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${fallback};end`;
  }

  /**
   * Copy-ready manual fallback for when the automatic handoff fails.
   * Plain data — every renderer (widget, React, host app) presents it its own way.
   *
   * @param {string} url
   * @param {Partial<Record<'title' | 'intro' | 'stepCopy' | 'stepSwitch' | 'stepPaste' | 'copyLabel' | 'copiedLabel' | 'openLabel' | 'dismissLabel', string>>} [labels]
   */
  function chromeHandoffInstructions(url, labels) {
    const l = labels || {};
    return Object.freeze({
      title: l.title || 'Open this page in Chrome',
      intro:
        l.intro ||
        'This in-app browser can hide features and break links. Continue in Chrome instead.',
      steps: Object.freeze([
        l.stepCopy || 'Copy the page address shown below.',
        l.stepSwitch || 'Leave this app and open Chrome on your device.',
        l.stepPaste || 'Paste the address into Chrome’s address bar and open it.',
      ]),
      url: typeof url === 'string' ? url : '',
      openLabel: l.openLabel || 'Open in Chrome',
      dismissLabel: l.dismissLabel || 'Not now',
      copyLabel: l.copyLabel || 'Copy address',
      copiedLabel: l.copiedLabel || 'Address copied.',
    });
  }

  /**
   * Controller shared by every renderer: detection, best-effort intent open and
   * the manual fallback handshake. All environment access is injectable so the
   * flow is testable without a browser.
   *
   * @param {{
   *   userAgent?: string,
   *   location?: { href?: string, assign?: (url: string) => void } | null,
   *   document?: { visibilityState?: string } | null,
   *   assign?: (url: string) => void,
   *   setTimeout?: (fn: () => void, ms: number) => unknown,
   *   clearTimeout?: (id: unknown) => void,
   *   fallbackDelayMs?: number,
   *   packageName?: string,
   *   labels?: Record<string, string>,
   * }} [options]
   */
  function createChromeHandoff(options) {
    const opts = options || {};
    const doc =
      opts.document !== undefined
        ? opts.document
        : typeof document !== 'undefined'
          ? document
          : null;
    const loc =
      opts.location !== undefined
        ? opts.location
        : typeof location !== 'undefined'
          ? location
          : null;
    const detection = detectInAppBrowser(
      opts.userAgent !== undefined
        ? opts.userAgent
        : typeof navigator !== 'undefined' && navigator
          ? navigator.userAgent
          : ''
    );
    const candidate = isChromeHandoffCandidate(detection);

    const assign =
      typeof opts.assign === 'function'
        ? opts.assign
        : loc && typeof loc.assign === 'function'
          ? loc.assign.bind(loc)
          : null;
    const schedule =
      typeof opts.setTimeout === 'function'
        ? opts.setTimeout
        : typeof setTimeout === 'function'
          ? setTimeout
          : null;
    const cancel =
      typeof opts.clearTimeout === 'function'
        ? opts.clearTimeout
        : typeof clearTimeout === 'function'
          ? clearTimeout
          : null;
    const fallbackDelayMs =
      typeof opts.fallbackDelayMs === 'number' && isFinite(opts.fallbackDelayMs)
        ? opts.fallbackDelayMs
        : 900;

    let timer = null;
    let destroyed = false;
    let currentUrl = '';

    function targetUrl(url) {
      if (typeof url === 'string' && url) return url;
      if (loc && typeof loc.href === 'string' && loc.href) return loc.href;
      return currentUrl || '';
    }

    function clearTimer() {
      if (timer !== null && typeof cancel === 'function') cancel(timer);
      timer = null;
    }

    function intentUrl(url) {
      return buildChromeIntentUrl(targetUrl(url), opts);
    }

    function instructions(url) {
      return chromeHandoffInstructions(targetUrl(url), opts.labels);
    }

    function open(url, onFallback) {
      currentUrl = targetUrl(url);
      const manual = instructions(currentUrl);

      if (!candidate) {
        return Object.freeze({ status: 'unsupported', intentUrl: null, instructions: manual });
      }
      const intent = buildChromeIntentUrl(currentUrl, opts);
      const fallback = typeof onFallback === 'function' ? onFallback : null;

      if (!intent || typeof assign !== 'function') {
        // Nothing to attempt with — go straight to the manual instructions.
        if (fallback) fallback(manual);
        return Object.freeze({ status: 'failed', intentUrl: intent, instructions: manual });
      }
      try {
        assign(intent);
      } catch (error) {
        if (fallback) fallback(manual);
        return Object.freeze({ status: 'failed', intentUrl: intent, instructions: manual });
      }

      // Best-effort handshake: if this document is still the visible one after
      // the delay, the intent did not leave the app — show the manual steps.
      if (schedule && doc && !destroyed) {
        clearTimer();
        timer = schedule(function () {
          timer = null;
          if (destroyed) return;
          const visible = !doc.visibilityState || doc.visibilityState === 'visible';
          if (visible && fallback) fallback(manual);
        }, fallbackDelayMs);
      }
      return Object.freeze({ status: 'attempted', intentUrl: intent, instructions: manual });
    }

    function destroy() {
      destroyed = true;
      clearTimer();
    }

    return Object.freeze({
      detection,
      shouldOffer() {
        return candidate;
      },
      intentUrl,
      instructions,
      open,
      destroy,
    });
  }

  /* --- assistant/index.js --- */

  /**
   * Presentation severity for a notification.
   *
   * This is presentation only: it never changes a priority, an id, a
   * dismissibility flag or any suppression/persistence rule. The mapping is
   * derived from what the condition actually means, so the widget can render
   * distinct, accessible tiers without the engine knowing about CSS.
   *
   *   critical — the app is unreachable (connectivity, DNS, host resolution)
   *   error    — a required backend endpoint is down
   *   warning  — something needs the user's attention but still works (session)
   *   success  — good news (service restored, the app can be installed)
   *   info     — context only (failover active, available update, features)
   */
  const NOTIFICATION_LEVEL_MAP = Object.freeze({
    'network:offline': 'critical',
    'dns:failure': 'critical',
    'network:unreachable': 'critical',
    'api:primary-failed': 'error',
    'session:issue': 'warning',
    'api:backup-active': 'info',
    'api:primary-restored': 'success',
    'install:available': 'success',
    'app:update': 'info',
  });
  function notificationLevel(id, priority) {
    const key = String(id || '');
    if (NOTIFICATION_LEVEL_MAP[key]) return NOTIFICATION_LEVEL_MAP[key];
    if (key.indexOf('feature:') === 0) return 'info';
    switch (priority) {
      case PRIORITY.critical: return 'critical';
      case PRIORITY.auth: return 'warning';
      case PRIORITY.backup: return 'info';
      case PRIORITY.install: return 'success';
      default: return 'info';
    }
  }
  function createAssistant(initialOptions, envOverrides) {
    const rawInit = initialOptions && typeof initialOptions === 'object' ? initialOptions : {};
    const envIn = Object.assign(
      {},
      rawInit.env && typeof rawInit.env === 'object' ? rawInit.env : {},
      envOverrides && typeof envOverrides === 'object' ? envOverrides : {}
    );

    const defaultRoot = typeof globalThis !== 'undefined' ? globalThis : {};
    const root = envIn.root || envIn.window || rawInit.window || defaultRoot;
    const useGlobalConfig = Boolean(envIn.useGlobalConfig);
    const exposeGlobal = Boolean(envIn.exposeGlobal || rawInit.exposeGlobal);
    const shouldBindEvents = envIn.bindEvents !== false && rawInit.bindEvents !== false;

    const UrlCtor = root.URL || URL;
    const DateCtor = root.Date || Date;

    function getDoc() {
      if (envIn.document !== undefined) return envIn.document;
      if (rawInit.document !== undefined) return rawInit.document;
      return root.document || null;
    }

    function getStorage() {
      if (envIn.storage !== undefined) return envIn.storage;
      if (rawInit.storage !== undefined) return rawInit.storage;
      try {
        return root.localStorage || null;
      } catch (error) {
        return null;
      }
    }

    function getLocation() {
      if (envIn.location !== undefined) return envIn.location;
      if (rawInit.location !== undefined) return rawInit.location;
      return root.location || {};
    }

    function getNavigator() {
      if (envIn.navigator !== undefined) return envIn.navigator;
      if (rawInit.navigator !== undefined) return rawInit.navigator;
      return root.navigator || null;
    }

    function getPwa() {
      if (envIn.pwa !== undefined) return envIn.pwa;
      if (rawInit.pwa !== undefined) return rawInit.pwa;
      return root.PWA || null;
    }

    function getDns() {
      if (envIn.dns !== undefined) return envIn.dns;
      if (rawInit.dns !== undefined) return rawInit.dns;
      return root.YouGeDns || null;
    }

    let rawOptionsState = Object.assign(
      {},
      useGlobalConfig && root.YOU_GE_ASSISTANT_CONFIG && typeof root.YOU_GE_ASSISTANT_CONFIG === 'object'
        ? root.YOU_GE_ASSISTANT_CONFIG
        : {},
      rawInit
    );

    let resolvedBundle = resolveAssistantConfig(rawOptionsState, {
      storage: getStorage(),
    });
    let config = resolvedBundle.config;
    let configMeta = resolvedBundle.meta;
    const rejectedPublishedConfig = Array.isArray(configMeta.warnings) && configMeta.warnings.some(function (warning) {
      return typeof warning === 'string' && warning.indexOf('published_config_rejected:') === 0;
    });
    const shouldResolveInitialLkg = configMeta.source !== 'last-known-good' && (
      (rejectedPublishedConfig && rawOptionsState.useLastKnownGood !== false) ||
      (rawOptionsState.useLastKnownGood === true && !rawOptionsState.publishedConfig)
    );
    if (shouldResolveInitialLkg) {
      const fallbackProjectId = projectInfo().id;
      const recovered = resolveAssistantConfig(rawOptionsState, {
        storage: getStorage(),
        fallbackProjectId: fallbackProjectId,
      });
      if (recovered.meta.source === 'last-known-good') {
        resolvedBundle = recovered;
        config = recovered.config;
        configMeta = recovered.meta;
      }
    }
    let services = config.services;

    const listeners = new Set();
    const listenerCounts = new Map();
    let noticeStore = { dismissed: {}, acknowledged: {} };
    let snapshot = null;
    let bound = false;
    let destroyed = false;
    let unsubscribePwa = null;
    let lastConditionKeys = new Set();

    const nav = getNavigator();
    const conditions = {
      online: nav ? nav.onLine !== false : true,
      dns: { status: 'idle', classification: 'unknown', message: '', checkedAt: null },
      endpoints: { primary: 'unknown', backup: 'inactive', active: 'primary', reason: '' },
      session: { state: 'unknown', message: '' },
      updateAvailable: false,
      recovery: false,
    };

    function effectiveLocation() {
      const rawLocation = getLocation() || {};
      let loc = rawLocation;
      if (typeof rawLocation === 'string') {
        const detected = resolveDomain(rawLocation, {}).domain;
        loc = {
          hostname: detected.hostname,
          origin: detected.origin,
          protocol: detected.protocol,
          pathname: detected.pathname,
          basePath: detected.pathname || '/',
          href: detected.origin + detected.pathname,
        };
      }
      if (config.domain) {
        const explicitHost = String(config.domain).trim();
        const locHost = String(loc.hostname || '').trim().toLowerCase();
        const sameHost = locHost && locHost === explicitHost.toLowerCase();
        return {
          hostname: explicitHost,
          origin: sameHost ? loc.origin : undefined,
          protocol: loc.protocol || 'https:',
          pathname: loc.pathname || '/',
          basePath: loc.basePath || loc.pathname || '/',
        };
      }
      return {
        hostname: loc.hostname,
        origin: loc.origin,
        protocol: loc.protocol,
        pathname: loc.pathname,
        basePath: loc.basePath || loc.pathname || '/',
      };
    }

    function domainContext() {
      const loc = effectiveLocation();
      const fallback = {
        identity: { name: 'You.Ge Assistant', shortName: 'You.Ge', description: '' },
        branding: { themeColor: '#155eef', icon: 'icons/icon-192.png' },
        pwa: { basePath: '/' },
        project: null,
        domain: {
          hostname: loc.hostname || 'localhost',
          origin: loc.origin || 'https://localhost',
          protocol: loc.protocol || 'https:',
          pathname: loc.pathname || '/',
          basePath: '/',
          configured: false,
          matchedRegistryKey: null,
          projectId: null,
          validation: {
            valid: false,
            issues: [{ code: 'domain_resolution_failed', path: 'domain', message: 'Domain configuration could not be resolved safely.' }],
          },
        },
        features: { installation: true, diagnostics: true },
      };

      const explicitRegistry = config.domainRegistry || envIn.domainRegistry || rawOptionsState.domainRegistry || null;
      if (explicitRegistry) {
        try {
          return resolveDomain(loc, explicitRegistry) || fallback;
        } catch (error) {
          return fallback;
        }
      }

      const resolver = envIn.domainResolver || rawOptionsState.domainResolver || root.YouGeDomain || null;
      if (resolver && typeof resolver.resolve === 'function') {
        try {
          const resolved = resolver.resolve(loc);
          return resolved || fallback;
        } catch (error) {
          return fallback;
        }
      }

      try {
        const globalRegistry = root.YOU_GE_DOMAIN_REGISTRY && typeof root.YOU_GE_DOMAIN_REGISTRY === 'object'
          ? root.YOU_GE_DOMAIN_REGISTRY
          : {};
        return resolveDomain(loc, globalRegistry) || fallback;
      } catch (error) {
        return fallback;
      }
    }

    function projectInfo() {
      const domain = domainContext();
      const host = domain.domain || {};
      const basePath = domain.pwa && domain.pwa.basePath ? domain.pwa.basePath : (host.basePath || '/');
      const identity = domain.identity || {};
      const branding = domain.branding || {};
      const typedProjectId = config.project && config.project.id ? config.project.id : '';
      const legacyProjectId = config.projectId || '';
      const registryProjectId = (domain.project && domain.project.id) || host.projectId || '';
      const projectIdSource = typedProjectId
        ? 'project'
        : (legacyProjectId ? 'projectId' : (registryProjectId ? 'domainRegistry' : 'derived'));
      const id = typedProjectId || legacyProjectId || registryProjectId || String(host.hostname || 'localhost') + String(basePath);
      const loc = getLocation() || {};
      const validation = host.validation && typeof host.validation === 'object'
        ? { valid: host.validation.valid !== false, issues: Array.isArray(host.validation.issues) ? clone(host.validation.issues) : [] }
        : { valid: true, issues: [] };
      const baseHref = config.domain
        ? String(host.origin || 'https://localhost') + String(basePath)
        : (loc.href || String(host.origin || 'https://localhost') + '/');
      return {
        id: id,
        name: config.branding.name || identity.name || 'You.Ge Assistant',
        shortName: config.branding.shortName || identity.shortName || 'You.Ge',
        icon: safeSameOriginIcon(config.branding.icon || branding.icon, 'icons/icon-192.png', baseHref, UrlCtor),
        themeColor: config.branding.themeColor || branding.themeColor || '#155eef',
        hostname: String(host.hostname || 'localhost'),
        detectedHostname: detectRuntimeHostname(getLocation()) || String(host.hostname || 'localhost'),
        origin: String(host.origin || 'https://localhost'),
        basePath: String(basePath),
        configured: Boolean(host.configured),
        matchedRegistryKey: host.matchedRegistryKey || null,
        projectIdSource: projectIdSource,
        domainValidation: validation,
      };
    }

    function persistPublishedLkgIfDerivedProject() {
      if (configMeta.source === 'published' && !config.projectId && !(config.project && config.project.id) && rawOptionsState.publishedConfig) {
        const storage = getStorage();
        if (!storage) return;
        const derivedId = projectInfo().id;
        const validated = validatePublishedConfig(rawOptionsState.publishedConfig, { expectedProjectId: '' });
        if (validated.valid && !validated.projectId) {
          saveLastKnownGood(storage, derivedId, validated);
        }
      }
    }

    function storageKey(projectId) {
      return STORAGE_PREFIXES.notices + projectId;
    }

    function loadNotices(projectId) {
      noticeStore = { dismissed: {}, acknowledged: {} };
      const storage = getStorage();
      try {
        const raw = storage && typeof storage.getItem === 'function' ? storage.getItem(storageKey(projectId)) : null;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          noticeStore.dismissed = parsed.dismissed && typeof parsed.dismissed === 'object' ? parsed.dismissed : {};
          noticeStore.acknowledged = parsed.acknowledged && typeof parsed.acknowledged === 'object' ? parsed.acknowledged : {};
        }
      } catch (error) { /* storage unavailable */ }
    }

    function saveNotices(projectId) {
      const storage = getStorage();
      try {
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem(storageKey(projectId), JSON.stringify(noticeStore));
        }
      } catch (error) { /* storage unavailable */ }
    }

    function noticeKey(projectId, id) {
      return projectId + ':' + id;
    }

    function isSuppressed(projectId, id, critical) {
      const key = noticeKey(projectId, id);
      if (config.notifications.suppressRepeats && noticeStore.dismissed[key]) return true;
      if (critical && noticeStore.acknowledged[key]) return true;
      return false;
    }

    function endpointFailure(endpoints) {
      return endpoints.primary === 'failed' || endpoints.primary === 'unavailable' || endpoints.primary === 'degraded';
    }

    function buildNotifications(project, installation, network) {
      const out = [];
      const activeKeys = new Set();

      function add(notification, conditionKey) {
        activeKeys.add(conditionKey);
        if (isSuppressed(project.id, notification.id, notification.critical)) return;
        out.push(notification);
      }

      if (!network.online) {
        add({
          id: 'network:offline', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'No connection',
          message: 'The app cannot reach the network. Open diagnostics or recovery guidance.',
          actionId: 'diagnostics',
        }, 'network:offline');
      }
      if (dnsFailure(network.dns)) {
        add({
          id: 'dns:failure', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'DNS resolution problem',
          message: network.dns.message || 'The current hostname could not be resolved. Diagnostics are available.',
          actionId: 'diagnostics',
        }, 'dns:failure');
      }
      if (network.online && connectivityFailure(network.dns)) {
        add({
          id: 'network:unreachable', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'Connection problem',
          message: network.dns.message || 'The application host or its backend did not respond.',
          actionId: 'diagnostics',
        }, 'network:unreachable');
      }
      if (endpointFailure(network.endpoints)) {
        add({
          id: 'api:primary-failed', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: 'Primary API unavailable',
          message: network.endpoints.reason || 'The primary application endpoint is not responding.',
          actionId: 'diagnostics',
        }, 'api:primary-failed');
      }
      if (network.session.state === 'issue') {
        add({
          id: 'session:issue', priority: PRIORITY.auth, tone: TONE[PRIORITY.auth],
          critical: false, dismissible: true, title: 'Session needs attention',
          message: network.session.message || 'Your project reported an authentication or session problem.',
          actionId: 'help',
        }, 'session:issue');
      }
      if (network.endpoints.backup === 'active' || network.endpoints.active === 'backup') {
        add({
          id: 'api:backup-active', priority: PRIORITY.backup, tone: TONE[PRIORITY.backup],
          critical: false, dismissible: true, title: 'Backup connection active',
          message: network.endpoints.reason || 'This project is using its configured backup endpoint.',
          actionId: 'backup-status',
        }, 'api:backup-active');
      }
      if (installation.status === 'available' && installation.support !== 'none') {
        add({
          id: 'install:available', priority: PRIORITY.install, tone: TONE[PRIORITY.install],
          critical: false, dismissible: true, title: 'Installation available',
          message: installation.nativeAvailable
            ? 'This browser offered a native install prompt.'
            : (installation.support === 'manual-ios'
              ? 'Add this app to your home screen from Safari.'
              : 'Use your browser menu to install this app.'),
          actionId: 'install',
        }, 'install:available');
      }
      if (network.recovery) {
        add({
          id: 'api:primary-restored', priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: 'Primary connection restored',
          message: 'The primary endpoint is healthy again.', actionId: 'diagnostics',
        }, 'api:primary-restored');
      }
      if (network.updateAvailable) {
        add({
          id: 'app:update', priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: 'App update available',
          message: 'A new version is ready to apply.', actionId: 'update',
        }, 'app:update');
      }
      config.features.forEach(function (feature) {
        add({
          id: 'feature:' + feature.id, priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: feature.label,
          message: feature.message || 'A new You.Ge Assistant capability is available.',
          actionId: 'feature:' + feature.id,
        }, 'feature:' + feature.id);
      });

      lastConditionKeys.forEach(function (key) {
        if (activeKeys.has(key)) return;
        delete noticeStore.dismissed[noticeKey(project.id, key)];
        delete noticeStore.acknowledged[noticeKey(project.id, key)];
      });
      lastConditionKeys = activeKeys;
      saveNotices(project.id);

      out.sort(function (a, b) { return a.priority - b.priority; });
      out.forEach(function (notification) {
        notification.level = notificationLevel(notification.id, notification.priority);
      });
      return out;
    }

    function buildActions(project, installation, network, notifications) {
      const actions = [];
      function add(action) {
        if (actions.some(function (entry) { return entry.id === action.id; })) return;
        actions.push(action);
      }
      if (config.modules.diagnostics) {
        add({
          id: 'diagnostics', label: 'Run network diagnostics', icon: 'diagnostics',
          priority: notifications.some(function (n) { return n.critical; }) ? 1 : 5,
          kind: 'diagnostics', event: EVENT_NAMES.action, message: 'Check connectivity, DNS and app origin.',
        });
      }
      if (config.modules.recovery && (!network.online || dnsFailure(network.dns) ||
          connectivityFailure(network.dns) || endpointFailure(network.endpoints))) {
        add({
          id: 'recovery', label: 'Recovery guidance', icon: 'recovery', priority: 1,
          kind: 'recovery', event: EVENT_NAMES.action, message: 'Steps to restore this connection.',
        });
      }
      if (config.modules.installation && installation.status === 'available') {
        add({
          id: 'install', label: installation.nativeAvailable ? 'Install this app' : 'Installation instructions',
          icon: 'install', priority: 4, kind: 'install', event: EVENT_NAMES.action,
          message: installation.support === 'manual-ios' ? 'Safari: Share → Add to Home Screen.' : 'Open the browser install prompt or instructions.',
        });
      }
      if (config.modules.failover && (network.endpoints.backup === 'active' || network.endpoints.active === 'backup')) {
        add({
          id: 'backup-status', label: 'Backup connection', icon: 'backup', priority: 3,
          kind: 'backup', event: EVENT_NAMES.action, message: 'The project is using its backup endpoint.',
        });
      }
      if (config.modules.updates && network.updateAvailable) {
        add({
          id: 'update', label: 'Apply app update', icon: 'update', priority: 5,
          kind: 'update', event: EVENT_NAMES.action, message: 'Activate the waiting service worker update.',
        });
      }
      config.actions.forEach(function (action) { add(action); });
      actions.sort(function (a, b) { return a.priority - b.priority; });
      return actions;
    }

    function computeState() {
      const project = projectInfo();
      const pwaSnapshot = readPwaSnapshot(getPwa());
      const installation = deriveInstallationState({
        pwa: getPwa(),
        enabled: config.modules.installation,
      });
      const network = {
        online: conditions.online,
        dns: {
          status: conditions.dns.status,
          classification: conditions.dns.classification,
          message: conditions.dns.message,
          checkedAt: conditions.dns.checkedAt,
        },
        endpoints: {
          primary: conditions.endpoints.primary,
          backup: conditions.endpoints.backup,
          active: conditions.endpoints.active,
          reason: conditions.endpoints.reason,
        },
        session: { state: conditions.session.state, message: conditions.session.message },
        // The toolkit records a waiting worker in its own snapshot before (or
        // without) a `pwa:update` event, so seed from it: otherwise an update
        // detected before the assistant bound stays invisible forever.
        updateAvailable: conditions.updateAvailable || pwaSnapshot.hasUpdate === true,
        recovery: conditions.recovery,
      };
      const notifications = buildNotifications(project, installation, network);
      const availableActions = buildActions(project, installation, network, notifications);
      const top = notifications[0] || null;
      return {
        enabled: config.enabled,
        project: project,
        installation: installation,
        network: network,
        capabilities: {
          installation: config.modules.installation,
          diagnostics: config.modules.diagnostics,
          recovery: config.modules.recovery,
          failover: config.modules.failover,
          help: config.modules.help,
          updates: config.modules.updates,
          chromeHandoff: config.modules.chromeHandoff !== false,
        },
        notifications: notifications,
        availableActions: availableActions,
        badge: {
          count: notifications.length,
          tone: top ? top.tone : 'none',
          label: top ? top.title : 'No alerts',
          priority: top ? top.priority : null,
        },
        appearance: {
          position: config.position,
          offsets: { x: config.offsets.x, y: config.offsets.y },
          // `theme` keeps its original 0.x meaning: the mode string. The full
          // validated record travels in `themeConfig` so renderers can apply
          // custom tokens without a second configuration surface. No resolved
          // colours are published here: the renderer resolves them against the
          // live document so `auto` can follow the host.
          theme: config.themeMode || (config.theme && config.theme.mode) || 'auto',
          themeConfig: clone(config.theme || normalizeTheme('auto')),
          themeColor: project.themeColor,
        },
        dismissed: Object.keys(noticeStore.dismissed),
        acknowledged: Object.keys(noticeStore.acknowledged),
      };
    }

    function statesEqual(a, b) {
      if (a === b) return true;
      if (!a || !b) return false;
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch (error) {
        return false;
      }
    }

    function emit() {
      if (destroyed) return;
      const next = computeState();
      // Snapshot identity stability. A repeated emit of an unchanged state must
      // not churn listeners, React `useSyncExternalStore` consumers (which would
      // re-render forever) or `localStorage`. Conditions are still re-evaluated
      // above, so dismissal resets and persistence keep happening.
      if (snapshot && statesEqual(snapshot, next)) return;
      snapshot = next;
      const doc = getDoc();
      if (shouldBindEvents && exposeGlobal) {
        try {
          if (doc && typeof doc.dispatchEvent === 'function' && root.CustomEvent) {
            doc.dispatchEvent(new root.CustomEvent(EVENT_NAMES.state, { detail: snapshot }));
          }
        } catch (error) { /* ignore */ }
      }
      listeners.forEach(function (listener) {
        try { listener(snapshot); } catch (error) { /* keep other listeners alive */ }
      });
    }

    function syncPwaSubscription() {
      if (unsubscribePwa || destroyed) return;
      const pwa = getPwa();
      if (pwa && typeof pwa.onChange === 'function') {
        try {
          unsubscribePwa = pwa.onChange(function () { emit(); });
        } catch (error) {
          unsubscribePwa = null;
        }
      }
    }

    const diagnosticsController = createDiagnosticsIntegration({
      get services() { return services; },
      getPwa: getPwa,
      getDns: getDns,
      getContext: function () {
        const project = projectInfo();
        return {
          hostname: project.hostname,
          origin: project.origin,
          basePath: project.basePath,
          online: conditions.online,
        };
      },
      onStart: function () {
        conditions.dns.status = 'running';
        emit();
      },
      onResult: function (result) {
        setDnsResult(result);
      },
    });

    function configure(nextOptions) {
      if (destroyed) return snapshot;
      const baseGlobal = useGlobalConfig && root.YOU_GE_ASSISTANT_CONFIG && typeof root.YOU_GE_ASSISTANT_CONFIG === 'object'
        ? root.YOU_GE_ASSISTANT_CONFIG
        : {};
      const merged = Object.assign({}, baseGlobal, rawOptionsState, nextOptions || {});
      if (services.diagnostics && !(merged.services && typeof merged.services.diagnostics === 'function')) {
        merged.services = Object.assign({}, merged.services || {}, { diagnostics: services.diagnostics });
      }
      rawOptionsState = merged;
      resolvedBundle = resolveAssistantConfig(merged, {
        storage: getStorage(),
        fallbackProjectId: snapshot && snapshot.project ? snapshot.project.id : '',
      });
      config = resolvedBundle.config;
      configMeta = resolvedBundle.meta;
      services = config.services;
      persistPublishedLkgIfDerivedProject();
      loadNotices(projectInfo().id);
      syncPwaSubscription();
      emit();
      return snapshot;
    }

    function getConfig() {
      return {
        enabled: config.enabled,
        project: clone(config.project),
        projectId: config.projectId,
        domain: config.domain,
        position: config.position,
        offsets: { x: config.offsets.x, y: config.offsets.y },
        modules: clone(config.modules),
        notifications: clone(config.notifications),
        branding: clone(config.branding),
        actions: clone(config.actions),
        features: clone(config.features),
        // Backward compatible string (0.x contract) plus the validated record.
        theme: config.themeMode || (config.theme && config.theme.mode) || 'auto',
        themeConfig: clone(config.theme || normalizeTheme('auto')),
        meta: clone(configMeta),
      };
    }

    function subscribe(listener, subOptions) {
      if (typeof listener !== 'function' || destroyed) return function () {};
      listeners.add(listener);
      listenerCounts.set(listener, (listenerCounts.get(listener) || 0) + 1);
      if (!subOptions || subOptions.immediate !== false) {
        try { listener(snapshot); } catch (error) { /* ignore */ }
      }
      let active = true;
      // Reference-counted: the same listener may be subscribed by several
      // components/widgets, and unsubscribing one must not silence the others.
      return function () {
        if (!active) return;
        active = false;
        const remaining = (listenerCounts.get(listener) || 0) - 1;
        if (remaining > 0) {
          listenerCounts.set(listener, remaining);
          return;
        }
        listenerCounts.delete(listener);
        listeners.delete(listener);
      };
    }

    function setConnectivity(online) {
      conditions.online = Boolean(online);
      emit();
      return snapshot;
    }

    function setEndpointStatus(detail) {
      const input = detail && typeof detail === 'object' ? detail : {};
      const allowedPrimary = ['unknown', 'healthy', 'failed', 'unavailable', 'degraded'];
      const allowedBackup = ['unknown', 'active', 'inactive', 'failed'];
      const allowedActive = ['primary', 'backup', 'unknown'];
      const previousActive = conditions.endpoints.active;
      if (allowedPrimary.indexOf(input.primary) !== -1) conditions.endpoints.primary = input.primary;
      if (allowedBackup.indexOf(input.backup) !== -1) conditions.endpoints.backup = input.backup;
      if (allowedActive.indexOf(input.active) !== -1) conditions.endpoints.active = input.active;
      conditions.endpoints.reason = safeText(input.reason, 200);
      if (previousActive === 'backup' && conditions.endpoints.active === 'primary' && conditions.endpoints.primary === 'healthy') {
        conditions.recovery = true;
      }
      if (conditions.endpoints.active !== 'primary') conditions.recovery = false;
      emit();
      return snapshot;
    }

    function setSessionStatus(detail) {
      const input = detail && typeof detail === 'object' ? detail : {};
      if (['unknown', 'ok', 'issue'].indexOf(input.state) !== -1) conditions.session.state = input.state;
      conditions.session.message = safeText(input.message, 200);
      emit();
      return snapshot;
    }

    function setDnsResult(result) {
      conditions.dns = normalizeDnsResult(result, DateCtor);
      emit();
      return snapshot;
    }

    function setUpdateAvailable(available) {
      conditions.updateAvailable = available !== false;
      emit();
      return snapshot;
    }

    function runDiagnostics(runOptions) {
      if (destroyed) {
        return Promise.resolve({ classification: 'unknown', message: 'Assistant instance is destroyed.', status: 'unavailable' });
      }
      if (!config.modules.diagnostics) {
        const disabled = { classification: 'disabled', message: 'Network diagnostics are disabled for this project.', status: 'disabled' };
        setDnsResult(disabled);
        return Promise.resolve(disabled);
      }
      return diagnosticsController.run(runOptions);
    }

    function requestInstall(promptOptions) {
      if (destroyed) return Promise.resolve({ outcome: 'unsupported' });
      return requestPwaInstall({
        pwa: getPwa(),
        enabled: config.modules.installation,
      }, promptOptions);
    }

    function dismiss(id) {
      const safeId = safeText(id, 80);
      const notification = (snapshot && snapshot.notifications || []).filter(function (entry) { return entry.id === safeId; })[0];
      if (!notification) return false;
      if (notification.critical && config.notifications.criticalPersistent) return false;
      noticeStore.dismissed[noticeKey(snapshot.project.id, safeId)] = new DateCtor().toISOString();
      saveNotices(snapshot.project.id);
      emit();
      return true;
    }

    function acknowledge(id) {
      const safeId = safeText(id, 80);
      noticeStore.acknowledged[noticeKey(snapshot.project.id, safeId)] = new DateCtor().toISOString();
      saveNotices(snapshot.project.id);
      emit();
      return true;
    }

    const handlers = {
      online: function () { conditions.online = true; emit(); },
      offline: function () { conditions.online = false; emit(); },
      visibility: function () {
        const doc = getDoc();
        if (doc && doc.visibilityState === 'hidden') return;
        syncPwaSubscription();
        emit();
      },
      endpoint: function (event) { setEndpointStatus(event && event.detail); },
      session: function (event) { setSessionStatus(event && event.detail); },
      dns: function (event) { setDnsResult((event && event.detail) || {}); },
      pwaReady: function () { syncPwaSubscription(); emit(); },
      installable: function () { syncPwaSubscription(); emit(); },
      installed: function () { syncPwaSubscription(); emit(); },
      update: function () { conditions.updateAvailable = true; emit(); },
      diagnostics: function (event) { setDnsResult((event && event.detail) || {}); },
      action: function () { /* widgets dispatch actions; host apps listen. No state change. */ },
      storage: function (event) {
        if (!event || !event.key || event.key.indexOf(STORAGE_PREFIXES.notices) !== 0) return;
        loadNotices(snapshot ? snapshot.project.id : projectInfo().id);
        emit();
      },
    };

    function bindOnce() {
      if (bound || !shouldBindEvents) return;
      bound = true;
      const doc = getDoc();
      if (typeof root.addEventListener === 'function') {
        root.addEventListener('online', handlers.online);
        root.addEventListener('offline', handlers.offline);
        root.addEventListener('storage', handlers.storage);
      }
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', handlers.visibility);
        doc.addEventListener(EVENT_NAMES.endpointStatus, handlers.endpoint);
        doc.addEventListener(EVENT_NAMES.sessionStatus, handlers.session);
        doc.addEventListener(EVENT_NAMES.dnsResult, handlers.dns);
        doc.addEventListener(EVENT_NAMES.pwaReady, handlers.pwaReady);
        doc.addEventListener(EVENT_NAMES.pwaInstallable, handlers.installable);
        doc.addEventListener(EVENT_NAMES.pwaInstalled, handlers.installed);
        doc.addEventListener(EVENT_NAMES.pwaUpdate, handlers.update);
        doc.addEventListener(EVENT_NAMES.pwaDiagnostics, handlers.diagnostics);
        doc.addEventListener(EVENT_NAMES.action, handlers.action);
      }
      syncPwaSubscription();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      const doc = getDoc();
      if (bound) {
        if (typeof root.removeEventListener === 'function') {
          root.removeEventListener('online', handlers.online);
          root.removeEventListener('offline', handlers.offline);
          root.removeEventListener('storage', handlers.storage);
        }
        if (doc && typeof doc.removeEventListener === 'function') {
          doc.removeEventListener('visibilitychange', handlers.visibility);
          doc.removeEventListener(EVENT_NAMES.endpointStatus, handlers.endpoint);
          doc.removeEventListener(EVENT_NAMES.sessionStatus, handlers.session);
          doc.removeEventListener(EVENT_NAMES.dnsResult, handlers.dns);
          doc.removeEventListener(EVENT_NAMES.pwaReady, handlers.pwaReady);
          doc.removeEventListener(EVENT_NAMES.pwaInstallable, handlers.installable);
          doc.removeEventListener(EVENT_NAMES.pwaInstalled, handlers.installed);
          doc.removeEventListener(EVENT_NAMES.pwaUpdate, handlers.update);
          doc.removeEventListener(EVENT_NAMES.pwaDiagnostics, handlers.diagnostics);
          doc.removeEventListener(EVENT_NAMES.action, handlers.action);
        }
      }
      if (unsubscribePwa) {
        try { unsubscribePwa(); } catch (error) { /* ignore */ }
        unsubscribePwa = null;
      }
      listeners.clear();
      listenerCounts.clear();
      diagnosticsController.clear();
    }

    const api = {
      __state: true,
      version: SDK_VERSION,
      PRIORITY: PRIORITY,
      create: function (opts, envOpts) { return createAssistant(opts, envOpts); },
      attach: function (opts, envOpts) { return attachAssistant(opts, envOpts); },
      configure: configure,
      getConfig: getConfig,
      getState: function () { return snapshot; },
      subscribe: subscribe,
      setConnectivity: setConnectivity,
      setEndpointStatus: setEndpointStatus,
      setSessionStatus: setSessionStatus,
      setDnsResult: setDnsResult,
      setUpdateAvailable: setUpdateAvailable,
      runDiagnostics: runDiagnostics,
      requestInstall: requestInstall,
      dismiss: dismiss,
      acknowledge: acknowledge,
      isDestroyed: function () { return destroyed; },
      destroy: destroy,
    };

    persistPublishedLkgIfDerivedProject();
    loadNotices(projectInfo().id);
    bindOnce();
    if (!snapshot) emit();

    if (exposeGlobal) {
      root.YouGeAssistant = api;
    }

    return api;
  }
  function getGlobalAssistant(targetRoot) {
    const root = targetRoot || (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!root || !root.YouGeAssistant || !root.YouGeAssistant.__state) return null;
    if (typeof root.YouGeAssistant.isDestroyed === 'function' && root.YouGeAssistant.isDestroyed()) return null;
    return root.YouGeAssistant;
  }
  function attachAssistant(options, envOverrides) {
    const envIn = envOverrides && typeof envOverrides === 'object' ? envOverrides : {};
    const root = envIn.root || envIn.window || (options && options.window) || (typeof globalThis !== 'undefined' ? globalThis : {});
    const existing = getGlobalAssistant(root);
    if (existing) {
      if (!existing.create) existing.create = createAssistant;
      if (!existing.attach) existing.attach = attachAssistant;
      if (!existing.version) existing.version = SDK_VERSION;
      if (options && typeof options === 'object' && Object.keys(options).length > 0 && typeof existing.configure === 'function') {
        existing.configure(options);
      }
      return existing;
    }
    return createAssistant(options, Object.assign({}, envIn, {
      root: root,
      useGlobalConfig: envIn.useGlobalConfig !== false,
      exposeGlobal: true,
    }));
  }

  var api = attachAssistant(root.YOU_GE_ASSISTANT_CONFIG || {}, {
    root: root,
    useGlobalConfig: true,
  });

  root.YouGeAssistantSDK = {
    version: SDK_VERSION,
    kitCompatVersion: KIT_COMPAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    PRIORITY: PRIORITY,
    EVENT_NAMES: EVENT_NAMES,
    create: createAssistant,
    attach: attachAssistant,
    getGlobal: getGlobalAssistant,
    resolveDomain: resolveDomain,
    detectRuntimeHostname: detectRuntimeHostname,
    buildManifest: buildManifest,
    validateDomainConfig: validateDomainConfig,
    validateDomainConfigDetailed: validateDomainConfigDetailed,
    validateDomainRegistry: validateDomainRegistry,
    domain: createDomainResolver(root.YOU_GE_DOMAIN_REGISTRY || {}),
    validatePublishedConfig: validatePublishedConfig,
    // Adaptive theming — same validation/resolution in classic and ESM pages.
    THEME_MODES: THEME_MODES,
    THEME_TOKEN_KEYS: THEME_TOKEN_KEYS,
    NOTIFICATION_LEVELS: NOTIFICATION_LEVELS,
    NOTIFICATION_LEVEL_ICONS: NOTIFICATION_LEVEL_ICONS,
    NOTIFICATION_LEVEL_SHAPES: NOTIFICATION_LEVEL_SHAPES,
    NOTIFICATION_LEVEL_SVG_ATTRIBUTES: NOTIFICATION_LEVEL_SVG_ATTRIBUTES,
    notificationLevelMarkup: notificationLevelMarkup,
    normalizeNotificationLevel: normalizeNotificationLevel,
    NOTIFICATION_LEVEL_LABELS: NOTIFICATION_LEVEL_LABELS,
    normalizeTheme: normalizeTheme,
    resolveTheme: resolveTheme,
    detectHostScheme: detectHostScheme,
    contrastRatio: contrastRatio,
    detectInAppBrowser: detectInAppBrowser,
    isChromeHandoffCandidate: isChromeHandoffCandidate,
    buildChromeIntentUrl: buildChromeIntentUrl,
    chromeHandoffInstructions: chromeHandoffInstructions,
    createChromeHandoff: createChromeHandoff,
  };

  root.YouGeAssistant = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
