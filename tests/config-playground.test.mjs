import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { copyText } from '../examples/config-playground/src/clipboard.js';
import { clearSettings, loadSettings, saveSettings } from '../examples/config-playground/src/state.js';
import {
  CORE_LOCALES,
  DEFAULTS,
  INSTALL_EXTRA_LOCALES,
  buildSdkConfig,
  buildSdkExample,
  buildRuntimeExample,
  normalizeSettings,
} from '../examples/config-playground/src/options.js';
import { buildPreviewModel } from '../examples/config-playground/src/preview.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const html = read('examples/config-playground/index.html');
const main = read('examples/config-playground/src/main.js');
const preview = read('examples/config-playground/src/preview.js');

test('playground renders labelled, semantic controls for supported settings only', () => {
  for (const key of Object.keys(DEFAULTS)) {
    assert.ok(html.includes(`id="${key}"`), `control ${key}`);
    assert.ok(main.includes(`DEFAULTS`), 'defaults are the reset source');
  }
  for (const id of ['general', 'installation', 'localization', 'diagnostics', 'runtime-only', 'code']) {
    assert.ok(html.includes(`id="${id}"`), `section ${id}`);
  }
  for (const id of ['preview-frame', 'preview-panel', 'preview-title', 'preview-message', 'preview-live', 'sdk-code', 'runtime-code', 'copy-sdk', 'copy-runtime', 'reset-settings']) {
    assert.ok(html.includes(`id="${id}"`), `preview/output element ${id}`);
  }
  assert.match(html, /ILLUSTRATIVE/);
  assert.match(html, /No Assistant instance or service worker is started/);
  assert.match(html, /settings stay in this browser tab only/);
  assert.match(html, /<fieldset/);
  assert.match(html, /<legend>/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.doesNotMatch(html, /aria-label="[^"]*secret/i);
});

test('locale selectors expose only verified SDK and installation locales', () => {
  assert.equal(CORE_LOCALES.length, 12);
  assert.deepEqual(INSTALL_EXTRA_LOCALES, ['zh-CN', 'ja', 'ko', 'pl', 'tr']);
  assert.match(main, /LOCALE_METADATA/);
  assert.match(main, /CORE_LOCALES/);
  assert.match(main, /INSTALL_EXTRA_LOCALES/);
  assert.match(preview, /isRtlLocale/);
  assert.match(html, /no RTL core translation is published/);
});

