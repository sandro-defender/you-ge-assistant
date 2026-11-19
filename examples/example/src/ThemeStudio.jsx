import React, { useMemo, useState } from 'react';
import {
  NOTIFICATION_LEVEL_LABELS,
  NOTIFICATION_LEVELS,
  THEME_MODES,
  contrastRatio,
  resolveTheme,
} from '@youge/assistant-sdk';
import { notificationLevelElement } from '@youge/assistant-sdk/react';
import { getExampleDictionary, resolveExampleLocale } from './i18n.js';

/** Glyph rendered from the SDK's declarative level shapes — no markup injection. */
function NotificationLevelGlyph({ level }) {
  return notificationLevelElement(level, React.createElement);
}

/* ------------------------------------------------------------------------- *
 * Theme studio for the example application.
 *
 * This is a *demonstration* surface, not a second theme implementation: every
 * value it shows comes from the SDK (`resolveTheme`, `NOTIFICATION_LEVEL_*`,
 * `contrastRatio`), which is the same code the embedded widget
 * (`assistant-widget.js`) uses. Switching a mode here calls
 * `YouGeAssistant.attach().configure({ theme })`, so the sample panel and the
 * shipped widget are driven by one configuration.
 * ------------------------------------------------------------------------- */

export const HOST_PRESETS = [
  {
    id: 'studio-light',
    label: 'Studio (light)',
    scheme: 'light',
    description: 'Neutral product site, system font, blue accent.',
    theme: {
      mode: 'auto',
      inheritHost: true,
      host: { primary: '#2563eb', surface: '#ffffff', surfaceSoft: '#f8fafc', text: '#0f172a', mutedText: '#475569', border: '#e2e8f0' },
    },
  },
  {
    id: 'studio-dark',
    label: 'Studio (dark)',
    scheme: 'dark',
    description: 'Dark-first product site with a bright accent.',
    theme: {
      mode: 'auto',
      inheritHost: true,
      host: { primary: '#60a5fa', surface: '#0b1220', surfaceSoft: '#111c2f', text: '#f8fafc', mutedText: '#cbd5e1', border: '#334155' },
    },
  },
  {
    id: 'editorial',
    label: 'Editorial serif',
    scheme: 'light',
    description: 'Warm paper palette with a serif stack.',
    theme: {
      mode: 'auto',
      inheritHost: true,
      host: {
        primary: '#8a4b2a',
        surface: '#fdf8f2',
        surfaceSoft: '#f7efe4',
        text: '#2b1f16',
        mutedText: '#6b5a4a',
        border: '#e6d8c6',
        fontFamily: 'Georgia, "Times New Roman", serif',
        radius: 8,
      },
    },
  },
  {
    id: 'neon',
    label: 'Low-contrast trap',
    scheme: 'dark',
    description: 'Deliberately unreadable host values: the contrast guard rejects them.',
    theme: {
      mode: 'auto',
      inheritHost: true,
      host: { primary: '#39ff14', surface: '#101010', text: '#1a1a1a', mutedText: '#202020', border: '#141414' },
    },
  },
];

export const CUSTOM_PRESETS = [
  {
    id: 'violet',
    label: 'Violet',
    description: 'Product-brand violet with soft radii.',
    tokens: {
      primary: '#7c3aed', surface: '#ffffff', surfaceSoft: '#faf7ff', text: '#1f1235',
      mutedText: '#5b5370', border: '#e9e3f5', radius: 16, radiusSmall: 10,
      fontFamily: 'Inter, system-ui, sans-serif',
      shadow: '0 18px 40px rgba(31, 18, 53, 0.14)',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Restrained neutral with square geometry.',
    tokens: {
      primary: '#0f172a', surface: '#ffffff', surfaceSoft: '#f8fafc', text: '#0f172a',
      mutedText: '#475569', border: '#cbd5e1', radius: 6, radiusSmall: 4,
      fontFamily: 'system-ui, sans-serif',
      shadow: '0 12px 28px rgba(15, 23, 42, 0.12)',
    },
  },
];

const MODE_LABELS = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
  custom: 'Custom',
};

const MODE_HELP = {
  auto: 'Assistant identity, scheme detected from the host page and the OS.',
  light: 'Always the Assistant light theme. The host page is never consulted.',
  dark: 'Always the Assistant dark theme. The host page is never consulted.',
  custom: 'Your tokens, validated field by field with safe fallbacks.',
};

function variableStyle(resolved) {
  const style = {};
  Object.keys(resolved.variables || {}).forEach((name) => {
    style[name] = resolved.variables[name];
  });
  style.colorScheme = resolved.scheme;
  return style;
}

