/** Pure preview model built from real public SDK configuration and i18n APIs. */
import { resolveAssistantConfig } from '@youge/assistant-sdk';
import {
  SUPPORTED_LOCALES,
  LOCALE_METADATA,
  resolveLocale,
  normalizeLocaleTag,
  normalizeInstallLocaleTag,
  translate,
  isRtlLocale,
} from '@youge/assistant-sdk/i18n';
import { buildSdkConfig } from './options.js';

export function buildPreviewModel(settings, options = {}) {
  const resolved = resolveAssistantConfig(buildSdkConfig(settings), {
    storage: null,
    fallbackProjectId: 'playground-preview',
  });
  const config = resolved.config;
  const locale = settings.locale === 'auto'
    ? resolveLocale({ navigator: options.navigator || null })
    : normalizeLocaleTag(settings.locale) || 'en';
  const installLocale = normalizeInstallLocaleTag(settings.installLocale, 'auto');
  const dialogOnly = installLocale !== 'auto' && !SUPPORTED_LOCALES.includes(installLocale);
  const t = (key) => translate(locale, key);

  return {
    enabled: config.enabled,
    position: config.position,
    theme: config.themeMode,
    themeLabel: config.theme.inheritHost ? `${config.themeMode} · follows host` : config.themeMode,
    locale,
    localeLabel: `${locale}${LOCALE_METADATA[locale] ? ` · ${LOCALE_METADATA[locale].nativeName}` : ''}`,
    direction: isRtlLocale(locale) ? 'RTL' : 'LTR (all SDK core locales)',
    installLocale,
    installLocaleLabel: dialogOnly ? `${installLocale} · dialog only` : installLocale,
    presentation: config.installExperience.presentation,
    modules: {
      guidance: config.modules.installationGuidance,
      diagnostics: config.modules.diagnostics,
      offline: config.modules.offlineDiagnostics,
      cache: config.modules.cacheDiagnostics,
      recovery: config.modules.recovery,
    },
    title: config.enabled ? t('installAvailableTitle') : 'Assistant is turned off',
    message: config.enabled
      ? (config.modules.installationGuidance
        ? t('genericAvailableMessage')
        : 'Install guidance is switched off in this configuration.')
      : 'No panel would be displayed with these settings.',
    configWarnings: resolved.meta.warnings,
  };
}