test('changing settings changes the live preview model through real SDK APIs', () => {
  const base = buildPreviewModel({ ...DEFAULTS, locale: 'en' }, { navigator: null });
  const georgian = buildPreviewModel({ ...DEFAULTS, locale: 'ka' }, { navigator: null });
  assert.equal(base.locale, 'en');
  assert.equal(georgian.locale, 'ka');
  assert.notEqual(georgian.title, base.title);
  assert.match(georgian.localeLabel, /ქართული/);

  const changed = buildPreviewModel({
    ...DEFAULTS,
    enabled: false,
    themeMode: 'dark',
    position: 'top-left',
    presentation: 'auto',
    diagnostics: false,
    installLocale: 'zh-CN',
  }, { navigator: null });
  assert.equal(changed.enabled, false);
  assert.equal(changed.theme, 'dark');
  assert.equal(changed.position, 'top-left');
  assert.equal(changed.presentation, 'auto');
  assert.equal(changed.modules.diagnostics, false);
  assert.equal(changed.modules.offline, true, 'independent controls are not disabled together');
  assert.equal(changed.installLocaleLabel, 'zh-CN · dialog only');
  assert.match(changed.title, /turned off/);
  assert.equal(changed.direction, 'LTR (all SDK core locales)');

  assert.match(main, /form\.addEventListener\('change', update\)/);
  assert.match(main, /form\.addEventListener\('input', update\)/);
  assert.match(main, /buildPreviewModel\(settings/);
  for (const id of ['preview-title', 'preview-message', 'preview-frame', 'preview-locale', 'preview-presentation']) {
    assert.ok(main.includes(`'${id}'`), `${id} is updated by render()`);
  }
});

test('generated SDK code is synchronized with settings and uses only public APIs', () => {
  const settings = {
    ...DEFAULTS,
    locale: 'ka',
    themeMode: 'dark',
    inheritHost: true,
    position: 'top-left',
    presentation: 'auto',
    installLocale: 'ka',
    diagnostics: false,
    autoUpdate: false,
  };
  const code = buildSdkExample(settings);
  assert.match(code, /import \{ YouGeAssistant \} from '@youge\/assistant-sdk';/);
  assert.match(code, /YouGeAssistant\.create\(/);
  assert.match(code, /"locale": "ka"/);
  assert.match(code, /"mode": "dark"/);
  assert.match(code, /"inheritHost": true/);
  assert.match(code, /"position": "top-left"/);
  assert.match(code, /"presentation": "auto"/);
  assert.match(code, /"diagnostics": false/);
  assert.match(code, /"autoUpdate": false/);
  assert.match(code, /assistant\.destroy\(\)/);
  assert.doesNotMatch(code, /@youge\/assistant-sdk\/src|register\(|fetch\(|from ['"]https?:/);
  const config = buildSdkConfig(settings);
  assert.equal(config.installExperience.locale, 'ka');
  assert.equal(config.modules.diagnostics, false);

  // Validate the generated shape against the actual exported SDK resolver.
  const script = `import assert from 'node:assert/strict';
import { resolveAssistantConfig } from '@youge/assistant-sdk';
import { buildSdkConfig, DEFAULTS } from ${JSON.stringify(fileURLToPath(new URL('../examples/config-playground/src/options.js', import.meta.url)))};
const resolved = resolveAssistantConfig(buildSdkConfig({ ...DEFAULTS, locale: 'ka', position: 'top-left', diagnostics: false }), { storage: null });
assert.equal(resolved.config.locale, 'ka');
assert.equal(resolved.config.position, 'top-left');
assert.equal(resolved.config.modules.diagnostics, false);
assert.equal(resolved.meta.source, 'overrides');
assert.deepEqual(resolved.meta.warnings, []);`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: resolve(root, 'examples/config-playground'),
    stdio: 'pipe',
  });
});

test('full runtime example is clearly separate and tracks runtime-only switches', () => {
  const off = buildRuntimeExample(DEFAULTS);
  assert.match(off, /Full You\.Ge Assistant runtime — a separate integration from the SDK/);
  assert.match(off, /window\.YOU_GE_ASSISTANT_CONFIG/);
  assert.match(off, /<script src="\/pwa\.js" defer data-install-presentation="manual" data-install-locale="auto"><\/script>/);
  assert.doesNotMatch(off, /data-toolbox|data-install-banner|data-auto-update/);
  assert.doesNotMatch(off, /data-assistant-worker|serviceWorker/);

  const on = buildRuntimeExample({
    ...DEFAULTS,
    runtimeToolbox: true,
    runtimeInstallBanner: true,
    runtimeAutoUpdate: true,
    presentation: 'auto',
    installLocale: 'ka',
    locale: 'ka',
    diagnostics: false,
  });
  assert.match(on, /data-toolbox/);
  assert.match(on, /data-install-banner/);
  assert.match(on, /data-auto-update/);
  assert.match(on, /data-install-presentation="auto"/);
  assert.match(on, /data-install-locale="ka"/);
  assert.match(on, /"locale": "ka"/);
  assert.match(on, /"diagnostics": false/);
  assert.match(html, /These switches are <strong>not SDK settings<\/strong>/);
});

test('copy action gives success and failure feedback with a working fallback', async () => {
  let copied = '';
  const result = await copyText('const x = 1;', {
    navigator: { clipboard: { writeText: async (value) => { copied = value; } } },
    document: {},
  });
  assert.equal(result, 'copied');
  assert.equal(copied, 'const x = 1;');

  let selected = '';
  let removed = false;
  const fakeDocument = {
    body: { appendChild() {} },
    createElement: () => ({
      style: {},
      setAttribute() {},
      select() { selected = 'copied text'; },
      remove() { removed = true; },
    }),
    execCommand: () => true,
  };
  const fallback = await copyText('copied text', { navigator: {}, document: fakeDocument });
  assert.equal(fallback, 'copied');
  assert.equal(selected, 'copied text');
  assert.ok(removed);

  const failed = await copyText('x', { navigator: {}, document: {} });
  assert.equal(failed, 'failed');
  assert.match(main, /Clipboard access was blocked/);
  assert.match(main, /copied to clipboard/);
});

test('unsupported, invalid and credential-like settings are ignored', () => {
  const { settings, ignored } = normalizeSettings({
    locale: 'not-a-locale',
    diagnostics: 'false',
    position: 'somewhere',
    apiKey: 'secret-should-never-be-stored',
    themeMode: 'neon',
    installLocale: 'ka',
  });
  assert.equal(settings.locale, DEFAULTS.locale);
  assert.equal(settings.diagnostics, DEFAULTS.diagnostics);
  assert.equal(settings.position, DEFAULTS.position);
  assert.equal(settings.themeMode, DEFAULTS.themeMode);
  assert.equal(settings.installLocale, 'ka');
  assert.ok(!('apiKey' in settings));
  assert.ok(ignored.includes('apiKey'));
  assert.equal(ignored.length, 5);
  assert.deepEqual(normalizeSettings(null).settings, { ...DEFAULTS });
  assert.equal(normalizeSettings({ enabled: false }).settings.enabled, false);
});

test('settings are local-only, persisted in the tab and resettable', async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const saved = { ...DEFAULTS, locale: 'ka', diagnostics: false };
  assert.equal(saveSettings(storage, saved), true);
  const loaded = loadSettings(storage);
  assert.equal(loaded.settings.locale, 'ka');
  assert.equal(loaded.settings.diagnostics, false);
  assert.equal(clearSettings(storage), true);
  assert.deepEqual(loadSettings(storage).settings, { ...DEFAULTS });

  values.set('youge:config-playground:settings:v1', '{bad json');
  const recovered = loadSettings(storage);
  assert.deepEqual(recovered.settings, { ...DEFAULTS });
  assert.ok(recovered.ignored.length > 0);

  assert.match(main, /window\.sessionStorage/);
  assert.match(main, /clearSettings\(storage\)/);
  for (const path of [
    'examples/config-playground/src/main.js',
    'examples/config-playground/src/options.js',
    'examples/config-playground/src/state.js',
    'examples/config-playground/src/clipboard.js',
    'examples/config-playground/src/preview.js',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /\bfetch\(|XMLHttpRequest|sendBeacon|localStorage|serviceWorker|beforeinstallprompt/, `${path} stays local`);
  }
});

test('Pages and verification workflows build the isolated playground before assembly and checks', () => {
  const assembler = read('scripts/assemble-pages.mjs');
  assert.match(assembler, /examples\/config-playground\/dist/);
  assert.match(assembler, /join\(safeOutputDir, 'config-playground'\)/);
  assert.match(assembler, /examples\/demo\/index\.html.*demoOutDir/s);
  const expectedOrder = {
    'check.yml': ['Build local Configuration Playground', 'Static checks and precache integrity gate'],
    'sdk-release-prep.yml': ['Consumer build verification (Configuration Playground)', 'Static checks, contracts and unit tests'],
    'pages.yml': ['Build local Configuration Playground', 'Assemble GitHub Pages site'],
  };
  for (const [workflow, [buildName, laterName]] of Object.entries(expectedOrder)) {
    const yaml = read(`.github/workflows/${workflow}`);
    const buildStart = yaml.indexOf(`- name: ${buildName}`);
    const laterStart = yaml.indexOf(`- name: ${laterName}`);
    assert.ok(buildStart >= 0 && laterStart > buildStart, `${workflow} order`);
    assert.match(yaml.slice(buildStart, laterStart), /working-directory: examples\/config-playground/);
  }
});
