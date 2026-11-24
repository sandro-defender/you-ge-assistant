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

  var NOTICE_ACTION_KEYS = {
    install: 'instructionsActionLabel',
    diagnostics: 'actionDiagnosticsLabel',
    recovery: 'actionRecoveryLabel',
    help: 'actionHelpLabel',
    'backup-status': 'actionBackupStatusLabel',
    update: 'actionUpdateLabel',
  };

  var PRIMARY_STATUS_KEYS = {
    unknown: 'widgetUnknown',
    healthy: 'widgetHealthy',
    failed: 'widgetFailed',
    unavailable: 'widgetUnavailable',
    degraded: 'widgetDegraded',
  };

  var BACKUP_STATUS_KEYS = {
    unknown: 'widgetUnknown',
    inactive: 'widgetInactive',
    active: 'widgetActive',
    failed: 'widgetFailed',
  };

  var EN_WIDGET_FALLBACKS = {
    assistantName: 'You.Ge Assistant',
    assistantSuffix: 'assistant',
    noAlerts: 'No alerts',
    noAlertsLower: 'no alerts',
    noAlertsFabLabel: 'You.Ge Assistant, no alerts',
    highestPriority: 'highest priority',
    highestPrioritySentence: 'Highest priority',
    installActionLabel: 'Install this app',
    instructionsActionLabel: 'Installation instructions',
    actionDiagnosticsLabel: 'Run network diagnostics',
    actionRecoveryLabel: 'Recovery guidance',
    actionOpenLabel: 'Open',
    widgetStatusTitle: 'Connection status',
    widgetStatusDesc: 'Live conditions reported by this project.',
    widgetNetworkLabel: 'Network',
    widgetOnline: 'Online',
    widgetOffline: 'Offline',
    widgetPrimaryApiLabel: 'Primary API',
    widgetBackupLabel: 'Backup',
    widgetDnsLabel: 'DNS',
    widgetUnknown: 'unknown',
    widgetInactive: 'inactive',
    widgetNotChecked: 'not checked',
    widgetAttentionTitle: 'What needs attention',
    widgetAttentionDesc: 'Ordered by priority. Critical recovery stays visible until resolved or acknowledged.',
    widgetAllClear: 'All clear — nothing needs your attention right now.',
    widgetInstallationTitle: 'Installation',
    widgetInstallIos: 'iPhone/iPad: open Share in Safari, then choose Add to Home Screen.',
    widgetInstallNative: 'This browser offers a native install prompt. Use the install action below.',
    widgetInstallGeneric: 'Desktop/mobile: open your browser menu and choose Install app, or Add to Home Screen.',
    widgetDiagnosticsTitle: 'Diagnostics & recovery',
    widgetDiagnosticsDesc: 'Checks run only when you choose; no background probing.',
    widgetRecoverySummary: 'Recovery guidance',
    widgetRecoveryStep1: 'Confirm device connectivity and retry diagnostics.',
    widgetRecoveryStep2: 'If a backup endpoint is configured, let the project switch to it.',
    widgetRecoveryStep3: 'If DNS results disagree, check DNS propagation before changing provider settings.',
    widgetRecoveryStep4: 'Contact the project support channel if the primary API stays unavailable.',
    widgetMoreActionsTitle: 'More actions',
    widgetMoreActionsDesc: 'Other actions available for this project.',
    widgetAdjustTitle: 'Adjust icon',
    widgetAdjustDesc: 'Size and position are saved on this device. Reset returns to the automatic defaults.',
    widgetAdjustSize: 'Icon size',
    widgetAdjustX: 'Horizontal position',
    widgetAdjustY: 'Vertical position',
    widgetAdjustReset: 'Reset to automatic defaults',
    widgetAcknowledge: 'Acknowledge',
    widgetDismiss: 'Dismiss',
    widgetClosePanel: 'Close assistant panel',
    chromeOpenLabel: 'Open in Chrome',
    chromeDismissLabel: 'Not now',
    chromeCopyLabel: 'Copy address',
    chromeCopiedLabel: 'Address copied.',
    chromeCopyManual: 'Select the address above to copy it manually.',
  };

  function activeLocale(state) {
    if (state && state.locale) return state.locale;
    try {
      if (api && typeof api.getLocale === 'function') return api.getLocale();
    } catch (error) { /* ignore */ }
    var sdk = root.YouGeAssistantSDK;
    if (sdk && typeof sdk.resolveLocale === 'function') {
      return sdk.resolveLocale({ navigator: root.navigator });
    }
    return 'en';
  }

  function t(state, key, fallback) {
    var sdk = root.YouGeAssistantSDK;
    var locale = activeLocale(state);
    if (sdk && typeof sdk.translate === 'function') {
      return sdk.translate(locale, key);
    }
    return Object.prototype.hasOwnProperty.call(EN_WIDGET_FALLBACKS, key)
      ? EN_WIDGET_FALLBACKS[key]
      : (fallback || key);
  }

  function formatAlerts(state, count) {
    var sdk = root.YouGeAssistantSDK;
    var locale = activeLocale(state);
    if (sdk && typeof sdk.formatAlertCount === 'function') {
      return sdk.formatAlertCount(locale, count);
    }
    return count + (count === 1 ? ' alert' : ' alerts');
  }

  // Toolkit hooks delegated by pwa.js. Without the matching attribute a button
  // would only dispatch `youge:action` and appear dead on pages that rely on
  // the toolkit's own install/diagnostics handling, so every control for these
  // actions is built through actionButton(), wherever it is rendered.
  var ACTION_HOOKS = {
    install: 'data-pwa-install',
    diagnostics: 'data-pwa-diagnostics',
  };

  // Actions a notice offers even though a section offers them too. The
  // "Installation available" card is the invitation to install, so it keeps its
  // call to action; the Installation section is where it stays once the card is
  // dismissed. Everything else has one control (see renderPanel).
  var NOTICE_AND_SECTION_ACTIONS = { install: true };

  // Shown under "Recovery guidance". Kept as data so the block is skipped
  // rather than rendered as an empty numbered list if it ever has no steps.
  var RECOVERY_STEPS = [
    'Confirm device connectivity and retry diagnostics.',
    'If a backup endpoint is configured, let the project switch to it.',
    'If DNS results disagree, check DNS propagation before changing provider settings.',
    'Contact the project support channel if the primary API stays unavailable.',
  ];

  var mount = null;
  var fab = null;
  var fabLogo = null;
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
    var launcher = null;
    try { launcher = api && api.getState && api.getState().appearance.launcher; } catch (error) { launcher = null; }
    var configuredSize = Boolean(launcher && launcher.sizeConfigured);
    if (hasSize || configuredSize) {
      var targetSize = hasSize ? manualAdjust.size : launcher.size;
      var size = targetSize + 'px';
      fab.style.width = size;
      fab.style.height = size;
      var glyph = Math.max(18, Math.round(targetSize * 0.46)) + 'px';
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

  // The one way an action control is built: the id the delegated click handler
  // reads, plus the toolkit hook that makes install/diagnostics actually run.
  function actionButton(id, label, iconName, className) {
    var node = button(label, iconName, className);
    node.setAttribute('data-action', id);
    if (Object.prototype.hasOwnProperty.call(ACTION_HOOKS, id)) node.setAttribute(ACTION_HOOKS[id], '');
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
    var launcher = appearance.launcher || {};
    var visual = launcher.appearance || {};
    var animation = launcher.animation || {};
    var attention = launcher.attention || {};
    if (fab) {
      var shape = ['circle', 'rounded-square', 'square'].indexOf(visual.shape) !== -1 ? visual.shape : 'circle';
      fab.setAttribute('data-shape', shape);
      if (fab.querySelectorAll) Array.prototype.forEach.call(fab.querySelectorAll('.youge-electric-border path'), function (path) {
        var d = path.getAttribute('data-' + shape);
        if (d && path.getAttribute('d') !== d) path.setAttribute('d', d);
      });
      fab.setAttribute('data-logo', launcher.logo ? 'true' : 'false');
      var attentionMode = animation.enabled && attention.active ? (reducedMotion() ? 'static' : 'active') : 'off';
      fab.setAttribute('data-attention', attentionMode);
      var border = visual.border || {};
      fab.style.setProperty('--youge-fab-border-width', (Number(border.width) >= 0 && Number(border.width) <= 8 ? Number(border.width) : 1) + 'px');
      fab.style.setProperty('--youge-fab-border-color', HEX_COLOR.test(String(border.color || '')) ? border.color : 'var(--youge-fab-ring)');
      fab.style.setProperty('--youge-fab-border-style', ['solid', 'dashed', 'none'].indexOf(border.style) !== -1 ? border.style : 'solid');
      fab.style.setProperty('--youge-logo-size', (Number(visual.logoSize) >= 30 && Number(visual.logoSize) <= 100 ? Number(visual.logoSize) : 72) + '%');
      fab.style.setProperty('--youge-logo-scale', (Number(visual.logoScale) >= 0.5 && Number(visual.logoScale) <= 2.5 ? Number(visual.logoScale) : 1));
      fab.style.setProperty('--youge-logo-fit', ['contain', 'cover', 'fill'].indexOf(visual.logoFit) !== -1 ? visual.logoFit : 'contain');
      var logoPosition = visual.logoPosition || {};
      var logoX = Number(logoPosition.x), logoY = Number(logoPosition.y);
      fab.style.setProperty('--youge-logo-position', (Number.isFinite(logoX) ? Math.max(0, Math.min(100, logoX)) : 50) + '% ' + (Number.isFinite(logoY) ? Math.max(0, Math.min(100, logoY)) : 50) + '%');
      fab.style.setProperty('--youge-logo-radius', typeof visual.logoBorderRadius === 'string' && /^(?:\d+(?:\.\d+)?)(?:px|%)$/.test(visual.logoBorderRadius) ? visual.logoBorderRadius : '50%');
      fab.style.setProperty('--youge-electric-color', HEX_COLOR.test(String(animation.color || '')) ? animation.color : '#c084fc');
      fab.style.setProperty('--youge-electric-duration', (3 / Math.max(0.25, Math.min(2.5, Number(animation.speed) || 1))) + 's');
      fab.style.setProperty('--youge-electric-intensity', String(Math.max(0, Math.min(1, Number(animation.intensity) || 0))));
      if (fabLogo) {
        if (launcher.logo) fabLogo.setAttribute('src', launcher.logo);
        else fabLogo.removeAttribute('src');
      }
      applyFabAdjust();
    }
    mount.hidden = state.enabled === false;
  }

  function updateFab(state) {
    if (!fab || !badge || !state) return;
    var badgeState = state.badge || { count: 0, tone: 'none', label: t(state, 'noAlerts') };
    var count = badgeState.count || 0;
    var tone = badgeState.tone || 'none';
    var label = state.project && state.project.name ? state.project.name : t(state, 'assistantName');
    var accessible = label + ' ' + t(state, 'assistantSuffix');
    if (count) accessible += ', ' + formatAlerts(state, count) + ', ' + t(state, 'highestPriority') + ': ' + badgeState.label;
    else accessible += ', ' + t(state, 'noAlertsLower');
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
      ? label + ': ' + formatAlerts(state, count) + '. ' + t(state, 'highestPrioritySentence') + ': ' + badgeState.label + '.'
      : label + ': ' + t(state, 'noAlertsLower') + '.';
    if (live && liveText !== lastLiveLabel) {
      live.textContent = liveText;
      lastLiveLabel = liveText;
    }
  }

  // Only called while installation is available: an installed app or a
  // browser without install support has no Installation section at all.
  function installationText(state, installation) {
    if (installation.support === 'manual-ios') return t(state, 'widgetInstallIos');
    if (installation.support === 'native') return t(state, 'widgetInstallNative');
    return t(state, 'widgetInstallGeneric');
  }

  function networkText(state) {
    var network = state.network || {};
    var endpoints = network.endpoints || {};
    var dns = network.dns || {};
    var sdk = root.YouGeAssistantSDK;
    var locale = activeLocale(state);
    var primaryKey = PRIMARY_STATUS_KEYS[endpoints.primary];
    var backupKey = BACKUP_STATUS_KEYS[endpoints.backup];
    var dnsText = t(state, 'widgetNotChecked');
    if (dns.classification) {
      dnsText = sdk && typeof sdk.localizeDnsClassification === 'function'
        ? sdk.localizeDnsClassification(locale, dns.classification, dns.status)
        : String(dns.classification).replace(/_/g, ' ');
    }
    return {
      online: network.online === false ? t(state, 'widgetOffline') : t(state, 'widgetOnline'),
      primary: primaryKey ? t(state, primaryKey) : (endpoints.primary || t(state, 'widgetUnknown')),
      backup: backupKey ? t(state, backupKey) : (endpoints.backup || t(state, 'widgetInactive')),
      dns: dnsText,
    };
  }

  /* ---------------------------------------------------------------- *
   * Capability enforcement (CD-1).                                   *
   *                                                                 *
   * The SDK publishes `state.capabilities` and owns the action ->     *
   * capability mapping (`YouGeAssistantSDK.capabilityForAction`), so  *
   * the widget never re-implements the policy: it asks, then renders  *
   * or acts. A state object without `capabilities` keeps everything   *
   * enabled, which is the documented default.                        *
   * ---------------------------------------------------------------- */

  function capabilityEnabled(state, name) {
    if (!state || !state.capabilities) return true;
    return state.capabilities[name] !== false;
  }

  function actionCapability(id, kind) {
    var sdk = root.YouGeAssistantSDK;
    if (!sdk || typeof sdk.capabilityForAction !== 'function') return null;
    try {
      return sdk.capabilityForAction(id, kind);
    } catch (error) {
      return null;
    }
  }

  function actionEnabled(state, id, kind) {
    var capability = actionCapability(id, kind);
    return !capability || capabilityEnabled(state, capability);
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

  // `claim(id)` answers whether this notice may render a control for an action.
  // A notice explains its condition; it carries the action only when the panel
  // does not already offer it (the install card is the one deliberate exception).
  function renderNotice(notice, actions, state, claim) {
    var article = el('article', 'youge-notice');
    article.setAttribute('data-notice', String(notice.id));
    var level = noticeLevel(notice);
    article.setAttribute('data-priority', String(notice.priority));
    article.setAttribute('data-tone', notice.tone || 'info');
    article.setAttribute('data-level', level);
    article.appendChild(noticeIcon(level));
    var content = el('div', 'youge-notice-content');
    content.appendChild(el('h4', 'youge-notice-title', notice.title));
    content.appendChild(el('p', 'youge-notice-message', notice.message));
    var controls = el('div', 'youge-notice-controls');
    if (notice.actionId && actionEnabled(state, notice.actionId) && claim(notice.actionId)) {
      var linked = noticeAction(notice, actions || []);
      var actionFallbackKey = NOTICE_ACTION_KEYS[notice.actionId];
      var actionLabel = (linked && linked.label)
        || (actionFallbackKey ? t(state, actionFallbackKey, NOTICE_ACTION_LABELS[notice.actionId]) : null)
        || NOTICE_ACTION_LABELS[notice.actionId]
        || t(state, 'actionOpenLabel');
      controls.appendChild(actionButton(
        notice.actionId,
        actionLabel,
        (linked && linked.icon) || 'custom',
        'youge-btn youge-btn-small'
      ));
    }
    if (notice.critical) {
      var ack = button(t(state, 'widgetAcknowledge'), 'recovery', 'youge-btn youge-btn-quiet youge-btn-small');
      ack.setAttribute('data-acknowledge', notice.id);
      controls.appendChild(ack);
    } else if (notice.dismissible !== false) {
      var dismiss = button(t(state, 'widgetDismiss'), 'close', 'youge-btn youge-btn-quiet youge-btn-small');
      dismiss.setAttribute('data-dismiss', notice.id);
      controls.appendChild(dismiss);
    }
    content.appendChild(controls);
    article.appendChild(content);
    return article;
  }

  // Focus and disclosure state have to survive a re-render: every state
  // emission rebuilds the panel body, and without this an open "Recovery
  // guidance" snapped shut and keyboard focus fell out of the dialog.
  function focusMemory() {
    var active = doc.activeElement;
    // Only focus that is inside the panel is ours to restore. A host control
    // that happens to carry `data-action` keeps its focus.
    if (!active || !panel || typeof panel.contains !== 'function' || !panel.contains(active)) return null;
    if (active === closeButton) return { close: true };
    if (typeof active.getAttribute !== 'function') return {};
    var attributes = ['data-action', 'data-dismiss', 'data-acknowledge', 'data-adjust', 'data-adjust-reset'];
    for (var i = 0; i < attributes.length; i += 1) {
      var value = active.getAttribute(attributes[i]);
      // The same action can sit on a notice and in a section (install), so the
      // enclosing notice is part of the control's identity.
      if (value != null) return { attribute: attributes[i], value: value, notice: noticeIdOf(active) };
    }
    if (active.tagName === 'SUMMARY' && active.parentNode) return { summaryOf: active.parentNode.className };
    return {};
  }

  function noticeIdOf(node) {
    var notice = node && typeof node.closest === 'function' ? node.closest('.youge-notice') : null;
    return notice ? notice.getAttribute('data-notice') : null;
  }

  // Compared by attribute value instead of an interpolated selector, so an
  // action id supplied by a project can never produce an invalid selector.
  // Prefers the control in the same place (same notice, or outside notices);
  // falls back to the same action elsewhere when that place is gone.
  function findByAttribute(attribute, value, notice) {
    var nodes = panelBody.querySelectorAll('[' + attribute + ']');
    var fallback = null;
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i].getAttribute(attribute) !== value) continue;
      if (noticeIdOf(nodes[i]) === notice) return nodes[i];
      if (!fallback) fallback = nodes[i];
    }
    return fallback;
  }

  function restoreFocus(memory) {
    if (!memory) return;
    var target = null;
    if (memory.attribute) target = findByAttribute(memory.attribute, memory.value, memory.notice || null);
    else if (memory.summaryOf) {
      var disclosures = panelBody.querySelectorAll('details');
      for (var i = 0; i < disclosures.length; i += 1) {
        if (disclosures[i].className === memory.summaryOf) target = disclosures[i].querySelector('summary');
      }
    }
    // The focused control can leave with its notice (Dismiss, Acknowledge).
    // Focus then stays in the dialog instead of dropping to the page.
    if (!target) target = closeButton;
    if (target && typeof target.focus === 'function') target.focus();
  }

  function disclosureOpen(selector) {
    var node = panelBody.querySelector(selector);
    return Boolean(node && node.open);
  }

  function renderPanel(state) {
    if (!panelBody || !state) return;
    var focus = focusMemory();
    var recoveryOpen = disclosureOpen('.youge-recovery');
    var adjustOpen = disclosureOpen('.youge-adjust');
    while (panelBody.firstChild) panelBody.removeChild(panelBody.firstChild);

    var notifications = state.notifications || [];
    var availableActions = state.availableActions || [];
    var capabilities = {
      diagnostics: capabilityEnabled(state, 'diagnostics'),
      recovery: capabilityEnabled(state, 'recovery') && RECOVERY_STEPS.length > 0,
      failover: capabilityEnabled(state, 'failover'),
      help: capabilityEnabled(state, 'help'),
    };
    var installable = Boolean(state.installation && state.installation.status === 'available');

    // Where each action is offered. An action id is claimed by the first place
    // that renders a control for it, in this order: its own section
    // (Installation, Diagnostics & recovery), then the notice that reports it,
    // then "More actions" — so nothing is listed a second time and nothing is
    // dropped. The install card additionally keeps its call to action beside
    // the Installation section (NOTICE_AND_SECTION_ACTIONS).
    var claimed = [];
    function claim(id) {
      var key = String(id);
      if (claimed.indexOf(key) !== -1) return false;
      claimed.push(key);
      return true;
    }
    var offeredOnNotice = [];
    function claimForNotice(id) {
      var key = String(id);
      if (!Object.prototype.hasOwnProperty.call(NOTICE_AND_SECTION_ACTIONS, key)) return claim(key);
      if (offeredOnNotice.indexOf(key) !== -1) return false; // once among notices
      offeredOnNotice.push(key);
      claim(key); // and never again under "More actions"
      return true;
    }
    if (installable) claim('install');
    if (capabilities.diagnostics) claim('diagnostics');
    if (capabilities.recovery) claim('recovery');

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
    var status = section(t(state, 'widgetStatusTitle'), t(state, 'widgetStatusDesc'));
    var statusGrid = el('div', 'youge-status-grid');
    var net = networkText(state);
    statusGrid.appendChild(statusRow(t(state, 'widgetNetworkLabel'), net.online, state.network.online === false ? 'critical' : 'ok'));
    statusGrid.appendChild(statusRow(t(state, 'widgetPrimaryApiLabel'), net.primary, /failed|unavailable|degraded/.test(String((state.network && state.network.endpoints && state.network.endpoints.primary) || '')) ? 'critical' : 'ok'));
    // Failover UI is not shown when the project disabled it.
    if (capabilities.failover) {
      var rawBackup = (state.network && state.network.endpoints && state.network.endpoints.backup) || '';
      statusGrid.appendChild(statusRow(t(state, 'widgetBackupLabel'), net.backup, rawBackup === 'active' ? 'backup' : 'neutral'));
    }
    var rawDns = String((state.network && state.network.dns && state.network.dns.classification) || '');
    statusGrid.appendChild(statusRow(t(state, 'widgetDnsLabel'), net.dns, /failure|missing|interference/.test(rawDns) ? 'critical' : 'neutral'));
    status.appendChild(statusGrid);
    panelBody.appendChild(status);

    // Prioritized notifications. The empty state is said once.
    var notices = section(t(state, 'widgetAttentionTitle'), notifications.length
      ? t(state, 'widgetAttentionDesc')
      : '');
    if (notifications.length) {
      var list = el('div', 'youge-notice-list');
      notifications.forEach(function (notice) { list.appendChild(renderNotice(notice, availableActions, state, claimForNotice)); });
      notices.appendChild(list);
    } else {
      notices.appendChild(el('p', 'youge-empty', t(state, 'widgetAllClear')));
    }
    panelBody.appendChild(notices);

    // Installation assistance: the permanent entry point for installing (the
    // install card above repeats it while that card is showing). There is no
    // section when nothing can be installed (already installed, unsupported
    // browser, or the project disabled installation).
    if (installable) {
      var install = section(t(state, 'widgetInstallationTitle'), installationText(state, state.installation));
      install.appendChild(actionButton(
        'install', state.installation.nativeAvailable ? t(state, 'installActionLabel') : t(state, 'instructionsActionLabel'), 'install'));
      panelBody.appendChild(install);
    }

    // Network diagnostics + recovery assistance: the single entry point for
    // both. Each is capability-gated: a disabled capability renders nothing at
    // all, so there is no hidden button left for a delegated handler or a
    // stray click to activate.
    if (capabilities.diagnostics || capabilities.recovery) {
      var diagnostics = section(t(state, 'widgetDiagnosticsTitle'), t(state, 'widgetDiagnosticsDesc'));
      if (capabilities.diagnostics) {
        var diagnosticsRow = el('div', 'youge-action-row');
        diagnosticsRow.appendChild(actionButton('diagnostics', t(state, 'actionDiagnosticsLabel'), 'diagnostics'));
        diagnostics.appendChild(diagnosticsRow);
      }
      if (capabilities.recovery) {
        var recovery = el('details', 'youge-recovery');
        recovery.appendChild(el('summary', '', t(state, 'widgetRecoverySummary')));
        var steps = el('ol', 'youge-steps');
        var stepKeys = ['widgetRecoveryStep1', 'widgetRecoveryStep2', 'widgetRecoveryStep3', 'widgetRecoveryStep4'];
        stepKeys.forEach(function (stepKey, idx) {
          steps.appendChild(el('li', '', t(state, stepKey, RECOVERY_STEPS[idx])));
        });
        recovery.appendChild(steps);
        if (recoveryOpen) recovery.open = true;
        diagnostics.appendChild(recovery);
      }
      panelBody.appendChild(diagnostics);
    }

    // Everything the centralized state publishes that has no control yet:
    // project-specific actions, plus built-in ones whose notice was dismissed.
    // The section is omitted when that leaves nothing to list.
    var extra = [];
    availableActions.forEach(function (action) {
      if (action && action.id != null && claim(action.id)) extra.push(action);
    });
    if (extra.length) {
      var actions = section(t(state, 'widgetMoreActionsTitle'), t(state, 'widgetMoreActionsDesc'));
      var actionList = el('div', 'youge-action-list');
      extra.forEach(function (action) {
        var node = actionButton(String(action.id), action.label, action.icon || 'custom');
        node.setAttribute('data-kind', action.kind || 'custom');
        if (action.message) node.title = action.message;
        actionList.appendChild(node);
      });
      actions.appendChild(actionList);
      panelBody.appendChild(actions);
    }

    // Manual icon adjustment (size / horizontal / vertical), collapsed so the
    // main panel still reads at a glance.
    var adjust = renderAdjustSection(state);
    if (adjustOpen) adjust.open = true;
    panelBody.appendChild(adjust);

    restoreFocus(focus);
  }

  /* ---------------------------------------------------------------- *
   * Manual icon adjustment: size + horizontal + vertical.            *
   * Keyboard, touch and pointer all flow through the native range    *
   * inputs (one delegated 'input' listener on the panel root),      *
   * values clamp to 44–72px / 0–160px, persist per origin and reset  *
   * to the automatic responsive defaults on demand.                  *
   * ---------------------------------------------------------------- */

  function renderAdjustSection(state) {
    var wrap = el('details', 'youge-adjust');
    wrap.appendChild(el('summary', '', t(state, 'widgetAdjustTitle')));
    wrap.appendChild(
      el(
        'p',
        'youge-section-desc',
        t(state, 'widgetAdjustDesc')
      )
    );
    wrap.appendChild(renderAdjustRow('size', t(state, 'widgetAdjustSize'), 44, 72, effectiveSize(), 'px'));
    wrap.appendChild(renderAdjustRow('x', t(state, 'widgetAdjustX'), 0, 160, effectiveOffset('x'), 'px'));
    wrap.appendChild(renderAdjustRow('y', t(state, 'widgetAdjustY'), 0, 160, effectiveOffset('y'), 'px'));
    var reset = button(t(state, 'widgetAdjustReset'), 'custom', 'youge-btn youge-btn-small youge-adjust-reset');
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

  function updateChromeOfferStrings(state) {
    if (!chromeOffer || !chromeOfferEl) return;
    var sdk = root.YouGeAssistantSDK;
    var labels = sdk && typeof sdk.chromeHandoffLabels === 'function'
      ? sdk.chromeHandoffLabels(activeLocale(state))
      : null;
    if (labels && sdk && typeof sdk.chromeHandoffInstructions === 'function') {
      chromeInstructions = sdk.chromeHandoffInstructions(root.location && root.location.href, labels);
    } else {
      chromeInstructions = chromeOffer.instructions(root.location && root.location.href);
    }
    var text = chromeOfferEl.querySelector('[data-chrome-text]');
    var openButton = chromeOfferEl.querySelector('[data-chrome-open]');
    var dismissButton = chromeOfferEl.querySelector('[data-chrome-dismiss]');
    var copyButton = chromeOfferEl.querySelector('[data-chrome-copy]');
    if (openButton) chromeOfferEl.setAttribute('aria-label', chromeInstructions.openLabel || t(state, 'chromeOpenLabel'));
    if (text && chromeInstructions.intro) text.textContent = chromeInstructions.intro;
    if (openButton) openButton.textContent = chromeInstructions.openLabel || t(state, 'chromeOpenLabel');
    if (dismissButton) dismissButton.textContent = chromeInstructions.dismissLabel || t(state, 'chromeDismissLabel');
    if (copyButton) copyButton.textContent = chromeInstructions.copyLabel || t(state, 'chromeCopyLabel');
    if (chromeFallbackEl && !chromeFallbackEl.hidden && chromeStepsEl && chromeUrlEl) {
      while (chromeStepsEl.firstChild) chromeStepsEl.removeChild(chromeStepsEl.firstChild);
      (chromeInstructions.steps || []).forEach(function (step) {
        chromeStepsEl.appendChild(el('li', '', step));
      });
    }
  }

  function setupChromeOffer() {
    if (!chromeOfferEl) return;
    var sdk = root.YouGeAssistantSDK;
    if (!sdk || typeof sdk.createChromeHandoff !== 'function') return;
    var state = null;
    try {
      state = api.getState();
      if (state && state.capabilities && state.capabilities.chromeHandoff === false) return;
    } catch (error) { return; }
    if (readStorage('youge-assistant:chrome-offer-dismissed') === '1') return;
    var labels = sdk.chromeHandoffLabels ? sdk.chromeHandoffLabels(activeLocale(state)) : undefined;
    chromeOffer = sdk.createChromeHandoff({
      userAgent: root.navigator && root.navigator.userAgent,
      location: root.location || null,
      document: doc,
      labels: labels,
    });
    if (!chromeOffer || typeof chromeOffer.shouldOffer !== 'function' || !chromeOffer.shouldOffer()) {
      chromeOffer = null;
      return;
    }
    updateChromeOfferStrings(state);
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
    var state = api.getState();
    var url = (chromeInstructions && chromeInstructions.url) || (root.location && root.location.href) || '';
    var report = function (ok) {
      if (!chromeStatusEl) return;
      chromeStatusEl.textContent = ok
        ? ((chromeInstructions && chromeInstructions.copiedLabel) || t(state, 'chromeCopiedLabel'))
        : t(state, 'chromeCopyManual');
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
    try {
      var current = api.getState();
      var actionIds = new Set((current.availableActions || []).map(function (action) { return action.id; }));
      var viewedIds = (current.notifications || []).filter(function (notice) { var linked = Array.isArray(notice.actionIds) ? notice.actionIds : [notice.actionId]; return linked.some(function (id) { return id && actionIds.has(id); }); }).map(function (notice) { return notice.id; });
      if (viewedIds.length && typeof api.markViewed === 'function') api.markViewed(viewedIds);
    } catch (error) { /* attention remains state-driven; viewing is best effort */ }
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
    // A rendered button is already gated, but a click can also arrive from a
    // stale DOM node, a keyboard replay or a host script: re-check at the
    // moment of activation so a disabled capability is never dispatched.
    if (!actionEnabled(api.getState(), id, kind)) return;
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
    // pwa.js opens install/diagnostics flows as `.pwa-flow` / `[data-pwa-help]`
    // / `<pwa-install>` dialogs on top of the panel. Those flows own Escape:
    // closing the panel at the same time would drop the user out of the flow
    // and strand focus.
    if (!doc || typeof doc.querySelector !== 'function') return false;
    try {
      if (doc.querySelector('.pwa-flow, [data-pwa-help]')) return true;
      var installEl = doc.querySelector('pwa-install');
      return Boolean(installEl && installEl.isInstallAvailable && !installEl.isDialogHidden);
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
    if (mount && state) {
      var lang = activeLocale(state);
      mount.setAttribute('lang', lang);
      mount.setAttribute('dir', state.dir || 'ltr');
    }
    if (closeButton) closeButton.setAttribute('aria-label', t(state, 'widgetClosePanel'));
    var titleEl = doc.getElementById('youge-assistant-title');
    if (titleEl && state && state.project && state.project.name) {
      titleEl.textContent = state.project.name;
    } else if (titleEl) {
      titleEl.textContent = t(state, 'assistantName');
    }
    applyAppearance(state);
    updateFab(state);
    updateChromeOfferStrings(state);
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
    var initState = typeof api.getState === 'function' ? api.getState() : null;
    fab.setAttribute('aria-label', t(initState, 'noAlertsFabLabel'));
    fab.appendChild(icon('assistant'));
    var logoStage = el('span', 'youge-fab-logo-stage');
    logoStage.setAttribute('aria-hidden', 'true');
    fabLogo = el('img');
    fabLogo.alt = '';
    logoStage.appendChild(fabLogo);
    fab.appendChild(logoStage);
    var createSvgElement = typeof doc.createElementNS === 'function'
      ? function (tag) { return doc.createElementNS('http://www.w3.org/2000/svg', tag); }
      : function (tag) { return doc.createElement(tag); };
    var electric = createSvgElement('svg');
    electric.setAttribute('class', 'youge-electric-border');
    electric.setAttribute('viewBox', '0 0 100 100');
    electric.setAttribute('preserveAspectRatio', 'none');
    electric.setAttribute('aria-hidden', 'true');
    electric.setAttribute('focusable', 'false');
    var glowPath = createSvgElement('path');
    glowPath.setAttribute('class', 'youge-electric-halo');
    var corePath = createSvgElement('path');
    [glowPath, corePath].forEach(function (path) {
      path.setAttribute('data-circle', 'M50 4 A46 46 0 1 1 49.99 4');
      path.setAttribute('data-rounded-square', 'M24 4 H76 Q96 4 96 24 V76 Q96 96 76 96 H24 Q4 96 4 76 V24 Q4 4 24 4 Z');
      path.setAttribute('data-square', 'M4 4 H96 V96 H4 Z');
      path.setAttribute('d', path.getAttribute('data-circle'));
      electric.appendChild(path);
    });
    fab.appendChild(electric);
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
    chromeOfferEl.setAttribute('aria-label', t(initState, 'chromeOpenLabel'));
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
    header.appendChild(el('h2', 'youge-panel-title', t(initState, 'assistantName'))).id = 'youge-assistant-title';
    closeButton = el('button', 'youge-close');
    closeButton.type = 'button';
    closeButton.setAttribute('data-role', 'close');
    closeButton.setAttribute('aria-label', t(initState, 'widgetClosePanel'));
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
