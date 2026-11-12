import type { DomainRegistry, ProjectConfig } from '../domain/index.js';
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

export interface AssistantModulesConfig {
  installation: boolean;
  diagnostics: boolean;
  recovery: boolean;
  failover: boolean;
  help: boolean;
  updates: boolean;
  /** Offer the Android in-app browser → Chrome handoff when applicable. */
  chromeHandoff: boolean;
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
  schemaVersion?: number | string;
  revision?: string;
  publishedAt?: string;
  projectId?: string;
  project?: ProjectConfig | null;
  enabled?: boolean;
  domain?: string;
  position?: AssistantPosition;
  offsets?: Partial<AssistantOffsets>;
  modules?: Partial<AssistantModulesConfig>;
  notifications?: Partial<AssistantNotificationsConfig>;
  branding?: Partial<AssistantBrandingConfig>;
  actions?: AssistantActionInput[];
  features?: AssistantFeatureInput[];
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
  position?: AssistantPosition;
  offsets?: Partial<AssistantOffsets>;
  modules?: Partial<AssistantModulesConfig>;
  notifications?: Partial<AssistantNotificationsConfig>;
  branding?: Partial<AssistantBrandingConfig>;
  actions?: AssistantActionInput[];
  features?: AssistantFeatureInput[];
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
  position: AssistantPosition;
  offsets: AssistantOffsets;
  modules: AssistantModulesConfig;
  notifications: AssistantNotificationsConfig;
  branding: AssistantBrandingConfig;
  actions: AssistantAction[];
  features: AssistantFeature[];
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

export declare const BUNDLED_DEFAULTS: Omit<ResolvedAssistantConfig, 'domainRegistry' | 'services'>;
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
