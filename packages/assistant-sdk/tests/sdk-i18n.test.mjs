import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LOCALE,
  DNS_CLASSIFICATION_LABELS,
  LOCALE_METADATA,
  RTL_LOCALES,
  SDK_TRANSLATIONS,
  SUPPORTED_LOCALES,
  YouGeAssistant,
  chromeHandoffLabels,
  createChromeHandoff,
  formatAlertCount,
  isRtlLocale,
  localizeDnsClassification,
  localizeDnsMessage,
  normalizeInstallLocaleTag,
  normalizeLocaleTag,
  resolveLocale,
  translate,
} from '../src/index.js';
import * as i18nSubpath from '../src/core/i18n.js';

const EXPECTED_LOCALES = ['en', 'ka', 'ru', 'fr', 'it', 'de', 'sv', 'nl', 'no', 'da', 'et', 'es'];

test('i18n subpath and root exports expose all 12 core locales with complete keys', () => {
  assert.deepEqual([...SUPPORTED_LOCALES], EXPECTED_LOCALES);
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.equal(i18nSubpath.SUPPORTED_LOCALES, SUPPORTED_LOCALES);

  const enKeys = Object.keys(SDK_TRANSLATIONS.en);
  assert.ok(enKeys.length > 50, 'en translation dictionary has full core entries');

  for (const code of EXPECTED_LOCALES) {
    assert.ok(LOCALE_METADATA[code], `metadata exists for ${code}`);
    assert.equal(LOCALE_METADATA[code].code, code);
    assert.ok(LOCALE_METADATA[code].nativeName, `nativeName exists for ${code}`);
    assert.ok(SDK_TRANSLATIONS[code], `dictionary exists for ${code}`);
    const missing = enKeys.filter((k) => !Object.prototype.hasOwnProperty.call(SDK_TRANSLATIONS[code], k));
    assert.deepEqual(missing, [], `${code} matches every English SDK key`);
    assert.ok(DNS_CLASSIFICATION_LABELS[code], `DNS classification labels exist for ${code}`);
    for (const status of [
      'unknown',
      'normal_connectivity',
      'general_internet_failure',
      'dns_resolution_failure',
      'dns_records_missing',
      'application_host_unavailable',
      'backend_unavailable',
      'cloudflare_doh_unavailable',
      'possible_dns_interference',
      'inconclusive',
      'disabled',
      'cancelled',
      'error',
    ]) {
      assert.ok(DNS_CLASSIFICATION_LABELS[code][status], `${code} has DNS label for ${status}`);
    }
  }
});

test('normalizeLocaleTag, normalizeInstallLocaleTag, resolveLocale and RTL detection handle edge cases', () => {
  assert.equal(normalizeLocaleTag('nb-NO'), 'no');
  assert.equal(normalizeLocaleTag('nn_NO'), 'no');
  assert.equal(normalizeLocaleTag('ka_GE'), 'ka');
  assert.equal(normalizeLocaleTag('et-EE'), 'et');
  assert.equal(normalizeLocaleTag('auto'), '');
  assert.equal(normalizeLocaleTag('not a valid tag!'), '');
  assert.equal(normalizeLocaleTag(''), '');

  assert.equal(normalizeInstallLocaleTag('zh-hans'), 'zh-CN');
  assert.equal(normalizeInstallLocaleTag('zh_Hant_TW'), 'zh-TW');
  assert.equal(normalizeInstallLocaleTag('ca'), 'ca-ES');
  assert.equal(normalizeInstallLocaleTag('nb-NO'), 'no');
  assert.equal(normalizeInstallLocaleTag('nn'), 'no');

  assert.equal(
    resolveLocale({
      explicit: 'auto',
      domainLocale: 'et',
      navigator: { languages: ['ka-GE', 'en-US'], language: 'en-US' },
    }),
    'et'
  );
  assert.equal(
    resolveLocale({
      explicit: 'fr-CA',
      domainLocale: 'et',
      navigator: { languages: ['ka-GE'] },
    }),
    'fr'
  );
  assert.equal(
    resolveLocale({
      navigator: { languages: ['nb-NO', 'en-US'], language: 'en-US' },
    }),
    'no'
  );
  assert.equal(resolveLocale({ explicit: 'xx-unknown', navigator: null, fallback: 'da' }), 'da');

  for (const rtl of RTL_LOCALES) {
    assert.equal(isRtlLocale(rtl), true, `${rtl} is RTL`);
  }
  assert.equal(isRtlLocale('ka'), false);
  assert.equal(isRtlLocale('en'), false);
});

