import type {
  AssistantAction,
  AssistantActionIcon,
  AssistantActionInput,
  AssistantBrandingConfig,
  LauncherActionCategory,
  LauncherAnimationConfig,
  LauncherAppearanceConfig,
  LauncherBorderConfig,
  LauncherConfig,
  LauncherConfigInput,
  LauncherLogoFit,
  LauncherShape,
  AssistantCapabilityName,
  AssistantConfigInput,
  AssistantConfigMeta,
  AssistantFeature,
  AssistantFeatureInput,
  AssistantModulesConfig,
  AssistantNotificationsConfig,
  AssistantOffsets,
  AssistantPosition,
  AssistantTheme,
  PublishedAssistantConfig,
  PublishedValidationResult,
  ResolvedAssistantConfig,
  StorageLike,
} from './config/index.js';
import type {
  DomainBranding,
  DomainConfigIssue,
  DomainConfigValidationResult,
  DomainConfigValidationSummary,
  DomainContext,
  DomainDiagnosticsConfig,
  DomainFeatures,
  DomainIdentity,
  DomainManifestIcon,
  DomainPwaSettings,
  DomainRegistry,
  DomainRegistryEntry,
  DomainRegistryValidationResult,
  DomainResolver,
  DomainShortcut,
  GeneratedWebManifest,
  InstallExperienceConfig,
  InstallExperienceInput,
  InstallPresentationMode,
  LocationInput,
  ProjectConfig,
  ResolvedDomainConfig,
} from './domain/index.js';
import type {
  AbortSignalLike,
  DiagnosticsContext,
  DiagnosticsController,
  DiagnosticsIntegrationOptions,
  DiagnosticsRunOptions,
  DnsDiagnosticSnapshot,
} from './diagnostics/index.js';
import type {
  AssistantInstallationState,
  AssistantUpdateResult,
  InstallDialogResult,
  InstallationCopySet,
  InstallationStatus,
  InstallationSupport,
  PwaRuntimeLike,
  RelatedAppInfo,
  UpdateApplyOutcome,
} from './installation/index.js';
import type {
  ChromeHandoffController,
  ChromeHandoffInstructions,
  ChromeHandoffLabels,
  ChromeHandoffOpenResult,
  InAppBrowserDetection,
  InAppBrowserName,
} from './browser/index.js';
import type {
  LocaleMetadata,
  LocaleResolutionOptions,
  SupportedLocale,
} from './core/i18n.js';

export type {
  LocaleMetadata,
  LocaleResolutionOptions,
  SupportedLocale,
} from './core/i18n.js';

export type {
  NotificationLevel as AssistantNotificationLevel,
  AssistantThemeConfig,
  AssistantThemeInput,
  AssistantThemeTokens,
  AssistantThemeVariables,
  NormalizedTheme,
  ResolvedColorScheme,
  ResolvedTheme,
  ThemeColorToken,
  ThemeMode,
  ThemeResolutionContext,
  ThemeStructureToken,
  ThemeToken,
} from './theme/index.js';
export type {
  AssistantAction,
  AssistantActionIcon,
  AssistantActionInput,
  AssistantBrandingConfig,
  LauncherActionCategory,
  LauncherAnimationConfig,
  LauncherAppearanceConfig,
  LauncherBorderConfig,
  LauncherConfig,
  LauncherConfigInput,
  LauncherLogoFit,
  LauncherShape,
  AssistantCapabilityName,
  AssistantConfigInput,
  AssistantConfigMeta,
  AssistantFeature,
  AssistantFeatureInput,
  AssistantInstallationState,
  AssistantModulesConfig,
  AssistantNotificationsConfig,
  AssistantOffsets,
  AssistantPosition,
  AssistantTheme,
  AssistantUpdateResult,
  AbortSignalLike,
  DiagnosticsContext,
  DiagnosticsController,
  DiagnosticsIntegrationOptions,
  DiagnosticsRunOptions,
  DnsDiagnosticSnapshot,
  DomainBranding,
  DomainConfigIssue,
  DomainConfigValidationResult,
  DomainConfigValidationSummary,
  DomainContext,
  DomainDiagnosticsConfig,
  DomainFeatures,
  DomainIdentity,
  DomainManifestIcon,
  DomainPwaSettings,
  DomainRegistry,
  DomainRegistryEntry,
  DomainRegistryValidationResult,
  DomainResolver,
  DomainShortcut,
  GeneratedWebManifest,
  InstallDialogResult,
  InstallExperienceConfig,
  InstallExperienceInput,
  InstallPresentationMode,
  InstallationCopySet,
  InstallationStatus,
  InstallationSupport,
  LocationInput,
  ProjectConfig,
  PublishedAssistantConfig,
  PublishedValidationResult,
  PwaRuntimeLike,
  RelatedAppInfo,
  ResolvedAssistantConfig,
  ResolvedDomainConfig,
  StorageLike,
  UpdateApplyOutcome,
  ChromeHandoffController,
  ChromeHandoffInstructions,
  ChromeHandoffLabels,
  ChromeHandoffOpenResult,
  InAppBrowserDetection,
  InAppBrowserName,
};

