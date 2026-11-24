import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Release audit for the 0.4.0 public surface.
 *
 * Everything here imports the package through its *published* entry points
 * (`@youge/assistant-sdk`, `@youge/assistant-sdk/i18n`,
 * `@youge/assistant-sdk/installation`) rather than relative source paths, so the
 * test exercises exactly what an npm consumer resolves through the `exports`
 * map. Private source paths must stay unreachable.
 */

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
const read = (rel) => readFileSync(join(pkgRoot, rel), 'utf8');

const CORE_LOCALES = ['en', 'ka', 'ru', 'fr', 'it', 'de', 'sv', 'nl', 'no', 'da', 'et', 'es'];

const i18n = await import('@youge/assistant-sdk/i18n');
const installation = await import('@youge/assistant-sdk/installation');
const launcher = await import('@youge/assistant-sdk/launcher');
const root = await import('@youge/assistant-sdk');

test('the 0.4.0 export map publishes the localization and installation entries without wildcards', () => {
  assert.deepEqual(Object.keys(pkg.exports).sort(), [
    '.',
    './browser',
    './config',
    './diagnostics',
    './domain',
    './i18n',
    './installation',
    './launcher',
    './package.json',
    './react',
    './theme',
  ]);
  assert.deepEqual(
    Object.keys(pkg.exports).filter((key) => key.includes('*')),
    [],
    'no wildcard subpath export may expose internal source files',
  );
  for (const subpath of ['./i18n', './installation', './launcher']) {
    assert.ok(pkg.exports[subpath].types.endsWith('.d.ts'), `${subpath} ships paired declarations`);
    assert.ok(pkg.exports[subpath].default.endsWith('.js'), `${subpath} resolves to a runtime module`);
  }
  assert.equal(pkg.version, '0.4.1');
  assert.equal(root.SDK_VERSION, '0.4.1');
  assert.equal(root.KIT_COMPAT_VERSION, '1.2.9');
  assert.deepEqual(Object.keys(pkg.dependencies || {}), [], 'the SDK keeps zero runtime dependencies');
});

test('private SDK source paths stay unreachable through the package specifier', async () => {
  for (const specifier of [
    '@youge/assistant-sdk/src/index.js',
    '@youge/assistant-sdk/src/core/i18n.js',
    '@youge/assistant-sdk/src/installation/index.js',
    '@youge/assistant-sdk/core/i18n',
  ]) {
    await assert.rejects(
      () => import(specifier),
      (error) => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
      `${specifier} must be blocked by the export map`,
    );
  }
  assert.ok(
    read('src/core/i18n.d.ts').includes('export declare function resolveLocale'),
    'localization declarations live inside the shipped package',
  );
});

test('the root entry re-exports the complete localization API of the i18n subpath', () => {
  const names = Object.keys(i18n).filter((name) => name !== 'default');
  assert.deepEqual(names.sort(), [
    'DEFAULT_LOCALE',
    'DNS_CLASSIFICATION_LABELS',
    'LOCALE_METADATA',
    'RTL_LOCALES',
    'SDK_TRANSLATIONS',
    'SUPPORTED_LOCALES',
    'chromeHandoffLabels',
    'formatAlertCount',
    'isRtlLocale',
    'localizeDnsClassification',
    'localizeDnsMessage',
    'normalizeInstallLocaleTag',
    'normalizeLocaleTag',
    'resolveLocale',
    'translate',
  ]);
  const missing = names.filter((name) => !(name in root));
  assert.deepEqual(missing, [], 'every i18n subpath export is also reachable from the root entry');
});

