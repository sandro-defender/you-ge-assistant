import type {
  AssistantAction,
  AssistantActionIcon,
  AssistantActionInput,
  AssistantBrandingConfig,
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
  InstallationStatus,
  InstallationSupport,
  PwaRuntimeLike,
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
  InstallationStatus,
  InstallationSupport,
  LocationInput,
  ProjectConfig,
  PublishedAssistantConfig,
  PublishedValidationResult,
  PwaRuntimeLike,
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
}

export interface AssistantBadgeState {
  count: number;
  tone: NotificationTone | 'none';
  label: string;
  priority: number | null;
}

export interface AssistantAppearanceState {
  position: AssistantPosition;
  offsets: AssistantOffsets;
  /** Backward-compatible theme mode string. */
  theme: AssistantTheme;
  /** Validated theme record (mode, inheritHost, tokens, host, variables). */
  themeConfig: import('./theme/index.js').NormalizedTheme;
  themeColor: string;
}

export interface AssistantState {
  enabled: boolean;
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
  position: AssistantPosition;
  offsets: AssistantOffsets;
  modules: AssistantModulesConfig;
  notifications: AssistantNotificationsConfig;
  branding: AssistantBrandingConfig;
  actions: AssistantAction[];
  features: AssistantFeature[];
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
  subscribe(listener: (state: AssistantState) => void, options?: { immediate?: boolean }): () => void;
  setConnectivity(online: boolean): AssistantState;
  setEndpointStatus(detail: EndpointStatusInput): AssistantState;
  setSessionStatus(detail: SessionStatusInput): AssistantState;
  setDnsResult(result: Record<string, unknown>): AssistantState;
  setUpdateAvailable(available?: boolean): AssistantState;
  runDiagnostics(options?: DiagnosticsRunOptions): Promise<Record<string, unknown>>;
  requestInstall(options?: Record<string, unknown>): Promise<{ outcome: string }>;
  applyUpdate(): Promise<AssistantUpdateResult>;
  dismiss(id: string): boolean;
  acknowledge(id: string): boolean;
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
  detectInAppBrowser(userAgent?: string): InAppBrowserDetection;
  buildChromeIntentUrl(url: string, options?: { packageName?: string }): string | null;
  createChromeHandoff(options?: import('./browser/index.js').ChromeHandoffEnvironment): ChromeHandoffController;
  normalizeTheme(raw?: import('./theme/index.js').AssistantThemeConfig | null): import('./theme/index.js').NormalizedTheme;
  resolveTheme(
    themeInput?: import('./theme/index.js').AssistantThemeConfig | import('./theme/index.js').NormalizedTheme | null,
    context?: import('./theme/index.js').ThemeResolutionContext
  ): import('./theme/index.js').ResolvedTheme;
  readonly THEME_MODES: readonly import('./theme/index.js').ThemeMode[];
  readonly THEME_TOKEN_KEYS: readonly import('./theme/index.js').ThemeToken[];
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
  BUNDLED_DEFAULTS,
  lkgStorageKey,
  loadLastKnownGood,
  normalizeActions,
  normalizeConfig,
  normalizeFeatures,
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
  createDiagnosticsIntegration,
  dnsFailure,
  isCancelledResult,
  normalizeDnsResult,
  resolveDiagnosticsRunner,
  resolveRunSignal,
} from './diagnostics/index.js';

export {
  deriveInstallationState,
  readPwaSnapshot,
  requestPwaInstall,
  requestPwaUpdate,
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