export type NotificationTone = 'critical' | 'auth' | 'backup' | 'install' | 'info';
/**
 * Presentation severity of a notification. Derived from the existing priority
 * ladder and notification id by a pure function: priorities, ids, persistence,
 * suppression and acknowledgement rules are unchanged.
 */
export type NotificationLevel = 'critical' | 'error' | 'warning' | 'info' | 'success';
export type PrimaryEndpointState = 'unknown' | 'healthy' | 'failed' | 'unavailable' | 'degraded';
export type BackupEndpointState = 'unknown' | 'active' | 'inactive' | 'failed';
export type ActiveEndpointTarget = 'primary' | 'backup' | 'unknown';
export type SessionConditionState = 'unknown' | 'ok' | 'issue';

export interface AssistantProjectInfo {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  themeColor: string;
  /** Host after resolving the legacy explicit `domain` option. */
  hostname: string;
  /** Host detected from the actual runtime location before any explicit override. */
  detectedHostname: string;
  origin: string;
  basePath: string;
  configured: boolean;
  matchedRegistryKey: string | null;
  projectIdSource: 'project' | 'projectId' | 'domainRegistry' | 'derived';
  domainValidation: DomainConfigValidationSummary;
}

export interface AssistantEndpointsState {
  primary: PrimaryEndpointState;
  backup: BackupEndpointState;
  active: ActiveEndpointTarget;
  reason: string;
}

export interface AssistantSessionState {
  state: SessionConditionState;
  message: string;
}

export interface AssistantNetworkState {
  online: boolean;
  dns: DnsDiagnosticSnapshot;
  endpoints: AssistantEndpointsState;
  session: AssistantSessionState;
  updateAvailable: boolean;
  recovery: boolean;
}

export interface AssistantNotification {
  id: string;
  priority: number;
  tone: NotificationTone;
  /** Presentation severity used by the theme system. */
  level: NotificationLevel;
  critical: boolean;
  dismissible: boolean;
  title: string;
  message: string;
  actionId?: string;
  /** Real action IDs relevant to this notice; the singular `actionId` remains the preferred renderer link. */
  actionIds?: string[];
}

export interface AssistantBadgeState {
  count: number;
  tone: NotificationTone | 'none';
  label: string;
  priority: number | null;
}

export interface LauncherAttentionState {
  active: boolean;
  eligibleActionIds: string[];
  priority: number | null;
}

export interface LauncherAppearanceState extends LauncherConfig {
  attention: LauncherAttentionState;
}

export interface AssistantAppearanceState {
  position: AssistantPosition;
  offsets: AssistantOffsets;
  /** Backward-compatible theme mode string. */
  theme: AssistantTheme;
  /** Validated theme record (mode, inheritHost, tokens, host, variables). */
  themeConfig: import('./theme/index.js').NormalizedTheme;
  themeColor: string;
  /** Resolved launcher configuration plus the shared action-availability state. */
  launcher: LauncherAppearanceState;
}

