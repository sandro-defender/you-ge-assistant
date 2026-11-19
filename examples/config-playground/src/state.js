import { DEFAULTS, SETTINGS_KEY, normalizeSettings } from './options.js';

/** All persistence is local to this browser tab; no network calls are made. */
export function loadSettings(storage, key = SETTINGS_KEY) {
  try {
    const stored = storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null;
    if (!stored) return { settings: { ...DEFAULTS }, ignored: [] };
    return normalizeSettings(JSON.parse(stored));
  } catch {
    return { settings: { ...DEFAULTS }, ignored: ['stored value was unreadable'] };
  }
}

export function saveSettings(storage, settings, key = SETTINGS_KEY) {
  try {
    if (!storage || typeof storage.setItem !== 'function') return false;
    storage.setItem(key, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function clearSettings(storage, key = SETTINGS_KEY) {
  try {
    if (!storage || typeof storage.removeItem !== 'function') return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
