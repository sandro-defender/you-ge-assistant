import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { YouGeAssistant, capabilityForAction, createChromeHandoff } from '@youge/assistant-sdk';
import {
  FALLBACK_ASSISTANT_STATE,
  dispatchAssistantAction,
  getExternalStoreBindings,
  notificationLevelElement,
  notificationLevelLabel,
  resolveAppearanceTheme,
} from '@youge/assistant-sdk/react';
import FoundationPreview from './FoundationPreview.tsx';
import ThemeStudio from './ThemeStudio.jsx';
import { RECOVERY_STEPS, planPanelActions } from './panel-actions.js';
import {
  applyWorkspaceStaticTranslations,
  buildLocaleOptions,
  getExampleDictionary,
  getLocaleDirection,
  resolveExampleLocale,
  syncExampleLocale,
  tExample,
} from './i18n.js';
import GlareHover from './react-bits/GlareHover';
import LatticeLoader from './react-bits/LatticeLoader';
import SpotlightCard from './react-bits/SpotlightCard';
import assistantMark from './assistant-mark.png';

/* The React example consumes the extracted @youge/assistant-sdk and shares
 * the exact same singleton state as classic browser scripts (assistant-state.js)
 * and the dependency-free DOM renderer (assistant-widget.js). */
const fallbackState = {
  ...FALLBACK_ASSISTANT_STATE,
  project: {
    ...FALLBACK_ASSISTANT_STATE.project,
    id: 'example',
    name: 'Staff Space',
    shortName: 'Staff Space',
    hostname: window.location.hostname,
    themeColor: '#17634f',
  },
  network: {
    ...FALLBACK_ASSISTANT_STATE.network,
    online: navigator.onLine !== false,
  },
  appearance: {
    ...FALLBACK_ASSISTANT_STATE.appearance,
    offsets: { x: 16, y: 16 },
    theme: 'light',
    themeConfig: { mode: 'light', inheritHost: false, tokens: {}, host: {}, variables: {} },
    themeColor: '#17634f',
  },
};

const assistantStore = getExternalStoreBindings(
  () => YouGeAssistant.attach(),
  null,
  fallbackState
);

/* The theme bridge. `resolveAppearanceTheme` is the SDK resolver the DOM widget
 * also calls, so the sample cannot drift from the shipped widget. The returned
 * variables are applied as inline custom properties on the widget root. */
function useResolvedTheme(appearance) {
  return React.useMemo(
    () => resolveAppearanceTheme(appearance, { root: window, document }),
    [appearance]
  );
}

function themeStyle(resolved) {
  const style = {};
  Object.keys(resolved.variables).forEach((name) => {
    style[name] = resolved.variables[name];
  });
  style.colorScheme = resolved.scheme;
  return style;
}

/* The example wraps the SDK's React helpers once so JSX stays readable. Both
 * are thin: the glyph shapes, labels and theme tokens all come from the SDK. */
function NotificationLevelGlyph({ level }) {
  return notificationLevelElement(level, React.createElement);
}

function NotificationIcon({ level }) {
  return (
    <span className="assistant-notice-icon" aria-hidden="true">
      <NotificationLevelGlyph level={level} />
    </span>
  );
}

function dispatchWidgetAction(id, kind) {
  dispatchAssistantAction(id, kind, {
    assistant: YouGeAssistant.attach(),
    source: 'react-widget',
  });
}

// A notice action must read like the action it performs. Project-supplied
// actions carry the right wording (including "Install this app" versus manual
// instructions); these labels only cover ids no project action list declares.
const NOTICE_ACTION_LABELS = {
  install: 'Installation instructions',
  diagnostics: 'Run network diagnostics',
  recovery: 'Recovery guidance',
  help: 'Get help',
  'backup-status': 'Backup status',
  update: 'Apply app update',
};

const ACTIONABLE_TONES = new Set(['critical', 'auth', 'install']);

function capabilityEnabled(state, name) {
  const capabilities = state && state.capabilities;
  if (!capabilities) return true;
  return capabilities[name] !== false;
}

