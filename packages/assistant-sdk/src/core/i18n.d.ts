export type SupportedLocale =
  | 'en'
  | 'ka'
  | 'ru'
  | 'fr'
  | 'it'
  | 'de'
  | 'sv'
  | 'nl'
  | 'no'
  | 'da'
  | 'et'
  | 'es';

export interface LocaleMetadata {
  readonly code: SupportedLocale;
  readonly name: string;
  readonly nativeName: string;
  readonly dir: 'ltr' | 'rtl';
}

export interface LocaleResolutionOptions {
  explicit?: string | null;
  locale?: string | null;
  domainLocale?: string | null;
  domainConfig?: {
    language?: string | null;
    identity?: { language?: string | null } | null;
    installExperience?: { locale?: string | null } | null;
  } | null;
  navigatorLanguage?: string | null;
  navigator?: { language?: string; userLanguage?: string; languages?: readonly string[] } | null;
  fallback?: string | null;
}

export declare const DEFAULT_LOCALE: 'en';
export declare const SUPPORTED_LOCALES: readonly SupportedLocale[];
export declare const RTL_LOCALES: readonly string[];
export declare const LOCALE_METADATA: Readonly<Record<SupportedLocale, LocaleMetadata>>;
export declare const SDK_TRANSLATIONS: Readonly<Record<SupportedLocale, Readonly<Record<string, string>>>>;
export declare const DNS_CLASSIFICATION_LABELS: Readonly<Record<SupportedLocale, Readonly<Record<string, string>>>>;

export declare function normalizeLocaleTag(value: unknown): SupportedLocale | '';
export declare function normalizeInstallLocaleTag(value: unknown, fallback?: string): string;
export declare function resolveLocale(options?: LocaleResolutionOptions): SupportedLocale;
export declare function isRtlLocale(locale: unknown): boolean;
export declare function translate(
  locale: unknown,
  key: string,
  params?: Record<string, string | number>
): string;
export declare function formatAlertCount(locale: unknown, count: number): string;
export declare function localizeDnsClassification(
  locale: unknown,
  classification: string | undefined,
  status?: string
): string;
export declare function localizeDnsMessage(
  locale: unknown,
  classification: string | undefined,
  fallbackMessage?: string,
  includeCaveat?: boolean
): { message: string; caveat: string };
export declare function chromeHandoffLabels(locale: unknown): Readonly<{
  title: string;
  intro: string;
  stepCopy: string;
  stepSwitch: string;
  stepPaste: string;
  openLabel: string;
  dismissLabel: string;
  copyLabel: string;
  copiedLabel: string;
  copyManual: string;
}>;
