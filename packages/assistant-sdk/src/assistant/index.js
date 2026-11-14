/*!
 * @youge/assistant-sdk — core Assistant state, subscriptions and lifecycle
 * -------------------------------------------------------------------------
 * Framework-independent state engine. Never calls fetch, never registers a
 * service worker, never polls, and never treats hostname detection as auth.
 */

import {
  EVENT_NAMES,
  PRIORITY,
  SDK_VERSION,
  STORAGE_PREFIXES,
  TONE,
} from '../core/constants.js';
import {
  clone,
  safeSameOriginIcon,
  safeText,
} from '../core/sanitize.js';
import { detectRuntimeHostname, resolveDomain } from '../domain/index.js';
import {
  resolveAssistantConfig,
  saveLastKnownGood,
  validatePublishedConfig,
} from '../config/index.js';
import {
  connectivityFailure,
  createDiagnosticsIntegration,
  dnsFailure,
  normalizeDnsResult,
} from '../diagnostics/index.js';
import {
  deriveInstallationState,
  readPwaSnapshot,
  requestPwaInstall,
  requestPwaUpdate,
} from '../installation/index.js';
import { normalizeTheme } from '../theme/index.js';

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
export const NOTIFICATION_LEVEL_MAP = Object.freeze({
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

export function notificationLevel(id, priority) {
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

export function createAssistant(initialOptions, envOverrides) {
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
  let lastPwaHasUpdate;

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
    if (config.modules.updates && network.updateAvailable) {
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
    const pwa = getPwa();
    const pwaSnapshot = readPwaSnapshot(pwa);
    let pwaHasUpdate = pwaSnapshot.hasUpdate;
    if (pwaHasUpdate === undefined && pwa && typeof pwa.hasUpdate === 'function') {
      try { pwaHasUpdate = Boolean(pwa.hasUpdate()); } catch (error) { /* ignore */ }
    }
    if (lastPwaHasUpdate === true && pwaHasUpdate === false) {
      conditions.updateAvailable = false;
    }
    if (typeof pwaHasUpdate === 'boolean') {
      lastPwaHasUpdate = pwaHasUpdate;
    }
    const installation = deriveInstallationState({
      pwa: pwa,
      enabled: config.modules.installation,
    });
    const dns = {
      status: conditions.dns.status,
      classification: conditions.dns.classification,
      message: conditions.dns.message,
      checkedAt: conditions.dns.checkedAt,
    };
    if (typeof conditions.dns.cancelled === 'boolean') dns.cancelled = conditions.dns.cancelled;
    if (typeof conditions.dns.failed === 'boolean') dns.failed = conditions.dns.failed;
    const network = {
      online: conditions.online,
      dns: dns,
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
      updateAvailable: conditions.updateAvailable || pwaHasUpdate === true,
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
        unsubscribePwa = pwa.onChange(function (nextState) {
          if (nextState && typeof nextState === 'object' && typeof nextState.hasUpdate === 'boolean') {
            // Once the toolkit publishes an explicit availability snapshot it
            // owns that state; event-only and manual legacy signals are fallback
            // state only until this callback reconciles them.
            lastPwaHasUpdate = nextState.hasUpdate;
            conditions.updateAvailable = nextState.hasUpdate;
          }
          emit();
        });
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
      return Object.assign({
        hostname: project.hostname,
        origin: project.origin,
        basePath: project.basePath,
        online: conditions.online,
      }, diagnosticsProbeContext());
    },
    onStart: function () {
      conditions.dns.status = 'running';
      emit();
    },
    onResult: function (result) {
      setDnsResult(result);
    },
  });

  // The probe paths come from the resolved domain registry entry, which is the
  // same source `pwa.js` uses for `runNetworkDiagnostics()`. They are read from
  // the resolution that produced the current host so the diagnostics context
  // and the identity can never disagree.
  function diagnosticsProbeContext(domain) {
    const resolved = domain === null || domain === undefined ? domainContext() : domain;
    const diagnostics = resolved.diagnostics && typeof resolved.diagnostics === 'object' ? resolved.diagnostics : {};
    return {
      appProbePath: typeof diagnostics.appProbePath === 'string' ? diagnostics.appProbePath : '',
      backendProbePath: typeof diagnostics.backendProbePath === 'string' ? diagnostics.backendProbePath : '',
    };
  }

  // `./health` and `health` resolve to the same URL, so they describe the same
  // diagnostic target and must not invalidate a published verdict. Root-relative
  // `/health` is deliberately *not* folded into `health`: on a subpath the two
  // resolve to different URLs.
  function normalizeProbeIdentity(value) {
    return typeof value === 'string' ? value.replace(/^(?:\.\/)+/, '') : '';
  }

  // A DNS verdict belongs to one effective diagnostic target: the project, the
  // host, the origin, the base path and the app/backend probe paths. Changing
  // any of them makes a published result stale.
  function dnsIdentity() {
    const project = projectInfo();
    const probes = diagnosticsProbeContext();
    return {
      id: project.id,
      hostname: project.hostname,
      origin: project.origin,
      basePath: project.basePath,
      appProbePath: normalizeProbeIdentity(probes.appProbePath),
      backendProbePath: normalizeProbeIdentity(probes.backendProbePath),
    };
  }

  function sameDnsIdentity(a, b) {
    return Boolean(a && b) &&
      a.id === b.id &&
      a.hostname === b.hostname &&
      a.origin === b.origin &&
      a.basePath === b.basePath &&
      a.appProbePath === b.appProbePath &&
      a.backendProbePath === b.backendProbePath;
  }

  function configure(nextOptions) {
    if (destroyed) return snapshot;
    const previousDnsIdentity = dnsIdentity();
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
    // A DNS verdict belongs to one project on one hostname: when either
    // changes, the previous result is stale. Unrelated updates keep it.
    if (!sameDnsIdentity(previousDnsIdentity, dnsIdentity())) {
      diagnosticsController.clear();
      conditions.dns = { status: 'idle', classification: 'unknown', message: '', checkedAt: null };
      lastConditionKeys = new Set();
    }
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
    // Single-flight and cancellation hygiene live in the diagnostics adapter:
    // it owns one controller per run (bridging an optional caller signal) and
    // aborts it from `clear()`, which `destroy()` calls.
    return diagnosticsController.run(runOptions);
  }

  function requestInstall(promptOptions) {
    if (destroyed) return Promise.resolve({ outcome: 'unsupported' });
    return requestPwaInstall({
      pwa: getPwa(),
      enabled: config.modules.installation,
    }, promptOptions);
  }

  function applyUpdate() {
    if (destroyed) return Promise.resolve({ applied: false, outcome: 'unsupported' });
    return requestPwaUpdate({
      pwa: getPwa(),
      enabled: config.modules.updates !== false,
    }).then(function (result) {
      if (!destroyed && result && !result.applied && result.outcome === 'no-waiting-worker') {
        const pwa = getPwa();
        const pwaSnapshot = readPwaSnapshot(pwa);
        let hasUpdate = pwaSnapshot.hasUpdate;
        if (hasUpdate === undefined && pwa && typeof pwa.hasUpdate === 'function') {
          try { hasUpdate = Boolean(pwa.hasUpdate()); } catch (error) { /* ignore */ }
        }
        if (hasUpdate !== true) {
          conditions.updateAvailable = false;
          emit();
        }
      }
      return result;
    });
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
    applyUpdate: applyUpdate,
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

export function getGlobalAssistant(targetRoot) {
  const root = targetRoot || (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!root || !root.YouGeAssistant || !root.YouGeAssistant.__state) return null;
  if (typeof root.YouGeAssistant.isDestroyed === 'function' && root.YouGeAssistant.isDestroyed()) return null;
  return root.YouGeAssistant;
}

export function attachAssistant(options, envOverrides) {
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