function actionEnabled(state, id, kind) {
  const capability = capabilityForAction(id, kind);
  return !capability || capabilityEnabled(state, capability);
}

// Toolkit hooks delegated by pwa.js. Every control for these actions spreads
// the same attributes, so a button never merely announces `youge:action`.
const TOOLKIT_HOOKS = {
  install: { 'data-pwa-install': '' },
  diagnostics: { 'data-pwa-diagnostics': '' },
};

function toolkitHook(id) {
  return Object.prototype.hasOwnProperty.call(TOOLKIT_HOOKS, id) ? TOOLKIT_HOOKS[id] : {};
}

function noticeActionLabel(state, notice) {
  const match = (state.availableActions || []).find((action) => action.id === notice.actionId);
  if (match && match.label) return match.label;
  const locale = resolveExampleLocale(state?.locale);
  const dict = getExampleDictionary(locale);
  if (locale !== 'en' && dict.noticeActionLabels && dict.noticeActionLabels[notice.actionId]) {
    return dict.noticeActionLabels[notice.actionId];
  }
  return NOTICE_ACTION_LABELS[notice.actionId] || 'Open';
}

/* Android in-app browser → Chrome handoff (SDK 0.1.1). */
const CHROME_OFFER_DISMISS_KEY = 'youge-assistant:chrome-offer-dismissed';