/**
 * Immutable state snapshot: every nested object and array published through
 * `getState()`, setter returns and the `youge:state` event is deeply frozen.
 * External mutation cannot change internal assistant state.
 */
export interface AssistantState {
  enabled: boolean;
  locale: SupportedLocale;
  dir: 'ltr' | 'rtl';
  project: AssistantProjectInfo;
  installation: AssistantInstallationState;
  network: AssistantNetworkState;
  capabilities: AssistantModulesConfig;
  notifications: AssistantNotification[];
  availableActions: AssistantAction[];
  badge: AssistantBadgeState;
  appearance: AssistantAppearanceState;
  dismissed: string[];
  acknowledged: string[];
  viewed: string[];
  completed: string[];
}

export interface AssistantEnvironment {
  root?: Record<string, unknown>;
  window?: Record<string, unknown>;
  document?: Document | Record<string, unknown> | null;
  location?: LocationInput | string;
  navigator?: { onLine?: boolean } | null;
  storage?: StorageLike | null;
  pwa?: PwaRuntimeLike | null;
  dns?: { check?: (context: DiagnosticsContext, options?: Record<string, unknown>) => Promise<Record<string, unknown>> } | null;
  domainResolver?: Pick<DomainResolver, 'resolve'> | null;
  domainRegistry?: DomainRegistry;
  bindEvents?: boolean;
  exposeGlobal?: boolean;
  useGlobalConfig?: boolean;
}

export interface CreateAssistantOptions extends AssistantConfigInput {
  env?: AssistantEnvironment;
  location?: LocationInput | string;
  storage?: StorageLike | null;
  pwa?: PwaRuntimeLike | null;
  dns?: AssistantEnvironment['dns'];
  domainResolver?: AssistantEnvironment['domainResolver'];
  bindEvents?: boolean;
  exposeGlobal?: boolean;
}

export interface AssistantConfigSummary {
  enabled: boolean;
  /** Preferred typed project identity, when explicitly configured. */
  project: ProjectConfig | null;
  /** Backward-compatible flat project ID. */
  projectId: string;
  domain: string;
  locale: string;
  position: AssistantPosition;
  offsets: AssistantOffsets;
  modules: AssistantModulesConfig;
  notifications: AssistantNotificationsConfig;
  branding: AssistantBrandingConfig;
  actions: AssistantAction[];
  features: AssistantFeature[];
  installExperience: InstallExperienceConfig;
  launcher: LauncherConfig;
  theme: AssistantTheme;
  themeConfig: import('./theme/index.js').NormalizedTheme;
  meta: AssistantConfigMeta;
}

export interface EndpointStatusInput {
  primary?: PrimaryEndpointState;
  backup?: BackupEndpointState;
  active?: ActiveEndpointTarget;
  reason?: string;
}

export interface SessionStatusInput {
  state?: SessionConditionState;
  message?: string;
}

