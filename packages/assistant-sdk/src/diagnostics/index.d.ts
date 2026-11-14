export interface DnsDiagnosticSnapshot {
  status: string;
  classification: string;
  message: string;
  checkedAt: string | null;
  failed?: boolean;
  /** True only when the caller cancelled the run; never a failure. */
  cancelled?: boolean;
}

/** Minimal structural shape of an `AbortSignal`, so no DOM lib is required. */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: (event?: unknown) => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: (event?: unknown) => void): void;
}

export interface DiagnosticsRunOptions {
  /** Optional caller cancellation. Omitted signals keep the existing behavior. */
  signal?: AbortSignalLike | { signal?: AbortSignalLike } | null;
  [key: string]: unknown;
}

export interface DiagnosticsContext {
  hostname?: string;
  origin?: string;
  basePath?: string;
  online?: boolean;
  /** Same-origin app probe path; part of the effective diagnostic target. */
  appProbePath?: string;
  /** Optional same-origin backend probe path; part of the diagnostic target. */
  backendProbePath?: string;
}

export interface DiagnosticsIntegrationOptions {
  AbortController?: { new (): { signal: AbortSignalLike; abort(): void } } | null;
  services?: {
    diagnostics?: ((options?: DiagnosticsRunOptions) => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
  };
  pwa?: {
    runNetworkDiagnostics?: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  } | null;
  getPwa?: () => { runNetworkDiagnostics?: (options?: Record<string, unknown>) => Promise<Record<string, unknown>> } | null;
  dns?: {
    check?: (context: DiagnosticsContext, options?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  } | null;
  getDns?: () => { check?: (context: DiagnosticsContext, options?: Record<string, unknown>) => Promise<Record<string, unknown>> } | null;
  context?: DiagnosticsContext;
  getContext?: () => DiagnosticsContext;
  onStart?: () => void;
  onResult?: (result: Record<string, unknown>) => void;
}

export interface DiagnosticsController {
  run(runOptions?: DiagnosticsRunOptions): Promise<Record<string, unknown>>;
  /** Aborts the run this controller owns; its late result is discarded. */
  clear(): void;
  isRunning(): boolean;
}

export declare function isCancelledResult(dns?: Partial<DnsDiagnosticSnapshot> | null): boolean;
export declare function cancelledDiagnosticsResult(reason?: string): DnsDiagnosticSnapshot;
export declare function resolveRunSignal(
  signal?: AbortSignalLike | { signal?: AbortSignalLike | null } | null
): AbortSignalLike | null;
export declare function dnsFailure(dns?: Partial<DnsDiagnosticSnapshot> | null): boolean;
export declare function connectivityFailure(dns?: Partial<DnsDiagnosticSnapshot> | null): boolean;
export declare function normalizeDnsResult(result?: Record<string, unknown> | null, DateCtor?: DateConstructor): DnsDiagnosticSnapshot;
export declare function resolveDiagnosticsRunner(
  options?: DiagnosticsIntegrationOptions
): ((runOptions?: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>) | null;
export declare function createDiagnosticsIntegration(options?: DiagnosticsIntegrationOptions): DiagnosticsController;
