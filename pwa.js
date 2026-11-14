/*!
 * pwa.js — You.Ge Assistant self-hosted PWA client
 * ------------------------------------------------------------------------
 * Features:
 *   - service worker registration + update flow
 *   - install prompt capture, `[data-pwa-install]` buttons, iOS instructions
 *   - optional floating app-icon install toolbox (legacy compatibility preserved)
 *   - standalone / installed detection
 *   - optional push subscriptions (VAPID)
 *   - app badge helpers
 *   - Web Share Target file retrieval
 *   - `web+pwa:` protocol redirects
 *   - optional install/launch event beacon
 *
 * Usage:
 *   <script src="/pwa.js" defer></script>
 *
 * Configuration through data attributes on the script tag:
 *   data-sw="/progressier.js"      service worker URL
 *   data-sw-scope="/"              service worker scope
 *   data-manifest="/manifest.webmanifest"
 *   data-analytics="/api/pwa-events"   optional beacon endpoint
 *   data-push-endpoint="/api/push/subscribe"  default push endpoint
 *   data-auto-update               apply updates without asking
 *   data-toolbox                   show the floating install launcher
 *   data-toolbox-position="right"  position the floating launcher
 *   data-no-meta                   don't inject manifest/apple meta tags
 *   data-allow-external-protocol   allow web+pwa: redirects to other origins
 *   data-csp-nonce="..."           nonce for the injected stylesheet
 *   data-debug                     verbose logging
 *
 * Public API: window.PWA (see README.md)
 */
