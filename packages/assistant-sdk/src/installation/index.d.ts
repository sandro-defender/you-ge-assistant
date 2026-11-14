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
  };
  onChange?: (listener: (state: Record<string, unknown>) => void) => () => void;
  isInstalled?: () => boolean;
  canInstall?: () => boolean;
  isIOS?: () => boolean;
  isSafari?: () => boolean;
  promptInstall?: (options?: Record<string, unknown>) => Promise<{ outcome: string }> | { outcome: string };
  runNetworkDiagnostics?: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  showNetworkDiagnostics?: () => unknown;
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
}

export declare function readPwaSnapshot(pwa?: PwaRuntimeLike | null): Record<string, unknown>;
export declare function deriveInstallationState(options?: {
  pwa?: PwaRuntimeLike | null;
  enabled?: boolean;
}): AssistantInstallationState;
export declare function requestPwaInstall(
  options?: { pwa?: PwaRuntimeLike | null; enabled?: boolean },
  promptOptions?: Record<string, unknown>
): Promise<{ outcome: string }>;
export declare function requestPwaUpdate(
  options?: { pwa?: PwaRuntimeLike | null; enabled?: boolean }
): Promise<AssistantUpdateResult>;
