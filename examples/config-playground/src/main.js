import {
  CORE_LOCALES,
  DEFAULTS,
  INSTALL_EXTRA_LOCALES,
  buildSdkExample,
  buildRuntimeExample,
  normalizeSettings,
} from './options.js';
import { clearSettings, loadSettings, saveSettings } from './state.js';
import { copyText } from './clipboard.js';
import { buildPreviewModel } from './preview.js';
import { LOCALE_METADATA } from '@youge/assistant-sdk/i18n';

// Native names come from the SDK's public i18n export, so the list cannot drift.
const LOCALE_NAMES = Object.fromEntries(
  CORE_LOCALES.map((code) => [code, LOCALE_METADATA[code]?.nativeName || code]),
);

const form = document.querySelector('#settings-form');
const el = (id) => document.getElementById(id);
const text = (id, value) => {
  const node = el(id);
  if (node) node.textContent = value;
};
const on = (value) => (value ? 'on' : 'off');

const storage = (() => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
})();

const loaded = loadSettings(storage);
let settings = loaded.settings;
let ignored = loaded.ignored;
let lastSdkCode = '';
let lastRuntimeCode = '';

function option(value, label, selected) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  if (value === selected) node.selected = true;
  return node;
}

function fillSelects() {
  const localeSelect = el('locale');
  localeSelect.replaceChildren(option('auto', 'Auto (browser or domain)', settings.locale));
  for (const code of CORE_LOCALES) {
    localeSelect.append(option(code, LOCALE_NAMES[code], settings.locale));
  }

  const installSelect = el('installLocale');
  installSelect.replaceChildren(option('auto', 'Auto (browser decides)', settings.installLocale));
  for (const code of CORE_LOCALES) {
    installSelect.append(option(code, LOCALE_NAMES[code], settings.installLocale));
  }
  for (const code of INSTALL_EXTRA_LOCALES) {
    installSelect.append(option(code, `${code} (dialog only)`, settings.installLocale));
  }
}


function applyToForm() {
  for (const [key, value] of Object.entries(settings)) {
    const control = el(key);
    if (!control) continue;
    if (control.type === 'checkbox') control.checked = value === true;
    else control.value = value;
  }
}

function readFromForm() {
  const raw = {};
  for (const key of Object.keys(DEFAULTS)) {
    const control = el(key);
    if (!control) continue;
    raw[key] = control.type === 'checkbox' ? control.checked : control.value;
  }
  return normalizeSettings(raw);
}

function render() {
  const model = buildPreviewModel(settings, {
    navigator: typeof navigator === 'undefined' ? null : navigator,
  });

  el('preview-frame').dataset.position = model.position;
  el('preview-frame').dataset.theme = model.theme === 'auto' ? 'auto' : model.theme;
  el('preview-panel').dataset.enabled = String(model.enabled);
  text('preview-title', model.title);
  text('preview-message', model.message);
  text('preview-module-guidance', on(model.modules.guidance));
  text('preview-module-diagnostics', on(model.modules.diagnostics));
  text('preview-module-offline', on(model.modules.offline));
  text('preview-module-cache', on(model.modules.cache));
  text('preview-module-recovery', on(model.modules.recovery));
  text('preview-locale', model.localeLabel);
  text('preview-direction', model.direction);
  text('preview-theme', model.themeLabel);
  text('preview-position', model.position);
  text('preview-presentation', model.presentation);
  text('preview-install-locale', model.installLocaleLabel);
  text(
    'preview-live',
    `Preview updated: ${model.localeLabel}, ${model.theme} appearance, ${model.position} panel. Configuration resolved locally with the public SDK.`,
  );

  lastSdkCode = buildSdkExample(settings);
  lastRuntimeCode = buildRuntimeExample(settings);
  el('sdk-code').querySelector('code').textContent = lastSdkCode;
  el('runtime-code').querySelector('code').textContent = lastRuntimeCode;
  text('copy-sdk-status', '');
  text('copy-runtime-status', '');
  text(
    'settings-status',
    ignored.length
      ? `Unsupported values ignored: ${ignored.join(', ')}. Defaults were used for those settings.`
      : 'Settings are saved in this tab only.',
  );
}

function update() {
  const next = readFromForm();
  settings = next.settings;
  ignored = next.ignored;
  saveSettings(storage, settings);
  render();
}

fillSelects();
applyToForm();
if (ignored.length) text('settings-status', `Unsupported stored values ignored: ${ignored.join(', ')}.`);
render();

form.addEventListener('change', update);
form.addEventListener('input', update);
form.addEventListener('submit', (event) => event.preventDefault());

el('reset-settings').addEventListener('click', () => {
  settings = { ...DEFAULTS };
  ignored = [];
  clearSettings(storage);
  applyToForm();
  render();
  text('settings-status', 'Reset to defaults. Nothing outside this tab was changed.');
});

async function wireCopy(buttonId, statusId, getCode, label) {
  el(buttonId).addEventListener('click', async () => {
    const outcome = await copyText(getCode());
    text(
      statusId,
      outcome === 'copied'
        ? `${label} copied to clipboard. Paste it into your host application.`
        : 'Clipboard access was blocked. Select the code above and copy it manually.',
    );
  });
}

void wireCopy('copy-sdk', 'copy-sdk-status', () => lastSdkCode, 'SDK configuration');
void wireCopy('copy-runtime', 'copy-runtime-status', () => lastRuntimeCode, 'Runtime example');