(function () {
  'use strict';

  if (window.PWA && window.PWA.__pwaKit) return;

  /* ------------------------------------------------------------------ *
   * Configuration
   * ------------------------------------------------------------------ */

  var script = document.currentScript;
  if (!script) {
    var scripts = document.querySelectorAll('script[src*="pwa.js"]');
    script = scripts[scripts.length - 1] || null;
  }
  var dataset = (script && script.dataset) || {};
  var runtimeBasePath = '/';
  try {
    runtimeBasePath = new URL(dataset.basePath || './', (script && script.src) || window.location.href).pathname;
  } catch (error) {
    runtimeBasePath = '/';
  }
  var domainResolver = (window.YouGeDomain && typeof window.YouGeDomain.resolve === 'function' && window.YouGeDomain) ||
    (window.YouGeAssistantSDK && window.YouGeAssistantSDK.domain && typeof window.YouGeAssistantSDK.domain.resolve === 'function' && window.YouGeAssistantSDK.domain) ||
    null;
  var domainConfig = domainResolver
    ? domainResolver.resolve({
        hostname: window.location.hostname,
        origin: window.location.origin,
        protocol: window.location.protocol,
        pathname: window.location.pathname,
        basePath: runtimeBasePath,
      })
    : {
        identity: { name: 'You.Ge Assistant', shortName: 'You.Ge', description: 'Your installable, offline-ready web assistant.' },
        branding: { themeColor: '#155eef', backgroundColor: '#f8fafc', icon: 'icons/icon-192.png' },
        pwa: { enabled: true, startUrl: './?launchedfrom=homescreen', scope: './', display: 'standalone' },
        features: { installation: true, offline: true, sharing: true, push: true, badges: true, qr: true, diagnostics: true, dnsRecovery: true },
        domain: { hostname: window.location.hostname, origin: window.location.origin, protocol: window.location.protocol, pathname: window.location.pathname, basePath: '/' },
      };

  // Everything the kit requests is resolved against the directory that serves
  // pwa.js. That keeps the same defaults working at the origin root (/) and
  // under a subpath (/app/, GitHub Pages project sites) with no configuration.
  var scriptUrl = (script && script.src) || window.location.href;
  var baseUrl = scriptUrl.replace(/[^/]*$/, '');

  function resolveUrl(value) {
    if (!value) return value;
    try {
      return new URL(value, baseUrl).href;
    } catch (error) {
      return value;
    }
  }

  var config = {
    baseUrl: baseUrl,
    swUrl: resolveUrl(dataset.sw || 'progressier.js'),
    swScope: '',
    manifestUrl: resolveUrl(dataset.manifest || 'manifest.webmanifest'),
    cssUrl: resolveUrl(dataset.css || 'pwa.css'),
    analytics: dataset.analytics || '',
    pushEndpoint: dataset.pushEndpoint || '',
    vapidPublicKey: dataset.vapidPublicKey || '',
    icon: resolveUrl(dataset.icon || domainConfig.branding.icon || 'icons/icon-192.png'),
    splashIcon: resolveUrl(dataset.splashIcon || domainConfig.branding.splashIcon || 'icons/icon-512.png'),
    qrLibraryUrl: resolveUrl(dataset.qrLibrary || 'qrcode.js'),
    qrLogo: dataset.qrLogo || '',
    desktopQr: 'desktopQr' in dataset,
    appName: dataset.appName || domainConfig.identity.name,
    themeColor: dataset.themeColor || domainConfig.branding.themeColor,
    startUrl: resolveUrl(dataset.startUrl || domainConfig.pwa.startUrl || '?launchedfrom=homescreen'),
    domain: domainConfig.domain,
    domainConfig: domainConfig,
    features: domainConfig.features,
    itunesAppId: dataset.itunesAppId || '',
    viewportFit: 'viewportFit' in dataset,
    autoUpdate: 'autoUpdate' in dataset,
    noMeta: 'noMeta' in dataset,
    noCss: 'noCss' in dataset,
    noSplash: 'noSplash' in dataset,
    installBanner: 'installBanner' in dataset,
    pushBanner: 'pushBanner' in dataset,
    offlineAlert: 'offlineAlert' in dataset,
    toolbox: 'toolbox' in dataset,
    toolboxOff: 'toolboxOff' in dataset,
    toolboxPosition: dataset.toolboxPosition || 'right',
    toolboxColor: dataset.toolboxColor || '',
    toolboxImage: dataset.toolboxImg ? resolveUrl(dataset.toolboxImg) : '',
    toolboxUseLogo: 'toolboxUseLogo' in dataset && dataset.toolboxUseLogo !== 'false',
    toolboxHideStandalone: dataset.toolboxHideStandalone !== 'false',
    toolboxShowPlatforms: dataset.toolboxShowPlatforms || 'all',
    toolboxShowUrls: dataset.toolboxShowUrls || '',
    welcome: 'welcome' in dataset,
    allowExternalProtocol: 'allowExternalProtocol' in dataset,
    nonce: dataset.cspNonce || '',
    debug: 'debug' in dataset,
  };

  // Scope defaults to the resolved app scope only when that scope is within
  // the worker's directory. A broader scope is never requested implicitly.
  try {
    var workerDirectory = new URL('./', config.swUrl);
    if (dataset.swScope) {
      var explicitScope = new URL(dataset.swScope, baseUrl);
      if (explicitScope.origin !== workerDirectory.origin) throw new Error('service-worker scope must be same-origin');
      config.swScope = explicitScope.pathname;
    } else {
      var appScope = new URL(domainConfig.pwa.scope || './', config.manifestUrl);
      config.swScope = appScope.origin === workerDirectory.origin && appScope.pathname.startsWith(workerDirectory.pathname)
        ? appScope.pathname
        : workerDirectory.pathname;
    }
  } catch (error) {
    config.swScope = new URL('./', config.swUrl).pathname;
  }


  function log() {
    if (!config.debug) return;
    try {
      console.log.apply(console, ['[PWA]'].concat(Array.prototype.slice.call(arguments)));
    } catch (error) {
      /* ignore */
    }
  }

  /* ------------------------------------------------------------------ *
   * Platform detection
   * ------------------------------------------------------------------ */

  var ua = navigator.userAgent || '';

  function isIOS() {
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ reports itself as Macintosh.
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  }

  function isSafari() {
    return /Safari/.test(ua) && !/Chrome|CriOS|Edg|OPR|Firefox|FxiOS|SamsungBrowser/.test(ua);
  }

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    } catch (error) {
      /* ignore */
    }
    if (navigator.standalone === true) return true;
    if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
    return false;
  }

  function getParam(name) {
    try {
      return new URL(window.location.href).searchParams.get(name);
    } catch (error) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * State + subscribers
   * ------------------------------------------------------------------ */

  var listeners = new Set();
  var installPromptEvent = null;
  var updateAvailable = false;
  var registration = null;
  var reloading = false;
  var installed = isStandalone();
  var launchSource = getParam('launchedfrom') || 'browser';

  if (launchSource === 'homescreen') installed = true;

  function isUpdateAvailable() {
    return updateAvailable || Boolean(registration && registration.waiting);
  }

  function getState() {
    return {
      standalone: isStandalone(),
      installed: installed || isStandalone(),
      canInstall: Boolean(installPromptEvent),
      hasUpdate: isUpdateAvailable(),
      ios: isIOS(),
      safari: isSafari(),
      launchSource: launchSource,
      hostname: domainConfig.domain.hostname,
      origin: domainConfig.domain.origin,
      basePath: domainConfig.domain.basePath,
      pushSupported: pushSupported(),
      pushPermission: 'Notification' in window ? Notification.permission : 'denied',
    };
  }

  function emit() {
    var state = getState();
    try {
      var mode = 'browser';
      if (state.standalone) mode = 'standalone';
      else if (state.installed) mode = 'installed';
      document.documentElement.dataset.pwaState = mode;
      document.documentElement.classList.toggle('pwa-standalone', state.standalone);
      document.documentElement.classList.toggle('pwa-can-install', state.canInstall);
      document.documentElement.classList.toggle('pwa-installed', state.installed);
    } catch (error) {
      /* ignore */
    }
    listeners.forEach(function (listener) {
      try {
        listener(state);
      } catch (error) {
        log('listener failed', error);
      }
    });
  }

  function refreshDom() {
    var standalone = isStandalone();
    var isInstalled = installed || standalone;

    document.querySelectorAll('[data-pwa-install]').forEach(function (element) {
      if (isInstalled || domainConfig.features.installation === false || domainConfig.pwa.enabled === false) element.hidden = true;
    });
    document.querySelectorAll('[data-pwa-hide-standalone]').forEach(function (element) {
      if (standalone) element.hidden = true;
    });
    document.querySelectorAll('[data-pwa-show-standalone]').forEach(function (element) {
      if (!standalone) element.hidden = true;
    });
  }

  function refreshState() {
    emit();
    refreshDom();
  }

  function onChange(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    try {
      listener(getState());
    } catch (error) {
      log('listener failed', error);
    }
    return function () {
      listeners.delete(listener);
    };
  }

  /* ------------------------------------------------------------------ *
   * Events / analytics
   * ------------------------------------------------------------------ */

  function dispatch(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent('pwa:' + name, { detail: detail }));
    } catch (error) {
      /* ignore */
    }
  }

  function track(name, detail) {
    dispatch('event', { name: name, detail: detail || null });
    if (!config.analytics) return;
    try {
      var payload = JSON.stringify({
        event: name,
        detail: detail || null,
        launchSource: launchSource,
        url: window.location.href,
        ts: Date.now(),
      });
      if (navigator.sendBeacon) {
        // text/plain keeps the beacon a "simple" request (no preflight).
        navigator.sendBeacon(config.analytics, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
      } else {
        fetch(config.analytics, {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(function () {});
      }
    } catch (error) {
      log('analytics failed', error);
    }
  }

  /* ------------------------------------------------------------------ *
   * Head tags
   * ------------------------------------------------------------------ */

  function addMeta(name, content) {
    if (content == null || content === '') return null;
    if (document.querySelector('meta[name="' + name + '"]')) return null;
    var meta = document.createElement('meta');
    meta.name = name;
    meta.content = content;
    document.head.appendChild(meta);
    return meta;
  }

  function addProperty(property, content) {
    if (content == null || content === '') return null;
    if (document.querySelector('meta[property="' + property + '"]')) return null;
    var meta = document.createElement('meta');
    meta.setAttribute('property', property);
    meta.content = content;
    document.head.appendChild(meta);
    return meta;
  }

  function appName() {
    return config.appName || domainConfig.identity.name || document.title || window.location.hostname;
  }

  function themeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    return config.themeColor || (meta && meta.getAttribute('content')) || '#ffffff';
  }

  function absoluteStartUrl() {
    try {
      return new URL(config.startUrl, window.location.origin).href;
    } catch (error) {
      return window.location.origin + '/';
    }
  }

  function ensureHeadTags() {
    if (config.noMeta) return;

    var manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = config.manifestUrl;
      document.head.appendChild(manifestLink);
    } else {
      // Replace a leftover legacy hosted manifest link automatically.
      var href = manifestLink.getAttribute('href') || '';
      if (href.indexOf('progressier.app') !== -1 || href.indexOf('progressier.com') !== -1) {
        manifestLink.href = config.manifestUrl;
      }
    }
    var appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.sizes = '180x180';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = resolveUrl(domainConfig.branding.appleTouchIcon || domainConfig.branding.icon);
    var pngFavicon = document.querySelector('link[rel="icon"][type="image/png"]');
    if (!pngFavicon) {
      pngFavicon = document.createElement('link');
      pngFavicon.rel = 'icon';
      pngFavicon.type = 'image/png';
      pngFavicon.sizes = '32x32';
      document.head.appendChild(pngFavicon);
    }
    pngFavicon.href = resolveUrl(domainConfig.branding.favicon || 'icons/favicon-32.png');

    var color = themeColor();
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) addMeta('theme-color', color);
    else if (config.themeColor) themeMeta.setAttribute('content', color);

    var name = appName();
    var startUrl = absoluteStartUrl();

    var description = domainConfig.identity.description;
    if (!domainConfig.domain.configured) {
      var existingDescription = document.querySelector('meta[name="description"]');
      if (existingDescription && existingDescription.content) description = existingDescription.content;
    }
    addMeta('application-name', name);
    addMeta('description', description);
    addMeta('apple-mobile-web-app-title', name);
    addProperty('og:site_name', name);
    addProperty('og:title', document.title || name);
    addProperty('og:description', description);
    addProperty('og:url', window.location.origin + window.location.pathname);
    addProperty('og:type', 'website');
    Object.keys(domainConfig.metadata || {}).forEach(function (key) {
      var value = domainConfig.metadata[key];
      if (key.indexOf('og:') === 0 || key.indexOf('twitter:') === 0) addProperty(key, value);
    });
    if (!document.querySelector('link[rel="canonical"]')) {
      var canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = window.location.origin + window.location.pathname;
      document.head.appendChild(canonical);
    }
    addMeta('apple-touch-fullscreen', 'yes');
    addMeta('apple-mobile-web-app-capable', 'yes');
    addMeta('mobile-web-app-capable', 'yes');
    addMeta('apple-mobile-web-app-status-bar-style', 'default');

    // Windows / Edge legacy tiles
    addMeta('msapplication-starturl', startUrl);
    addMeta('msapplication-navbutton-color', color);
    addMeta('msapplication-TileColor', color);
    addMeta('msapplication-TileImage', resolveUrl('icons/icon-144.png'));
    addMeta('msapplication-config', resolveUrl('browserconfig.xml'));

    // Old Android / Chinese browsers
    addMeta('x5-fullscreen', 'true');
    addMeta('x5-page-mode', 'app');
    addMeta('browsermode', 'application');
    addMeta('full-screen', 'yes');
    addProperty('al:web:url', startUrl);

    if (config.itunesAppId) addMeta('apple-itunes-app', 'app-id=' + config.itunesAppId);

    if (config.viewportFit && (isIOS() || isStandalone())) {
      var viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        var content = viewport.getAttribute('content') || '';
        if (content.indexOf('viewport-fit=cover') === -1) {
          viewport.setAttribute('content', content + ', viewport-fit=cover');
        }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Apple splash screens
   * ------------------------------------------------------------------ *
   * The hosted client rendered splash images on the device for the exact
   * screen it is running on. These dimensions are the screen points and
   * pixel ratios used by current iPhones and iPads.
   */

  var SPLASH_SCREENS = [
    { w: 890, h: 626, r: 3 },
    { w: 466, h: 678, r: 3 },
    { w: 440, h: 956, r: 3 },
    { w: 402, h: 874, r: 3 },
    { w: 430, h: 932, r: 3 },
    { w: 420, h: 912, r: 3 },
    { w: 393, h: 852, r: 3 },
    { w: 428, h: 926, r: 3 },
    { w: 390, h: 844, r: 3 },
    { w: 375, h: 812, r: 3 },
    { w: 414, h: 896, r: 3 },
    { w: 414, h: 896, r: 2 },
    { w: 414, h: 736, r: 3 },
    { w: 375, h: 667, r: 2 },
    { w: 320, h: 568, r: 2 },
    { w: 1032, h: 1376, r: 2 },
    { w: 1024, h: 1366, r: 2 },
    { w: 834, h: 1210, r: 2 },
    { w: 834, h: 1194, r: 2 },
    { w: 820, h: 1180, r: 2 },
    { w: 834, h: 1112, r: 2 },
    { w: 810, h: 1080, r: 2 },
    { w: 768, h: 1024, r: 2 },
    { w: 744, h: 1133, r: 2 },
  ];

  function splashMedia(device, orientation) {
    return (
      'screen and (device-width: ' +
      device.w +
      'px) and (device-height: ' +
      device.h +
      'px) and (-webkit-device-pixel-ratio: ' +
      device.r +
      ') and (orientation: ' +
      orientation +
      ')'
    );
  }

  function hasSplashLink(device, orientation) {
    var links = document.querySelectorAll('link[rel="apple-touch-startup-image"]');
    for (var i = 0; i < links.length; i += 1) {
      var media = links[i].getAttribute('media') || '';
      if (
        media.indexOf(device.w + 'px') !== -1 &&
        media.indexOf(device.h + 'px') !== -1 &&
        media.indexOf(String(device.r)) !== -1 &&
        media.indexOf(orientation) !== -1
      ) {
        return true;
      }
    }
    return false;
  }

  function drawSplash(device, orientation, image, background) {
    var portrait = orientation === 'portrait';
    // CSS points are the same in both orientations; the bitmap is not.
    var width = Math.round((portrait ? device.w : device.h) * device.r);
    var height = Math.round((portrait ? device.h : device.w) * device.r);
    var ratio = portrait ? 0.2 : 0.24;
    var size = Math.round((portrait ? height : width) * ratio);
    var left = Math.round((width - size) / 2);
    var top = Math.round((height - size) / 2);
    var radius = Math.min(100, Math.round(size / 2));

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var context = canvas.getContext('2d');
    if (!context) return '';

    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.save();
    context.beginPath();
    context.moveTo(left + radius, top);
    context.lineTo(left + size - radius, top);
    context.quadraticCurveTo(left + size, top, left + size, top + radius);
    context.lineTo(left + size, top + size - radius);
    context.quadraticCurveTo(left + size, top + size, left + size - radius, top + size);
    context.lineTo(left + radius, top + size);
    context.quadraticCurveTo(left, top + size, left, top + size - radius);
    context.lineTo(left, top + radius);
    context.quadraticCurveTo(left, top, left + radius, top);
    context.closePath();
    context.clip();
    context.drawImage(image, left, top, size, size);
    context.restore();

    try {
      return canvas.toDataURL('image/png');
    } catch (error) {
      log('splash canvas export failed', error);
      return '';
    }
  }

  function createAppleSplashScreens() {
    if (config.noMeta || config.noSplash || !isIOS() || isStandalone()) return Promise.resolve(0);

    var ratio = 0;
    try {
      if (window.matchMedia('(-webkit-device-pixel-ratio: 2)').matches) ratio = 2;
      else if (window.matchMedia('(-webkit-device-pixel-ratio: 3)').matches) ratio = 3;
    } catch (error) {
      /* ignore */
    }
    if (!ratio) return Promise.resolve(0);

    var screenWidth = Math.round(window.screen.width);
    var screenHeight = Math.round(window.screen.height);

    var device = null;
    for (var i = 0; i < SPLASH_SCREENS.length; i += 1) {
      var entry = SPLASH_SCREENS[i];
      if (
        entry.r === ratio &&
        ((entry.w === screenWidth && entry.h === screenHeight) ||
          (entry.w === screenHeight && entry.h === screenWidth))
      ) {
        device = entry;
        break;
      }
    }
    if (!device) return Promise.resolve(0);

    return new Promise(function (resolve) {
      var image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = function () {
        var background = themeColor();
        var added = 0;
        ['landscape', 'portrait'].forEach(function (orientation) {
          if (hasSplashLink(device, orientation)) return;
          var href = drawSplash(device, orientation, image, background);
          if (!href) return;
          var link = document.createElement('link');
          link.rel = 'apple-touch-startup-image';
          link.media = splashMedia(device, orientation);
          link.href = href;
          document.head.appendChild(link);
          added += 1;
        });
        resolve(added);
      };
      image.onerror = function () {
        log('splash icon failed to load', config.splashIcon);
        resolve(0);
      };
      image.src = config.splashIcon;
    });
  }

  /* ------------------------------------------------------------------ *
   * Service worker
   * ------------------------------------------------------------------ */

  var readyResolve;
  var readyPromise = new Promise(function (resolve) {
    readyResolve = resolve;
  });

  function register() {
    if (domainConfig.pwa.enabled === false) {
      readyResolve(null);
      return;
    }
    if (!('serviceWorker' in navigator)) {
      log('service workers are not supported');
      readyResolve(null);
      return;
    }
    if (!window.isSecureContext) {
      log('service workers require HTTPS (or localhost)');
      readyResolve(null);
      return;
    }

    navigator.serviceWorker
      .register(config.swUrl, { scope: config.swScope })
      .then(function (reg) {
        registration = reg;
        readyResolve(reg);
        renderToolbox();
        log('service worker registered', reg.scope);

        if (reg.waiting && navigator.serviceWorker.controller) {
          updateAvailable = true;
          refreshState();
          dispatch('update', { registration: reg });
          if (config.autoUpdate) applyUpdate();
        }

        reg.addEventListener('updatefound', function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state !== 'installed') return;
            if (!navigator.serviceWorker.controller) return; // first install
            updateAvailable = true;
            refreshState();
            dispatch('update', { registration: reg });
            if (config.autoUpdate) applyUpdate();
          });
        });
      })
      .catch(function (error) {
        log('service worker registration failed', error);
        readyResolve(null);
      });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading) window.location.reload();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || !registration) return;
      var now = Date.now();
      if (now - lastUpdateCheck < 60 * 60 * 1000) return;
      lastUpdateCheck = now;
      registration.update().catch(function () {});
    });
  }

  var lastUpdateCheck = Date.now();

  function applyUpdate() {
    if (!registration) return Promise.resolve(false);

    var waiting = registration.waiting;
    if (!waiting) {
      if (updateAvailable) window.location.reload();
      return Promise.resolve(false);
    }

    reloading = true;
    try {
      // Must target the waiting worker: registration.active is the old one.
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (error) {
      reloading = false;
      return Promise.resolve(false);
    }

    // Safety net for browsers that don't emit controllerchange reliably.
    setTimeout(function () {
      if (reloading) window.location.reload();
    }, 3000);

    return Promise.resolve(true);
  }

  function postToWorker(message) {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);

    var getRegistration = registration
      ? Promise.resolve(registration)
      : Promise.race([
          navigator.serviceWorker.ready,
          new Promise(function (resolve) {
            setTimeout(function () {
              resolve(null);
            }, 3000);
          }),
        ]);

    return getRegistration
      .then(function (reg) {
        if (!reg) return null;
        var worker = reg.active || reg.waiting || reg.installing;
        if (!worker) return null;
        return new Promise(function (resolve) {
          var channel = new MessageChannel();
          var timer = setTimeout(function () {
            resolve(null);
          }, 2000);
          channel.port1.onmessage = function (event) {
            clearTimeout(timer);
            resolve(event.data);
          };
          try {
            worker.postMessage(message, [channel.port2]);
          } catch (error) {
            clearTimeout(timer);
            resolve(null);
          }
        });
      })
      .catch(function () {
        return null;
      });
  }

  /* ------------------------------------------------------------------ *
   * Install flow
   * ------------------------------------------------------------------ */

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    if (domainConfig.pwa.enabled === false || domainConfig.features.installation === false) return;
    installPromptEvent = event;
    log('beforeinstallprompt captured');
    refreshState();
    dispatch('installable', {});
  });

  window.addEventListener('appinstalled', function () {
    installPromptEvent = null;
    installed = true;
    refreshState();
    track('app_installed');
    dispatch('installed', {});
  });

  function showHelp(kind) {
    if (domainConfig.pwa.enabled === false || domainConfig.features.installation === false) return null;
    if (document.querySelector('[data-pwa-help]')) return;

    var isIosHelp = kind === 'ios';
    var title = isIosHelp ? 'Install ' + appName() + ' on iPhone or iPad' : 'Install ' + appName();
    var steps = isIosHelp
      ? [
          'Tap the Share button in the Safari toolbar.',
          'Scroll down and choose “Add to Home Screen”.',
          'Tap “Add” to finish.',
        ]
      : [
          'Open your browser menu (⋮ or ⋯).',
          'Choose “Install app” or “Add to Home screen”.',
          'Confirm to finish.',
        ];

    var host = document.createElement('div');
    host.setAttribute('data-pwa-help', '');
    host.style.cssText =
      'position:fixed;inset:0;z-index:2147483645;display:flex;align-items:center;justify-content:center;';

    var shadow;
    try {
      if (!host.attachShadow) throw new Error('no shadow DOM');
      shadow = host.attachShadow({ mode: 'open' });
    } catch (error) {
      window.alert(title + '\n\n' + steps.join('\n'));
      return;
    }

    var style = document.createElement('style');
    if (config.nonce) style.setAttribute('nonce', config.nonce);
    style.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box;margin:0;padding:0;font-family:var(--progressierFont,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif)}',
      '.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.33)}',
      '.sheet{position:relative;width:min(500px,calc(100% - 24px));max-height:500px;overflow:auto;background:var(--progressierBg,#fff);color:var(--progressierTxt,#051b2c);border:1px solid var(--progressierBorderColor,rgba(0,0,0,.09));border-radius:30px;box-shadow:0 24px 64px rgba(15,23,42,.28)}',
      '.head{display:flex;align-items:center;gap:12px;width:90%;margin:0 auto;padding:20px;box-sizing:border-box}',
      '.logo{width:56px;height:56px;border-radius:14px;flex:none;background:var(--progressierElement,#f5f5f5);object-fit:cover}',
      'h2{font-size:17px;line-height:1.35;font-weight:600}',
      '.close{margin-left:auto;margin-right:-6px;flex:none;min-width:44px;min-height:44px;border:0;border-radius:50%;background:transparent;color:var(--progressierTxt,#334155);font-size:20px;line-height:1;cursor:pointer;touch-action:manipulation;transition:background-color 160ms ease}',
      '.close:hover{background:var(--progressierHover,rgba(0,0,0,.06))}',
      'ol{list-style:none;width:90%;margin:0 auto;padding:0 0 8px;counter-reset:step}',
      'li{position:relative;padding:8px 0 8px 38px;font-size:15px;line-height:24px;color:var(--progressierTxt,#334155);counter-increment:step}',
      'li::before{content:counter(step);position:absolute;left:0;top:8px;width:24px;height:24px;border-radius:6px;background:var(--progressierElement,#eef2ff);color:var(--progressierTxt,#3730a3);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}',
      '.actions{width:90%;margin:0 auto;padding:8px 0 24px}',
      '.ok{width:100%;min-height:50px;border:0;border-radius:30px;background:var(--progressierAccent,#1a73e8);color:var(--progressierAccentText,#fff);font-size:15px;font-weight:600;padding:0 20px;cursor:pointer;touch-action:manipulation;transition:background-color 160ms ease,box-shadow 160ms ease}',
      '.ok:hover{box-shadow:0 6px 18px rgba(26,115,232,.18)}',
      '.close:focus-visible,.ok:focus-visible{outline:3px solid var(--progressierFocus,#2563eb);outline-offset:3px}',
      '.note{width:90%;margin:0 auto;padding:0 0 16px;font-size:13px;line-height:1.45;color:var(--progressierNote,#475569)}',
      '@media (prefers-reduced-motion:reduce){.close,.ok{transition:none}}',
      '@media (max-width:480px){.sheet{border-radius:22px}.head,ol,.actions,.note{width:calc(100% - 32px)}}',
    ].join('');
    shadow.appendChild(style);

    var backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    shadow.appendChild(backdrop);

    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    // aria-label remains as a fallback for engines that do not resolve IDREFs
    // across a shadow root; aria-labelledby takes precedence where supported.
    sheet.setAttribute('aria-label', title);
    sheet.setAttribute('aria-labelledby', 'pwa-install-title');
    sheet.setAttribute('aria-describedby', 'pwa-install-steps');

    var head = document.createElement('div');
    head.className = 'head';

    var logo = document.createElement('img');
    logo.className = 'logo';
    logo.alt = '';
    logo.src = appIcon();
    head.appendChild(logo);

    var heading = document.createElement('h2');
    heading.id = 'pwa-install-title';
    heading.textContent = title;
    head.appendChild(heading);

    var close = document.createElement('button');
    close.className = 'close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close installation instructions');
    close.textContent = '✕';
    head.appendChild(close);
    sheet.appendChild(head);

    var list = document.createElement('ol');
    list.id = 'pwa-install-steps';
    steps.forEach(function (text) {
      var item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    });
    sheet.appendChild(list);

    if (isIosHelp) {
      var note = document.createElement('p');
      note.className = 'note';
      note.textContent = 'On iOS the app must be added from Safari. Other browsers may not offer this option.';
      sheet.appendChild(note);
    }

    var actions = document.createElement('div');
    actions.className = 'actions';
    var ok = document.createElement('button');
    ok.className = 'ok';
    ok.type = 'button';
    ok.textContent = 'Got it';
    actions.appendChild(ok);
    sheet.appendChild(actions);

    shadow.appendChild(sheet);
    document.body.appendChild(host);

    var previousFocus = document.activeElement;

    function destroy() {
      document.removeEventListener('keydown', onKeyDown);
      if (host.parentNode) host.parentNode.removeChild(host);
      if (previousFocus && previousFocus.focus) previousFocus.focus();
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') destroy();
    }

    close.addEventListener('click', destroy);
    ok.addEventListener('click', destroy);
    backdrop.addEventListener('click', destroy);
    document.addEventListener('keydown', onKeyDown);
    setTimeout(function () {
      ok.focus();
    }, 30);
  }

  function promptInstall(options) {
    options = options || {};
    if (domainConfig.pwa.enabled === false || domainConfig.features.installation === false) {
      return Promise.resolve({ outcome: 'disabled' });
    }
    if (installed || isStandalone()) {
      return Promise.resolve({ outcome: 'already-installed' });
    }

    track('install_prompt');

    // Matches the original desktopQRCode setting: on a desktop the install
    // button opens the QR dialog instead of the manual instructions.
    if (!options.skipQr && config.desktopQr && !isIOS() && window.screen.width > 991) {
      showQrDialog();
      track('install_qr');
      return Promise.resolve({ outcome: 'qr' });
    }

    if (installPromptEvent) {
      var event = installPromptEvent;
      installPromptEvent = null;
      refreshState();
      event.prompt();
      return event.userChoice.then(function (choice) {
        var outcome = (choice && choice.outcome) || 'dismissed';
        track('install_choice', { outcome: outcome });
        if (outcome === 'accepted') {
          installed = true;
          refreshState();
        }
        return { outcome: outcome };
      });
    }

    if (isIOS()) {
      showHelp('ios');
      track('install_instructions', { platform: 'ios' });
      return Promise.resolve({ outcome: 'instructions' });
    }

    showHelp('generic');
    track('install_instructions', { platform: 'other' });
    return Promise.resolve({ outcome: 'instructions' });
  }

  /* ------------------------------------------------------------------ *
   * Push notifications
   * ------------------------------------------------------------------ */

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  function pushSupported() {
    return !(config.features && config.features.push === false) &&
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Notification.requestPermission() is promise-based in modern browsers but
  // callback-only in older Safari/WebKit builds. Resolve from whichever channel
  // the browser actually uses, exactly once, and always return a promise so a
  // granted permission is never read as `undefined` (and hosts can always
  // chain `.then()` on PWA.requestPushPermission()).
  function requestNotificationPermission() {
    if (!('Notification' in window) || typeof Notification.requestPermission !== 'function') {
      return Promise.resolve('denied');
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Promise.resolve(Notification.permission);
    }
    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value === 'granted' ? 'granted' : 'denied');
      }
      try {
        var result = Notification.requestPermission(done);
        if (result && typeof result.then === 'function') {
          result.then(done, function () { done('denied'); });
        }
      } catch (error) {
        done('denied');
      }
    });
  }

  function subscribePush(options) {
    options = options || {};
    if (!pushSupported()) {
      return Promise.reject(new Error('Push notifications are not supported in this browser.'));
    }
    if (!window.isSecureContext) {
      return Promise.reject(new Error('Push notifications require HTTPS.'));
    }

    var applicationServerKey = options.vapidPublicKey || options.applicationServerKey;
    if (!applicationServerKey) {
      return Promise.reject(new Error('A VAPID public key is required.'));
    }

    var endpoint = options.endpoint || config.pushEndpoint;

    // Call requestPermission synchronously: iOS requires a user gesture and
    // awaiting the service worker first can lose that gesture.
    var permissionPromise = requestNotificationPermission();

    return permissionPromise
      .then(function (permission) {
        if (permission !== 'granted') {
          return { ok: false, permission: permission };
        }
        return navigator.serviceWorker.ready.then(function (reg) {
          return reg.pushManager
            .getSubscription()
            .then(function (existing) {
              if (existing) return existing;
              return reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
              });
            })
            .then(function (subscription) {
              var json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
              return postToWorker({
                type: 'PWA_CONFIG',
                config: {
                  pushEndpoint: endpoint || '',
                  applicationServerKey: applicationServerKey,
                },
              }).then(function () {
                if (!endpoint) return { ok: true, subscription: json };
                return fetch(endpoint, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(json),
                }).then(function (response) {
                  if (!response.ok) {
                    throw new Error('Push subscription was rejected by the server (' + response.status + ').');
                  }
                  return { ok: true, subscription: json };
                });
              });
            });
        });
      })
      .then(function (result) {
        track('push_subscribe', { ok: result.ok, permission: result.permission });
        return result;
      });
  }

  function unsubscribePush(options) {
    options = options || {};
    if (!pushSupported()) return Promise.resolve({ ok: false, reason: 'unsupported' });

    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (subscription) {
        if (!subscription) return { ok: true, removed: false };

        var endpoint = options.endpoint || config.pushEndpoint;
        var payload = JSON.stringify({ endpoint: subscription.endpoint });

        return subscription.unsubscribe().then(function (removed) {
          if (!endpoint) return { ok: true, removed: removed };
          return fetch(endpoint, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          })
            .catch(function () {})
            .then(function () {
              return { ok: true, removed: removed };
            });
        });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * App badge
   * ------------------------------------------------------------------ */

  function setBadge(count) {
    if (config.features && config.features.badges === false) return Promise.resolve(false);
    var value = Math.max(0, Math.floor(count) || 0);
    try {
      if ('setAppBadge' in navigator) {
        if (value > 0) navigator.setAppBadge(value).catch(function () {});
        else navigator.clearAppBadge().catch(function () {});
      }
    } catch (error) {
      /* ignore */
    }
    return postToWorker({ type: 'SET_BADGE', count: value }).catch(function () {});
  }

  function clearBadge() {
    if (config.features && config.features.badges === false) return Promise.resolve(false);
    return setBadge(0).then(function () {
      return postToWorker({ type: 'CLEAR_BADGE' }).catch(function () {});
    });
  }

  /* ------------------------------------------------------------------ *
   * Shared file (Web Share Target)
   * ------------------------------------------------------------------ */

  function openShareDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open('progressiersharedfiles', 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('progressiersharedfiles')) {
          db.createObjectStore('progressiersharedfiles', { keyPath: 'id' });
        }
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function readSharedRecord(id) {
    return openShareDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('progressiersharedfiles', 'readwrite');
        var store = tx.objectStore('progressiersharedfiles');
        var request = store.get(id);
        request.onsuccess = function () {
          var record = request.result || null;
          if (record) store.delete(id);
          resolve(record);
        };
        request.onerror = function () {
          reject(request.error);
        };
        tx.oncomplete = function () {
          db.close();
        };
        tx.onerror = function () {
          db.close();
        };
      });
    });
  }

  function cleanSharedParams() {
    try {
      var url = new URL(window.location.href);
      ['fileid', 'sharedurl', 'sharedtitle', 'sharedtext'].forEach(function (key) {
        url.searchParams.delete(key);
      });
      if (url.searchParams.get('launchedfrom') === 'share') {
        ['url', 'title', 'text'].forEach(function (key) {
          url.searchParams.delete(key);
        });
      }
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) {
      /* ignore */
    }
  }

  var sharedFilePromise = new Promise(function (resolve) {
    function start() {
      if (config.features && config.features.sharing === false) {
        resolve(null);
        return;
      }
      var id = getParam('fileid');
      if (!id) {
        resolve(null);
        return;
      }

      readSharedRecord(id)
        .then(function (record) {
          if (!record) {
            cleanSharedParams();
            resolve(null);
            return;
          }

          var shared = {
            id: record.id,
            url: record.url || '',
            title: record.title || '',
            text: record.text || '',
            file: null,
          };

          if (record.buffer) {
            try {
              shared.file = new File([record.buffer], record.filename || 'shared-file', {
                type: record.type || '',
              });
            } catch (error) {
              shared.blob = new Blob([record.buffer], { type: record.type || '' });
            }
          }

          cleanSharedParams();
          resolve(shared);
          dispatch('share', shared);
          track('share_received', {
            hasFile: Boolean(shared.file || shared.blob),
            type: record.type || null,
          });
        })
        .catch(function (error) {
          log('unable to read shared file', error);
          cleanSharedParams();
          resolve(null);
        });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      setTimeout(start, 0);
    }
  });

  /* ------------------------------------------------------------------ *
   * Protocol handler redirect (web+pwa:...)
   * ------------------------------------------------------------------ */

  var protocolRedirect = getParam('pwaprotocolredirect');
  if (protocolRedirect) {
    try {
      var target = new URL(protocolRedirect, window.location.origin);
      var allowed =
        target.protocol === 'http:' || target.protocol === 'https:'
          ? config.allowExternalProtocol || target.origin === window.location.origin
          : false;
      if (allowed) window.location.replace(target.href);
    } catch (error) {
      log('invalid protocol redirect', error);
    }
  }

  // Progressier compatibility: ?pwaredirect=<base64 url>
  var base64Redirect = getParam('pwaredirect');
  if (base64Redirect) {
    try {
      var decoded = window.atob(base64Redirect.replace(/-/g, '+').replace(/_/g, '/'));
      var redirect = new URL(decoded, window.location.origin);
      var redirectAllowed =
        redirect.protocol === 'http:' || redirect.protocol === 'https:'
          ? config.allowExternalProtocol || redirect.origin === window.location.origin
          : false;
      if (redirectAllowed) window.location.replace(redirect.href);
    } catch (error) {
      log('invalid pwaredirect', error);
    }
  }

  /* ------------------------------------------------------------------ *
   * Wording (same languages as Progressier)
   * ------------------------------------------------------------------ */

  var translations = {
    en: {
      install: 'Install',
      launchTheApp: 'Launch the app',
      installTheApp: 'Install the app',
      scanCode: 'Scan the QR code below to install the app on your iPhone or Android smartphone.',
      installHere: 'Install here',
      qrUnavailable: 'The QR code could not be generated.',
      notNow: 'Not now',
      allowNotifications: 'Get notifications',
      subscribed: 'Notifications enabled',
      blocked: 'Notifications blocked',
      wannaSuggestApp: 'Install this app on your device for quick access.',
      wannaShowNotifications: 'Stay up to date with notifications.',
      tapToReload: 'Tap to reload',
      youreOffline: 'You are offline',
      getBackOnline: 'Check your connection and try again.',
      close: 'Close',
      gotIt: 'Got it',
      welcomeTitle: 'Welcome',
      welcomeText: 'Add this app to your home screen for faster access.',
      pushNeedsSetup: 'Add data-vapid-public-key to the script to enable notifications.',
      notificationsBlocked: 'Notifications are blocked in your browser settings.',
      notificationsEnabled: 'Notifications are already enabled.',
      notificationsUnavailable: 'Notifications are not available in this browser.',
    },
    fr: {
      install: 'Installer',
      launchTheApp: 'Lancer l’application',
      installTheApp: 'Installer l’application',
      scanCode: 'Scannez le code QR ci-dessous pour installer l’application sur votre iPhone ou votre smartphone Android.',
      installHere: 'Installer ici',
      qrUnavailable: 'Le code QR n’a pas pu être généré.',
      notNow: 'Plus tard',
      allowNotifications: 'Activer les notifications',
      subscribed: 'Notifications activées',
      blocked: 'Notifications bloquées',
      wannaSuggestApp: 'Installez cette application pour y accéder plus vite.',
      wannaShowNotifications: 'Restez informé grâce aux notifications.',
      tapToReload: 'Touchez pour recharger',
      youreOffline: 'Vous êtes hors ligne',
      getBackOnline: 'Vérifiez votre connexion et réessayez.',
      close: 'Fermer',
      gotIt: 'Compris',
      welcomeTitle: 'Bienvenue',
      welcomeText: 'Ajoutez cette application à votre écran d’accueil pour y accéder plus vite.',
    },
    it: {
      install: 'Installa',
      launchTheApp: 'Apri l’app',
      installTheApp: 'Installa l’app',
      scanCode: 'Scansiona il codice QR qui sotto per installare l’app sul tuo iPhone o smartphone Android.',
      installHere: 'Installa qui',
      qrUnavailable: 'Impossibile generare il codice QR.',
      notNow: 'Non ora',
      allowNotifications: 'Attiva le notifiche',
      subscribed: 'Notifiche attivate',
      blocked: 'Notifiche bloccate',
      wannaSuggestApp: 'Installa questa app per un accesso rapido.',
      wannaShowNotifications: 'Resta aggiornato con le notifiche.',
      tapToReload: 'Tocca per ricaricare',
      youreOffline: 'Sei offline',
      getBackOnline: 'Controlla la connessione e riprova.',
      close: 'Chiudi',
      gotIt: 'Ho capito',
      welcomeTitle: 'Benvenuto',
      welcomeText: 'Aggiungi questa app alla schermata Home per un accesso più rapido.',
    },
    de: {
      install: 'Installieren',
      launchTheApp: 'App öffnen',
      installTheApp: 'App installieren',
      scanCode: 'Scannen Sie den QR-Code unten, um die App auf Ihrem iPhone oder Android-Smartphone zu installieren.',
      installHere: 'Hier installieren',
      qrUnavailable: 'Der QR-Code konnte nicht erzeugt werden.',
      notNow: 'Nicht jetzt',
      allowNotifications: 'Benachrichtigungen aktivieren',
      subscribed: 'Benachrichtigungen aktiviert',
      blocked: 'Benachrichtigungen blockiert',
      wannaSuggestApp: 'Installieren Sie diese App für schnellen Zugriff.',
      wannaShowNotifications: 'Bleiben Sie mit Benachrichtigungen auf dem Laufenden.',
      tapToReload: 'Zum Neuladen tippen',
      youreOffline: 'Sie sind offline',
      getBackOnline: 'Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
      close: 'Schließen',
      gotIt: 'Verstanden',
      welcomeTitle: 'Willkommen',
      welcomeText: 'Fügen Sie diese App zum Home-Bildschirm hinzu, um schneller darauf zuzugreifen.',
    },
    sv: {
      install: 'Installera',
      launchTheApp: 'Öppna appen',
      installTheApp: 'Installera appen',
      scanCode: 'Skanna QR-koden nedan för att installera appen på din iPhone eller Android-smartphone.',
      installHere: 'Installera här',
      qrUnavailable: 'QR-koden kunde inte skapas.',
      notNow: 'Inte nu',
      allowNotifications: 'Aktivera aviseringar',
      subscribed: 'Aviseringar aktiverade',
      blocked: 'Aviseringar blockerade',
      wannaSuggestApp: 'Installera appen för snabb åtkomst.',
      wannaShowNotifications: 'Håll dig uppdaterad med aviseringar.',
      tapToReload: 'Tryck för att ladda om',
      youreOffline: 'Du är offline',
      getBackOnline: 'Kontrollera anslutningen och försök igen.',
      close: 'Stäng',
      gotIt: 'Uppfattat',
      welcomeTitle: 'Välkommen',
      welcomeText: 'Lägg till appen på hemskärmen för snabbare åtkomst.',
    },
    nl: {
      install: 'Installeren',
      launchTheApp: 'App openen',
      installTheApp: 'App installeren',
      scanCode: 'Scan de QR-code hieronder om de app op je iPhone of Android-smartphone te installeren.',
      installHere: 'Hier installeren',
      qrUnavailable: 'De QR-code kon niet worden gegenereerd.',
      notNow: 'Niet nu',
      allowNotifications: 'Meldingen inschakelen',
      subscribed: 'Meldingen ingeschakeld',
      blocked: 'Meldingen geblokkeerd',
      wannaSuggestApp: 'Installeer deze app voor snelle toegang.',
      wannaShowNotifications: 'Blijf op de hoogte met meldingen.',
      tapToReload: 'Tik om te herladen',
      youreOffline: 'Je bent offline',
      getBackOnline: 'Controleer je verbinding en probeer het opnieuw.',
      close: 'Sluiten',
      gotIt: 'Begrepen',
      welcomeTitle: 'Welkom',
      welcomeText: 'Voeg deze app toe aan je beginscherm voor snellere toegang.',
    },
    no: {
      install: 'Installer',
      launchTheApp: 'Åpne appen',
      installTheApp: 'Installer appen',
      scanCode: 'Skann QR-koden nedenfor for å installere appen på iPhone eller Android-telefonen din.',
      installHere: 'Installer her',
      qrUnavailable: 'QR-koden kunne ikke genereres.',
      notNow: 'Ikke nå',
      allowNotifications: 'Aktiver varsler',
      subscribed: 'Varsler er aktivert',
      blocked: 'Varsler er blokkert',
      wannaSuggestApp: 'Installer appen for rask tilgang.',
      wannaShowNotifications: 'Hold deg oppdatert med varsler.',
      tapToReload: 'Trykk for å laste inn på nytt',
      youreOffline: 'Du er frakoblet',
      getBackOnline: 'Sjekk tilkoblingen og prøv igjen.',
      close: 'Lukk',
      gotIt: 'Greit',
      welcomeTitle: 'Velkommen',
      welcomeText: 'Legg appen til på hjemskjermen for raskere tilgang.',
    },
    da: {
      install: 'Installer',
      launchTheApp: 'Åbn appen',
      installTheApp: 'Installer appen',
      scanCode: 'Scan QR-koden nedenfor for at installere appen på din iPhone eller Android-smartphone.',
      installHere: 'Installer her',
      qrUnavailable: 'QR-koden kunne ikke genereres.',
      notNow: 'Ikke nu',
      allowNotifications: 'Aktivér notifikationer',
      subscribed: 'Notifikationer aktiveret',
      blocked: 'Notifikationer blokeret',
      wannaSuggestApp: 'Installer appen for hurtig adgang.',
      wannaShowNotifications: 'Hold dig opdateret med notifikationer.',
      tapToReload: 'Tryk for at genindlæse',
      youreOffline: 'Du er offline',
      getBackOnline: 'Tjek din forbindelse og prøv igen.',
      close: 'Luk',
      gotIt: 'Forstået',
      welcomeTitle: 'Velkommen',
      welcomeText: 'Føj appen til hjemmeskærmen for hurtigere adgang.',
    },
    et: {
      install: 'Paigalda',
      launchTheApp: 'Ava rakendus',
      installTheApp: 'Installige rakendus',
      scanCode: 'Skanni allolevat QR-koodi, et rakendus oma iPhone’i või Android-telefoni installida.',
      installHere: 'Installi siin',
      qrUnavailable: 'QR-koodi loomine ebaõnnestus.',
      notNow: 'Mitte praegu',
      allowNotifications: 'Luba teavitused',
      subscribed: 'Teavitused on lubatud',
      blocked: 'Teavitused on blokeeritud',
      wannaSuggestApp: 'Paigalda rakendus kiireks juurdepääsuks.',
      wannaShowNotifications: 'Hoia end teavitustega kursis.',
      tapToReload: 'Puuduta uuesti laadimiseks',
      youreOffline: 'Sa oled võrguühenduseta',
      getBackOnline: 'Kontrolli ühendust ja proovi uuesti.',
      close: 'Sulge',
      gotIt: 'Selge',
      welcomeTitle: 'Tere tulemast',
      welcomeText: 'Lisa rakendus avakuvale, et sellele kiiremini ligi pääseda.',
    },
    es: {
      install: 'Instalar',
      launchTheApp: 'Abrir la app',
      installTheApp: 'Instalar la aplicación',
      scanCode: 'Escanea el código QR a continuación para instalar la aplicación en tu iPhone o smartphone Android.',
      installHere: 'Instalar aquí',
      qrUnavailable: 'No se pudo generar el código QR.',
      notNow: 'Ahora no',
      allowNotifications: 'Activar notificaciones',
      subscribed: 'Notificaciones activadas',
      blocked: 'Notificaciones bloqueadas',
      wannaSuggestApp: 'Instala esta aplicación para acceder más rápido.',
      wannaShowNotifications: 'Mantente al día con las notificaciones.',
      tapToReload: 'Toca para recargar',
      youreOffline: 'Estás sin conexión',
      getBackOnline: 'Comprueba tu conexión e inténtalo de nuevo.',
      close: 'Cerrar',
      gotIt: 'Entendido',
      welcomeTitle: 'Bienvenido',
      welcomeText: 'Añade esta aplicación a tu pantalla de inicio para acceder más rápido.',
    },
  };

  function detectLanguage() {
    var language = (navigator.language || 'en').toLowerCase().split('-')[0];
    if (language === 'nb' || language === 'nn') language = 'no';
    return translations[language] ? language : 'en';
  }

  var wording = {
    language: detectLanguage(),
    get: function (key) {
      var table = translations[wording.language] || translations.en;
      return table[key] != null ? table[key] : translations.en[key] != null ? translations.en[key] : key;
    },
    setLanguage: function (language) {
      var value = String(language || '').toLowerCase().split('-')[0];
      if (value === 'nb' || value === 'nn') value = 'no';
      if (translations[value]) wording.language = value;
      return wording.language;
    },
    rtl: function () {
      return ['ar', 'he', 'fa', 'ur'].indexOf(wording.language) !== -1;
    },
    languages: Object.keys(translations),
  };

  /* ------------------------------------------------------------------ *
   * Theming
   * ------------------------------------------------------------------ */

  function applyTheme(options) {
    options = options || {};
    var root = document.documentElement.style;
    var map = {
      background: '--progressierBg',
      text: '--progressierTxt',
      font: '--progressierFont',
      textWeight: '--progressierTextFontWeight',
      buttonWeight: '--progressierBtnFontWeight',
      headingWeight: '--progressierHeadingFontWeight',
      letterSpacing: '--progressierLetterSpacing',
      hover: '--progressierHover',
      element: '--progressierElement',
      border: '--progressierBorderColor',
      shadow: '--progressierBoxShadow',
      accent: '--progressierAccent',
      accentText: '--progressierAccentText',
    };
    Object.keys(map).forEach(function (key) {
      if (options[key] != null && options[key] !== '') root.setProperty(map[key], options[key]);
    });
    return options;
  }

  /* ------------------------------------------------------------------ *
   * Small DOM helpers
   * ------------------------------------------------------------------ */

  var ICONS = {
    close:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    install:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v11m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    installDesktop:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="2" stroke="currentColor" stroke-width="2"/><path d="M12 8v4.5m0 0l2-2m-2 2l-2-2M9 20h6M12 16.5V20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    installMobile:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke="currentColor" stroke-width="2"/><path d="M12 7v5.5m0 0l2-2m-2 2l-2-2M11 18.5h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    open:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6m0 0v6m0-6L10 14M9 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bell:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 4 1 5 2 7H4c1-2 2-3 2-7zm4 11a2 2 0 004 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bellOff:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9a6 6 0 0111-3m1 3c0 4 1 5 2 7H9m-4-1c.6-1.2 1-2.2 1-4m1 9a2 2 0 004 0M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    wifiOff:
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18M8.5 15.5a5 5 0 017 0M5 12a10 10 0 013-2m8 2a10 10 0 012 1.5M2 8.5A15 15 0 016 6m12 2.5a15 15 0 014 2M12 19h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  };

  function make(tag, className, html) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (html != null) element.innerHTML = html;
    return element;
  }

  // Button labels are plain text, but they can originate from host markup
  // (`data-install="…"`, `data-subscribed="…"`) or host configuration, so they
  // are escaped before being composed into innerHTML. Without this, any page
  // that renders untrusted content into those attributes becomes DOM XSS.
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function ensureStyles() {
    if (config.noCss) return;
    if (document.querySelector('link[data-pwa-css]')) return;
    var existing = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < existing.length; i += 1) {
      if ((existing[i].getAttribute('href') || '') === config.cssUrl) return;
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = config.cssUrl;
    link.setAttribute('data-pwa-css', '');
    if (config.nonce) link.setAttribute('nonce', config.nonce);
    document.head.appendChild(link);
  }

  function appIcon() {
    return config.icon || resolveUrl('icons/icon-192.png');
  }

  function closeButton() {
    var button = make('div', 'pwa-flow-close', ICONS.close);
    button.setAttribute('role', 'button');
    return button;
  }

  /* ------------------------------------------------------------------ *
   * Cookies (banner dismissal, same names as Progressier)
   * ------------------------------------------------------------------ */

  function cookieKey(base) {
    try {
      return base + location.hostname + location.pathname;
    } catch (error) {
      return base;
    }
  }

  function readCookie(name) {
    try {
      var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : '';
    } catch (error) {
      return '';
    }
  }

  function writeCookie(name, value, days) {
    try {
      var expires = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
    } catch (error) {
      /* ignore */
    }
  }

  function bannerAllowed(base, days) {
    var value = readCookie(cookieKey(base));
    if (!value) return true;
    var time = Date.parse(value);
    if (!time) return true;
    return Date.now() - time > (Number(days) || 0) * 864e5;
  }

  function denyBanner(base) {
    writeCookie(cookieKey(base), new Date().toISOString(), 365);
  }

  /* ------------------------------------------------------------------ *
   * Install buttons (.progressier-install-button)
   * ------------------------------------------------------------------ */

  function installButtonData(node) {
    return {
      behavior: node.getAttribute('data-behavior') || 'disable',
      hideStandalone: node.getAttribute('data-hide-standalone') !== 'false',
      allowIOS: node.getAttribute('data-allow-ios') !== 'false',
      allowSamsung: node.getAttribute('data-allow-samsung') !== 'false',
      installLabel: localizedLabel(node, 'data-install', 'Install', 'install'),
      installedLabel: localizedLabel(node, 'data-installed', 'Launch the app', 'launchTheApp'),
      icons: node.hasAttribute('data-icons') && node.getAttribute('data-icons') !== 'false',
    };
  }

  // The hosted client treated its own default English labels as untranslated
  // placeholders, so <button data-install="Install"> followed the UI language.
  function localizedLabel(node, attribute, standard, key) {
    var value = node.getAttribute(attribute);
    if (!value || value === standard) return wording.get(key);
    return value;
  }

  function setButtonDisabled(node, disabled) {
    node.classList.toggle('is-disabled', disabled);
    node.style.pointerEvents = disabled ? 'none' : '';
    node.style.opacity = disabled ? '0.4' : '';
  }

  function setButtonHidden(node, hidden) {
    node.hidden = hidden;
    node.classList.toggle('is-hidden', hidden);
    node.style.display = hidden ? 'none' : '';
    node.style.visibility = hidden ? 'hidden' : '';
    node.style.opacity = hidden ? '0' : '';
  }

  function initInstallButton(node) {
    if (node.__pwaInstall) return;
    node.__pwaInstall = true;
    node.classList.add('captured');
    node.setAttribute('role', 'button');
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');

    var lastStatus = '';

    function render() {
      if (!node.isConnected) {
        clearInterval(node.__pwaTimer);
        return;
      }

      var data = installButtonData(node);
      var standalone = isStandalone();
      var installedNow = installed || standalone;

      if (standalone && data.hideStandalone) {
        setButtonHidden(node, true);
        return;
      }

      setButtonHidden(node, false);

      // Original Progressier only disables the button when running standalone
      // with data-hide-standalone="false".
      setButtonDisabled(node, standalone);

      var status = installedNow ? 'installed' : 'default';
      if (status === lastStatus && node.querySelector('.pwa-btn-inner')) return;
      lastStatus = status;

      var icon = installedNow
        ? ICONS.open
        : window.screen.width > 991
          ? ICONS.installDesktop
          : ICONS.installMobile;
      var label = installedNow ? data.installedLabel : data.installLabel;
      var inner = '<span class="pwa-btn-inner">';
      if (data.icons) inner += '<span class="pwa-btn-icon">' + icon + '</span>';
      inner += '<span class="pwa-btn-label">' + escapeHtml(label) + '</span></span>';
      node.innerHTML = inner;
      node.classList.add('initialized');
    }

    function activate() {
      if (installed || isStandalone()) {
        promptInstall();
        return;
      }
      promptInstall();
    }

    node.addEventListener('click', function (event) {
      event.preventDefault();
      activate();
    });
    node.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activate();
    });

    render();
    node.__pwaTimer = setInterval(render, 400);
  }

  /* ------------------------------------------------------------------ *
   * Subscribe buttons (.progressier-subscribe-button)
   * ------------------------------------------------------------------ */

  function subscribeButtonData(node) {
    return {
      icons: node.hasAttribute('data-icons') && node.getAttribute('data-icons') !== 'false',
      eligible: localizedLabel(node, 'data-eligible', 'Get notifications', 'allowNotifications'),
      subscribed: localizedLabel(node, 'data-subscribed', 'Notifications enabled', 'subscribed'),
      blocked: localizedLabel(node, 'data-blocked', 'Notifications blocked', 'blocked'),
    };
  }

  function getPushStatus() {
    if (!pushSupported()) return Promise.resolve('incompatible');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) return Promise.resolve('incompatible');

    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(function (resolve) {
        setTimeout(function () {
          resolve(null);
        }, 3000);
      }),
    ])
      .then(function (reg) {
        if (!reg || !reg.pushManager) return 'incompatible';
        return reg.pushManager.getSubscription().then(function (subscription) {
          return subscription ? 'subscribed' : 'eligible';
        });
      })
      .catch(function () {
        return 'incompatible';
      });
  }

  function handleSubscribeClick() {
    return getPushStatus().then(function (status) {
      if (status === 'denied') {
        notify(wording.get('notificationsBlocked'));
        return;
      }
      if (status === 'subscribed') {
        notify(wording.get('notificationsEnabled'));
        return;
      }
      if (status === 'incompatible') {
        notify(wording.get('notificationsUnavailable'));
        return;
      }
      if (!config.vapidPublicKey) {
        notify(wording.get('pushNeedsSetup'));
        return;
      }
      return subscribePush({ vapidPublicKey: config.vapidPublicKey }).then(function (result) {
        if (result && result.ok) {
          track('push_subscribe_ui', { ok: true });
        } else if (result && result.permission === 'denied') {
          notify(wording.get('notificationsBlocked'));
        }
      });
    });
  }

  function initSubscribeButton(node) {
    if (node.__pwaSubscribe) return;
    node.__pwaSubscribe = true;
    node.classList.add('captured');
    node.setAttribute('role', 'button');
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');

    var lastStatus = '';
    var scanning = false;

    function render() {
      if (!node.isConnected) {
        clearInterval(node.__pwaTimer);
        return;
      }
      if (scanning) return;
      scanning = true;

      getPushStatus()
        .then(function (status) {
          scanning = false;

          if (isStandalone() && !pushSupported()) {
            setButtonHidden(node, true);
            return;
          }

          var data = subscribeButtonData(node);
          var label = data.eligible;
          var icon = ICONS.bell;

          if (status === 'denied') {
            label = data.blocked;
            icon = ICONS.bellOff;
          } else if (status === 'subscribed') {
            label = data.subscribed;
            icon = ICONS.bell;
          }

          if (status === lastStatus && node.querySelector('.pwa-btn-inner')) return;
          lastStatus = status;

          var inner = '<span class="pwa-btn-inner">';
          if (data.icons) inner += '<span class="pwa-btn-icon">' + icon + '</span>';
          inner += '<span class="pwa-btn-label">' + escapeHtml(label) + '</span></span>';
          node.innerHTML = inner;
          node.classList.add('initialized');
        })
        .catch(function () {
          scanning = false;
        });
    }

    node.addEventListener('click', function (event) {
      event.preventDefault();
      handleSubscribeClick();
    });
    node.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleSubscribeClick();
    });

    render();
    node.__pwaTimer = setInterval(render, 400);
  }

  function scanButtons() {
    document.querySelectorAll('.progressier-install-button:not(.captured)').forEach(initInstallButton);
    document.querySelectorAll('.progressier-subscribe-button:not(.captured)').forEach(initSubscribeButton);
    scanQrButtons();
  }

  /* ------------------------------------------------------------------ *
   * Install banner
   * ------------------------------------------------------------------ */

  var BANNER_INSTALL_COOKIE = 'progressierinstallbanner';
  var BANNER_PUSH_COOKIE = 'progressierpushbanner';

  function removeInstallBanner() {
    var banner = document.querySelector('.progressier-install-banner');
    if (!banner) return;
    banner.classList.remove('in');
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 1000);
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser/.test(ua);
  }

  function showInstallBanner(options) {
    options = options || {};
    if (domainConfig.pwa.enabled === false || domainConfig.features.installation === false) return null;
    if (isStandalone()) return null;

    var platforms = options.platforms || 'all';
    if (platforms === 'mobile' && !isMobile()) return null;
    if (platforms === 'desktop' && isMobile()) return null;
    if (!options.preview && !bannerAllowed(BANNER_INSTALL_COOKIE, options.interval == null ? 7 : options.interval)) return null;

    removeInstallBanner();

    var banner = make('div', 'progressier-install-banner');
    if (wording.rtl()) banner.setAttribute('dir', 'rtl');

    var inner = make('div', 'progressier-install-banner-inner');
    var icon = make('div', 'progressier-install-banner-icon');
    var image = document.createElement('img');
    image.src = options.icon || appIcon();
    image.alt = 'app icon';
    icon.appendChild(image);

    var details = make('div', 'progressier-install-banner-details');
    var text = make('div', 'progressier-install-banner-text');
    text.textContent = options.text || wording.get('wannaSuggestApp');
    details.appendChild(text);

    var buttons = make('div', 'progressier-install-banner-btns');
    var install = make('button', 'progressier-install-button', wording.get('install'));
    install.type = 'button';
    var notNow = make('button', '', wording.get('notNow'));
    notNow.type = 'button';
    buttons.appendChild(install);
    buttons.appendChild(notNow);
    details.appendChild(buttons);

    var close = make('div', 'progressier-install-banner-close', ICONS.close);
    close.setAttribute('role', 'button');
    close.setAttribute('tabindex', '0');

    inner.appendChild(icon);
    inner.appendChild(details);
    inner.appendChild(close);
    banner.appendChild(inner);

    if (options.color) banner.style.setProperty('--progressierAccent', options.color);
    if (options.btnColor) banner.style.setProperty('--progressierAccentText', options.btnColor);

    function dismiss() {
      if (!options.preview) denyBanner(BANNER_INSTALL_COOKIE);
      banner.classList.remove('in');
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 1000);
    }

    notNow.addEventListener('click', dismiss);
    close.addEventListener('click', dismiss);
    close.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') dismiss();
    });

    document.body.appendChild(banner);
    scanButtons();
    setTimeout(function () {
      banner.classList.add('in');
    }, 500);
    return banner;
  }

  /* ------------------------------------------------------------------ *
   * Push banner
   * ------------------------------------------------------------------ */

  function removePushBanner() {
    var banner = document.querySelector('.progressier-push-banner');
    if (!banner) return;
    banner.classList.remove('in');
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 1000);
  }

  function showPushBanner(options) {
    options = options || {};
    if (!pushSupported()) return null;
    if (Notification.permission === 'denied' && !options.preview) return null;
    if (isStandalone() && Notification.permission === 'granted') return null;
    if (!options.preview && !bannerAllowed(BANNER_PUSH_COOKIE, options.interval == null ? 7 : options.interval)) return null;

    removePushBanner();

    var banner = make('div', 'progressier-push-banner');
    if (wording.rtl()) banner.setAttribute('dir', 'rtl');

    var inner = make('div', 'progressier-push-banner-inner');
    var details = make('div', 'progressier-push-banner-details');

    var icon = make('div', 'progressier-push-banner-icon');
    var image = document.createElement('img');
    image.src = options.icon || appIcon();
    image.alt = 'app icon';
    icon.appendChild(image);

    var text = make('div', 'progressier-push-banner-text');
    text.textContent = options.text || wording.get('wannaShowNotifications');

    details.appendChild(icon);
    details.appendChild(text);

    var buttons = make('div', 'progressier-push-banner-btns');
    var notNow = make('button', '', wording.get('notNow'));
    notNow.type = 'button';
    var subscribe = make('button', 'progressier-subscribe-button', wording.get('allowNotifications'));
    subscribe.type = 'button';
    buttons.appendChild(notNow);
    buttons.appendChild(subscribe);
    details.appendChild(buttons);

    var close = make('div', 'progressier-push-banner-close', ICONS.close);
    close.setAttribute('role', 'button');
    close.setAttribute('tabindex', '0');

    inner.appendChild(details);
    inner.appendChild(close);
    banner.appendChild(inner);

    if (options.color) banner.style.setProperty('--progressierAccent', options.color);
    if (options.btnColor) banner.style.setProperty('--progressierAccentText', options.btnColor);

    function dismiss() {
      if (!options.preview) denyBanner(BANNER_PUSH_COOKIE);
      removePushBanner();
    }

    notNow.addEventListener('click', dismiss);
    close.addEventListener('click', dismiss);
    close.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') dismiss();
    });

    // Close automatically once permission is granted.
    subscribe.addEventListener('click', function () {
      setTimeout(function () {
        if ('Notification' in window && Notification.permission === 'granted') {
          if (options.autoPromptStandalone || true) removePushBanner();
        }
      }, 1200);
    });

    document.body.appendChild(banner);
    scanButtons();
    setTimeout(function () {
      banner.classList.add('in');
    }, 500);
    return banner;
  }

  /* ------------------------------------------------------------------ *
   * Offline alert
   * ------------------------------------------------------------------ */

  var offlineAlertElement = null;
  var offlineAlertEnabled = false;

  function hideOfflineAlert() {
    if (!offlineAlertElement) return;
    var element = offlineAlertElement;
    offlineAlertElement = null;
    element.classList.remove('in');
    setTimeout(function () {
      if (element.parentNode) element.parentNode.removeChild(element);
    }, 300);
  }

  function showOfflineAlert(options) {
    options = options || {};
    if (offlineAlertElement) return offlineAlertElement;

    var alert = make('div', 'progressier-offline-alert');
    if (wording.rtl()) alert.setAttribute('dir', 'rtl');

    var illustration = make('div', 'progressier-offline-alert-illustration', ICONS.wifiOff);
    var body = make('div', 'progressier-offline-alert-body');
    var heading = document.createElement('h2');
    heading.textContent = wording.get('youreOffline');
    var copy = document.createElement('p');
    copy.textContent = wording.get('getBackOnline');
    body.appendChild(heading);
    body.appendChild(copy);

    var wifi = make('div', 'progressier-offline-alert-wifi', ICONS.wifiOff);

    alert.appendChild(illustration);
    alert.appendChild(body);
    alert.appendChild(wifi);

    if (options.dismissible !== false) {
      var close = make('div', 'progressier-offline-alert-close', ICONS.close);
      close.setAttribute('role', 'button');
      close.setAttribute('aria-label', wording.get('close'));
      close.addEventListener('click', function (event) {
        event.stopPropagation();
        hideOfflineAlert();
      });
      alert.appendChild(close);
    }

    document.body.appendChild(alert);
    offlineAlertElement = alert;
    return alert;
  }

  function enableOfflineAlert() {
    if (offlineAlertEnabled) return;
    offlineAlertEnabled = true;
    function update() {
      if (navigator.onLine) hideOfflineAlert();
      else showOfflineAlert();
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  /* ------------------------------------------------------------------ *
   * Reload prompt
   * ------------------------------------------------------------------ */

  var reloadPromptShown = false;
  var reloadPromptTimer = null;
  var loadTime = Date.now();

  function showReloadPrompt(options) {
    options = options || {};
    if (reloadPromptShown) return null;
    reloadPromptShown = true;

    if (options.autoReload) {
      window.location.reload();
      return null;
    }

    var overlay = make('div', 'progressier-prompt-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', wording.get('tapToReload'));
    overlay.addEventListener('click', function () {
      window.location.reload();
    });

    var button = make('div', 'progressier-prompt-reload-button');
    button.textContent = options.text || wording.get('tapToReload');
    if (options.color) button.style.background = options.color;
    overlay.appendChild(button);

    document.body.appendChild(overlay);
    return overlay;
  }

  function enableReloadPrompt(options) {
    options = options || {};
    var minutes = Number(options.minutes == null ? 60 : options.minutes);
    if (!minutes || minutes < 1) return;
    if (reloadPromptTimer) clearInterval(reloadPromptTimer);
    reloadPromptTimer = setInterval(function () {
      if (reloadPromptShown) {
        clearInterval(reloadPromptTimer);
        return;
      }
      if ((Date.now() - loadTime) / 60000 >= minutes) {
        clearInterval(reloadPromptTimer);
        showReloadPrompt(options);
      }
    }, 15000);
  }

  /* ------------------------------------------------------------------ *
   * Flow / welcome modal
   * ------------------------------------------------------------------ */

  function closeFlow(flow) {
    flow.classList.add('removing');
    setTimeout(function () {
      if (flow.parentNode) flow.parentNode.removeChild(flow);
    }, 300);
  }

  function showFlow(options) {
    options = options || {};

    var flow = make('div', 'pwa-flow');
    if (wording.rtl()) flow.setAttribute('dir', 'rtl');
    flow.setAttribute('role', 'dialog');
    flow.setAttribute('aria-modal', 'true');

    var inner = make('div', 'pwa-flow-inner');

    var header = make('div', 'pwa-flow-header');
    var title = make('div', 'pwa-flow-title');
    title.textContent = options.title || wording.get('welcomeTitle');
    var close = closeButton();
    close.setAttribute('aria-label', wording.get('close'));
    header.appendChild(title);
    header.appendChild(close);
    inner.appendChild(header);

    if (options.text || options.items) {
      var body = make('div', 'pwa-flow-body');
      if (options.text) {
        var paragraph = document.createElement('p');
        paragraph.textContent = options.text;
        body.appendChild(paragraph);
      }
      if (options.items && options.items.length) {
        var list = document.createElement('ul');
        options.items.forEach(function (item) {
          var entry = document.createElement('li');
          entry.textContent = item;
          list.appendChild(entry);
        });
        body.appendChild(list);
      }
      inner.appendChild(body);
    }

    if (options.app !== false) {
      var details = make('div', 'pwa-flow-details');
      var image = document.createElement('img');
      image.src = options.icon || appIcon();
      image.alt = '';
      var text = make('div', 'pwa-flow-text');
      var name = document.createElement('div');
      name.textContent = options.appName || document.title || location.hostname;
      var hint = document.createElement('div');
      hint.textContent = options.appHint || location.hostname;
      text.appendChild(name);
      text.appendChild(hint);
      details.appendChild(image);
      details.appendChild(text);
      inner.appendChild(details);
    }

    if (options.button || options.secondary) {
      var actions = make('div', 'pwa-flow-actions');
      if (options.button) {
        var primary = make('button', 'pwa-flow-btn', options.button);
        primary.type = 'button';
        primary.addEventListener('click', function () {
          if (typeof options.onPrimary === 'function') options.onPrimary();
          closeFlow(flow);
        });
        actions.appendChild(primary);
      }
      if (options.secondary) {
        var secondary = make('button', 'pwa-flow-btn secondary', options.secondary);
        secondary.type = 'button';
        secondary.addEventListener('click', function () {
          if (typeof options.onSecondary === 'function') options.onSecondary();
          closeFlow(flow);
        });
        actions.appendChild(secondary);
      }
      inner.appendChild(actions);
    }

    function destroy() {
      document.removeEventListener('keydown', onKey);
      closeFlow(flow);
    }
    function onKey(event) {
      if (event.key === 'Escape' && options.dismissible !== false) destroy();
    }

    close.addEventListener('click', destroy);
    if (options.dismissible !== false) {
      flow.addEventListener('click', function (event) {
        if (event.target === flow) destroy();
      });
      document.addEventListener('keydown', onKey);
    } else {
      close.style.visibility = 'hidden';
    }

    flow.appendChild(inner);
    document.body.appendChild(flow);
    return flow;
  }

  function runNetworkDiagnostics(options) {
    options = options || {};
    if (config.features && config.features.diagnostics === false) {
      return Promise.resolve({
        hostname: domainConfig.domain.hostname, classification: 'disabled', status: 'disabled',
        message: 'Network diagnostics are disabled for this domain.',
      });
    }
    if (!window.YouGeDns || typeof window.YouGeDns.check !== 'function') {
      // A missing engine is an unavailable check, not an inconclusive result:
      // the status says so instead of implying a probe was attempted.
      return Promise.resolve({
        hostname: domainConfig.domain.hostname, classification: 'unknown', status: 'unavailable',
        message: 'The DNS diagnostics module is not loaded.',
      });
    }
    var diagnosticsConfig = domainConfig.diagnostics || {};
    return window.YouGeDns.check({
      hostname: domainConfig.domain.hostname,
      origin: domainConfig.domain.origin,
      basePath: domainConfig.domain.basePath,
      online: navigator.onLine,
      appProbePath: diagnosticsConfig.appProbePath,
      backendProbePath: diagnosticsConfig.backendProbePath,
    }, options);
  }

  function showNetworkDiagnostics() {
    if (document.querySelector('[data-pwa-diagnostics-dialog]')) return document.querySelector('[data-pwa-diagnostics-dialog]');
    if (config.features && config.features.diagnostics === false) return null;

    var flow = make('div', 'pwa-flow pwa-network-diagnostics');
    flow.setAttribute('data-pwa-diagnostics-dialog', '');
    flow.setAttribute('role', 'dialog');
    flow.setAttribute('aria-modal', 'true');
    flow.setAttribute('aria-label', 'Network diagnostics');
    var inner = make('div', 'pwa-flow-inner');
    var header = make('div', 'pwa-flow-header');
    var title = make('div', 'pwa-flow-title', 'Network diagnostics');
    var close = closeButton();
    close.setAttribute('aria-label', 'Close');
    close.setAttribute('role', 'button');
    close.setAttribute('tabindex', '0');
    header.appendChild(title);
    header.appendChild(close);
    inner.appendChild(header);

    var body = make('div', 'pwa-flow-body');
    var target = document.createElement('p');
    target.textContent = 'Testing connection to: ' + domainConfig.domain.hostname;
    var resolver = document.createElement('p');
    resolver.textContent = 'DNS resolver: Cloudflare DNS (1.1.1.1)';
    var status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Diagnostics run only when you choose to start or retry.';
    var detail = document.createElement('p');
    detail.className = 'pwa-diagnostics-detail';
    body.appendChild(target);
    body.appendChild(resolver);
    body.appendChild(status);
    body.appendChild(detail);
    inner.appendChild(body);

    var actions = make('div', 'pwa-flow-actions');
    var retry = make('button', 'pwa-flow-btn', 'Run diagnostics');
    retry.type = 'button';
    actions.appendChild(retry);
    inner.appendChild(actions);

    var recovery = document.createElement('details');
    recovery.className = 'pwa-diagnostics-recovery';
    var summary = document.createElement('summary');
    summary.textContent = 'DNS recovery instructions';
    recovery.appendChild(summary);
    var guide = document.createElement('div');
    guide.className = 'pwa-flow-body';
    var android = document.createElement('p');
    android.textContent = 'Android: Settings → Network & internet → Private DNS → select provider hostname → enter one.one.one.one → Save. Return to ' + domainConfig.domain.hostname + ' and retry.';
    var androidLink = document.createElement('a');
    androidLink.href = 'https://developers.cloudflare.com/1.1.1.1/setup/android/';
    androidLink.target = '_blank';
    androidLink.rel = 'noopener noreferrer';
    androidLink.textContent = 'Official Android instructions';
    var ios = document.createElement('p');
    ios.textContent = 'iPhone or iPad: install Cloudflare 1.1.1.1, choose DNS-only mode (WARP is not required), then return to this domain and retry.';
    var iosLink = document.createElement('a');
    iosLink.href = 'https://developers.cloudflare.com/1.1.1.1/setup/ios/';
    iosLink.target = '_blank';
    iosLink.rel = 'noopener noreferrer';
    iosLink.textContent = 'Official iOS instructions';
    var playLink = document.createElement('a');
    playLink.href = 'https://play.google.com/store/apps/details?id=com.cloudflare.onedotonedotonedotone';
    playLink.target = '_blank';
    playLink.rel = 'noopener noreferrer';
    playLink.textContent = 'Cloudflare 1.1.1.1 for Android';
    var appStoreLink = document.createElement('a');
    appStoreLink.href = 'https://apps.apple.com/app/1-1-1-1-faster-internet/id1423538627';
    appStoreLink.target = '_blank';
    appStoreLink.rel = 'noopener noreferrer';
    appStoreLink.textContent = 'Cloudflare 1.1.1.1 for iPhone';
    var androidGuide = [android, androidLink, document.createElement('br'), playLink];
    var iosGuide = [ios, iosLink, document.createElement('br'), appStoreLink];
    var recoveryOrder = isIOS() ? [iosGuide, androidGuide] : /Android/i.test(ua) ? [androidGuide, iosGuide] : [androidGuide, iosGuide];
    recoveryOrder.forEach(function (group) {
      group.forEach(function (element) { guide.appendChild(element); });
    });
    recovery.appendChild(guide);
    recovery.hidden = Boolean(domainConfig.features && domainConfig.features.dnsRecovery === false);
    inner.appendChild(recovery);
    flow.appendChild(inner);
    document.body.appendChild(flow);

    var running = false;
    function run() {
      if (running) return;
      running = true;
      retry.disabled = true;
      retry.textContent = 'Checking…';
      status.textContent = 'Checking Cloudflare DNS and the current application host…';
      detail.textContent = '';
      runNetworkDiagnostics().then(function (result) {
        status.textContent = result.message || result.classification;
        detail.textContent = (result.classification || 'unknown').replace(/_/g, ' ') +
          (result.dns && result.dns.length ? ' — ' + result.dns.map(function (entry) { return entry.type + ': ' + entry.statusText; }).join(', ') : '');
        if (result.caveat) detail.textContent += ' ' + result.caveat;
        dispatch('diagnostics', result);
      }).catch(function (error) {
        status.textContent = 'Diagnostics could not complete.';
        detail.textContent = error && error.message ? error.message : 'Retry when your connection is available.';
        // Same contract as a resolved check: centralized state must hear about
        // failed modal runs too, with one consistent failure shape.
        dispatch('diagnostics', {
          hostname: domainConfig.domain.hostname,
          classification: 'error',
          status: 'error',
          failed: true,
          message: error && error.message ? error.message : 'Diagnostics could not complete.',
        });
      }).then(function () {
        running = false;
        retry.disabled = false;
        retry.textContent = 'Retry diagnostics';
      });
    }
    function destroy() {
      document.removeEventListener('keydown', onKey);
      closeFlow(flow);
    }
    function onKey(event) { if (event.key === 'Escape') destroy(); }
    close.addEventListener('click', destroy);
    close.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') destroy(); });
    flow.addEventListener('click', function (event) { if (event.target === flow) destroy(); });
    document.addEventListener('keydown', onKey);
    retry.addEventListener('click', run);
    return flow;
  }

  function showWelcome(options) {
    return showFlow(
      Object.assign(
        {
          title: wording.get('welcomeTitle'),
          text: wording.get('welcomeText'),
          button: wording.get('install'),
          secondary: wording.get('notNow'),
          onPrimary: function () {
            promptInstall();
          },
        },
        options || {}
      )
    );
  }

  /* ------------------------------------------------------------------ *
   * QR install code
   * ------------------------------------------------------------------ *
   * The hosted client asked Progressier's /install-code.svg endpoint for
   * the image. This version encodes the URL locally with qrcode-generator
   * (MIT) and draws the app logo in the middle, using the same 300x300
   * canvas / 250x250 display size as the original.
   */

  var qrLibraryPromise = null;

  function loadQrLibrary() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrLibraryPromise) return qrLibraryPromise;

    qrLibraryPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = config.qrLibraryUrl;
      script.async = true;
      if (config.nonce) script.setAttribute('nonce', config.nonce);
      script.onload = function () {
        if (window.qrcode) resolve(window.qrcode);
        else {
          qrLibraryPromise = null;
          reject(new Error('qrcode-generator did not expose window.qrcode'));
        }
      };
      script.onerror = function () {
        qrLibraryPromise = null;
        reject(new Error('Unable to load ' + config.qrLibraryUrl));
      };
      document.head.appendChild(script);
    });

    return qrLibraryPromise;
  }

  function colorToHex(value, fallback) {
    var color = String(value || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;

    var match = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (match) {
      return (
        '#' +
        [match[1], match[2], match[3]]
          .map(function (part) {
            return Math.max(0, Math.min(255, Math.round(Number(part))))
              .toString(16)
              .padStart(2, '0');
          })
          .join('')
      );
    }
    return fallback;
  }

  function themeValue(property, fallback) {
    try {
      var value = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
      return value || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function qrPalette() {
    var light = colorToHex(themeValue('--progressierBg', config.themeColor || '#ffffff'), '#ffffff');
    var dark = colorToHex(themeValue('--progressierTxt', '#142a37'), '#142a37');

    // A QR code must stay dark-on-light even with a dark theme.
    function luminance(hex) {
      var value = parseInt(hex.slice(1), 16);
      var channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(function (part) {
        var channel = part / 255;
        return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    if (luminance(light) < luminance(dark)) {
      var swap = light;
      light = dark;
      dark = swap;
    }
    return { light: light, dark: dark };
  }

  function installUrl(url) {
    var value = url || window.location.href;
    try {
      var parsed = new URL(value, window.location.origin);
      parsed.searchParams.set('pswutlzoq', 'install');
      return parsed.href;
    } catch (error) {
      return value;
    }
  }

  function drawQrLogo(canvas, image) {
    var context = canvas.getContext('2d');
    if (!context) return;
    var palette = qrPalette();
    var box = 70;
    var logo = 50;
    var offset = (canvas.width - box) / 2;

    context.save();
    context.fillStyle = palette.light;
    context.fillRect(offset, offset, box, box);
    context.drawImage(image, offset + (box - logo) / 2, offset + (box - logo) / 2, logo, logo);
    context.restore();
  }

  function renderQr(container, url, options) {
    options = options || {};
    container.innerHTML = '';
    container.classList.add('loading');
    container.classList.remove('error');

    return loadQrLibrary()
      .then(function (qrcode) {
        var code = qrcode(0, 'M');
        code.addData(url);
        code.make();

        var size = 300;
        var count = code.getModuleCount();
        var quiet = 4;
        var cell = size / (count + quiet * 2);
        var offset = (size - count * cell) / 2;
        var palette = qrPalette();

        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.className = 'pwa-qr-canvas';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', options.alt || wording.get('scanCode'));

        var context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is not available');

        context.fillStyle = palette.light;
        context.fillRect(0, 0, size, size);
        context.fillStyle = palette.dark;

        for (var row = 0; row < count; row += 1) {
          for (var col = 0; col < count; col += 1) {
            if (!code.isDark(row, col)) continue;
            var left = Math.floor(offset + col * cell);
            var top = Math.floor(offset + row * cell);
            var right = Math.ceil(offset + (col + 1) * cell);
            var bottom = Math.ceil(offset + (row + 1) * cell);
            context.fillRect(left, top, right - left, bottom - top);
          }
        }

        container.appendChild(canvas);
        container.classList.remove('loading');

        var logoSrc = options.logo || config.qrLogo || config.splashIcon || appIcon();
        if (!logoSrc || options.logo === false) return canvas;

        var image = new Image();
        image.onload = function () {
          if (!container.isConnected) return;
          try {
            drawQrLogo(canvas, image);
          } catch (error) {
            log('QR logo could not be drawn', error);
          }
        };
        image.onerror = function () {
          log('QR logo failed to load', logoSrc);
        };
        image.src = logoSrc;
        return canvas;
      })
      .catch(function (error) {
        container.classList.remove('loading');
        container.classList.add('error');
        log('QR code generation failed', error);
        var message = document.createElement('div');
        message.className = 'pwa-qr-error';
        message.textContent = wording.get('qrUnavailable');
        container.appendChild(message);
        var fallback = document.createElement('div');
        fallback.className = 'pwa-qr-url';
        fallback.textContent = url;
        container.appendChild(fallback);
        throw error;
      });
  }

  function cleanInstallParam() {
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get('pswutlzoq') !== 'install') return;
      url.searchParams.delete('pswutlzoq');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (error) {
      /* ignore */
    }
  }

  function showQrDialog(options) {
    options = options || {};
    var existing = document.querySelector('.pwa-qr-dialog');
    if (existing) return existing;

    var url = installUrl(options.url);
    var flow = make('div', 'pwa-flow pwa-qr-dialog');
    if (wording.rtl()) flow.setAttribute('dir', 'rtl');
    flow.setAttribute('role', 'dialog');
    flow.setAttribute('aria-modal', 'true');
    flow.setAttribute('aria-label', options.title || wording.get('installTheApp'));

    var inner = make('div', 'pwa-flow-inner qrcode');

    var header = make('div', 'pwa-flow-header');
    var title = make('div', 'pwa-flow-title');
    title.textContent = options.title || wording.get('installTheApp');
    var close = closeButton();
    close.setAttribute('aria-label', wording.get('close'));
    header.appendChild(title);
    header.appendChild(close);
    inner.appendChild(header);

    var qrBox = make('div', 'pwa-flow-qr progressier-qr loading');
    inner.appendChild(qrBox);

    var body = make('div', 'pwa-flow-body pwa-qr-body');
    var copy = document.createElement('p');
    copy.textContent = options.text || wording.get('scanCode');
    body.appendChild(copy);

    if (options.installHere) {
      var installHere = make('button', 'pwa-flow-btn pwa-qr-install-here', wording.get('installHere'));
      installHere.type = 'button';
      installHere.addEventListener('click', function () {
        promptInstall({ skipQr: true });
      });
      body.appendChild(installHere);
    }
    inner.appendChild(body);

    function destroy() {
      document.removeEventListener('keydown', onKey);
      cleanInstallParam();
      closeFlow(flow);
    }
    function onKey(event) {
      if (event.key === 'Escape' && options.dismissible !== false) destroy();
    }

    close.addEventListener('click', destroy);
    if (options.dismissible !== false) {
      flow.addEventListener('click', function (event) {
        if (event.target === flow) destroy();
      });
      document.addEventListener('keydown', onKey);
    } else {
      close.style.visibility = 'hidden';
    }

    flow.appendChild(inner);
    document.body.appendChild(flow);

    track('qr_open', { url: url });
    renderQr(qrBox, url, options).catch(function () {
      /* The error state is rendered inside the dialog. */
    });

    return flow;
  }

  function showQRCode(options) {
    if (config.features && config.features.qr === false) return null;
    if (typeof options === 'string') options = { url: options };
    return showQrDialog(options || {});
  }

  // Opening ?pswutlzoq=install (the URL encoded in the QR code) shows the
  // install flow straight away, like the hosted client did.
  function showInstallRequest() {
    if (domainConfig.pwa.enabled === false || domainConfig.features.installation === false) return null;
    cleanInstallParam();
    if (config.desktopQr && config.features.qr !== false && !isIOS() && window.screen.width > 991) {
      return showQrDialog();
    }
    return showFlow({
      title: wording.get('installTheApp'),
      text: wording.get('welcomeText'),
      button: wording.get('install'),
      secondary: wording.get('notNow'),
      onPrimary: function () {
        promptInstall();
      },
    });
  }

  function scanQrButtons() {
    if (config.features && config.features.qr === false) {
      document.querySelectorAll('[data-pwa-qr]').forEach(function (node) { node.hidden = true; });
      return;
    }
    document.querySelectorAll('[data-pwa-qr]:not(.pwa-qr-captured)').forEach(function (node) {
      node.classList.add('pwa-qr-captured', 'captured');
      node.setAttribute('role', 'button');
      if (isStandalone() && node.getAttribute('data-hide-standalone') !== 'false') {
        node.hidden = true;
        return;
      }
      node.addEventListener('click', function (event) {
        event.preventDefault();
        var value = node.getAttribute('data-pwa-qr');
        showQrDialog({
          url: value && value !== 'true' ? value : undefined,
        });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Floating install toolbox (Progressier-style app icon)
   * ------------------------------------------------------------------ */

  var toolboxRoot = null;
  var toolboxButton = null;
  var toolboxImage = null;
  var toolboxOptions = null;
  var toolboxManuallyHidden = false;
  var toolboxPending = false;
  var toolboxPendingOptions = null;
  var toolboxVisibilityTimer = null;
  var toolboxUnsubscribe = null;

  function parseToolboxUrls(value) {
    if (Array.isArray(value))
      return value
        .map(String)
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);
    var text = String(value || '').trim();
    if (!text) return [];
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parseToolboxUrls(parsed);
    } catch (error) {
      /* A comma-separated list is also accepted. */
    }
    return text
      .split(',')
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function normalizeToolboxOptions(options) {
    options = options || {};
    var image = options.image;
    if (image === undefined) image = config.toolboxImage;
    if (image) image = resolveUrl(String(image));

    return {
      position: options.position || config.toolboxPosition || 'right',
      color: options.color || config.toolboxColor || themeColor() || '#ffffff',
      image: image || '',
      useLogo: options.useLogo == null ? config.toolboxUseLogo : Boolean(options.useLogo),
      hideStandalone:
        options.hideStandalone == null ? config.toolboxHideStandalone : Boolean(options.hideStandalone),
      showPlatforms: String(options.showPlatforms || config.toolboxShowPlatforms || 'all').toLowerCase(),
      showUrls: parseToolboxUrls(options.showUrls == null ? config.toolboxShowUrls : options.showUrls),
      off: config.toolboxOff || Boolean(options.off),
      requireServiceWorker: options.requireServiceWorker !== false,
      appName: options.appName || appName(),
    };
  }

  function toolboxPositionClasses(position) {
    var allowed = ['left', 'right', 'center', 'top', 'middle'];
    var tokens = String(position || 'right')
      .toLowerCase()
      .split('-')
      .filter(function (token) {
        return allowed.indexOf(token) !== -1;
      });
    var horizontal =
      tokens.find(function (token) {
        return token === 'left' || token === 'right' || token === 'center';
      }) || 'right';
    var vertical = tokens.find(function (token) {
      return token === 'top' || token === 'middle';
    });
    var classes = ['progressier-' + horizontal];
    if (vertical) classes.push('progressier-' + vertical);
    return classes;
  }

  function toolboxPatternMatches(pattern) {
    var value = String(pattern || '').trim();
    if (!value) return false;

    var current;
    try {
      current = new URL(window.location.href);
    } catch (error) {
      return false;
    }

    var currentPath = current.pathname.replace(/\/$/, '') || '/';
    if (value.indexOf('*') !== -1) {
      var escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
      return new RegExp(escaped, 'i').test((current.origin + currentPath).toLowerCase());
    }

    try {
      var target = new URL(value, window.location.href);
      var targetPath = target.pathname.replace(/\/$/, '') || '/';
      if (target.origin !== current.origin || targetPath !== currentPath) return false;
      if (!target.search) return true;

      // Progressier treats a URL's query as a subset match: every parameter in
      // the configured pattern must match, but the current URL may have extras.
      var currentQuery = new URLSearchParams(current.search);
      var targetQuery = new URLSearchParams(target.search);
      var queryMatches = true;
      targetQuery.forEach(function (queryValue, key) {
        if (currentQuery.get(key) !== queryValue) queryMatches = false;
      });
      return queryMatches;
    } catch (error) {
      return false;
    }
  }

  function toolboxUrlAllowed(patterns) {
    if (!patterns || !patterns.length) return true;

    var allowedPatterns = [];
    var blockedPatterns = [];
    patterns.forEach(function (pattern) {
      var value = String(pattern || '').trim();
      if (!value) return;
      if (value.indexOf('%&%') === 0) blockedPatterns.push(value.slice(3));
      else allowedPatterns.push(value);
    });

    if (blockedPatterns.some(toolboxPatternMatches)) return false;
    return !allowedPatterns.length || allowedPatterns.some(toolboxPatternMatches);
  }

  function toolboxIsEmbedded() {
    try {
      return window.self !== window.top;
    } catch (error) {
      return true;
    }
  }

  // Match ProgressierDetection.isDesktop for toolbox targeting rather than
  // relying on a generic mobile-UA substring (notably iPadOS desktop mode).
  function toolboxIsDesktop() {
    try {
      var platform = String(navigator.platform || '').toLowerCase();
      var userAgent = String(ua || '').toLowerCase();
      var iosPlatforms = [
        'ipad simulator',
        'iphone simulator',
        'ipod simulator',
        'ipad',
        'iphone',
        'ipod',
      ];
      var iosDevice =
        iosPlatforms.indexOf(platform) !== -1 ||
        (ua.indexOf('Mac') !== -1 && 'ontouchend' in document);

      if (platform.indexOf('win') !== -1) return true;
      if (iosDevice) return false;
      if (userAgent.indexOf('android') !== -1) return false;
      if (platform.indexOf('mac') !== -1) return true;
      if (userAgent.indexOf('linux') !== -1) return true;
      if (platform.indexOf('linux') !== -1 && userAgent.indexOf('cros') !== -1) return true;
      return false;
    } catch (error) {
      return false;
    }
  }

  function toolboxShouldHide() {
    if (!toolboxRoot || !toolboxOptions) return true;
    if (domainConfig.pwa.enabled === false || domainConfig.features.installation === false) return true;
    if (toolboxManuallyHidden || toolboxOptions.off) return true;
    if (toolboxIsEmbedded()) return true;
    if (document.body && document.body.classList.contains('no-toolbox')) return true;
    if (toolboxOptions.hideStandalone && isStandalone()) return true;

    var desktop = toolboxIsDesktop();
    if (toolboxOptions.showPlatforms === 'mobile' && desktop) return true;
    if (toolboxOptions.showPlatforms === 'desktop' && !desktop) return true;
    if (!toolboxUrlAllowed(toolboxOptions.showUrls)) return true;
    if (toolboxOptions.requireServiceWorker && (!('serviceWorker' in navigator) || !registration)) return true;
    return false;
  }

  function renderToolbox() {
    if (!toolboxRoot || !toolboxOptions) return;

    toolboxRoot.className =
      'pwa-toolbox progressier-widget ' + toolboxPositionClasses(toolboxOptions.position).join(' ');
    toolboxButton.style.backgroundColor = toolboxOptions.color;
    toolboxButton.setAttribute('aria-label', wording.get('installTheApp') + ' — ' + toolboxOptions.appName);
    toolboxButton.title = wording.get('installTheApp');

    var logo = appIcon();
    var image = toolboxOptions.useLogo ? logo : toolboxOptions.image || logo;
    if (toolboxImage.src !== image) toolboxImage.src = image;

    var hidden = toolboxShouldHide();
    toolboxRoot.classList.toggle('off', hidden);
    toolboxRoot.hidden = hidden;
    toolboxRoot.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    toolboxButton.tabIndex = hidden ? -1 : 0;
  }

  function onToolboxClick() {
    try {
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (error) {
      /* Vibration is an optional enhancement. */
    }
    try {
      showInstallRequest();
    } catch (error) {
      log('toolbox install flow failed', error);
    }
  }

  function enableToolbox(options) {
    if (!document.body) {
      toolboxPendingOptions = options || toolboxPendingOptions || {};
      if (!toolboxPending) {
        toolboxPending = true;
        document.addEventListener(
          'DOMContentLoaded',
          function () {
            if (!toolboxPending) return;
            var pendingOptions = toolboxPendingOptions;
            toolboxPending = false;
            toolboxPendingOptions = null;
            enableToolbox(pendingOptions);
          },
          { once: true },
        );
      }
      return null;
    }

    toolboxOptions = normalizeToolboxOptions(options);
    toolboxManuallyHidden = false;

    if (!toolboxRoot) {
      toolboxRoot = make('div', 'pwa-toolbox progressier-widget');
      toolboxRoot.setAttribute('data-pwa-toolbox', '');

      toolboxButton = document.createElement('button');
      toolboxButton.className = 'pwa-toolbox-icon progressier-widget-icon';
      toolboxButton.type = 'button';
      toolboxButton.addEventListener('click', onToolboxClick);

      toolboxImage = document.createElement('img');
      toolboxImage.className = 'pwa-toolbox-logo progressier-widget-logo';
      toolboxImage.alt = '';
      toolboxImage.draggable = false;
      toolboxImage.addEventListener('error', function () {
        if (toolboxOptions && toolboxOptions.image && !toolboxOptions.useLogo) {
          toolboxOptions.image = '';
          if (toolboxImage) toolboxImage.src = appIcon();
        } else if (toolboxImage) {
          toolboxImage.hidden = true;
        }
      });
      toolboxImage.addEventListener('load', function () {
        if (toolboxImage) toolboxImage.hidden = false;
      });

      toolboxButton.appendChild(toolboxImage);
      toolboxRoot.appendChild(toolboxButton);
      document.body.appendChild(toolboxRoot);

      toolboxUnsubscribe = onChange(renderToolbox);
      window.addEventListener('resize', renderToolbox);
      window.addEventListener('pageshow', renderToolbox);
      window.addEventListener('popstate', renderToolbox);
      toolboxVisibilityTimer = setInterval(renderToolbox, 1000);
    }

    renderToolbox();
    return toolboxRoot;
  }

  function showToolbox(options) {
    if (options || !toolboxRoot) return enableToolbox(options);
    toolboxManuallyHidden = false;
    renderToolbox();
    return toolboxRoot;
  }

  function hideToolbox() {
    toolboxManuallyHidden = true;
    renderToolbox();
    return toolboxRoot;
  }

  function disableToolbox() {
    toolboxPending = false;
    toolboxPendingOptions = null;
    if (toolboxVisibilityTimer) clearInterval(toolboxVisibilityTimer);
    toolboxVisibilityTimer = null;
    if (toolboxUnsubscribe) toolboxUnsubscribe();
    toolboxUnsubscribe = null;
    window.removeEventListener('resize', renderToolbox);
    window.removeEventListener('pageshow', renderToolbox);
    window.removeEventListener('popstate', renderToolbox);
    if (toolboxRoot && toolboxRoot.parentNode) toolboxRoot.parentNode.removeChild(toolboxRoot);
    toolboxRoot = null;
    toolboxButton = null;
    toolboxImage = null;
    toolboxOptions = null;
    toolboxManuallyHidden = false;
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */

  var toastTimer = null;

  function notify(message, options) {
    options = options || {};
    var existing = document.querySelector('.pwa-toast');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (toastTimer) clearTimeout(toastTimer);

    var toast = make('div', 'pwa-toast');
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    if (options.background) toast.style.background = options.background;
    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('in');
    });

    toastTimer = setTimeout(function () {
      toast.classList.remove('in');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, Number(options.duration) || 3200);

    return toast;
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  var PWA = {
    __pwaKit: true,
    version: '1.1.0',
    config: config,

    // install
    promptInstall: promptInstall,
    install: promptInstall,
    canInstall: function () {
      return Boolean(installPromptEvent);
    },
    isStandalone: isStandalone,
    isInstalled: function () {
      return installed || isStandalone();
    },
    isIOS: isIOS,
    isSafari: isSafari,
    onChange: onChange,
    refresh: refreshState,
    getState: getState,

    // service worker
    ready: readyPromise,
    register: function () {
      if (!registration) register();
      return readyPromise;
    },
    applyUpdate: applyUpdate,
    hasUpdate: isUpdateAvailable,
    postToWorker: postToWorker,

    // push
    pushSupported: pushSupported,
    subscribePush: subscribePush,
    unsubscribePush: unsubscribePush,
    requestPushPermission: function () {
      if (config.features && config.features.push === false) return Promise.resolve('denied');
      if (!('Notification' in window)) return Promise.resolve('denied');
      return requestNotificationPermission();
    },

    // badge
    setBadge: setBadge,
    clearBadge: clearBadge,

    // notification history (same IndexedDB store as Progressier)
    getNotifications: function () {
      return postToWorker({ type: 'GET_NOTIFICATIONS' }).then(function (result) {
        return result && result.notifications ? result.notifications : [];
      });
    },
    markNotificationsRead: function () {
      return postToWorker({ type: 'MARK_NOTIFICATIONS_READ' });
    },

    // share target
    getSharedFile: function () {
      return sharedFilePromise;
    },
    consumeSharedFile: function () {
      return sharedFilePromise;
    },

    // maintenance
    clearCaches: function (options) {
      return postToWorker({
        type: 'CLEAR_CACHES',
        includeStatic: Boolean(options && options.includeStatic),
      });
    },

    // components
    wording: wording,
    applyTheme: applyTheme,
    scanButtons: scanButtons,
    showInstallBanner: showInstallBanner,
    hideInstallBanner: removeInstallBanner,
    showPushBanner: showPushBanner,
    hidePushBanner: removePushBanner,
    showOfflineAlert: showOfflineAlert,
    hideOfflineAlert: hideOfflineAlert,
    enableOfflineAlert: enableOfflineAlert,
    showReloadPrompt: showReloadPrompt,
    enableReloadPrompt: enableReloadPrompt,
    enableToolbox: enableToolbox,
    showToolbox: showToolbox,
    hideToolbox: hideToolbox,
    disableToolbox: disableToolbox,
    showFlow: showFlow,
    showNetworkDiagnostics: showNetworkDiagnostics,
    runNetworkDiagnostics: runNetworkDiagnostics,
    showWelcome: showWelcome,
    showQRCode: showQRCode,
    showInstallRequest: showInstallRequest,
    createAppleSplashScreens: createAppleSplashScreens,
    notify: notify,
    icons: ICONS,

    // misc
    track: track,
    showInstallHelp: showHelp,
    urlBase64ToUint8Array: urlBase64ToUint8Array,
    arrayBufferToBase64: arrayBufferToBase64,
  };

  window.PWA = PWA;

  /* ------------------------------------------------------------------ *
   * Progressier compatibility shim (only if it isn't already loaded)
   * ------------------------------------------------------------------ */

  if (!window.progressier) {
    window.progressier = {
      install: function () {
        return promptInstall();
      },
      prompt: function () {
        return promptInstall();
      },
      checkIfStandalone: function () {
        return isStandalone();
      },
      isStandalone: function () {
        return isStandalone();
      },
      register: function () {
        if (!registration) register();
        return readyPromise;
      },
      ready: readyPromise,
      clearAppBadge: clearBadge,
      setAppBadge: setBadge,
      getNotifications: function () {
        return PWA.getNotifications();
      },
      track: track,
      wording: wording,
      installBanner: showInstallBanner,
      pushBanner: showPushBanner,
      showWelcome: showWelcome,

      detection: {
        isStandalone: isStandalone,
        isIOS: isIOS,
        isSafari: isSafari,
        isDesktop: function () {
          return !isMobile();
        },
        isMobile: isMobile,
        supportsPush: pushSupported,
      },

      push: {
        isCompatible: pushSupported,
        isSubscribed: function () {
          return getPushStatus().then(function (status) {
            return status === 'subscribed';
          });
        },
        isDenied: function () {
          return Promise.resolve('Notification' in window && Notification.permission === 'denied');
        },
        prompt: handleSubscribeClick,
        subscribe: function (options) {
          return subscribePush(
            Object.assign({ vapidPublicKey: config.vapidPublicKey }, options || {})
          );
        },
        unsubscribe: unsubscribePush,
      },

      utils: {
        wait: function (ms) {
          return new Promise(function (resolve) {
            setTimeout(resolve, ms);
          });
        },
        vibrate: function (pattern) {
          try {
            if (navigator.vibrate) navigator.vibrate(pattern || 10);
          } catch (error) {
            /* ignore */
          }
        },
      },
    };
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  ensureHeadTags();
  ensureStyles();
  refreshState();
  refreshDom();
  scanButtons();
  if (config.toolbox) enableToolbox();
  setInterval(scanButtons, 150);

  function scheduleSplashScreens() {
    var run = function () {
      createAppleSplashScreens().catch(function (error) {
        log('splash generation failed', error);
      });
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 1200);
    }
  }

  scheduleSplashScreens();

  if (getParam('pswutlzoq') === 'install' && !isStandalone()) {
    setTimeout(function () {
      if (isStandalone()) return;
      if (document.querySelector('.pwa-flow')) return;
      showInstallRequest();
    }, 700);
  }

  if (config.offlineAlert) enableOfflineAlert();

  document.addEventListener('pwa:update', function () {
    if (!config.autoUpdate) showReloadPrompt();
  });

  window.addEventListener('load', function () {
    if (config.installBanner && domainConfig.features.installation !== false && domainConfig.pwa.enabled !== false && !isStandalone()) {
      setTimeout(function () {
        if (!isStandalone()) showInstallBanner({});
      }, 2500);
    }
    if (config.pushBanner && pushSupported() && Notification.permission === 'default') {
      setTimeout(function () {
        showPushBanner({});
      }, 4000);
    }
    if (config.welcome && domainConfig.features.installation !== false && domainConfig.pwa.enabled !== false) {
      var seen = false;
      try {
        seen = window.localStorage.getItem('pwakit:welcome') === '1';
      } catch (error) {
        /* ignore */
      }
      if (!seen) {
        setTimeout(function () {
          try {
            window.localStorage.setItem('pwakit:welcome', '1');
          } catch (error) {
            /* ignore */
          }
          showWelcome({
            onPrimary: function () {
              promptInstall();
            },
          });
        }, 1000);
      }
    }
  });

  if (launchSource !== 'browser') {
    track('launch', { source: launchSource });
  }

  // Delegated click handling so dynamically added buttons keep working.
  document.addEventListener('click', function (event) {
    var node = event.target;
    if (!node || !node.closest) return;
    var diagnosticsButton = node.closest('[data-pwa-diagnostics]');
    if (diagnosticsButton) {
      event.preventDefault();
      showNetworkDiagnostics();
      return;
    }
    var button = node.closest('[data-pwa-install]');
    if (!button) return;
    event.preventDefault();
    promptInstall();
  });

  // Keep the DOM in sync when the app renders new elements. Only scans when a
  // relevant element is added, so chatty apps don't trigger constant rescans.
  if (window.MutationObserver) {
    var pending = null;
    var selector = '[data-pwa-install],[data-pwa-hide-standalone],[data-pwa-show-standalone]';
    var observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (mutation) {
        if (!mutation.addedNodes || !mutation.addedNodes.length) return false;
        return Array.prototype.some.call(mutation.addedNodes, function (node) {
          if (!node || node.nodeType !== 1) return false;
          return node.matches(selector) || Boolean(node.querySelector(selector));
        });
      });
      if (!relevant) return;
      if (pending) clearTimeout(pending);
      pending = setTimeout(refreshDom, 50);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  try {
    var media = window.matchMedia('(display-mode: standalone)');
    if (media.addEventListener) media.addEventListener('change', refreshState);
    else if (media.addListener) media.addListener(refreshState);
  } catch (error) {
    /* ignore */
  }

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) refreshState();
  });

  dispatch('ready', getState());
  log('initialized', getState());
})();