test('all 12 core locales resolve, translate, pluralize, localize DNS copy and hand off labels', () => {
  assert.deepEqual([...i18n.SUPPORTED_LOCALES], CORE_LOCALES);
  assert.deepEqual(Object.keys(i18n.LOCALE_METADATA).sort(), [...CORE_LOCALES].sort());
  assert.equal(i18n.DEFAULT_LOCALE, 'en');

  const englishLabels = i18n.chromeHandoffLabels('en');
  const englishKeys = Object.keys(i18n.SDK_TRANSLATIONS.en);

  for (const locale of CORE_LOCALES) {
    assert.equal(i18n.resolveLocale({ explicit: locale }), locale, `${locale} resolves explicitly`);
    assert.equal(i18n.normalizeLocaleTag(locale.toUpperCase()), locale, `${locale} normalizes case-insensitively`);
    assert.equal(i18n.LOCALE_METADATA[locale].code, locale, `${locale} ships locale metadata`);
    assert.ok(i18n.LOCALE_METADATA[locale].nativeName.length > 0, `${locale} ships a native name`);
    assert.equal(i18n.isRtlLocale(locale), false, `${locale} is a left-to-right locale`);

    const dictionary = i18n.SDK_TRANSLATIONS[locale];
    assert.deepEqual(
      Object.keys(dictionary).sort(),
      [...englishKeys].sort(),
      `${locale} defines the same translation keys as English`,
    );
    assert.ok(
      Object.values(dictionary).every((value) => typeof value === 'string' && value.trim().length > 0),
      `${locale} has no empty translations`,
    );

    const copy = installation.resolveInstallationCopy(locale);
    assert.equal(copy.language, locale, `${locale} installation copy reports its language`);
    for (const [key, value] of Object.entries(copy)) {
      if (key === 'language') continue;
      assert.equal(typeof value, 'string', `${locale}.${key} is a string`);
      assert.ok(value.trim().length > 0, `${locale}.${key} is not empty`);
      assert.equal(value, i18n.translate(locale, key), `${locale}.${key} reuses the shared dictionary`);
    }

    const labels = i18n.chromeHandoffLabels(locale);
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(englishLabels).sort(), `${locale} handoff labels match English keys`);
    assert.ok(
      Object.values(labels).every((value) => typeof value === 'string' && value.trim().length > 0),
      `${locale} handoff labels are populated`,
    );

    assert.equal(i18n.formatAlertCount(locale, 0).startsWith('0 '), true, `${locale} formats zero alerts`);
    assert.equal(i18n.formatAlertCount(locale, 2).startsWith('2 '), true, `${locale} formats plural alerts`);
    assert.equal(
      typeof i18n.localizeDnsClassification(locale, 'dns_resolution_failure', 'fail'),
      'string',
    );
    const dnsMessage = i18n.localizeDnsMessage(locale, 'dns_resolution_failure', 'fallback', true);
    assert.ok(dnsMessage.message.trim().length > 0, `${locale} localizes DNS messages`);
    assert.equal(typeof dnsMessage.caveat, 'string', `${locale} DNS caveat is a string`);
  }

  // Non-English copy actually differs from English for the installation surface.
  const englishInstallLabel = installation.resolveInstallationCopy('en').installActionLabel;
  for (const locale of CORE_LOCALES.filter((code) => code !== 'en')) {
    assert.notEqual(
      installation.resolveInstallationCopy(locale).installActionLabel,
      englishInstallLabel,
      `${locale} ships its own install action label`,
    );
  }

  // Norwegian variants and regional tags are normalized onto the core set.
  assert.equal(i18n.normalizeLocaleTag('nb-NO'), 'no');
  assert.equal(i18n.normalizeLocaleTag('nn'), 'no');
  assert.equal(i18n.normalizeLocaleTag('ka-GE'), 'ka');
  assert.equal(i18n.normalizeLocaleTag('de_AT'), 'de');
  assert.equal(i18n.normalizeLocaleTag('ja'), '', 'unsupported locales are rejected');
  assert.equal(i18n.normalizeInstallLocaleTag('nb'), 'no');
  assert.equal(i18n.normalizeInstallLocaleTag('zh-hant'), 'zh-TW', 'the install component keeps richer tags');
  assert.equal(i18n.normalizeInstallLocaleTag('auto'), 'auto');

  // RTL detection is metadata for host layouts, not a supported core locale.
  for (const rtl of ['ar', 'he', 'fa', 'ur', 'ar-EG']) {
    assert.equal(i18n.isRtlLocale(rtl), true, `${rtl} is right-to-left`);
    assert.ok(i18n.RTL_LOCALES.includes(rtl.split('-')[0]), `${rtl} is listed in RTL_LOCALES`);
  }

  // Russian keeps its three plural forms.
  assert.equal(i18n.formatAlertCount('ru', 1), '1 уведомление');
  assert.equal(i18n.formatAlertCount('ru', 2), '2 уведомления');
  assert.equal(i18n.formatAlertCount('ru', 5), '5 уведомлений');
  assert.equal(i18n.formatAlertCount('en', 1), '1 alert');
  assert.equal(i18n.formatAlertCount('en', 3), '3 alerts');

  // Locale resolution precedence: explicit > domain default > navigator > fallback.
  assert.equal(i18n.resolveLocale({ explicit: 'ka', domainLocale: 'ru', navigatorLanguage: 'de' }), 'ka');
  assert.equal(i18n.resolveLocale({ explicit: 'auto', domainLocale: 'ru', navigatorLanguage: 'de' }), 'ru');
  assert.equal(i18n.resolveLocale({ navigator: { languages: ['ja', 'es-ES'] } }), 'es');
  assert.equal(i18n.resolveLocale({ navigatorLanguage: 'ja', fallback: 'fr' }), 'fr');
});

