import type { DomainRegistry, InstallExperienceConfig, InstallExperienceInput, ProjectConfig } from '../domain/index.js';
import type { AssistantThemeConfig, NormalizedTheme } from '../theme/index.js';

export type AssistantPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
/**
 * The theme mode. Kept as the original string union for backward
 * compatibility: `getConfig().theme` and `state.appearance.theme` still read as
 * `'auto' | 'light' | 'dark' | 'custom'`.
 */
export type AssistantTheme = 'auto' | 'light' | 'dark' | 'custom';
export type AssistantActionIcon = 'install' | 'diagnostics' | 'recovery' | 'backup' | 'help' | 'info' | 'update' | 'custom';

export interface AssistantOffsets {
  x: number;
  y: number;
}

/** Legacy capability names; PWA and extension names also work with isCapabilityEnabled. */
export type AssistantCapabilityName = 'diagnostics' | 'recovery' | 'failover' | 'help';

export interface AssistantModulesConfig {
  installation: boolean;
  diagnostics: boolean;
  recovery: boolean;
  failover: boolean;
  help: boolean;
  updates: boolean;
  /** Offer the Android in-app browser → Chrome handoff when applicable. */
  chromeHandoff: boolean;
  installationDetection?: boolean;
  installationGuidance?: boolean;
  updateDetection?: boolean;
  updateNotifications?: boolean;
  autoUpdate?: boolean;
  userUpdate?: boolean;
  offlineDiagnostics?: boolean;
  cacheDiagnostics?: boolean;
  /** Optional host-defined capability flags, read with isCapabilityEnabled. */
  extensions?: Record<string, boolean>;
}

export interface AssistantNotificationsConfig {
  dismissible: boolean;
  suppressRepeats: boolean;
  criticalPersistent: boolean;
}

export interface AssistantBrandingConfig {
  name: string;
  shortName: string;
  icon: string;
  themeColor: string;
}

export type LauncherShape = 'circle' | 'rounded-square' | 'square';
export type LauncherLogoFit = 'contain' | 'cover' | 'fill';
export type LauncherActionCategory = 'installation' | 'connectivity' | 'recovery' | 'backup' | 'update' | 'help' | 'custom';

export interface LauncherBorderConfig {
  width: number;
  color: string;
  style: 'solid' | 'dashed' | 'none';
}

export interface LauncherAppearanceConfig {
  shape: LauncherShape;
  logoFit: LauncherLogoFit;
  logoScale: number;
  logoPosition: { x: number; y: number };
  logoBorderRadius: string | number;
  logoSize: number;
  border: LauncherBorderConfig;
}

export interface LauncherAnimationConfig {
  enabled: boolean;
  type: 'electric-border';
  color: string;
  preset: 'plasma';
  speed: number;
  intensity: number;
  trigger: 'action-available';
  triggerCategories: LauncherActionCategory[];
  stopWhenViewed: boolean;
}

export interface LauncherConfig {
  /** Visual diameter in CSS pixels, clamped to 40–128. */
  size: number;
  /** Internal compatibility hint: false keeps the existing responsive default sizing. */
  sizeConfigured: boolean;
  /** Optional same-origin image URL. Empty keeps the renderer's existing mark. */
  logo: string;
  appearance: LauncherAppearanceConfig;
  animation: LauncherAnimationConfig;
}

export type LauncherConfigInput = Partial<Omit<LauncherConfig, 'appearance' | 'animation' | 'sizeConfigured'>> & {
  appearance?: Partial<Omit<LauncherAppearanceConfig, 'logoPosition' | 'border'>> & {
    logoPosition?: Partial<LauncherAppearanceConfig['logoPosition']>;
    border?: Partial<LauncherBorderConfig>;
  };
  animation?: Partial<LauncherAnimationConfig>;
};

export interface AssistantActionInput {
  id: string;
  label?: string;
  message?: string;
  icon?: AssistantActionIcon;
  priority?: number;
  kind?: 'help' | 'custom';
}

export interface AssistantAction {
  id: string;
  label: string;
  message: string;
  icon: AssistantActionIcon;
  priority: number;
  kind: 'help' | 'custom' | 'diagnostics' | 'recovery' | 'install' | 'backup' | 'update';
  event: string;
}

export interface AssistantFeatureInput {
  id: string;
  label?: string;
  message?: string;
}

export interface AssistantFeature {
  id: string;
  label: string;
  message: string;
}