function ChromeHandoffBanner({ locale = 'en' }) {
  const activeLocale = resolveExampleLocale(locale);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(CHROME_OFFER_DISMISS_KEY) === '1';
    } catch (error) {
      return false;
    }
  });
  const [manual, setManual] = useState(null);
  const [copied, setCopied] = useState('');
  const handoff = useMemo(
    () =>
      createChromeHandoff({
        userAgent: navigator.userAgent,
        location: window.location,
        document,
        locale: activeLocale,
      }),
    [activeLocale]
  );

  useEffect(() => () => handoff.destroy(), [handoff]);

  if (dismissed || !handoff.shouldOffer()) return null;
  const instructions = manual || handoff.instructions(window.location.href);

  function dismiss() {
    try {
      window.localStorage.setItem(CHROME_OFFER_DISMISS_KEY, '1');
    } catch (error) {
      /* storage unavailable: dismissal stays session-only */
    }
    setDismissed(true);
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(instructions.url);
      setCopied(instructions.copiedLabel);
    } catch (error) {
      setCopied(tExample(activeLocale, 'chromeCopyFallback'));
    }
  }

  return (
    <aside className="chrome-handoff" role="region" aria-label={tExample(activeLocale, 'chromeHandoffRegion')}>
      <p className="chrome-handoff-text">{instructions.intro}</p>
      <div className="chrome-handoff-actions">
        <button
          className="chrome-handoff-open"
          type="button"
          onClick={() => handoff.open(window.location.href, setManual)}
        >
          {instructions.openLabel}
        </button>
        <button className="chrome-handoff-dismiss" type="button" onClick={dismiss}>
          {instructions.dismissLabel}
        </button>
      </div>
      {manual ? (
        <div className="chrome-handoff-fallback">
          <ol className="chrome-handoff-steps">
            {manual.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <code className="chrome-handoff-url">{manual.url}</code>
          <div className="chrome-handoff-actions">
            <button className="chrome-handoff-copy" type="button" onClick={copyAddress}>
              {manual.copyLabel}
            </button>
            <span className="chrome-handoff-status" role="status">
              {copied}
            </span>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function AssistantFloatingWidget() {
  const state = useSyncExternalStore(
    assistantStore.subscribe,
    assistantStore.getSnapshot,
    assistantStore.getServerSnapshot
  );
  const [open, setOpen] = useState(false);
  const activeLocale = resolveExampleLocale(state.locale);
  const dict = useMemo(() => getExampleDictionary(activeLocale), [activeLocale]);
  const appearance = state.appearance || fallbackState.appearance;
  const resolvedTheme = useResolvedTheme(appearance);
  const widgetRef = useRef(null);
  const toggleRef = useRef(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const focusWasInPanel = useRef(false);
  const badge = state.badge || fallbackState.badge;
  const actionable = ACTIONABLE_TONES.has(badge.tone);
  const notifications = state.notifications || [];
  const network = state.network || fallbackState.network;
  const installation = state.installation || fallbackState.installation;
  const project = state.project || fallbackState.project;
  const capabilities = state.capabilities || fallbackState.capabilities;
  const panelPlan = planPanelActions(state, (id, kind) => actionEnabled(state, id, kind));
  const recoverySteps = activeLocale === 'en' ? RECOVERY_STEPS : (dict.recoverySteps || RECOVERY_STEPS);

  useEffect(() => {
    applyWorkspaceStaticTranslations(activeLocale);
  }, [activeLocale]);

  useEffect(() => {
    if (!open) return undefined;

    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.pwa-flow')) return;
      closePanel(true);
    }
    function closeOnOutsidePointer(event) {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) setOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) {
      focusWasInPanel.current = false;
      return;
    }
    if (panel.contains(document.activeElement)) return;
    if (focusWasInPanel.current && document.activeElement === document.body && closeRef.current) {
      closeRef.current.focus({ preventScroll: true });
    }
  });

  function trackPanelFocus(event) {
    if (event.type === 'focus') focusWasInPanel.current = true;
    else if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focusWasInPanel.current = false;
  }

  function closePanel(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus && toggleRef.current) toggleRef.current.focus({ preventScroll: true });
  }

  const fabOpenLabel = `${dict.openAssistantMenu}${badge.count ? `, ${tExample(activeLocale, 'alerts', { count: badge.count })}, ${badge.label}` : `, ${dict.noAlerts}`}`;

  return (
    <div
      className="assistant-widget"
      ref={widgetRef}
      dir={getLocaleDirection(activeLocale)}
      data-position={appearance.position || 'bottom-right'}
      data-theme={resolvedTheme.mode}
      data-scheme={resolvedTheme.scheme}
      data-theme-inherit={resolvedTheme.inheritHost ? '' : undefined}
      style={themeStyle(resolvedTheme)}
    >
      <section
        className={`assistant-panel${open ? ' is-open' : ''}`}
        id="assistant-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="assistant-panel-title"
        aria-describedby="assistant-panel-description"
        hidden={!open}
        ref={panelRef}
        onFocus={trackPanelFocus}
        onBlur={trackPanelFocus}
      >
        <header className="assistant-panel-header">
          <img className="assistant-panel-brand" src={project.icon || 'icons/icon-192.png'} alt="" width="40" height="40" />
          <h2 className="assistant-panel-title" id="assistant-panel-title">{project.name}</h2>
          <button
            className="assistant-panel-close"
            type="button"
            aria-label={dict.closeAssistantMenu}
            ref={closeRef}
            onClick={() => closePanel(true)}
          >
            ×
          </button>
        </header>
        <p className="assistant-panel-description" id="assistant-panel-description">
          {(project.shortName || 'You.Ge')} · {(project.hostname || 'localhost')} — {dict.workspaceHint}
        </p>

        <SpotlightCard
          className="assistant-status-card"
          theme="light"
          spotlightColor="#17634f"
          spotlightSize={180}
          intensity={0.1}
          borderGlow={0.2}
          proximity={48}
          smoothing={0.3}
          softness={0.7}
          shape="circle"
          ambient={false}
          flare={false}
          grain={0}
        >
          <div className="assistant-status-grid" role="group" aria-label={dict.connectionStatusLabel}>
            <span><i className={`connection-dot${network.online === false ? ' is-offline' : ''}`} aria-hidden="true" />{network.online === false ? dict.offline : dict.online}</span>
            <span>{dict.primaryLabel}: {network.endpoints?.primary || 'unknown'}</span>
            {capabilities.failover !== false ? <span>{dict.backupLabel}: {network.endpoints?.backup || 'inactive'}</span> : null}
            <span>{dict.dnsLabel}: {(network.dns?.classification || 'not checked').replace(/_/g, ' ')}</span>
          </div>
          {network.dns?.status === 'running' ? (
            <LatticeLoader
              label={dict.checking}
              status="working"
              showTimer={false}
              fontSize={11}
              color="#17634f"
              className="assistant-loader"
            />
          ) : null}
        </SpotlightCard>

        <div className="assistant-notice-block" aria-live="polite">
          {notifications.length ? (
            <ul className="assistant-notice-list">
              {notifications.map((notice) => (
                <li
                  className={`assistant-notice priority-${notice.priority}`}
                  key={notice.id}
                  data-tone={notice.tone}
                  data-level={notice.level}
                  aria-label={tExample(activeLocale, 'noticeAria', { level: notificationLevelLabel(notice.level, activeLocale) })}
                >
                  <NotificationIcon level={notice.level} />
                  <div className="assistant-notice-copy">
                    <strong>{notice.title}</strong>
                    <p>{notice.message}</p>
                  </div>
                  <div className="assistant-notice-controls">
                    {panelPlan.noticesWithAction.has(notice.id) ? (
                      <button
                        type="button"
                        {...toolkitHook(notice.actionId)}
                        onClick={() => dispatchWidgetAction(notice.actionId, 'notice')}
                      >
                        {noticeActionLabel(state, notice)}
                      </button>
                    ) : null}
                    {notice.critical ? (
                      <button type="button" onClick={() => YouGeAssistant.attach().acknowledge(notice.id)}>{dict.acknowledge}</button>
                    ) : (
                      <button type="button" onClick={() => YouGeAssistant.attach().dismiss(notice.id)}>{dict.dismiss}</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="assistant-panel-empty" role="status">{dict.allClear}</p>
          )}
        </div>

        {capabilities.diagnostics !== false && panelPlan.showDiagnostics ? (
          <button
            className="assistant-panel-action"
            type="button"
            data-pwa-diagnostics
            onClick={() => { dispatchWidgetAction('diagnostics', 'diagnostics'); closePanel(true); }}
          >
            <span aria-hidden="true">⌁</span>
            <span><strong>{dict.networkDiagnostics}</strong><small>{dict.diagnosticsSubtitle}</small></span>
            <span className="assistant-action-arrow" aria-hidden="true">→</span>
          </button>
        ) : null}
        {panelPlan.showRecovery ? (
          <details className="assistant-panel-recovery">
            <summary>{dict.recoveryGuidance}</summary>
            <ol>
              {recoverySteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </details>
        ) : null}
        {panelPlan.showInstall ? (
          <button
            className="assistant-panel-action"
            type="button"
            data-pwa-install
            onClick={() => { dispatchWidgetAction('install', 'install'); closePanel(true); }}
          >
            <span aria-hidden="true">＋</span>
            <span><strong>{installation.nativeAvailable ? dict.installApp : dict.installInstructions}</strong><small>{dict.installSubtitle}</small></span>
            <span className="assistant-action-arrow" aria-hidden="true">→</span>
          </button>
        ) : null}
        {panelPlan.extraActions.map((action) => (
          <button
            className="assistant-panel-action"
            type="button"
            key={action.id}
            {...toolkitHook(action.id)}
            onClick={() => { dispatchWidgetAction(action.id, action.kind); if (action.id !== 'update') closePanel(true); }}
          >
            <span aria-hidden="true">↗</span>
            <span><strong>{action.label}</strong><small>{action.message || dict.projectActionFallback}</small></span>
            <span className="assistant-action-arrow" aria-hidden="true">→</span>
          </button>
        ))}
        <a className="assistant-panel-link" href="#today" onClick={() => closePanel(false)}>
          {dict.goToWorkspace} <span aria-hidden="true">↗</span>
        </a>
      </section>

      <span className="visually-hidden" role="status" aria-live="polite">
        {badge.count ? tExample(activeLocale, 'alertSummary', { count: badge.count, label: badge.label }) : dict.noAlertSummary}
      </span>

      {/* The offer unmounts while the panel is open so it never covers it. */}
      {open ? null : <ChromeHandoffBanner locale={activeLocale} />}

      <GlareHover
        className="assistant-fab-glare"
        width="66px"
        height="66px"
        background="transparent"
        borderRadius="50%"
        borderColor="transparent"
        glareColor={actionable ? '#f6ccc6' : '#ffffff'}
        glareOpacity={0.08}
        glareSize={18}
        mode="hover"
        playOnce
      >
        <button
          className="assistant-fab"
          ref={toggleRef}
          type="button"
          aria-label={open ? dict.closeAssistantMenu : fabOpenLabel}
          aria-controls="assistant-panel"
          aria-expanded={open}
          aria-haspopup="dialog"
          title="You.Ge Assistant"
          data-tone={badge.tone}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          <span className="assistant-fab-stage" aria-hidden="true">
            <img className="assistant-mark-image" src={assistantMark} alt="" />
          </span>
          {badge.count > 0 ? (
            <span className="assistant-badge" data-tone={badge.tone} aria-hidden="true">
              {badge.count > 9 ? '9+' : badge.count}
            </span>
          ) : null}
          <span className="visually-hidden">{open ? dict.closeAssistant : dict.openAssistant}</span>
        </button>
      </GlareHover>
    </div>
  );
}

/* Theme ownership lives here, once. */
function ThemeStudioHost() {
  const state = useSyncExternalStore(
    assistantStore.subscribe,
    assistantStore.getSnapshot,
    assistantStore.getServerSnapshot
  );
  const appearance = state.appearance || fallbackState.appearance;
  const badge = state.badge || fallbackState.badge;
  const activeLocale = resolveExampleLocale(state.locale);
  const hostScheme = useMemo(() => {
    const probe = resolveAppearanceTheme({ ...appearance, theme: 'auto', themeConfig: { mode: 'auto' } }, { root: window, document });
    return probe.scheme;
  }, [appearance]);

  function changeTheme(theme) {
    YouGeAssistant.attach().configure({ theme });
  }

  return (
    <ThemeStudio
      currentTheme={appearance.themeConfig || appearance.theme}
      onChange={changeTheme}
      hostScheme={hostScheme}
      badgeCount={badge.count || 0}
      locale={activeLocale}
    />
  );
}

const workspaceLangSelect = document.getElementById('workspace-language');
if (workspaceLangSelect) {
  const assistant = YouGeAssistant.attach();
  const populateOptions = (locale, configuredLocale) => {
    const active = resolveExampleLocale(locale);
    const targetConfigured =
      configuredLocale !== undefined
        ? configuredLocale
        : (typeof assistant.getConfig === 'function' ? assistant.getConfig().locale : 'auto');
    const desiredVal = targetConfigured === 'auto' ? 'auto' : active;
    const options = buildLocaleOptions(active);
    workspaceLangSelect.textContent = '';
    options.forEach((opt) => {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      workspaceLangSelect.appendChild(el);
    });
    const exists = options.some((o) => o.value === desiredVal);
    workspaceLangSelect.value = exists ? desiredVal : active;
    const labelEl = document.getElementById('workspace-language-label');
    if (labelEl) labelEl.textContent = tExample(active, 'languageLabel');
  };
  populateOptions(assistant.getLocale());
  workspaceLangSelect.addEventListener('change', (event) => {
    const val = event.target.value;
    syncExampleLocale(val, assistant);
    populateOptions(assistant.getLocale(), val);
  });
  window.addEventListener('youge:locale-change', (event) => {
    populateOptions(assistant.getLocale(), event?.detail?.configuredLocale);
  });
}

const mount = document.getElementById('assistant-floating-root');
if (mount) createRoot(mount).render(<AssistantFloatingWidget />);

const themeMount = document.getElementById('assistant-theme-studio');
if (themeMount) createRoot(themeMount).render(<ThemeStudioHost />);

const foundationMount = document.getElementById('assistant-foundation-root');
if (foundationMount) createRoot(foundationMount).render(<FoundationPreview />);
