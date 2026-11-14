import type { AssistantConfigInput } from '../config/index.js';
import type {
  AssistantEnvironment,
  AssistantInstance,
  AssistantNotificationLevel,
  AssistantState,
  AssistantUpdateResult,
} from '../index.js';
import type {
  ResolvedColorScheme,
  ResolvedTheme,
  ThemeResolutionContext,
} from '../theme/index.js';

export type UseSyncExternalStoreFn = <Snapshot>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: () => Snapshot
) => Snapshot;

export interface ExternalStoreBindings<Selected = AssistantState> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => Selected;
  getServerSnapshot: () => Selected;
}

export interface UseAssistantHook {
  (): AssistantState;
  <Selected>(selector: (state: AssistantState) => Selected): Selected;
}

export interface ReactAdapterOptions {
  useSyncExternalStore: UseSyncExternalStoreFn;
  assistant?: AssistantInstance;
  config?: AssistantConfigInput;
  env?: AssistantEnvironment;
  fallbackState?: AssistantState;
  source?: string;
}

export interface ReactAssistantAdapter {
  getAssistant(): AssistantInstance;
  useAssistant: UseAssistantHook;
  /**
   * Resolve the current appearance into theme variables using the same SDK
   * resolver the DOM widget uses — a React renderer never re-implements theming.
   */
  resolveTheme(
    appearance?: AssistantState['appearance'],
    options?: { document?: Document | null; hostScheme?: ResolvedColorScheme }
  ): ResolvedTheme;
  /** Accessible tier name for a notification level. */
  notificationLevelLabel(level: unknown): string;
  /**
   * Build the level glyph with the host's own `createElement`, so applications
   * never inject markup. Falls back to `createElement` from the adapter options.
   */
  notificationLevelElement(
    level: unknown,
    createElement?: (type: string, props: Record<string, unknown>) => unknown
  ): unknown;
  dispatchAction(id: string, kind?: string): Promise<AssistantUpdateResult | boolean> | void;
}

export declare const FALLBACK_ASSISTANT_STATE: AssistantState;

/**
 * Build the `useSyncExternalStore` bindings for an assistant instance.
 *
 * `assistantOrGetter` may be an instance or a getter (typically
 * `() => YouGeAssistant.attach(options)`). The getter is resolved once and
 * memoized — `getSnapshot` runs on every render, so re-resolving per render
 * would re-configure the assistant per render. It is re-resolved only when the
 * cached instance reports `isDestroyed()`. `selector` results are cached by
 * identity so unrelated state changes do not re-render subscribers.
 */
export declare function getExternalStoreBindings<Selected = AssistantState>(
  assistantOrGetter?: AssistantInstance | (() => AssistantInstance),
  selector?: ((state: AssistantState) => Selected) | null,
  fallbackState?: AssistantState
): ExternalStoreBindings<Selected>;

/** Same getter semantics as {@link getExternalStoreBindings}. */
export declare function createUseAssistant(
  useSyncExternalStore: UseSyncExternalStoreFn,
  assistantOrGetter?: AssistantInstance | (() => AssistantInstance),
  fallbackState?: AssistantState
): UseAssistantHook;

export declare function resolveAppearanceTheme(
  appearance?: AssistantState['appearance'] | null,
  options?: ThemeResolutionContext & { hostScheme?: ResolvedColorScheme }
): ResolvedTheme;

export declare function notificationLevelLabel(level: unknown): string;

export declare function notificationLevelElement(
  level: unknown,
  createElement: (type: string, props: Record<string, unknown>, children?: unknown) => unknown
): unknown;

export declare function dispatchAssistantAction(
  id: string,
  kind?: string,
  options?: {
    assistant?: AssistantInstance | null;
    pwa?: Record<string, unknown> | null;
    document?: Document | null;
    root?: Record<string, unknown> | null;
    source?: string;
  }
): Promise<AssistantUpdateResult | boolean> | void;

export declare function createReactAdapter(options: ReactAdapterOptions): ReactAssistantAdapter;