test('the installation entry point exposes the documented 0.4.0 APIs and TypeScript types', () => {
  assert.deepEqual(Object.keys(installation).sort(), [
    'deriveInstallationState',
    'hidePwaInstallDialog',
    'readInstalledRelatedApps',
    'readPwaSnapshot',
    'requestPwaInstall',
    'requestPwaUpdate',
    'resolveInstallationCopy',
    'showPwaInstallDialog',
    'triggerPwaInstall',
  ]);

  const required = [
    'deriveInstallationState',
    'resolveInstallationCopy',
    'requestPwaInstall',
    'showPwaInstallDialog',
    'hidePwaInstallDialog',
    'triggerPwaInstall',
    'readInstalledRelatedApps',
  ];
  const missingFromRoot = required.filter((name) => typeof root[name] !== 'function');
  assert.deepEqual(missingFromRoot, [], 'the root entry exposes every installation API');
  const missingFromStatic = required.filter((name) => typeof root.YouGeAssistant[name] !== 'function');
  assert.deepEqual(
    missingFromStatic,
    ['deriveInstallationState', 'requestPwaInstall', 'showPwaInstallDialog', 'hidePwaInstallDialog', 'triggerPwaInstall', 'readInstalledRelatedApps'],
    'the frozen static object keeps its documented 0.3.0 surface (resolveInstallationCopy only)',
  );

  const dts = read('src/installation/index.d.ts');
  for (const name of required) {
    assert.match(dts, new RegExp(`export declare function ${name}\\b`), `${name} has a declaration`);
  }
  for (const type of [
    'InstallationSupport',
    'InstallationStatus',
    'PwaRuntimeLike',
    'AssistantInstallationState',
    'InstallationCopySet',
    'InstallDialogResult',
    'RelatedAppInfo',
    'AssistantUpdateResult',
  ]) {
    assert.match(dts, new RegExp(`export (type|interface) ${type}\\b`), `${type} is exported as a type`);
  }
  const indexDts = read('src/index.d.ts');
  for (const name of required) {
    assert.match(indexDts, new RegExp(`\\b${name}\\b`), `the root declarations mention ${name}`);
  }
  const i18nDts = read('src/core/i18n.d.ts');
  assert.match(i18nDts, /export type SupportedLocale =/, 'SupportedLocale names the 12 core locales');
  for (const locale of CORE_LOCALES) {
    assert.match(i18nDts, new RegExp(`'${locale}'`), `SupportedLocale includes ${locale}`);
  }
});

