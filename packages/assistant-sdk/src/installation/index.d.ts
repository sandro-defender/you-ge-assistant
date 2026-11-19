import type { SupportedLocale } from '../core/i18n.js';

export type InstallationSupport = 'native' | 'manual-ios' | 'manual-generic' | 'installed' | 'none';
export type InstallationStatus = 'available' | 'installed' | 'unavailable';

export interface PwaRuntimeLike {
  config?: {
    features?: {
      installation?: boolean;
      diagnostics?: boolean;
    };
  };
  getState?: () => {
    installed?: boolean;
    standalone?: boolean;
    canInstall?: boolean;
    hasUpdate?: boolean;
    ios?: boolean;
    safari?: boolean;
    hostname?: string;
    origin?: string;
    basePath?: string;
    installComponentEnabled?: boolean;
    installComponentLoaded?: boolean;
    installDialogOpen?: boolean;
    installPresentation?: 'manual' | 'auto';
    installLocale?: string;
    installBackend?: string;
    relatedAppsInstalled?: boolean;
  };
  onChange?: (listener: (state: Record<string, unknown>) => void) => () => void;
  isInstalled?: () => boolean;
  canInstall?: () => boolean;
  isIOS?: () => boolean;
  isSafari?: () => boolean;
  promptInstall?: (options?: Record<string, unknown>) => Promise<{ outcome: string }> | { outcome: string };
  showInstallDialog?: (options?: Record<string, unknown>) => Promise<InstallDialogResult> | InstallDialogResult;
  hideInstallDialog?: () => boolean;
  triggerInstall?: (options?: Record<string, unknown>) => Promise<{ outcome: string; backend?: string }> | { outcome: string; backend?: string };
  getInstalledRelatedApps?: () => Promise<RelatedAppInfo[]>;
  getInstallConfig?: () => Record<string, unknown>;
  configureInstallExperience?: (config?: Record<string, unknown>) => Record<string, unknown>;
  runNetworkDiagnostics?: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  showNetworkDiagnostics?: () => unknown;
  runCacheDiagnostics?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
  hasUpdate?: () => boolean;
  /** Existing toolkit returns a boolean; older implementations may return void/null. */
  applyUpdate?: () =>
    | Promise<boolean | null | void | { applied: boolean; outcome?: string }>
    | boolean
    | null
    | void
    | { applied: boolean; outcome?: string };
}

export type UpdateApplyOutcome = 'applied' | 'no-waiting-worker' | 'unsupported' | 'disabled' | 'error';

export interface AssistantUpdateResult {
  applied: boolean;
  outcome: UpdateApplyOutcome;
}

export interface InstallDialogResult {
  shown: boolean;
  outcome: string;
  backend?: string;
}

export interface RelatedAppInfo {
  id?: string;
  platform?: string;
  url?: string;
  version?: string;
}

export interface InstallationCopySet {
  language: SupportedLocale;
  installActionLabel: string;
  instructionsActionLabel: string;
  installAvailableTitle: string;
  nativeAvailableMessage: string;
  iosAvailableMessage: string;
  genericAvailableMessage: string;
  iosShortcutHint: string;
  genericHint: string;
}

export interface AssistantInstallationState {
  support: InstallationSupport;
  status: InstallationStatus;
  canInstall: boolean;
  installed: boolean;
  standalone: boolean;
  ios: boolean;
  safari: boolean;
  platform: 'ios' | 'chromium' | 'generic';
  nativeAvailable: boolean;
  componentEnabled: boolean;
  componentLoaded: boolean;
  dialogOpen: boolean;
  presentation: 'manual' | 'auto';
  locale: string;
  backend: string;
  relatedAppsInstalled: boolean;
}

export declare function resolveInstallationCopy(locale?: string): InstallationCopySet;
export declare function readPwaSnapshot(pwa?: PwaRuntimeLike | null): Record<string, unknown>;
export declare function deriveInstallationState(options?: {
  pwa?: PwaRuntimeLike | null;
  enabled?: boolean;
  detection?: boolean;
  installExperience?: Record<string, unknown>;
}): AssistantInstallationState;
export declare function requestPwaInstall(
  options?: { pwa?: PwaRuntimeLike | null; enabled?: boolean },
  promptOptions?: Record<string, unknown>
): Promise<{ outcome: string }>;
export declare function showPwaInstallDialog(
  options?: { pwa?: PwaRuntimeLike | null; enabled?: boolean },
  dialogOptions?: Record<string, unknown>
): Promise<InstallDialogResult>;
export declare function hidePwaInstallDialog(
  options?: { pwa?: PwaRuntimeLike | null }
): boolean;
export declare function triggerPwaInstall(
  options?: { pwa?: PwaRuntimeLike | null; enabled?: boolean },
  promptOptions?: Record<string, unknown>
): Promise<{ outcome: string; backend?: string }>;
export declare function readInstalledRelatedApps(
  options?: { pwa?: PwaRuntimeLike | null; navigator?: { getInstalledRelatedApps?: () => Promise<RelatedAppInfo[]> } | null; detection?: boolean }
): Promise<RelatedAppInfo[]>;
export declare function requestPwaUpdate(
  options?: { pwa?: PwaRuntimeLike | null; enabled?: boolean }
): Promise<AssistantUpdateResult>;
