// Compile-time contract for both framework-independent SDK renderer entry points.
import {
  bindElectricBorder,
  createElectricBorder,
  type AssistantInstance,
} from '@youge/assistant-sdk';
import { bindElectricBorder as bindFromLauncher } from '@youge/assistant-sdk/launcher';

declare const launcher: HTMLElement;
declare const assistant: AssistantInstance;

const bound = bindElectricBorder(launcher, assistant);
bound?.update();
bound?.renderer.update({ active: true, shape: 'rounded-square', intensity: 0.8 });
bound?.destroy();

const direct = createElectricBorder(launcher);
direct?.update({ active: true, color: '#c084fc', speed: 1.2 });
direct?.destroy();

bindFromLauncher(launcher, assistant)?.destroy();
