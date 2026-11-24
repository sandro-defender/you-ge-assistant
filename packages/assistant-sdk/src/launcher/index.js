/*!
 * @youge/assistant-sdk/launcher — validated launcher configuration + attention derivation
 * -----------------------------------------------------------------------------------
 * Framework-agnostic helpers. The visual effect is an original CSS/SVG treatment;
 * it does not include or port the React Bits WebGL component.
 */

const SHAPES = Object.freeze(['circle', 'rounded-square', 'square']);
const LOGO_FITS = Object.freeze(['contain', 'cover', 'fill']);
const ANIMATION_TYPES = Object.freeze(['electric-border']);
const CATEGORIES = Object.freeze(['installation', 'connectivity', 'recovery', 'backup', 'update', 'help', 'custom']);
const COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const LAUNCHER_DEFAULTS = Object.freeze({
  size: 56,
  logo: '',
  appearance: Object.freeze({
    shape: 'circle',
    logoFit: 'contain',
    logoScale: 1,
    logoPosition: Object.freeze({ x: 50, y: 50 }),
    logoBorderRadius: '50%',
    logoSize: 72,
    border: Object.freeze({ width: 1, color: '#334155', style: 'solid' }),
  }),
  animation: Object.freeze({
    enabled: false,
    type: 'electric-border',
    color: '#c084fc',
    preset: 'plasma',
    speed: 1,
    intensity: 0.8,
    trigger: 'action-available',
    triggerCategories: Object.freeze(['installation', 'connectivity', 'recovery']),
    stopWhenViewed: true,
  }),
});

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function number(value, fallback, min, max) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function cssRadius(value, fallback) {
  if (typeof value === 'number' && Number.isFinite(value)) return `${number(value, 0, 0, 64)}px`;
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim();
  if (/^(?:\d+(?:\.\d+)?)(?:px|%)$/.test(cleaned)) {
    const amount = Number.parseFloat(cleaned);
    const unit = cleaned.endsWith('%') ? '%' : 'px';
    return `${Math.min(unit === '%' ? 50 : 64, Math.max(0, amount))}${unit}`;
  }
  return fallback;
}