test('formatAlertCount applies plural forms across languages', () => {
  assert.equal(formatAlertCount('en', 1), '1 alert');
  assert.equal(formatAlertCount('en', 2), '2 alerts');
  assert.equal(formatAlertCount('ru', 1), '1 уведомление');
  assert.equal(formatAlertCount('ru', 2), '2 уведомления');
  assert.equal(formatAlertCount('ru', 5), '5 уведомлений');
  assert.equal(formatAlertCount('ru', 11), '11 уведомлений');
  assert.equal(formatAlertCount('ru', 21), '21 уведомление');
  assert.equal(formatAlertCount('ru', 22), '22 уведомления');
  assert.ok(formatAlertCount('ka', 3).includes('3'));
  assert.ok(formatAlertCount('et', 2).includes('2'));
});

test('translate, DNS localization and Chrome handoff labels produce localized non-English copy', () => {
  assert.notEqual(translate('ka', 'offlineTitle'), translate('en', 'offlineTitle'));
  assert.notEqual(
    localizeDnsClassification('ka', 'normal_connectivity'),
    localizeDnsClassification('en', 'normal_connectivity')
  );
  const kaDns = localizeDnsMessage('ka', 'normal_connectivity', 'fallback', true);
  assert.notEqual(kaDns.message, 'fallback');
  assert.ok(kaDns.caveat.length > 0);
  assert.notEqual(kaDns.caveat, localizeDnsMessage('en', 'normal_connectivity', 'fallback', true).caveat);

  const deLabels = chromeHandoffLabels('de');
  const enLabels = chromeHandoffLabels('en');
  assert.notEqual(deLabels.openLabel, enLabels.openLabel);
  assert.notEqual(deLabels.title, enLabels.title);
});

test('YouGeAssistant localizes state, notices and Chrome handoff dynamically and emits youge:locale-change', () => {
  const events = [];
  const winListeners = new Map();
  const fakeWindow = {
    location: { hostname: 'example.com', href: 'https://example.com/' },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      events.push(event);
      winListeners.get(event.type)?.forEach((fn) => fn(event));
      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
  };

  const pwaSetLangCalls = [];
  const fakePwa = {
    setLanguage(lang) {
      pwaSetLangCalls.push(lang);
      return lang;
    },
  };

  const assistant = YouGeAssistant.create({
    projectId: 'i18n-test',
    locale: 'ka',
    window: fakeWindow,
    pwa: fakePwa,
    navigator: { languages: ['en-US'], language: 'en-US', onLine: true },
  });

  assert.equal(assistant.getLocale(), 'ka');
  assert.equal(assistant.getState().locale, 'ka');
  assistant.setConnectivity(false);
  const kaOffline = assistant.getState().notifications.find((n) => n.id === 'network:offline');
  assert.equal(kaOffline.title, translate('ka', 'offlineTitle'));

  assistant.setLocale('et');
  assert.equal(assistant.getLocale(), 'et');
  const etOffline = assistant.getState().notifications.find((n) => n.id === 'network:offline');
  assert.equal(etOffline.title, translate('et', 'offlineTitle'));
  assert.ok(events.some((e) => e.type === 'youge:locale-change' && e.detail.locale === 'et'));
  assert.ok(pwaSetLangCalls.includes('et'));

  // Test switching back to English
  assistant.setLocale('en');
  assert.equal(assistant.getLocale(), 'en');
  assert.equal(assistant.getState().notifications.find((n) => n.id === 'network:offline').title, 'No connection');

  // Test Chrome handoff localized instructions
  const handoff = createChromeHandoff({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    locale: 'ru',
  });
  const ruInstr = handoff.instructions('https://you.ge/path');
  assert.equal(ruInstr.title, chromeHandoffLabels('ru').title);

  assistant.destroy();
});