/** A miniature of the shipped widget surface, driven by the same tokens. */
function ThemePreview({ resolved, label, mode, badgeCount, dict }) {
  const modeLabel = (dict.tsModes && dict.tsModes[mode]?.label) || MODE_LABELS[mode] || mode;
  return (
    <figure className={`theme-preview scheme-${resolved.scheme}`} style={variableStyle(resolved)}>
      <div className="theme-preview-surface">
        <header className="theme-preview-head">
          <span className="theme-preview-mark" aria-hidden="true">YG</span>
          <span className="theme-preview-title">You.Ge Assistant</span>
          <span className="theme-preview-close" aria-hidden="true">×</span>
        </header>
        <p className="theme-preview-kicker">{dict.tsPreviewConnStatus}</p>
        <div className="theme-preview-status">
          <span><i className="theme-preview-dot is-ok" aria-hidden="true" />{dict.online}</span>
          <span>{dict.tsPreviewPrimaryHealthy}</span>
        </div>
        <p className="theme-preview-kicker">{dict.tsPreviewNeedsAttn}</p>
        <article className="theme-preview-notice" data-level="warning">
          <span className="theme-preview-notice-icon" aria-hidden="true">
            <NotificationLevelGlyph level="warning" />
          </span>
          <span>
            <strong>{dict.tsPreviewSessionAttn}</strong>
            <span className="theme-preview-notice-copy">{dict.tsPreviewSessionBody}</span>
          </span>
        </article>
        <div className="theme-preview-actions">
          <span className="theme-preview-btn">{dict.tsPreviewDiagnostics}</span>
          <span className="theme-preview-btn is-quiet">{dict.dismiss}</span>
        </div>
      </div>
      <span className="theme-preview-fab" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c-4.4 0-8 3.1-8 7v4.5c0 1.1-.4 2.1-1.2 2.9L2 19h4.2c1 1.2 2.6 2 4.8 2 1.4 0 2.6-.3 3.6-.8" />
          <path d="M20 13V10c0-3.9-3.6-7-8-7" />
        </svg>
        {badgeCount ? <span className="theme-preview-badge">{badgeCount}</span> : null}
      </span>
      <figcaption>
        <strong>{label}</strong>
        <span>{modeLabel} · {resolved.scheme}</span>
      </figcaption>
    </figure>
  );
}

function ContrastRow({ label, foreground, background, dict }) {
  const ratio = contrastRatio(foreground, background);
  const status = ratio === null ? 'unknown' : ratio >= 4.5 ? 'pass' : 'fail';
  return (
    <li className="contrast-row" data-status={status}>
      <span className="contrast-swatch" style={{ background, color: foreground }} aria-hidden="true">Aa</span>
      <span className="contrast-label">{label}</span>
      <span className="contrast-value">{ratio === null ? dict.tsNotMeasurable : `${ratio.toFixed(2)}:1`}</span>
      <span className="contrast-verdict">{status === 'pass' ? 'AA' : status === 'fail' ? dict.tsBelowTarget : '—'}</span>
    </li>
  );
}

