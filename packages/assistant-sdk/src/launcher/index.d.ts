import type { AssistantAction, AssistantState } from '../index.js';
import type {
  LauncherActionCategory,
  LauncherConfig,
  LauncherConfigInput,
  LauncherLogoFit,
  LauncherShape,
} from '../config/index.js';

export type { LauncherActionCategory, LauncherConfig, LauncherConfigInput, LauncherLogoFit, LauncherShape };

export declare const LAUNCHER_DEFAULTS: Readonly<LauncherConfig>;
export declare const LAUNCHER_SHAPES: readonly LauncherShape[];
export declare const LAUNCHER_LOGO_FITS: readonly LauncherLogoFit[];
export declare const LAUNCHER_ANIMATION_TYPES: readonly 'electric-border'[];
export declare const LAUNCHER_ACTION_CATEGORIES: readonly LauncherActionCategory[];
export declare function normalizeLauncherConfig(raw?: LauncherConfigInput | null): LauncherConfig;
export declare function launcherActionCategory(action: AssistantAction | null | undefined): LauncherActionCategory | null;
export interface ElectricBorderOptions {
  active?: boolean;
  color?: string;
  speed?: number;
  intensity?: number;
  shape?: LauncherShape;
  borderRadius?: number;
  light?: boolean;
  interactive?: boolean;
  cursorRadius?: number;
  reducedMotion?: boolean;
}

export interface ElectricBorderRenderer {
  update(options?: ElectricBorderOptions): void;
  destroy(): void;
}

/** Mount the licensed, framework-independent WebGL2 ElectricBorder on an element. */
export declare function createElectricBorder(
  container: HTMLElement,
  environment?: { window?: Window; document?: Document }
): ElectricBorderRenderer | null;
export declare function bindElectricBorder(
  container: HTMLElement,
  assistant: {
    getState(): AssistantState;
    subscribe(listener: () => void, options?: { immediate?: boolean }): () => void;
  },
  environment?: { window?: Window; document?: Document }
): (ElectricBorderRenderer & { renderer: ElectricBorderRenderer; update(): void }) | null;

export declare function deriveLauncherAttention(
  state: Pick<AssistantState, 'notifications' | 'availableActions' | 'viewed' | 'dismissed' | 'acknowledged' | 'completed'>,
  launcher?: LauncherConfig | LauncherConfigInput
): { active: boolean; eligibleActionIds: string[]; priority: number | null };
