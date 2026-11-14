import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { YouGeAssistant, createChromeHandoff } from '@youge/assistant-sdk';
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

/* The red state is not a second source of truth: it reads the SDK badge tone,
 * which is already the tone of the highest-priority notice the user has not
 * dismissed or acknowledged. This list is the same actionable set
 * assistant-widget.css applies to .youge-fab (critical, auth, install); it
 * exists only so the animated accent follows the same rule as the fill.
 * `backup` and `info` stay calm — they describe what is happening, not what to
 * do — and a running diagnostic adds no notice at all, so loading never reads
 * as urgent. */
const ACTIONABLE_TONES = new Set(['critical', 'auth', 'install']);

function noticeActionLabel(state, notice) {
  const match = (state.availableActions || []).find((action) => action.id === notice.actionId);
  if (match && match.label) return match.label;
  return NOTICE_ACTION_LABELS[notice.actionId] || 'Open';
}

/* Android in-app browser → Chrome handoff (SDK 0.1.1). The SDK only ever
 * reports a confident restricted in-app detection (Facebook, Messenger,
 * Instagram or an Android webview on Android); every other browser — normal
 * Chrome, Safari, or an unknown user agent — renders nothing at all, and no
 * navigation happens unless the visitor presses "Open in Chrome". */
const CHROME_OFFER_DISMISS_KEY = 'youge-assistant:chrome-offer-dismissed';

function ChromeHandoffBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(CHROME_OFFER_DISMISS_KEY) === '1';
    } catch (error) {
      return false;
    }
  });
  const [manual, setManual] = useState(null);
  const [copied, setCopied] = useState('');
  const [handoff] = useState(() =>
    createChromeHandoff({
      userAgent: navigator.userAgent,
      location: window.location,
      document,
    })
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
      setCopied('Select the address above to copy it manually.');
    }
  }

  return (
    <aside className="chrome-handoff" role="region" aria-label="Open in Chrome">
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
  const appearance = state.appearance || fallbackState.appearance;
  const resolvedTheme = useResolvedTheme(appearance);
  const widgetRef = useRef(null);
  const toggleRef = useRef(null);
  const badge = state.badge || fallbackState.badge;
  const actionable = ACTIONABLE_TONES.has(badge.tone);
  const notifications = state.notifications || [];
  const network = state.network || fallbackState.network;
  const installation = state.installation || fallbackState.installation;
  const project = state.project || fallbackState.project;
  const extraActions = (state.availableActions || []).filter(
    (action) => action.id !== 'diagnostics' && action.id !== 'install'
  );

  useEffect(() => {
    if (!open) return undefined;

    function closeOnEscape(event) {
      if (event.key === 'Escape') closePanel(true);
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

  function closePanel(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus && toggleRef.current) toggleRef.current.focus({ preventScroll: true });
  }

  return (
    <div
      className="assistant-widget"
      ref={widgetRef}
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
      >
        <header className="assistant-panel-header">
          <img className="assistant-panel-brand" src={project.icon || 'icons/icon-192.png'} alt="" width="40" height="40" />
          <h2 className="assistant-panel-title" id="assistant-panel-title">{project.name}</h2>
          <button
            className="assistant-panel-close"
            type="button"
            aria-label="Close assistant menu"
            onClick={() => closePanel(true)}
          >
            ×
          </button>
        </header>
        <p className="assistant-panel-description" id="assistant-panel-description">
          {(project.shortName || 'You.Ge')} · {(project.hostname || 'localhost')} — prioritized help for this workspace.
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
          <div className="assistant-status-grid" role="group" aria-label="Connection status">
            <span><i className={`connection-dot${network.online === false ? ' is-offline' : ''}`} aria-hidden="true" />{network.online === false ? 'Offline' : 'Online'}</span>
            <span>Primary: {network.endpoints?.primary || 'unknown'}</span>
            <span>Backup: {network.endpoints?.backup || 'inactive'}</span>
            <span>DNS: {(network.dns?.classification || 'not checked').replace(/_/g, ' ')}</span>
          </div>
          {network.dns?.status === 'running' ? (
            <LatticeLoader
              label="Checking connection"
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
                  aria-label={`${notificationLevelLabel(notice.level)} notice`}
                >
                  <NotificationIcon level={notice.level} />
                  <div className="assistant-notice-copy">
                    <strong>{notice.title}</strong>
                    <p>{notice.message}</p>
                  </div>
                  <div className="assistant-notice-controls">
                    <button
                      type="button"
                      {...(notice.actionId === 'install'
                        ? { 'data-pwa-install': '' }
                        : notice.actionId === 'diagnostics'
                          ? { 'data-pwa-diagnostics': '' }
                          : {})}
                      onClick={() => dispatchWidgetAction(notice.actionId || notice.id, 'notice')}
                    >
                      {noticeActionLabel(state, notice)}
                    </button>
                    {notice.critical ? (
                      <button type="button" onClick={() => YouGeAssistant.attach().acknowledge(notice.id)}>Acknowledge</button>
                    ) : (
                      <button type="button" onClick={() => YouGeAssistant.attach().dismiss(notice.id)}>Dismiss</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="assistant-panel-empty" role="status">All clear — the Assistant is still available for help.</p>
          )}
        </div>

        <button
          className="assistant-panel-action"
          type="button"
          data-pwa-diagnostics
          onClick={() => { dispatchWidgetAction('diagnostics', 'diagnostics'); closePanel(true); }}
        >
          <span aria-hidden="true">⌁</span>
          <span><strong>Network diagnostics</strong><small>Check this connection on demand</small></span>
          <span className="assistant-action-arrow" aria-hidden="true">→</span>
        </button>
        {installation.status === 'available' ? (
          <button
            className="assistant-panel-action"
            type="button"
            data-pwa-install
            onClick={() => { dispatchWidgetAction('install', 'install'); closePanel(true); }}
          >
            <span aria-hidden="true">＋</span>
            <span><strong>{installation.nativeAvailable ? 'Install this app' : 'Installation instructions'}</strong><small>Add it to your home screen</small></span>
            <span className="assistant-action-arrow" aria-hidden="true">→</span>
          </button>
        ) : null}
        {extraActions.map((action) => (
          <button
            className="assistant-panel-action"
            type="button"
            key={action.id}
            onClick={() => { dispatchWidgetAction(action.id, action.kind); if (action.id !== 'update') closePanel(true); }}
          >
            <span aria-hidden="true">↗</span>
            <span><strong>{action.label}</strong><small>{action.message || 'Project-specific action'}</small></span>
            <span className="assistant-action-arrow" aria-hidden="true">→</span>
          </button>
        ))}
        <a className="assistant-panel-link" href="#today" onClick={() => closePanel(false)}>
          Go to today’s workspace <span aria-hidden="true">↗</span>
        </a>
      </section>

      <span className="visually-hidden" role="status" aria-live="polite">
        {badge.count ? `${badge.count} alerts. Highest priority: ${badge.label}.` : 'No alerts.'}
      </span>

      {/* The offer unmounts while the panel is open so it never covers it. */}
      {open ? null : <ChromeHandoffBanner />}

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
          aria-label={open ? 'Close You.Ge Assistant menu' : `Open You.Ge Assistant menu${badge.count ? `, ${badge.count} alerts, ${badge.label}` : ', no alerts'}`}
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
          <span className="visually-hidden">{open ? 'Close assistant' : 'Open assistant'}</span>
        </button>
      </GlareHover>
    </div>
  );
}

/* Theme ownership lives here, once. The studio writes configuration into the
 * shared assistant singleton; the floating widget reads it back through the same
 * `useSyncExternalStore` subscription the rest of the sample uses. Nothing in the
 * example keeps a parallel theme model. */
function ThemeStudioHost() {
  const state = useSyncExternalStore(
    assistantStore.subscribe,
    assistantStore.getSnapshot,
    assistantStore.getServerSnapshot
  );
  const appearance = state.appearance || fallbackState.appearance;
  const badge = state.badge || fallbackState.badge;
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
    />
  );
}

const mount = document.getElementById('assistant-floating-root');
if (mount) createRoot(mount).render(<AssistantFloatingWidget />);

const themeMount = document.getElementById('assistant-theme-studio');
if (themeMount) createRoot(themeMount).render(<ThemeStudioHost />);

const foundationMount = document.getElementById('assistant-foundation-root');
if (foundationMount) createRoot(foundationMount).render(<FoundationPreview />);
