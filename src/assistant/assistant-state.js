/*!
 * assistant-state.js — centralized You.Ge Assistant state model
 * -------------------------------------------------------------
 * Generated from packages/assistant-sdk/src/ via scripts/sync-sdk-browser.mjs.
 * Do not edit by hand; update packages/assistant-sdk/src/ and run:
 *   npm run sync:sdk
 *
 * Single source of truth for the floating assistant widget, React/ESM adapters
 * and project-level consumers. Keeps state calculation separate from DOM
 * rendering, never calls fetch(), never registers a service worker, and never
 * polls on an interval.
 */
(function (root) {
  'use strict';

  if (!root) return;
  if (root.YouGeAssistant && root.YouGeAssistant.__state &&
      (!root.YouGeAssistant.isDestroyed || !root.YouGeAssistant.isDestroyed())) {
    return;
  }

  /* --- core/constants.js --- */

  const SDK_VERSION = '0.4.0';
  const KIT_COMPAT_VERSION = '1.2.7';
  const SCHEMA_VERSION = 1;
  const PRIORITY = { critical: 1, auth: 2, backup: 3, install: 4, info: 5 };
  Object.freeze(PRIORITY);
  const TONE = { 1: 'critical', 2: 'auth', 3: 'backup', 4: 'install', 5: 'info' };
  Object.freeze(TONE);
  const POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
  Object.freeze(POSITIONS);

  // `auto` | `light` | `dark` are the original string modes; `custom` is part of
  // the adaptive theming release and is only meaningful with explicit tokens
  // (see `src/theme/index.js`). The list stays here so config validation and the
  // generated classic bundle share one definition.
  const THEMES = ['auto', 'light', 'dark', 'custom'];
  Object.freeze(THEMES);

  /** Legacy string modes that need no token payload. */
  const LEGACY_THEME_MODES = ['auto', 'light', 'dark'];
  Object.freeze(LEGACY_THEME_MODES);
  const ICONS = ['install', 'diagnostics', 'recovery', 'backup', 'help', 'info', 'update', 'custom'];
  Object.freeze(ICONS);
  const EVENT_NAMES = {
    state: 'youge:state',
    action: 'youge:action',
    localeChange: 'youge:locale-change',
    endpointStatus: 'youge:endpoint-status',
    sessionStatus: 'youge:session-status',
    dnsResult: 'youge:dns-result',
    yougePwaReady: 'youge:pwa:ready',
    yougePwaInstallable: 'youge:pwa:installable',
    yougePwaInstalled: 'youge:pwa:installed',
    yougePwaUpdate: 'youge:pwa:update',
    yougePwaDiagnostics: 'youge:pwa:diagnostics',
    yougePwaInstallDialog: 'youge:pwa:install-dialog',
    pwaReady: 'pwa:ready',
    pwaInstallable: 'pwa:installable',
    pwaInstalled: 'pwa:installed',
    pwaUpdate: 'pwa:update',
    pwaDiagnostics: 'pwa:diagnostics',
    pwaInstallDialog: 'pwa:install-dialog',
  };
  Object.freeze(EVENT_NAMES);
  const STORAGE_PREFIXES = {
    notices: 'youge-assistant:notices:',
    lastKnownGood: 'youge-assistant:lkg:',
  };
  Object.freeze(STORAGE_PREFIXES);

  /* --- core/i18n.js --- */

  const DEFAULT_LOCALE = 'en';
  const SUPPORTED_LOCALES = Object.freeze([
    'en',
    'ka',
    'ru',
    'fr',
    'it',
    'de',
    'sv',
    'nl',
    'no',
    'da',
    'et',
    'es',
  ]);
  const RTL_LOCALES = Object.freeze(['ar', 'he', 'fa', 'ur']);
  const LOCALE_METADATA = Object.freeze({
    en: Object.freeze({ code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' }),
    ka: Object.freeze({ code: 'ka', name: 'Georgian', nativeName: 'ქართული', dir: 'ltr' }),
    ru: Object.freeze({ code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' }),
    fr: Object.freeze({ code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' }),
    it: Object.freeze({ code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' }),
    de: Object.freeze({ code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' }),
    sv: Object.freeze({ code: 'sv', name: 'Swedish', nativeName: 'Svenska', dir: 'ltr' }),
    nl: Object.freeze({ code: 'nl', name: 'Dutch', nativeName: 'Nederlands', dir: 'ltr' }),
    no: Object.freeze({ code: 'no', name: 'Norwegian', nativeName: 'Norsk', dir: 'ltr' }),
    da: Object.freeze({ code: 'da', name: 'Danish', nativeName: 'Dansk', dir: 'ltr' }),
    et: Object.freeze({ code: 'et', name: 'Estonian', nativeName: 'Eesti', dir: 'ltr' }),
    es: Object.freeze({ code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' }),
  });

  const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALES);

  const INSTALL_LOCALE_CASE_MAP = Object.freeze({
    'zh-cn': 'zh-CN',
    'zh-hans': 'zh-CN',
    'zh-hk': 'zh-HK',
    'zh-tw': 'zh-TW',
    'zh-hant': 'zh-TW',
    'ca-es': 'ca-ES',
    ca: 'ca-ES',
  });

  /**
   * Normalize any BCP-47 language tag to a supported project locale code
   * (`en, ka, ru, fr, it, de, sv, nl, no, da, et, es`), or `''` if unsupported.
   * Preserves `ka` for Georgian (including `ka-GE`, `ka_GE`) and maps Norwegian
   * subtags (`nb`, `nn`) to `no`.
   */
  function normalizeLocaleTag(value) {
    if (typeof value !== 'string') return '';
    const cleaned = value.trim().replace(/_/g, '-');
    if (!cleaned || cleaned.toLowerCase() === 'auto') return '';
    if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(cleaned)) return '';
    let base = cleaned.toLowerCase().split('-')[0];
    if (base === 'nb' || base === 'nn') base = 'no';
    return SUPPORTED_LOCALE_SET.has(base) ? base : '';
  }

  /**
   * Normalize a locale tag for `<pwa-install>` (preserving `'auto'` and
   * regional tags such as `zh-CN`, `zh-HK`, `zh-TW`, `ca-ES`, plus `nb`/`nn` -> `no`).
   */
  function normalizeInstallLocaleTag(value, fallback) {
    if (typeof value !== 'string') return fallback || 'auto';
    const cleaned = value.trim().replace(/_/g, '-');
    if (!cleaned || cleaned.toLowerCase() === 'auto') return 'auto';
    if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(cleaned)) return fallback || 'auto';
    const lower = cleaned.toLowerCase();
    if (INSTALL_LOCALE_CASE_MAP[lower]) return INSTALL_LOCALE_CASE_MAP[lower];
    const parts = lower.split('-');
    if (parts[0] === 'zh') {
      if (parts.indexOf('tw') !== -1 || parts.indexOf('hant') !== -1) return 'zh-TW';
      if (parts.indexOf('hk') !== -1) return 'zh-HK';
      if (parts.indexOf('cn') !== -1 || parts.indexOf('hans') !== -1) return 'zh-CN';
    }
    if (parts[0] === 'nb' || parts[0] === 'nn' || parts[0] === 'no') return 'no';
    if (parts[0] === 'ka' && parts.length > 1) return 'ka';
    if (parts.length === 1) return parts[0];
    return parts[0] + '-' + (parts[1].length === 2 ? parts[1].toUpperCase() : parts[1]);
  }

  function readNavigatorLanguage(navigatorLike) {
    let nav = navigatorLike;
    if (nav === undefined && typeof globalThis !== 'undefined' && globalThis.navigator) {
      nav = globalThis.navigator;
    }
    if (!nav || typeof nav !== 'object') return '';
    if (Array.isArray(nav.languages) && nav.languages.length > 0) {
      for (let i = 0; i < nav.languages.length; i += 1) {
        const candidate = normalizeLocaleTag(nav.languages[i]);
        if (candidate) return candidate;
      }
    }
    if (typeof nav.language === 'string') return nav.language;
    if (typeof nav.userLanguage === 'string') return nav.userLanguage;
    return '';
  }

  /**
   * Unified priority order for locale resolution:
   *   1. explicit user / API selection (if non-'auto' & supported)
   *   2. domain default language (if non-'auto' & supported)
   *   3. browser / navigator language (if supported)
   *   4. fallback ('en' by default)
   */
  function resolveLocale(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const fallback = normalizeLocaleTag(opts.fallback) || DEFAULT_LOCALE;
    const domainCfg = opts.domainConfig && typeof opts.domainConfig === 'object' ? opts.domainConfig : null;
    const domainLangRaw = opts.domainLocale ||
      (domainCfg && (domainCfg.language || (domainCfg.identity && domainCfg.identity.language) ||
        (domainCfg.installExperience && domainCfg.installExperience.locale))) ||
      '';

    const candidates = [
      opts.explicit,
      opts.locale,
      domainLangRaw,
      opts.navigatorLanguage !== undefined ? opts.navigatorLanguage : readNavigatorLanguage(opts.navigator),
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const resolved = normalizeLocaleTag(candidates[i]);
      if (resolved) return resolved;
    }
    return fallback;
  }
  function isRtlLocale(locale) {
    const base = String(locale || '').trim().toLowerCase().split(/[-_]/)[0];
    return RTL_LOCALES.indexOf(base) !== -1;
  }
  const SDK_TRANSLATIONS = Object.freeze({
    en: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'assistant',
      noAlerts: 'No alerts',
      noAlertsLower: 'no alerts',
      noAlertsFabLabel: 'You.Ge Assistant, no alerts',
      highestPriority: 'highest priority',
      highestPrioritySentence: 'Highest priority',
      installActionLabel: 'Install this app',
      instructionsActionLabel: 'Installation instructions',
      installAvailableTitle: 'Installation available',
      nativeAvailableMessage: 'This browser offered a native install prompt.',
      iosAvailableMessage: 'Add this app to your home screen from Safari.',
      genericAvailableMessage: 'Use your browser menu to install this app.',
      iosShortcutHint: 'Safari: Share → Add to Home Screen.',
      genericHint: 'Open the browser install prompt or instructions.',
      offlineTitle: 'No connection',
      offlineMessage: 'The app cannot reach the network. Open diagnostics or recovery guidance.',
      dnsTitle: 'DNS resolution problem',
      dnsMessage: 'The current hostname could not be resolved. Diagnostics are available.',
      unreachableTitle: 'Connection problem',
      unreachableMessage: 'The application host or its backend did not respond.',
      primaryApiTitle: 'Primary API unavailable',
      primaryApiMessage: 'The primary application endpoint is not responding.',
      sessionTitle: 'Session needs attention',
      sessionMessage: 'Your project reported an authentication or session problem.',
      backupTitle: 'Backup connection active',
      backupMessage: 'This project is using its configured backup endpoint.',
      restoredTitle: 'Primary connection restored',
      restoredMessage: 'The primary endpoint is healthy again.',
      updateTitle: 'App update available',
      updateMessage: 'A new version is ready to apply.',
      featureDefaultMessage: 'A new You.Ge Assistant capability is available.',
      actionDiagnosticsLabel: 'Run network diagnostics',
      actionDiagnosticsMessage: 'Check connectivity, DNS and app origin.',
      actionRecoveryLabel: 'Recovery guidance',
      actionRecoveryMessage: 'Steps to restore this connection.',
      actionBackupLabel: 'Backup connection',
      actionBackupMessage: 'The project is using its backup endpoint.',
      actionUpdateLabel: 'Apply app update',
      actionUpdateMessage: 'Activate the waiting service worker update.',
      actionHelpLabel: 'Get help',
      actionBackupStatusLabel: 'Backup status',
      actionOpenLabel: 'Open',
      diagDisabledProject: 'Network diagnostics are disabled for this project.',
      diagDisabledDomain: 'Network diagnostics are disabled for this domain.',
      diagModuleNotLoaded: 'The DNS diagnostics module is not loaded.',
      diagCancelled: 'Diagnostics were cancelled.',
      diagCancelledBeforeStart: 'Diagnostics were cancelled before they started.',
      diagDestroyed: 'Assistant instance is destroyed.',
      diagUnavailable: 'Network diagnostics are not available on this page.',
      diagFailed: 'Diagnostics failed.',
      levelCritical: 'Critical',
      levelError: 'Error',
      levelWarning: 'Warning',
      levelInfo: 'Information',
      levelSuccess: 'Success',
      chromeTitle: 'Open this page in Chrome',
      chromeIntro: 'This in-app browser can hide features and break links. Continue in Chrome instead.',
      chromeStepCopy: 'Copy the page address shown below.',
      chromeStepSwitch: 'Leave this app and open Chrome on your device.',
      chromeStepPaste: 'Paste the address into Chrome’s address bar and open it.',
      chromeOpenLabel: 'Open in Chrome',
      chromeDismissLabel: 'Not now',
      chromeCopyLabel: 'Copy address',
      chromeCopiedLabel: 'Address copied.',
      chromeCopyManual: 'Select the address above to copy it manually.',
      widgetStatusTitle: 'Connection status',
      widgetStatusDesc: 'Live conditions reported by this project.',
      widgetNetworkLabel: 'Network',
      widgetOnline: 'Online',
      widgetOffline: 'Offline',
      widgetPrimaryApiLabel: 'Primary API',
      widgetBackupLabel: 'Backup',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'unknown',
      widgetInactive: 'inactive',
      widgetActive: 'active',
      widgetHealthy: 'healthy',
      widgetFailed: 'failed',
      widgetUnavailable: 'unavailable',
      widgetDegraded: 'degraded',
      widgetNotChecked: 'not checked',
      widgetAttentionTitle: 'What needs attention',
      widgetAttentionDesc: 'Ordered by priority. Critical recovery stays visible until resolved or acknowledged.',
      widgetAllClear: 'All clear — nothing needs your attention right now.',
      widgetInstallationTitle: 'Installation',
      widgetInstallIos: 'iPhone/iPad: open Share in Safari, then choose Add to Home Screen.',
      widgetInstallNative: 'This browser offers a native install prompt. Use the install action below.',
      widgetInstallGeneric: 'Desktop/mobile: open your browser menu and choose Install app, or Add to Home Screen.',
      widgetDiagnosticsTitle: 'Diagnostics & recovery',
      widgetDiagnosticsDesc: 'Checks run only when you choose; no background probing.',
      widgetRecoverySummary: 'Recovery guidance',
      widgetRecoveryStep1: 'Confirm device connectivity and retry diagnostics.',
      widgetRecoveryStep2: 'If a backup endpoint is configured, let the project switch to it.',
      widgetRecoveryStep3: 'If DNS results disagree, check DNS propagation before changing provider settings.',
      widgetRecoveryStep4: 'Contact the project support channel if the primary API stays unavailable.',
      widgetMoreActionsTitle: 'More actions',
      widgetMoreActionsDesc: 'Other actions available for this project.',
      widgetAdjustTitle: 'Adjust icon',
      widgetAdjustDesc: 'Size and position are saved on this device. Reset returns to the automatic defaults.',
      widgetAdjustSize: 'Icon size',
      widgetAdjustX: 'Horizontal position',
      widgetAdjustY: 'Vertical position',
      widgetAdjustReset: 'Reset to automatic defaults',
      widgetAcknowledge: 'Acknowledge',
      widgetDismiss: 'Dismiss',
      widgetClosePanel: 'Close assistant panel',
      widgetCheckingConnection: 'Checking connection',
      widgetNoticeSuffix: 'notice',
    }),

    ka: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'ასისტენტი',
      noAlerts: 'შეტყობინებები არ არის',
      noAlertsLower: 'შეტყობინებები არ არის',
      noAlertsFabLabel: 'You.Ge Assistant, შეტყობინებები არ არის',
      highestPriority: 'უმაღლესი პრიორიტეტი',
      highestPrioritySentence: 'უმაღლესი პრიორიტეტი',
      installActionLabel: 'აპის დაყენება',
      instructionsActionLabel: 'დაყენების ინსტრუქცია',
      installAvailableTitle: 'დაყენება ხელმისაწვდომია',
      nativeAvailableMessage: 'ბრაუზერი გთავაზობთ აპის პირდაპირ დაყენებას.',
      iosAvailableMessage: 'დაამატეთ ეს აპი მთავარ ეკრანზე Safari-დან.',
      genericAvailableMessage: 'აპის დასაყენებლად გამოიყენეთ ბრაუზერის მენიუ.',
      iosShortcutHint: 'Safari: გაზიარება → მთავარ ეკრანზე დამატება.',
      genericHint: 'გახსენით ბრაუზერის დაყენების ფანჯარა ან ინსტრუქცია.',
      offlineTitle: 'ინტერნეტი არ არის',
      offlineMessage: 'აპლიკაცია ქსელს ვერ უკავშირდება. გახსენით დიაგნოსტიკა ან აღდგენის ინსტრუქცია.',
      dnsTitle: 'DNS-ის გარჩევის ხარვეზი',
      dnsMessage: 'მიმდინარე დომენის მისამართის გარჩევა ვერ მოხერხდა. დიაგნოსტიკა ხელმისაწვდომია.',
      unreachableTitle: 'კავშირის პრობლემა',
      unreachableMessage: 'აპლიკაციის ჰოსტმა ან სერვერმა პასუხი არ დააბრუნა.',
      primaryApiTitle: 'ძირითადი API მიუწვდომელია',
      primaryApiMessage: 'ძირითადი სერვერი ამჟამად არ პასუხობს.',
      sessionTitle: 'სესია ყურადღებას საჭიროებს',
      sessionMessage: 'თქვენმა პროექტმა დააფიქსირა ავტორიზაციის ან სესიის შეცდომა.',
      backupTitle: 'სარეზერვო კავშირი აქტიურია',
      backupMessage: 'პროექტი იყენებს კონფიგურირებულ სარეზერვო სერვერს.',
      restoredTitle: 'ძირითადი კავშირი აღდგენილია',
      restoredMessage: 'ძირითადი სერვერი კვლავ გამართულად მუშაობს.',
      updateTitle: 'ხელმისაწვდომია განახლება',
      updateMessage: 'აპის ახალი ვერსია მზად არის გასააქტიურებლად.',
      featureDefaultMessage: 'ხელმისაწვდომია You.Ge Assistant-ის ახალი შესაძლებლობა.',
      actionDiagnosticsLabel: 'ქსელის დიაგნოსტიკის გაშვება',
      actionDiagnosticsMessage: 'შეამოწმეთ კავშირი, DNS და აპლიკაციის სერვერი.',
      actionRecoveryLabel: 'აღდგენის ინსტრუქცია',
      actionRecoveryMessage: 'ნაბიჯები კავშირის აღსადგენად.',
      actionBackupLabel: 'სარეზერვო კავშირი',
      actionBackupMessage: 'პროექტი იყენებს სარეზერვო სერვერს.',
      actionUpdateLabel: 'განახლების გამოყენება',
      actionUpdateMessage: 'გაააქტიურეთ მომზადებული სერვის-უორკერის განახლება.',
      actionHelpLabel: 'დახმარება',
      actionBackupStatusLabel: 'სარეზერვო არხის სტატუსი',
      actionOpenLabel: 'გახსნა',
      diagDisabledProject: 'ამ პროექტისთვის ქსელის დიაგნოსტიკა გამორთულია.',
      diagDisabledDomain: 'ამ დომენისთვის ქსელის დიაგნოსტიკა გამორთულია.',
      diagModuleNotLoaded: 'DNS დიაგნოსტიკის მოდული ჩატვირთული არ არის.',
      diagCancelled: 'დიაგნოსტიკა გაუქმდა.',
      diagCancelledBeforeStart: 'დიაგნოსტიკა დაწყებამდე გაუქმდა.',
      diagDestroyed: 'ასისტენტის ეგზემპლარი გაუქმებულია.',
      diagUnavailable: 'ქსელის დიაგნოსტიკა ამ გვერდზე ხელმისაწვდომი არ არის.',
      diagFailed: 'დიაგნოსტიკა ვერ შესრულდა.',
      levelCritical: 'კრიტიკული',
      levelError: 'შეცდომა',
      levelWarning: 'გაფრთხილება',
      levelInfo: 'ინფორმაცია',
      levelSuccess: 'წარმატება',
      chromeTitle: 'გახსენით ეს გვერდი Chrome-ში',
      chromeIntro: 'ეს აპშიდა ბრაუზერი შეიძლება ფარავდეს ფუნქციებს და აზიანებდეს ბმულებს. გააგრძელეთ Chrome-ში.',
      chromeStepCopy: 'დააკოპირეთ ქვემოთ ნაჩვენები გვერდის მისამართი.',
      chromeStepSwitch: 'დატოვეთ ეს აპი და გახსენით Chrome თქვენს მოწყობილობაზე.',
      chromeStepPaste: 'ჩასვით მისამართი Chrome-ის მისამართების ველში და გახსენით.',
      chromeOpenLabel: 'Chrome-ში გახსნა',
      chromeDismissLabel: 'არა ახლა',
      chromeCopyLabel: 'მისამართის კოპირება',
      chromeCopiedLabel: 'მისამართი დაკოპირდა.',
      chromeCopyManual: 'ხელით დასაკოპირებლად მონიშნეთ ზემოთ მოცემული მისამართი.',
      widgetStatusTitle: 'კავშირის სტატუსი',
      widgetStatusDesc: 'ამ პროექტის მიერ გადმოცემული მიმდინარე მდგომარეობა.',
      widgetNetworkLabel: 'ქსელი',
      widgetOnline: 'ონლაინ',
      widgetOffline: 'ოფლაინ',
      widgetPrimaryApiLabel: 'ძირითადი API',
      widgetBackupLabel: 'სარეზერვო',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'უცნობი',
      widgetInactive: 'არააქტიური',
      widgetActive: 'აქტიური',
      widgetHealthy: 'გამართული',
      widgetFailed: 'ხარვეზი',
      widgetUnavailable: 'მიუწვდომელი',
      widgetDegraded: 'შეფერხებული',
      widgetNotChecked: 'არ შემოწმებულა',
      widgetAttentionTitle: 'რას სჭირდება ყურადღება',
      widgetAttentionDesc: 'დალაგებულია პრიორიტეტის მიხედვით. კრიტიკული გაფრთხილება ჩანს მოგვარებამდე ან დადასტურებამდე.',
      widgetAllClear: 'ყველაფერი წესრიგშია — ამჟამად ყურადღება არაფერს სჭირდება.',
      widgetInstallationTitle: 'დაყენება',
      widgetInstallIos: 'iPhone/iPad: გახსენით „გაზიარება“ Safari-ში და აირჩიეთ „მთავარ ეკრანზე დამატება“.',
      widgetInstallNative: 'ბრაუზერი გთავაზობთ დაყენების სტანდარტულ ფანჯარას. გამოიყენეთ ქვემოთ მოცემული ღილაკი.',
      widgetInstallGeneric: 'კომპიუტერი/მობილური: გახსენით ბრაუზერის მენიუ და აირჩიეთ „აპის დაყენება“ ან „მთავარ ეკრანზე დამატება“.',
      widgetDiagnosticsTitle: 'დიაგნოსტიკა და აღდგენა',
      widgetDiagnosticsDesc: 'შემოწმება ეშვება მხოლოდ თქვენი მოთხოვნით; ფონური სკანირება არ ხდება.',
      widgetRecoverySummary: 'აღდგენის ინსტრუქცია',
      widgetRecoveryStep1: 'დაადასტურეთ მოწყობილობის ინტერნეტ-კავშირი და თავიდან გაუშვით დიაგნოსტიკა.',
      widgetRecoveryStep2: 'თუ სარეზერვო სერვერი კონფიგურირებულია, მიეცით პროექტს მასზე გადართვის საშუალება.',
      widgetRecoveryStep3: 'თუ DNS შედეგები განსხვავდება, პროვაიდერის პარამეტრების შეცვლამდე შეამოწმეთ DNS განახლება.',
      widgetRecoveryStep4: 'თუ ძირითადი API კვლავ მიუწვდომელია, დაუკავშირდით პროექტის მხარდაჭერას.',
      widgetMoreActionsTitle: 'დამატებითი მოქმედებები',
      widgetMoreActionsDesc: 'ამ პროექტისთვის ხელმისაწვდომი სხვა მოქმედებები.',
      widgetAdjustTitle: 'ხატულას მორგება',
      widgetAdjustDesc: 'ზომა და პოზიცია ინახება ამ მოწყობილობაზე. ჩამოყრა აბრუნებს ავტომატურ სტანდარტულ მნიშვნელობებს.',
      widgetAdjustSize: 'ხატულას ზომა',
      widgetAdjustX: 'ჰორიზონტალური პოზიცია',
      widgetAdjustY: 'ვერტიკალური პოზიცია',
      widgetAdjustReset: 'ავტომატურ პარამეტრებზე დაბრუნება',
      widgetAcknowledge: 'დადასტურება',
      widgetDismiss: 'დახურვა',
      widgetClosePanel: 'ასისტენტის პანელის დახურვა',
      widgetCheckingConnection: 'კავშირის შემოწმება',
      widgetNoticeSuffix: 'შეტყობინება',
    }),

    ru: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'ассистент',
      noAlerts: 'Нет уведомлений',
      noAlertsLower: 'нет уведомлений',
      noAlertsFabLabel: 'You.Ge Assistant, нет уведомлений',
      highestPriority: 'наивысший приоритет',
      highestPrioritySentence: 'Наивысший приоритет',
      installActionLabel: 'Установить приложение',
      instructionsActionLabel: 'Инструкция по установке',
      installAvailableTitle: 'Доступна установка',
      nativeAvailableMessage: 'Этот браузер предлагает встроенный диалог установки.',
      iosAvailableMessage: 'Добавьте это приложение на экран «Домой» через Safari.',
      genericAvailableMessage: 'Используйте меню браузера, чтобы установить это приложение.',
      iosShortcutHint: 'Safari: Поделиться → На экран «Домой».',
      genericHint: 'Откройте диалог установки браузера или инструкцию.',
      offlineTitle: 'Нет подключения',
      offlineMessage: 'Приложению не удаётся подключиться к сети. Откройте диагностику или руководство по восстановлению.',
      dnsTitle: 'Проблема разрешения DNS',
      dnsMessage: 'Не удалось определить текущий домен. Доступна сетевая диагностика.',
      unreachableTitle: 'Проблема с подключением',
      unreachableMessage: 'Сервер приложения или его бэкенд не отвечает.',
      primaryApiTitle: 'Основной API недоступен',
      primaryApiMessage: 'Основной сервер приложения не отвечает.',
      sessionTitle: 'Требуется внимание к сеансу',
      sessionMessage: 'Проект сообщил о проблеме с авторизацией или сеансом.',
      backupTitle: 'Активно резервное подключение',
      backupMessage: 'Проект использует настроенный резервный сервер.',
      restoredTitle: 'Основное подключение восстановлено',
      restoredMessage: 'Основной сервер снова работает стабильно.',
      updateTitle: 'Доступно обновление приложения',
      updateMessage: 'Новая версия готова к установке.',
      featureDefaultMessage: 'Доступна новая возможность You.Ge Assistant.',
      actionDiagnosticsLabel: 'Запустить диагностику сети',
      actionDiagnosticsMessage: 'Проверить подключение, DNS и доступность приложения.',
      actionRecoveryLabel: 'Руководство по восстановлению',
      actionRecoveryMessage: 'Шаги для восстановления подключения.',
      actionBackupLabel: 'Резервное подключение',
      actionBackupMessage: 'Проект использует резервный сервер.',
      actionUpdateLabel: 'Применить обновление',
      actionUpdateMessage: 'Активировать подготовленное обновление сервис-воркера.',
      actionHelpLabel: 'Получить помощь',
      actionBackupStatusLabel: 'Статус резервного канала',
      actionOpenLabel: 'Открыть',
      diagDisabledProject: 'Сетевая диагностика отключена для этого проекта.',
      diagDisabledDomain: 'Сетевая диагностика отключена для этого домена.',
      diagModuleNotLoaded: 'Модуль диагностики DNS не загружен.',
      diagCancelled: 'Диагностика была отменена.',
      diagCancelledBeforeStart: 'Диагностика была отменена до начала.',
      diagDestroyed: 'Экземпляр ассистента остановлен.',
      diagUnavailable: 'Сетевая диагностика недоступна на этой странице.',
      diagFailed: 'Сбой диагностики.',
      levelCritical: 'Критично',
      levelError: 'Ошибка',
      levelWarning: 'Предупреждение',
      levelInfo: 'Информация',
      levelSuccess: 'Готово',
      chromeTitle: 'Открыть страницу в Chrome',
      chromeIntro: 'Этот встроенный браузер может скрывать функции и нарушать работу ссылок. Продолжите в Chrome.',
      chromeStepCopy: 'Скопируйте адрес страницы, указанный ниже.',
      chromeStepSwitch: 'Закройте это окно и откройте Chrome на устройстве.',
      chromeStepPaste: 'Вставьте адрес в адресную строку Chrome и перейдите на страницу.',
      chromeOpenLabel: 'Открыть в Chrome',
      chromeDismissLabel: 'Не сейчас',
      chromeCopyLabel: 'Копировать адрес',
      chromeCopiedLabel: 'Адрес скопирован.',
      chromeCopyManual: 'Выделите адрес выше, чтобы скопировать его вручную.',
      widgetStatusTitle: 'Состояние подключения',
      widgetStatusDesc: 'Актуальные показатели, переданные этим проектом.',
      widgetNetworkLabel: 'Сеть',
      widgetOnline: 'В сети',
      widgetOffline: 'Не в сети',
      widgetPrimaryApiLabel: 'Основной API',
      widgetBackupLabel: 'Резерв',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'неизвестно',
      widgetInactive: 'неактивен',
      widgetActive: 'активен',
      widgetHealthy: 'исправен',
      widgetFailed: 'сбой',
      widgetUnavailable: 'недоступен',
      widgetDegraded: 'нестабилен',
      widgetNotChecked: 'не проверялся',
      widgetAttentionTitle: 'На что обратить внимание',
      widgetAttentionDesc: 'Упорядочено по приоритету. Критические уведомления остаются видимыми до устранения или подтверждения.',
      widgetAllClear: 'Всё в порядке — сейчас ничего не требует вашего внимания.',
      widgetInstallationTitle: 'Установка',
      widgetInstallIos: 'iPhone/iPad: откройте «Поделиться» в Safari и выберите «На экран „Домой“».',
      widgetInstallNative: 'Этот браузер поддерживает встроенную установку. Нажмите кнопку ниже.',
      widgetInstallGeneric: 'Компьютер или мобильное устройство: откройте меню браузера и выберите «Установить приложение» или «На экран „Домой“».',
      widgetDiagnosticsTitle: 'Диагностика и восстановление',
      widgetDiagnosticsDesc: 'Проверки запускаются только по вашему выбору — никакого фонового сканирования.',
      widgetRecoverySummary: 'Руководство по восстановлению',
      widgetRecoveryStep1: 'Убедитесь, что устройство подключено к интернету, и повторите диагностику.',
      widgetRecoveryStep2: 'Если настроен резервный сервер, дайте проекту переключиться на него.',
      widgetRecoveryStep3: 'Если ответы DNS расходятся, проверьте распространение DNS-записей перед изменением настроек провайдера.',
      widgetRecoveryStep4: 'Если основной API по-прежнему недоступен, обратитесь в службу поддержки проекта.',
      widgetMoreActionsTitle: 'Другие действия',
      widgetMoreActionsDesc: 'Дополнительные действия, доступные для этого проекта.',
      widgetAdjustTitle: 'Настроить значок',
      widgetAdjustDesc: 'Размер и положение сохраняются на этом устройстве. Сброс возвращает автоматические параметры по умолчанию.',
      widgetAdjustSize: 'Размер значка',
      widgetAdjustX: 'Горизонтальный отступ',
      widgetAdjustY: 'Вертикальный отступ',
      widgetAdjustReset: 'Сбросить настройки по умолчанию',
      widgetAcknowledge: 'Подтвердить',
      widgetDismiss: 'Скрыть',
      widgetClosePanel: 'Закрыть панель ассистента',
      widgetCheckingConnection: 'Проверка подключения',
      widgetNoticeSuffix: 'уведомление',
    }),

    fr: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'assistant',
      noAlerts: 'Aucune alerte',
      noAlertsLower: 'aucune alerte',
      noAlertsFabLabel: 'You.Ge Assistant, aucune alerte',
      highestPriority: 'priorité maximale',
      highestPrioritySentence: 'Priorité maximale',
      installActionLabel: 'Installer cette application',
      instructionsActionLabel: 'Instructions d’installation',
      installAvailableTitle: 'Installation disponible',
      nativeAvailableMessage: 'Ce navigateur propose une invite d’installation native.',
      iosAvailableMessage: 'Ajoutez cette application à votre écran d’accueil depuis Safari.',
      genericAvailableMessage: 'Utilisez le menu du navigateur pour installer cette application.',
      iosShortcutHint: 'Safari : Partager → Sur l’écran d’accueil.',
      genericHint: 'Ouvrez l’invite d’installation du navigateur ou les instructions.',
      offlineTitle: 'Aucune connexion',
      offlineMessage: 'L’application ne parvient pas à joindre le réseau. Ouvrez le diagnostic ou les conseils de rétablissement.',
      dnsTitle: 'Problème de résolution DNS',
      dnsMessage: 'Le nom d’hôte actuel n’a pas pu être résolu. Un diagnostic est disponible.',
      unreachableTitle: 'Problème de connexion',
      unreachableMessage: 'L’hôte de l’application ou son serveur n’a pas répondu.',
      primaryApiTitle: 'API principale indisponible',
      primaryApiMessage: 'Le point d’accès principal de l’application ne répond pas.',
      sessionTitle: 'La session requiert votre attention',
      sessionMessage: 'Votre projet a signalé un problème d’authentification ou de session.',
      backupTitle: 'Connexion de secours active',
      backupMessage: 'Ce projet utilise son point d’accès de secours configuré.',
      restoredTitle: 'Connexion principale rétablie',
      restoredMessage: 'Le point d’accès principal fonctionne à nouveau normalement.',
      updateTitle: 'Mise à jour disponible',
      updateMessage: 'Une nouvelle version est prête à être appliquée.',
      featureDefaultMessage: 'Une nouvelle fonctionnalité You.Ge Assistant est disponible.',
      actionDiagnosticsLabel: 'Lancer le diagnostic réseau',
      actionDiagnosticsMessage: 'Vérifier la connectivité, le DNS et l’origine de l’application.',
      actionRecoveryLabel: 'Conseils de rétablissement',
      actionRecoveryMessage: 'Étapes pour rétablir cette connexion.',
      actionBackupLabel: 'Connexion de secours',
      actionBackupMessage: 'Le projet utilise son point d’accès de secours.',
      actionUpdateLabel: 'Appliquer la mise à jour',
      actionUpdateMessage: 'Activer la mise à jour en attente du service worker.',
      actionHelpLabel: 'Obtenir de l’aide',
      actionBackupStatusLabel: 'État du secours',
      actionOpenLabel: 'Ouvrir',
      diagDisabledProject: 'Le diagnostic réseau est désactivé pour ce projet.',
      diagDisabledDomain: 'Le diagnostic réseau est désactivé pour ce domaine.',
      diagModuleNotLoaded: 'Le module de diagnostic DNS n’est pas chargé.',
      diagCancelled: 'Le diagnostic a été annulé.',
      diagCancelledBeforeStart: 'Le diagnostic a été annulé avant de démarrer.',
      diagDestroyed: 'L’instance de l’assistant a été détruite.',
      diagUnavailable: 'Le diagnostic réseau n’est pas disponible sur cette page.',
      diagFailed: 'Échec du diagnostic.',
      levelCritical: 'Critique',
      levelError: 'Erreur',
      levelWarning: 'Avertissement',
      levelInfo: 'Information',
      levelSuccess: 'Succès',
      chromeTitle: 'Ouvrir cette page dans Chrome',
      chromeIntro: 'Ce navigateur intégré peut masquer des fonctions et bloquer certains liens. Continuez plutôt dans Chrome.',
      chromeStepCopy: 'Copiez l’adresse de la page affichée ci-dessous.',
      chromeStepSwitch: 'Quittez cette application et ouvrez Chrome sur votre appareil.',
      chromeStepPaste: 'Collez l’adresse dans la barre d’adresse de Chrome et ouvrez-la.',
      chromeOpenLabel: 'Ouvrir dans Chrome',
      chromeDismissLabel: 'Plus tard',
      chromeCopyLabel: 'Copier l’adresse',
      chromeCopiedLabel: 'Adresse copiée.',
      chromeCopyManual: 'Sélectionnez l’adresse ci-dessus pour la copier manuellement.',
      widgetStatusTitle: 'État de la connexion',
      widgetStatusDesc: 'Conditions en direct signalées par ce projet.',
      widgetNetworkLabel: 'Réseau',
      widgetOnline: 'En ligne',
      widgetOffline: 'Hors ligne',
      widgetPrimaryApiLabel: 'API principale',
      widgetBackupLabel: 'Secours',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'inconnu',
      widgetInactive: 'inactif',
      widgetActive: 'actif',
      widgetHealthy: 'opérationnel',
      widgetFailed: 'en échec',
      widgetUnavailable: 'indisponible',
      widgetDegraded: 'dégradé',
      widgetNotChecked: 'non vérifié',
      widgetAttentionTitle: 'Ce qui requiert votre attention',
      widgetAttentionDesc: 'Trié par priorité. Les alertes critiques restent visibles jusqu’à résolution ou confirmation.',
      widgetAllClear: 'Tout est bon — rien ne demande votre attention pour le moment.',
      widgetInstallationTitle: 'Installation',
      widgetInstallIos: 'iPhone/iPad : ouvrez Partager dans Safari, puis choisissez Sur l’écran d’accueil.',
      widgetInstallNative: 'Ce navigateur propose une invite d’installation native. Utilisez l’action ci-dessous.',
      widgetInstallGeneric: 'Ordinateur/mobile : ouvrez le menu du navigateur et choisissez Installer l’application ou Ajouter à l’écran d’accueil.',
      widgetDiagnosticsTitle: 'Diagnostic et rétablissement',
      widgetDiagnosticsDesc: 'Les vérifications ne s’exécutent qu’à votre demande, sans analyse en arrière-plan.',
      widgetRecoverySummary: 'Conseils de rétablissement',
      widgetRecoveryStep1: 'Vérifiez la connectivité de l’appareil et relancez le diagnostic.',
      widgetRecoveryStep2: 'Si un point d’accès de secours est configuré, laissez le projet basculer dessus.',
      widgetRecoveryStep3: 'Si les résultats DNS divergent, vérifiez la propagation DNS avant de modifier les réglages fournisseur.',
      widgetRecoveryStep4: 'Contactez le support du projet si l’API principale reste indisponible.',
      widgetMoreActionsTitle: 'Autres actions',
      widgetMoreActionsDesc: 'Autres actions disponibles pour ce projet.',
      widgetAdjustTitle: 'Ajuster l’icône',
      widgetAdjustDesc: 'La taille et la position sont enregistrées sur cet appareil. Réinitialiser rétablit les valeurs automatiques.',
      widgetAdjustSize: 'Taille de l’icône',
      widgetAdjustX: 'Position horizontale',
      widgetAdjustY: 'Position verticale',
      widgetAdjustReset: 'Rétablir les valeurs automatiques',
      widgetAcknowledge: 'Confirmer',
      widgetDismiss: 'Ignorer',
      widgetClosePanel: 'Fermer le panneau de l’assistant',
      widgetCheckingConnection: 'Vérification de la connexion',
      widgetNoticeSuffix: 'notification',
    }),

    it: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'assistente',
      noAlerts: 'Nessun avviso',
      noAlertsLower: 'nessun avviso',
      noAlertsFabLabel: 'You.Ge Assistant, nessun avviso',
      highestPriority: 'priorità massima',
      highestPrioritySentence: 'Priorità massima',
      installActionLabel: 'Installa questa app',
      instructionsActionLabel: 'Istruzioni di installazione',
      installAvailableTitle: 'Installazione disponibile',
      nativeAvailableMessage: 'Questo browser offre un prompt di installazione nativo.',
      iosAvailableMessage: 'Aggiungi questa app alla schermata Home da Safari.',
      genericAvailableMessage: 'Usa il menu del browser per installare questa app.',
      iosShortcutHint: 'Safari: Condividi → Aggiungi alla schermata Home.',
      genericHint: 'Apri il prompt di installazione del browser o le istruzioni.',
      offlineTitle: 'Nessuna connessione',
      offlineMessage: 'L’app non riesce a raggiungere la rete. Apri la diagnostica o la guida al ripristino.',
      dnsTitle: 'Problema di risoluzione DNS',
      dnsMessage: 'Impossibile risolvere il nome host corrente. La diagnostica è disponibile.',
      unreachableTitle: 'Problema di connessione',
      unreachableMessage: 'L’host dell’applicazione o il relativo server non ha risposto.',
      primaryApiTitle: 'API principale non disponibile',
      primaryApiMessage: 'L’endpoint principale dell’applicazione non risponde.',
      sessionTitle: 'La sessione richiede attenzione',
      sessionMessage: 'Il progetto ha segnalato un problema di autenticazione o di sessione.',
      backupTitle: 'Connessione di backup attiva',
      backupMessage: 'Questo progetto sta usando l’endpoint di backup configurato.',
      restoredTitle: 'Connessione principale ripristinata',
      restoredMessage: 'L’endpoint principale è di nuovo operativo.',
      updateTitle: 'Aggiornamento app disponibile',
      updateMessage: 'Una nuova versione è pronta per essere applicata.',
      featureDefaultMessage: 'È disponibile una nuova funzionalità di You.Ge Assistant.',
      actionDiagnosticsLabel: 'Esegui diagnostica di rete',
      actionDiagnosticsMessage: 'Controlla connettività, DNS e origine dell’app.',
      actionRecoveryLabel: 'Guida al ripristino',
      actionRecoveryMessage: 'Passaggi per ripristinare questa connessione.',
      actionBackupLabel: 'Connessione di backup',
      actionBackupMessage: 'Il progetto sta usando l’endpoint di backup.',
      actionUpdateLabel: 'Applica aggiornamento app',
      actionUpdateMessage: 'Attiva l’aggiornamento in attesa del service worker.',
      actionHelpLabel: 'Ottieni assistenza',
      actionBackupStatusLabel: 'Stato backup',
      actionOpenLabel: 'Apri',
      diagDisabledProject: 'La diagnostica di rete è disabilitata per questo progetto.',
      diagDisabledDomain: 'La diagnostica di rete è disabilitata per questo dominio.',
      diagModuleNotLoaded: 'Il modulo di diagnostica DNS non è caricato.',
      diagCancelled: 'La diagnostica è stata annullata.',
      diagCancelledBeforeStart: 'La diagnostica è stata annullata prima di iniziare.',
      diagDestroyed: 'L’istanza dell’assistente è stata eliminata.',
      diagUnavailable: 'La diagnostica di rete non è disponibile in questa pagina.',
      diagFailed: 'Diagnostica non riuscita.',
      levelCritical: 'Critico',
      levelError: 'Errore',
      levelWarning: 'Avviso',
      levelInfo: 'Informazione',
      levelSuccess: 'Completato',
      chromeTitle: 'Apri questa pagina in Chrome',
      chromeIntro: 'Questo browser integrato può nascondere funzioni e bloccare i link. Continua invece in Chrome.',
      chromeStepCopy: 'Copia l’indirizzo della pagina mostrato qui sotto.',
      chromeStepSwitch: 'Esci da questa app e apri Chrome sul dispositivo.',
      chromeStepPaste: 'Incolla l’indirizzo nella barra di Chrome e aprilo.',
      chromeOpenLabel: 'Apri in Chrome',
      chromeDismissLabel: 'Non ora',
      chromeCopyLabel: 'Copia indirizzo',
      chromeCopiedLabel: 'Indirizzo copiato.',
      chromeCopyManual: 'Seleziona l’indirizzo sopra per copiarlo manualmente.',
      widgetStatusTitle: 'Stato della connessione',
      widgetStatusDesc: 'Condizioni in tempo reale segnalate dal progetto.',
      widgetNetworkLabel: 'Rete',
      widgetOnline: 'Online',
      widgetOffline: 'Offline',
      widgetPrimaryApiLabel: 'API principale',
      widgetBackupLabel: 'Backup',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'sconosciuto',
      widgetInactive: 'inattivo',
      widgetActive: 'attivo',
      widgetHealthy: 'funzionante',
      widgetFailed: 'non riuscito',
      widgetUnavailable: 'non disponibile',
      widgetDegraded: 'degradato',
      widgetNotChecked: 'non verificato',
      widgetAttentionTitle: 'Cosa richiede attenzione',
      widgetAttentionDesc: 'Ordinato per priorità. Gli avvisi critici restano visibili finché non vengono risolti o confermati.',
      widgetAllClear: 'Tutto regolare — al momento non serve alcuna azione.',
      widgetInstallationTitle: 'Installazione',
      widgetInstallIos: 'iPhone/iPad: apri Condividi in Safari, poi scegli Aggiungi alla schermata Home.',
      widgetInstallNative: 'Questo browser offre un prompt di installazione nativo. Usa il pulsante qui sotto.',
      widgetInstallGeneric: 'Desktop/mobile: apri il menu del browser e scegli Installa app o Aggiungi alla schermata Home.',
      widgetDiagnosticsTitle: 'Diagnostica e ripristino',
      widgetDiagnosticsDesc: 'I controlli vengono eseguiti solo su tua richiesta; nessun controllo in background.',
      widgetRecoverySummary: 'Guida al ripristino',
      widgetRecoveryStep1: 'Verifica la connettività del dispositivo e ripeti la diagnostica.',
      widgetRecoveryStep2: 'Se è configurato un endpoint di backup, consenti al progetto di usarlo.',
      widgetRecoveryStep3: 'Se i risultati DNS sono discordanti, controlla la propagazione DNS prima di cambiare le impostazioni del provider.',
      widgetRecoveryStep4: 'Contatta il supporto del progetto se l’API principale resta non disponibile.',
      widgetMoreActionsTitle: 'Altre azioni',
      widgetMoreActionsDesc: 'Altre azioni disponibili per questo progetto.',
      widgetAdjustTitle: 'Regola icona',
      widgetAdjustDesc: 'Dimensioni e posizione vengono salvate su questo dispositivo. Il ripristino torna ai valori automatici.',
      widgetAdjustSize: 'Dimensione icona',
      widgetAdjustX: 'Posizione orizzontale',
      widgetAdjustY: 'Posizione verticale',
      widgetAdjustReset: 'Ripristina valori automatici',
      widgetAcknowledge: 'Conferma',
      widgetDismiss: 'Ignora',
      widgetClosePanel: 'Chiudi pannello assistente',
      widgetCheckingConnection: 'Verifica connessione',
      widgetNoticeSuffix: 'avviso',
    }),

    de: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'Assistent',
      noAlerts: 'Keine Hinweise',
      noAlertsLower: 'keine Hinweise',
      noAlertsFabLabel: 'You.Ge Assistant, keine Hinweise',
      highestPriority: 'höchste Priorität',
      highestPrioritySentence: 'Höchste Priorität',
      installActionLabel: 'Diese App installieren',
      instructionsActionLabel: 'Installationsanleitung',
      installAvailableTitle: 'Installation verfügbar',
      nativeAvailableMessage: 'Dieser Browser bietet einen nativen Installationsdialog an.',
      iosAvailableMessage: 'Fügen Sie diese App in Safari zu Ihrem Home-Bildschirm hinzu.',
      genericAvailableMessage: 'Verwenden Sie das Browser-Menü, um diese App zu installieren.',
      iosShortcutHint: 'Safari: Teilen → Zum Home-Bildschirm.',
      genericHint: 'Öffnen Sie den Installationsdialog des Browsers oder die Anleitung.',
      offlineTitle: 'Keine Verbindung',
      offlineMessage: 'Die App kann das Netzwerk nicht erreichen. Öffnen Sie die Diagnose oder Wiederherstellungshinweise.',
      dnsTitle: 'DNS-Auflösungsproblem',
      dnsMessage: 'Der aktuelle Hostname konnte nicht aufgelöst werden. Eine Diagnose ist verfügbar.',
      unreachableTitle: 'Verbindungsproblem',
      unreachableMessage: 'Der Anwendungshost oder sein Backend hat nicht geantwortet.',
      primaryApiTitle: 'Primäre API nicht verfügbar',
      primaryApiMessage: 'Der primäre Anwendungsendpunkt antwortet nicht.',
      sessionTitle: 'Sitzung erfordert Aufmerksamkeit',
      sessionMessage: 'Ihr Projekt hat ein Authentifizierungs- oder Sitzungsproblem gemeldet.',
      backupTitle: 'Backup-Verbindung aktiv',
      backupMessage: 'Dieses Projekt nutzt seinen konfigurierten Backup-Endpunkt.',
      restoredTitle: 'Primäre Verbindung wiederhergestellt',
      restoredMessage: 'Der primäre Endpunkt funktioniert wieder normal.',
      updateTitle: 'App-Update verfügbar',
      updateMessage: 'Eine neue Version steht zum Anwenden bereit.',
      featureDefaultMessage: 'Eine neue You.Ge-Assistant-Funktion ist verfügbar.',
      actionDiagnosticsLabel: 'Netzwerkdiagnose starten',
      actionDiagnosticsMessage: 'Konnektivität, DNS und App-Ursprung prüfen.',
      actionRecoveryLabel: 'Wiederherstellungshinweise',
      actionRecoveryMessage: 'Schritte zur Wiederherstellung dieser Verbindung.',
      actionBackupLabel: 'Backup-Verbindung',
      actionBackupMessage: 'Das Projekt nutzt seinen Backup-Endpunkt.',
      actionUpdateLabel: 'App-Update anwenden',
      actionUpdateMessage: 'Wartendes Service-Worker-Update aktivieren.',
      actionHelpLabel: 'Hilfe erhalten',
      actionBackupStatusLabel: 'Backup-Status',
      actionOpenLabel: 'Öffnen',
      diagDisabledProject: 'Die Netzwerkdiagnose ist für dieses Projekt deaktiviert.',
      diagDisabledDomain: 'Die Netzwerkdiagnose ist für diese Domain deaktiviert.',
      diagModuleNotLoaded: 'Das DNS-Diagnosemodul ist nicht geladen.',
      diagCancelled: 'Die Diagnose wurde abgebrochen.',
      diagCancelledBeforeStart: 'Die Diagnose wurde vor dem Start abgebrochen.',
      diagDestroyed: 'Die Assistenten-Instanz wurde beendet.',
      diagUnavailable: 'Die Netzwerkdiagnose ist auf dieser Seite nicht verfügbar.',
      diagFailed: 'Diagnose fehlgeschlagen.',
      levelCritical: 'Kritisch',
      levelError: 'Fehler',
      levelWarning: 'Warnung',
      levelInfo: 'Information',
      levelSuccess: 'Erfolg',
      chromeTitle: 'Diese Seite in Chrome öffnen',
      chromeIntro: 'Dieser In-App-Browser kann Funktionen verbergen und Links beschädigen. Wechseln Sie stattdessen zu Chrome.',
      chromeStepCopy: 'Kopieren Sie die unten angezeigte Seitenadresse.',
      chromeStepSwitch: 'Verlassen Sie diese App und öffnen Sie Chrome auf Ihrem Gerät.',
      chromeStepPaste: 'Fügen Sie die Adresse in die Adressleiste von Chrome ein und öffnen Sie sie.',
      chromeOpenLabel: 'In Chrome öffnen',
      chromeDismissLabel: 'Nicht jetzt',
      chromeCopyLabel: 'Adresse kopieren',
      chromeCopiedLabel: 'Adresse kopiert.',
      chromeCopyManual: 'Markieren Sie die obige Adresse, um sie manuell zu kopieren.',
      widgetStatusTitle: 'Verbindungsstatus',
      widgetStatusDesc: 'Aktuelle Zustände, die von diesem Projekt gemeldet werden.',
      widgetNetworkLabel: 'Netzwerk',
      widgetOnline: 'Online',
      widgetOffline: 'Offline',
      widgetPrimaryApiLabel: 'Primäre API',
      widgetBackupLabel: 'Backup',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'unbekannt',
      widgetInactive: 'inaktiv',
      widgetActive: 'aktiv',
      widgetHealthy: 'fehlerfrei',
      widgetFailed: 'fehlgeschlagen',
      widgetUnavailable: 'nicht verfügbar',
      widgetDegraded: 'beeinträchtigt',
      widgetNotChecked: 'nicht geprüft',
      widgetAttentionTitle: 'Was Aufmerksamkeit erfordert',
      widgetAttentionDesc: 'Nach Priorität geordnet. Kritische Hinweise bleiben sichtbar, bis sie behoben oder bestätigt sind.',
      widgetAllClear: 'Alles in Ordnung — im Moment erfordert nichts Ihre Aufmerksamkeit.',
      widgetInstallationTitle: 'Installation',
      widgetInstallIos: 'iPhone/iPad: Öffnen Sie „Teilen“ in Safari und wählen Sie „Zum Home-Bildschirm“.',
      widgetInstallNative: 'Dieser Browser bietet eine native Installation. Nutzen Sie die Schaltfläche unten.',
      widgetInstallGeneric: 'Desktop/Mobil: Öffnen Sie das Browser-Menü und wählen Sie „App installieren“ oder „Zum Startbildschirm hinzufügen“.',
      widgetDiagnosticsTitle: 'Diagnose & Wiederherstellung',
      widgetDiagnosticsDesc: 'Prüfungen laufen nur auf Ihren Wunsch; keine Hintergrundabfragen.',
      widgetRecoverySummary: 'Wiederherstellungshinweise',
      widgetRecoveryStep1: 'Prüfen Sie die Geräteverbindung und wiederholen Sie die Diagnose.',
      widgetRecoveryStep2: 'Wenn ein Backup-Endpunkt eingerichtet ist, lassen Sie das Projekt darauf umschalten.',
      widgetRecoveryStep3: 'Bei widersprüchlichen DNS-Ergebnissen prüfen Sie die DNS-Propagation vor Änderungen an Provider-Einstellungen.',
      widgetRecoveryStep4: 'Wenden Sie sich an den Projekt-Support, falls die primäre API weiter nicht erreichbar bleibt.',
      widgetMoreActionsTitle: 'Weitere Aktionen',
      widgetMoreActionsDesc: 'Weitere für dieses Projekt verfügbare Aktionen.',
      widgetAdjustTitle: 'Symbol anpassen',
      widgetAdjustDesc: 'Größe und Position werden auf diesem Gerät gespeichert. Zurücksetzen stellt die automatischen Vorgaben wieder her.',
      widgetAdjustSize: 'Symbolgröße',
      widgetAdjustX: 'Horizontale Position',
      widgetAdjustY: 'Vertikale Position',
      widgetAdjustReset: 'Automatische Vorgaben wiederherstellen',
      widgetAcknowledge: 'Bestätigen',
      widgetDismiss: 'Ausblenden',
      widgetClosePanel: 'Assistentenbereich schließen',
      widgetCheckingConnection: 'Verbindung wird geprüft',
      widgetNoticeSuffix: 'Hinweis',
    }),

    sv: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'assistent',
      noAlerts: 'Inga aviseringar',
      noAlertsLower: 'inga aviseringar',
      noAlertsFabLabel: 'You.Ge Assistant, inga aviseringar',
      highestPriority: 'högsta prioritet',
      highestPrioritySentence: 'Högsta prioritet',
      installActionLabel: 'Installera den här appen',
      instructionsActionLabel: 'Installationsanvisningar',
      installAvailableTitle: 'Installation tillgänglig',
      nativeAvailableMessage: 'Den här webbläsaren erbjuder en inbyggd installationsdialog.',
      iosAvailableMessage: 'Lägg till appen på hemskärmen från Safari.',
      genericAvailableMessage: 'Använd webbläsarens meny för att installera den här appen.',
      iosShortcutHint: 'Safari: Dela → Lägg till på hemskärmen.',
      genericHint: 'Öppna webbläsarens installationsdialog eller anvisningar.',
      offlineTitle: 'Ingen anslutning',
      offlineMessage: 'Appen kan inte nå nätverket. Öppna diagnostik eller återställningsguide.',
      dnsTitle: 'Problem med DNS-uppslag',
      dnsMessage: 'Det nuvarande värdnamnet kunde inte slås upp. Diagnostik är tillgänglig.',
      unreachableTitle: 'Anslutningsproblem',
      unreachableMessage: 'Appvärden eller dess backend svarade inte.',
      primaryApiTitle: 'Primärt API otillgängligt',
      primaryApiMessage: 'Appens primära slutpunkt svarar inte.',
      sessionTitle: 'Sessionen behöver uppmärksamhet',
      sessionMessage: 'Projektet rapporterade ett autentiserings- eller sessionsproblem.',
      backupTitle: 'Reservanslutning aktiv',
      backupMessage: 'Projektet använder sin konfigurerade reservslutpunkt.',
      restoredTitle: 'Primär anslutning återställd',
      restoredMessage: 'Den primära slutpunkten fungerar normalt igen.',
      updateTitle: 'Appuppdatering tillgänglig',
      updateMessage: 'En ny version är redo att aktiveras.',
      featureDefaultMessage: 'En ny funktion i You.Ge Assistant är tillgänglig.',
      actionDiagnosticsLabel: 'Kör nätverksdiagnostik',
      actionDiagnosticsMessage: 'Kontrollera anslutning, DNS och appens ursprung.',
      actionRecoveryLabel: 'Återställningsguide',
      actionRecoveryMessage: 'Steg för att återställa den här anslutningen.',
      actionBackupLabel: 'Reservanslutning',
      actionBackupMessage: 'Projektet använder sin reservslutpunkt.',
      actionUpdateLabel: 'Uppdatera appen',
      actionUpdateMessage: 'Aktivera den väntande uppdateringen av service workern.',
      actionHelpLabel: 'Få hjälp',
      actionBackupStatusLabel: 'Reservstatus',
      actionOpenLabel: 'Öppna',
      diagDisabledProject: 'Nätverksdiagnostik är inaktiverad för det här projektet.',
      diagDisabledDomain: 'Nätverksdiagnostik är inaktiverad för den här domänen.',
      diagModuleNotLoaded: 'DNS-diagnostikmodulen är inte laddad.',
      diagCancelled: 'Diagnostiken avbröts.',
      diagCancelledBeforeStart: 'Diagnostiken avbröts innan den startade.',
      diagDestroyed: 'Assistentinstansen har förstörts.',
      diagUnavailable: 'Nätverksdiagnostik är inte tillgänglig på den här sidan.',
      diagFailed: 'Diagnostiken misslyckades.',
      levelCritical: 'Kritisk',
      levelError: 'Fel',
      levelWarning: 'Varning',
      levelInfo: 'Information',
      levelSuccess: 'Klart',
      chromeTitle: 'Öppna den här sidan i Chrome',
      chromeIntro: 'Den här inbyggda webbläsaren kan dölja funktioner och bryta länkar. Fortsätt i Chrome i stället.',
      chromeStepCopy: 'Kopiera sidans adress nedan.',
      chromeStepSwitch: 'Lämna den här appen och öppna Chrome på enheten.',
      chromeStepPaste: 'Klistra in adressen i Chromes adressfält och öppna den.',
      chromeOpenLabel: 'Öppna i Chrome',
      chromeDismissLabel: 'Inte nu',
      chromeCopyLabel: 'Kopiera adress',
      chromeCopiedLabel: 'Adress kopierad.',
      chromeCopyManual: 'Markera adressen ovan för att kopiera den manuellt.',
      widgetStatusTitle: 'Anslutningsstatus',
      widgetStatusDesc: 'Aktuella förhållanden rapporterade av det här projektet.',
      widgetNetworkLabel: 'Nätverk',
      widgetOnline: 'Online',
      widgetOffline: 'Offline',
      widgetPrimaryApiLabel: 'Primärt API',
      widgetBackupLabel: 'Reserv',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'okänd',
      widgetInactive: 'inaktiv',
      widgetActive: 'aktiv',
      widgetHealthy: 'fungerar',
      widgetFailed: 'misslyckades',
      widgetUnavailable: 'otillgänglig',
      widgetDegraded: 'försämrad',
      widgetNotChecked: 'inte kontrollerad',
      widgetAttentionTitle: 'Det här kräver uppmärksamhet',
      widgetAttentionDesc: 'Sorterat efter prioritet. Kritiska varningar visas tills de åtgärdats eller bekräftats.',
      widgetAllClear: 'Allt klart — inget kräver din uppmärksamhet just nu.',
      widgetInstallationTitle: 'Installation',
      widgetInstallIos: 'iPhone/iPad: öppna Dela i Safari och välj Lägg till på hemskärmen.',
      widgetInstallNative: 'Den här webbläsaren erbjuder inbyggd installation. Använd knappen nedan.',
      widgetInstallGeneric: 'Dator/mobil: öppna webbläsarens meny och välj Installera app eller Lägg till på startskärmen.',
      widgetDiagnosticsTitle: 'Diagnostik och återställning',
      widgetDiagnosticsDesc: 'Kontroller körs bara när du väljer det; ingen bakgrundsskanning.',
      widgetRecoverySummary: 'Återställningsguide',
      widgetRecoveryStep1: 'Bekräfta enhetens anslutning och kör diagnostiken igen.',
      widgetRecoveryStep2: 'Om en reservslutpunkt är konfigurerad, låt projektet växla till den.',
      widgetRecoveryStep3: 'Om DNS-resultaten skiljer sig åt, kontrollera DNS-spridningen innan du ändrar leverantörsinställningar.',
      widgetRecoveryStep4: 'Kontakta projektets support om det primära API:t förblir otillgängligt.',
      widgetMoreActionsTitle: 'Fler åtgärder',
      widgetMoreActionsDesc: 'Andra åtgärder tillgängliga för det här projektet.',
      widgetAdjustTitle: 'Justera ikon',
      widgetAdjustDesc: 'Storlek och position sparas på den här enheten. Återställning återgår till automatiska standardvärden.',
      widgetAdjustSize: 'Ikonstorlek',
      widgetAdjustX: 'Horisontell position',
      widgetAdjustY: 'Vertikal position',
      widgetAdjustReset: 'Återställ till automatiska standardvärden',
      widgetAcknowledge: 'Bekräfta',
      widgetDismiss: 'Stäng',
      widgetClosePanel: 'Stäng assistentpanelen',
      widgetCheckingConnection: 'Kontrollerar anslutning',
      widgetNoticeSuffix: 'avisering',
    }),

    nl: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'assistent',
      noAlerts: 'Geen meldingen',
      noAlertsLower: 'geen meldingen',
      noAlertsFabLabel: 'You.Ge Assistant, geen meldingen',
      highestPriority: 'hoogste prioriteit',
      highestPrioritySentence: 'Hoogste prioriteit',
      installActionLabel: 'Deze app installeren',
      instructionsActionLabel: 'Installatie-instructies',
      installAvailableTitle: 'Installatie beschikbaar',
      nativeAvailableMessage: 'Deze browser biedt een eigen installatievenster aan.',
      iosAvailableMessage: 'Voeg deze app via Safari toe aan je beginscherm.',
      genericAvailableMessage: 'Gebruik het browsermenu om deze app te installeren.',
      iosShortcutHint: 'Safari: Deel → Zet op beginscherm.',
      genericHint: 'Open de installatiemelding van de browser of bekijk de instructies.',
      offlineTitle: 'Geen verbinding',
      offlineMessage: 'De app kan het netwerk niet bereiken. Open diagnostiek of herstelinstructies.',
      dnsTitle: 'DNS-vertaalprobleem',
      dnsMessage: 'De huidige hostnaam kon niet worden opgelost. Diagnostiek is beschikbaar.',
      unreachableTitle: 'Verbindingsprobleem',
      unreachableMessage: 'De applicatiehost of de backend heeft niet gereageerd.',
      primaryApiTitle: 'Primaire API niet beschikbaar',
      primaryApiMessage: 'Het primaire eindpunt van de applicatie reageert niet.',
      sessionTitle: 'Sessie vereist aandacht',
      sessionMessage: 'Dit project heeft een authenticatie- of sessieprobleem gemeld.',
      backupTitle: 'Back-upverbinding actief',
      backupMessage: 'Dit project gebruikt het geconfigureerde back-upeindpunt.',
      restoredTitle: 'Primaire verbinding hersteld',
      restoredMessage: 'Het primaire eindpunt werkt weer normaal.',
      updateTitle: 'App-update beschikbaar',
      updateMessage: 'Er staat een nieuwe versie klaar om toe te passen.',
      featureDefaultMessage: 'Er is een nieuwe functie van You.Ge Assistant beschikbaar.',
      actionDiagnosticsLabel: 'Netwerkdiagnostiek uitvoeren',
      actionDiagnosticsMessage: 'Controleer connectiviteit, DNS en app-herkomst.',
      actionRecoveryLabel: 'Herstelinstructies',
      actionRecoveryMessage: 'Stappen om deze verbinding te herstellen.',
      actionBackupLabel: 'Back-upverbinding',
      actionBackupMessage: 'Het project gebruikt het back-upeindpunt.',
      actionUpdateLabel: 'App-update toepassen',
      actionUpdateMessage: 'Activeer de wachtende update van de service worker.',
      actionHelpLabel: 'Hulp krijgen',
      actionBackupStatusLabel: 'Back-upstatus',
      actionOpenLabel: 'Openen',
      diagDisabledProject: 'Netwerkdiagnostiek is uitgeschakeld voor dit project.',
      diagDisabledDomain: 'Netwerkdiagnostiek is uitgeschakeld voor dit domein.',
      diagModuleNotLoaded: 'De module voor DNS-diagnostiek is niet geladen.',
      diagCancelled: 'Diagnostiek is geannuleerd.',
      diagCancelledBeforeStart: 'Diagnostiek is geannuleerd voordat deze kon starten.',
      diagDestroyed: 'De assistent-instantie is afgesloten.',
      diagUnavailable: 'Netwerkdiagnostiek is op deze pagina niet beschikbaar.',
      diagFailed: 'Diagnostiek mislukt.',
      levelCritical: 'Kritiek',
      levelError: 'Fout',
      levelWarning: 'Waarschuwing',
      levelInfo: 'Informatie',
      levelSuccess: 'Geslaagd',
      chromeTitle: 'Open deze pagina in Chrome',
      chromeIntro: 'Deze ingebouwde browser kan functies verbergen en links verstoren. Ga liever verder in Chrome.',
      chromeStepCopy: 'Kopieer het pagina-adres hieronder.',
      chromeStepSwitch: 'Sluit deze app en open Chrome op je apparaat.',
      chromeStepPaste: 'Plak het adres in de adresbalk van Chrome en open de pagina.',
      chromeOpenLabel: 'Openen in Chrome',
      chromeDismissLabel: 'Niet nu',
      chromeCopyLabel: 'Adres kopiëren',
      chromeCopiedLabel: 'Adres gekopieerd.',
      chromeCopyManual: 'Selecteer het adres hierboven om het handmatig te kopiëren.',
      widgetStatusTitle: 'Verbindingsstatus',
      widgetStatusDesc: 'Actuele omstandigheden die door dit project zijn gemeld.',
      widgetNetworkLabel: 'Netwerk',
      widgetOnline: 'Online',
      widgetOffline: 'Offline',
      widgetPrimaryApiLabel: 'Primaire API',
      widgetBackupLabel: 'Back-up',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'onbekend',
      widgetInactive: 'inactief',
      widgetActive: 'actief',
      widgetHealthy: 'gezond',
      widgetFailed: 'mislukt',
      widgetUnavailable: 'niet beschikbaar',
      widgetDegraded: 'verslechterd',
      widgetNotChecked: 'niet gecontroleerd',
      widgetAttentionTitle: 'Wat aandacht vraagt',
      widgetAttentionDesc: 'Gesorteerd op prioriteit. Kritieke meldingen blijven zichtbaar tot ze zijn opgelost of bevestigd.',
      widgetAllClear: 'Alles in orde — er vraagt op dit moment niets om aandacht.',
      widgetInstallationTitle: 'Installatie',
      widgetInstallIos: 'iPhone/iPad: open Deel in Safari en kies Zet op beginscherm.',
      widgetInstallNative: 'Deze browser biedt een directe installatiemelding. Gebruik de knop hieronder.',
      widgetInstallGeneric: 'Desktop/mobiel: open het browsermenu en kies App installeren of Toevoegen aan startscherm.',
      widgetDiagnosticsTitle: 'Diagnostiek & herstel',
      widgetDiagnosticsDesc: 'Controles worden alleen uitgevoerd wanneer jij dat kiest; er wordt niet op de achtergrond getest.',
      widgetRecoverySummary: 'Herstelinstructies',
      widgetRecoveryStep1: 'Controleer de apparaatverbinding en voer de diagnostiek opnieuw uit.',
      widgetRecoveryStep2: 'Als er een back-upeindpunt is ingesteld, laat het project daarnaar overschakelen.',
      widgetRecoveryStep3: 'Als DNS-resultaten verschillen, controleer dan de DNS-propagatie voordat je providerinstellingen wijzigt.',
      widgetRecoveryStep4: 'Neem contact op met de projectondersteuning als de primaire API onbereikbaar blijft.',
      widgetMoreActionsTitle: 'Meer acties',
      widgetMoreActionsDesc: 'Andere acties die beschikbaar zijn voor dit project.',
      widgetAdjustTitle: 'Pictogram aanpassen',
      widgetAdjustDesc: 'Grootte en positie worden op dit apparaat opgeslagen. Resetten herstelt de automatische standaardwaarden.',
      widgetAdjustSize: 'Pictogramgrootte',
      widgetAdjustX: 'Horizontale positie',
      widgetAdjustY: 'Verticale positie',
      widgetAdjustReset: 'Automatische standaardwaarden herstellen',
      widgetAcknowledge: 'Bevestigen',
      widgetDismiss: 'Negeren',
      widgetClosePanel: 'Assistentenpaneel sluiten',
      widgetCheckingConnection: 'Verbinding controleren',
      widgetNoticeSuffix: 'melding',
    }),

    no: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'assistent',
      noAlerts: 'Ingen varsler',
      noAlertsLower: 'ingen varsler',
      noAlertsFabLabel: 'You.Ge Assistant, ingen varsler',
      highestPriority: 'høyeste prioritet',
      highestPrioritySentence: 'Høyeste prioritet',
      installActionLabel: 'Installer denne appen',
      instructionsActionLabel: 'Installasjonsveiledning',
      installAvailableTitle: 'Installasjon tilgjengelig',
      nativeAvailableMessage: 'Denne nettleseren tilbyr en innebygd installasjonsforespørsel.',
      iosAvailableMessage: 'Legg denne appen til på hjemskjermen fra Safari.',
      genericAvailableMessage: 'Bruk nettlesermenyen for å installere denne appen.',
      iosShortcutHint: 'Safari: Del → Legg til på Hjem-skjerm.',
      genericHint: 'Åpne nettleserens installasjonsforespørsel eller veiledning.',
      offlineTitle: 'Ingen tilkobling',
      offlineMessage: 'Appen når ikke nettverket. Åpne diagnostikk eller gjenopprettingsveiledning.',
      dnsTitle: 'DNS-oppslagsproblem',
      dnsMessage: 'Det nåværende vertsnavnet kunne ikke slås opp. Diagnostikk er tilgjengelig.',
      unreachableTitle: 'Tilkoblingsproblem',
      unreachableMessage: 'Appens vert eller backend svarte ikke.',
      primaryApiTitle: 'Primær-API utilgjengelig',
      primaryApiMessage: 'Appens primære endepunkt svarer ikke.',
      sessionTitle: 'Økten trenger oppmerksomhet',
      sessionMessage: 'Prosjektet meldte om et autentiserings- eller øktproblem.',
      backupTitle: 'Reservetilkobling aktiv',
      backupMessage: 'Dette prosjektet bruker sitt konfigurerte reserveendepunkt.',
      restoredTitle: 'Primærtilkobling gjenopprettet',
      restoredMessage: 'Det primære endepunktet er friskt igjen.',
      updateTitle: 'Appoppdatering tilgjengelig',
      updateMessage: 'En ny versjon er klar til å tas i bruk.',
      featureDefaultMessage: 'En ny funksjon i You.Ge Assistant er tilgjengelig.',
      actionDiagnosticsLabel: 'Kjør nettverksdiagnostikk',
      actionDiagnosticsMessage: 'Kontroller tilkobling, DNS og appens opprinnelse.',
      actionRecoveryLabel: 'Gjenopprettingsveiledning',
      actionRecoveryMessage: 'Trinn for å gjenopprette denne tilkoblingen.',
      actionBackupLabel: 'Reservetilkobling',
      actionBackupMessage: 'Prosjektet bruker reserveendepunktet.',
      actionUpdateLabel: 'Oppdater appen',
      actionUpdateMessage: 'Aktiver den ventende oppdateringen for service workeren.',
      actionHelpLabel: 'Få hjelp',
      actionBackupStatusLabel: 'Reservestatus',
      actionOpenLabel: 'Åpne',
      diagDisabledProject: 'Nettverksdiagnostikk er deaktivert for dette prosjektet.',
      diagDisabledDomain: 'Nettverksdiagnostikk er deaktivert for dette domenet.',
      diagModuleNotLoaded: 'DNS-diagnostikkmodulen er ikke lastet.',
      diagCancelled: 'Diagnostikken ble avbrutt.',
      diagCancelledBeforeStart: 'Diagnostikken ble avbrutt før den startet.',
      diagDestroyed: 'Assistentinstansen er avsluttet.',
      diagUnavailable: 'Nettverksdiagnostikk er ikke tilgjengelig på denne siden.',
      diagFailed: 'Diagnostikken mislyktes.',
      levelCritical: 'Kritisk',
      levelError: 'Feil',
      levelWarning: 'Advarsel',
      levelInfo: 'Informasjon',
      levelSuccess: 'Fullført',
      chromeTitle: 'Åpne denne siden i Chrome',
      chromeIntro: 'Denne nettleseren inne i appen kan skjule funksjoner og ødelegge lenker. Fortsett i Chrome i stedet.',
      chromeStepCopy: 'Kopier sideadressen vist nedenfor.',
      chromeStepSwitch: 'Forlat denne appen og åpne Chrome på enheten din.',
      chromeStepPaste: 'Lim inn adressen i Chromes adressefelt og åpne den.',
      chromeOpenLabel: 'Åpne i Chrome',
      chromeDismissLabel: 'Ikke nå',
      chromeCopyLabel: 'Kopier adresse',
      chromeCopiedLabel: 'Adresse kopiert.',
      chromeCopyManual: 'Merk adressen ovenfor for å kopiere den manuelt.',
      widgetStatusTitle: 'Tilkoblingsstatus',
      widgetStatusDesc: 'Gjeldende forhold rapportert av dette prosjektet.',
      widgetNetworkLabel: 'Nettverk',
      widgetOnline: 'Tilkoblet',
      widgetOffline: 'Frakoblet',
      widgetPrimaryApiLabel: 'Primær-API',
      widgetBackupLabel: 'Reserve',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'ukjent',
      widgetInactive: 'inaktiv',
      widgetActive: 'aktiv',
      widgetHealthy: 'i orden',
      widgetFailed: 'mislyktes',
      widgetUnavailable: 'utilgjengelig',
      widgetDegraded: 'redusert',
      widgetNotChecked: 'ikke sjekket',
      widgetAttentionTitle: 'Dette krever oppmerksomhet',
      widgetAttentionDesc: 'Ordnet etter prioritet. Kritiske varsler forblir synlige til de er løst eller bekreftet.',
      widgetAllClear: 'Alt i orden — ingenting krever oppmerksomhet akkurat nå.',
      widgetInstallationTitle: 'Installasjon',
      widgetInstallIos: 'iPhone/iPad: åpne Del i Safari, og velg Legg til på Hjem-skjerm.',
      widgetInstallNative: 'Denne nettleseren tilbyr innebygd installasjon. Bruk knappen nedenfor.',
      widgetInstallGeneric: 'Datamaskin/mobil: åpne nettlesermenyen og velg Installer app eller Legg til på startskjermen.',
      widgetDiagnosticsTitle: 'Diagnostikk og gjenoppretting',
      widgetDiagnosticsDesc: 'Kontroller kjøres bare når du velger det; ingen bakgrunnsskanning.',
      widgetRecoverySummary: 'Gjenopprettingsveiledning',
      widgetRecoveryStep1: 'Bekreft enhetens tilkobling og prøv diagnostikken på nytt.',
      widgetRecoveryStep2: 'Hvis et reserveendepunkt er konfigurert, la prosjektet bytte til det.',
      widgetRecoveryStep3: 'Hvis DNS-resultatene avviker, kontroller DNS-utbredelse før du endrer leverandørinnstillinger.',
      widgetRecoveryStep4: 'Kontakt prosjektets brukerstøtte hvis primær-API-et fortsatt er utilgjengelig.',
      widgetMoreActionsTitle: 'Flere handlinger',
      widgetMoreActionsDesc: 'Andre handlinger som er tilgjengelige for dette prosjektet.',
      widgetAdjustTitle: 'Juster ikon',
      widgetAdjustDesc: 'Størrelse og plassering lagres på denne enheten. Tilbakestilling går tilbake til automatiske standardverdier.',
      widgetAdjustSize: 'Ikonstørrelse',
      widgetAdjustX: 'Horisontal posisjon',
      widgetAdjustY: 'Vertikal posisjon',
      widgetAdjustReset: 'Tilbakestill til automatiske standarder',
      widgetAcknowledge: 'Bekreft',
      widgetDismiss: 'Lukk',
      widgetClosePanel: 'Lukk assistentpanelet',
      widgetCheckingConnection: 'Kontrollerer tilkobling',
      widgetNoticeSuffix: 'varsel',
    }),

    da: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'assistent',
      noAlerts: 'Ingen advarsler',
      noAlertsLower: 'ingen advarsler',
      noAlertsFabLabel: 'You.Ge Assistant, ingen advarsler',
      highestPriority: 'højeste prioritet',
      highestPrioritySentence: 'Højeste prioritet',
      installActionLabel: 'Installer denne app',
      instructionsActionLabel: 'Installationsvejledning',
      installAvailableTitle: 'Installation tilgængelig',
      nativeAvailableMessage: 'Denne browser tilbyder en indbygget installationsprompt.',
      iosAvailableMessage: 'Føj denne app til din hjemmeskærm fra Safari.',
      genericAvailableMessage: 'Brug browsermenuen til at installere denne app.',
      iosShortcutHint: 'Safari: Del → Føj til hjemmeskærm.',
      genericHint: 'Åbn browserens installationsprompt eller vejledning.',
      offlineTitle: 'Ingen forbindelse',
      offlineMessage: 'Appen kan ikke nå netværket. Åbn diagnosticering eller gendannelsesvejledning.',
      dnsTitle: 'Problem med DNS-opslag',
      dnsMessage: 'Det aktuelle værtsnavn kunne ikke slås op. Diagnosticering er tilgængelig.',
      unreachableTitle: 'Forbindelsesproblem',
      unreachableMessage: 'Appens vært eller backend svarede ikke.',
      primaryApiTitle: 'Primær API utilgængelig',
      primaryApiMessage: 'Appens primære slutpunkt svarer ikke.',
      sessionTitle: 'Session kræver opmærksomhed',
      sessionMessage: 'Dit projekt rapporterede et godkendelses- eller sessionsproblem.',
      backupTitle: 'Reserveforbindelse aktiv',
      backupMessage: 'Dette projekt bruger sit konfigurerede reserveslutpunkt.',
      restoredTitle: 'Primær forbindelse gendannet',
      restoredMessage: 'Det primære slutpunkt fungerer normalt igen.',
      updateTitle: 'Appopdatering tilgængelig',
      updateMessage: 'En ny version er klar til at blive taget i brug.',
      featureDefaultMessage: 'En ny funktion i You.Ge Assistant er tilgængelig.',
      actionDiagnosticsLabel: 'Kør netværksdiagnosticering',
      actionDiagnosticsMessage: 'Kontrollér forbindelse, DNS og appens oprindelse.',
      actionRecoveryLabel: 'Gendannelsesvejledning',
      actionRecoveryMessage: 'Trin til at gendanne denne forbindelse.',
      actionBackupLabel: 'Reserveforbindelse',
      actionBackupMessage: 'Projektet bruger sit reserveslutpunkt.',
      actionUpdateLabel: 'Opdater appen',
      actionUpdateMessage: 'Aktivér den ventende service worker-opdatering.',
      actionHelpLabel: 'Få hjælp',
      actionBackupStatusLabel: 'Reservestatus',
      actionOpenLabel: 'Åbn',
      diagDisabledProject: 'Netværksdiagnosticering er deaktiveret for dette projekt.',
      diagDisabledDomain: 'Netværksdiagnosticering er deaktiveret for dette domæne.',
      diagModuleNotLoaded: 'DNS-diagnosticeringsmodulet er ikke indlæst.',
      diagCancelled: 'Diagnosticeringen blev annulleret.',
      diagCancelledBeforeStart: 'Diagnosticeringen blev annulleret før start.',
      diagDestroyed: 'Assistentinstansen er afsluttet.',
      diagUnavailable: 'Netværksdiagnosticering er ikke tilgængelig på denne side.',
      diagFailed: 'Diagnosticering mislykkedes.',
      levelCritical: 'Kritisk',
      levelError: 'Fejl',
      levelWarning: 'Advarsel',
      levelInfo: 'Information',
      levelSuccess: 'Gennemført',
      chromeTitle: 'Åbn denne side i Chrome',
      chromeIntro: 'Denne indbyggede browser kan skjule funktioner og ødelægge links. Fortsæt i Chrome i stedet.',
      chromeStepCopy: 'Kopiér sideadressen vist nedenfor.',
      chromeStepSwitch: 'Forlad denne app og åbn Chrome på din enhed.',
      chromeStepPaste: 'Indsæt adressen i Chromes adresselinje og åbn den.',
      chromeOpenLabel: 'Åbn i Chrome',
      chromeDismissLabel: 'Ikke nu',
      chromeCopyLabel: 'Kopiér adresse',
      chromeCopiedLabel: 'Adresse kopieret.',
      chromeCopyManual: 'Markér adressen ovenfor for at kopiere den manuelt.',
      widgetStatusTitle: 'Forbindelsesstatus',
      widgetStatusDesc: 'Aktuelle forhold rapporteret af dette projekt.',
      widgetNetworkLabel: 'Netværk',
      widgetOnline: 'Online',
      widgetOffline: 'Offline',
      widgetPrimaryApiLabel: 'Primær API',
      widgetBackupLabel: 'Reserve',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'ukendt',
      widgetInactive: 'inaktiv',
      widgetActive: 'aktiv',
      widgetHealthy: 'velfungerende',
      widgetFailed: 'mislykkedes',
      widgetUnavailable: 'utilgængelig',
      widgetDegraded: 'forringet',
      widgetNotChecked: 'ikke tjekket',
      widgetAttentionTitle: 'Det kræver opmærksomhed',
      widgetAttentionDesc: 'Sorteret efter prioritet. Kritiske advarsler forbliver synlige, indtil de løses eller bekræftes.',
      widgetAllClear: 'Alt er fint — intet kræver din opmærksomhed lige nu.',
      widgetInstallationTitle: 'Installation',
      widgetInstallIos: 'iPhone/iPad: åbn Del i Safari, og vælg Føj til hjemmeskærm.',
      widgetInstallNative: 'Denne browser tilbyder en indbygget installationsprompt. Brug knappen nedenfor.',
      widgetInstallGeneric: 'Computer/mobil: åbn browsermenuen og vælg Installer app eller Føj til startskærm.',
      widgetDiagnosticsTitle: 'Diagnosticering & gendannelse',
      widgetDiagnosticsDesc: 'Kontrol kører kun, når du vælger det; ingen baggrundsscanning.',
      widgetRecoverySummary: 'Gendannelsesvejledning',
      widgetRecoveryStep1: 'Bekræft enhedens forbindelse og prøv diagnosticeringen igen.',
      widgetRecoveryStep2: 'Hvis et reserveslutpunkt er konfigureret, lad projektet skifte til det.',
      widgetRecoveryStep3: 'Hvis DNS-resultaterne er uenige, kontrollér DNS-udbredelse før ændring af udbyderindstillinger.',
      widgetRecoveryStep4: 'Kontakt projektets support, hvis den primære API fortsat er utilgængelig.',
      widgetMoreActionsTitle: 'Flere handlinger',
      widgetMoreActionsDesc: 'Andre handlinger tilgængelige for dette projekt.',
      widgetAdjustTitle: 'Tilpas ikon',
      widgetAdjustDesc: 'Størrelse og placering gemmes på denne enhed. Nulstilling vender tilbage til automatiske standarder.',
      widgetAdjustSize: 'Ikonstørrelse',
      widgetAdjustX: 'Vandret position',
      widgetAdjustY: 'Lodret position',
      widgetAdjustReset: 'Nulstil til automatiske standarder',
      widgetAcknowledge: 'Bekræft',
      widgetDismiss: 'Afvis',
      widgetClosePanel: 'Luk assistentpanel',
      widgetCheckingConnection: 'Kontrollerer forbindelse',
      widgetNoticeSuffix: 'advarsel',
    }),

    et: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'abiline',
      noAlerts: 'Teateid pole',
      noAlertsLower: 'teateid pole',
      noAlertsFabLabel: 'You.Ge Assistant, teateid pole',
      highestPriority: 'kõrgeim prioriteet',
      highestPrioritySentence: 'Kõrgeim prioriteet',
      installActionLabel: 'Paigalda see rakendus',
      instructionsActionLabel: 'Paigaldamisjuhised',
      installAvailableTitle: 'Paigaldamine saadaval',
      nativeAvailableMessage: 'See brauser pakub sisseehitatud paigaldusdialoogi.',
      iosAvailableMessage: 'Lisa see rakendus Safarist oma avakuvale.',
      genericAvailableMessage: 'Kasuta rakenduse paigaldamiseks brauseri menüüd.',
      iosShortcutHint: 'Safari: Jaga → Lisa avakuvale.',
      genericHint: 'Ava brauseri paigaldusaken või juhised.',
      offlineTitle: 'Ühendus puudub',
      offlineMessage: 'Rakendus ei saa võrguga ühendust. Ava diagnostika või taastamisjuhised.',
      dnsTitle: 'DNS-i lahendamise tõrge',
      dnsMessage: 'Praegust hostinime ei õnnestunud lahendada. Diagnostika on saadaval.',
      unreachableTitle: 'Ühenduse tõrge',
      unreachableMessage: 'Rakenduse host või selle taustateenus ei vastanud.',
      primaryApiTitle: 'Peamine API pole saadaval',
      primaryApiMessage: 'Rakenduse peamine lõpp-punkt ei vasta.',
      sessionTitle: 'Seanss vajab tähelepanu',
      sessionMessage: 'Projekt teatas autentimis- või seansiprobleemist.',
      backupTitle: 'Varuühendus aktiivne',
      backupMessage: 'Projekt kasutab oma seadistatud varulõpp-punkti.',
      restoredTitle: 'Peamine ühendus taastatud',
      restoredMessage: 'Peamine lõpp-punkt töötab taas korralikult.',
      updateTitle: 'Rakenduse uuendus saadaval',
      updateMessage: 'Uus versioon on rakendamiseks valmis.',
      featureDefaultMessage: 'Saadaval on uus You.Ge Assistant funktsioon.',
      actionDiagnosticsLabel: 'Käivita võrgudiagnostika',
      actionDiagnosticsMessage: 'Kontrolli ühendust, DNS-i ja rakenduse päritolu.',
      actionRecoveryLabel: 'Taastamisjuhised',
      actionRecoveryMessage: 'Sammud ühenduse taastamiseks.',
      actionBackupLabel: 'Varuühendus',
      actionBackupMessage: 'Projekt kasutab varulõpp-punkti.',
      actionUpdateLabel: 'Uuenda rakendust',
      actionUpdateMessage: 'Aktiveeri ootel olev service workeri uuendus.',
      actionHelpLabel: 'Küsi abi',
      actionBackupStatusLabel: 'Varuühenduse olek',
      actionOpenLabel: 'Ava',
      diagDisabledProject: 'Võrgudiagnostika on selle projekti jaoks keelatud.',
      diagDisabledDomain: 'Võrgudiagnostika on selle domeeni jaoks keelatud.',
      diagModuleNotLoaded: 'DNS-diagnostika moodul pole laaditud.',
      diagCancelled: 'Diagnostika tühistati.',
      diagCancelledBeforeStart: 'Diagnostika tühistati enne käivitamist.',
      diagDestroyed: 'Abilise eksemplar on hävitatud.',
      diagUnavailable: 'Võrgudiagnostika pole sellel lehel saadaval.',
      diagFailed: 'Diagnostika ebaõnnestus.',
      levelCritical: 'Kriitiline',
      levelError: 'Tõrge',
      levelWarning: 'Hoiatus',
      levelInfo: 'Teave',
      levelSuccess: 'Õnnestus',
      chromeTitle: 'Ava see leht Chrome’is',
      chromeIntro: 'See rakendusesisene brauser võib funktsioone peita ja linke rikkuda. Jätka parem Chrome’is.',
      chromeStepCopy: 'Kopeeri allpool kuvatav lehe aadress.',
      chromeStepSwitch: 'Lahku sellest rakendusest ja ava oma seadmes Chrome.',
      chromeStepPaste: 'Kleebi aadress Chrome’i aadressiribale ja ava leht.',
      chromeOpenLabel: 'Ava Chrome’is',
      chromeDismissLabel: 'Mitte praegu',
      chromeCopyLabel: 'Kopeeri aadress',
      chromeCopiedLabel: 'Aadress kopeeritud.',
      chromeCopyManual: 'Vali ülaltoodud aadress käsitsi kopeerimiseks.',
      widgetStatusTitle: 'Ühenduse olek',
      widgetStatusDesc: 'Selle projekti edastatud reaalajas tingimused.',
      widgetNetworkLabel: 'Võrk',
      widgetOnline: 'Võrgus',
      widgetOffline: 'Võrguta',
      widgetPrimaryApiLabel: 'Peamine API',
      widgetBackupLabel: 'Varuühendus',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'teadmata',
      widgetInactive: 'mitteaktiivne',
      widgetActive: 'aktiivne',
      widgetHealthy: 'korras',
      widgetFailed: 'tõrge',
      widgetUnavailable: 'pole saadaval',
      widgetDegraded: 'häiritud',
      widgetNotChecked: 'kontrollimata',
      widgetAttentionTitle: 'Mis vajab tähelepanu',
      widgetAttentionDesc: 'Järjestatud prioriteedi alusel. Kriitiline teave püsib nähtavana kuni lahendamise või kinnitamiseni.',
      widgetAllClear: 'Kõik on korras — praegu ei vaja miski tähelepanu.',
      widgetInstallationTitle: 'Paigaldamine',
      widgetInstallIos: 'iPhone/iPad: ava Safaris Jaga ja vali Lisa avakuvale.',
      widgetInstallNative: 'See brauser pakub sisseehitatud paigaldamist. Kasuta allolevat nuppu.',
      widgetInstallGeneric: 'Arvuti/mobiil: ava brauseri menüü ja vali Paigalda rakendus või Lisa avakuvale.',
      widgetDiagnosticsTitle: 'Diagnostika ja taastamine',
      widgetDiagnosticsDesc: 'Kontrollid käivituvad ainult sinu valikul; taustal ei kontrollita midagi.',
      widgetRecoverySummary: 'Taastamisjuhised',
      widgetRecoveryStep1: 'Veendu seadme ühenduses ja käivita diagnostika uuesti.',
      widgetRecoveryStep2: 'Kui varulõpp-punkt on seadistatud, lase projektil sellele lülituda.',
      widgetRecoveryStep3: 'Kui DNS-tulemused erinevad, kontrolli DNS-i levimist enne teenusepakkuja sätete muutmist.',
      widgetRecoveryStep4: 'Kui peamine API jääb kättesaamatuks, võta ühendust projekti toega.',
      widgetMoreActionsTitle: 'Veel toiminguid',
      widgetMoreActionsDesc: 'Muud selle projekti jaoks saadaolevad toimingud.',
      widgetAdjustTitle: 'Kohanda ikooni',
      widgetAdjustDesc: 'Suurus ja asukoht salvestatakse sellesse seadmesse. Lähtestamine taastab automaatsed vaikeväärtused.',
      widgetAdjustSize: 'Ikooni suurus',
      widgetAdjustX: 'Horisontaalne asukoht',
      widgetAdjustY: 'Vertikaalne asukoht',
      widgetAdjustReset: 'Taasta automaatsed vaikeväärtused',
      widgetAcknowledge: 'Kinnita',
      widgetDismiss: 'Sulge',
      widgetClosePanel: 'Sulge abilise paneel',
      widgetCheckingConnection: 'Ühenduse kontrollimine',
      widgetNoticeSuffix: 'teade',
    }),

    es: Object.freeze({
      assistantName: 'You.Ge Assistant',
      assistantSuffix: 'asistente',
      noAlerts: 'Sin avisos',
      noAlertsLower: 'sin avisos',
      noAlertsFabLabel: 'You.Ge Assistant, sin avisos',
      highestPriority: 'prioridad máxima',
      highestPrioritySentence: 'Prioridad máxima',
      installActionLabel: 'Instalar esta app',
      instructionsActionLabel: 'Instrucciones de instalación',
      installAvailableTitle: 'Instalación disponible',
      nativeAvailableMessage: 'Este navegador ofrece un aviso de instalación nativo.',
      iosAvailableMessage: 'Añade esta aplicación a tu pantalla de inicio desde Safari.',
      genericAvailableMessage: 'Usa el menú del navegador para instalar esta aplicación.',
      iosShortcutHint: 'Safari: Compartir → Añadir a pantalla de inicio.',
      genericHint: 'Abre el aviso de instalación del navegador o las instrucciones.',
      offlineTitle: 'Sin conexión',
      offlineMessage: 'La aplicación no puede acceder a la red. Abre el diagnóstico o la guía de recuperación.',
      dnsTitle: 'Problema de resolución DNS',
      dnsMessage: 'No se pudo resolver el nombre de host actual. El diagnóstico está disponible.',
      unreachableTitle: 'Problema de conexión',
      unreachableMessage: 'El host de la aplicación o su servidor no respondió.',
      primaryApiTitle: 'API principal no disponible',
      primaryApiMessage: 'El punto de acceso principal de la aplicación no responde.',
      sessionTitle: 'La sesión requiere atención',
      sessionMessage: 'Tu proyecto informó de un problema de autenticación o de sesión.',
      backupTitle: 'Conexión de respaldo activa',
      backupMessage: 'Este proyecto está usando su servidor de respaldo configurado.',
      restoredTitle: 'Conexión principal restablecida',
      restoredMessage: 'El servidor principal vuelve a estar operativo.',
      updateTitle: 'Actualización disponible',
      updateMessage: 'Hay una nueva versión lista para aplicar.',
      featureDefaultMessage: 'Hay una nueva función de You.Ge Assistant disponible.',
      actionDiagnosticsLabel: 'Ejecutar diagnóstico de red',
      actionDiagnosticsMessage: 'Comprueba la conectividad, el DNS y el origen de la app.',
      actionRecoveryLabel: 'Guía de recuperación',
      actionRecoveryMessage: 'Pasos para restablecer esta conexión.',
      actionBackupLabel: 'Conexión de respaldo',
      actionBackupMessage: 'El proyecto está usando su servidor de respaldo.',
      actionUpdateLabel: 'Aplicar actualización',
      actionUpdateMessage: 'Activa la actualización pendiente del service worker.',
      actionHelpLabel: 'Obtener ayuda',
      actionBackupStatusLabel: 'Estado de respaldo',
      actionOpenLabel: 'Abrir',
      diagDisabledProject: 'El diagnóstico de red está desactivado para este proyecto.',
      diagDisabledDomain: 'El diagnóstico de red está desactivado para este dominio.',
      diagModuleNotLoaded: 'El módulo de diagnóstico DNS no está cargado.',
      diagCancelled: 'Se canceló el diagnóstico.',
      diagCancelledBeforeStart: 'Se canceló el diagnóstico antes de iniciarse.',
      diagDestroyed: 'La instancia del asistente ha sido destruida.',
      diagUnavailable: 'El diagnóstico de red no está disponible en esta página.',
      diagFailed: 'Error en el diagnóstico.',
      levelCritical: 'Crítico',
      levelError: 'Error',
      levelWarning: 'Advertencia',
      levelInfo: 'Información',
      levelSuccess: 'Correcto',
      chromeTitle: 'Abrir esta página en Chrome',
      chromeIntro: 'Este navegador integrado puede ocultar funciones y romper enlaces. Continúa en Chrome en su lugar.',
      chromeStepCopy: 'Copia la dirección de la página que se muestra abajo.',
      chromeStepSwitch: 'Sal de esta aplicación y abre Chrome en tu dispositivo.',
      chromeStepPaste: 'Pega la dirección en la barra de Chrome y ábrela.',
      chromeOpenLabel: 'Abrir en Chrome',
      chromeDismissLabel: 'Ahora no',
      chromeCopyLabel: 'Copiar dirección',
      chromeCopiedLabel: 'Dirección copiada.',
      chromeCopyManual: 'Selecciona la dirección anterior para copiarla manualmente.',
      widgetStatusTitle: 'Estado de conexión',
      widgetStatusDesc: 'Condiciones en directo informadas por este proyecto.',
      widgetNetworkLabel: 'Red',
      widgetOnline: 'En línea',
      widgetOffline: 'Sin conexión',
      widgetPrimaryApiLabel: 'API principal',
      widgetBackupLabel: 'Respaldo',
      widgetDnsLabel: 'DNS',
      widgetUnknown: 'desconocido',
      widgetInactive: 'inactivo',
      widgetActive: 'activo',
      widgetHealthy: 'saludable',
      widgetFailed: 'con fallo',
      widgetUnavailable: 'no disponible',
      widgetDegraded: 'degradado',
      widgetNotChecked: 'sin comprobar',
      widgetAttentionTitle: 'Qué requiere atención',
      widgetAttentionDesc: 'Ordenado por prioridad. Los avisos críticos permanecen visibles hasta resolverse o confirmarse.',
      widgetAllClear: 'Todo en orden — nada requiere tu atención en este momento.',
      widgetInstallationTitle: 'Instalación',
      widgetInstallIos: 'iPhone/iPad: abre Compartir en Safari y elige Añadir a pantalla de inicio.',
      widgetInstallNative: 'Este navegador ofrece instalación nativa. Usa el botón de abajo.',
      widgetInstallGeneric: 'Escritorio/móvil: abre el menú del navegador y elige Instalar aplicación o Añadir a pantalla de inicio.',
      widgetDiagnosticsTitle: 'Diagnóstico y recuperación',
      widgetDiagnosticsDesc: 'Las comprobaciones solo se ejecutan cuando tú lo eliges; sin sondeo en segundo plano.',
      widgetRecoverySummary: 'Guía de recuperación',
      widgetRecoveryStep1: 'Confirma la conectividad del dispositivo y repite el diagnóstico.',
      widgetRecoveryStep2: 'Si hay un servidor de respaldo configurado, deja que el proyecto cambie a él.',
      widgetRecoveryStep3: 'Si los resultados DNS no coinciden, comprueba la propagación DNS antes de cambiar la configuración del proveedor.',
      widgetRecoveryStep4: 'Contacta con el soporte del proyecto si la API principal sigue sin estar disponible.',
      widgetMoreActionsTitle: 'Más acciones',
      widgetMoreActionsDesc: 'Otras acciones disponibles para este proyecto.',
      widgetAdjustTitle: 'Ajustar icono',
      widgetAdjustDesc: 'El tamaño y la posición se guardan en este dispositivo. Restablecer vuelve a los valores automáticos.',
      widgetAdjustSize: 'Tamaño del icono',
      widgetAdjustX: 'Posición horizontal',
      widgetAdjustY: 'Posición vertical',
      widgetAdjustReset: 'Restablecer valores automáticos',
      widgetAcknowledge: 'Confirmar',
      widgetDismiss: 'Ocultar',
      widgetClosePanel: 'Cerrar el panel del asistente',
      widgetCheckingConnection: 'Comprobando conexión',
      widgetNoticeSuffix: 'aviso',
    }),
  });
  function translate(locale, key, params) {
    const code = resolveLocale({ explicit: locale });
    const dict = SDK_TRANSLATIONS[code] || SDK_TRANSLATIONS[DEFAULT_LOCALE];
    const raw = Object.prototype.hasOwnProperty.call(dict, key)
      ? dict[key]
      : (Object.prototype.hasOwnProperty.call(SDK_TRANSLATIONS[DEFAULT_LOCALE], key)
        ? SDK_TRANSLATIONS[DEFAULT_LOCALE][key]
        : String(key || ''));
    if (!params || typeof params !== 'object') return raw;
    return String(raw).replace(/\{([a-zA-Z0-9_]+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
    });
  }

  const ALERT_PLURAL_FORMS = Object.freeze({
    en: ['alert', 'alerts'],
    ka: ['შეტყობინება', 'შეტყობინება'],
    ru: ['уведомление', 'уведомления', 'уведомлений'],
    fr: ['alerte', 'alertes'],
    it: ['avviso', 'avvisi'],
    de: ['Hinweis', 'Hinweise'],
    sv: ['avisering', 'aviseringar'],
    nl: ['melding', 'meldingen'],
    no: ['varsel', 'varsler'],
    da: ['advarsel', 'advarsler'],
    et: ['teade', 'teadet'],
    es: ['aviso', 'avisos'],
  });
  function formatAlertCount(locale, count) {
    const code = resolveLocale({ explicit: locale });
    const n = Math.max(0, Math.round(Number(count) || 0));
    const forms = ALERT_PLURAL_FORMS[code] || ALERT_PLURAL_FORMS.en;
    if (code === 'ru') {
      const mod10 = n % 10;
      const mod100 = n % 100;
      const word = (mod10 === 1 && mod100 !== 11)
        ? forms[0]
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) ? forms[1] : forms[2];
      return n + ' ' + word;
    }
    return n + ' ' + (n === 1 ? forms[0] : forms[1]);
  }
  const DNS_CLASSIFICATION_LABELS = Object.freeze({
    en: Object.freeze({
      unknown: 'not checked',
      normal_connectivity: 'normal connectivity',
      general_internet_failure: 'general internet failure',
      dns_resolution_failure: 'dns resolution failure',
      dns_records_missing: 'dns records missing',
      application_host_unavailable: 'application host unavailable',
      backend_unavailable: 'backend unavailable',
      cloudflare_doh_unavailable: 'cloudflare doh unavailable',
      possible_dns_interference: 'possible dns interference',
      inconclusive: 'inconclusive',
      disabled: 'disabled',
      cancelled: 'cancelled',
      error: 'error',
    }),
    ka: Object.freeze({
      unknown: 'არ შემოწმებულა',
      normal_connectivity: 'კავშირი ნორმალურია',
      general_internet_failure: 'ინტერნეტ-კავშირი გაწყვეტილია',
      dns_resolution_failure: 'DNS-ის გარჩევა ვერ მოხერხდა',
      dns_records_missing: 'DNS ჩანაწერები არ მოიძებნა',
      application_host_unavailable: 'აპის სერვერი მიუწვდომელია',
      backend_unavailable: 'ბექენდი მიუწვდომელია',
      cloudflare_doh_unavailable: 'Cloudflare DoH მიუწვდომელია',
      possible_dns_interference: 'შესაძლო DNS შეფერხება',
      inconclusive: 'შედეგი არასაკმარისია',
      disabled: 'გამორთულია',
      cancelled: 'გაუქმებულია',
      error: 'შეცდომა',
    }),
    ru: Object.freeze({
      unknown: 'не проверялся',
      normal_connectivity: 'связь в норме',
      general_internet_failure: 'нет доступа к интернету',
      dns_resolution_failure: 'сбой разрешения DNS',
      dns_records_missing: 'отсутствуют DNS-записи',
      application_host_unavailable: 'хост приложения недоступен',
      backend_unavailable: 'бэкенд недоступен',
      cloudflare_doh_unavailable: 'Cloudflare DoH недоступен',
      possible_dns_interference: 'возможны помехи DNS',
      inconclusive: 'результат неоднозначен',
      disabled: 'отключено',
      cancelled: 'отменено',
      error: 'ошибка',
    }),
    fr: Object.freeze({
      unknown: 'non vérifié',
      normal_connectivity: 'connectivité normale',
      general_internet_failure: 'panne Internet générale',
      dns_resolution_failure: 'échec de résolution DNS',
      dns_records_missing: 'enregistrements DNS manquants',
      application_host_unavailable: 'hôte de l’application indisponible',
      backend_unavailable: 'serveur principal indisponible',
      cloudflare_doh_unavailable: 'Cloudflare DoH indisponible',
      possible_dns_interference: 'interférence DNS possible',
      inconclusive: 'non concluant',
      disabled: 'désactivé',
      cancelled: 'annulé',
      error: 'erreur',
    }),
    it: Object.freeze({
      unknown: 'non verificato',
      normal_connectivity: 'connettività normale',
      general_internet_failure: 'assenza di rete Internet',
      dns_resolution_failure: 'errore di risoluzione DNS',
      dns_records_missing: 'record DNS mancanti',
      application_host_unavailable: 'host dell’app non disponibile',
      backend_unavailable: 'backend non disponibile',
      cloudflare_doh_unavailable: 'Cloudflare DoH non disponibile',
      possible_dns_interference: 'possibile interferenza DNS',
      inconclusive: 'inconcludente',
      disabled: 'disabilitato',
      cancelled: 'annullato',
      error: 'errore',
    }),
    de: Object.freeze({
      unknown: 'nicht geprüft',
      normal_connectivity: 'normale Konnektivität',
      general_internet_failure: 'allgemeiner Internetausfall',
      dns_resolution_failure: 'DNS-Auflösung fehlgeschlagen',
      dns_records_missing: 'DNS-Einträge fehlen',
      application_host_unavailable: 'Anwendungshost nicht erreichbar',
      backend_unavailable: 'Backend nicht erreichbar',
      cloudflare_doh_unavailable: 'Cloudflare DoH nicht erreichbar',
      possible_dns_interference: 'mögliche DNS-Störung',
      inconclusive: 'nicht eindeutig',
      disabled: 'deaktiviert',
      cancelled: 'abgebrochen',
      error: 'Fehler',
    }),
    sv: Object.freeze({
      unknown: 'inte kontrollerad',
      normal_connectivity: 'normal anslutning',
      general_internet_failure: 'allmänt internetavbrott',
      dns_resolution_failure: 'DNS-uppslag misslyckades',
      dns_records_missing: 'DNS-poster saknas',
      application_host_unavailable: 'appvärden är otillgänglig',
      backend_unavailable: 'backend är otillgänglig',
      cloudflare_doh_unavailable: 'Cloudflare DoH otillgänglig',
      possible_dns_interference: 'möjlig DNS-störning',
      inconclusive: 'otydligt resultat',
      disabled: 'inaktiverad',
      cancelled: 'avbruten',
      error: 'fel',
    }),
    nl: Object.freeze({
      unknown: 'niet gecontroleerd',
      normal_connectivity: 'normale connectiviteit',
      general_internet_failure: 'algemene internetstoring',
      dns_resolution_failure: 'DNS-omzetting mislukt',
      dns_records_missing: 'DNS-records ontbreken',
      application_host_unavailable: 'applicatiehost niet bereikbaar',
      backend_unavailable: 'backend niet bereikbaar',
      cloudflare_doh_unavailable: 'Cloudflare DoH niet beschikbaar',
      possible_dns_interference: 'mogelijke DNS-storing',
      inconclusive: 'onbeslist',
      disabled: 'uitgeschakeld',
      cancelled: 'geannuleerd',
      error: 'fout',
    }),
    no: Object.freeze({
      unknown: 'ikke sjekket',
      normal_connectivity: 'normal tilkobling',
      general_internet_failure: 'generelt internettbrudd',
      dns_resolution_failure: 'DNS-oppslag mislyktes',
      dns_records_missing: 'DNS-oppføringer mangler',
      application_host_unavailable: 'appvert utilgjengelig',
      backend_unavailable: 'backend utilgjengelig',
      cloudflare_doh_unavailable: 'Cloudflare DoH utilgjengelig',
      possible_dns_interference: 'mulig DNS-forstyrrelse',
      inconclusive: 'ikke entydig',
      disabled: 'deaktivert',
      cancelled: 'avbrutt',
      error: 'feil',
    }),
    da: Object.freeze({
      unknown: 'ikke tjekket',
      normal_connectivity: 'normal forbindelse',
      general_internet_failure: 'generelt internetudfald',
      dns_resolution_failure: 'DNS-opslag mislykkedes',
      dns_records_missing: 'DNS-poster mangler',
      application_host_unavailable: 'app-vært utilgængelig',
      backend_unavailable: 'backend utilgængelig',
      cloudflare_doh_unavailable: 'Cloudflare DoH utilgængelig',
      possible_dns_interference: 'mulig DNS-forstyrrelse',
      inconclusive: 'ikke entydig',
      disabled: 'deaktiveret',
      cancelled: 'annulleret',
      error: 'fejl',
    }),
    et: Object.freeze({
      unknown: 'kontrollimata',
      normal_connectivity: 'tavaline ühenduvus',
      general_internet_failure: 'üldine internetikatkestus',
      dns_resolution_failure: 'DNS-i lahendamine ebaõnnestus',
      dns_records_missing: 'DNS-kirjed puuduvad',
      application_host_unavailable: 'rakenduse host pole saadaval',
      backend_unavailable: 'taustateenus pole saadaval',
      cloudflare_doh_unavailable: 'Cloudflare DoH pole saadaval',
      possible_dns_interference: 'võimalik DNS-i häire',
      inconclusive: 'ebaselge tulemus',
      disabled: 'keelatud',
      cancelled: 'tühistatud',
      error: 'viga',
    }),
    es: Object.freeze({
      unknown: 'sin comprobar',
      normal_connectivity: 'conectividad normal',
      general_internet_failure: 'fallo general de Internet',
      dns_resolution_failure: 'fallo de resolución DNS',
      dns_records_missing: 'faltan registros DNS',
      application_host_unavailable: 'host de la app no disponible',
      backend_unavailable: 'backend no disponible',
      cloudflare_doh_unavailable: 'Cloudflare DoH no disponible',
      possible_dns_interference: 'posible interferencia DNS',
      inconclusive: 'no concluyente',
      disabled: 'desactivado',
      cancelled: 'cancelado',
      error: 'error',
    }),
  });
  function localizeDnsClassification(locale, classification, status) {
    const code = resolveLocale({ explicit: locale });
    const key = String(classification || 'unknown').toLowerCase();
    const map = DNS_CLASSIFICATION_LABELS[code] || DNS_CLASSIFICATION_LABELS.en;
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    const fallback = String(classification || '').replace(/_/g, ' ').trim();
    if (fallback && fallback !== 'unknown') return fallback;
    return status && status !== 'idle' ? String(status) : translate(code, 'widgetNotChecked');
  }

  const DNS_MESSAGES = Object.freeze({
    en: Object.freeze({
      disabled: 'Network diagnostics are disabled for this project.',
      cancelled: 'Diagnostics were cancelled before they finished.',
      normal_connectivity: 'Cloudflare DNS resolved this hostname and the application host responded.',
      general_internet_failure: 'The browser reports no network connection, and the application host did not respond.',
      backend_unavailable: 'The application host responds, but its configured backend health endpoint did not.',
      dns_resolution_failure: 'Cloudflare DNS returned NXDOMAIN for the current hostname.',
      dns_records_missing: 'Cloudflare returned NOERROR but no A or AAAA address records for this hostname.',
      application_host_unavailable: 'The application host did not respond. DNS, routing, TLS, firewall, or server availability may be involved.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS could not be reached or validated.',
      possible_dns_interference: 'DNS checks returned mixed results. Retry; this is not enough evidence to identify DNS interference.',
      inconclusive: 'Results are inconclusive. Retry the diagnostics.',
      caveat: 'JavaScript cannot inspect your device’s normal DNS resolver. A DoH result does not prove that the browser resolver is blocked.',
    }),
    ka: Object.freeze({
      disabled: 'ამ პროექტისთვის ქსელის დიაგნოსტიკა გამორთულია.',
      cancelled: 'დიაგნოსტიკა დასრულებამდე გაუქმდა.',
      normal_connectivity: 'Cloudflare DNS-მა დომენი წარმატებით გაარჩია და აპლიკაციის ჰოსტმა უპასუხა.',
      general_internet_failure: 'ბრაუზერს ინტერნეტ-კავშირი არ აქვს და აპლიკაციის ჰოსტმაც არ უპასუხა.',
      backend_unavailable: 'აპლიკაციის ჰოსტი პასუხობს, თუმცა კონფიგურირებული ბექენდის სერვერი არ პასუხობს.',
      dns_resolution_failure: 'Cloudflare DNS-მა მიმდინარე დომენისთვის NXDOMAIN დააბრუნა.',
      dns_records_missing: 'Cloudflare-მა NOERROR დააბრუნა, თუმცა ამ დომენისთვის A ან AAAA ჩანაწერები არ იძებნება.',
      application_host_unavailable: 'აპლიკაციის ჰოსტმა არ უპასუხა. მიზეზი შეიძლება იყოს DNS, მარშრუტიზაცია, TLS, ფაირვოლი ან სერვერი.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS-თან დაკავშირება ან პასუხის დადასტურება ვერ მოხერხდა.',
      possible_dns_interference: 'DNS შემოწმებამ არაერთგვაროვანი შედეგი დააბრუნა. სცადეთ ხელახლა — ეს DNS-ის ბლოკირების დასადგენად საკმარისი არ არის.',
      inconclusive: 'შედეგები არასაკმარისია. სცადეთ დიაგნოსტიკის ხელახლა გაშვება.',
      caveat: 'JavaScript-ს არ შეუძლია მოწყობილობის ჩვეულებრივი DNS გამრჩევის შემოწმება. DoH შედეგი არ ამტკიცებს, რომ ბრაუზერის DNS დაბლოკილია.',
    }),
    ru: Object.freeze({
      disabled: 'Сетевая диагностика отключена для этого проекта.',
      cancelled: 'Диагностика была отменена до завершения.',
      normal_connectivity: 'Cloudflare DNS успешно разрешил имя хоста, и сервер приложения ответил.',
      general_internet_failure: 'Браузер сообщает об отсутствии подключения к сети, и сервер приложения не отвечает.',
      backend_unavailable: 'Сервер приложения отвечает, но настроенный бэкенд не отвечает.',
      dns_resolution_failure: 'Cloudflare DNS вернул NXDOMAIN для текущего имени хоста.',
      dns_records_missing: 'Cloudflare вернул NOERROR, но не нашёл записей A или AAAA для этого имени хоста.',
      application_host_unavailable: 'Сервер приложения не ответил. Причиной могут быть DNS, маршрутизация, TLS, брандмауэр или недоступность сервера.',
      cloudflare_doh_unavailable: 'Не удалось связаться с Cloudflare DNS-over-HTTPS или проверить его ответ.',
      possible_dns_interference: 'Проверки DNS дали неоднозначные результаты. Повторите попытку; этих данных недостаточно для подтверждения блокировки DNS.',
      inconclusive: 'Результаты неоднозначны. Повторите диагностику.',
      caveat: 'JavaScript не может проверить стандартный DNS-резолвер вашего устройства. Результат DoH не доказывает блокировку браузерного резолвера.',
    }),
    fr: Object.freeze({
      disabled: 'Le diagnostic réseau est désactivé pour ce projet.',
      cancelled: 'Le diagnostic a été annulé avant la fin.',
      normal_connectivity: 'Cloudflare DNS a résolu ce nom d’hôte et l’hôte de l’application a répondu.',
      general_internet_failure: 'Le navigateur signale l’absence de connexion réseau et l’hôte de l’application n’a pas répondu.',
      backend_unavailable: 'L’hôte de l’application répond, mais pas son point d’accès principal configuré.',
      dns_resolution_failure: 'Cloudflare DNS a renvoyé NXDOMAIN pour le nom d’hôte actuel.',
      dns_records_missing: 'Cloudflare a renvoyé NOERROR sans enregistrement A ni AAAA pour ce nom d’hôte.',
      application_host_unavailable: 'L’hôte de l’application n’a pas répondu. Le DNS, le routage, TLS, un pare-feu ou le serveur peut être en cause.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS n’a pas pu être joint ou validé.',
      possible_dns_interference: 'Les vérifications DNS ont donné des résultats mitigés. Réessayez ; cela ne suffit pas à confirmer une interférence DNS.',
      inconclusive: 'Les résultats ne sont pas concluants. Relancez le diagnostic.',
      caveat: 'JavaScript ne peut pas inspecter le résolveur DNS normal de votre appareil. Un résultat DoH ne prouve pas que le résolveur du navigateur est bloqué.',
    }),
    it: Object.freeze({
      disabled: 'La diagnostica di rete è disabilitata per questo progetto.',
      cancelled: 'La diagnostica è stata annullata prima del completamento.',
      normal_connectivity: 'Cloudflare DNS ha risolto questo nome host e l’host dell’app ha risposto.',
      general_internet_failure: 'Il browser segnala assenza di connessione e l’host dell’applicazione non ha risposto.',
      backend_unavailable: 'L’host dell’applicazione risponde, ma il backend configurato non risponde.',
      dns_resolution_failure: 'Cloudflare DNS ha restituito NXDOMAIN per il nome host corrente.',
      dns_records_missing: 'Cloudflare ha restituito NOERROR ma nessun record A o AAAA per questo nome host.',
      application_host_unavailable: 'L’host dell’app non ha risposto. Possono essere coinvolti DNS, instradamento, TLS, firewall o disponibilità del server.',
      cloudflare_doh_unavailable: 'Impossibile raggiungere o verificare Cloudflare DNS-over-HTTPS.',
      possible_dns_interference: 'I controlli DNS hanno prodotto risultati contrastanti. Riprova; non ci sono prove sufficienti di interferenza DNS.',
      inconclusive: 'I risultati non sono conclusivi. Ripeti la diagnostica.',
      caveat: 'JavaScript non può esaminare il resolver DNS normale del dispositivo. Un risultato DoH non dimostra che il resolver del browser sia bloccato.',
    }),
    de: Object.freeze({
      disabled: 'Die Netzwerkdiagnose ist für dieses Projekt deaktiviert.',
      cancelled: 'Die Diagnose wurde vor dem Abschluss abgebrochen.',
      normal_connectivity: 'Cloudflare DNS hat diesen Hostnamen aufgelöst und der Anwendungshost hat geantwortet.',
      general_internet_failure: 'Der Browser meldet keine Netzwerkverbindung und der Anwendungshost hat nicht geantwortet.',
      backend_unavailable: 'Der Anwendungshost antwortet, aber der konfigurierte Backend-Endpunkt nicht.',
      dns_resolution_failure: 'Cloudflare DNS hat NXDOMAIN für den aktuellen Hostnamen zurückgegeben.',
      dns_records_missing: 'Cloudflare hat NOERROR gemeldet, aber keine A- oder AAAA-Adresseinträge gefunden.',
      application_host_unavailable: 'Der Anwendungshost hat nicht geantwortet. Mögliche Ursachen sind DNS, Routing, TLS, Firewall oder der Server.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS konnte nicht erreicht oder bestätigt werden.',
      possible_dns_interference: 'DNS-Prüfungen lieferten gemischte Ergebnisse. Bitte erneut prüfen; das belegt keine DNS-Störung.',
      inconclusive: 'Die Ergebnisse sind nicht eindeutig. Wiederholen Sie die Diagnose.',
      caveat: 'JavaScript kann den regulären DNS-Resolver Ihres Geräts nicht einsehen. Ein DoH-Ergebnis beweist keine Blockierung im Browser.',
    }),
    sv: Object.freeze({
      disabled: 'Nätverksdiagnostik är inaktiverad för det här projektet.',
      cancelled: 'Diagnostiken avbröts innan den slutfördes.',
      normal_connectivity: 'Cloudflare DNS slog upp värdnamnet och appvärden svarade.',
      general_internet_failure: 'Webbläsaren rapporterar ingen nätverksanslutning och appvärden svarade inte.',
      backend_unavailable: 'Appvärden svarar, men dess konfigurerade backend gjorde det inte.',
      dns_resolution_failure: 'Cloudflare DNS returnerade NXDOMAIN för det aktuella värdnamnet.',
      dns_records_missing: 'Cloudflare returnerade NOERROR men inga A- eller AAAA-poster för värdnamnet.',
      application_host_unavailable: 'Appvärden svarade inte. DNS, routing, TLS, brandvägg eller serverfel kan ligga bakom.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS kunde inte nås eller verifieras.',
      possible_dns_interference: 'DNS-kontrollerna gav blandade resultat. Försök igen; det räcker inte som bevis på DNS-störning.',
      inconclusive: 'Resultaten är otydliga. Försök köra diagnostiken igen.',
      caveat: 'JavaScript kan inte inspektera enhetens vanliga DNS-resolver. Ett DoH-resultat bevisar inte att webbläsarens resolver är blockerad.',
    }),
    nl: Object.freeze({
      disabled: 'Netwerkdiagnostiek is uitgeschakeld voor dit project.',
      cancelled: 'Diagnostiek is geannuleerd voordat deze was voltooid.',
      normal_connectivity: 'Cloudflare DNS heeft deze hostnaam omgezet en de applicatiehost heeft gereageerd.',
      general_internet_failure: 'De browser meldt geen netwerkverbinding en de applicatiehost heeft niet gereageerd.',
      backend_unavailable: 'De applicatiehost reageert, maar de geconfigureerde backend niet.',
      dns_resolution_failure: 'Cloudflare DNS gaf NXDOMAIN terug voor de huidige hostnaam.',
      dns_records_missing: 'Cloudflare gaf NOERROR terug maar geen A- of AAAA-adresrecords voor deze hostnaam.',
      application_host_unavailable: 'De applicatiehost reageerde niet. DNS, routering, TLS, firewall of de server kan de oorzaak zijn.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS kon niet worden bereikt of gevalideerd.',
      possible_dns_interference: 'DNS-controles gaven gemengde resultaten. Probeer opnieuw; dit is onvoldoende bewijs voor DNS-storing.',
      inconclusive: 'Resultaten zijn onbeslist. Voer de diagnostiek opnieuw uit.',
      caveat: 'JavaScript kan de normale DNS-resolver van je apparaat niet inspecteren. Een DoH-resultaat bewijst niet dat de browser-resolver is geblokkeerd.',
    }),
    no: Object.freeze({
      disabled: 'Nettverksdiagnostikk er deaktivert for dette prosjektet.',
      cancelled: 'Diagnostikken ble avbrutt før den ble ferdig.',
      normal_connectivity: 'Cloudflare DNS løste dette vertsnavnet og appverten svarte.',
      general_internet_failure: 'Nettleseren melder ingen nettverkstilkobling, og appverten svarte ikke.',
      backend_unavailable: 'Appverten svarer, men det konfigurerte backend-endepunktet gjorde det ikke.',
      dns_resolution_failure: 'Cloudflare DNS returnerte NXDOMAIN for gjeldende vertsnavn.',
      dns_records_missing: 'Cloudflare returnerte NOERROR, men ingen A- eller AAAA-adresseoppføringer for dette vertsnavnet.',
      application_host_unavailable: 'Appverten svarte ikke. DNS, ruting, TLS, brannmur eller servertilgjengelighet kan være årsaken.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS kunne ikke nås eller bekreftes.',
      possible_dns_interference: 'DNS-sjekker ga blandede resultater. Prøv igjen; dette er ikke nok til å påvise DNS-forstyrrelse.',
      inconclusive: 'Resultatene er ikke entydige. Kjør diagnostikken på nytt.',
      caveat: 'JavaScript kan ikke inspisere enhetens vanlige DNS-løser. Et DoH-resultat beviser ikke at nettleserens løser er blokkert.',
    }),
    da: Object.freeze({
      disabled: 'Netværksdiagnosticering er deaktiveret for dette projekt.',
      cancelled: 'Diagnosticeringen blev annulleret, før den blev færdig.',
      normal_connectivity: 'Cloudflare DNS slog værtsnavnet op, og app-værten svarede.',
      general_internet_failure: 'Browseren melder om ingen netværksforbindelse, og app-værten svarede ikke.',
      backend_unavailable: 'App-værten svarer, men det konfigurerede backend-slutpunkt gjorde ikke.',
      dns_resolution_failure: 'Cloudflare DNS returnerede NXDOMAIN for det aktuelle værtsnavn.',
      dns_records_missing: 'Cloudflare returnerede NOERROR, men ingen A- eller AAAA-adresseposter for dette værtsnavn.',
      application_host_unavailable: 'App-værten svarede ikke. DNS, routing, TLS, firewall eller serverfejl kan være årsagen.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS kunne ikke nås eller bekræftes.',
      possible_dns_interference: 'DNS-tjek gav blandede resultater. Prøv igen; dette er ikke bevis nok på DNS-forstyrrelse.',
      inconclusive: 'Resultaterne er ikke entydige. Kør diagnosticeringen igen.',
      caveat: 'JavaScript kan ikke inspicere enhedens almindelige DNS-resolver. Et DoH-resultat beviser ikke, at browserens resolver er blokeret.',
    }),
    et: Object.freeze({
      disabled: 'Võrgudiagnostika on selle projekti jaoks keelatud.',
      cancelled: 'Diagnostika tühistati enne lõpuleviimist.',
      normal_connectivity: 'Cloudflare DNS lahendas selle hostinime ja rakenduse host vastas.',
      general_internet_failure: 'Brauser teatab võrguühenduse puudumisest ja rakenduse host ei vastanud.',
      backend_unavailable: 'Rakenduse host vastab, kuid seadistatud taustateenuse lõpp-punkt mitte.',
      dns_resolution_failure: 'Cloudflare DNS tagastas selle hostinime kohta vastuse NXDOMAIN.',
      dns_records_missing: 'Cloudflare tagastas NOERROR, kuid A- või AAAA-aadressikirjeid sellele hostinimele ei leitud.',
      application_host_unavailable: 'Rakenduse host ei vastanud. Põhjuseks võib olla DNS, marsruutimine, TLS, tulemüür või serveri tõrge.',
      cloudflare_doh_unavailable: 'Cloudflare DNS-over-HTTPS teenusega ei õnnestunud ühendust saada ega vastust kinnitada.',
      possible_dns_interference: 'DNS-kontrollid andsid vastakaid tulemusi. Proovi uuesti; see ei tõenda DNS-i häirimist.',
      inconclusive: 'Tulemused on ebaselged. Korda diagnostikat.',
      caveat: 'JavaScript ei saa kontrollida seadme tavapärast DNS-lahendajat. DoH-tulemus ei tõenda, et brauseri lahendaja on blokeeritud.',
    }),
    es: Object.freeze({
      disabled: 'El diagnóstico de red está desactivado para este proyecto.',
      cancelled: 'El diagnóstico se canceló antes de terminar.',
      normal_connectivity: 'Cloudflare DNS resolvió este nombre de host y el host de la aplicación respondió.',
      general_internet_failure: 'El navegador informa que no hay conexión de red y el host de la aplicación no respondió.',
      backend_unavailable: 'El host de la aplicación responde, pero su backend configurado no.',
      dns_resolution_failure: 'Cloudflare DNS devolvió NXDOMAIN para el nombre de host actual.',
      dns_records_missing: 'Cloudflare devolvió NOERROR pero sin registros A ni AAAA para este nombre de host.',
      application_host_unavailable: 'El host de la aplicación no respondió. Puede deberse a DNS, enrutamiento, TLS, cortafuegos o disponibilidad del servidor.',
      cloudflare_doh_unavailable: 'No se pudo conectar con Cloudflare DNS-over-HTTPS ni validar su respuesta.',
      possible_dns_interference: 'Las comprobaciones DNS arrojaron resultados mixtos. Vuelve a intentarlo; no basta para identificar una interferencia DNS.',
      inconclusive: 'Los resultados no son concluyentes. Vuelve a ejecutar el diagnóstico.',
      caveat: 'JavaScript no puede inspeccionar el resolvedor DNS habitual de tu dispositivo. Un resultado DoH no demuestra que el resolvedor del navegador esté bloqueado.',
    }),
  });
  function localizeDnsMessage(locale, classification, fallbackMessage, includeCaveat) {
    const code = resolveLocale({ explicit: locale });
    if (code === 'en' && fallbackMessage) {
      return includeCaveat ? { message: fallbackMessage, caveat: DNS_MESSAGES.en.caveat } : { message: fallbackMessage, caveat: '' };
    }
    const key = String(classification || 'inconclusive').toLowerCase();
    const table = DNS_MESSAGES[code] || DNS_MESSAGES.en;
    const message = Object.prototype.hasOwnProperty.call(table, key)
      ? table[key]
      : (fallbackMessage || table.inconclusive);
    const caveat = includeCaveat ? (table.caveat || DNS_MESSAGES.en.caveat) : '';
    return { message: message, caveat: caveat };
  }
  function chromeHandoffLabels(locale) {
    const code = resolveLocale({ explicit: locale });
    return Object.freeze({
      title: translate(code, 'chromeTitle'),
      intro: translate(code, 'chromeIntro'),
      stepCopy: translate(code, 'chromeStepCopy'),
      stepSwitch: translate(code, 'chromeStepSwitch'),
      stepPaste: translate(code, 'chromeStepPaste'),
      openLabel: translate(code, 'chromeOpenLabel'),
      dismissLabel: translate(code, 'chromeDismissLabel'),
      copyLabel: translate(code, 'chromeCopyLabel'),
      copiedLabel: translate(code, 'chromeCopiedLabel'),
      copyManual: translate(code, 'chromeCopyManual'),
    });
  }

  /* --- core/capabilities.js --- */

  /** Capabilities a project can switch off with `modules.<name>: false`. */
  const GATED_CAPABILITIES = ['diagnostics', 'recovery', 'failover', 'help'];
  Object.freeze(GATED_CAPABILITIES);

  /**
   * Action id → capability. Ids are the documented action contract published in
   * `state.availableActions`, so a notice action and a panel action with the same
   * id are gated identically.
   */
  const CAPABILITY_ACTION_IDS = Object.freeze({
    diagnostics: 'diagnostics',
    recovery: 'recovery',
    'backup-status': 'failover',
    help: 'help',
  });

  /** Action `kind` → capability, for project-supplied actions with a new id. */
  const CAPABILITY_ACTION_KINDS = Object.freeze({
    diagnostics: 'diagnostics',
    recovery: 'recovery',
    backup: 'failover',
    help: 'help',
  });

  /**
   * Notification id → capability the notice *is* (as opposed to a notice that
   * merely links to a gated action). Disabling the capability removes the notice.
   */
  const CAPABILITY_NOTICE_IDS = Object.freeze({
    'api:backup-active': 'failover',
  });

  /**
   * Is `capability` enabled in a resolved `modules` record?
   *
   * Unknown names and a missing record are enabled: the helpers are also used by
   * renderers holding partial or hand-built state, where the documented default
   * is "on".
   */
  function isCapabilityEnabled(modules, capability) {
    const name = String(capability == null ? '' : capability);
    const pwaCapabilities = ['installationDetection', 'installationGuidance', 'updateDetection', 'updateNotifications', 'autoUpdate', 'userUpdate', 'offlineDiagnostics', 'cacheDiagnostics'];
    const record = modules && typeof modules === 'object' ? modules : null;
    if (GATED_CAPABILITIES.indexOf(name) === -1 && pwaCapabilities.indexOf(name) === -1) {
      return !record || !record.extensions || record.extensions[name] !== false;
    }
    return !record || record[name] !== false;
  }

  /** Resolve the capability that an action id (and optional kind) belongs to. */
  function capabilityForAction(actionOrId, kind) {
    if (actionOrId && typeof actionOrId === 'object') {
      const byId = CAPABILITY_ACTION_IDS[String(actionOrId.id || '')];
      if (byId) return byId;
      return CAPABILITY_ACTION_KINDS[String(actionOrId.kind || '')] || null;
    }
    const id = String(actionOrId == null ? '' : actionOrId);
    const byId = CAPABILITY_ACTION_IDS[id];
    if (byId) return byId;
    return CAPABILITY_ACTION_KINDS[String(kind == null ? '' : kind)] || null;
  }

  /** Is this action (id + kind, or an action object) allowed by `modules`? */
  function isActionAllowed(modules, actionOrId, kind) {
    const capability = capabilityForAction(actionOrId, kind);
    return !capability || isCapabilityEnabled(modules, capability);
  }

  /** Filter a list of actions down to the capabilities `modules` allows. */
  function gateActions(modules, actions) {
    if (!Array.isArray(actions)) return [];
    return actions.filter(function (action) { return isActionAllowed(modules, action); });
  }

  /**
   * Gate one notification.
   *
   * - a notice that *is* gated capability UI is removed (`null`);
   * - a notice whose linked action is gated keeps its content but loses
   *   `actionId`, so a critical connectivity notice still reports the real
   *   condition without exposing an unreachable action;
   * - everything else is returned unchanged (the original object identity).
   */
  function gateNotification(modules, notification) {
    if (!notification || typeof notification !== 'object') return null;
    const noticeCapability = CAPABILITY_NOTICE_IDS[String(notification.id || '')];
    if (noticeCapability && !isCapabilityEnabled(modules, noticeCapability)) return null;
    if (!notification.actionId) return notification;
    if (isActionAllowed(modules, notification.actionId)) return notification;
    const copy = Object.assign({}, notification);
    delete copy.actionId;
    return copy;
  }

  /** Gate a list of notifications. */
  function gateNotifications(modules, notifications) {
    if (!Array.isArray(notifications)) return [];
    return notifications.map(function (notification) {
      return gateNotification(modules, notification);
    }).filter(Boolean);
  }

  /**
   * The published `state.capabilities` record. Shape is unchanged from the
   * documented 0.x/0.2 contract: a boolean per module key.
   */
  function capabilitiesRecord(modules) {
    const record = modules && typeof modules === 'object' ? modules : {};
    return {
      installation: record.installation !== false,
      diagnostics: record.diagnostics !== false,
      recovery: record.recovery !== false,
      failover: record.failover !== false,
      help: record.help !== false,
      updates: record.updates !== false,
      chromeHandoff: record.chromeHandoff !== false,
      installationDetection: record.installationDetection !== false,
      installationGuidance: record.installationGuidance !== false,
      updateDetection: record.updateDetection !== false,
      updateNotifications: record.updateNotifications !== false,
      autoUpdate: record.autoUpdate !== false,
      userUpdate: record.userUpdate !== false,
      offlineDiagnostics: record.offlineDiagnostics !== false,
      cacheDiagnostics: record.cacheDiagnostics !== false,
    };
  }

  /* --- core/sanitize.js --- */

  function isUnsafeKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }

  const SECRET_KEY_PATTERN = /^(?:secret|secrets|api[_-]?key|private[_-]?key|client[_-]?secret|password|passwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|bearer[_-]?token|bearer|authorization|credentials|vapid[_-]?private[_-]?key|signing[_-]?key|encryption[_-]?key|cookie|token)$/i;

  const EXECUTABLE_STRING_PATTERN = /(?:^\s*(?:javascript|vbscript|data\s*:\s*text\/javascript)\s*:|<\s*script\b|\beval\s*\(|\bnew\s+Function\s*\()/i;
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value && typeof value === 'object') {
      const copy = {};
      Object.keys(value).forEach(function (key) {
        if (isUnsafeKey(key)) return;
        copy[key] = clone(value[key]);
      });
      return copy;
    }
    return value;
  }
  function merge(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return target;
    Object.keys(source).forEach(function (key) {
      if (isUnsafeKey(key)) return;
      const value = source[key];
      if (value === undefined) return;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
        merge(target[key], value);
      } else {
        target[key] = clone(value);
      }
    });
    return target;
  }
  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }
  function safeText(value, max) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').slice(0, max || 120);
  }
  function safeRelativeUrl(value) {
    if (typeof value !== 'string' || !value) return false;
    if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.indexOf(String.fromCharCode(92)) !== -1 || /[\u0000-\u001f]/.test(value)) {
      return false;
    }
    let path = value.split(/[?#]/)[0];
    try {
      path = decodeURIComponent(path);
    } catch (error) {
      return false;
    }
    return !path.split('/').some(function (part) { return part === '..'; });
  }
  function safeSameOriginIcon(value, fallback, baseHref, UrlCtor) {
    if (!value) return fallback;
    const URLImpl = UrlCtor || URL;
    try {
      const base = new URLImpl(baseHref || 'https://localhost/');
      const url = new URLImpl(String(value), base);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
      if (url.origin !== base.origin) return fallback;
      return url.pathname + url.search;
    } catch (error) {
      return fallback;
    }
  }
  function isSecretKey(key) {
    return SECRET_KEY_PATTERN.test(String(key || '').trim());
  }
  function isExecutableString(value) {
    return typeof value === 'string' && EXECUTABLE_STRING_PATTERN.test(value);
  }
  function inspectConfigSafety(value, options) {
    const opts = options || {};
    const allowServiceFunctions = Boolean(opts.allowServiceFunctions);
    const report = {
      hasFunction: false,
      hasExecutableString: false,
      secretKeys: [],
    };

    function visit(node, path, depth) {
      if (depth > 12 || node == null) return;
      if (typeof node === 'function') {
        if (allowServiceFunctions && path === 'services.diagnostics') return;
        report.hasFunction = true;
        return;
      }
      if (typeof node === 'string') {
        if (isExecutableString(node)) report.hasExecutableString = true;
        return;
      }
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i += 1) {
          visit(node[i], path + '[' + i + ']', depth + 1);
        }
        return;
      }
      if (typeof node === 'object') {
        const keys = Object.keys(node);
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          if (isUnsafeKey(key)) continue;
          if (isSecretKey(key)) {
            report.secretKeys.push(path ? path + '.' + key : key);
          }
          visit(node[key], path ? path + '.' + key : key, depth + 1);
        }
      }
    }

    visit(value, '', 0);
    return report;
  }
  function sanitizePlainData(value, depth) {
    const level = depth || 0;
    if (level > 12 || value == null) return null;
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (typeof value === 'string') {
      return isExecutableString(value) ? '' : value;
    }
    if (typeof value === 'number') {
      return isFinite(value) ? value : null;
    }
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      return value
        .map(function (item) { return sanitizePlainData(item, level + 1); })
        .filter(function (item) { return item !== undefined; });
    }
    if (typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach(function (key) {
        if (isUnsafeKey(key) || isSecretKey(key)) return;
        const cleaned = sanitizePlainData(value[key], level + 1);
        if (cleaned !== undefined) out[key] = cleaned;
      });
      return out;
    }
    return undefined;
  }
  const INSTALL_EXPERIENCE_DEFAULTS = Object.freeze({
    enabled: true,
    presentation: 'manual',
    locale: 'auto',
    installDescription: '',
    disableInstallDescription: false,
    disableScreenshots: false,
    disableScreenshotsApple: false,
    disableScreenshotsChrome: false,
    manualHowTo: false,
    disableChrome: false,
    disableClose: false,
    disableAndroidFallback: false,
    useLocalStorage: false,
    manifestUrl: '',
    manifestId: '',
    styles: Object.freeze({}),
  });

  const INSTALL_EXPERIENCE_BOOLEAN_KEYS = [
    'enabled',
    'disableInstallDescription',
    'disableScreenshots',
    'disableScreenshotsApple',
    'disableScreenshotsChrome',
    'manualHowTo',
    'disableChrome',
    'disableClose',
    'disableAndroidFallback',
    'useLocalStorage',
  ];

  function isSafeInstallStyleValue(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 120) return false;
    if (/[;{}<>\\]/.test(trimmed)) return false;
    if (/(?:url|expression|javascript|vbscript|data)\s*[:(]/i.test(trimmed)) return false;
    return true;
  }
  function normalizeInstallLocale(value, fallback) {
    if (typeof value !== 'string') return fallback || 'auto';
    const trimmed = value.trim().replace(/_/g, '-');
    if (!trimmed || trimmed.toLowerCase() === 'auto') return 'auto';
    if (/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(trimmed)) return trimmed;
    return fallback || 'auto';
  }
  function normalizeInstallExperience(raw, fallbackConfig) {
    const base = fallbackConfig && typeof fallbackConfig === 'object'
      ? clone(fallbackConfig)
      : clone(INSTALL_EXPERIENCE_DEFAULTS);
    base.styles = base.styles && typeof base.styles === 'object' && !Array.isArray(base.styles) ? base.styles : {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

    INSTALL_EXPERIENCE_BOOLEAN_KEYS.forEach(function (key) {
      if (typeof raw[key] === 'boolean') base[key] = raw[key];
    });
    if (raw.presentation === 'manual' || raw.presentation === 'auto') {
      base.presentation = raw.presentation;
    }
    if (raw.locale !== undefined) {
      base.locale = normalizeInstallLocale(raw.locale, base.locale);
    }
    if (typeof raw.installDescription === 'string' && !isExecutableString(raw.installDescription)) {
      base.installDescription = safeText(raw.installDescription, 280).trim();
    }
    if (typeof raw.manifestId === 'string' && !isExecutableString(raw.manifestId)) {
      base.manifestId = safeText(raw.manifestId, 180).trim();
    }
    if (typeof raw.manifestUrl === 'string') {
      const candidate = raw.manifestUrl.trim();
      if (!candidate) base.manifestUrl = '';
      else if (safeRelativeUrl(candidate) && !isExecutableString(candidate)) base.manifestUrl = safeText(candidate, 200);
    }
    if (raw.styles && typeof raw.styles === 'object' && !Array.isArray(raw.styles)) {
      const safeStyles = Object.assign({}, base.styles);
      Object.keys(raw.styles).slice(0, 20).forEach(function (prop) {
        if (isUnsafeKey(prop) || !/^--[a-zA-Z0-9_-]{1,50}$/.test(prop)) return;
        if (isSafeInstallStyleValue(raw.styles[prop])) {
          safeStyles[prop] = raw.styles[prop].trim();
        }
      });
      base.styles = safeStyles;
    }
    return base;
  }
  function inspectInstallExperienceIssues(raw, prefix) {
    const issues = [];
    const basePath = prefix || 'installExperience';
    if (raw === undefined) return issues;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      issues.push({
        code: 'invalid_install_experience',
        path: basePath,
        message: 'Install experience configuration must be a plain object.',
      });
      return issues;
    }
    INSTALL_EXPERIENCE_BOOLEAN_KEYS.forEach(function (key) {
      if (raw[key] !== undefined && typeof raw[key] !== 'boolean') {
        issues.push({
          code: 'invalid_install_flag',
          path: basePath + '.' + key,
          message: 'Install experience flags must use boolean values.',
        });
      }
    });
    if (raw.presentation !== undefined && raw.presentation !== 'manual' && raw.presentation !== 'auto') {
      issues.push({
        code: 'invalid_install_presentation',
        path: basePath + '.presentation',
        message: 'Install presentation must be "manual" or "auto".',
      });
    }
    if (raw.locale !== undefined) {
      const cleanedLocale = typeof raw.locale === 'string' ? raw.locale.trim().replace(/_/g, '-') : '';
      const validLocale = typeof raw.locale === 'string' &&
        (cleanedLocale.toLowerCase() === 'auto' || /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(cleanedLocale));
      if (!validLocale) {
        issues.push({
          code: 'invalid_install_locale',
          path: basePath + '.locale',
          message: 'Install locale must be "auto" or a valid BCP-47 language tag.',
        });
      }
    }
    if (raw.manifestUrl !== undefined) {
      const validUrl = typeof raw.manifestUrl === 'string' &&
        (raw.manifestUrl.trim() === '' || (safeRelativeUrl(raw.manifestUrl.trim()) && !isExecutableString(raw.manifestUrl)));
      if (!validUrl) {
        issues.push({
          code: 'unsafe_install_manifest_url',
          path: basePath + '.manifestUrl',
          message: 'Install manifest URL must be a safe relative path.',
        });
      }
    }
    if (raw.styles !== undefined) {
      if (!raw.styles || typeof raw.styles !== 'object' || Array.isArray(raw.styles)) {
        issues.push({
          code: 'invalid_install_styles',
          path: basePath + '.styles',
          message: 'Install styles must be a plain object of CSS custom properties.',
        });
      } else {
        Object.keys(raw.styles).forEach(function (key) {
          if (isUnsafeKey(key)) return;
          if (!/^--[a-zA-Z0-9_-]{1,50}$/.test(key) || !isSafeInstallStyleValue(raw.styles[key])) {
            issues.push({
              code: 'unsafe_install_style',
              path: basePath + '.styles.' + key,
              message: 'Install styles must use safe CSS custom property names and values.',
            });
          }
        });
      }
    }
    return issues;
  }

  /* --- theme/index.js --- */

  const THEME_MODES = ['auto', 'light', 'dark', 'custom'];
  Object.freeze(THEME_MODES);

  /** Public token keys. Colours first, then the non-colour design tokens. */
  const COLOR_TOKEN_KEYS = [
    'primary',
    'onPrimary',
    'background',
    'surface',
    'surfaceSoft',
    'text',
    'mutedText',
    'border',
    'focus',
    'success',
    'info',
    'warning',
    'error',
    'critical',
  ];
  Object.freeze(COLOR_TOKEN_KEYS);
  const THEME_TOKEN_KEYS = COLOR_TOKEN_KEYS.concat([
    'fontFamily',
    'fontSize',
    'radius',
    'radiusSmall',
    'borderWidth',
    'shadow',
  ]);
  Object.freeze(THEME_TOKEN_KEYS);

  /**
   * Public token -> CSS custom property. `error`/`warning`/`success` also drive
   * the legacy tone variables (`--youge-critical`, `--youge-auth`,
   * `--youge-install`) so existing stylesheets and integrations keep working.
   */
  const TOKEN_CSS_VARIABLES = {
    primary: ['--youge-brand'],
    onPrimary: ['--youge-on-brand'],
    background: ['--youge-background'],
    surface: ['--youge-surface'],
    surfaceSoft: ['--youge-surface-soft'],
    text: ['--youge-ink'],
    mutedText: ['--youge-muted'],
    border: ['--youge-line'],
    focus: ['--youge-focus'],
    success: ['--youge-success', '--youge-install'],
    info: ['--youge-info', '--youge-backup'],
    warning: ['--youge-warning', '--youge-auth'],
    error: ['--youge-error', '--youge-critical'],
    // `critical` is the most specific severity token: applied after `error` so an
    // explicit critical colour wins when both are provided.
    critical: ['--youge-critical', '--youge-error'],
    fontFamily: ['--youge-font'],
    fontSize: ['--youge-font-size'],
    radius: ['--youge-radius'],
    radiusSmall: ['--youge-radius-small'],
    borderWidth: ['--youge-border-width'],
    shadow: ['--youge-shadow'],
  };
  Object.freeze(TOKEN_CSS_VARIABLES);

  /**
   * Variables owned by the widget and the layout system. An integrator may not
   * set them through `theme.variables`: they control placement and hit-area
   * geometry, which requirement 3 forbids a host from overriding.
   */
  const PROTECTED_VARIABLES = [
    '--youge-offset-x',
    '--youge-offset-y',
    '--youge-fab-size',
    '--youge-fab-glyph',
    '--youge-motion-fast',
    '--youge-motion-state',
  ];
  Object.freeze(PROTECTED_VARIABLES);

  /** The Assistant's own identity. Never derived from the host. */
  const ASSISTANT_PALETTES = Object.freeze({
    light: Object.freeze({
      primary: '#155eef',
      onPrimary: '#ffffff',
      background: '#ffffff',
      surface: '#ffffff',
      surfaceSoft: '#f8fafc',
      text: '#0f172a',
      mutedText: '#475569',
      border: '#e2e8f0',
      focus: '#155eef',
      success: '#067647',
      info: '#475467',
      warning: '#b54708',
      error: '#b42318',
      critical: '#b42318',
    }),
    dark: Object.freeze({
      primary: '#84adff',
      onPrimary: '#0b1220',
      background: '#0b1220',
      surface: '#0b1220',
      surfaceSoft: '#111c2f',
      text: '#f8fafc',
      mutedText: '#cbd5e1',
      border: '#334155',
      focus: '#84adff',
      success: '#a6f4c5',
      info: '#cbd5e1',
      warning: '#fec84b',
      error: '#fda29b',
      critical: '#fda29b',
    }),
  });

  /**
   * Notification level metadata: the single source of truth shared by the DOM
   * widget and the React example, so both render the same glyph and the same
   * accessible wording for each tier. `glyph` is inner SVG markup only — no
   * scripts, no external references, no `on*` handlers — and `icon` names the
   * legacy icon it replaces where one exists.
   */
  const NOTIFICATION_LEVELS = Object.freeze(['critical', 'error', 'warning', 'info', 'success']);

  const LEVEL_SHAPES = {
    critical: [
      { type: 'path', d: 'M8.6 3h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6z' },
      { type: 'path', d: 'M12 8v5' },
      { type: 'dot', cx: 12, cy: 16.5 },
    ],
    error: [
      { type: 'circle', cx: 12, cy: 12, r: 9 },
      { type: 'path', d: 'M12 7.5v5.5' },
      { type: 'dot', cx: 12, cy: 16.5 },
    ],
    warning: [
      { type: 'path', d: 'M12 3.2 22 20.4H2z' },
      { type: 'path', d: 'M12 9.5v4.6' },
      { type: 'dot', cx: 12, cy: 17.4 },
    ],
    info: [
      { type: 'circle', cx: 12, cy: 12, r: 9 },
      { type: 'path', d: 'M12 11v5.5' },
      { type: 'dot', cx: 12, cy: 7.6 },
    ],
    success: [
      { type: 'circle', cx: 12, cy: 12, r: 9 },
      { type: 'path', d: 'm7.8 12.3 2.9 2.9 5.6-6' },
    ],
  };

  /**
   * Declarative glyph primitives per level.
   *
   * A renderer that cannot use HTML strings (a React tree, for instance) maps
   * these objects onto elements; a renderer that can (the embedded widget) calls
   * `notificationLevelMarkup`. One definition, two renderers, no drift.
   */
  const NOTIFICATION_LEVEL_SHAPES = Object.freeze(
    Object.keys(LEVEL_SHAPES).reduce((acc, level) => {
      acc[level] = Object.freeze(LEVEL_SHAPES[level].map((shape) => Object.freeze(Object.assign({}, shape))));
      return acc;
    }, {})
  );

  /** SVG attributes shared by every level glyph. */
  const NOTIFICATION_LEVEL_SVG_ATTRIBUTES = Object.freeze({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.9',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });

  function shapeToMarkup(shape) {
    if (shape.type === 'circle') {
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}"/>`;
    }
    if (shape.type === 'dot') {
      return `<circle cx="${shape.cx}" cy="${shape.cy}" r=".9" fill="currentColor" stroke="none"/>`;
    }
    return `<path d="${shape.d}"/>`;
  }

  /**
   * Inner SVG markup for a level. Static, script-free markup built from frozen
   * literals above — never from user input.
   */
  function notificationLevelMarkup(level) {
    const shapes = NOTIFICATION_LEVEL_SHAPES[level];
    if (!shapes) return '';
    return shapes.map(shapeToMarkup).join('');
  }

  /** Inner SVG markup per level. */
  const NOTIFICATION_LEVEL_ICONS = Object.freeze(
    Object.keys(NOTIFICATION_LEVEL_SHAPES).reduce((acc, level) => {
      acc[level] = notificationLevelMarkup(level);
      return acc;
    }, {})
  );

  /** Clamp any value onto a known level (`'info'` when unknown). */
  function normalizeNotificationLevel(level) {
    return Object.prototype.hasOwnProperty.call(NOTIFICATION_LEVEL_SHAPES, level) ? level : 'info';
  }

  /** Accessible label for each level, reused by both renderers. */
  const NOTIFICATION_LEVEL_LABELS = Object.freeze({
    critical: 'Critical',
    error: 'Error',
    warning: 'Warning',
    info: 'Information',
    success: 'Success',
  });
  const THEME_DEFAULTS = Object.freeze({
    mode: 'auto',
    inheritHost: false,
    tokens: Object.freeze({}),
    host: Object.freeze({}),
    variables: Object.freeze({}),
  });

  // The system-font stack the Assistant ships with. Kept in sync with the
  // literal in assistant-widget.css so `fontFamily` has an honest default.
  const ASSISTANT_FONT_STACK =
    'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  /* ------------------------------------------------------------------ *
   * Value validation
   * ------------------------------------------------------------------ */

  const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const FUNCTION_COLOR = /^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/a-z]*\)$/i;
  const TOKEN_VAR_REFERENCE = /^var\(--youge-[a-z0-9-]{1,48}\)$/;
  const UNSAFE_CSS = /[\\;{}<>]|!\s*important|url\s*\(|expression\s*\(|@import|javascript:/i;
  const FONT_FAMILY = /^[A-Za-z0-9"'][A-Za-z0-9\s,'"_-]{0,118}$/;
  const PX_LENGTH = /^(\d{1,3})px$/;
  const NUMBER = /^\d{1,3}$/;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Bounded safety gate for any CSS value the integrator supplies.
   * Rejects declaration-breaking characters and expression-capable payloads.
   */
  function isSafeCssValue(value, maxLength) {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    if (!text || text.length > (maxLength || 200)) return false;
    if (UNSAFE_CSS.test(text)) return false;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(text)) return false;
    return true;
  }

  /** Accept only a plain hex, a bounded rgb()/hsl() call or one of our own vars. */
  function normalizeColor(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (text.length > 60) return null;
    if (HEX_COLOR.test(text)) return text;
    if (FUNCTION_COLOR.test(text) && isSafeCssValue(text, 60)) return text;
    if (TOKEN_VAR_REFERENCE.test(text)) return text;
    return null;
  }
  function normalizeFontFamily(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim().replace(/\s+/g, ' ');
    if (!FONT_FAMILY.test(text)) return null;
    // A stack with no generic fallback can resolve to nothing on unusual
    // platforms; the Assistant always appends its own generic last resort in CSS.
    return text;
  }
  function normalizeLength(value, min, max) {
    if (typeof value === 'number' && isFinite(value)) return clamp(Math.round(value), min, max);
    /* numeric strings and px strings are handled below */
    if (typeof value !== 'string') return null;
    const text = value.trim();
    const px = PX_LENGTH.exec(text);
    if (px) return clamp(Number(px[1]), min, max);
    const bare = NUMBER.exec(text);
    if (bare) return clamp(Number(bare[1]), min, max);
    return null;
  }
  function normalizeShadow(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!isSafeCssValue(text, 160)) return null;
    if (text.indexOf('px') === -1) return null;
    return text;
  }

  /**
   * Validate one token by key. Returns the CSS string to apply, or `null` when
   * the value is not acceptable (the caller then falls back to the Assistant
   * default). Length tokens are always normalized to a `px` string.
   */
  function normalizeToken(key, value) {
    if (value === undefined || value === null || value === '') return null;
    if (COLOR_TOKEN_KEYS.indexOf(key) !== -1) return normalizeColor(value);
    switch (key) {
      case 'fontFamily':
        return normalizeFontFamily(value);
      case 'fontSize':
        return px(normalizeLength(value, 10, 20));
      case 'radius':
        return px(normalizeLength(value, 0, 28));
      case 'radiusSmall':
        return px(normalizeLength(value, 0, 20));
      case 'borderWidth':
        return px(normalizeLength(value, 0, 3));
      case 'shadow':
        return normalizeShadow(value);
      default:
        return null;
    }
  }

  function px(number) {
    return number === null ? null : number + 'px';
  }

  function normalizeTokenMap(raw, warnings, warningPrefix) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(function (key) {
      if (THEME_TOKEN_KEYS.indexOf(key) === -1) {
        // Unknown keys are ignored, never forwarded to the DOM.
        warnings.push(warningPrefix + ':unknown_token:' + String(key).slice(0, 40));
        return;
      }
      const value = normalizeToken(key, raw[key]);
      if (value === null) {
        warnings.push(warningPrefix + ':invalid_token:' + key);
        return;
      }
      out[key] = value;
    });
    return out;
  }

  /**
   * Optional custom CSS variables. Restricted to `--youge-*`, to safe values and
   * away from the variables that own placement and hit-area geometry.
   */
  function normalizeThemeVariables(raw, warnings) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    const list = warnings || [];
    Object.keys(raw).forEach(function (key) {
      const name = String(key);
      if (!/^--youge-[a-z0-9-]{1,40}$/.test(name)) {
        list.push('variables:invalid_name:' + name.slice(0, 40));
        return;
      }
      if (PROTECTED_VARIABLES.indexOf(name) !== -1) {
        list.push('variables:protected:' + name);
        return;
      }
      const value = raw[key];
      if (!isSafeCssValue(value, 160)) {
        list.push('variables:invalid_value:' + name);
        return;
      }
      out[name] = String(value).trim();
    });
    return out;
  }

  /**
   * Normalize any accepted `theme` shape into a stable, JSON-safe record.
   *
   * Accepted inputs:
   *   'auto' | 'light' | 'dark'         (0.x string form, unchanged behaviour)
   *   { mode, inheritHost, tokens, host, variables }
   *
   * `mode: 'custom'` is only available through the object form: a bare
   * `'custom'` string has no tokens to apply, so it falls back to `'auto'`.
   */
  function normalizeTheme(raw) {
    const warnings = [];
    let source = raw;

    if (typeof source === 'string') {
      const mode = source.trim().toLowerCase();
      if (mode === 'auto' || mode === 'light' || mode === 'dark') {
        return { mode: mode, inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
      }
      if (mode === 'custom') warnings.push('theme:custom_requires_object');
      else warnings.push('theme:unsupported_mode:' + mode.slice(0, 20));
      return { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
    }

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      if (source !== undefined && source !== null) warnings.push('theme:invalid_object');
      return { mode: 'auto', inheritHost: false, tokens: {}, host: {}, variables: {}, warnings: warnings };
    }

    let mode = 'auto';
    const requested = source.mode;
    if (requested === undefined || requested === null) {
      // Object form without an explicit mode keeps the documented default.
      mode = 'auto';
    } else if (typeof requested === 'string' && THEME_MODES.indexOf(requested.trim().toLowerCase()) !== -1) {
      mode = requested.trim().toLowerCase();
    } else {
      warnings.push('theme:unsupported_mode:' + String(requested).slice(0, 20));
    }

    let inheritHost = source.inheritHost === true;
    if (source.inheritHost !== undefined && typeof source.inheritHost !== 'boolean') {
      warnings.push('theme:invalid_inherit_host');
      inheritHost = false;
    }

    const tokens = normalizeTokenMap(source.tokens, warnings, 'theme.tokens');
    const host = normalizeTokenMap(source.host, warnings, 'theme.host');
    const variables = normalizeThemeVariables(source.variables, warnings);

    if (mode === 'custom' && Object.keys(tokens).length === 0) {
      warnings.push('theme:custom_without_tokens');
    }

    return {
      mode: mode,
      inheritHost: inheritHost,
      tokens: tokens,
      host: host,
      variables: variables,
      warnings: warnings,
    };
  }

  /* ------------------------------------------------------------------ *
   * Contrast utilities (WCAG 2.1 relative luminance)
   * ------------------------------------------------------------------ */

  function expandHex(hex) {
    const body = String(hex).replace('#', '');
    if (body.length === 3 || body.length === 4) {
      return body.slice(0, 3).replace(/./g, function (c) { return c + c; });
    }
    return body.slice(0, 6);
  }

  /** Relative luminance of a `#rgb`/`#rrggbb` colour; `null` for references. */
  function relativeLuminance(color) {
    if (typeof color !== 'string' || !HEX_COLOR.test(color.trim())) return null;
    const body = expandHex(color.trim());
    const channels = [0, 2, 4].map(function (index) {
      const value = parseInt(body.slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  /** WCAG contrast ratio; `null` when either colour is not a plain hex value. */
  function contrastRatio(a, b) {
    const first = relativeLuminance(a);
    const second = relativeLuminance(b);
    if (first === null || second === null) return null;
    const high = Math.max(first, second);
    const low = Math.min(first, second);
    return (high + 0.05) / (low + 0.05);
  }

  /**
   * Pick the most legible foreground for a fill. References (`var(--…)`) and
   * non-hex values keep the provided default because they cannot be measured.
   */
  function bestInk(background, candidates, fallback) {
    const pool = (candidates && candidates.length ? candidates : ['#ffffff', '#0b1220']);
    if (contrastRatio(background, pool[0]) === null) return fallback || pool[0];
    let best = null;
    let bestRatio = -1;
    for (let i = 0; i < pool.length; i += 1) {
      const ratio = contrastRatio(background, pool[i]);
      if (ratio === null) continue;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = pool[i];
      }
      if (ratio >= 4.5) {
        best = pool[i];
        break;
      }
    }
    return best || fallback || pool[0];
  }

  /* ------------------------------------------------------------------ *
   * Host detection (read-only, defensive)
   * ------------------------------------------------------------------ */

  const SCHEME_ATTRIBUTES = ['data-theme', 'data-color-mode', 'data-bs-theme', 'data-scheme', 'data-user-color-scheme'];
  const DARK_CLASSES = ['dark', 'theme-dark', 'dark-mode', 'dark-theme'];
  const LIGHT_CLASSES = ['light', 'theme-light', 'light-mode', 'light-theme'];

  function readElementScheme(element) {
    if (!element) return null;
    // Every read is guarded: a host page may expose a throwing getter here, and
    // theme detection must never be able to break the widget.
    try {
      if (typeof element.getAttribute === 'function') {
        for (let i = 0; i < SCHEME_ATTRIBUTES.length; i += 1) {
          const value = element.getAttribute(SCHEME_ATTRIBUTES[i]);
          if (value === 'dark') return 'dark';
          if (value === 'light') return 'light';
        }
      }
    } catch (error) { /* ignore and keep looking */ }
    try {
      const list = element.classList;
      if (list && typeof list.contains === 'function') {
        for (let i = 0; i < DARK_CLASSES.length; i += 1) {
          if (list.contains(DARK_CLASSES[i])) return 'dark';
        }
        for (let i = 0; i < LIGHT_CLASSES.length; i += 1) {
          if (list.contains(LIGHT_CLASSES[i])) return 'light';
        }
      }
    } catch (error) { /* ignore */ }
    try {
      const inline = element.style && typeof element.style === 'object' ? element.style.colorScheme : '';
      if (typeof inline === 'string' && inline.trim()) {
        const value = inline.trim().toLowerCase();
        if (value === 'dark') return 'dark';
        if (value === 'light') return 'light';
      }
    } catch (error) { /* ignore */ }
    return null;
  }

  function readComputedScheme(context, element) {
    const getStyle = context.getComputedStyle
      || (context.root && typeof context.root.getComputedStyle === 'function' ? context.root.getComputedStyle : null);
    if (!getStyle || !element) return null;
    try {
      const style = getStyle.call(context.root || null, element);
      const declared = style && style.colorScheme;
      if (typeof declared !== 'string') return null;
      const value = declared.trim().toLowerCase();
      // "light dark" means both are supported: the media query decides.
      if (value === 'dark') return 'dark';
      if (value === 'light') return 'light';
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Resolve the host page's light/dark scheme.
   *
   * Order: an explicit `context.hostScheme`, then the host's own scheme signal
   * (`data-theme`, `data-color-mode`, `data-bs-theme`, `data-scheme`, a
   * dark/light class, an inline `color-scheme`), then the computed
   * `color-scheme`, then `prefers-color-scheme`, then light.
   */
  function detectHostScheme(context) {
    const ctx = context || {};
    if (ctx.hostScheme === 'dark' || ctx.hostScheme === 'light') return ctx.hostScheme;

    const doc = ctx.document || (ctx.root && ctx.root.document) || null;
    const element = doc ? (doc.documentElement || null) : null;
    let fromAttributes = null;
    try {
      fromAttributes = readElementScheme(element) || readElementScheme(doc && doc.body);
    } catch (error) { /* ignore */ }
    if (fromAttributes) return fromAttributes;

    const computed = readComputedScheme(ctx, element);
    if (computed) return computed;

    const query = ctx.matchMedia
      || (ctx.root && typeof ctx.root.matchMedia === 'function' ? ctx.root.matchMedia : null);
    if (typeof query === 'function') {
      try {
        const result = query.call(ctx.root || null, '(prefers-color-scheme: dark)');
        if (result && result.matches === true) return 'dark';
        if (result && result.matches === false) return 'light';
      } catch (error) { /* fall through */ }
    }
    return 'light';
  }

  /**
   * Optionally read the host's typography. Only the font stack is inherited:
   * colours come from explicit `theme.host` values, never from a computed style
   * guess, so a host can never drag contrast down silently.
   */
  function detectHostTypography(context) {
    const ctx = context || {};
    const doc = ctx.document || (ctx.root && ctx.root.document) || null;
    if (!doc || !doc.body) return null;
    const getStyle = ctx.getComputedStyle
      || (ctx.root && typeof ctx.root.getComputedStyle === 'function' ? ctx.root.getComputedStyle : null);
    if (!getStyle) return null;
    try {
      const style = getStyle.call(ctx.root || null, doc.body);
      const family = style && typeof style.fontFamily === 'string' ? style.fontFamily : '';
      const normalized = normalizeFontFamily(family);
      return normalized ? { fontFamily: normalized } : null;
    } catch (error) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * Resolution
   * ------------------------------------------------------------------ */

  const INKABLE_TONES = ['primary', 'success', 'info', 'warning', 'error', 'critical'];

  /**
   * Resolve a theme into the values a renderer needs.
   *
   * @param {unknown} themeInput         raw `theme` value or a normalized record
   * @param {object}  [context]          { document, matchMedia, getComputedStyle, root, hostScheme, seedPrimary }
   *
   * `context.seedPrimary` is a validated colour that acts as the lowest-priority
   * primary — it keeps the long-standing `branding.themeColor` behaviour working
   * without letting it override an explicit `theme.tokens.primary`. It is only
   * accepted as a plain colour value.
   * @returns {{
   *   mode: 'auto'|'light'|'dark'|'custom',
   *   scheme: 'light'|'dark',
   *   inheritHost: boolean,
   *   tokens: Record<string, string>,
   *   variables: Record<string, string>,
   *   warnings: string[],
   * }}
   */
  function resolveTheme(themeInput, context) {
    const ctx = context || {};
    // `normalizeTheme` is idempotent: normalizing an already-normalized record
    // returns the same validated values, so callers may pass either shape.
    const theme = normalizeTheme(themeInput);
    const warnings = (theme.warnings || []).slice();

    const mode = THEME_MODES.indexOf(theme.mode) !== -1 ? theme.mode : 'auto';
    const inheritHost = theme.inheritHost === true;

    // Light/Dark never consult the host or the OS. Auto always detects the
    // host's light/dark scheme (that is what `auto` means); `inheritHost` only
    // controls whether host *values* — colours and typography — are adopted on
    // top of the Assistant's own palette. Custom keeps the integrator's palette
    // on a deterministic light foundation.
    let scheme = 'light';
    if (mode === 'dark') scheme = 'dark';
    else if (mode === 'light' || mode === 'custom') scheme = 'light';
    else scheme = detectHostScheme(ctx);

    const base = Object.assign({}, ASSISTANT_PALETTES[scheme]);
    const hostLayer = {};

    if (mode === 'auto' && inheritHost) {
      Object.keys(theme.host || {}).forEach(function (key) { hostLayer[key] = theme.host[key]; });
      if (!hostLayer.fontFamily) {
        const typography = detectHostTypography(ctx);
        if (typography && typography.fontFamily) hostLayer.fontFamily = typography.fontFamily;
      }
    }

    const merged = Object.assign({}, base, hostLayer, theme.tokens || {});
    // `branding.themeColor` remains a supported way to set the project's primary
    // colour. It ranks below any explicit theme token and below host adaptation.
    if (!hostLayer.primary && !(theme.tokens && theme.tokens.primary)) {
      const seed = ctx.seedPrimary === undefined ? null : normalizeColor(ctx.seedPrimary);
      if (seed) {
        // A project brand colour is a *light-scheme* identity value. On a dark
        // surface it is only kept when it is still legible there; otherwise the
        // Assistant's dark-adapted brand is used, which is what keeps a deep
        // brand blue from becoming unreadable on a dark panel.
        const legible = scheme !== 'dark' || (contrastRatio(seed, base.surface) || 0) >= 4.5;
        if (legible) merged.primary = seed;
        else warnings.push('theme:contrast_guard:seedPrimary');
      }
    }

    // --- Contrast guard: never let a host or integrator value reduce
    // readability below the AA floor for body text. The Assistant's own value is
    // restored per token instead of rejecting the whole theme.
    const surface = merged.surface;
    const guards = [
      ['text', base.text, 4.5],
      ['mutedText', base.mutedText, 4.5],
      ['onPrimary', base.onPrimary, 4.5],
    ];
    guards.forEach(function (entry) {
      const key = entry[0];
      const ratio = contrastRatio(merged[key], key === 'onPrimary' ? merged.primary : surface);
      if (ratio !== null && ratio < entry[2]) {
        warnings.push('theme:contrast_guard:' + key);
        merged[key] = entry[1];
      }
    });

    // A border that matches its surface is invisible: restore the Assistant's.
    const borderRatio = contrastRatio(merged.border, surface);
    if (borderRatio !== null && borderRatio < 1.2) {
      warnings.push('theme:contrast_guard:border');
      merged.border = base.border;
    }

    // The font stack always resolves to something concrete, so the renderer can
    // publish it as a variable instead of leaving the CSS default implicit.
    if (!merged.fontFamily) merged.fontFamily = ASSISTANT_FONT_STACK;

    // Tone inks are derived, never trusted: a fill only keeps a white label when
    // white actually clears 4.5:1 against it.
    const variables = {};
    INKABLE_TONES.forEach(function (tone) {
      if (!merged[tone]) return;
      const ink = bestInk(merged[tone], ['#ffffff', '#0b1220', base.text], base.text);
      variables['--youge-' + tone + '-ink'] = ink;
    });

    Object.keys(merged).forEach(function (key) {
      const targets = TOKEN_CSS_VARIABLES[key];
      if (!targets) return;
      targets.forEach(function (name) { variables[name] = merged[key]; });
    });

    // Integrator variables are applied last: they are explicit opt-in overrides
    // of the (validated) token variables, never of layout geometry.
    Object.keys(theme.variables || {}).forEach(function (name) {
      if (PROTECTED_VARIABLES.indexOf(name) === -1) variables[name] = theme.variables[name];
    });

    const tokens = {};
    Object.keys(merged).forEach(function (key) {
      if (merged[key] !== undefined && merged[key] !== null) tokens[key] = merged[key];
    });

    return {
      mode: mode,
      scheme: scheme,
      inheritHost: mode === 'auto' && inheritHost,
      tokens: tokens,
      variables: variables,
      warnings: warnings,
    };
  }

  /**
   * Convert a resolved theme into `style` assignments for a DOM node.
   * Only `--youge-*` custom properties are ever produced.
   */
  function themeToCssVariables(resolved) {
    const out = {};
    const source = resolved && resolved.variables ? resolved.variables : {};
    Object.keys(source).forEach(function (name) {
      if (/^--youge-[a-z0-9-]+$/.test(name) && isSafeCssValue(source[name], 160)) {
        out[name] = source[name];
      }
    });
    return out;
  }

  /* --- domain/index.js --- */

  const DOMAIN_DEFAULTS = {
    language: 'auto',
    identity: {
      name: 'You.Ge Assistant',
      shortName: 'You.Ge',
      description: 'Your installable, offline-ready web assistant.',
    },
    branding: {
      themeColor: '#155eef',
      backgroundColor: '#f8fafc',
      iconSet: 'default',
      icon: 'icons/icon-192.png',
      appleTouchIcon: 'icons/apple-touch-icon.png',
      splashIcon: 'icons/icon-512.png',
      favicon: 'icons/favicon-32.png',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    pwa: {
      enabled: true,
      startUrl: './?launchedfrom=homescreen',
      scope: './',
      display: 'standalone',
      id: './',
    },
    features: {
      installation: true,
      offline: true,
      sharing: true,
      push: true,
      badges: true,
      qr: true,
      diagnostics: true,
      dnsRecovery: true,
    },
    installExperience: clone(INSTALL_EXPERIENCE_DEFAULTS),
    instructions: {},
    metadata: {},
    project: null,
  };

  const KNOWN_COMPOUND_SUFFIXES = {
    'co.uk': true, 'org.uk': true, 'ac.uk': true, 'gov.uk': true,
    'com.au': true, 'net.au': true, 'org.au': true,
    'co.nz': true, 'com.br': true, 'com.cn': true, 'com.sg': true,
    'co.jp': true, 'co.in': true, 'com.tr': true, 'com.mx': true,
  };

  const VALID_HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i;
  const VALID_COLOR_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const VALID_COLOR_FUNCTION = /^(?:rgba?|hsla?)\([\d\s.,%]+\)$/i;
  const CSS_COLOR_NAMES = new Set(('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor').split(/\s+/));
  const META_KEYS = {
    'og:title': true, 'og:description': true, 'og:image': true, 'og:type': true,
    'og:site_name': true, 'og:url': true, 'twitter:card': true, 'twitter:title': true,
    'twitter:description': true, 'twitter:image': true,
  };

  function isValidIpv4(hostname) {
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
    return hostname.split('.').every(function (part) {
      const octet = Number(part);
      return octet >= 0 && octet <= 255;
    });
  }

  function isValidIpv6(hostname) {
    if (!/^\[[0-9a-f:.]+\]$/i.test(hostname)) return false;
    try {
      return new URL('http://' + hostname).hostname.toLowerCase() === hostname.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Normalize a runtime host, host:port value or absolute URL to a hostname.
   * URL parsing also canonicalizes IDNs and IPv6; ports, paths, case and a final
   * DNS dot are not part of the returned host. Unsupported protocols and invalid
   * host syntax produce an empty string rather than a misleading match.
   */
  function normalizeHost(value) {
    const raw = String(value == null ? '' : value).trim();
    if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) return '';

    let candidate = raw;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
      // Keep explicit protocols so ftp:, file: and other schemes are rejected.
    } else if (candidate.slice(0, 2) === '//') {
      candidate = 'https:' + candidate;
    } else {
      // A bare IPv6 address must be bracketed before URL can distinguish it from
      // a hostname and port. Bracketed IPv6 with a port already parses directly.
      if (candidate.indexOf(':') !== -1 && candidate.charAt(0) !== '[' &&
          /^[0-9a-f:.]+$/i.test(candidate) && !/^[^:]+:\d{1,5}$/.test(candidate)) {
        candidate = '[' + candidate + ']';
      }
      candidate = 'http://' + candidate;
    }

    try {
      const url = new URL(candidate);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      if (url.username || url.password) return '';
      const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
      if (!hostname) return '';
      if (hostname.charAt(0) === '[') return isValidIpv6(hostname) ? hostname : '';
      if (isValidIpv4(hostname) || VALID_HOST.test(hostname)) return hostname;
      return '';
    } catch (error) {
      return '';
    }
  }
  function detectRuntimeHostname(locationLike) {
    let location = locationLike;
    if (!location) {
      try { location = typeof globalThis !== 'undefined' ? globalThis.location : null; }
      catch (error) { location = null; }
    }
    if (typeof location === 'string') return normalizeHost(location);
    if (!location || typeof location !== 'object') return '';
    for (const key of ['hostname', 'host', 'href', 'origin']) {
      let value;
      try { value = location[key]; }
      catch (error) { continue; }
      const hostname = normalizeHost(value);
      if (hostname) return hostname;
    }
    return '';
  }
  function isIpAddress(hostname) {
    const host = normalizeHost(hostname);
    return Boolean(host && (host.charAt(0) === '[' ? isValidIpv6(host) : isValidIpv4(host)));
  }
  function rootDomain(hostname) {
    const host = normalizeHost(hostname);
    if (!host || host === 'localhost' || isIpAddress(host) || host.indexOf('.') === -1) return host;
    if (host.endsWith('.localhost')) return 'localhost';
    const labels = host.split('.');
    const lastTwo = labels.slice(-2).join('.');
    const count = KNOWN_COMPOUND_SUFFIXES[lastTwo] ? 3 : 2;
    return labels.length <= count ? host : labels.slice(-count).join('.');
  }
  function normalizePath(value, fallback) {
    const path = String(value || fallback || '/').trim();
    if (!path || path.charAt(0) !== '/' || path.charAt(1) === '/' || /[?#]/.test(path)) return null;
    if (path.indexOf('\\') !== -1 || /[\u0000-\u001f]/.test(path)) return null;
    const normalized = path.replace(/\/+/g, '/');
    const parts = normalized.split('/');
    if (parts.some(function (part) {
      try {
        const decoded = decodeURIComponent(part);
        return decoded === '.' || decoded === '..' || decoded.indexOf('/') !== -1 || decoded.indexOf(String.fromCharCode(92)) !== -1 || /[%\u0000-\u001f\u007f]/.test(decoded);
      } catch (error) {
        return true;
      }
    })) return null;
    return normalized.charAt(normalized.length - 1) === '/' ? normalized : normalized + '/';
  }

  const NAVIGATION_SCHEME = /^([a-z][a-z0-9+.-]*):/i;

  /**
   * Validate a navigation target that came from page markup or a push payload.
   *
   * Push payloads and host attributes are data, not instructions: this keeps only
   * http(s) absolute URLs and root/relative paths, and rejects script-capable
   * schemes (`javascript:`, `data:`, `blob:`, `filesystem:`), control characters
   * that URL parsers strip (`javascript\u0000:`), and network-path forms such as
   * `//evil.example` or `\evil.example`. Anything unsafe yields the fallback.
   */
  function safeNavigationUrl(value, fallback) {
    const safeFallback = typeof fallback === 'string' && fallback ? fallback : '/';
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return safeFallback;
    const scheme = NAVIGATION_SCHEME.exec(raw);
    if (scheme) {
      const name = scheme[1].toLowerCase();
      return name === 'http' || name === 'https' ? raw : safeFallback;
    }
    const authority = raw.split(/[?#]/)[0];
    if (authority.indexOf('\\') !== -1) return safeFallback;
    if (raw.charAt(0) === '/' && raw.charAt(1) === '/') return safeFallback;
    return raw;
  }

  function isRecord(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  const DIAGNOSTICS_PROBE_KEYS = ['appProbePath', 'backendProbePath'];

  /**
   * Diagnostics probes run same-origin without credentials, so a configured path
   * must stay a plain relative or root-relative path: cross-origin URLs, network
   * paths (`//host`), script schemes, backslashes and `..` traversal are rejected.
   */
  function safeDiagnosticsProbePath(value, basePath) {
    if (typeof value !== 'string' || !value || value.trim() !== value ||
        /[\u0000-\u001f\u007f\\]/.test(value) || /^(?:[a-z][a-z0-9+.-]*:|\/\/|[?#])/i.test(value)) return false;
    var path = value.split(/[?#]/)[0];
    try {
      if (path.split('/').some(function (part) {
        var decoded = decodeURIComponent(part);
        return decoded === '..' || /[\/\\%\u0000-\u001f\u007f]/.test(decoded);
      })) return false;
      var base = new URL(basePath || '/', 'https://diagnostics.invalid');
      var resolved = new URL(value, base);
      return resolved.origin === base.origin && resolved.pathname.indexOf(base.pathname) === 0;
    } catch (error) { return false; }
  }
  function sanitizeDiagnosticsConfig(value, basePath) {
    const safe = {};
    if (!isRecord(value)) return safe;
    Object.keys(value).forEach(function (key) {
      if (DIAGNOSTICS_PROBE_KEYS.indexOf(key) === -1) safe[key] = clone(value[key]);
    });
    DIAGNOSTICS_PROBE_KEYS.forEach(function (key) {
      if (safeDiagnosticsProbePath(value[key], basePath)) safe[key] = value[key];
    });
    return safe;
  }

  function isValidColor(value) {
    const color = String(value == null ? '' : value).trim().toLowerCase();
    return VALID_COLOR_HEX.test(color) || VALID_COLOR_FUNCTION.test(color) || CSS_COLOR_NAMES.has(color);
  }
  function validateDomainConfig(raw) {
    const safeInput = isRecord(raw) ? raw : {};
    const config = merge(clone(DOMAIN_DEFAULTS), {
      language: safeInput.language,
      identity: safeInput.identity,
      branding: safeInput.branding,
      pwa: safeInput.pwa,
      features: safeInput.features,
      instructions: safeInput.instructions,
      metadata: safeInput.metadata,
      shortcuts: safeInput.shortcuts,
      diagnostics: safeInput.diagnostics,
      installExperience: safeInput.installExperience,
      project: safeInput.project,
    });

    ['identity', 'branding', 'pwa', 'features', 'installExperience', 'instructions', 'metadata', 'diagnostics'].forEach(function (key) {
      if (!isRecord(config[key])) config[key] = clone(DOMAIN_DEFAULTS[key] || {});
    });

    const rawLanguage = safeInput.language !== undefined
      ? safeInput.language
      : (isRecord(safeInput.identity) && safeInput.identity.language !== undefined ? safeInput.identity.language : 'auto');
    config.language = normalizeInstallLocale(rawLanguage, DOMAIN_DEFAULTS.language);

    if (safeInput.project && typeof safeInput.project === 'object' && !Array.isArray(safeInput.project)) {
      const projectId = safeText(safeInput.project.id, 80).trim();
      config.project = projectId ? { id: projectId } : null;
    } else {
      config.project = null;
    }

    if (typeof config.identity.name !== 'string' || !config.identity.name.trim()) {
      config.identity.name = DOMAIN_DEFAULTS.identity.name;
    }
    if (typeof config.identity.shortName !== 'string' || !config.identity.shortName.trim()) {
      config.identity.shortName = DOMAIN_DEFAULTS.identity.shortName;
    }
    if (typeof config.identity.description !== 'string') {
      config.identity.description = DOMAIN_DEFAULTS.identity.description;
    }

    const safeMetadata = {};
    if (config.metadata && typeof config.metadata === 'object' && !Array.isArray(config.metadata)) {
      Object.keys(config.metadata).forEach(function (key) {
        const value = config.metadata[key];
        if (META_KEYS[key.toLowerCase()] && typeof value === 'string') {
          safeMetadata[key.toLowerCase()] = value.replace(/[\u0000-\u001f]/g, '').slice(0, 512);
        }
      });
    }
    config.metadata = safeMetadata;

    if (config.pwa.basePath != null) config.pwa.basePath = normalizePath(config.pwa.basePath, '/') || null;
    if (!isValidColor(config.branding.themeColor)) config.branding.themeColor = DOMAIN_DEFAULTS.branding.themeColor;
    if (!isValidColor(config.branding.backgroundColor)) config.branding.backgroundColor = DOMAIN_DEFAULTS.branding.backgroundColor;

    config.pwa.scope = String(config.pwa.scope || './');
    if (config.pwa.scope.charAt(0) === '/') config.pwa.scope = normalizePath(config.pwa.scope, '/') || './';
    else if (!/^\.{1,2}\/?$/.test(config.pwa.scope) || config.pwa.scope.indexOf('..') !== -1) config.pwa.scope = './';

    config.pwa.startUrl = String(config.pwa.startUrl || './');
    config.pwa.id = String(config.pwa.id || './');
    if (!safeRelativeUrl(config.pwa.startUrl)) config.pwa.startUrl = './';
    if (!safeRelativeUrl(config.pwa.id)) config.pwa.id = './';

    ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
      if (typeof config.branding[key] !== 'string' || !safeRelativeUrl(config.branding[key]) || /^\s*(?:javascript|data|blob):/i.test(config.branding[key])) {
        config.branding[key] = DOMAIN_DEFAULTS.branding[key];
      }
    });

    if (!/^(standalone|fullscreen|minimal-ui|browser)$/.test(config.pwa.display)) config.pwa.display = 'standalone';
    if (!Array.isArray(config.branding.icons) || !config.branding.icons.length) {
      config.branding.icons = clone(DOMAIN_DEFAULTS.branding.icons);
    }
    config.branding.icons = config.branding.icons.filter(function (icon) {
      return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) &&
        !/^\s*(?:javascript|data|blob):/i.test(icon.src) &&
        typeof icon.sizes === 'string' && /^\d+x\d+(?:\s+\d+x\d+)*$/.test(icon.sizes);
    });
    if (!config.branding.icons.length) config.branding.icons = clone(DOMAIN_DEFAULTS.branding.icons);

    config.shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.filter(function (shortcut) {
      return shortcut && typeof shortcut.name === 'string' && shortcut.name.trim() &&
        typeof shortcut.url === 'string' && safeRelativeUrl(shortcut.url);
    }).map(function (shortcut) {
      const safe = { name: shortcut.name, url: shortcut.url };
      if (typeof shortcut.short_name === 'string') safe.short_name = shortcut.short_name;
      if (typeof shortcut.description === 'string') safe.description = shortcut.description;
      if (Array.isArray(shortcut.icons)) {
        safe.icons = shortcut.icons.filter(function (icon) {
          return icon && typeof icon.src === 'string' && safeRelativeUrl(icon.src) && typeof icon.sizes === 'string';
        }).map(function (icon) {
          return { src: icon.src, sizes: icon.sizes, type: icon.type || 'image/png' };
        });
      }
      return safe;
    }) : [];

    config.diagnostics = sanitizeDiagnosticsConfig(config.diagnostics, config.pwa.basePath || '/');
    config.installExperience = normalizeInstallExperience(safeInput.installExperience, DOMAIN_DEFAULTS.installExperience);

    config.features = merge(clone(DOMAIN_DEFAULTS.features), config.features || {});
    Object.keys(DOMAIN_DEFAULTS.features).forEach(function (key) {
      config.features[key] = config.features[key] !== false;
    });
    config.pwa.enabled = config.pwa.enabled !== false;
    return config;
  }

  function domainIssue(code, path, message) {
    return { code: code, path: path, message: message };
  }
  function validateDomainConfigDetailed(raw) {
    const issues = [];
    const add = function (code, path, message) {
      if (!issues.some(function (issue) { return issue.code === code && issue.path === path; })) {
        issues.push(domainIssue(code, path, message));
      }
    };

    try {
      if (raw !== undefined && raw !== null && !isRecord(raw)) {
        add('invalid_domain_config', 'config', 'Domain configuration must be a plain object.');
      }
      const source = isRecord(raw) ? raw : {};
      if (source.project !== undefined && source.project !== null) {
        const projectId = isRecord(source.project) ? source.project.id : undefined;
        const normalizedProjectId = typeof projectId === 'string' ? safeText(projectId, 80).trim() : '';
        if (typeof projectId !== 'string' || !normalizedProjectId || projectId.length > 80 || normalizedProjectId !== projectId.trim()) {
          add('invalid_project_id', 'project.id', 'Project configuration requires a non-empty, safe string id of at most 80 characters.');
        }
      }

      if (source.language !== undefined) {
        const cleanedLang = typeof source.language === 'string' ? source.language.trim().replace(/_/g, '-') : '';
        const validLang = typeof source.language === 'string' &&
          (cleanedLang.toLowerCase() === 'auto' || /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(cleanedLang));
        if (!validLang) {
          add('invalid_language', 'language', 'Language must be "auto" or a valid BCP-47 language tag.');
        }
      }

      if (source.identity !== undefined && !isRecord(source.identity)) {
        add('invalid_identity', 'identity', 'Identity configuration must be an object.');
      } else if (isRecord(source.identity)) {
        ['name', 'shortName'].forEach(function (key) {
          if (source.identity[key] !== undefined && (typeof source.identity[key] !== 'string' || !source.identity[key].trim())) {
            add('invalid_identity_field', 'identity.' + key, 'Identity labels must be non-empty strings.');
          }
        });
        if (source.identity.description !== undefined && typeof source.identity.description !== 'string') {
          add('invalid_identity_field', 'identity.description', 'Identity description must be a string.');
        }
      }

      if (source.branding !== undefined && !isRecord(source.branding)) {
        add('invalid_branding', 'branding', 'Branding configuration must be an object.');
      } else if (isRecord(source.branding)) {
        ['themeColor', 'backgroundColor'].forEach(function (key) {
          if (source.branding[key] !== undefined && !isValidColor(source.branding[key])) {
            add(key === 'themeColor' ? 'invalid_theme_color' : 'invalid_background_color', 'branding.' + key,
              'Color must be a supported CSS color token.');
          }
        });
        ['icon', 'appleTouchIcon', 'splashIcon', 'favicon'].forEach(function (key) {
          const value = source.branding[key];
          if (value !== undefined && (typeof value !== 'string' || !safeRelativeUrl(value) || /^\s*(?:javascript|data|blob):/i.test(value))) {
            add('unsafe_icon_url', 'branding.' + key, 'Icon URLs must be safe same-origin relative paths.');
          }
        });
      }

      if (source.pwa !== undefined && !isRecord(source.pwa)) {
        add('invalid_pwa_config', 'pwa', 'PWA configuration must be an object.');
      } else if (isRecord(source.pwa)) {
        if (source.pwa.basePath !== undefined && source.pwa.basePath !== null && !normalizePath(source.pwa.basePath, '/')) {
          add('invalid_base_path', 'pwa.basePath', 'Base path must be an absolute path without traversal segments.');
        }
        if (source.pwa.scope !== undefined) {
          const scope = typeof source.pwa.scope === 'string' ? source.pwa.scope : '';
          const validScope = scope.charAt(0) === '/'
            ? Boolean(normalizePath(scope, '/'))
            : /^\.{1,2}\/?$/.test(scope) && scope.indexOf('..') === -1;
          if (!validScope) add('invalid_scope', 'pwa.scope', 'Scope must be ./ or a safe absolute application path.');
        }
        ['startUrl', 'id'].forEach(function (key) {
          const value = source.pwa[key];
          if (value !== undefined && (typeof value !== 'string' || !safeRelativeUrl(value))) {
            add(key === 'startUrl' ? 'unsafe_start_url' : 'unsafe_manifest_id', 'pwa.' + key,
              'Manifest URL values must be safe relative paths and cannot escape the application scope.');
          }
        });
        if (source.pwa.display !== undefined && !/^(standalone|fullscreen|minimal-ui|browser)$/.test(String(source.pwa.display))) {
          add('invalid_display_mode', 'pwa.display', 'Display mode must be standalone, fullscreen, minimal-ui or browser.');
        }
      }

      if (source.features !== undefined && !isRecord(source.features)) {
        add('invalid_features', 'features', 'Feature flags must be an object of booleans.');
      } else if (isRecord(source.features)) {
        Object.keys(source.features).sort().forEach(function (key) {
          if (typeof source.features[key] !== 'boolean') {
            add('invalid_feature_flag', 'features.' + key, 'Feature flags must use boolean values.');
          }
        });
      }

      if (source.diagnostics !== undefined && !isRecord(source.diagnostics)) {
        add('invalid_diagnostics', 'diagnostics', 'Diagnostics configuration must be an object of safe probe paths.');
      } else if (isRecord(source.diagnostics)) {
        DIAGNOSTICS_PROBE_KEYS.forEach(function (key) {
          const value = source.diagnostics[key];
          if (value !== undefined && !safeDiagnosticsProbePath(value, (source.pwa && normalizePath(source.pwa.basePath, '/')) || '/')) {
            add('invalid_diagnostics_probe', 'diagnostics.' + key,
              'Diagnostics probe paths must be safe same-origin relative or root-relative paths.');
          }
        });
      }

      if (source.installExperience !== undefined) {
        inspectInstallExperienceIssues(source.installExperience, 'installExperience').forEach(function (issue) {
          add(issue.code, issue.path, issue.message);
        });
      }
    } catch (error) {
      add('invalid_domain_config', 'config', 'Domain configuration could not be read safely.');
    }

    let config;
    try {
      config = validateDomainConfig(raw);
    } catch (error) {
      add('invalid_domain_config', 'config', 'Domain configuration could not be normalized safely.');
      config = validateDomainConfig(null);
    }
    return { valid: issues.length === 0, config: config, issues: issues };
  }

  function isRegistryHostname(hostname) {
    const host = normalizeHost(hostname);
    return Boolean(host && (isIpAddress(host) || VALID_HOST.test(host)));
  }

  function normalizeRegistryKey(key) {
    if (typeof key !== 'string') return { valid: false, code: 'invalid_registry_key' };
    const raw = key.trim();
    if (!raw || /[\u0000-\u0020\u007f\\?#]/.test(raw)) return { valid: false, code: 'invalid_registry_key' };

    const slash = raw.indexOf('/');
    const rawPattern = slash === -1 ? raw : raw.slice(0, slash);
    const hasPath = slash !== -1;
    const wildcard = rawPattern.slice(0, 2) === '*.';
    const host = normalizeHost(wildcard ? rawPattern.slice(2) : rawPattern);
    if (!host || !isRegistryHostname(host) || (wildcard && isIpAddress(host))) {
      return { valid: false, code: 'invalid_registry_key' };
    }

    let path = null;
    if (hasPath) {
      path = normalizePath(raw.slice(slash), null);
      if (!path) return { valid: false, code: 'invalid_registry_path' };
    }

    const hostPattern = (wildcard ? '*.' : '') + host;
    return {
      valid: true,
      key: hostPattern + (path || ''),
      hostPattern: hostPattern,
      path: path,
    };
  }
  function validateDomainRegistry(raw) {
    const registry = {};
    const issues = [];
    const add = function (code, path, message) {
      issues.push(domainIssue(code, path, message));
    };

    if (raw !== undefined && raw !== null && !isRecord(raw)) {
      add('invalid_registry', 'registry', 'Domain registry must be an object keyed by host patterns and optional paths.');
      return { valid: false, registry: registry, issues: issues };
    }
    const source = isRecord(raw) ? raw : {};
    let keys;
    try {
      keys = Object.keys(source).sort();
    } catch (error) {
      add('invalid_registry', 'registry', 'Domain registry keys could not be read safely.');
      return { valid: false, registry: registry, issues: issues };
    }

    keys.forEach(function (key) {
      const normalized = normalizeRegistryKey(key);
      if (!normalized.valid) {
        const code = normalized.code;
        add(code, 'registry.' + key, code === 'invalid_registry_path'
          ? 'Registry path must be absolute and cannot contain traversal or encoded separators.'
          : 'Registry key must be a valid hostname, IP literal or leading-wildcard hostname, optionally followed by a safe path.');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(registry, normalized.key)) {
        add('duplicate_registry_key', 'registry.' + key,
          'This key normalizes to an entry already declared as ' + normalized.key + '.');
        return;
      }

      let rawEntry;
      try {
        rawEntry = source[key];
      } catch (error) {
        add('invalid_domain_config', 'registry.' + normalized.key, 'Registry entry could not be read safely.');
        return;
      }
      const checked = validateDomainConfigDetailed(rawEntry);
      registry[normalized.key] = checked.config;
      checked.issues.forEach(function (issue) {
        add(issue.code, 'registry.' + normalized.key + (issue.path ? '.' + issue.path : ''), issue.message);
      });
    });

    return { valid: issues.length === 0, registry: registry, issues: issues };
  }

  function hostPatternMatches(pattern, hostname) {
    const host = normalizeHost(hostname);
    if (pattern.slice(0, 2) !== '*.') {
      return pattern === host && isRegistryHostname(pattern)
        ? { exact: true, specificity: pattern.length }
        : null;
    }
    const suffix = pattern.slice(2);
    if (!isRegistryHostname(suffix) || isIpAddress(suffix) || host === suffix ||
        host.slice(-(suffix.length + 1)) !== '.' + suffix) return null;
    return { exact: false, specificity: suffix.length };
  }

  function compareRegistryEntries(a, b) {
    if (a.pathLength !== b.pathLength) return b.pathLength - a.pathLength;
    if (a.specificity !== b.specificity) return b.specificity - a.specificity;
    if (a.normalizedKey !== b.normalizedKey) return a.normalizedKey < b.normalizedKey ? -1 : 1;
    if (a.key !== b.key) return a.key < b.key ? -1 : 1;
    return 0;
  }

  function registryEntry(hostname, pathname, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    let keys;
    try {
      keys = Object.keys(source);
    } catch (error) {
      return null;
    }
    const currentPath = String(pathname || '/');
    const candidates = [];
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const normalized = normalizeRegistryKey(key);
      if (!normalized.valid) continue;
      const hostMatch = hostPatternMatches(normalized.hostPattern, hostname);
      if (!hostMatch) continue;
      if (normalized.path && currentPath !== normalized.path.slice(0, -1) && !currentPath.startsWith(normalized.path)) continue;
      let value;
      try {
        value = source[key];
      } catch (error) {
        continue;
      }
      candidates.push({
        key: key,
        normalizedKey: normalized.key,
        value: value,
        exact: hostMatch.exact,
        specificity: hostMatch.specificity,
        pathLength: normalized.path ? normalized.path.length : 0,
      });
    }

    function best(entries) {
      entries.sort(compareRegistryEntries);
      return entries.length ? entries[0] : null;
    }

    return best(candidates.filter(function (entry) { return entry.exact && entry.pathLength > 0; })) ||
      best(candidates.filter(function (entry) { return entry.exact && entry.pathLength === 0; })) ||
      best(candidates.filter(function (entry) { return !entry.exact && entry.pathLength > 0; })) ||
      best(candidates.filter(function (entry) { return !entry.exact && entry.pathLength === 0; }));
  }

  function isDevelopmentHost(hostname) {
    const host = normalizeHost(hostname);
    return Boolean(host && (host === 'localhost' || host.endsWith('.localhost') || isIpAddress(host)));
  }

  function parseLocationString(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return {};
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const isNetworkPath = raw.slice(0, 2) === '//';
    let candidate = raw;
    if (isNetworkPath) {
      candidate = 'https:' + raw;
    } else if (!hasScheme) {
      let authority = raw;
      const normalized = normalizeHost(raw);
      if (normalized.charAt(0) === '[' && raw.charAt(0) !== '[' && !/[/?#]/.test(raw)) authority = normalized;
      candidate = 'https://' + authority;
    }

    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { hostname: '' };
      const hostname = normalizeHost(url.hostname);
      if (!hostname) return { hostname: '' };
      let protocol = url.protocol;
      if (!hasScheme && !isNetworkPath && isDevelopmentHost(hostname)) protocol = 'http:';
      const origin = new URL(protocol + '//' + url.host).origin;
      return {
        hostname: hostname,
        origin: origin,
        protocol: protocol,
        pathname: url.pathname || '/',
        port: url.port,
        href: origin + (url.pathname || '/') + url.search + url.hash,
      };
    } catch (error) {
      return { hostname: normalizeHost(raw) };
    }
  }

  function normalizedLocation(locationLike) {
    if (typeof locationLike === 'string') return parseLocationString(locationLike);
    let fallback = {};
    try {
      fallback = typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location : {};
    } catch (error) { /* use an empty location */ }
    const location = locationLike || fallback;
    if (!location || typeof location !== 'object') return {};
    let parsed = {};
    try {
      if (typeof location.href === 'string' && location.href) parsed = parseLocationString(location.href);
      else if (typeof location.origin === 'string' && location.origin && location.origin !== 'null') parsed = parseLocationString(location.origin);
      else if (!location.hostname && typeof location.host === 'string') parsed = parseLocationString(location.host);
    } catch (error) { /* fall back to any safely-readable properties */ }
    try { return Object.assign({}, parsed, location); }
    catch (error) { return parsed; }
  }

  function normalizedPort(value) {
    const port = String(value == null ? '' : value).replace(/^:/, '');
    if (!port) return '';
    if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) return '';
    return port;
  }
  function resolveDomain(locationLike, optionalRegistry) {
    const location = normalizedLocation(locationLike);
    const hostname = detectRuntimeHostname(location) || 'localhost';
    let protocol = String(location.protocol || 'https:').toLowerCase();
    let origin;
    try {
      const port = normalizedPort(location.port);
      const hostAndPort = hostname + (port ? ':' + port : '');
      origin = location.origin && location.origin !== 'null'
        ? location.origin
        : new URL(protocol + '//' + hostAndPort).origin;
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== 'https:' && parsedOrigin.protocol !== 'http:') throw new Error('unsupported protocol');
      if (normalizeHost(parsedOrigin.hostname) !== hostname) throw new Error('origin hostname mismatch');
      origin = parsedOrigin.origin;
      protocol = parsedOrigin.protocol;
    } catch (error) {
      protocol = protocol === 'http:' || protocol === 'https:' ? protocol : 'https:';
      const safeHost = normalizeHost(hostname) || 'localhost';
      const port = normalizedPort(location.port);
      try {
        origin = new URL(protocol + '//' + safeHost + (port ? ':' + port : '')).origin;
      } catch (fallbackError) {
        protocol = 'https:';
        origin = 'https://localhost';
      }
    }

    let pathname = String(location.pathname || '/');
    if (pathname.charAt(0) !== '/') pathname = '/';
    const fallbackRegistry = typeof globalThis !== 'undefined' && globalThis.YOU_GE_DOMAIN_REGISTRY
      ? globalThis.YOU_GE_DOMAIN_REGISTRY
      : {};
    const source = optionalRegistry || fallbackRegistry;
    const entry = registryEntry(hostname, pathname, source);
    const validation = validateDomainConfigDetailed(entry ? entry.value : null);
    const config = validation.config;
    let basePath = normalizePath(config.pwa.basePath || location.basePath || '/', '/');
    if (!basePath) basePath = '/';
    const domain = rootDomain(hostname);
    const subdomain = hostname === domain ? '' : hostname.slice(0, -(domain.length + 1));

    config.domain = {
      hostname: hostname,
      origin: origin,
      protocol: protocol,
      subdomain: subdomain,
      rootDomain: domain,
      pathname: pathname,
      basePath: basePath,
      installOrigin: origin,
      matchedRegistryKey: entry ? entry.key : null,
      configured: Boolean(entry),
      projectId: config.project ? config.project.id : null,
      validation: { valid: validation.valid, issues: clone(validation.issues) },
    };
    return config;
  }
  function buildManifest(config) {
    const resolved = config || resolveDomain();
    const pwa = resolved.pwa;
    const branding = resolved.branding;
    const manifestBase = new URL('manifest.webmanifest', new URL(resolved.domain.basePath, resolved.domain.origin));
    const appScope = new URL(pwa.scope, manifestBase);
    const shortcuts = (resolved.shortcuts || []).filter(function (shortcut) {
      try {
        const destination = new URL(shortcut.url, manifestBase);
        return destination.origin === appScope.origin && destination.pathname.startsWith(appScope.pathname);
      } catch (error) {
        return false;
      }
    });
    const output = {
      id: pwa.id,
      name: resolved.identity.name,
      short_name: resolved.identity.shortName,
      description: resolved.identity.description,
      start_url: pwa.startUrl,
      scope: pwa.scope,
      display: resolved.pwa.enabled === false || resolved.features.installation === false ? 'browser' : pwa.display,
      theme_color: branding.themeColor,
      background_color: branding.backgroundColor,
      dir: 'auto',
      icons: clone(branding.icons),
      categories: ['utilities', 'productivity'],
      prefer_related_applications: false,
      shortcuts: clone(shortcuts),
      share_target: {
        action: new URL('share-target', new URL(resolved.domain.basePath, resolved.domain.origin)).pathname,
        method: 'POST',
        enctype: 'multipart/form-data',
        params: {
          title: 'title',
          text: 'text',
          url: 'url',
          files: [{ name: 'file', accept: ['image/*', 'video/*', 'audio/*', 'text/plain', 'application/pdf'] }],
        },
      },
    };
    if (resolved.features.sharing === false) delete output.share_target;
    if (resolved.language && resolved.language !== 'auto') output.lang = resolved.language;
    return output;
  }

  function cloneRegistry(raw) {
    if (!isRecord(raw)) return {};
    try {
      return clone(raw);
    } catch (error) {
      return {};
    }
  }
  function createDomainResolver(initialRegistry) {
    let registry = cloneRegistry(initialRegistry);
    return {
      defaults: clone(DOMAIN_DEFAULTS),
      resolve: function (locationLike, overrideRegistry) {
        return resolveDomain(locationLike, overrideRegistry || registry);
      },
      manifest: function (config) {
        return buildManifest(config || resolveDomain(undefined, registry));
      },
      normalizeHost: normalizeHost,
      detectRuntimeHostname: detectRuntimeHostname,
      normalizePath: normalizePath,
      rootDomain: rootDomain,
      safeNavigationUrl: safeNavigationUrl,
      validateConfig: validateDomainConfig,
      validateConfigDetailed: validateDomainConfigDetailed,
      validateRegistry: validateDomainRegistry,
      setRegistry: function (nextRegistry) {
        registry = cloneRegistry(nextRegistry);
      },
      getRegistry: function () {
        return cloneRegistry(registry);
      },
    };
  }

  /* --- config/index.js --- */

  const BUNDLED_DEFAULTS = {
    enabled: true,
    project: null,
    projectId: '',
    domain: '',
    locale: 'auto',
    position: 'bottom-right',
    offsets: { x: 20, y: 20 },
    modules: {
      installation: true,
      diagnostics: true,
      recovery: true,
      failover: true,
      help: true,
      updates: true,
      chromeHandoff: true,
      installationDetection: true,
      installationGuidance: true,
      updateDetection: true,
      updateNotifications: true,
      autoUpdate: true,
      userUpdate: true,
      offlineDiagnostics: true,
      cacheDiagnostics: true,
    },
    notifications: {
      dismissible: true,
      suppressRepeats: true,
      criticalPersistent: true,
    },
    branding: {
      name: '',
      shortName: '',
      icon: '',
      themeColor: '',
    },
    actions: [],
    features: [],
    installExperience: clone(INSTALL_EXPERIENCE_DEFAULTS),
    // The documented public shape of `theme`. It is resolved into a stable record
    // by `src/theme/index.js`; the flat `themeMode` string preserves the original
    // 0.x `theme: 'auto' | 'light' | 'dark'` contract for `getConfig().theme`.
    theme: {
      mode: 'auto',
      inheritHost: false,
      tokens: {},
      host: {},
      variables: {},
    },
    themeMode: 'auto',
  };
  function normalizeActions(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.slice(0, 20).map(function (entry) {
      if (!entry || typeof entry !== 'object') return null;
      if (isExecutableString(entry.id) || isExecutableString(entry.label) || isExecutableString(entry.message)) return null;
      const id = safeText(entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id: id,
        label: safeText(entry.label, 60) || id,
        message: safeText(entry.message, 200),
        icon: ICONS.indexOf(entry.icon) !== -1 ? entry.icon : 'custom',
        priority: clampNumber(entry.priority, PRIORITY.info, 1, 5),
        kind: entry.kind === 'help' ? 'help' : 'custom',
        event: 'youge:action',
      };
    }).filter(Boolean);
  }
  function normalizeFeatures(raw) {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.slice(0, 20).map(function (entry) {
      if (!entry || typeof entry !== 'object') return null;
      if (isExecutableString(entry.id) || isExecutableString(entry.label) || isExecutableString(entry.message)) return null;
      const id = safeText(entry.id, 60).replace(/[^a-zA-Z0-9:_-]/g, '');
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id: id,
        label: safeText(entry.label, 60) || id,
        message: safeText(entry.message, 200),
      };
    }).filter(Boolean);
  }

  function normalizeProjectConfig(raw) {
    if (raw === null) return null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const rawId = raw.id;
    if (typeof rawId !== 'string') return null;
    const id = safeText(rawId, 80).trim();
    return id && rawId.length <= 80 && id === rawId.trim() ? { id: id } : null;
  }

  function parseSchemaMajor(version) {
    if (version === undefined || version === null) return SCHEMA_VERSION;
    if (typeof version === 'number') {
      return Number.isInteger(version) ? version : -1;
    }
    if (typeof version === 'string') {
      const match = /^(\d+)(?:\.\d+){0,2}$/.exec(version.trim());
      return match ? Number(match[1]) : -1;
    }
    return -1;
  }

  function extractLayerOverrides(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const out = {};

    if (source.enabled !== undefined) out.enabled = source.enabled !== false;
    if (source.project !== undefined) out.project = normalizeProjectConfig(source.project);
    if (source.projectId !== undefined) out.projectId = safeText(source.projectId, 80);
    if (typeof source.domain === 'string') out.domain = safeText(source.domain, 253);
    if (source.locale !== undefined) {
      const cleanedLocale = typeof source.locale === 'string' ? source.locale.trim().replace(/_/g, '-') : '';
      if (cleanedLocale && (cleanedLocale.toLowerCase() === 'auto' || /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(cleanedLocale))) {
        out.locale = normalizeInstallLocale(cleanedLocale, 'auto');
      }
    }
    if (source.position !== undefined && POSITIONS.indexOf(source.position) !== -1) {
      out.position = source.position;
    }
    if (source.offsets && typeof source.offsets === 'object') {
      out.offsets = {};
      if (source.offsets.x !== undefined) out.offsets.x = clampNumber(source.offsets.x, BUNDLED_DEFAULTS.offsets.x, 0, 160);
      if (source.offsets.y !== undefined) out.offsets.y = clampNumber(source.offsets.y, BUNDLED_DEFAULTS.offsets.y, 0, 160);
    }
    if (source.modules && typeof source.modules === 'object') {
      out.modules = {};
      Object.keys(BUNDLED_DEFAULTS.modules).forEach(function (key) {
        if (source.modules[key] !== undefined && (['installationDetection', 'installationGuidance', 'updateDetection', 'updateNotifications', 'autoUpdate', 'userUpdate', 'offlineDiagnostics', 'cacheDiagnostics'].indexOf(key) === -1 || typeof source.modules[key] === 'boolean')) out.modules[key] = source.modules[key] !== false;
      });
      const extensions = source.modules.extensions;
      if (extensions && typeof extensions === 'object' && !Array.isArray(extensions)) {
        const valid = {};
        Object.keys(extensions).slice(0, 50).forEach(function (key) {
          if (/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(key) && key !== 'constructor' && key !== 'prototype' && typeof extensions[key] === 'boolean') valid[key] = extensions[key];
        });
        out.modules.extensions = valid;
      }
    }
    if (source.notifications && typeof source.notifications === 'object') {
      out.notifications = {};
      if (source.notifications.dismissible !== undefined) {
        out.notifications.dismissible = source.notifications.dismissible !== false;
      }
      if (source.notifications.suppressRepeats !== undefined) {
        out.notifications.suppressRepeats = source.notifications.suppressRepeats !== false;
      }
      if (source.notifications.criticalPersistent !== undefined) {
        out.notifications.criticalPersistent = source.notifications.criticalPersistent !== false;
      }
    }
    if (source.branding && typeof source.branding === 'object') {
      out.branding = {};
      if (source.branding.name !== undefined) out.branding.name = safeText(source.branding.name, 80);
      if (source.branding.shortName !== undefined) out.branding.shortName = safeText(source.branding.shortName, 40);
      if (source.branding.icon !== undefined) {
        const iconStr = String(source.branding.icon || '');
        out.branding.icon = isExecutableString(iconStr) || /^\s*(?:javascript|data|blob):/i.test(iconStr)
          ? ''
          : safeText(iconStr, 200);
      }
      if (source.branding.themeColor !== undefined) {
        out.branding.themeColor = /^#[0-9a-f]{3,8}$/i.test(source.branding.themeColor || '')
          ? source.branding.themeColor
          : '';
      }
    }
    if (Array.isArray(source.actions)) out.actions = normalizeActions(source.actions);
    if (Array.isArray(source.features)) out.features = normalizeFeatures(source.features);
    if (source.installExperience && typeof source.installExperience === 'object' && !Array.isArray(source.installExperience)) {
      out.installExperience = normalizeInstallExperience(source.installExperience, {});
      // Preserve only explicit keys in the override layer so layered merging doesn't clobber defaults/published keys.
      const explicitInstall = {};
      Object.keys(out.installExperience).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(source.installExperience, key)) {
          explicitInstall[key] = out.installExperience[key];
        }
      });
      out.installExperience = explicitInstall;
    }
    // `theme` accepts both the original string form (`'auto' | 'light' | 'dark'`)
    // and the object form (`{ mode, inheritHost, tokens, host, variables }`).
    // Anything else — an unsupported mode, an array, a number — is ignored here
    // and reported by `resolveAssistantConfig` as a warning, so a bad value can
    // never reach the DOM.
    if (source.theme !== undefined) {
      const theme = normalizeTheme(source.theme);
      // An unsupported string mode ('neon') normalizes back to `auto`, which is
      // also the bundled default: the Assistant identity is kept and the mode is
      // never forwarded to the DOM as-is.
      out.theme = {
        mode: theme.mode,
        inheritHost: theme.inheritHost,
        tokens: theme.tokens,
        host: theme.host,
        variables: theme.variables,
      };
      out.themeMode = theme.mode;
    }
    if (source.domainRegistry && typeof source.domainRegistry === 'object' && !Array.isArray(source.domainRegistry)) {
      out.domainRegistry = sanitizePlainData(source.domainRegistry);
    }
    return out;
  }

  function applyLayer(base, layer) {
    if (!layer || typeof layer !== 'object') return base;
    if (layer.enabled !== undefined) base.enabled = layer.enabled;
    if (layer.project !== undefined) base.project = clone(layer.project);
    if (layer.projectId) base.projectId = layer.projectId;
    if (layer.domain) base.domain = layer.domain;
    if (layer.locale) base.locale = layer.locale;
    if (layer.position) base.position = layer.position;
    if (layer.offsets) {
      if (layer.offsets.x !== undefined) base.offsets.x = layer.offsets.x;
      if (layer.offsets.y !== undefined) base.offsets.y = layer.offsets.y;
    }
    if (layer.modules) {
      Object.keys(layer.modules).forEach(function (key) {
        base.modules[key] = layer.modules[key];
      });
    }
    if (layer.notifications) {
      Object.keys(layer.notifications).forEach(function (key) {
        base.notifications[key] = layer.notifications[key];
      });
    }
    if (layer.branding) {
      Object.keys(layer.branding).forEach(function (key) {
        if (layer.branding[key] !== undefined) base.branding[key] = layer.branding[key];
      });
    }
    if (layer.actions !== undefined) base.actions = clone(layer.actions);
    if (layer.features !== undefined) base.features = clone(layer.features);
    if (layer.installExperience && typeof layer.installExperience === 'object') {
      base.installExperience = normalizeInstallExperience(layer.installExperience, base.installExperience);
    }
    if (layer.theme) {
      base.theme = clone(layer.theme);
      base.themeMode = layer.theme.mode || 'auto';
    }
    if (layer.themeMode) base.themeMode = layer.themeMode;
    if (layer.domainRegistry) base.domainRegistry = clone(layer.domainRegistry);
    return base;
  }
  function validatePublishedConfig(rawInput, options) {
    const opts = options || {};
    let parsed = rawInput;
    if (typeof rawInput === 'string') {
      try {
        parsed = JSON.parse(rawInput);
      } catch (error) {
        return { valid: false, reason: 'invalid_json', warnings: ['invalid_json'] };
      }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, reason: 'invalid_object', warnings: ['invalid_object'] };
    }

    const safety = inspectConfigSafety(parsed, { allowServiceFunctions: false });
    if (safety.hasFunction) {
      return { valid: false, reason: 'executable_function_rejected', warnings: ['executable_function_rejected'] };
    }
    if (safety.hasExecutableString) {
      return { valid: false, reason: 'executable_code_rejected', warnings: ['executable_code_rejected'] };
    }
    if (safety.secretKeys.length > 0) {
      return {
        valid: false,
        reason: 'secret_fields_rejected',
        secretKeys: safety.secretKeys,
        warnings: ['secret_fields_rejected'],
      };
    }

    const major = parseSchemaMajor(parsed.schemaVersion);
    if (major !== SCHEMA_VERSION) {
      return { valid: false, reason: 'unsupported_schema_version', warnings: ['unsupported_schema_version'] };
    }

    const expectedProjectId = safeText(opts.expectedProjectId || '', 80);
    const declaredProjectId = safeText(parsed.projectId || '', 80);
    const nestedConfig = parsed.config && typeof parsed.config === 'object' && !Array.isArray(parsed.config)
      ? parsed.config
      : null;
    const topProject = normalizeProjectConfig(parsed.project);
    const nestedProject = normalizeProjectConfig(nestedConfig && nestedConfig.project);
    const projectIds = [declaredProjectId, topProject && topProject.id, nestedProject && nestedProject.id].filter(Boolean);
    if ((expectedProjectId && projectIds.some(function (id) { return id !== expectedProjectId; })) ||
        projectIds.some(function (id) { return id !== projectIds[0]; })) {
      return { valid: false, reason: 'project_id_mismatch', warnings: ['project_id_mismatch'] };
    }
    const hasInvalidProject = (parsed.project !== undefined && parsed.project !== null && !topProject) ||
      Boolean(nestedConfig && nestedConfig.project !== undefined && nestedConfig.project !== null && !nestedProject);

    const payload = nestedConfig
      ? Object.assign({}, nestedConfig,
        !nestedConfig.project && topProject ? { project: topProject } : {},
        declaredProjectId ? { projectId: declaredProjectId } : {})
      : parsed;

    return {
      valid: true,
      schemaVersion: SCHEMA_VERSION,
      revision: safeText(parsed.revision || '', 60),
      publishedAt: safeText(parsed.publishedAt || '', 60),
      projectId: declaredProjectId || (nestedProject && nestedProject.id) || (topProject && topProject.id) || expectedProjectId,
      config: extractLayerOverrides(payload),
      warnings: hasInvalidProject ? ['invalid_project_config'] : [],
    };
  }
  function lkgStorageKey(projectId) {
    return STORAGE_PREFIXES.lastKnownGood + safeText(projectId || 'default', 80);
  }
  function loadLastKnownGood(storage, projectId) {
    const id = safeText(projectId || '', 80);
    if (!storage || !id || typeof storage.getItem !== 'function') return null;
    try {
      const raw = storage.getItem(lkgStorageKey(id));
      if (!raw) return null;
      let record = null;
      try {
        record = JSON.parse(raw);
      } catch (error) {
        return null;
      }
      // A stored recovery record must declare the project it belongs to. Without
      // this, a blob written under this key with no `projectId` would skip the
      // mismatch check and be trusted as this project's last-known-good config.
      if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
      if (safeText(record.projectId || '', 80) !== id) return null;
      const validated = validatePublishedConfig(raw, { expectedProjectId: id });
      return validated.valid ? validated : null;
    } catch (error) {
      return null;
    }
  }
  function saveLastKnownGood(storage, projectId, validatedRecord) {
    const id = safeText(projectId || (validatedRecord && validatedRecord.projectId) || '', 80);
    if (!storage || !id || !validatedRecord || !validatedRecord.valid || typeof storage.setItem !== 'function') {
      return false;
    }
    try {
      const record = {
        schemaVersion: SCHEMA_VERSION,
        revision: validatedRecord.revision || '',
        publishedAt: validatedRecord.publishedAt || '',
        projectId: id,
        config: sanitizePlainData(validatedRecord.config || {}),
      };
      storage.setItem(lkgStorageKey(id), JSON.stringify(record));
      return true;
    } catch (error) {
      return false;
    }
  }
  function normalizeConfig(raw) {
    return resolveAssistantConfig(raw).config;
  }
  function resolveAssistantConfig(rawInput, context) {
    const ctx = context || {};
    const input = rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput) ? rawInput : {};
    const warnings = [];

    const localSafety = inspectConfigSafety(
      Object.assign({}, input, { publishedConfig: undefined }),
      { allowServiceFunctions: true }
    );
    if (localSafety.secretKeys.length > 0) warnings.push('secret_fields_stripped');
    if (localSafety.hasExecutableString) warnings.push('executable_value_stripped');
    if (localSafety.hasFunction) warnings.push('unexpected_function_ignored');

    const servicesIn = input.services && typeof input.services === 'object' ? input.services : {};
    const diagnosticsFn = typeof servicesIn.diagnostics === 'function' ? servicesIn.diagnostics : null;

    const base = clone(BUNDLED_DEFAULTS);
    base.domainRegistry = null;

    const typedProject = normalizeProjectConfig(input.project);
    const legacyProjectId = safeText(input.projectId || '', 80).trim();
    const explicitProjectId = (typedProject && typedProject.id) || legacyProjectId;
    if (input.project !== undefined && input.project !== null && !typedProject) warnings.push('invalid_project_config');
    if (typedProject && legacyProjectId && typedProject.id !== legacyProjectId) warnings.push('project_id_conflict');
    let source = 'defaults';
    let revision = '';
    let publishedAt = '';
    let usedLastKnownGood = false;

    if (input.publishedConfig !== undefined && input.publishedConfig !== null) {
      const validated = validatePublishedConfig(input.publishedConfig, {
        expectedProjectId: explicitProjectId,
      });
      if (validated.valid) {
        applyLayer(base, validated.config);
        source = 'published';
        revision = validated.revision;
        publishedAt = validated.publishedAt;
        const targetProject = explicitProjectId || validated.projectId || ctx.fallbackProjectId || '';
        if (targetProject && ctx.storage) {
          saveLastKnownGood(ctx.storage, targetProject, validated);
        }
      } else {
        warnings.push('published_config_rejected:' + validated.reason);
        const fallbackProject = explicitProjectId || ctx.fallbackProjectId || '';
        const lkg = input.useLastKnownGood !== false
          ? loadLastKnownGood(ctx.storage, fallbackProject)
          : null;
        if (lkg) {
          applyLayer(base, lkg.config);
          source = 'last-known-good';
          revision = lkg.revision;
          publishedAt = lkg.publishedAt;
          usedLastKnownGood = true;
        }
      }
    } else if (input.useLastKnownGood === true) {
      const lookupProject = explicitProjectId || ctx.fallbackProjectId || '';
      const lkg = loadLastKnownGood(ctx.storage, lookupProject);
      if (lkg) {
        applyLayer(base, lkg.config);
        source = 'last-known-good';
        revision = lkg.revision;
        publishedAt = lkg.publishedAt;
        usedLastKnownGood = true;
      }
    }

    const sanitizedOverrides = sanitizePlainData(Object.assign({}, input, {
      publishedConfig: undefined,
      services: undefined,
      window: undefined,
      document: undefined,
      location: undefined,
      navigator: undefined,
      storage: undefined,
      pwa: undefined,
      dns: undefined,
      domainResolver: undefined,
    })) || {};

    // Theme validation feedback is surfaced through the existing meta.warnings
    // channel so a host can see exactly which value was rejected and why.
    if (input.theme !== undefined) {
      normalizeTheme(input.theme).warnings.forEach(function (code) {
        if (warnings.indexOf(code) === -1) warnings.push(code);
      });
    }
    if (input.installExperience !== undefined) {
      inspectInstallExperienceIssues(input.installExperience, 'installExperience').forEach(function (issue) {
        if (warnings.indexOf(issue.code) === -1) warnings.push(issue.code);
      });
    }
    if (input.locale !== undefined) {
      const rawLoc = typeof input.locale === 'string' ? input.locale.trim().replace(/_/g, '-') : '';
      const validLoc = Boolean(rawLoc && (rawLoc.toLowerCase() === 'auto' || /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(rawLoc)));
      if (!validLoc && warnings.indexOf('invalid_locale') === -1) {
        warnings.push('invalid_locale');
      }
    }

    const overrideLayer = extractLayerOverrides(sanitizedOverrides);
    if (Object.keys(overrideLayer).length > 0 && source === 'defaults') {
      source = 'overrides';
    }
    applyLayer(base, overrideLayer);

    base.services = {
      diagnostics: diagnosticsFn,
    };

    return {
      config: base,
      meta: {
        schemaVersion: SCHEMA_VERSION,
        source: source,
        revision: revision,
        publishedAt: publishedAt,
        usedLastKnownGood: usedLastKnownGood,
        warnings: warnings,
      },
    };
  }

  /* --- diagnostics/index.js --- */

  const DNS_FAILURE_CLASSIFICATIONS = [
    'nxdomain',
    'dns_resolution_failure',
    'dns_records_missing',
    'possible_dns_interference',
    'dns_failure',
    'dns-error',
    'dns_failed',
    'missing_address_records',
    'servfail',
    'refused',
  ];

  const CONNECTIVITY_FAILURE_CLASSIFICATIONS = [
    'general_internet_failure',
    'application_host_unavailable',
    'backend_unavailable',
    'error',
    'timeout',
  ];

  // A caller-cancelled run is neither a DNS nor a connectivity failure: the user
  // stopped it, so no critical notice may be raised from it.
  function isCancelledResult(dns) {
    if (!dns || typeof dns !== 'object') return false;
    return dns.cancelled === true ||
      String(dns.status || '').toLowerCase() === 'cancelled' ||
      String(dns.classification || '').toLowerCase() === 'cancelled';
  }

  /**
   * One shape for "the project disabled diagnostics".
   *
   * Shared by the SDK API boundary and the adapter's live gate so a disabled
   * capability always reports the same thing, without touching the network.
   */
  function disabledDiagnosticsResult(message, locale) {
    const lang = resolveLocale({ explicit: locale });
    return {
      status: 'disabled',
      classification: 'disabled',
      message: safeText(message, 240) || translate(lang, 'diagDisabledProject'),
      failed: false,
    };
  }
  function cancelledDiagnosticsResult(reason, locale) {
    const lang = resolveLocale({ explicit: locale });
    return {
      status: 'cancelled',
      classification: 'cancelled',
      message: safeText(reason, 200) || translate(lang, 'diagCancelled'),
      failed: false,
      cancelled: true,
    };
  }
  function dnsFailure(dns) {
    if (isCancelledResult(dns)) return false;
    const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
    return DNS_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1;
  }
  function connectivityFailure(dns) {
    if (isCancelledResult(dns)) return false;
    const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
    return CONNECTIVITY_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1 || Boolean(dns && dns.failed);
  }
  function normalizeDnsResult(result, DateCtor) {
    const raw = result && typeof result === 'object' ? result : {};
    const DateImpl = DateCtor || Date;
    const status = String(raw.status || 'complete');
    const classification = safeText(raw.classification || 'unknown', 60);
    const cancelled = raw.cancelled === true || status.toLowerCase() === 'cancelled' || classification.toLowerCase() === 'cancelled';
    const normalized = {
      status: cancelled ? 'cancelled' : status,
      classification: cancelled ? 'cancelled' : classification,
      message: safeText(raw.message || '', 240),
      checkedAt: raw.checkedAt ? safeText(raw.checkedAt, 60) : new DateImpl().toISOString(),
      failed: cancelled ? false : Boolean(raw.failed),
    };
    if (cancelled) normalized.cancelled = true;
    else if (typeof raw.cancelled === 'boolean') normalized.cancelled = raw.cancelled;
    return normalized;
  }
  function resolveDiagnosticsRunner(options) {
    const opts = options || {};
    if (opts.services && typeof opts.services.diagnostics === 'function') {
      return opts.services.diagnostics;
    }
    const pwa = typeof opts.getPwa === 'function' ? opts.getPwa() : opts.pwa;
    if (pwa && typeof pwa.runNetworkDiagnostics === 'function') {
      return function (runOptions) {
        return pwa.runNetworkDiagnostics(runOptions);
      };
    }
    const dns = typeof opts.getDns === 'function' ? opts.getDns() : opts.dns;
    if (dns && typeof dns.check === 'function') {
      return function (runOptions) {
        const ctx = typeof opts.getContext === 'function' ? opts.getContext() : (opts.context || {});
        const context = {
          hostname: ctx.hostname,
          origin: ctx.origin,
          basePath: ctx.basePath || '/',
          online: ctx.online !== false,
        };
        // Probe paths change the effective app/backend diagnostic target, so the
        // engine must receive the same ones the assistant's DNS identity uses.
        if (typeof ctx.appProbePath === 'string' && ctx.appProbePath) context.appProbePath = ctx.appProbePath;
        if (typeof ctx.backendProbePath === 'string' && ctx.backendProbePath) context.backendProbePath = ctx.backendProbePath;
        return dns.check(context, runOptions);
      };
    }
    return null;
  }

  /** Normalizes the accepted signal shapes (an AbortSignal or `{ signal }`). */
  function resolveRunSignal(signal) {
    if (!signal) return null;
    const candidate = typeof signal.addEventListener === 'function'
      ? signal
      : (signal.signal && typeof signal.signal === 'object' ? signal.signal : null);
    if (!candidate || typeof candidate.addEventListener !== 'function') return null;
    return candidate;
  }
  function createDiagnosticsIntegration(options) {
    const opts = options || {};
    const AbortImpl = opts.AbortController || (typeof AbortController !== 'undefined' ? AbortController : null);
    let inFlight = null;
    // Live capability gate. `opts.isEnabled` is evaluated before the runner is
    // invoked and again before a result is published, so a run started while the
    // capability was enabled can never publish after it was disabled — and no
    // network work starts for a disabled capability, even asynchronously.
    function enabled() {
      return typeof opts.isEnabled === 'function' ? opts.isEnabled() !== false : true;
    }
    function currentLocale() {
      const rawLocale = typeof opts.getLocale === 'function' ? opts.getLocale() : opts.locale;
      return resolveLocale({ explicit: rawLocale });
    }
    // Per-run ownership record: the run that started last owns the controller,
    // its abort listeners and its detach function. A run's finalizer retires
    // only its own record, so a stale run can never detach a newer run's
    // controller or strip a newer run's caller abort listener.
    let currentRun = null;
    // Bumped by `clear()`: a run that was cleared must never report a result
    // afterwards, otherwise an abandoned check could overwrite newer state.
    let generation = 0;

    function run(runOptions) {
      if (inFlight) return inFlight;
      const lang = currentLocale();
      if (!enabled()) {
        const disabled = disabledDiagnosticsResult(undefined, lang);
        if (typeof opts.onResult === 'function') opts.onResult(disabled);
        return Promise.resolve(disabled);
      }
      const runOpts = Object.assign({}, runOptions || {});
      const callerSignal = resolveRunSignal(runOpts.signal);
      if (callerSignal && callerSignal.aborted) {
        const cancelled = cancelledDiagnosticsResult(translate(lang, 'diagCancelledBeforeStart'), lang);
        if (typeof opts.onResult === 'function') opts.onResult(cancelled);
        return Promise.resolve(cancelled);
      }
      const runner = resolveDiagnosticsRunner(opts);
      if (!runner) {
        const unavailable = {
          classification: 'unknown',
          message: translate(lang, 'diagUnavailable'),
          status: 'unavailable',
        };
        if (typeof opts.onResult === 'function') opts.onResult(unavailable);
        return Promise.resolve(unavailable);
      }

      // One controller per run, always. The caller's signal (if any) is bridged
      // onto it, so `clear()` — which `destroy()` calls — can always stop the run,
      // the caller's own signal is never mutated here, and a cancellation is
      // tracked separately from a timeout or an ordinary probe failure.
      let cancelled = false;
      let onOwnAbort = null;
      let onCallerAbort = null;
      let runController = null;
      if (AbortImpl) {
        runController = new AbortImpl();
        onOwnAbort = function () { cancelled = true; };
        runController.signal.addEventListener('abort', onOwnAbort, { once: true });
      }
      if (callerSignal) {
        onCallerAbort = function () {
          if (runController) {
            try { runController.abort(); } catch (error) { /* already settled */ }
          } else {
            cancelled = true;
          }
        };
        if (callerSignal.aborted) onCallerAbort();
        else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
      const runDetach = function () {
        if (callerSignal && onCallerAbort) callerSignal.removeEventListener('abort', onCallerAbort);
        if (runController && onOwnAbort) runController.signal.removeEventListener('abort', onOwnAbort);
      };
      const signal = runController ? runController.signal : callerSignal;
      if (signal) runOpts.signal = signal;
      else delete runOpts.signal;

      const runGeneration = generation;
      const stillCurrent = function () { return runGeneration === generation; };
      // This run owns its controller, its abort listeners and this detach
      // function. Nothing else may retire them while this run is current.
      const record = { controller: runController, detach: runDetach, generation: runGeneration };
      currentRun = record;
      if (typeof opts.onStart === 'function') opts.onStart();
      const finished = Promise.resolve()
        .then(function () {
          // Cancelled before the runner started: skip the network work entirely.
          if (cancelled) throw Object.assign(new Error(translate(currentLocale(), 'diagCancelled')), { kind: 'cancelled' });
          // The capability may have been disabled between the API call and this
          // microtask (a synchronous `configure()` can do that): never start the
          // runner for a disabled capability.
          if (!enabled()) throw Object.assign(new Error(translate(currentLocale(), 'diagDisabledProject')), { kind: 'disabled' });
          return runner(runOpts);
        })
        .then(function (result) {
          const activeLocale = currentLocale();
          // Disabled while the runner was in flight: the late result is dropped.
          // Checked before cancellation, because disabling the capability aborts
          // the owned controller too — the reason a run stopped is "disabled".
          if (!enabled()) {
            const disabled = disabledDiagnosticsResult(undefined, activeLocale);
            if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(disabled);
            return disabled;
          }
          // Once the run was cancelled, a late resolution is discarded: a
          // cancellation must never turn into a reported result.
          if (cancelled) {
            const stopped = cancelledDiagnosticsResult(translate(activeLocale, 'diagCancelled'), activeLocale);
            if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(stopped);
            return stopped;
          }
          const safeResult = result && typeof result === 'object' ? result : {};
          if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(safeResult);
          return safeResult;
        })
        .catch(function (error) {
          const activeLocale = currentLocale();
          // A capability disabled before or during the run is a state, not a
          // failure and not a cancellation: it must not raise a critical notice.
          if (!enabled() || (error && error.kind === 'disabled')) {
            const disabled = disabledDiagnosticsResult(undefined, activeLocale);
            if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(disabled);
            return disabled;
          }
          // A run stopped by its own signal is a cancellation, never a failure.
          if (cancelled || (error && error.kind === 'cancelled')) {
            const stopped = cancelledDiagnosticsResult(translate(activeLocale, 'diagCancelled'), activeLocale);
            if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(stopped);
            return stopped;
          }
          const failed = {
            classification: 'error',
            message: safeText(error && error.message, 200) || translate(activeLocale, 'diagFailed'),
            status: 'error',
            failed: true,
          };
          if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(failed);
          return failed;
        })
        .then(function (finalResult) {
          if (inFlight === finished) inFlight = null;
          // Per-run ownership: retire only this run's own record, and only
          // while it still owns the current slot. An older run that was cleared
          // (or replaced by a newer run) must never detach the newer run's
          // controller or remove the newer run's caller abort listener.
          if (currentRun === record) {
            currentRun = null;
            record.detach();
          }
          return finalResult;
        });
      inFlight = finished;
      return inFlight;
    }

    function clear() {
      // Invalidate the current run first: whatever it reports from here on is
      // discarded, so a late response can neither raise a notice nor overwrite
      // state that belongs to a different project or domain. Retiring the
      // record before aborting/detaching makes the run's own late finalizer a
      // no-op, so it can never touch a run started afterwards.
      generation += 1;
      const run = currentRun;
      if (run) {
        currentRun = null;
        if (run.controller) {
          try { run.controller.abort(); } catch (error) { /* already settled */ }
        }
        run.detach();
      }
      inFlight = null;
    }

    return {
      run: run,
      clear: clear,
      isRunning: function () { return Boolean(inFlight); },
    };
  }

  /* --- installation/index.js --- */

  function readPwaSnapshot(pwa) {
    let state = {};
    if (!pwa) return state;
    try {
      if (typeof pwa.getState === 'function') state = pwa.getState() || {};
    } catch (error) {
      state = {};
    }
    return state;
  }
  function resolveInstallationCopy(locale) {
    const lang = resolveLocale({ explicit: locale });
    return Object.freeze({
      language: lang,
      installActionLabel: translate(lang, 'installActionLabel'),
      instructionsActionLabel: translate(lang, 'instructionsActionLabel'),
      installAvailableTitle: translate(lang, 'installAvailableTitle'),
      nativeAvailableMessage: translate(lang, 'nativeAvailableMessage'),
      iosAvailableMessage: translate(lang, 'iosAvailableMessage'),
      genericAvailableMessage: translate(lang, 'genericAvailableMessage'),
      iosShortcutHint: translate(lang, 'iosShortcutHint'),
      genericHint: translate(lang, 'genericHint'),
    });
  }
  function deriveInstallationState(options) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    const moduleEnabled = opts.enabled !== false;
    const detectionEnabled = opts.detection !== false;
    const state = detectionEnabled ? readPwaSnapshot(pwa) : {};

    let installed = Boolean(state.installed || state.standalone);
    let canInstall = Boolean(state.canInstall);
    let ios = Boolean(state.ios);
    let safari = Boolean(state.safari);

    try { if (detectionEnabled && !installed && pwa && typeof pwa.isInstalled === 'function') installed = Boolean(pwa.isInstalled()); } catch (error) { /* ignore */ }
    try { if (detectionEnabled && !canInstall && pwa && typeof pwa.canInstall === 'function') canInstall = Boolean(pwa.canInstall()); } catch (error) { /* ignore */ }
    try { if (!ios && pwa && typeof pwa.isIOS === 'function') ios = Boolean(pwa.isIOS()); } catch (error) { /* ignore */ }
    try { if (!safari && pwa && typeof pwa.isSafari === 'function') safari = Boolean(pwa.isSafari()); } catch (error) { /* ignore */ }

    const pwaFeatureAllowed = !pwa || !pwa.config || !pwa.config.features || pwa.config.features.installation !== false;
    const enabled = Boolean(moduleEnabled && pwa && pwaFeatureAllowed);

    let support = 'none';
    if (enabled) {
      if (installed) support = 'installed';
      else if (canInstall) support = 'native';
      else if (ios && safari) support = 'manual-ios';
      else support = 'manual-generic';
    }

    const installExp = opts.installExperience && typeof opts.installExperience === 'object' ? opts.installExperience : {};
    const componentEnabled = Boolean(enabled && installExp.enabled !== false && state.installComponentEnabled !== false);
    const presentation = installExp.presentation === 'auto'
      ? 'auto'
      : (installExp.presentation === 'manual'
        ? 'manual'
        : (state.installPresentation === 'auto' ? 'auto' : 'manual'));
    const locale = String(installExp.locale || state.installLocale || 'auto');
    const backend = !detectionEnabled || !enabled
      ? 'none'
      : String(state.installBackend || (canInstall ? 'beforeinstallprompt' : ((ios && safari) || support === 'manual-generic' ? 'manual' : 'none')));

    return {
      support: support,
      status: installed ? 'installed' : (support === 'none' ? 'unavailable' : 'available'),
      canInstall: canInstall,
      installed: installed,
      standalone: Boolean(state.standalone),
      ios: ios,
      safari: safari,
      platform: ios ? 'ios' : (canInstall ? 'chromium' : 'generic'),
      nativeAvailable: canInstall,
      componentEnabled: componentEnabled,
      componentLoaded: detectionEnabled ? Boolean(state.installComponentLoaded) : false,
      dialogOpen: detectionEnabled ? Boolean(state.installDialogOpen) : false,
      presentation: presentation,
      locale: locale,
      backend: backend,
      relatedAppsInstalled: detectionEnabled ? Boolean(state.relatedAppsInstalled) : false,
    };
  }
  function requestPwaInstall(options, promptOptions) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    if (opts.enabled === false || !pwa || typeof pwa.promptInstall !== 'function') {
      return Promise.resolve({ outcome: 'unsupported' });
    }
    try {
      return Promise.resolve(pwa.promptInstall(promptOptions));
    } catch (error) {
      return Promise.resolve({ outcome: 'error' });
    }
  }
  function showPwaInstallDialog(options, dialogOptions) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    if (opts.enabled === false || !pwa) {
      return Promise.resolve({ shown: false, outcome: opts.enabled === false ? 'disabled' : 'unsupported', backend: 'none' });
    }
    try {
      if (typeof pwa.showInstallDialog === 'function') {
        return Promise.resolve(pwa.showInstallDialog(dialogOptions)).then(function (res) {
          if (res && typeof res === 'object') return res;
          return { shown: Boolean(res), outcome: res ? 'shown' : 'unsupported', backend: 'pwa-install' };
        });
      }
      if (typeof pwa.promptInstall === 'function') {
        return Promise.resolve(pwa.promptInstall(dialogOptions)).then(function (res) {
          const outcome = res && res.outcome ? res.outcome : 'shown';
          return { shown: outcome !== 'unsupported' && outcome !== 'error', outcome: outcome, backend: 'classic' };
        });
      }
      return Promise.resolve({ shown: false, outcome: 'unsupported', backend: 'none' });
    } catch (error) {
      return Promise.resolve({ shown: false, outcome: 'error', backend: 'none' });
    }
  }
  function hidePwaInstallDialog(options) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    if (!pwa || typeof pwa.hideInstallDialog !== 'function') {
      return false;
    }
    try {
      return Boolean(pwa.hideInstallDialog());
    } catch (error) {
      return false;
    }
  }
  function triggerPwaInstall(options, promptOptions) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    if (opts.enabled === false || !pwa) {
      return Promise.resolve({ outcome: opts.enabled === false ? 'disabled' : 'unsupported', backend: 'none' });
    }
    try {
      if (typeof pwa.triggerInstall === 'function') {
        return Promise.resolve(pwa.triggerInstall(promptOptions));
      }
      if (typeof pwa.promptInstall === 'function') {
        return Promise.resolve(pwa.promptInstall(Object.assign({}, promptOptions, { immediate: true })));
      }
      return Promise.resolve({ outcome: 'unsupported', backend: 'none' });
    } catch (error) {
      return Promise.resolve({ outcome: 'error', backend: 'none' });
    }
  }
  function readInstalledRelatedApps(options) {
    const opts = options || {};
    if (opts.detection === false) return Promise.resolve([]);
    const pwa = opts.pwa || null;
    const nav = opts.navigator || null;
    try {
      if (pwa && typeof pwa.getInstalledRelatedApps === 'function') {
        return Promise.resolve(pwa.getInstalledRelatedApps()).then(function (apps) {
          return Array.isArray(apps) ? apps : [];
        }, function () { return []; });
      }
      if (nav && typeof nav.getInstalledRelatedApps === 'function') {
        return Promise.resolve(nav.getInstalledRelatedApps()).then(function (apps) {
          return Array.isArray(apps) ? apps : [];
        }, function () { return []; });
      }
    } catch (error) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  }

  function readPwaHasUpdate(pwa) {
    const snapshot = readPwaSnapshot(pwa);
    if (snapshot.hasUpdate !== undefined) return snapshot.hasUpdate;
    if (pwa && typeof pwa.hasUpdate === 'function') {
      try {
        return Boolean(pwa.hasUpdate());
      } catch (error) {
        return undefined;
      }
    }
    return undefined;
  }
  function requestPwaUpdate(options) {
    const opts = options || {};
    const pwa = opts.pwa || null;
    if (opts.enabled === false) {
      return Promise.resolve({ applied: false, outcome: 'disabled' });
    }
    if (!pwa || typeof pwa.applyUpdate !== 'function') {
      return Promise.resolve({ applied: false, outcome: 'unsupported' });
    }
    try {
      return Promise.resolve(pwa.applyUpdate()).then(
        function (resolved) {
          if (resolved === true) return { applied: true, outcome: 'applied' };
          if (resolved === false) return { applied: false, outcome: 'no-waiting-worker' };
          if (resolved == null) {
            return readPwaHasUpdate(pwa) === false
              ? { applied: false, outcome: 'no-waiting-worker' }
              : { applied: true, outcome: 'applied' };
          }
          if (typeof resolved === 'object' && typeof resolved.applied === 'boolean') {
            const fallbackOutcome = resolved.applied ? 'applied' : 'no-waiting-worker';
            const supportedOutcomes = ['applied', 'no-waiting-worker', 'unsupported', 'disabled', 'error'];
            const outcome = supportedOutcomes.indexOf(resolved.outcome) !== -1 &&
              (resolved.outcome === 'applied') === resolved.applied
              ? resolved.outcome
              : fallbackOutcome;
            return { applied: resolved.applied, outcome: outcome };
          }
          return resolved
            ? { applied: true, outcome: 'applied' }
            : { applied: false, outcome: 'no-waiting-worker' };
        }
      ).catch(function () {
        // Normalize both rejected runtime calls and exceptions from malformed
        // third-party result objects (including throwing getters) to the declared
        // error outcome rather than leaking an unexpected rejection.
        return { applied: false, outcome: 'error' };
      });
    } catch (error) {
      return Promise.resolve({ applied: false, outcome: 'error' });
    }
  }

  /* --- browser/index.js --- */

  const ANDROID_RE = /Android/i;
  const IOS_RE = /iPhone|iPad|iPod/i;
  // Named restricted in-app browsers. Messenger is tested before Facebook:
  // Messenger webviews carry Facebook's own FBAN/FBAV markers as well.
  const INSTAGRAM_RE = /Instagram/i;
  const MESSENGER_RE = /Messenger/i;
  const FACEBOOK_RE = /\bFBAN\b|\bFBAV\b|\[FB_IAB|\bFB4A\b|\bFacebook\b/i;
  // Android System WebView advertises itself with a `wv)` platform token.
  // Standalone Chrome on Android never carries it.
  const WEBVIEW_RE = /\bwv\)/i;
  const CHROME_PACKAGE = 'com.android.chrome';
  const CHROME_OFFER_STORAGE_KEY = 'youge-assistant:chrome-offer-dismissed';

  /**
   * Classify a user agent for in-app browser restrictions.
   *
   * @param {string} [userAgent]
   * @returns {Readonly<{
   *   ua: string,
   *   android: boolean,
   *   ios: boolean,
   *   inApp: boolean,
   *   restricted: boolean,
   *   uncertain: boolean,
   *   browser: 'facebook' | 'messenger' | 'instagram' | 'webview' | 'none',
   * }>}
   */
  function detectInAppBrowser(userAgent) {
    const ua = typeof userAgent === 'string' ? userAgent : '';
    if (!ua.trim()) {
      return Object.freeze({
        ua: '',
        android: false,
        ios: false,
        inApp: false,
        restricted: false,
        uncertain: true,
        browser: 'none',
      });
    }

    const android = ANDROID_RE.test(ua);
    const ios = IOS_RE.test(ua);

    let browser = 'none';
    if (INSTAGRAM_RE.test(ua)) browser = 'instagram';
    else if (MESSENGER_RE.test(ua)) browser = 'messenger';
    else if (FACEBOOK_RE.test(ua)) browser = 'facebook';
    else if (android && WEBVIEW_RE.test(ua)) browser = 'webview';

    const inApp = browser !== 'none';
    return Object.freeze({
      ua,
      android,
      ios,
      inApp,
      restricted: inApp,
      uncertain: false,
      browser,
    });
  }

  /** True only for a confident Android restricted in-app browser. */
  function isChromeHandoffCandidate(detection) {
    return Boolean(detection && detection.android && detection.restricted && !detection.uncertain);
  }

  /**
   * Build the Android `intent://` URL that asks Chrome to open `url`.
   *
   * The target keeps the original host, pathname, query string and hash
   * (`intent://host/path?query#hash#Intent;…`). The full original URL is also
   * carried percent-encoded in `S.browser_fallback_url` so it survives the
   * intent round-trip. Returns null for anything that is not an absolute
   * http(s) URL — no other scheme is ever handed to the intent handler.
   *
   * @param {string} url
   * @param {{ packageName?: string }} [options]
   * @returns {string | null}
   */
  function buildChromeIntentUrl(url, options) {
    const packageName = (options && options.packageName) || CHROME_PACKAGE;
    if (typeof url !== 'string' || !url) return null;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      return null;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

    const scheme = parsed.protocol.slice(0, -1);
    // host + pathname + query — everything before the fragment, verbatim.
    const target = parsed.host + parsed.pathname + parsed.search;
    const fragment = parsed.hash ? parsed.hash.slice(1) : '';
    const fallback = encodeURIComponent(url);
    return `intent://${target}${fragment ? `#${fragment}` : ''}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${fallback};end`;
  }

  /**
   * Copy-ready manual fallback for when the automatic handoff fails.
   * Plain data — every renderer (widget, React, host app) presents it its own way.
   *
   * @param {string} url
   * @param {Partial<Record<'title' | 'intro' | 'stepCopy' | 'stepSwitch' | 'stepPaste' | 'copyLabel' | 'copiedLabel' | 'openLabel' | 'dismissLabel', string>>} [labels]
   */
  function chromeHandoffInstructions(url, labels) {
    const l = labels || {};
    return Object.freeze({
      title: l.title || 'Open this page in Chrome',
      intro:
        l.intro ||
        'This in-app browser can hide features and break links. Continue in Chrome instead.',
      steps: Object.freeze([
        l.stepCopy || 'Copy the page address shown below.',
        l.stepSwitch || 'Leave this app and open Chrome on your device.',
        l.stepPaste || 'Paste the address into Chrome’s address bar and open it.',
      ]),
      url: typeof url === 'string' ? url : '',
      openLabel: l.openLabel || 'Open in Chrome',
      dismissLabel: l.dismissLabel || 'Not now',
      copyLabel: l.copyLabel || 'Copy address',
      copiedLabel: l.copiedLabel || 'Address copied.',
    });
  }

  /**
   * Controller shared by every renderer: detection, best-effort intent open and
   * the manual fallback handshake. All environment access is injectable so the
   * flow is testable without a browser.
   *
   * @param {{
   *   userAgent?: string,
   *   location?: { href?: string, assign?: (url: string) => void } | null,
   *   document?: { visibilityState?: string } | null,
   *   assign?: (url: string) => void,
   *   setTimeout?: (fn: () => void, ms: number) => unknown,
   *   clearTimeout?: (id: unknown) => void,
   *   fallbackDelayMs?: number,
   *   packageName?: string,
   *   labels?: Record<string, string>,
   * }} [options]
   */
  function createChromeHandoff(options) {
    const opts = options || {};
    const doc =
      opts.document !== undefined
        ? opts.document
        : typeof document !== 'undefined'
          ? document
          : null;
    const loc =
      opts.location !== undefined
        ? opts.location
        : typeof location !== 'undefined'
          ? location
          : null;
    const detection = detectInAppBrowser(
      opts.userAgent !== undefined
        ? opts.userAgent
        : typeof navigator !== 'undefined' && navigator
          ? navigator.userAgent
          : ''
    );
    const candidate = isChromeHandoffCandidate(detection);

    const assign =
      typeof opts.assign === 'function'
        ? opts.assign
        : loc && typeof loc.assign === 'function'
          ? loc.assign.bind(loc)
          : null;
    const schedule =
      typeof opts.setTimeout === 'function'
        ? opts.setTimeout
        : typeof setTimeout === 'function'
          ? setTimeout
          : null;
    const cancel =
      typeof opts.clearTimeout === 'function'
        ? opts.clearTimeout
        : typeof clearTimeout === 'function'
          ? clearTimeout
          : null;
    const fallbackDelayMs =
      typeof opts.fallbackDelayMs === 'number' && isFinite(opts.fallbackDelayMs)
        ? opts.fallbackDelayMs
        : 900;

    let timer = null;
    let destroyed = false;
    let currentUrl = '';

    function targetUrl(url) {
      if (typeof url === 'string' && url) return url;
      if (loc && typeof loc.href === 'string' && loc.href) return loc.href;
      return currentUrl || '';
    }

    function clearTimer() {
      if (timer !== null && typeof cancel === 'function') cancel(timer);
      timer = null;
    }

    function intentUrl(url) {
      return buildChromeIntentUrl(targetUrl(url), opts);
    }

    function instructions(url) {
      return chromeHandoffInstructions(targetUrl(url), opts.labels);
    }

    function open(url, onFallback) {
      currentUrl = targetUrl(url);
      const manual = instructions(currentUrl);

      if (!candidate) {
        return Object.freeze({ status: 'unsupported', intentUrl: null, instructions: manual });
      }
      const intent = buildChromeIntentUrl(currentUrl, opts);
      const fallback = typeof onFallback === 'function' ? onFallback : null;

      if (!intent || typeof assign !== 'function') {
        // Nothing to attempt with — go straight to the manual instructions.
        if (fallback) fallback(manual);
        return Object.freeze({ status: 'failed', intentUrl: intent, instructions: manual });
      }
      try {
        assign(intent);
      } catch (error) {
        if (fallback) fallback(manual);
        return Object.freeze({ status: 'failed', intentUrl: intent, instructions: manual });
      }

      // Best-effort handshake: if this document is still the visible one after
      // the delay, the intent did not leave the app — show the manual steps.
      if (schedule && doc && !destroyed) {
        clearTimer();
        timer = schedule(function () {
          timer = null;
          if (destroyed) return;
          const visible = !doc.visibilityState || doc.visibilityState === 'visible';
          if (visible && fallback) fallback(manual);
        }, fallbackDelayMs);
      }
      return Object.freeze({ status: 'attempted', intentUrl: intent, instructions: manual });
    }

    function destroy() {
      destroyed = true;
      clearTimer();
    }

    return Object.freeze({
      detection,
      shouldOffer() {
        return candidate;
      },
      intentUrl,
      instructions,
      open,
      destroy,
    });
  }

  /* --- assistant/index.js --- */

  /**
   * Presentation severity for a notification.
   *
   * This is presentation only: it never changes a priority, an id, a
   * dismissibility flag or any suppression/persistence rule. The mapping is
   * derived from what the condition actually means, so the widget can render
   * distinct, accessible tiers without the engine knowing about CSS.
   *
   *   critical — the app is unreachable (connectivity, DNS, host resolution)
   *   error    — a required backend endpoint is down
   *   warning  — something needs the user's attention but still works (session)
   *   success  — good news (service restored, the app can be installed)
   *   info     — context only (failover active, available update, features)
   */
  const NOTIFICATION_LEVEL_MAP = Object.freeze({
    'network:offline': 'critical',
    'dns:failure': 'critical',
    'network:unreachable': 'critical',
    'api:primary-failed': 'error',
    'session:issue': 'warning',
    'api:backup-active': 'info',
    'api:primary-restored': 'success',
    'install:available': 'success',
    'app:update': 'info',
  });
  function notificationLevel(id, priority) {
    const key = String(id || '');
    if (NOTIFICATION_LEVEL_MAP[key]) return NOTIFICATION_LEVEL_MAP[key];
    if (key.indexOf('feature:') === 0) return 'info';
    switch (priority) {
      case PRIORITY.critical: return 'critical';
      case PRIORITY.auth: return 'warning';
      case PRIORITY.backup: return 'info';
      case PRIORITY.install: return 'success';
      default: return 'info';
    }
  }
  function createAssistant(initialOptions, envOverrides) {
    const rawInit = initialOptions && typeof initialOptions === 'object' ? initialOptions : {};
    const envIn = Object.assign(
      {},
      rawInit.env && typeof rawInit.env === 'object' ? rawInit.env : {},
      envOverrides && typeof envOverrides === 'object' ? envOverrides : {}
    );

    const defaultRoot = typeof globalThis !== 'undefined' ? globalThis : {};
    const root = envIn.root || envIn.window || rawInit.window || defaultRoot;
    const useGlobalConfig = Boolean(envIn.useGlobalConfig);
    const exposeGlobal = Boolean(envIn.exposeGlobal || rawInit.exposeGlobal);
    const shouldBindEvents = envIn.bindEvents !== false && rawInit.bindEvents !== false;

    const UrlCtor = root.URL || URL;
    const DateCtor = root.Date || Date;

    function getDoc() {
      if (envIn.document !== undefined) return envIn.document;
      if (rawInit.document !== undefined) return rawInit.document;
      return root.document || null;
    }

    function getStorage() {
      if (envIn.storage !== undefined) return envIn.storage;
      if (rawInit.storage !== undefined) return rawInit.storage;
      try {
        return root.localStorage || null;
      } catch (error) {
        return null;
      }
    }

    function getLocation() {
      if (envIn.location !== undefined) return envIn.location;
      if (rawInit.location !== undefined) return rawInit.location;
      return root.location || {};
    }

    function getNavigator() {
      if (envIn.navigator !== undefined) return envIn.navigator;
      if (rawInit.navigator !== undefined) return rawInit.navigator;
      return root.navigator || null;
    }

    function getPwa() {
      if (envIn.pwa !== undefined) return envIn.pwa;
      if (rawInit.pwa !== undefined) return rawInit.pwa;
      return root.YouGePWA || root.PWA || null;
    }

    function getDns() {
      if (envIn.dns !== undefined) return envIn.dns;
      if (rawInit.dns !== undefined) return rawInit.dns;
      return root.YouGeDns || null;
    }

    /**
     * The single capability check for this instance. Everything that can activate
     * a gated capability — the public API, generated actions, project-supplied
     * actions, notifications and the diagnostics adapter — goes through it, so
     * the current resolved configuration is always the authority.
     */
    function capabilityEnabled(capability) {
      return isCapabilityEnabled(config.modules, capability);
    }

    let rawOptionsState = Object.assign(
      {},
      useGlobalConfig && root.YOU_GE_ASSISTANT_CONFIG && typeof root.YOU_GE_ASSISTANT_CONFIG === 'object'
        ? root.YOU_GE_ASSISTANT_CONFIG
        : {},
      rawInit
    );

    let resolvedBundle = resolveAssistantConfig(rawOptionsState, {
      storage: getStorage(),
    });
    let config = resolvedBundle.config;
    let configMeta = resolvedBundle.meta;
    const rejectedPublishedConfig = Array.isArray(configMeta.warnings) && configMeta.warnings.some(function (warning) {
      return typeof warning === 'string' && warning.indexOf('published_config_rejected:') === 0;
    });
    const shouldResolveInitialLkg = configMeta.source !== 'last-known-good' && (
      (rejectedPublishedConfig && rawOptionsState.useLastKnownGood !== false) ||
      (rawOptionsState.useLastKnownGood === true && !rawOptionsState.publishedConfig)
    );
    if (shouldResolveInitialLkg) {
      const fallbackProjectId = projectInfo().id;
      const recovered = resolveAssistantConfig(rawOptionsState, {
        storage: getStorage(),
        fallbackProjectId: fallbackProjectId,
      });
      if (recovered.meta.source === 'last-known-good') {
        resolvedBundle = recovered;
        config = recovered.config;
        configMeta = recovered.meta;
      }
    }
    let services = config.services;

    const listeners = new Set();
    const listenerCounts = new Map();
    let noticeStore = { dismissed: {}, acknowledged: {} };
    let snapshot = null;
    let bound = false;
    let destroyed = false;
    let unsubscribePwa = null;
    let lastConditionKeys = new Set();
    let lastPwaHasUpdate;
    let syncingPwaLocale = false;

    const nav = getNavigator();
    const conditions = {
      online: nav ? nav.onLine !== false : true,
      dns: { status: 'idle', classification: 'unknown', message: '', checkedAt: null },
      endpoints: { primary: 'unknown', backup: 'inactive', active: 'primary', reason: '' },
      session: { state: 'unknown', message: '' },
      updateAvailable: false,
      recovery: false,
    };

    function effectiveLocation() {
      const rawLocation = getLocation() || {};
      let loc = rawLocation;
      if (typeof rawLocation === 'string') {
        const detected = resolveDomain(rawLocation, {}).domain;
        loc = {
          hostname: detected.hostname,
          origin: detected.origin,
          protocol: detected.protocol,
          pathname: detected.pathname,
          basePath: detected.pathname || '/',
          href: detected.origin + detected.pathname,
        };
      }
      if (config.domain) {
        const explicitHost = String(config.domain).trim();
        const locHost = String(loc.hostname || '').trim().toLowerCase();
        const sameHost = locHost && locHost === explicitHost.toLowerCase();
        return {
          hostname: explicitHost,
          origin: sameHost ? loc.origin : undefined,
          protocol: loc.protocol || 'https:',
          pathname: loc.pathname || '/',
          basePath: loc.basePath || loc.pathname || '/',
        };
      }
      return {
        hostname: loc.hostname,
        origin: loc.origin,
        protocol: loc.protocol,
        pathname: loc.pathname,
        basePath: loc.basePath || loc.pathname || '/',
      };
    }

    function domainContext() {
      const loc = effectiveLocation();
      const fallback = {
        identity: { name: 'You.Ge Assistant', shortName: 'You.Ge', description: '' },
        branding: { themeColor: '#155eef', icon: 'icons/icon-192.png' },
        pwa: { basePath: '/' },
        project: null,
        domain: {
          hostname: loc.hostname || 'localhost',
          origin: loc.origin || 'https://localhost',
          protocol: loc.protocol || 'https:',
          pathname: loc.pathname || '/',
          basePath: '/',
          configured: false,
          matchedRegistryKey: null,
          projectId: null,
          validation: {
            valid: false,
            issues: [{ code: 'domain_resolution_failed', path: 'domain', message: 'Domain configuration could not be resolved safely.' }],
          },
        },
        features: { installation: true, diagnostics: true },
      };

      const explicitRegistry = config.domainRegistry || envIn.domainRegistry || rawOptionsState.domainRegistry || null;
      if (explicitRegistry) {
        try {
          return resolveDomain(loc, explicitRegistry) || fallback;
        } catch (error) {
          return fallback;
        }
      }

      const resolver = envIn.domainResolver || rawOptionsState.domainResolver || root.YouGeDomain || null;
      if (resolver && typeof resolver.resolve === 'function') {
        try {
          const resolved = resolver.resolve(loc);
          return resolved || fallback;
        } catch (error) {
          return fallback;
        }
      }

      try {
        const globalRegistry = root.YOU_GE_DOMAIN_REGISTRY && typeof root.YOU_GE_DOMAIN_REGISTRY === 'object'
          ? root.YOU_GE_DOMAIN_REGISTRY
          : {};
        return resolveDomain(loc, globalRegistry) || fallback;
      } catch (error) {
        return fallback;
      }
    }

    function projectInfo() {
      const domain = domainContext();
      const host = domain.domain || {};
      const basePath = domain.pwa && domain.pwa.basePath ? domain.pwa.basePath : (host.basePath || '/');
      const identity = domain.identity || {};
      const branding = domain.branding || {};
      const typedProjectId = config.project && config.project.id ? config.project.id : '';
      const legacyProjectId = config.projectId || '';
      const registryProjectId = (domain.project && domain.project.id) || host.projectId || '';
      const projectIdSource = typedProjectId
        ? 'project'
        : (legacyProjectId ? 'projectId' : (registryProjectId ? 'domainRegistry' : 'derived'));
      const id = typedProjectId || legacyProjectId || registryProjectId || String(host.hostname || 'localhost') + String(basePath);
      const loc = getLocation() || {};
      const validation = host.validation && typeof host.validation === 'object'
        ? { valid: host.validation.valid !== false, issues: Array.isArray(host.validation.issues) ? clone(host.validation.issues) : [] }
        : { valid: true, issues: [] };
      const baseHref = config.domain
        ? String(host.origin || 'https://localhost') + String(basePath)
        : (loc.href || String(host.origin || 'https://localhost') + '/');
      return {
        id: id,
        name: config.branding.name || identity.name || 'You.Ge Assistant',
        shortName: config.branding.shortName || identity.shortName || 'You.Ge',
        icon: safeSameOriginIcon(config.branding.icon || branding.icon, 'icons/icon-192.png', baseHref, UrlCtor),
        themeColor: config.branding.themeColor || branding.themeColor || '#155eef',
        hostname: String(host.hostname || 'localhost'),
        detectedHostname: detectRuntimeHostname(getLocation()) || String(host.hostname || 'localhost'),
        origin: String(host.origin || 'https://localhost'),
        basePath: String(basePath),
        configured: Boolean(host.configured),
        matchedRegistryKey: host.matchedRegistryKey || null,
        projectIdSource: projectIdSource,
        domainValidation: validation,
      };
    }

    function resolveActiveLocale(domainResolved) {
      const dom = domainResolved || domainContext();
      const explicitLocale = config.locale && config.locale !== 'auto'
        ? config.locale
        : (config.installExperience && config.installExperience.locale && config.installExperience.locale !== 'auto'
            ? config.installExperience.locale
            : 'auto');
      return resolveLocale({
        explicit: explicitLocale,
        domainConfig: dom,
        navigator: getNavigator(),
      });
    }

    function persistPublishedLkgIfDerivedProject() {
      if (configMeta.source === 'published' && !config.projectId && !(config.project && config.project.id) && rawOptionsState.publishedConfig) {
        const storage = getStorage();
        if (!storage) return;
        const derivedId = projectInfo().id;
        const validated = validatePublishedConfig(rawOptionsState.publishedConfig, { expectedProjectId: '' });
        if (validated.valid && !validated.projectId) {
          saveLastKnownGood(storage, derivedId, validated);
        }
      }
    }

    function storageKey(projectId) {
      return STORAGE_PREFIXES.notices + projectId;
    }

    function loadNotices(projectId) {
      noticeStore = { dismissed: {}, acknowledged: {} };
      const storage = getStorage();
      try {
        const raw = storage && typeof storage.getItem === 'function' ? storage.getItem(storageKey(projectId)) : null;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          noticeStore.dismissed = parsed.dismissed && typeof parsed.dismissed === 'object' ? parsed.dismissed : {};
          noticeStore.acknowledged = parsed.acknowledged && typeof parsed.acknowledged === 'object' ? parsed.acknowledged : {};
        }
      } catch (error) { /* storage unavailable */ }
    }

    function saveNotices(projectId) {
      const storage = getStorage();
      try {
        if (storage && typeof storage.setItem === 'function') {
          storage.setItem(storageKey(projectId), JSON.stringify(noticeStore));
        }
      } catch (error) { /* storage unavailable */ }
    }

    function noticeKey(projectId, id) {
      return projectId + ':' + id;
    }

    function isSuppressed(projectId, id, critical) {
      const key = noticeKey(projectId, id);
      if (config.notifications.suppressRepeats && noticeStore.dismissed[key]) return true;
      if (critical && noticeStore.acknowledged[key]) return true;
      return false;
    }

    function endpointFailure(endpoints) {
      return endpoints.primary === 'failed' || endpoints.primary === 'unavailable' || endpoints.primary === 'degraded';
    }

    function buildNotifications(project, installation, network, lang) {
      const locale = lang || resolveActiveLocale();
      const out = [];
      const activeKeys = new Set();

      function add(notification, conditionKey) {
        activeKeys.add(conditionKey);
        // Capability enforcement happens here, before suppression bookkeeping, so
        // a gated notice is tracked as resolved and cannot reappear through the
        // dismissed/acknowledged state. A notice that merely links to a gated
        // action keeps its content and loses only the action.
        const gated = gateNotification(config.modules, notification);
        if (!gated) return;
        if (isSuppressed(project.id, gated.id, gated.critical)) return;
        out.push(gated);
      }

      if (!network.online) {
        add({
          id: 'network:offline', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: translate(locale, 'offlineTitle'),
          message: translate(locale, 'offlineMessage'),
          actionId: 'diagnostics',
        }, 'network:offline');
      }
      if (dnsFailure(network.dns)) {
        add({
          id: 'dns:failure', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: translate(locale, 'dnsTitle'),
          message: network.dns.message || translate(locale, 'dnsMessage'),
          actionId: 'diagnostics',
        }, 'dns:failure');
      }
      if (network.online && connectivityFailure(network.dns)) {
        add({
          id: 'network:unreachable', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: translate(locale, 'unreachableTitle'),
          message: network.dns.message || translate(locale, 'unreachableMessage'),
          actionId: 'diagnostics',
        }, 'network:unreachable');
      }
      if (endpointFailure(network.endpoints)) {
        add({
          id: 'api:primary-failed', priority: PRIORITY.critical, tone: TONE[PRIORITY.critical],
          critical: true, dismissible: false, title: translate(locale, 'primaryApiTitle'),
          message: network.endpoints.reason || translate(locale, 'primaryApiMessage'),
          actionId: 'diagnostics',
        }, 'api:primary-failed');
      }
      if (network.session.state === 'issue') {
        add({
          id: 'session:issue', priority: PRIORITY.auth, tone: TONE[PRIORITY.auth],
          critical: false, dismissible: true, title: translate(locale, 'sessionTitle'),
          message: network.session.message || translate(locale, 'sessionMessage'),
          actionId: 'help',
        }, 'session:issue');
      }
      if (network.endpoints.backup === 'active' || network.endpoints.active === 'backup') {
        add({
          id: 'api:backup-active', priority: PRIORITY.backup, tone: TONE[PRIORITY.backup],
          critical: false, dismissible: true, title: translate(locale, 'backupTitle'),
          message: network.endpoints.reason || translate(locale, 'backupMessage'),
          actionId: 'backup-status',
        }, 'api:backup-active');
      }
      if (installation.status === 'available' && installation.support !== 'none') {
        add({
          id: 'install:available', priority: PRIORITY.install, tone: TONE[PRIORITY.install],
          critical: false, dismissible: true, title: translate(locale, 'installAvailableTitle'),
          message: installation.nativeAvailable
            ? translate(locale, 'nativeAvailableMessage')
            : (installation.support === 'manual-ios'
              ? translate(locale, 'iosAvailableMessage')
              : translate(locale, 'genericAvailableMessage')),
          actionId: 'install',
        }, 'install:available');
      }
      if (network.recovery) {
        add({
          id: 'api:primary-restored', priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: translate(locale, 'restoredTitle'),
          message: translate(locale, 'restoredMessage'), actionId: 'diagnostics',
        }, 'api:primary-restored');
      }
      if (config.modules.updates && capabilityEnabled('updateNotifications') && network.updateAvailable) {
        add({
          id: 'app:update', priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: translate(locale, 'updateTitle'),
          message: translate(locale, 'updateMessage'), actionId: capabilityEnabled('userUpdate') ? 'update' : undefined,
        }, 'app:update');
      }
      config.features.forEach(function (feature) {
        add({
          id: 'feature:' + feature.id, priority: PRIORITY.info, tone: TONE[PRIORITY.info],
          critical: false, dismissible: true, title: feature.label,
          message: feature.message || translate(locale, 'featureDefaultMessage'),
          actionId: 'feature:' + feature.id,
        }, 'feature:' + feature.id);
      });

      lastConditionKeys.forEach(function (key) {
        if (activeKeys.has(key)) return;
        delete noticeStore.dismissed[noticeKey(project.id, key)];
        delete noticeStore.acknowledged[noticeKey(project.id, key)];
      });
      lastConditionKeys = activeKeys;
      saveNotices(project.id);

      out.sort(function (a, b) { return a.priority - b.priority; });
      out.forEach(function (notification) {
        notification.level = notificationLevel(notification.id, notification.priority);
      });
      return out;
    }

    function buildActions(project, installation, network, notifications, lang) {
      const locale = lang || resolveActiveLocale();
      const actions = [];
      function add(action) {
        if (actions.some(function (entry) { return entry.id === action.id; })) return;
        actions.push(action);
      }
      if (capabilityEnabled('diagnostics')) {
        add({
          id: 'diagnostics', label: translate(locale, 'actionDiagnosticsLabel'), icon: 'diagnostics',
          priority: notifications.some(function (n) { return n.critical; }) ? 1 : 5,
          kind: 'diagnostics', event: EVENT_NAMES.action, message: translate(locale, 'actionDiagnosticsMessage'),
        });
      }
      if (capabilityEnabled('recovery') && (!network.online || dnsFailure(network.dns) ||
          connectivityFailure(network.dns) || endpointFailure(network.endpoints))) {
        add({
          id: 'recovery', label: translate(locale, 'actionRecoveryLabel'), icon: 'recovery', priority: 1,
          kind: 'recovery', event: EVENT_NAMES.action, message: translate(locale, 'actionRecoveryMessage'),
        });
      }
      if (config.modules.installation && installation.status === 'available') {
        add({
          id: 'install', label: installation.nativeAvailable ? translate(locale, 'installActionLabel') : translate(locale, 'instructionsActionLabel'),
          icon: 'install', priority: 4, kind: 'install', event: EVENT_NAMES.action,
          message: installation.support === 'manual-ios' ? translate(locale, 'iosShortcutHint') : translate(locale, 'genericHint'),
        });
      }
      if (capabilityEnabled('failover') && (network.endpoints.backup === 'active' || network.endpoints.active === 'backup')) {
        add({
          id: 'backup-status', label: translate(locale, 'actionBackupLabel'), icon: 'backup', priority: 3,
          kind: 'backup', event: EVENT_NAMES.action, message: translate(locale, 'actionBackupMessage'),
        });
      }
      if (config.modules.updates && capabilityEnabled('userUpdate') && network.updateAvailable) {
        add({
          id: 'update', label: translate(locale, 'actionUpdateLabel'), icon: 'update', priority: 5,
          kind: 'update', event: EVENT_NAMES.action, message: translate(locale, 'actionUpdateMessage'),
        });
      }
      // Project-supplied actions are data, but they can address a gated
      // capability (`id: 'diagnostics'` or `kind: 'help'`): gate them through the
      // same policy so configuration can never expose what the flag disabled.
      config.actions.forEach(function (action) {
        if (isActionAllowed(config.modules, action)) add(action);
      });
      actions.sort(function (a, b) { return a.priority - b.priority; });
      return actions;
    }

    function computeState() {
      const project = projectInfo();
      const lang = resolveActiveLocale();
      const pwa = getPwa();
      const pwaSnapshot = readPwaSnapshot(pwa);
      let pwaHasUpdate = pwaSnapshot.hasUpdate;
      if (pwaHasUpdate === undefined && pwa && typeof pwa.hasUpdate === 'function') {
        try { pwaHasUpdate = Boolean(pwa.hasUpdate()); } catch (error) { /* ignore */ }
      }
      if (lastPwaHasUpdate === true && pwaHasUpdate === false) {
        conditions.updateAvailable = false;
      }
      if (typeof pwaHasUpdate === 'boolean') {
        lastPwaHasUpdate = pwaHasUpdate;
      }
      const installation = deriveInstallationState({
        pwa: pwa,
        enabled: config.modules.installation && capabilityEnabled('installationGuidance'),
        detection: capabilityEnabled('installationDetection'),
        installExperience: effectiveInstallConfig(),
      });
      const dns = {
        status: conditions.dns.status,
        classification: conditions.dns.classification,
        message: conditions.dns.message,
        checkedAt: conditions.dns.checkedAt,
      };
      if (typeof conditions.dns.cancelled === 'boolean') dns.cancelled = conditions.dns.cancelled;
      if (typeof conditions.dns.failed === 'boolean') dns.failed = conditions.dns.failed;
      const network = {
        online: conditions.online,
        dns: dns,
        endpoints: {
          primary: conditions.endpoints.primary,
          backup: conditions.endpoints.backup,
          active: conditions.endpoints.active,
          reason: conditions.endpoints.reason,
        },
        session: { state: conditions.session.state, message: conditions.session.message },
        // The toolkit records a waiting worker in its own snapshot before (or
        // without) a `pwa:update` event, so seed from it: otherwise an update
        // detected before the assistant bound stays invisible forever.
        updateAvailable: capabilityEnabled('updateDetection') && (conditions.updateAvailable || pwaHasUpdate === true),
        recovery: conditions.recovery,
      };
      const notifications = buildNotifications(project, installation, network, lang);
      const availableActions = buildActions(project, installation, network, notifications, lang);
      const top = notifications[0] || null;
      return {
        enabled: config.enabled,
        locale: lang,
        dir: isRtlLocale(lang) ? 'rtl' : 'ltr',
        project: project,
        installation: installation,
        network: network,
        capabilities: capabilitiesRecord(config.modules),
        notifications: notifications,
        availableActions: availableActions,
        badge: {
          count: notifications.length,
          tone: top ? top.tone : 'none',
          label: top ? top.title : translate(lang, 'noAlerts'),
          priority: top ? top.priority : null,
        },
        appearance: {
          position: config.position,
          offsets: { x: config.offsets.x, y: config.offsets.y },
          // `theme` keeps its original 0.x meaning: the mode string. The full
          // validated record travels in `themeConfig` so renderers can apply
          // custom tokens without a second configuration surface. No resolved
          // colours are published here: the renderer resolves them against the
          // live document so `auto` can follow the host.
          theme: config.themeMode || (config.theme && config.theme.mode) || 'auto',
          themeConfig: clone(config.theme || normalizeTheme('auto')),
          themeColor: project.themeColor,
        },
        dismissed: Object.keys(noticeStore.dismissed),
        acknowledged: Object.keys(noticeStore.acknowledged),
      };
    }

    function statesEqual(a, b) {
      if (a === b) return true;
      if (!a || !b) return false;
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch (error) {
        return false;
      }
    }

    function emit() {
      if (destroyed) return;
      const prevLocale = snapshot ? snapshot.locale : null;
      const next = computeState();
      // Snapshot identity stability. A repeated emit of an unchanged state must
      // not churn listeners, React `useSyncExternalStore` consumers (which would
      // re-render forever) or `localStorage`. Conditions are still re-evaluated
      // above, so dismissal resets and persistence keep happening.
      if (snapshot && statesEqual(snapshot, next)) return;
      snapshot = next;
      const doc = getDoc();
      if (shouldBindEvents) {
        try {
          const localeChanged = Boolean(prevLocale && prevLocale !== snapshot.locale);
          const CustomEventCtor = root.CustomEvent || (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
          if (localeChanged && CustomEventCtor && (exposeGlobal || envIn.window || rawInit.window || envIn.document || rawInit.document)) {
            const localeDetail = { locale: snapshot.locale, dir: snapshot.dir, configuredLocale: config.locale };
            if (doc && typeof doc.dispatchEvent === 'function') {
              doc.dispatchEvent(new CustomEventCtor(EVENT_NAMES.localeChange, { bubbles: false, detail: localeDetail }));
            }
            if (root && root !== doc && typeof root.dispatchEvent === 'function') {
              root.dispatchEvent(new CustomEventCtor(EVENT_NAMES.localeChange, { bubbles: false, detail: localeDetail }));
            }
          }
          if (exposeGlobal && doc && typeof doc.dispatchEvent === 'function' && CustomEventCtor) {
            doc.dispatchEvent(new CustomEventCtor(EVENT_NAMES.state, { detail: snapshot }));
          }
        } catch (error) { /* ignore */ }
      }
      listeners.forEach(function (listener) {
        try { listener(snapshot); } catch (error) { /* keep other listeners alive */ }
      });
    }

    function effectiveInstallConfig() {
      const domainInstall = domainContext().installExperience;
      const merged = normalizeInstallExperience(domainInstall, INSTALL_EXPERIENCE_DEFAULTS);
      const rawInstall = rawOptionsState && rawOptionsState.installExperience && typeof rawOptionsState.installExperience === 'object'
        ? rawOptionsState.installExperience
        : {};
      const cfgInstall = config.installExperience || INSTALL_EXPERIENCE_DEFAULTS;
      Object.keys(INSTALL_EXPERIENCE_DEFAULTS).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(rawInstall, key) ||
            JSON.stringify(cfgInstall[key]) !== JSON.stringify(INSTALL_EXPERIENCE_DEFAULTS[key])) {
          merged[key] = clone(cfgInstall[key]);
        }
      });
      if (merged.locale === 'auto' && config.locale && config.locale !== 'auto') {
        merged.locale = config.locale;
      }
      return normalizeInstallExperience(merged, INSTALL_EXPERIENCE_DEFAULTS);
    }

    function syncPwaInstallConfig() {
      const pwa = getPwa();
      if (!pwa || typeof pwa.configureInstallExperience !== 'function') return;
      try {
        pwa.configureInstallExperience(effectiveInstallConfig());
      } catch (error) { /* ignore */ }
    }

    function syncPwaSubscription() {
      if (unsubscribePwa || destroyed) return;
      const pwa = getPwa();
      if (pwa && typeof pwa.onChange === 'function') {
        try {
          unsubscribePwa = pwa.onChange(function (nextState) {
            if (nextState && typeof nextState === 'object' && typeof nextState.hasUpdate === 'boolean') {
              // Once the toolkit publishes an explicit availability snapshot it
              // owns that state; event-only and manual legacy signals are fallback
              // state only until this callback reconciles them.
              lastPwaHasUpdate = nextState.hasUpdate;
              conditions.updateAvailable = nextState.hasUpdate;
            }
            emit();
          });
        } catch (error) {
          unsubscribePwa = null;
        }
      }
    }

    const diagnosticsController = createDiagnosticsIntegration({
      // Live gate for asynchronous safety: the adapter re-checks it before the
      // runner starts and before a result is published.
      // Only the capability: `destroy()` already aborts its own run through
      // `clear()`, and that aborted run must stay a cancellation.
      isEnabled: function () { return capabilityEnabled('diagnostics'); },
      getLocale: function () { return resolveActiveLocale(); },
      get services() { return services; },
      getPwa: getPwa,
      getDns: getDns,
      getContext: function () {
        const project = projectInfo();
        return Object.assign({
          hostname: project.hostname,
          origin: project.origin,
          basePath: project.basePath,
          online: conditions.online,
        }, diagnosticsProbeContext());
      },
      onStart: function () {
        conditions.dns.status = 'running';
        emit();
      },
      onResult: function (result) {
        setDnsResult(result);
      },
    });

    // The probe paths come from the resolved domain registry entry, which is the
    // same source `pwa.js` uses for `runNetworkDiagnostics()`. They are read from
    // the resolution that produced the current host so the diagnostics context
    // and the identity can never disagree.
    function diagnosticsProbeContext(domain) {
      const resolved = domain === null || domain === undefined ? domainContext() : domain;
      const diagnostics = resolved.diagnostics && typeof resolved.diagnostics === 'object' ? resolved.diagnostics : {};
      return {
        appProbePath: typeof diagnostics.appProbePath === 'string' ? diagnostics.appProbePath : '',
        backendProbePath: typeof diagnostics.backendProbePath === 'string' ? diagnostics.backendProbePath : '',
      };
    }

    // `./health` and `health` resolve to the same URL, so they describe the same
    // diagnostic target and must not invalidate a published verdict. Root-relative
    // `/health` is deliberately *not* folded into `health`: on a subpath the two
    // resolve to different URLs.
    function normalizeProbeIdentity(value) {
      return typeof value === 'string' ? value.replace(/^(?:\.\/)+/, '') : '';
    }

    // A DNS verdict belongs to one effective diagnostic target: the project, the
    // host, the origin, the base path and the app/backend probe paths. Changing
    // any of them makes a published result stale.
    function dnsIdentity() {
      const project = projectInfo();
      const probes = diagnosticsProbeContext();
      return {
        id: project.id,
        hostname: project.hostname,
        origin: project.origin,
        basePath: project.basePath,
        appProbePath: normalizeProbeIdentity(probes.appProbePath),
        backendProbePath: normalizeProbeIdentity(probes.backendProbePath),
      };
    }

    function sameDnsIdentity(a, b) {
      return Boolean(a && b) &&
        a.id === b.id &&
        a.hostname === b.hostname &&
        a.origin === b.origin &&
        a.basePath === b.basePath &&
        a.appProbePath === b.appProbePath &&
        a.backendProbePath === b.backendProbePath;
    }

    function configure(nextOptions) {
      if (destroyed) return snapshot;
      const previousDnsIdentity = dnsIdentity();
      const baseGlobal = useGlobalConfig && root.YOU_GE_ASSISTANT_CONFIG && typeof root.YOU_GE_ASSISTANT_CONFIG === 'object'
        ? root.YOU_GE_ASSISTANT_CONFIG
        : {};
      const merged = Object.assign({}, baseGlobal, rawOptionsState, nextOptions || {});
      if (services.diagnostics && !(merged.services && typeof merged.services.diagnostics === 'function')) {
        merged.services = Object.assign({}, merged.services || {}, { diagnostics: services.diagnostics });
      }
      rawOptionsState = merged;
      resolvedBundle = resolveAssistantConfig(merged, {
        storage: getStorage(),
        fallbackProjectId: snapshot && snapshot.project ? snapshot.project.id : '',
      });
      config = resolvedBundle.config;
      configMeta = resolvedBundle.meta;
      services = config.services;
      // Disabling diagnostics while a run is in flight aborts it and retires its
      // result (generation-checked in the adapter), so a disabled capability can
      // never publish a verdict or a critical notice afterwards.
      if (!capabilityEnabled('diagnostics')) {
        diagnosticsController.clear();
        if (conditions.dns.status === 'running') {
          conditions.dns = normalizeDnsResult(disabledDiagnosticsResult(undefined, resolveActiveLocale()), DateCtor);
        }
      }
      persistPublishedLkgIfDerivedProject();
      // A DNS verdict belongs to one project on one hostname: when either
      // changes, the previous result is stale. Unrelated updates keep it.
      if (!sameDnsIdentity(previousDnsIdentity, dnsIdentity())) {
        diagnosticsController.clear();
        conditions.dns = { status: 'idle', classification: 'unknown', message: '', checkedAt: null };
        lastConditionKeys = new Set();
      }
      loadNotices(projectInfo().id);
      syncPwaSubscription();
      syncPwaInstallConfig();
      emit();
      return snapshot;
    }

    function setLocale(nextLocale, localeOptions) {
      if (destroyed) return snapshot;
      const cleaned = typeof nextLocale === 'string' && nextLocale.trim() ? nextLocale.trim() : 'auto';
      const fromPwa = Boolean(localeOptions && localeOptions.fromPwa);
      if (fromPwa) {
        syncingPwaLocale = true;
        try {
          configure({ locale: cleaned });
        } finally {
          syncingPwaLocale = false;
        }
        return snapshot;
      }
      configure({ locale: cleaned });
      const pwa = getPwa();
      if (pwa && typeof pwa.setLanguage === 'function' && !syncingPwaLocale) {
        try {
          syncingPwaLocale = true;
          pwa.setLanguage(cleaned, { fromAssistant: true });
        } catch (error) { /* ignore */ } finally {
          syncingPwaLocale = false;
        }
      }
      return snapshot;
    }

    function getConfig() {
      return {
        enabled: config.enabled,
        project: clone(config.project),
        projectId: config.projectId,
        domain: config.domain,
        locale: config.locale,
        position: config.position,
        offsets: { x: config.offsets.x, y: config.offsets.y },
        modules: clone(config.modules),
        notifications: clone(config.notifications),
        branding: clone(config.branding),
        actions: clone(config.actions),
        features: clone(config.features),
        installExperience: effectiveInstallConfig(),
        // Backward compatible string (0.x contract) plus the validated record.
        theme: config.themeMode || (config.theme && config.theme.mode) || 'auto',
        themeConfig: clone(config.theme || normalizeTheme('auto')),
        meta: clone(configMeta),
      };
    }

    function subscribe(listener, subOptions) {
      if (typeof listener !== 'function' || destroyed) return function () {};
      listeners.add(listener);
      listenerCounts.set(listener, (listenerCounts.get(listener) || 0) + 1);
      if (!subOptions || subOptions.immediate !== false) {
        try { listener(snapshot); } catch (error) { /* ignore */ }
      }
      let active = true;
      // Reference-counted: the same listener may be subscribed by several
      // components/widgets, and unsubscribing one must not silence the others.
      return function () {
        if (!active) return;
        active = false;
        const remaining = (listenerCounts.get(listener) || 0) - 1;
        if (remaining > 0) {
          listenerCounts.set(listener, remaining);
          return;
        }
        listenerCounts.delete(listener);
        listeners.delete(listener);
      };
    }

    function setConnectivity(online) {
      conditions.online = Boolean(online);
      emit();
      return snapshot;
    }

    function setEndpointStatus(detail) {
      const input = detail && typeof detail === 'object' ? detail : {};
      const allowedPrimary = ['unknown', 'healthy', 'failed', 'unavailable', 'degraded'];
      const allowedBackup = ['unknown', 'active', 'inactive', 'failed'];
      const allowedActive = ['primary', 'backup', 'unknown'];
      const previousActive = conditions.endpoints.active;
      if (allowedPrimary.indexOf(input.primary) !== -1) conditions.endpoints.primary = input.primary;
      if (allowedBackup.indexOf(input.backup) !== -1) conditions.endpoints.backup = input.backup;
      if (allowedActive.indexOf(input.active) !== -1) conditions.endpoints.active = input.active;
      conditions.endpoints.reason = safeText(input.reason, 200);
      if (previousActive === 'backup' && conditions.endpoints.active === 'primary' && conditions.endpoints.primary === 'healthy') {
        conditions.recovery = true;
      }
      if (conditions.endpoints.active !== 'primary') conditions.recovery = false;
      emit();
      return snapshot;
    }

    function setSessionStatus(detail) {
      const input = detail && typeof detail === 'object' ? detail : {};
      if (['unknown', 'ok', 'issue'].indexOf(input.state) !== -1) conditions.session.state = input.state;
      conditions.session.message = safeText(input.message, 200);
      emit();
      return snapshot;
    }

    function setDnsResult(result) {
      conditions.dns = normalizeDnsResult(result, DateCtor);
      emit();
      return snapshot;
    }

    function setUpdateAvailable(available) {
      conditions.updateAvailable = available !== false;
      emit();
      return snapshot;
    }

    function runDiagnostics(runOptions) {
      const lang = resolveActiveLocale();
      if (destroyed) {
        return Promise.resolve({ classification: 'unknown', message: translate(lang, 'diagDestroyed'), status: 'unavailable' });
      }
      if (!capabilityEnabled('diagnostics')) {
        const disabled = disabledDiagnosticsResult(undefined, lang);
        setDnsResult(disabled);
        return Promise.resolve(disabled);
      }
      // Single-flight and cancellation hygiene live in the diagnostics adapter:
      // it owns one controller per run (bridging an optional caller signal) and
      // aborts it from `clear()`, which `destroy()` calls.
      return diagnosticsController.run(runOptions);
    }

    function requestInstall(promptOptions) {
      if (destroyed) return Promise.resolve({ outcome: 'unsupported' });
      return requestPwaInstall({
        pwa: getPwa(),
        enabled: config.modules.installation && capabilityEnabled('installationGuidance'),
      }, promptOptions);
    }

    function showInstallDialog(dialogOptions) {
      if (destroyed) return Promise.resolve({ shown: false, outcome: 'unsupported', backend: 'none' });
      const installCfg = effectiveInstallConfig();
      const enabled = Boolean(config.modules.installation && capabilityEnabled('installationGuidance') && installCfg.enabled !== false);
      return showPwaInstallDialog({
        pwa: getPwa(),
        enabled: enabled,
      }, Object.assign({ installExperience: installCfg }, dialogOptions || {}));
    }

    function hideInstallDialog() {
      if (destroyed) return false;
      const hidden = hidePwaInstallDialog({ pwa: getPwa() });
      emit();
      return hidden;
    }

    function triggerInstall(promptOptions) {
      if (destroyed) return Promise.resolve({ outcome: 'unsupported', backend: 'none' });
      return triggerPwaInstall({
        pwa: getPwa(),
        enabled: config.modules.installation && capabilityEnabled('installationGuidance'),
      }, promptOptions);
    }

    function getInstalledRelatedApps() {
      if (destroyed) return Promise.resolve([]);
      return readInstalledRelatedApps({
        pwa: getPwa(),
        navigator: getNavigator(),
        detection: capabilityEnabled('installationDetection'),
      });
    }

    function applyUpdate() {
      if (destroyed) return Promise.resolve({ applied: false, outcome: 'unsupported' });
      return requestPwaUpdate({
        pwa: getPwa(),
        enabled: config.modules.updates !== false && capabilityEnabled('userUpdate'),
      }).then(function (result) {
        if (!destroyed && result && !result.applied && result.outcome === 'no-waiting-worker') {
          const pwa = getPwa();
          const pwaSnapshot = readPwaSnapshot(pwa);
          let hasUpdate = pwaSnapshot.hasUpdate;
          if (hasUpdate === undefined && pwa && typeof pwa.hasUpdate === 'function') {
            try { hasUpdate = Boolean(pwa.hasUpdate()); } catch (error) { /* ignore */ }
          }
          if (hasUpdate !== true) {
            conditions.updateAvailable = false;
            emit();
          }
        }
        return result;
      });
    }

    function runOfflineDiagnostics() {
      if (destroyed) return Promise.resolve({ status: 'unavailable' });
      if (!capabilityEnabled('offlineDiagnostics')) return Promise.resolve({ status: 'disabled' });
      const nav = getNavigator();
      const online = nav && typeof nav.onLine === 'boolean' ? nav.onLine : null;
      return Promise.resolve({ status: online === null ? 'unavailable' : (online ? 'online' : 'offline'), online: online });
    }

    function runCacheDiagnostics() {
      if (destroyed) return Promise.resolve({ status: 'unavailable' });
      if (!capabilityEnabled('cacheDiagnostics')) return Promise.resolve({ status: 'disabled' });
      const pwa = getPwa();
      if (!pwa || typeof pwa.runCacheDiagnostics !== 'function') return Promise.resolve({ status: 'unavailable' });
      try {
        return Promise.resolve(pwa.runCacheDiagnostics()).then(function (result) {
          if (destroyed || !capabilityEnabled('cacheDiagnostics')) return { status: 'disabled' };
          return result;
        }, function () { return { status: 'unavailable' }; });
      } catch (error) { return Promise.resolve({ status: 'unavailable' }); }
    }

    function dismiss(id) {
      const safeId = safeText(id, 80);
      const notification = (snapshot && snapshot.notifications || []).filter(function (entry) { return entry.id === safeId; })[0];
      if (!notification) return false;
      if (notification.critical && config.notifications.criticalPersistent) return false;
      noticeStore.dismissed[noticeKey(snapshot.project.id, safeId)] = new DateCtor().toISOString();
      saveNotices(snapshot.project.id);
      emit();
      return true;
    }

    function acknowledge(id) {
      const safeId = safeText(id, 80);
      noticeStore.acknowledged[noticeKey(snapshot.project.id, safeId)] = new DateCtor().toISOString();
      saveNotices(snapshot.project.id);
      emit();
      return true;
    }

    const handlers = {
      online: function () { conditions.online = true; emit(); },
      offline: function () { conditions.online = false; emit(); },
      visibility: function () {
        const doc = getDoc();
        if (doc && doc.visibilityState === 'hidden') return;
        syncPwaSubscription();
        emit();
      },
      endpoint: function (event) { setEndpointStatus(event && event.detail); },
      session: function (event) { setSessionStatus(event && event.detail); },
      dns: function (event) { setDnsResult((event && event.detail) || {}); },
      pwaReady: function (event) { if (event && event.__youGeBridged) return; syncPwaSubscription(); emit(); },
      installable: function (event) { if (event && event.__youGeBridged) return; syncPwaSubscription(); emit(); },
      installed: function (event) { if (event && event.__youGeBridged) return; syncPwaSubscription(); emit(); },
      update: function (event) { if (event && event.__youGeBridged) return; conditions.updateAvailable = true; emit(); },
      diagnostics: function (event) { if (event && event.__youGeBridged) return; setDnsResult((event && event.detail) || {}); },
      installDialog: function (event) { if (event && event.__youGeBridged) return; syncPwaSubscription(); emit(); },
      yougePwaReady: function () { syncPwaSubscription(); emit(); },
      yougeInstallable: function () { syncPwaSubscription(); emit(); },
      yougeInstalled: function () { syncPwaSubscription(); emit(); },
      yougeUpdate: function () { conditions.updateAvailable = true; emit(); },
      yougeDiagnostics: function (event) { setDnsResult((event && event.detail) || {}); },
      yougeInstallDialog: function () { syncPwaSubscription(); emit(); },
      action: function () { /* widgets dispatch actions; host apps listen. No state change. */ },
      storage: function (event) {
        if (!event || !event.key || event.key.indexOf(STORAGE_PREFIXES.notices) !== 0) return;
        loadNotices(snapshot ? snapshot.project.id : projectInfo().id);
        emit();
      },
      languagechange: function () {
        if (config.locale === 'auto') {
          syncPwaInstallConfig();
          emit();
        }
      },
    };

    function bindOnce() {
      if (bound || !shouldBindEvents) return;
      bound = true;
      const doc = getDoc();
      if (typeof root.addEventListener === 'function') {
        root.addEventListener('online', handlers.online);
        root.addEventListener('offline', handlers.offline);
        root.addEventListener('storage', handlers.storage);
        root.addEventListener('languagechange', handlers.languagechange);
      }
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('visibilitychange', handlers.visibility);
        doc.addEventListener(EVENT_NAMES.endpointStatus, handlers.endpoint);
        doc.addEventListener(EVENT_NAMES.sessionStatus, handlers.session);
        doc.addEventListener(EVENT_NAMES.dnsResult, handlers.dns);
        doc.addEventListener(EVENT_NAMES.yougePwaReady, handlers.yougePwaReady);
        doc.addEventListener(EVENT_NAMES.yougePwaInstallable, handlers.yougeInstallable);
        doc.addEventListener(EVENT_NAMES.yougePwaInstalled, handlers.yougeInstalled);
        doc.addEventListener(EVENT_NAMES.yougePwaUpdate, handlers.yougeUpdate);
        doc.addEventListener(EVENT_NAMES.yougePwaDiagnostics, handlers.yougeDiagnostics);
        doc.addEventListener(EVENT_NAMES.yougePwaInstallDialog, handlers.yougeInstallDialog);
        doc.addEventListener(EVENT_NAMES.pwaReady, handlers.pwaReady);
        doc.addEventListener(EVENT_NAMES.pwaInstallable, handlers.installable);
        doc.addEventListener(EVENT_NAMES.pwaInstalled, handlers.installed);
        doc.addEventListener(EVENT_NAMES.pwaUpdate, handlers.update);
        doc.addEventListener(EVENT_NAMES.pwaDiagnostics, handlers.diagnostics);
        doc.addEventListener(EVENT_NAMES.pwaInstallDialog, handlers.installDialog);
        doc.addEventListener(EVENT_NAMES.action, handlers.action);
      }
      syncPwaSubscription();
      syncPwaInstallConfig();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      const doc = getDoc();
      if (bound) {
        if (typeof root.removeEventListener === 'function') {
          root.removeEventListener('online', handlers.online);
          root.removeEventListener('offline', handlers.offline);
          root.removeEventListener('storage', handlers.storage);
          root.removeEventListener('languagechange', handlers.languagechange);
        }
        if (doc && typeof doc.removeEventListener === 'function') {
          doc.removeEventListener('visibilitychange', handlers.visibility);
          doc.removeEventListener(EVENT_NAMES.endpointStatus, handlers.endpoint);
          doc.removeEventListener(EVENT_NAMES.sessionStatus, handlers.session);
          doc.removeEventListener(EVENT_NAMES.dnsResult, handlers.dns);
          doc.removeEventListener(EVENT_NAMES.yougePwaReady, handlers.yougePwaReady);
          doc.removeEventListener(EVENT_NAMES.yougePwaInstallable, handlers.yougeInstallable);
          doc.removeEventListener(EVENT_NAMES.yougePwaInstalled, handlers.yougeInstalled);
          doc.removeEventListener(EVENT_NAMES.yougePwaUpdate, handlers.yougeUpdate);
          doc.removeEventListener(EVENT_NAMES.yougePwaDiagnostics, handlers.yougeDiagnostics);
          doc.removeEventListener(EVENT_NAMES.yougePwaInstallDialog, handlers.yougeInstallDialog);
          doc.removeEventListener(EVENT_NAMES.pwaReady, handlers.pwaReady);
          doc.removeEventListener(EVENT_NAMES.pwaInstallable, handlers.installable);
          doc.removeEventListener(EVENT_NAMES.pwaInstalled, handlers.installed);
          doc.removeEventListener(EVENT_NAMES.pwaUpdate, handlers.update);
          doc.removeEventListener(EVENT_NAMES.pwaDiagnostics, handlers.diagnostics);
          doc.removeEventListener(EVENT_NAMES.pwaInstallDialog, handlers.installDialog);
          doc.removeEventListener(EVENT_NAMES.action, handlers.action);
        }
      }
      if (unsubscribePwa) {
        try { unsubscribePwa(); } catch (error) { /* ignore */ }
        unsubscribePwa = null;
      }
      listeners.clear();
      listenerCounts.clear();
      diagnosticsController.clear();
    }

    const api = {
      __state: true,
      version: SDK_VERSION,
      PRIORITY: PRIORITY,
      create: function (opts, envOpts) { return createAssistant(opts, envOpts); },
      attach: function (opts, envOpts) { return attachAssistant(opts, envOpts); },
      configure: configure,
      getConfig: getConfig,
      getState: function () { return snapshot; },
      getLocale: function () { return snapshot ? snapshot.locale : resolveActiveLocale(); },
      setLocale: setLocale,
      subscribe: subscribe,
      setConnectivity: setConnectivity,
      setEndpointStatus: setEndpointStatus,
      setSessionStatus: setSessionStatus,
      setDnsResult: setDnsResult,
      setUpdateAvailable: setUpdateAvailable,
      runDiagnostics: runDiagnostics,
      runOfflineDiagnostics: runOfflineDiagnostics,
      runCacheDiagnostics: runCacheDiagnostics,
      // Read-only capability introspection, used by renderers and by the classic
      // runtime files that delegate to the toolkit (pwa.js, offline.js, DoH).
      isCapabilityEnabled: function (capability) { return capabilityEnabled(capability); },
      getInstallConfig: effectiveInstallConfig,
      requestInstall: requestInstall,
      showInstallDialog: showInstallDialog,
      hideInstallDialog: hideInstallDialog,
      triggerInstall: triggerInstall,
      getInstalledRelatedApps: getInstalledRelatedApps,
      applyUpdate: applyUpdate,
      dismiss: dismiss,
      acknowledge: acknowledge,
      isDestroyed: function () { return destroyed; },
      destroy: destroy,
    };

    persistPublishedLkgIfDerivedProject();
    loadNotices(projectInfo().id);
    bindOnce();
    if (!snapshot) emit();

    if (exposeGlobal) {
      root.YouGeAssistant = api;
    }

    return api;
  }
  function getGlobalAssistant(targetRoot) {
    const root = targetRoot || (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!root || !root.YouGeAssistant || !root.YouGeAssistant.__state) return null;
    if (typeof root.YouGeAssistant.isDestroyed === 'function' && root.YouGeAssistant.isDestroyed()) return null;
    return root.YouGeAssistant;
  }
  function attachAssistant(options, envOverrides) {
    const envIn = envOverrides && typeof envOverrides === 'object' ? envOverrides : {};
    const root = envIn.root || envIn.window || (options && options.window) || (typeof globalThis !== 'undefined' ? globalThis : {});
    const existing = getGlobalAssistant(root);
    if (existing) {
      if (!existing.create) existing.create = createAssistant;
      if (!existing.attach) existing.attach = attachAssistant;
      if (!existing.version) existing.version = SDK_VERSION;
      if (options && typeof options === 'object' && Object.keys(options).length > 0 && typeof existing.configure === 'function') {
        existing.configure(options);
      }
      return existing;
    }
    return createAssistant(options, Object.assign({}, envIn, {
      root: root,
      useGlobalConfig: envIn.useGlobalConfig !== false,
      exposeGlobal: true,
    }));
  }

  var api = attachAssistant(root.YOU_GE_ASSISTANT_CONFIG || {}, {
    root: root,
    useGlobalConfig: true,
  });

  root.YouGeAssistantSDK = {
    version: SDK_VERSION,
    kitCompatVersion: KIT_COMPAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    PRIORITY: PRIORITY,
    EVENT_NAMES: EVENT_NAMES,
    create: createAssistant,
    attach: attachAssistant,
    // Module capability policy: one mapping shared by every classic renderer
    // and runtime file, so a gated capability cannot be re-enabled locally.
    GATED_CAPABILITIES: GATED_CAPABILITIES,
    // Unified i18n dictionary, locale resolver, plural helpers and DNS copy.
    DEFAULT_LOCALE: DEFAULT_LOCALE,
    SUPPORTED_LOCALES: SUPPORTED_LOCALES,
    RTL_LOCALES: RTL_LOCALES,
    LOCALE_METADATA: LOCALE_METADATA,
    SDK_TRANSLATIONS: SDK_TRANSLATIONS,
    DNS_CLASSIFICATION_LABELS: DNS_CLASSIFICATION_LABELS,
    normalizeLocaleTag: normalizeLocaleTag,
    normalizeInstallLocaleTag: normalizeInstallLocaleTag,
    resolveLocale: resolveLocale,
    isRtlLocale: isRtlLocale,
    translate: translate,
    chromeHandoffLabels: chromeHandoffLabels,
    formatAlertCount: formatAlertCount,
    localizeDnsClassification: localizeDnsClassification,
    localizeDnsMessage: localizeDnsMessage,
    isCapabilityEnabled: isCapabilityEnabled,
    capabilityForAction: capabilityForAction,
    capabilitiesRecord: capabilitiesRecord,
    disabledDiagnosticsResult: disabledDiagnosticsResult,
    getGlobal: getGlobalAssistant,
    resolveDomain: resolveDomain,
    detectRuntimeHostname: detectRuntimeHostname,
    buildManifest: buildManifest,
    validateDomainConfig: validateDomainConfig,
    validateDomainConfigDetailed: validateDomainConfigDetailed,
    validateDomainRegistry: validateDomainRegistry,
    domain: createDomainResolver(root.YOU_GE_DOMAIN_REGISTRY || {}),
    validatePublishedConfig: validatePublishedConfig,
    INSTALL_EXPERIENCE_DEFAULTS: INSTALL_EXPERIENCE_DEFAULTS,
    normalizeInstallExperience: normalizeInstallExperience,
    resolveInstallationCopy: resolveInstallationCopy,
    showPwaInstallDialog: showPwaInstallDialog,
    hidePwaInstallDialog: hidePwaInstallDialog,
    triggerPwaInstall: triggerPwaInstall,
    readInstalledRelatedApps: readInstalledRelatedApps,
    // Adaptive theming — same validation/resolution in classic and ESM pages.
    THEME_MODES: THEME_MODES,
    THEME_TOKEN_KEYS: THEME_TOKEN_KEYS,
    NOTIFICATION_LEVELS: NOTIFICATION_LEVELS,
    NOTIFICATION_LEVEL_ICONS: NOTIFICATION_LEVEL_ICONS,
    NOTIFICATION_LEVEL_SHAPES: NOTIFICATION_LEVEL_SHAPES,
    NOTIFICATION_LEVEL_SVG_ATTRIBUTES: NOTIFICATION_LEVEL_SVG_ATTRIBUTES,
    notificationLevelMarkup: notificationLevelMarkup,
    normalizeNotificationLevel: normalizeNotificationLevel,
    NOTIFICATION_LEVEL_LABELS: NOTIFICATION_LEVEL_LABELS,
    normalizeTheme: normalizeTheme,
    resolveTheme: resolveTheme,
    detectHostScheme: detectHostScheme,
    contrastRatio: contrastRatio,
    detectInAppBrowser: detectInAppBrowser,
    isChromeHandoffCandidate: isChromeHandoffCandidate,
    buildChromeIntentUrl: buildChromeIntentUrl,
    chromeHandoffInstructions: chromeHandoffInstructions,
    createChromeHandoff: createChromeHandoff,
  };

  root.YouGeAssistant = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