export interface PublishedAssistantConfig {
  /**
   * Schema major version. Optional for legacy compatibility: a missing or
   * `null` value is accepted as the current major and reported as
   * `schema_version_missing` in the validation warnings. A declared but
   * malformed value or a different major is rejected with
   * `unsupported_schema_version`.
   */
  schemaVersion?: number | string;
  revision?: string;
  publishedAt?: string;
  projectId?: string;
  project?: ProjectConfig | null;
  enabled?: boolean;
  domain?: string;
  locale?: string;
  position?: AssistantPosition;
  offsets?: Partial<AssistantOffsets>;
  modules?: Partial<AssistantModulesConfig>;
  notifications?: Partial<AssistantNotificationsConfig>;
  branding?: Partial<AssistantBrandingConfig>;
  actions?: AssistantActionInput[];
  features?: AssistantFeatureInput[];
  installExperience?: InstallExperienceInput;
  launcher?: LauncherConfigInput;
  /** A published (remote) revision may select a mode, but never carries custom
   * tokens: published configuration stays data-only and identity-neutral. */
  theme?: 'auto' | 'light' | 'dark';
  domainRegistry?: DomainRegistry;
  config?: Omit<PublishedAssistantConfig, 'schemaVersion' | 'revision' | 'publishedAt' | 'config'>;
}

export interface AssistantConfigInput {
  enabled?: boolean;
  /** Adaptive theme: object form (`{ mode, inheritHost, tokens }`) or the
   * original string form (`'auto' | 'light' | 'dark'`). */
  theme?: AssistantThemeConfig;
  /** Explicit stable project identity; `projectId` remains a compatibility alias. */
  project?: ProjectConfig | null;
  projectId?: string;
  domain?: string;
  locale?: string;
  position?: AssistantPosition;
  offsets?: Partial<AssistantOffsets>;
  modules?: Partial<AssistantModulesConfig>;
  notifications?: Partial<AssistantNotificationsConfig>;
  branding?: Partial<AssistantBrandingConfig>;
  actions?: AssistantActionInput[];
  features?: AssistantFeatureInput[];
  installExperience?: InstallExperienceInput;
  launcher?: LauncherConfigInput;
  domainRegistry?: DomainRegistry;
  publishedConfig?: PublishedAssistantConfig | string | null;
  useLastKnownGood?: boolean;
  services?: {
    diagnostics?: (() => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
  };
}

export interface ResolvedAssistantConfig {
  enabled: boolean;
  /** Normalized theme record (validated tokens only). */
  theme: NormalizedTheme;
  /** Backward-compatible flat mode, mirrors `theme.mode`. */
  themeMode: AssistantTheme;
  project: ProjectConfig | null;
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
  domainRegistry: DomainRegistry | null;
  services: {
    diagnostics: (() => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
  };
}

export interface AssistantConfigMeta {
  schemaVersion: number;
  source: 'defaults' | 'published' | 'last-known-good' | 'overrides';
  revision: string;
  publishedAt: string;
  usedLastKnownGood: boolean;
  warnings: string[];
}

export interface PublishedValidationResult {
  valid: boolean;
  reason?: string;
  secretKeys?: string[];
  schemaVersion?: number;
  revision?: string;
  publishedAt?: string;
  projectId?: string;
  config?: Partial<ResolvedAssistantConfig>;
  warnings: string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export declare const LAUNCHER_DEFAULTS: Readonly<LauncherConfig>;
export declare function normalizeLauncherConfig(raw?: LauncherConfigInput | null): LauncherConfig;
export declare const BUNDLED_DEFAULTS: Omit<ResolvedAssistantConfig, 'domainRegistry' | 'services'>;
export declare const INSTALL_EXPERIENCE_DEFAULTS: InstallExperienceConfig;
export declare function normalizeInstallExperience(
  raw?: InstallExperienceInput | null,
  fallback?: InstallExperienceConfig
): InstallExperienceConfig;
export declare function normalizeActions(raw?: unknown): AssistantAction[];
export declare function normalizeFeatures(raw?: unknown): AssistantFeature[];
export declare function validatePublishedConfig(
  rawInput: unknown,
  options?: { expectedProjectId?: string }
): PublishedValidationResult;
export declare function lkgStorageKey(projectId: string): string;
export declare function loadLastKnownGood(storage: StorageLike | null | undefined, projectId: string): PublishedValidationResult | null;
export declare function saveLastKnownGood(storage: StorageLike | null | undefined, projectId: string, validatedRecord: PublishedValidationResult): boolean;
export declare function normalizeConfig(raw?: AssistantConfigInput): ResolvedAssistantConfig;
export declare function resolveAssistantConfig(
  rawInput?: AssistantConfigInput,
  context?: { storage?: StorageLike | null; fallbackProjectId?: string }
): { config: ResolvedAssistantConfig; meta: AssistantConfigMeta };
