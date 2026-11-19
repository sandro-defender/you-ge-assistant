// Compile-time check for the documented SDK 0.4.0 localization module and
// PWA installation integration. Type-only assertions: this file is never bundled.
import {
  DEFAULT_LOCALE,
  LOCALE_METADATA,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
  chromeHandoffLabels,
  formatAlertCount,
  isRtlLocale,
  localizeDnsClassification,
  localizeDnsMessage,
  normalizeInstallLocaleTag,
  normalizeLocaleTag,
  resolveLocale,
  translate,
  type LocaleResolutionOptions,
  type SupportedLocale,
} from '@youge/assistant-sdk/i18n';
import {
  deriveInstallationState,
  hidePwaInstallDialog,
  readInstalledRelatedApps,
  requestPwaInstall,
  resolveInstallationCopy,
  showPwaInstallDialog,
  triggerPwaInstall,
  type AssistantInstallationState,
  type InstallationCopySet,
  type InstallDialogResult,
  type PwaRuntimeLike,
  type RelatedAppInfo,
} from '@youge/assistant-sdk/installation';
import type { SupportedLocale as RootSupportedLocale } from '@youge/assistant-sdk';

const runtime: PwaRuntimeLike = {
  getState: () => ({ canInstall: true, ios: false, safari: false, installLocale: 'ka' }),
  showInstallDialog: () => Promise.resolve({ shown: true, outcome: 'shown', backend: 'pwa-install' }),
  hideInstallDialog: () => true,
  triggerInstall: () => Promise.resolve({ outcome: 'accepted', backend: 'pwa-install' }),
  getInstalledRelatedApps: () => Promise.resolve([{ id: 'related', platform: 'webapp' }]),
};

const resolution: LocaleResolutionOptions = {
  explicit: 'auto',
  domainConfig: { language: 'ka', installExperience: { locale: 'auto' } },
  navigator: { languages: ['en-GB', 'ru'] },
  fallback: DEFAULT_LOCALE,
};

const locale: SupportedLocale = resolveLocale(resolution);
const rootLocale: RootSupportedLocale = locale;
void rootLocale;

const metadata: { nativeName: string; dir: 'ltr' | 'rtl' } = LOCALE_METADATA[locale];
void metadata.nativeName;
void SUPPORTED_LOCALES.length;
void RTL_LOCALES;
void normalizeLocaleTag('ka-GE');
void normalizeInstallLocaleTag('nb-NO');
void isRtlLocale('ar');
void translate(locale, 'installActionLabel');
void formatAlertCount(locale, 3);
void localizeDnsClassification(locale, 'dns_resolution_failure', 'fail');
const dns: { message: string; caveat: string } = localizeDnsMessage(locale, 'dns_resolution_failure');
void dns.message;
const labels: { title: string; openLabel: string } = chromeHandoffLabels(locale);
void labels.title;

const state: AssistantInstallationState = deriveInstallationState({ pwa: runtime });
const kind: 'native' | 'manual-ios' | 'manual-generic' | 'installed' | 'none' = state.support;
void kind;
void state.componentEnabled;
void state.backend;

const copy: InstallationCopySet = resolveInstallationCopy(state.locale);
void copy.installActionLabel;

void requestPwaInstall({ pwa: runtime }, { source: 'typecheck' });
const dialog: Promise<InstallDialogResult> = showPwaInstallDialog({ pwa: runtime }, { locale: 'ka' });
void dialog;
void hidePwaInstallDialog({ pwa: runtime });
void triggerPwaInstall({ pwa: runtime });
const related: Promise<RelatedAppInfo[]> = readInstalledRelatedApps({ pwa: runtime });
void related;