test('YouGeAssistant tracks browser languagechange in auto mode, respects domain defaults without localStorage locale persistence, and avoids duplicate locale events', () => {
  const events = [];
  const winListeners = new Map();
  const storageMap = new Map();
  const nav = { languages: ['en-US'], language: 'en-US', onLine: true };
  const fakeWindow = {
    location: { hostname: 'domain-default.example', href: 'https://domain-default.example/' },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      events.push(event);
      winListeners.get(event.type)?.forEach((fn) => fn(event));
      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
  };
  const fakeStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
  };

  let pwaLangCalls = 0;
  const fakePwa = {
    setLanguage(lang, opts) {
      pwaLangCalls += 1;
      assert.equal(opts?.fromAssistant, true);
      return lang;
    },
  };

  // 1. Auto mode picks up browser languagechange events cleanly
  const autoAssistant = YouGeAssistant.create({
    projectId: 'auto-detect-test',
    locale: 'auto',
    window: fakeWindow,
    navigator: nav,
    storage: fakeStorage,
    pwa: fakePwa,
  });
  assert.equal(autoAssistant.getLocale(), 'en');
  assert.equal(autoAssistant.getState().dir, 'ltr');

  nav.languages = ['ka-GE', 'en-US'];
  nav.language = 'ka-GE';
  fakeWindow.dispatchEvent({ type: 'languagechange' });
  assert.equal(autoAssistant.getLocale(), 'ka');
  assert.equal(autoAssistant.getState().dir, 'ltr');
  assert.equal(
    events.filter((e) => e.type === 'youge:locale-change' && e.detail.locale === 'ka').length,
    1
  );

  // Explicit override does NOT persist locale in localStorage and ignores later browser languagechange
  const storageKeysBefore = Array.from(storageMap.keys());
  autoAssistant.setLocale('ru');
  assert.equal(autoAssistant.getLocale(), 'ru');
  assert.equal(pwaLangCalls, 1);
  assert.deepEqual(Array.from(storageMap.keys()), storageKeysBefore, 'setLocale does not write locale state to localStorage');
  assert.ok(!Array.from(storageMap.values()).some((v) => String(v).includes('ru')), 'localStorage contains no persisted locale');
  nav.languages = ['fr-FR'];
  nav.language = 'fr-FR';
  fakeWindow.dispatchEvent({ type: 'languagechange' });
  assert.equal(autoAssistant.getLocale(), 'ru');

  // Calling setLocale with fromPwa: true does NOT re-call pwa.setLanguage
  autoAssistant.setLocale('de', { fromPwa: true });
  assert.equal(autoAssistant.getLocale(), 'de');
  assert.equal(pwaLangCalls, 1, 'fromPwa guard avoids bouncing back to pwa.setLanguage');
  autoAssistant.destroy();

  // 2. Domain default precedence when locale is auto, overridden by setLocale, restored on auto
  const domainAssistant = YouGeAssistant.create({
    projectId: 'domain-lang-test',
    locale: 'auto',
    domainRegistry: { 'domain-default.example': { language: 'ru' } },
    window: fakeWindow,
    navigator: { languages: ['en-US'], language: 'en-US', onLine: true },
    storage: fakeStorage,
  });
  assert.equal(domainAssistant.getLocale(), 'ru', 'domain language takes precedence over navigator in auto mode');
  domainAssistant.setLocale('ka');
  assert.equal(domainAssistant.getLocale(), 'ka');
  domainAssistant.setLocale('auto');
  assert.equal(domainAssistant.getLocale(), 'ru', 'returning to auto restores domain default');
  domainAssistant.destroy();
});