export function normalizeLauncherConfig(input) {
  const raw = record(input);
  const appearance = record(raw.appearance);
  const position = record(appearance.logoPosition);
  const border = record(appearance.border);
  const animation = record(raw.animation);
  const categories = Array.isArray(animation.triggerCategories)
    ? [...new Set(animation.triggerCategories.filter((category) => CATEGORIES.includes(category)))].slice(0, CATEGORIES.length)
    : [...LAUNCHER_DEFAULTS.animation.triggerCategories];
  const color = typeof animation.color === 'string' && COLOR.test(animation.color)
    ? animation.color
    : LAUNCHER_DEFAULTS.animation.color;
  const borderColor = typeof border.color === 'string' && COLOR.test(border.color)
    ? border.color
    : LAUNCHER_DEFAULTS.appearance.border.color;
  const candidateLogo = typeof raw.logo === 'string' ? raw.logo.trim() : '';
  const logo = candidateLogo.length <= 2048 &&
    !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(candidateLogo) &&
    candidateLogo.indexOf(String.fromCharCode(92)) === -1 && !/[<>\u0000-\u001f]/.test(candidateLogo) &&
    !candidateLogo.split(/[/?#]/).some((part) => part === '..')
    ? candidateLogo
    : '';

  return {
    size: number(raw.size, LAUNCHER_DEFAULTS.size, 40, 128),
    sizeConfigured: raw.size !== undefined && raw.size !== null,
    logo,
    appearance: {
      shape: oneOf(appearance.shape, SHAPES, LAUNCHER_DEFAULTS.appearance.shape),
      logoFit: oneOf(appearance.logoFit, LOGO_FITS, LAUNCHER_DEFAULTS.appearance.logoFit),
      logoScale: number(appearance.logoScale, LAUNCHER_DEFAULTS.appearance.logoScale, 0.5, 2.5),
      logoPosition: {
        x: number(position.x, LAUNCHER_DEFAULTS.appearance.logoPosition.x, 0, 100),
        y: number(position.y, LAUNCHER_DEFAULTS.appearance.logoPosition.y, 0, 100),
      },
      logoBorderRadius: cssRadius(appearance.logoBorderRadius, LAUNCHER_DEFAULTS.appearance.logoBorderRadius),
      logoSize: number(appearance.logoSize, LAUNCHER_DEFAULTS.appearance.logoSize, 30, 100),
      border: {
        width: number(border.width, LAUNCHER_DEFAULTS.appearance.border.width, 0, 8),
        color: borderColor,
        style: oneOf(border.style, ['solid', 'dashed', 'none'], LAUNCHER_DEFAULTS.appearance.border.style),
      },
    },
    animation: {
      enabled: animation.enabled === true,
      type: oneOf(animation.type, ANIMATION_TYPES, LAUNCHER_DEFAULTS.animation.type),
      color,
      preset: animation.preset === 'plasma' ? 'plasma' : LAUNCHER_DEFAULTS.animation.preset,
      speed: number(animation.speed, LAUNCHER_DEFAULTS.animation.speed, 0.25, 2.5),
      intensity: number(animation.intensity, LAUNCHER_DEFAULTS.animation.intensity, 0, 1),
      trigger: animation.trigger === 'action-available' ? 'action-available' : LAUNCHER_DEFAULTS.animation.trigger,
      triggerCategories: categories,
      stopWhenViewed: animation.stopWhenViewed !== false,
    },
  };
}

export function launcherActionCategory(action) {
  if (!action || typeof action !== 'object') return null;
  switch (action.kind) {
    case 'install': return 'installation';
    case 'diagnostics': return 'connectivity';
    case 'recovery': return 'recovery';
    case 'backup': return 'backup';
    case 'update': return 'update';
    case 'help': return 'help';
    case 'custom': return 'custom';
    default: return null;
  }
}

/**
 * Attention is tied to existing notification/action pairs. Merely having
 * available actions (for example the always-present diagnostics shortcut) is
 * not enough to animate the launcher.
 */
export function deriveLauncherAttention(state, launcherConfig) {
  const suppliedAnimation = launcherConfig && record(launcherConfig).animation;
  const config = suppliedAnimation && typeof suppliedAnimation.enabled === 'boolean' && Array.isArray(suppliedAnimation.triggerCategories)
    ? launcherConfig
    : normalizeLauncherConfig(launcherConfig);
  const options = config.animation;
  const notifications = state && Array.isArray(state.notifications) ? state.notifications : [];
  const actions = state && Array.isArray(state.availableActions) ? state.availableActions : [];
  const viewed = state && Array.isArray(state.viewed) ? state.viewed : [];
  const dismissed = state && Array.isArray(state.dismissed) ? state.dismissed : [];
  const acknowledged = state && Array.isArray(state.acknowledged) ? state.acknowledged : [];
  const completed = state && Array.isArray(state.completed) ? state.completed : [];
  const hasNotice = (keys, id) => keys.some((key) => key === id || String(key).endsWith(`:${id}`));
  if (!options.enabled) return { active: false, eligibleActionIds: [], priority: null };

  const eligible = [];
  notifications.forEach((notification) => {
    if (!notification || (!notification.actionId && !Array.isArray(notification.actionIds))) return;
    if ((options.stopWhenViewed && hasNotice(viewed, notification.id)) || hasNotice(dismissed, notification.id) || hasNotice(acknowledged, notification.id) || hasNotice(completed, notification.id)) return;
    const candidates = Array.isArray(notification.actionIds) ? notification.actionIds : [notification.actionId];
    candidates.forEach((actionId) => {
      const action = actions.find((entry) => entry && entry.id === actionId);
      if (!action) return;
      const category = launcherActionCategory(action);
      if (!category || !options.triggerCategories.includes(category)) return;
      eligible.push({ id: action.id, priority: Number(action.priority) || Number(notification.priority) || 5 });
    });
  });
  const bestPriority = eligible.reduce((best, entry) => Math.min(best, entry.priority), Infinity);
  return {
    active: eligible.length > 0,
    eligibleActionIds: [...new Set(eligible.map((entry) => entry.id))],
    priority: Number.isFinite(bestPriority) ? bestPriority : null,
  };
}

export const LAUNCHER_SHAPES = SHAPES;
export const LAUNCHER_LOGO_FITS = LOGO_FITS;
export const LAUNCHER_ANIMATION_TYPES = ANIMATION_TYPES;
export const LAUNCHER_ACTION_CATEGORIES = CATEGORIES;
