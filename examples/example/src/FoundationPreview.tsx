import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  SDK_VERSION,
  YouGeAssistant,
  readToolkitSummary,
  type AssistantState,
} from '@youge/assistant-sdk';
import { createUseAssistant } from '@youge/assistant-sdk/react';
import { resolveExampleLocale, tExample } from './i18n.js';
import GlareHover from './react-bits/GlareHover';
import LatticeLoader from './react-bits/LatticeLoader';
import SpotlightCard from './react-bits/SpotlightCard';

/**
 * A read-only design-system reference surface for the future Assistant
 * dashboard, wired directly to `@youge/assistant-sdk`. It intentionally does
 * not register projects, publish config or call any API: those capabilities
 * arrive in later phases (see docs/architecture/ASSISTANT_ARCHITECTURE.md). Every control that
 * looks like an installation action uses the existing `data-pwa-install` hook
 * from pwa.js.
 */

type IconName = 'install' | 'offline' | 'network' | 'empty';

const useAssistant = createUseAssistant(useSyncExternalStore, () => YouGeAssistant.attach());

const ICON_PATHS: Record<IconName, string> = {
  install: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  offline: 'M4 7a9 9 0 0 1 14.9-2.3M20 7v4h-4M20 17a9 9 0 0 1-14.9 2.3M4 17v-4h4M12 8v4l3 2',
  network: 'M3 12h4l3-7 4 14 3-7h4',
  empty: 'M4 6h16v12H4zM8 10h8M8 14h5',
};

function StatusIcon({ name }: { name: IconName }) {
  return (
    <svg
      className="foundation-icon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function describeInstallation(state: AssistantState, locale: string): string {
  const { installation } = state;
  if (installation.standalone || installation.installed) return tExample(locale, 'installedStatus');
  if (installation.nativeAvailable || installation.canInstall) return tExample(locale, 'nativePromptStatus');
  if (installation.ios) return tExample(locale, 'iosPromptStatus');
  return tExample(locale, 'genericPromptStatus');
}

export default function FoundationPreview() {
  const assistantState = useAssistant();
  const locale = resolveExampleLocale(assistantState.locale);
  const [phase, setPhase] = useState<'checking' | 'ready'>('checking');
  const [connectionNoticeKey, setConnectionNoticeKey] = useState<'' | 'connectionRestoredNotice' | 'offlineNotice'>('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhase('ready');
    }, 320);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setConnectionNoticeKey('connectionRestoredNotice');
    };
    const handleOffline = () => {
      setConnectionNoticeKey('offlineNotice');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const summary = readToolkitSummary(window as unknown as Record<string, unknown>);
  const online = assistantState.network.online !== false;
  const activeOrigin = assistantState.project.hostname || summary.hostname || window.location.hostname;
  const configMeta = YouGeAssistant.attach().getConfig().meta;
  const connectionNotice = connectionNoticeKey ? tExample(locale, connectionNoticeKey) : '';

  const cards = [
    {
      id: 'installation',
      icon: 'install' as IconName,
      kicker: tExample(locale, 'fpCard1Kicker'),
      title: tExample(locale, 'fpCard1Title'),
      body: tExample(locale, 'fpCard1Body'),
      status: describeInstallation(assistantState, locale),
      tone: 'ready' as const,
    },
    {
      id: 'offline',
      icon: 'offline' as IconName,
      kicker: tExample(locale, 'fpCard2Kicker'),
      title: tExample(locale, 'fpCard2Title'),
      body: tExample(locale, 'fpCard2Body'),
      status: tExample(locale, 'fpCard2Status'),
      tone: 'neutral' as const,
    },
    {
      id: 'independence',
      icon: 'network' as IconName,
      kicker: tExample(locale, 'fpCard3Kicker'),
      title: tExample(locale, 'fpCard3Title'),
      body: tExample(locale, 'fpCard3Body'),
      status: tExample(locale, 'fpCard3Status', { version: SDK_VERSION, source: configMeta.source }),
      tone: 'neutral' as const,
    },
  ];

  return (
    <div className="foundation-preview" aria-busy={phase === 'checking'}>
      <div className="foundation-status-row">
        {phase === 'checking' ? (
          <LatticeLoader
            label={tExample(locale, 'checkingCapabilities')}
            status="working"
            showTimer={false}
            fontSize={12}
            color="#17634f"
            className="foundation-loader"
          />
        ) : (
          <p className="foundation-status" role="status">
            <span className={`foundation-status-dot${online ? '' : ' is-offline'}`} aria-hidden="true" />
            <span>
              <strong>{online ? tExample(locale, 'connectedWord') : tExample(locale, 'offlineWord')}</strong> · {tExample(locale, 'activeOriginWord')}: {activeOrigin} · SDK v{SDK_VERSION}
            </span>
          </p>
        )}
      </div>

      <div className="foundation-grid">
        {cards.map((card) => (
          <SpotlightCard
            key={card.id}
            className="foundation-card"
            theme="light"
            spotlightColor="#17634f"
            spotlightSize={220}
            intensity={0.1}
            borderGlow={0.25}
            proximity={64}
            smoothing={0.3}
            softness={0.7}
            shape="circle"
            ambient={false}
            flare={false}
            grain={0}
          >
            <div className="foundation-card-inner">
              <div className="foundation-card-head">
                <span className="foundation-card-icon" aria-hidden="true">
                  <StatusIcon name={card.icon} />
                </span>
                <p className="card-kicker">{card.kicker}</p>
              </div>
              <h3>{card.title}</h3>
              <p className="foundation-card-body">{card.body}</p>
              <p className={`foundation-card-status${card.tone === 'ready' ? ' is-ready' : ''}`}>
                <span className="foundation-card-status-dot" aria-hidden="true" />
                {card.status}
              </p>
            </div>
          </SpotlightCard>
        ))}
      </div>

      <div className="foundation-empty" role="status" aria-live="polite">
        <span className="foundation-empty-icon" aria-hidden="true">
          <StatusIcon name="empty" />
        </span>
        <div className="foundation-empty-copy">
          <strong>{tExample(locale, 'noProjectsTitle')}</strong>
          <p>{tExample(locale, 'noProjectsBody')}</p>
        </div>
        <button
          className="foundation-empty-action"
          type="button"
          disabled
          aria-describedby="foundation-empty-note"
        >
          {tExample(locale, 'registerProject')}
        </button>
        <span className="visually-hidden" id="foundation-empty-note">
          {tExample(locale, 'emptyNote')}
        </span>
      </div>

      <div className="foundation-actions">
        <p className="foundation-actions-copy">
          {tExample(locale, 'installCtaCopy')}
        </p>
        <GlareHover
          className="foundation-cta-glare"
          width="auto"
          height="auto"
          background="transparent"
          borderRadius="14px"
          glareColor="#ffffff"
          glareOpacity={0.22}
          glareSize={26}
          mode="hover"
          playOnce
        >
          <button className="foundation-cta" type="button" data-pwa-install>
            <StatusIcon name="install" />
            {tExample(locale, 'installCtaBtn')}
          </button>
        </GlareHover>
      </div>

      <p className={`foundation-toast${connectionNotice ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {connectionNotice}
      </p>
    </div>
  );
}
