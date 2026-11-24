/*!
 * @youge/assistant-sdk/launcher — framework-independent DOM renderers
 */
import { createElectricBorder } from './electric-border.js';
export { createElectricBorder };

/** Mount and keep the ElectricBorder renderer synchronized with SDK state. */
export function bindElectricBorder(container, assistant, environment) {
  if (!assistant || typeof assistant.getState !== 'function' || typeof assistant.subscribe !== 'function') return null;
  const renderer = createElectricBorder(container, environment);
  if (!renderer) return null;
  const update = () => {
    const state = assistant.getState();
    const launcher = state && state.appearance && state.appearance.launcher;
    if (!launcher) return;
    const animation = launcher.animation || {};
    const appearance = launcher.appearance || {};
    const size = Number(launcher.size) || 56;
    renderer.update({
      active: animation.enabled === true && Boolean(launcher.attention && launcher.attention.active),
      color: animation.color,
      speed: animation.speed,
      intensity: animation.intensity,
      shape: appearance.shape,
      borderRadius: appearance.shape === 'circle' ? size / 2 : appearance.shape === 'rounded-square' ? size * 0.24 : size * 0.08,
      interactive: true,
    });
  };
  update();
  const unsubscribe = assistant.subscribe(update, { immediate: false });
  return {
    renderer,
    update,
    destroy() {
      if (typeof unsubscribe === 'function') unsubscribe();
      renderer.destroy();
    },
  };
}
