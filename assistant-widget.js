/*!
 * assistant-widget.js — dependency-free You.Ge Assistant floating widget
 * ---------------------------------------------------------------------
 * A thin renderer over window.YouGeAssistant (assistant-state.js). It owns no
 * state of its own beyond "panel open/closed", never polls, never calls fetch(),
 * never registers a service worker, and never auto-opens. All user-visible
 * conditions come from the centralized state model.
 *
 * Load with `defer` after assistant-state.js. Configure via
 * window.YOU_GE_ASSISTANT_CONFIG before assistant-state.js executes.
 */
(function (root) {
  'use strict';

  if (root.YouGeAssistantWidget && root.YouGeAssistantWidget.__mounted) return;
  var doc = root.document;
  if (!doc || !root.YouGeAssistant || typeof root.YouGeAssistant.subscribe !== 'function') return;

  var api = root.YouGeAssistant;
  var ROOT_ID = 'youge-assistant-root';
  var PANEL_ID = 'youge-assistant-panel';
  var ICONS = {
    assistant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-4.4 0-8 3.1-8 7v4.5c0 1.1-.4 2.1-1.2 2.9L2 19h4.2c1 1.2 2.6 2 4.8 2 1.4 0 2.6-.3 3.6-.8"/><path d="M20 13V10c0-3.9-3.6-7-8-7"/><circle cx="12" cy="10" r="1.2" fill="currentColor" stroke="none"/><path d="M8 14h8"/><path d="M18 16.5v4M16 18.5h4"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v8M8.5 11.5L12 15l3.5-3.5"/></svg>',
    diagnostics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3l2-6 4 12 2-6h4"/><circle cx="21" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
    recovery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/></svg>',
    backup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    update: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8.5 11.5L12 15l3.5-3.5"/><path d="M5 19h14"/></svg>',
    custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    // Notification levels. One icon per level, so severity is never carried by
    // colour alone: shape differs too.
    'level-critical': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8.6 3h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6z"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".9" fill="currentColor" stroke="none"/></svg>',
    'level-error': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.5" r=".9" fill="currentColor" stroke="none"/></svg>',
    'level-warning': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2 22 20.4H2z"/><path d="M12 9.5v4.6"/><circle cx="12" cy="17.4" r=".9" fill="currentColor" stroke="none"/></svg>',
    'level-info': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r=".9" fill="currentColor" stroke="none"/></svg>',
    'level-success': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m7.8 12.3 2.9 2.9 5.6-6"/></svg>',
  };

  // Mirrors the SDK's accepted appearance values so a hand-built state object
  // cannot push an unsupported value into the widget's attributes.
  var POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  // Mirrors the SDK (0.x string modes plus the adaptive `custom` mode).
  var THEMES = ['auto', 'light', 'dark', 'custom'];

  // Fallback wording for notice actions that no project action list provides.
  var NOTICE_ACTION_LABELS = {
    install: 'Installation instructions',
    diagnostics: 'Run network diagnostics',
    recovery: 'Recovery guidance',
    help: 'Get help',
    'backup-status': 'Backup status',
    update: 'Apply app update',
  };

  // Toolkit hooks delegated by pwa.js. Without the matching attribute a notice
  // button would only dispatch `youge:action` and appear dead on pages that
  // rely on the toolkit's own install/diagnostics handling.
  var NOTICE_ACTION_HOOKS = {
    install: 'data-pwa-install',
    diagnostics: 'data-pwa-diagnostics',
  };

  var mount = null;
  var fab = null;
  var badge = null;
  var live = null;
  var panel = null;
  var panelBody = null;
  var closeButton = null;
  var isOpen = false;
  var unsubscribe = null;
  var closeTimer = null;
  var lastLiveLabel = '';
  var lastBadge = '';
  var chromeOffer = null;
  var chromeOfferEl = null;
  var chromeFallbackEl = null;
  var chromeUrlEl = null;
  var chromeStepsEl = null;
  var chromeStatusEl = null;
  var chromeInstructions = null;
  var chromeSuppressed = false;
  // Resolved theme state, so a re-render on every state emission does not
  // re-read host styles or re-write identical custom properties.
  var themeApplied = null;
  var themeSignature = '';
  var themeMedia = null;

  // Manual icon adjustments (size / horizontal / vertical) persist per
  // origin so they survive page reloads and PWA restarts. `{}` means fully
  // automatic: the responsive CSS tiers own the launcher.
  var FAB_ADJUST_KEY = 'youge-assistant:fab-adjust';
  var manualAdjust = loadManualAdjust();

  function readStorage(key) {
    try {
      return root.localStorage ? root.localStorage.getItem(key) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      var storage = root.localStorage;
      if (!storage) return;
      if (value == null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch (error) { /* storage unavailable: adjustments stay in-memory */ }
  }

  function clampAdjustSize(value) {
    var number = Number(value);
    if (!isFinite(number)) return null;
    return Math.min(72, Math.max(44, Math.round(number)));
  }

  function clampAdjustOffset(value) {
    var number = Number(value);
    if (!isFinite(number)) return null;
    return Math.min(160, Math.max(0, Math.round(number)));
  }

  function loadManualAdjust() {
    var raw = readStorage(FAB_ADJUST_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      var out = {};
      if (parsed && typeof parsed === 'object') {
        if (parsed.size != null) {
          var size = clampAdjustSize(parsed.size);
          if (size != null) out.size = size;
        }
        if (parsed.x != null) {
          var x = clampAdjustOffset(parsed.x);
          if (x != null) out.x = x;
        }
        if (parsed.y != null) {
          var y = clampAdjustOffset(parsed.y);
          if (y != null) out.y = y;
        }
      }
      return out;
    } catch (error) {
      return {};
    }
  }

  function saveManualAdjust() {
    var has =
      manualAdjust &&
      (manualAdjust.size != null || manualAdjust.x != null || manualAdjust.y != null);
    writeStorage(FAB_ADJUST_KEY, has ? JSON.stringify(manualAdjust) : null);
  }

  function clearStyleProp(node, name) {
    if (!node || !node.style) return;
    if (typeof node.style.removeProperty === 'function') node.style.removeProperty(name);
    else if (node.style[name] !== undefined) node.style[name] = '';
  }

  function autoFabSize() {
    try {
      if (fab && typeof fab.getBoundingClientRect === 'function') {
        var rect = fab.getBoundingClientRect();
        if (rect && rect.width) return Math.round(rect.width);
      }
    } catch (error) { /* fall through to the default */ }
    return 56;
  }

  function effectiveSize() {
    return manualAdjust && manualAdjust.size != null ? manualAdjust.size : autoFabSize();
  }

  function effectiveOffset(axis) {
    var fallback = 20; // matches the configured default offset on both axes
    if (manualAdjust && manualAdjust[axis] != null) return manualAdjust[axis];
    try {
      var state = api.getState();
      var offsets = state && state.appearance && state.appearance.offsets;
      if (offsets && isFinite(Number(offsets[axis]))) return Number(offsets[axis]);
    } catch (error) { /* use the default */ }
    return fallback;
  }

  // Applies the manual size as inline styles (they win over every responsive
  // media tier) and mirrors it into --youge-fab-size so the panel and the
  // Chrome offer always clear the launcher at its real size.
  function applyFabAdjust() {
    if (!fab || !mount) return;
    var hasSize = manualAdjust && manualAdjust.size != null;
    if (hasSize) {
      var size = manualAdjust.size + 'px';
      fab.style.width = size;
      fab.style.height = size;
      var glyph = Math.max(18, Math.round(manualAdjust.size * 0.46)) + 'px';
      fab.style.setProperty('--youge-fab-glyph', glyph);
      mount.style.setProperty('--youge-fab-size', size);
    } else {
      fab.style.width = '';
      fab.style.height = '';
      clearStyleProp(fab, '--youge-fab-glyph');
      clearStyleProp(mount, '--youge-fab-size');
    }
  }

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function icon(name) {
    var span = el('span', 'youge-icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = ICONS[name] || ICONS.custom; // fixed local map only
    return span;
  }

  function button(label, iconName, className) {
    var node = el('button', className || 'youge-btn');
    node.type = 'button';
    node.appendChild(icon(iconName || 'custom'));
    node.appendChild(el('span', 'youge-btn-label', label));
    return node;
  }

  function statusRow(label, value, tone) {
    var row = el('div', 'youge-status-row');
    row.appendChild(el('span', 'youge-status-label', label));
    var valueWrap = el('span', 'youge-status-value');
    var dot = el('span', 'youge-status-dot');
    dot.setAttribute('data-tone', tone || 'neutral');
    dot.setAttribute('aria-hidden', 'true');
    valueWrap.appendChild(dot);
    valueWrap.appendChild(el('span', '', value));
    row.appendChild(valueWrap);
    return row;
  }

  function section(title, description) {
    var wrap = el('section', 'youge-section');
    wrap.appendChild(el('h3', 'youge-section-title', title));
    if (description) wrap.appendChild(el('p', 'youge-section-desc', description));
    return wrap;
  }

  // Appearance values reach us through a state object a host may have built
  // itself, so they are re-validated here: a non-numeric offset would otherwise
  // be written as `undefinedpx`, and an arbitrary color string would be
  // injected straight into the widget's style property.
  function offsetPx(value, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback + 'px';
    return Math.min(160, Math.max(0, Math.round(number))) + 'px';
  }

  /* ---------------------------------------------------------------- *
   * Adaptive theming.                                               *
   *                                                                 *
   * The SDK owns validation (`YouGeAssistantSDK.normalizeTheme`) and *
   * resolution (`resolveTheme`): the widget only applies the result. *
   * That keeps classic <script> pages, the ESM SDK and the React     *
   * example on one implementation, and keeps this file a renderer.  *
   * ---------------------------------------------------------------- */

  function themeApi() {
    var sdk = root.YouGeAssistantSDK;
    return sdk && typeof sdk.resolveTheme === 'function' ? sdk : null;
  }

  // Fallback for a host that replaced window.YouGeAssistant with its own
  // hand-built state object: the SDK helpers may not be reachable, but the
  // documented subset of the theme record still has to render.
  function themeFromAppearance(appearance) {
    var config = appearance.themeConfig;
    var mode = THEMES.indexOf(appearance.theme) !== -1 ? appearance.theme : 'auto';
    if (config && typeof config === 'object' && !Array.isArray(config)) {
      return {
        mode: THEMES.indexOf(config.mode) !== -1 ? config.mode : mode,
        inheritHost: config.inheritHost === true,
        tokens: config.tokens && typeof config.tokens === 'object' ? config.tokens : {},
        host: config.host && typeof config.host === 'object' ? config.host : {},
        variables: config.variables && typeof config.variables === 'object' ? config.variables : {},
      };
    }
    return { mode: mode, inheritHost: false, tokens: {}, host: {}, variables: {} };
  }

  var HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  function resolveThemeFor(appearance) {
    var theme = themeFromAppearance(appearance);
    var sdk = themeApi();
    if (!sdk) return null;
    try {
      return sdk.resolveTheme(theme, {
        document: doc,
        root: root,
        matchMedia: root.matchMedia || null,
        // `branding.themeColor` stays supported as the project's primary colour;
        // an explicit theme token or host value still wins inside resolveTheme.
        seedPrimary: HEX_COLOR.test(String(appearance.themeColor || '')) ? appearance.themeColor : null,
      });
    } catch (error) {
      return null;
    }
  }

  // Writes resolved variables to the root. Inline custom properties outrank
  // every stylesheet rule, which is why custom mode and host adaptation work
  // without a second cascade. Only `--youge-*` names are ever written.
  function applyThemeVariables(resolved) {
    if (!mount || !mount.style || !resolved) return;
    var next = resolved.variables || {};
    var previous = themeApplied || {};
    Object.keys(previous).forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(next, name)) clearStyleProp(mount, name);
    });
    Object.keys(next).forEach(function (name) {
      if (!/^--youge-[a-z0-9-]+$/.test(name)) return;
      mount.style.setProperty(name, String(next[name]));
    });
    themeApplied = next;
  }

  // `auto` must follow the host when it flips its own scheme (theme switcher,
  // OS appearance change). A single media listener covers the OS case; the
  // host attribute/class case is re-checked on every state emission.
  function watchScheme() {
    if (themeMedia || !themeApi() || typeof root.matchMedia !== 'function') return;
    try {
      themeMedia = root.matchMedia('(prefers-color-scheme: dark)');
      if (!themeMedia) return;
      var onChange = function () { applyAppearance(api.getState()); };
      if (typeof themeMedia.addEventListener === 'function') themeMedia.addEventListener('change', onChange);
      else if (typeof themeMedia.addListener === 'function') themeMedia.addListener(onChange);
    } catch (error) {
      themeMedia = null;
    }
  }

  function applyTheme(appearance) {
    var resolved = resolveThemeFor(appearance);
    var mode = resolved ? resolved.mode : (THEMES.indexOf(appearance.theme) !== -1 ? appearance.theme : 'auto');
    mount.setAttribute('data-theme', mode);
    if (!resolved) {
      // No SDK resolver (hand-built host state): clear anything a previous
      // theme wrote so the stylesheet defaults apply again.
      applyThemeVariables({ variables: {} });
      mount.removeAttribute('data-scheme');
      mount.removeAttribute('data-theme-inherit');
      themeSignature = '';
      return;
    }
    mount.setAttribute('data-scheme', resolved.scheme === 'dark' ? 'dark' : 'light');
    if (resolved.inheritHost) mount.setAttribute('data-theme-inherit', '');
    else mount.removeAttribute('data-theme-inherit');
    var signature = JSON.stringify([resolved.mode, resolved.scheme, resolved.variables]);
    if (signature === themeSignature) return;
    themeSignature = signature;
    applyThemeVariables(resolved);
    watchScheme();
  }

  function applyAppearance(state) {
    if (!mount || !state) return;
    var appearance = state.appearance || {};
    var offsets = appearance.offsets || {};
    mount.setAttribute('data-position', POSITIONS.indexOf(appearance.position) !== -1 ? appearance.position : 'bottom-right');
    applyTheme(appearance);
    // A manual horizontal/vertical adjustment (set by the user in the panel)
    // wins over the configured offsets until it is reset to automatic.
    var manualX = manualAdjust && manualAdjust.x != null;
    var manualY = manualAdjust && manualAdjust.y != null;
    mount.style.setProperty('--youge-offset-x', manualX ? manualAdjust.x + 'px' : offsetPx(offsets.x, 20));
    mount.style.setProperty('--youge-offset-y', manualY ? manualAdjust.y + 'px' : offsetPx(offsets.y, 20));
    // Only a plain hex color may set the brand token, and only when the SDK
    // resolver is unavailable (a hand-built host state). With a resolver the
    // colour travels through `seedPrimary` and is validated and contrast-checked
    // there, so an arbitrary string can never reach the style property.
    var themed = themeApplied && Object.prototype.hasOwnProperty.call(themeApplied, '--youge-brand');
    if (!themed && HEX_COLOR.test(String(appearance.themeColor || ''))) {
      mount.style.setProperty('--youge-brand', appearance.themeColor);
    }
    mount.hidden = state.enabled === false;
  }

  function updateFab(state) {
    if (!fab || !badge || !state) return;
    var badgeState = state.badge || { count: 0, tone: 'none', label: 'No alerts' };
    var count = badgeState.count || 0;
    var tone = badgeState.tone || 'none';
    var label = state.project && state.project.name ? state.project.name : 'You.Ge Assistant';
    var accessible = label + ' assistant';
    if (count) accessible += ', ' + count + (count === 1 ? ' alert' : ' alerts') + ', highest priority: ' + badgeState.label;
    else accessible += ', no alerts';
    fab.setAttribute('aria-label', accessible);
    fab.setAttribute('data-tone', tone);
    var badgeText = count > 9 ? '9+' : String(count);
    if (badgeText !== lastBadge || tone !== badge.getAttribute('data-tone')) {
      lastBadge = badgeText;
      badge.textContent = badgeText;
      badge.setAttribute('data-tone', tone);
      badge.hidden = count === 0;
    }
    var liveText = count
      ? label + ': ' + count + (count === 1 ? ' alert' : ' alerts') + '. Highest priority: ' + badgeState.label + '.'
      : label + ': no alerts.';
    if (live && liveText !== lastLiveLabel) {
      live.textContent = liveText;
      lastLiveLabel = liveText;
    }
  }

  function installationText(installation) {
    if (!installation) return 'Installation status unavailable.';
    if (installation.installed) return 'This app is already installed. No install suggestion is needed.';
    if (installation.support === 'none') return 'Installation is unavailable for this project or browser.';
    if (installation.support === 'manual-ios') return 'iPhone/iPad: open Share in Safari, then choose Add to Home Screen.';
    if (installation.support === 'native') return 'This browser offers a native install prompt. Use the install action below.';
    return 'Desktop/mobile: open your browser menu and choose Install app, or Add to Home Screen.';
  }

  function networkText(state) {
    var network = state.network || {};
    var endpoints = network.endpoints || {};
    var dns = network.dns || {};
    return {
      online: network.online === false ? 'Offline' : 'Online',
      primary: endpoints.primary || 'unknown',
      backup: endpoints.backup || 'inactive',
      dns: dns.classification ? String(dns.classification).replace(/_/g, ' ') : 'not checked',
    };
  }

  function noticeAction(notice, actions) {
    for (var i = 0; i < actions.length; i += 1) {
      if (actions[i] && actions[i].id === notice.actionId) return actions[i];
    }
    return null;
  }

  // Presentation-only severity. The SDK publishes `level`; older or
  // hand-built state objects fall back to the priority ladder here so the same
  // five tiers always render.
  var LEVELS = ['critical', 'error', 'warning', 'info', 'success'];
  var PRIORITY_LEVEL = { 1: 'critical', 2: 'warning', 3: 'info', 4: 'success', 5: 'info' };

  function noticeLevel(notice) {
    if (LEVELS.indexOf(notice.level) !== -1) return notice.level;
    var mapped = PRIORITY_LEVEL[notice.priority];
    return mapped || 'info';
  }

  // The SDK publishes the exact glyph markup per level so the DOM widget and the
  // React example cannot drift. The local map is the fallback for a page that
  // loads the widget without the SDK metadata (and keeps the markup static).
  function levelGlyph(level) {
    var sdk = root.YouGeAssistantSDK;
    var map = sdk && sdk.NOTIFICATION_LEVEL_ICONS;
    if (map && typeof map[level] === 'string') return map[level];
    var local = ICONS['level-' + level] || ICONS['level-info'];
    var inner = /^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(local);
    return inner ? inner[1] : '';
  }

  function noticeIcon(level) {
    var span = el('span', 'youge-notice-icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + levelGlyph(level) + '</svg>';
    return span;
  }

  function renderNotice(notice, actions) {
    var article = el('article', 'youge-notice');
    var level = noticeLevel(notice);
    article.setAttribute('data-priority', String(notice.priority));
    article.setAttribute('data-tone', notice.tone || 'info');
    article.setAttribute('data-level', level);
    article.appendChild(noticeIcon(level));
    var content = el('div', 'youge-notice-content');
    content.appendChild(el('h4', 'youge-notice-title', notice.title));
    content.appendChild(el('p', 'youge-notice-message', notice.message));
    var controls = el('div', 'youge-notice-controls');
    if (notice.actionId) {
      var linked = noticeAction(notice, actions || []);
      var action = button(
        (linked && linked.label) || NOTICE_ACTION_LABELS[notice.actionId] || 'Open',
        (linked && linked.icon) || 'custom',
        'youge-btn youge-btn-small'
      );
      action.setAttribute('data-action', notice.actionId);
      // Reuse the toolkit's own delegated handlers so this button actually
      // performs the action instead of only announcing it on the document.
      if (NOTICE_ACTION_HOOKS[notice.actionId]) action.setAttribute(NOTICE_ACTION_HOOKS[notice.actionId], '');
      controls.appendChild(action);
    }
    if (notice.critical) {
      var ack = button('Acknowledge', 'recovery', 'youge-btn youge-btn-quiet youge-btn-small');
      ack.setAttribute('data-acknowledge', notice.id);
      controls.appendChild(ack);
    } else if (notice.dismissible !== false) {
      var dismiss = button('Dismiss', 'close', 'youge-btn youge-btn-quiet youge-btn-small');
      dismiss.setAttribute('data-dismiss', notice.id);
      controls.appendChild(dismiss);
    }
    content.appendChild(controls);
    article.appendChild(content);
    return article;
  }

  function renderPanel(state) {
    if (!panelBody || !state) return;
    var active = doc.activeElement;
    var focusKey = active && active.getAttribute
      ? (active.getAttribute('data-action') || active.getAttribute('data-dismiss') ||
         active.getAttribute('data-acknowledge') || active.getAttribute('data-adjust') ||
         (active === closeButton ? 'close' : ''))
      : '';
    while (panelBody.firstChild) panelBody.removeChild(panelBody.firstChild);

    // Identity / branding
    var identity = el('div', 'youge-identity');
    var brandIcon = doc.createElement('img');
    brandIcon.className = 'youge-brand-image';
    brandIcon.src = state.project.icon || 'icons/icon-192.png';
    brandIcon.alt = '';
    brandIcon.width = 44;
    brandIcon.height = 44;
    identity.appendChild(brandIcon);
    var identityText = el('div', 'youge-identity-text');
    identityText.appendChild(el('strong', '', state.project.name || 'You.Ge Assistant'));
    identityText.appendChild(el('span', '', (state.project.shortName || 'You.Ge') + ' · ' + (state.project.hostname || 'localhost')));
    identity.appendChild(identityText);
    panelBody.appendChild(identity);

    // Connection status
    var status = section('Connection status', 'Live conditions reported by this project.');
    var statusGrid = el('div', 'youge-status-grid');
    var net = networkText(state);
    statusGrid.appendChild(statusRow('Network', net.online, state.network.online === false ? 'critical' : 'ok'));
    statusGrid.appendChild(statusRow('Primary API', net.primary, /failed|unavailable|degraded/.test(net.primary) ? 'critical' : 'ok'));
    statusGrid.appendChild(statusRow('Backup', net.backup, net.backup === 'active' ? 'backup' : 'neutral'));
    statusGrid.appendChild(statusRow('DNS', net.dns, /failure|missing|interference/.test(net.dns) ? 'critical' : 'neutral'));
    status.appendChild(statusGrid);
    panelBody.appendChild(status);

    // Prioritized notifications
    var notices = section('What needs attention', state.notifications.length
      ? 'Ordered by priority. Critical recovery stays visible until resolved or acknowledged.'
      : 'No current alerts. The Assistant remains available for help and diagnostics.');
    if (state.notifications.length) {
      var list = el('div', 'youge-notice-list');
      state.notifications.forEach(function (notice) { list.appendChild(renderNotice(notice, state.availableActions)); });
      notices.appendChild(list);
    } else {
      notices.appendChild(el('p', 'youge-empty', 'All clear — nothing needs your attention right now.'));
    }
    panelBody.appendChild(notices);

    // Installation assistance
    var install = section('Installation', installationText(state.installation));
    if (state.installation && state.installation.status === 'available') {
      var installAction = button(state.installation.nativeAvailable ? 'Install this app' : 'Installation instructions', 'install');
      installAction.setAttribute('data-action', 'install');
      installAction.setAttribute('data-pwa-install', '');
      install.appendChild(installAction);
    }
    panelBody.appendChild(install);

    // Network diagnostics + recovery assistance
    var diagnostics = section('Diagnostics & recovery', 'Checks run only when you choose; no background probing.');
    var diagnosticsRow = el('div', 'youge-action-row');
    var diagnosticsButton = button('Run network diagnostics', 'diagnostics');
    diagnosticsButton.setAttribute('data-action', 'diagnostics');
    diagnosticsButton.setAttribute('data-pwa-diagnostics', '');
    diagnosticsRow.appendChild(diagnosticsButton);
    diagnostics.appendChild(diagnosticsRow);
    var recovery = el('details', 'youge-recovery');
    recovery.appendChild(el('summary', '', 'Recovery guidance'));
    var steps = el('ol', 'youge-steps');
    ['Confirm device connectivity and retry diagnostics.',
      'If a backup endpoint is configured, let the project switch to it.',
      'If DNS results disagree, check DNS propagation before changing provider settings.',
      'Contact the project support channel if the primary API stays unavailable.'].forEach(function (step) {
      steps.appendChild(el('li', '', step));
    });
    recovery.appendChild(steps);
    diagnostics.appendChild(recovery);
    panelBody.appendChild(diagnostics);

    // App-specific help / available actions
    var actions = section('Available actions', 'Project-specific actions are published through the centralized state.');
    if (state.availableActions.length) {
      var actionList = el('div', 'youge-action-list');
      state.availableActions.forEach(function (action) {
        var node = button(action.label, action.icon || 'custom');
        node.setAttribute('data-action', action.id);
        node.setAttribute('data-kind', action.kind || 'custom');
        if (action.message) node.title = action.message;
        actionList.appendChild(node);
      });
      actions.appendChild(actionList);
    } else {
      actions.appendChild(el('p', 'youge-empty', 'No extra actions are configured for this project.'));
    }
    panelBody.appendChild(actions);

    // Manual icon adjustment (size / horizontal / vertical), collapsed so the
    // main panel still reads at a glance.
    panelBody.appendChild(renderAdjustSection());

    if (focusKey) {
      var target = focusKey === 'close' ? closeButton : panelBody.querySelector(
        '[data-action="' + focusKey + '"], [data-dismiss="' + focusKey + '"], [data-acknowledge="' + focusKey + '"], [data-adjust="' + focusKey + '"]');
      if (target && typeof target.focus === 'function') target.focus();
    }
  }

  /* ---------------------------------------------------------------- *
   * Manual icon adjustment: size + horizontal + vertical.            *
   * Keyboard, touch and pointer all flow through the native range    *
   * inputs (one delegated 'input' listener on the panel root),      *
   * values clamp to 44–72px / 0–160px, persist per origin and reset  *
   * to the automatic responsive defaults on demand.                  *
   * ---------------------------------------------------------------- */

  function renderAdjustSection() {
    var wrap = el('details', 'youge-adjust');
    wrap.appendChild(el('summary', '', 'Adjust icon'));
    wrap.appendChild(
      el(
        'p',
        'youge-section-desc',
        'Size and position are saved on this device. Reset returns to the automatic defaults.'
      )
    );
    wrap.appendChild(renderAdjustRow('size', 'Icon size', 44, 72, effectiveSize(), 'px'));
    wrap.appendChild(renderAdjustRow('x', 'Horizontal position', 0, 160, effectiveOffset('x'), 'px'));
    wrap.appendChild(renderAdjustRow('y', 'Vertical position', 0, 160, effectiveOffset('y'), 'px'));
    var reset = button('Reset to automatic defaults', 'custom', 'youge-btn youge-btn-small youge-adjust-reset');
    reset.setAttribute('data-adjust-reset', '');
    wrap.appendChild(reset);
    return wrap;
  }

  function renderAdjustRow(key, labelText, min, max, value, unit) {
    var row = el('div', 'youge-adjust-row');
    var inputId = 'youge-adjust-' + key;
    var label = el('label', 'youge-adjust-label', labelText);
    label.setAttribute('for', inputId);
    row.appendChild(label);
    var input = doc.createElement('input');
    input.setAttribute('type', 'range');
    input.id = inputId;
    input.setAttribute('data-adjust', key);
    input.setAttribute('min', String(min));
    input.setAttribute('max', String(max));
    input.setAttribute('step', '1');
    input.value = String(value);
    row.appendChild(input);
    var output = el('output', 'youge-adjust-value', value + unit);
    output.id = inputId + '-out';
    output.setAttribute('for', inputId);
    row.appendChild(output);
    return row;
  }

  function updateAdjustOutputs() {
    if (!mount || !doc.getElementById) return;
    ['size', 'x', 'y'].forEach(function (key) {
      var input = doc.getElementById('youge-adjust-' + key);
      var output = doc.getElementById('youge-adjust-' + key + '-out');
      if (!input || !output) return;
      var value = key === 'size' ? effectiveSize() : effectiveOffset(key);
      input.value = String(value);
      output.textContent = value + 'px';
    });
  }

  function onAdjustInput(event) {
    var target = event.target;
    if (!target || !target.getAttribute) return;
    var key = target.getAttribute('data-adjust');
    if (!key || (key !== 'size' && key !== 'x' && key !== 'y')) return;
    var raw = Number(target.value);
    if (!isFinite(raw)) return;
    var value = key === 'size' ? clampAdjustSize(raw) : clampAdjustOffset(raw);
    if (value == null) return;
    manualAdjust = manualAdjust || {};
    manualAdjust[key] = value;
    saveManualAdjust();
    applyFabAdjust();
    applyAppearance(api.getState());
    var output = doc.getElementById('youge-adjust-' + key + '-out');
    if (output) output.textContent = value + 'px';
  }

  function resetAdjust() {
    manualAdjust = {};
    saveManualAdjust();
    applyFabAdjust();
    applyAppearance(api.getState());
    updateAdjustOutputs();
  }

  /* ---------------------------------------------------------------- *
   * Android in-app browser → Chrome handoff (shared with the SDK).   *
   * The offer renders only for a confident restricted in-app         *
   * detection; normal Chrome/Safari/unknown browsers never see it.  *
   * ---------------------------------------------------------------- */

  function setupChromeOffer() {
    if (!chromeOfferEl) return;
    var sdk = root.YouGeAssistantSDK;
    if (!sdk || typeof sdk.createChromeHandoff !== 'function') return;
    try {
      var state = api.getState();
      if (state && state.capabilities && state.capabilities.chromeHandoff === false) return;
    } catch (error) { return; }
    if (readStorage('youge-assistant:chrome-offer-dismissed') === '1') return;
    chromeOffer = sdk.createChromeHandoff({
      userAgent: root.navigator && root.navigator.userAgent,
      location: root.location || null,
      document: doc,
    });
    if (!chromeOffer || typeof chromeOffer.shouldOffer !== 'function' || !chromeOffer.shouldOffer()) {
      chromeOffer = null;
      return;
    }
    chromeInstructions = chromeOffer.instructions(root.location && root.location.href);
    var text = chromeOfferEl.querySelector('[data-chrome-text]');
    var openButton = chromeOfferEl.querySelector('[data-chrome-open]');
    var dismissButton = chromeOfferEl.querySelector('[data-chrome-dismiss]');
    var copyButton = chromeOfferEl.querySelector('[data-chrome-copy]');
    if (text && chromeInstructions.intro) text.textContent = chromeInstructions.intro;
    if (openButton) openButton.textContent = chromeInstructions.openLabel || 'Open in Chrome';
    if (dismissButton) dismissButton.textContent = chromeInstructions.dismissLabel || 'Not now';
    if (copyButton) copyButton.textContent = chromeInstructions.copyLabel || 'Copy address';
    chromeOfferEl.hidden = false;
  }

  function showChromeFallback(manual) {
    if (!chromeFallbackEl || !chromeStepsEl || !chromeUrlEl) return;
    if (manual) chromeInstructions = manual;
    if (!chromeInstructions) return;
    while (chromeStepsEl.firstChild) chromeStepsEl.removeChild(chromeStepsEl.firstChild);
    (chromeInstructions.steps || []).forEach(function (step) {
      chromeStepsEl.appendChild(el('li', '', step));
    });
    chromeUrlEl.textContent = chromeInstructions.url || '';
    chromeFallbackEl.hidden = false;
  }

  function openChromeHandoff() {
    if (!chromeOffer) return;
    chromeOffer.open((root.location && root.location.href) || '', function (manual) {
      showChromeFallback(manual);
    });
  }

  function dismissChromeOffer() {
    if (chromeOfferEl) chromeOfferEl.hidden = true;
    chromeSuppressed = false;
    writeStorage('youge-assistant:chrome-offer-dismissed', '1');
    if (fab && typeof fab.focus === 'function') fab.focus();
  }

  function copyChromeUrl() {
    var url = (chromeInstructions && chromeInstructions.url) || (root.location && root.location.href) || '';
    var report = function (ok) {
      if (!chromeStatusEl) return;
      chromeStatusEl.textContent = ok
        ? ((chromeInstructions && chromeInstructions.copiedLabel) || 'Address copied.')
        : 'Select the address above to copy it manually.';
    };
    try {
      if (root.navigator && root.navigator.clipboard && typeof root.navigator.clipboard.writeText === 'function') {
        var pending = root.navigator.clipboard.writeText(url);
        if (pending && typeof pending.then === 'function') {
          pending.then(function () { report(true); }, function () { report(false); });
          return;
        }
        report(true);
        return;
      }
    } catch (error) { /* fall through to the manual hint */ }
    report(false);
  }

  function reducedMotion() {
    try {
      return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (error) { return false; }
  }

  function openPanel() {
    if (isOpen || !panel) return;
    isOpen = true;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    // The Chrome offer must never sit on top of the open panel.
    if (chromeOfferEl && !chromeOfferEl.hidden) {
      chromeOfferEl.hidden = true;
      chromeSuppressed = true;
    }
    renderPanel(api.getState());
    var reveal = function () { panel.classList.add('is-open'); };
    if (root.requestAnimationFrame) root.requestAnimationFrame(reveal);
    else reveal();
    if (closeButton && typeof closeButton.focus === 'function') closeButton.focus();
  }

  function closePanel() {
    if (!isOpen || !panel) return;
    isOpen = false;
    fab.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    var hide = function () { if (!isOpen) panel.hidden = true; };
    if (reducedMotion()) hide();
    else closeTimer = setTimeout(hide, 180);
    if (chromeSuppressed && chromeOfferEl && readStorage('youge-assistant:chrome-offer-dismissed') !== '1') {
      chromeOfferEl.hidden = false;
    }
    chromeSuppressed = false;
    if (fab && typeof fab.focus === 'function') fab.focus();
  }

  function dispatchAction(id, kind) {
    if (!doc.dispatchEvent || !root.CustomEvent) return;
    try {
      doc.dispatchEvent(new root.CustomEvent('youge:action', {
        detail: { id: id, kind: kind || 'custom', source: 'widget' },
      }));
    } catch (error) { /* ignore */ }
  }

  function handleAction(id, kind) {
    var pwaRuntime = root.YouGePWA || root.PWA;
    dispatchAction(id, kind);
    if (id === 'diagnostics' && (!pwaRuntime || typeof pwaRuntime.showNetworkDiagnostics !== 'function')) {
      api.runDiagnostics();
    }
    if (id === 'update') {
      if (api && typeof api.applyUpdate === 'function') {
        try { Promise.resolve(api.applyUpdate()).catch(function () {}); } catch (error) { /* ignore */ }
      } else if (pwaRuntime && typeof pwaRuntime.applyUpdate === 'function') {
        try { Promise.resolve(pwaRuntime.applyUpdate()).catch(function () {}); } catch (error) { /* ignore */ }
      }
    }
    // `install` is handled by pwa.js through [data-pwa-install]; calling
    // promptInstall() here as well would request the same native prompt twice.
  }

  function onClick(event) {
    var target = event.target && event.target.closest
      ? event.target.closest('[data-action], [data-dismiss], [data-acknowledge], [data-role="close"], [data-role="toggle"], [data-chrome-open], [data-chrome-dismiss], [data-chrome-copy], [data-adjust-reset]')
      : null;
    if (!target || !mount || !mount.contains(target)) return;
    if (target.getAttribute('data-role') === 'close') { closePanel(); return; }
    if (target.getAttribute('data-role') === 'toggle') { isOpen ? closePanel() : openPanel(); return; }
    if (target.hasAttribute('data-chrome-open')) { openChromeHandoff(); return; }
    if (target.hasAttribute('data-chrome-dismiss')) { dismissChromeOffer(); return; }
    if (target.hasAttribute('data-chrome-copy')) { copyChromeUrl(); return; }
    if (target.hasAttribute('data-adjust-reset')) { resetAdjust(); return; }
    var dismiss = target.getAttribute('data-dismiss');
    if (dismiss) { api.dismiss(dismiss); return; }
    var acknowledge = target.getAttribute('data-acknowledge');
    if (acknowledge) { api.acknowledge(acknowledge); return; }
    var action = target.getAttribute('data-action');
    if (action) handleAction(action, target.getAttribute('data-kind'));
  }

  function toolkitDialogOpen() {
    // pwa.js opens install/diagnostics flows as `.pwa-flow` dialogs on top of
    // the panel. Those flows own Escape: closing the panel at the same time
    // would drop the user out of the flow and strand focus.
    if (!doc || typeof doc.querySelector !== 'function') return false;
    try {
      return Boolean(doc.querySelector('.pwa-flow'));
    } catch (error) {
      return false;
    }
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' || !isOpen) return;
    if (toolkitDialogOpen()) return;
    closePanel();
  }

  function onState(state) {
    applyAppearance(state);
    updateFab(state);
    if (isOpen) renderPanel(state);
  }

  function build() {
    if (doc.getElementById(ROOT_ID)) return doc.getElementById(ROOT_ID);
    var node = doc.createElement('div');
    node.id = ROOT_ID;
    node.className = 'youge-assistant-widget';
    node.setAttribute('data-youge-widget', '');
    node.setAttribute('data-position', 'bottom-right');

    fab = el('button', 'youge-fab');
    fab.type = 'button';
    fab.setAttribute('data-role', 'toggle');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', PANEL_ID);
    fab.setAttribute('aria-label', 'You.Ge Assistant, no alerts');
    fab.appendChild(icon('assistant'));
    badge = el('span', 'youge-badge');
    badge.setAttribute('aria-hidden', 'true');
    badge.hidden = true;
    fab.appendChild(badge);
    node.appendChild(fab);

    live = el('span', 'youge-sr-only');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    node.appendChild(live);

    // Android in-app browser → Chrome handoff offer. Hidden until setup()
    // confirms a confident restricted in-app detection through the SDK.
    chromeOfferEl = el('div', 'youge-chrome-offer');
    chromeOfferEl.setAttribute('role', 'region');
    chromeOfferEl.setAttribute('aria-label', 'Open in Chrome');
    chromeOfferEl.hidden = true;
    var offerText = el('p', 'youge-chrome-offer-text');
    offerText.setAttribute('data-chrome-text', '');
    chromeOfferEl.appendChild(offerText);
    var offerActions = el('div', 'youge-chrome-offer-actions');
    var openChromeButton = doc.createElement('button');
    openChromeButton.type = 'button';
    openChromeButton.className = 'youge-btn youge-btn-install youge-chrome-open';
    openChromeButton.setAttribute('data-chrome-open', '');
    offerActions.appendChild(openChromeButton);
    var dismissChromeButton = doc.createElement('button');
    dismissChromeButton.type = 'button';
    dismissChromeButton.className = 'youge-btn youge-btn-plain youge-chrome-dismiss';
    dismissChromeButton.setAttribute('data-chrome-dismiss', '');
    offerActions.appendChild(dismissChromeButton);
    chromeOfferEl.appendChild(offerActions);
    chromeFallbackEl = el('div', 'youge-chrome-offer-fallback');
    chromeFallbackEl.setAttribute('data-chrome-fallback', '');
    chromeFallbackEl.hidden = true;
    chromeStepsEl = el('ol', 'youge-chrome-offer-steps');
    chromeFallbackEl.appendChild(chromeStepsEl);
    chromeUrlEl = el('code', 'youge-chrome-offer-url');
    chromeFallbackEl.appendChild(chromeUrlEl);
    var copyChromeButton = doc.createElement('button');
    copyChromeButton.type = 'button';
    copyChromeButton.className = 'youge-btn youge-btn-small youge-chrome-copy';
    copyChromeButton.setAttribute('data-chrome-copy', '');
    chromeFallbackEl.appendChild(copyChromeButton);
    chromeStatusEl = el('span', 'youge-chrome-offer-status');
    chromeStatusEl.setAttribute('role', 'status');
    chromeStatusEl.setAttribute('aria-live', 'polite');
    chromeFallbackEl.appendChild(chromeStatusEl);
    chromeOfferEl.appendChild(chromeFallbackEl);
    node.appendChild(chromeOfferEl);

    panel = el('section', 'youge-panel');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'youge-assistant-title');
    var header = el('header', 'youge-panel-header');
    header.appendChild(el('h2', 'youge-panel-title', 'You.Ge Assistant')).id = 'youge-assistant-title';
    closeButton = el('button', 'youge-close');
    closeButton.type = 'button';
    closeButton.setAttribute('data-role', 'close');
    closeButton.setAttribute('aria-label', 'Close assistant panel');
    closeButton.appendChild(icon('close'));
    header.appendChild(closeButton);
    panel.appendChild(header);
    panelBody = el('div', 'youge-panel-body');
    panel.appendChild(panelBody);
    node.appendChild(panel);
    return node;
  }

  function mountWidget() {
    if (mount || !doc.body) return;
    mount = build();
    doc.body.appendChild(mount);
    mount.addEventListener('click', onClick);
    mount.addEventListener('input', onAdjustInput);
    doc.addEventListener('keydown', onKeydown);
    applyFabAdjust();
    unsubscribe = api.subscribe(onState);
    setupChromeOffer();
  }

  function destroy() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (chromeOffer && typeof chromeOffer.destroy === 'function') chromeOffer.destroy();
    chromeOffer = null;
    if (mount) {
      mount.removeEventListener('click', onClick);
      mount.removeEventListener('input', onAdjustInput);
      if (mount.parentNode) mount.parentNode.removeChild(mount);
    }
    doc.removeEventListener('keydown', onKeydown);
    mount = null;
    isOpen = false;
    root.YouGeAssistantWidget.__mounted = false;
  }

  root.YouGeAssistantWidget = {
    __mounted: true,
    open: openPanel,
    close: closePanel,
    destroy: destroy,
    getRoot: function () { return mount; },
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mountWidget, { once: true });
  else mountWidget();
})(typeof globalThis !== 'undefined' ? globalThis : this);