export interface AssistantInstance {
  readonly __state: true;
  readonly version: string;
  readonly PRIORITY: Readonly<{ critical: 1; auth: 2; backup: 3; install: 4; info: 5 }>;
  create(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  attach(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  configure(nextOptions?: AssistantConfigInput): AssistantState;
  getConfig(): AssistantConfigSummary;
  getState(): AssistantState;
  getLocale(): SupportedLocale;
  setLocale(locale: string): AssistantState;
  subscribe(listener: (state: AssistantState) => void, options?: { immediate?: boolean }): () => void;
  setConnectivity(online: boolean): AssistantState;
  /** Reports host endpoint health (presentation only). The `'backup' → 'primary'` transition with `primary: 'healthy'` sets `state.network.recovery`; it is `false` whenever `active !== 'primary'`. */
  setEndpointStatus(detail: EndpointStatusInput): AssistantState;
  setSessionStatus(detail: SessionStatusInput): AssistantState;
  setDnsResult(result: Record<string, unknown>): AssistantState;
  setUpdateAvailable(available?: boolean): AssistantState;
  runDiagnostics(options?: DiagnosticsRunOptions): Promise<Record<string, unknown>>;
  runOfflineDiagnostics(): Promise<{ status: string; online?: boolean | null }>;
  runCacheDiagnostics(): Promise<Record<string, unknown>>;
  /**
   * Read-only capability check against the current resolved configuration.
   * Renderers and toolkit integrations use it so a disabled capability is not
   * actionable, even through a delegated or indirect code path.
   */
  isCapabilityEnabled(capability: AssistantCapabilityName | string): boolean;
  getInstallConfig(): InstallExperienceConfig;
  requestInstall(options?: Record<string, unknown>): Promise<{ outcome: string }>;
  showInstallDialog(options?: Record<string, unknown>): Promise<InstallDialogResult>;
  hideInstallDialog(): boolean;
  triggerInstall(options?: Record<string, unknown>): Promise<{ outcome: string; backend?: string }>;
  getInstalledRelatedApps(): Promise<RelatedAppInfo[]>;
  applyUpdate(): Promise<AssistantUpdateResult>;
  dismiss(id: string): boolean;
  acknowledge(id: string): boolean;
  /** Marks currently actionable notices as viewed without hiding/dismissing them. */
  markViewed(id: string | string[]): boolean;
  /** Report completion of a host-owned action by its `availableActions[].id`. */
  completeAction(actionId: string): boolean;
  isDestroyed(): boolean;
  destroy(): void;
}

export interface YouGeAssistantStatic {
  readonly version: string;
  readonly kitCompatVersion: string;
  readonly schemaVersion: number;
  readonly PRIORITY: Readonly<{ critical: 1; auth: 2; backup: 3; install: 4; info: 5 }>;
  readonly EVENT_NAMES: Readonly<Record<string, string>>;
  create(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  attach(options?: CreateAssistantOptions, envOverrides?: AssistantEnvironment): AssistantInstance;
  getGlobal(targetRoot?: Record<string, unknown>): AssistantInstance | null;
  resolveDomain(locationLike?: LocationInput | string, optionalRegistry?: DomainRegistry): ResolvedDomainConfig;
  detectRuntimeHostname(locationLike?: LocationInput | string): string;
  buildManifest(config?: ResolvedDomainConfig): GeneratedWebManifest;
  validateDomainConfig(raw?: DomainRegistryEntry | null): Omit<ResolvedDomainConfig, 'domain'>;
  validateDomainConfigDetailed(raw?: unknown): DomainConfigValidationResult;
  validateDomainRegistry(raw?: unknown): DomainRegistryValidationResult;
  validatePublishedConfig(rawInput: unknown, options?: { expectedProjectId?: string }): PublishedValidationResult;
  normalizeInstallExperience(raw?: InstallExperienceInput | null, fallback?: InstallExperienceConfig): InstallExperienceConfig;
  normalizeLauncherConfig(raw?: LauncherConfigInput | null): LauncherConfig;
  resolveInstallationCopy(locale?: string): InstallationCopySet;
  detectInAppBrowser(userAgent?: string): InAppBrowserDetection;
  buildChromeIntentUrl(url: string, options?: { packageName?: string }): string | null;
  createChromeHandoff(options?: import('./browser/index.js').ChromeHandoffEnvironment): ChromeHandoffController;
  chromeHandoffLabels(locale: unknown): Readonly<ChromeHandoffLabels>;
  normalizeTheme(raw?: import('./theme/index.js').AssistantThemeConfig | null): import('./theme/index.js').NormalizedTheme;
  resolveTheme(
    themeInput?: import('./theme/index.js').AssistantThemeConfig | import('./theme/index.js').NormalizedTheme | null,
    context?: import('./theme/index.js').ThemeResolutionContext
  ): import('./theme/index.js').ResolvedTheme;
  readonly THEME_MODES: readonly import('./theme/index.js').ThemeMode[];
  readonly THEME_TOKEN_KEYS: readonly import('./theme/index.js').ThemeToken[];
  readonly SUPPORTED_LOCALES: readonly SupportedLocale[];
  readonly LOCALE_METADATA: Readonly<Record<SupportedLocale, LocaleMetadata>>;
  resolveLocale(options?: LocaleResolutionOptions): SupportedLocale;
  translate(locale: unknown, key: string, params?: Record<string, string | number>): string;
  formatAlertCount(locale: unknown, count: number): string;
  isRtlLocale(locale: unknown): boolean;
  normalizeLocaleTag(value: unknown): SupportedLocale | '';
}

export interface ToolkitSummary {
  hasPwaToolkit: boolean;
  hasAssistantState: boolean;
  pwaVersion: string | null;
  sdkVersion: string;
  origin: string;
  hostname: string;
  installation: AssistantInstallationState;
}

export declare const SDK_VERSION: string;
export declare const KIT_COMPAT_VERSION: string;
export declare const SCHEMA_VERSION: number;
export declare const PRIORITY: Readonly<{ critical: 1; auth: 2; backup: 3; install: 4; info: 5 }>;
export declare const TONE: Readonly<{ 1: 'critical'; 2: 'auth'; 3: 'backup'; 4: 'install'; 5: 'info' }>;
export declare const POSITIONS: readonly AssistantPosition[];
export declare const THEMES: readonly AssistantTheme[];
export declare const ICONS: readonly AssistantActionIcon[];
export declare const EVENT_NAMES: Readonly<Record<string, string>>;
export declare const STORAGE_PREFIXES: Readonly<{ notices: string; lastKnownGood: string }>;

export {
  DEFAULT_LOCALE,
  DNS_CLASSIFICATION_LABELS,
  LOCALE_METADATA,
  RTL_LOCALES,
  SDK_TRANSLATIONS,
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
} from './core/i18n.js';

export {
  BUNDLED_DEFAULTS,
  INSTALL_EXPERIENCE_DEFAULTS,
  lkgStorageKey,
  loadLastKnownGood,
  normalizeActions,
  normalizeConfig,
  normalizeFeatures,
  normalizeInstallExperience,
  resolveAssistantConfig,
  saveLastKnownGood,
  validatePublishedConfig,
} from './config/index.js';

export {
  DOMAIN_DEFAULTS,
  buildManifest,
  createDomainResolver,
  detectRuntimeHostname,
  isIpAddress,
  normalizeHost,
  normalizePath,
  resolveDomain,
  rootDomain,
  safeNavigationUrl,
  validateDomainConfig,
  validateDomainConfigDetailed,
  validateDomainRegistry,
} from './domain/index.js';

export {
  cancelledDiagnosticsResult,
  connectivityFailure,
  disabledDiagnosticsResult,
  createDiagnosticsIntegration,
  dnsFailure,
  isCancelledResult,
  normalizeDnsResult,
  resolveDiagnosticsRunner,
  resolveRunSignal,
} from './diagnostics/index.js';

export {
  deriveInstallationState,
  hidePwaInstallDialog,
  readInstalledRelatedApps,
  readPwaSnapshot,
  requestPwaInstall,
  requestPwaUpdate,
  resolveInstallationCopy,
  showPwaInstallDialog,
  triggerPwaInstall,
} from './installation/index.js';

export {
  ASSISTANT_FONT_STACK,
  ASSISTANT_PALETTES,
  COLOR_TOKEN_KEYS,
  NOTIFICATION_LEVELS,
  NOTIFICATION_LEVEL_ICONS,
  NOTIFICATION_LEVEL_LABELS,
  NOTIFICATION_LEVEL_SHAPES,
  NOTIFICATION_LEVEL_SVG_ATTRIBUTES,
  PROTECTED_VARIABLES,
  THEME_DEFAULTS,
  THEME_MODES,
  THEME_TOKEN_KEYS,
  TOKEN_CSS_VARIABLES,
  bestInk,
  contrastRatio,
  detectHostScheme,
  detectHostTypography,
  isSafeCssValue,
  normalizeNotificationLevel,
  normalizeToken,
  normalizeTheme,
  notificationLevelMarkup,
  relativeLuminance,
  resolveTheme,
  themeToCssVariables,
} from './theme/index.js';

export {
  CHROME_OFFER_STORAGE_KEY,
  CHROME_PACKAGE,
  buildChromeIntentUrl,
  chromeHandoffInstructions,
  createChromeHandoff,
  detectInAppBrowser,
  isChromeHandoffCandidate,
} from './browser/index.js';

/* ------------------------------------------------------------------ *
 * Module capability enforcement (CD-1)
 * ------------------------------------------------------------------ */

/** The capabilities the SDK gated and enforces. */
export declare const GATED_CAPABILITIES: readonly AssistantCapabilityName[];
/** Is `capability` enabled in a resolved `modules` record? Default: enabled. */
export declare function isCapabilityEnabled(
  modules: Partial<AssistantModulesConfig> | null | undefined,
  capability: AssistantCapabilityName | string
): boolean;
/** Capability an action id (or action object) belongs to, or `null`. */
export declare function capabilityForAction(
  actionOrId: string | { id?: string; kind?: string },
  kind?: string
): AssistantCapabilityName | null;
/** Is the action allowed by `modules`? */
export declare function isActionAllowed(
  modules: Partial<AssistantModulesConfig> | null | undefined,
  actionOrId: string | { id?: string; kind?: string },
  kind?: string
): boolean;
/** The published `state.capabilities` record. */
export declare function capabilitiesRecord(
  modules: Partial<AssistantModulesConfig> | null | undefined
): AssistantModulesConfig;

export declare const LAUNCHER_DEFAULTS: Readonly<LauncherConfig>;
export declare const LAUNCHER_SHAPES: readonly LauncherShape[];
export declare const LAUNCHER_LOGO_FITS: readonly LauncherLogoFit[];
export declare const LAUNCHER_ANIMATION_TYPES: readonly ('electric-border')[];
export declare const LAUNCHER_ACTION_CATEGORIES: readonly LauncherActionCategory[];
export declare function normalizeLauncherConfig(raw?: LauncherConfigInput | null): LauncherConfig;
export declare function launcherActionCategory(action: AssistantAction | null | undefined): LauncherActionCategory | null;
export declare function deriveLauncherAttention(state: Pick<AssistantState, 'notifications' | 'availableActions' | 'viewed' | 'dismissed' | 'acknowledged' | 'completed'>, launcher?: LauncherConfig | LauncherConfigInput): LauncherAttentionState;

export declare const NOTIFICATION_LEVEL_MAP: Readonly<Record<string, NotificationLevel>>;
export declare function notificationLevel(id?: string, priority?: number): NotificationLevel;

export declare function createAssistant(
  initialOptions?: CreateAssistantOptions,
  envOverrides?: AssistantEnvironment
): AssistantInstance;

export declare function attachAssistant(
  options?: CreateAssistantOptions,
  envOverrides?: AssistantEnvironment
): AssistantInstance;

export declare function getGlobalAssistant(targetRoot?: Record<string, unknown>): AssistantInstance | null;

export declare function bridgePwaGlobals(options?: {
  root?: Record<string, unknown>;
  window?: Record<string, unknown>;
  domainRegistry?: DomainRegistry;
  assistantConfig?: CreateAssistantOptions;
  attach?: boolean;
}): {
  bridged: boolean;
  assistant: AssistantInstance | null;
  domain: DomainResolver | null;
};

export declare function readToolkitSummary(targetRoot?: Record<string, unknown>): ToolkitSummary;

export declare const YouGeAssistant: YouGeAssistantStatic;
export default YouGeAssistant;