function NotificationGallery({ resolved, dict, activeLocale }) {
  return (
    <div className="notice-gallery" style={variableStyle(resolved)} data-scheme={resolved.scheme}>
      {NOTIFICATION_LEVELS.map((level) => {
        const levelInfo = dict.tsLevels && dict.tsLevels[level];
        const title = activeLocale === 'en' ? NOTIFICATION_LEVEL_LABELS[level] : (levelInfo?.label || NOTIFICATION_LEVEL_LABELS[level]);
        const description =
          (level === 'critical' && levelInfo?.body)
          || (level === 'error' && levelInfo?.body)
          || (level === 'warning' && levelInfo?.body)
          || (level === 'info' && levelInfo?.body)
          || (level === 'success' && levelInfo?.body)
          || '';
        return (
          <article className="notice-demo" data-level={level} key={level}>
            <span className="notice-demo-icon" aria-hidden="true">
              <NotificationLevelGlyph level={level} />
            </span>
            <span className="notice-demo-body">
              <strong>{title}</strong>
              <span>{description}</span>
            </span>
            <span className="notice-demo-actions">
              {level === 'critical' ? (
                <button type="button" className="notice-demo-btn">{dict.acknowledge}</button>
              ) : (
                <>
                  <button type="button" className="notice-demo-btn">{dict.open}</button>
                  <button type="button" className="notice-demo-btn is-quiet">{dict.dismiss}</button>
                </>
              )}
            </span>
          </article>
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   currentTheme: import('@youge/assistant-sdk').AssistantThemeConfig,
 *   onChange: (theme: any) => void,
 *   hostScheme: 'light' | 'dark',
 *   badgeCount?: number,
 *   locale?: string,
 * }} props
 */
export default function ThemeStudio({ currentTheme, onChange, hostScheme, badgeCount = 0, locale = 'en' }) {
  const activeLocale = resolveExampleLocale(locale);
  const dict = useMemo(() => getExampleDictionary(activeLocale), [activeLocale]);
  const [hostPresetId, setHostPresetId] = useState(HOST_PRESETS[0].id);
  const [customPresetId, setCustomPresetId] = useState(CUSTOM_PRESETS[0].id);
  const [hostSchemeOverride, setHostSchemeOverride] = useState('auto');

  const activeMode = typeof currentTheme === 'string' ? currentTheme : currentTheme.mode;

  const previews = useMemo(() => {
    const themeConfig = typeof currentTheme === 'string' ? { mode: currentTheme } : currentTheme;
    return {
      light: resolveTheme(themeConfig, { hostScheme: 'light', matchMedia: null }),
      dark: resolveTheme(themeConfig, { hostScheme: 'dark', matchMedia: null }),
      live: resolveTheme(themeConfig, { hostScheme: hostSchemeOverride === 'auto' ? hostScheme : hostSchemeOverride, matchMedia: null }),
    };
  }, [currentTheme, hostScheme, hostSchemeOverride]);

  const customPreview = useMemo(() => {
    const preset = CUSTOM_PRESETS.find((entry) => entry.id === customPresetId) || CUSTOM_PRESETS[0];
    return { preset, resolved: resolveTheme({ mode: 'custom', tokens: preset.tokens }, { matchMedia: null }) };
  }, [customPresetId]);

  const hostResolved = useMemo(() => {
    const preset = HOST_PRESETS.find((entry) => entry.id === hostPresetId) || HOST_PRESETS[0];
    return { preset, resolved: resolveTheme(preset.theme, { hostScheme: preset.scheme, matchMedia: null }) };
  }, [hostPresetId]);

  const warnings = useMemo(() => {
    const collected = new Set();
    [previews.live, hostResolved.resolved, customPreview.resolved].forEach((resolved) => {
      (resolved.warnings || []).forEach((code) => collected.add(code));
    });
    return [...collected];
  }, [previews, hostResolved, customPreview]);

  function selectMode(mode) {
    if (mode === 'custom') {
      const preset = CUSTOM_PRESETS.find((entry) => entry.id === customPresetId) || CUSTOM_PRESETS[0];
      onChange({ mode: 'custom', tokens: preset.tokens });
      return;
    }
    onChange(mode);
  }

  function selectCustomPreset(id) {
    setCustomPresetId(id);
    const preset = CUSTOM_PRESETS.find((entry) => entry.id === id) || CUSTOM_PRESETS[0];
    onChange({ mode: 'custom', tokens: preset.tokens });
  }

  function applyHostPreset(id) {
    setHostPresetId(id);
    const preset = HOST_PRESETS.find((entry) => entry.id === id) || HOST_PRESETS[0];
    onChange(preset.theme);
  }

  const customLabel = (id, fallback) => (dict.tsCustomPresets && dict.tsCustomPresets[id]?.label) || fallback;
  const customDesc = (id, fallback) => (dict.tsCustomPresets && dict.tsCustomPresets[id]?.description) || fallback;
  const hostLabel = (id, fallback) => (dict.tsHostPresets && dict.tsHostPresets[id]?.label) || fallback;
  const hostDesc = (id, fallback) => (dict.tsHostPresets && dict.tsHostPresets[id]?.description) || fallback;

  return (
    <section className="theme-studio" id="theme-studio" aria-labelledby="theme-studio-title">
      <div className="theme-studio-head">
        <p className="card-kicker">{dict.tsKicker}</p>
        <h2 id="theme-studio-title">{dict.tsTitle}</h2>
        <p className="theme-studio-intro">{dict.tsIntro}</p>
      </div>

      <div className="theme-studio-grid">
        <fieldset className="theme-control">
          <legend>{dict.tsThemeModeLegend}</legend>
          <div className="theme-mode-list" role="radiogroup" aria-label={dict.tsThemeModeLegend}>
            {THEME_MODES.map((mode) => (
              <label className={`theme-mode${activeMode === mode ? ' is-active' : ''}`} key={mode}>
                <input
                  type="radio"
                  name="youge-theme-mode"
                  value={mode}
                  checked={activeMode === mode}
                  onChange={() => selectMode(mode)}
                />
                <span>
                  <strong>{(dict.tsModes && dict.tsModes[mode]?.label) || MODE_LABELS[mode]}</strong>
                  <small>{(dict.tsModes && dict.tsModes[mode]?.help) || MODE_HELP[mode]}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="theme-control">
          <legend>{dict.tsPreviewSchemeLegend}</legend>
          <div className="theme-segmented" role="radiogroup" aria-label={dict.tsPreviewSchemeLegend}>
            {[
              ['auto', dict.tsFollowHost],
              ['light', dict.tsForceLight],
              ['dark', dict.tsForceDark],
            ].map(([value, label]) => (
              <label key={value} className={hostSchemeOverride === value ? 'is-active' : ''}>
                <input
                  type="radio"
                  name="youge-preview-scheme"
                  value={value}
                  checked={hostSchemeOverride === value}
                  onChange={() => setHostSchemeOverride(value)}
                />
                {label}
              </label>
            ))}
          </div>

          <h3 className="theme-control-title">{dict.tsCustomTokensTitle}</h3>
          <div className="theme-chip-row">
            {CUSTOM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`theme-chip${customPresetId === preset.id ? ' is-active' : ''}`}
                onClick={() => selectCustomPreset(preset.id)}
                title={customDesc(preset.id, preset.description)}
              >
                <span className="theme-chip-dot" style={{ background: preset.tokens.primary }} aria-hidden="true" />
                {customLabel(preset.id, preset.label)}
              </button>
            ))}
          </div>
          <p className="theme-control-note">
            {dict.tsCustomTokensNotePrefix}<strong>{dict.tsCustomModeWord}</strong>{dict.tsCustomTokensNoteSuffix}
          </p>
        </fieldset>

        <fieldset className="theme-control">
          <legend>{dict.tsHostWebsiteLegend}</legend>
          <div className="theme-host-list">
            {HOST_PRESETS.map((preset) => (
              <label key={preset.id} className={`theme-host${hostPresetId === preset.id ? ' is-active' : ''}`}>
                <input
                  type="radio"
                  name="youge-host-preset"
                  value={preset.id}
                  checked={hostPresetId === preset.id}
                  onChange={() => applyHostPreset(preset.id)}
                />
                <span>
                  <strong>{hostLabel(preset.id, preset.label)}</strong>
                  <small>{hostDesc(preset.id, preset.description)}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="theme-control-note">
            {dict.tsHostNotePrefix}<strong>{dict.tsAutoModeWord}</strong>{dict.tsHostNoteMiddle}<code>inheritHost: true</code>{dict.tsHostNoteSuffix}
          </p>
        </fieldset>
      </div>

      <div className="theme-preview-row">
        <ThemePreview resolved={previews.light} label={dict.tsPreviewLight} mode={activeMode} badgeCount={badgeCount} dict={dict} />
        <ThemePreview resolved={previews.dark} label={dict.tsPreviewDark} mode={activeMode} badgeCount={badgeCount} dict={dict} />
        <ThemePreview resolved={previews.live} label={dict.tsPreviewLive} mode={activeMode} badgeCount={badgeCount} dict={dict} />
      </div>

      <div className="theme-preview-row">
        <ThemePreview resolved={customPreview.resolved} label={`${dict.tsCustomPrefix} · ${customLabel(customPreview.preset.id, customPreview.preset.label)}`} mode="custom" badgeCount={badgeCount} dict={dict} />
        <ThemePreview resolved={hostResolved.resolved} label={`${dict.tsHostPrefix} · ${hostLabel(hostResolved.preset.id, hostResolved.preset.label)}`} mode="auto" badgeCount={badgeCount} dict={dict} />
        <div className="theme-contrast-card" style={variableStyle(previews.live)}>
          <h3>{dict.tsContrastTitle}</h3>
          <p>{dict.tsContrastDesc}</p>
          <ul>
            <li className="contrast-row" data-status="header">
              <span className="contrast-label">{dict.tsColPair}</span>
              <span className="contrast-value">{dict.tsColRatio}</span>
              <span className="contrast-verdict">{dict.tsColFloor}</span>
            </li>
            <ContrastRow label={dict.tsPairBody} foreground={previews.live.tokens.text} background={previews.live.tokens.surface} dict={dict} />
            <ContrastRow label={dict.tsPairMuted} foreground={previews.live.tokens.mutedText} background={previews.live.tokens.surface} dict={dict} />
            <ContrastRow label={dict.tsPairPrimary} foreground={previews.live.tokens.onPrimary} background={previews.live.tokens.primary} dict={dict} />
          </ul>
        </div>
      </div>

      <div className="theme-notification-block">
        <h3>{dict.tsLevelsTitle}</h3>
        <p>{dict.tsLevelsDesc}</p>
        <NotificationGallery resolved={previews.live} dict={dict} activeLocale={activeLocale} />
      </div>

      {warnings.length ? (
        <div className="theme-warnings" role="status">
          <strong>{dict.tsValidationFeedback}</strong>
          <ul>
            {warnings.map((code) => <li key={code}><code>{code}</code></li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