test('deriveInstallationState classifies native, manual, installed and unavailable installations', () => {
  const none = installation.deriveInstallationState();
  assert.equal(none.support, 'none');
  assert.equal(none.status, 'unavailable');
  assert.equal(none.componentEnabled, false, 'no PWA runtime means no installation component');
  assert.equal(none.relatedAppsInstalled, false);

  const native = installation.deriveInstallationState({
    pwa: { getState: () => ({ canInstall: true, installBackend: 'beforeinstallprompt' }) },
  });
  assert.equal(native.support, 'native');
  assert.equal(native.status, 'available');
  assert.equal(native.platform, 'chromium');
  assert.equal(native.nativeAvailable, true);
  assert.equal(native.componentEnabled, true);

  const ios = installation.deriveInstallationState({ pwa: { getState: () => ({ ios: true, safari: true }) } });
  assert.equal(ios.support, 'manual-ios');
  assert.equal(ios.platform, 'ios');
  assert.equal(ios.nativeAvailable, false, 'iOS never reports a native programmatic prompt');

  const generic = installation.deriveInstallationState({ pwa: { getState: () => ({}) } });
  assert.equal(generic.support, 'manual-generic');
  assert.equal(generic.backend, 'manual');

  const installed = installation.deriveInstallationState({ pwa: { getState: () => ({ installed: true }) } });
  assert.equal(installed.support, 'installed');
  assert.equal(installed.status, 'installed');
  assert.equal(installed.installed, true);

  const disabledByFeature = installation.deriveInstallationState({
    pwa: { getState: () => ({ canInstall: true }), config: { features: { installation: false } } },
  });
  assert.equal(disabledByFeature.support, 'none', 'the toolkit installation feature flag is respected');
  assert.equal(disabledByFeature.componentEnabled, false);

  const disabledByModule = installation.deriveInstallationState({
    pwa: { getState: () => ({ canInstall: true }) },
    enabled: false,
  });
  assert.equal(disabledByModule.support, 'none');
  assert.equal(disabledByModule.componentEnabled, false);

  const detectionOff = installation.deriveInstallationState({
    pwa: { getState: () => ({ canInstall: true, installDialogOpen: true }) },
    detection: false,
  });
  assert.equal(detectionOff.canInstall, false, 'detection: false never claims installability');
  assert.equal(detectionOff.dialogOpen, false);
  assert.equal(detectionOff.backend, 'none');

  const configured = installation.deriveInstallationState({
    pwa: {
      getState: () => ({
        canInstall: true,
        installComponentLoaded: true,
        installDialogOpen: true,
        installPresentation: 'auto',
        installLocale: 'ka',
        relatedAppsInstalled: true,
      }),
    },
    installExperience: { presentation: 'auto', locale: 'de' },
  });
  assert.equal(configured.componentLoaded, true);
  assert.equal(configured.dialogOpen, true);
  assert.equal(configured.presentation, 'auto');
  assert.equal(configured.locale, 'de');
  assert.equal(configured.relatedAppsInstalled, true);
});

test('installation dialog, prompt and related-app helpers delegate safely to the host PWA runtime', async () => {
  const calls = [];
  const pwa = {
    promptInstall: (options) => {
      calls.push(['promptInstall', options]);
      return Promise.resolve({ outcome: 'accepted' });
    },
    showInstallDialog: (options) => {
      calls.push(['showInstallDialog', options]);
      return Promise.resolve({ shown: true, outcome: 'shown', backend: 'pwa-install' });
    },
    hideInstallDialog: () => {
      calls.push(['hideInstallDialog']);
      return true;
    },
    triggerInstall: (options) => {
      calls.push(['triggerInstall', options]);
      return Promise.resolve({ outcome: 'accepted', backend: 'pwa-install' });
    },
    getInstalledRelatedApps: () => Promise.resolve([{ id: 'related-app', platform: 'webapp' }]),
  };

  assert.deepEqual(await installation.requestPwaInstall({ pwa }, { immediate: true }), { outcome: 'accepted' });
  assert.deepEqual(calls[0], ['promptInstall', { immediate: true }]);

  assert.deepEqual(
    await installation.showPwaInstallDialog({ pwa }, { locale: 'ka' }),
    { shown: true, outcome: 'shown', backend: 'pwa-install' },
  );
  assert.deepEqual(calls[1], ['showInstallDialog', { locale: 'ka' }]);

  assert.equal(installation.hidePwaInstallDialog({ pwa }), true);
  assert.deepEqual(calls[2], ['hideInstallDialog']);

  assert.deepEqual(
    await installation.triggerPwaInstall({ pwa }, { source: 'assistant' }),
    { outcome: 'accepted', backend: 'pwa-install' },
  );
  assert.deepEqual(calls[3], ['triggerInstall', { source: 'assistant' }]);

  assert.deepEqual(
    await installation.readInstalledRelatedApps({ pwa }),
    [{ id: 'related-app', platform: 'webapp' }],
  );

  // Manual-installation browsers: no prompt API, no crash, honest outcomes.
  assert.deepEqual(await installation.requestPwaInstall({}), { outcome: 'unsupported' });
  assert.deepEqual(await installation.requestPwaInstall({ pwa, enabled: false }), { outcome: 'unsupported' });
  assert.deepEqual(
    await installation.showPwaInstallDialog({ pwa: { promptInstall: () => ({ outcome: 'dismissed' }) } }),
    { shown: true, outcome: 'dismissed', backend: 'classic' },
  );
  assert.deepEqual(
    await installation.showPwaInstallDialog({}),
    { shown: false, outcome: 'unsupported', backend: 'none' },
  );
  assert.deepEqual(
    await installation.showPwaInstallDialog({ pwa, enabled: false }),
    { shown: false, outcome: 'disabled', backend: 'none' },
  );
  assert.equal(installation.hidePwaInstallDialog({}), false);
  assert.deepEqual(await installation.triggerPwaInstall({}), { outcome: 'unsupported', backend: 'none' });
  assert.deepEqual(
    await installation.triggerPwaInstall({ pwa: { promptInstall: () => ({ outcome: 'unavailable' }) } }),
    { outcome: 'unavailable' },
    'browsers without triggerInstall fall back to the prompt API',
  );
  assert.deepEqual(
    await installation.triggerPwaInstall({
      pwa: {
        triggerInstall: () => {
          throw new Error('boom');
        },
      },
    }),
    { outcome: 'error', backend: 'none' },
  );

  // navigator.getInstalledRelatedApps fallback and rejection tolerance.
  assert.deepEqual(
    await installation.readInstalledRelatedApps({ navigator: { getInstalledRelatedApps: () => Promise.resolve(['app']) } }),
    ['app'],
  );
  assert.deepEqual(
    await installation.readInstalledRelatedApps({
      navigator: { getInstalledRelatedApps: () => Promise.reject(new Error('denied')) },
    }),
    [],
  );
  assert.deepEqual(await installation.readInstalledRelatedApps({ detection: false }), []);
  assert.deepEqual(await installation.readInstalledRelatedApps(), []);
});

test('the 0.4.0 installation module never registers a worker, fetches or polls', () => {
  const source = read('src/installation/index.js');
  assert.doesNotMatch(source, /serviceWorker\s*\.\s*register/, 'no service-worker registration');
  assert.doesNotMatch(source, /\bfetch\s*\(/, 'no background network traffic');
  assert.doesNotMatch(source, /setInterval|setTimeout/, 'no polling or timers');
  assert.match(source, /import \{ resolveLocale, translate \} from '\.\.\/core\/i18n\.js';/, 'copy comes from the shared dictionary');
});
