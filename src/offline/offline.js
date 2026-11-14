(function () {
  'use strict';

  var hint = document.getElementById('hint');
  var statusText = document.getElementById('statusText');
  var headline = document.getElementById('headline');
  var message = document.getElementById('message');
  var dot = document.getElementById('dot');
  var appName = document.getElementById('appName');
  var currentDomain = document.getElementById('currentDomain');
  var retryLink = document.getElementById('retryLink');
  var diagnosticsButton = document.getElementById('diagnosticsButton');
  var diagnosticsResult = document.getElementById('diagnosticsResult');
  if (!hint || !statusText || !headline || !message || !dot) return;

  var domainConfig = window.YouGeDomain && typeof window.YouGeDomain.resolve === 'function'
    ? window.YouGeDomain.resolve({
        hostname: window.location.hostname,
        origin: window.location.origin,
        protocol: window.location.protocol,
        pathname: window.location.pathname,
      })
    : null;
  var workerBase = '/';
  try {
    var script = document.querySelector('script[src$="offline.js"]');
    workerBase = new URL('./', script ? script.src : window.location.href).pathname;
  } catch (error) {
    workerBase = '/';
  }
  if (domainConfig) {
    var fallbackName = document.documentElement.getAttribute('data-default-app-name') || 'You.Ge Assistant';
    var resolvedName = domainConfig.domain.configured ? domainConfig.identity.name : fallbackName;
    if (appName) appName.textContent = resolvedName;
    if (domainConfig.domain && domainConfig.domain.configured && domainConfig.pwa.basePath) workerBase = domainConfig.pwa.basePath;
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = domainConfig.branding.themeColor;
    document.documentElement.style.setProperty('--brand', domainConfig.branding.themeColor);
    var icon = document.querySelector('.icon');
    if (icon) {
      try { icon.src = new URL(domainConfig.branding.icon, new URL(workerBase, window.location.origin)).href; } catch (error) { /* keep bundled icon */ }
    }
  }
  if (currentDomain) currentDomain.textContent = window.location.hostname;
  if (retryLink) retryLink.href = workerBase;
  var recoveryGuide = document.getElementById('recoveryGuide');
  if (recoveryGuide && domainConfig && domainConfig.features.dnsRecovery === false) recoveryGuide.hidden = true;
  if (diagnosticsButton && domainConfig && domainConfig.features.diagnostics === false) diagnosticsButton.hidden = true;
  document.title = 'Offline — ' + (domainConfig && domainConfig.domain.configured
    ? domainConfig.identity.name
    : (document.documentElement.getAttribute('data-default-app-name') || 'You.Ge Assistant'));

  var wasOffline = !navigator.onLine;

  function setOnline() {
    statusText.textContent = 'You are online';
    dot.style.background = '#22c55e';
  }

  function setOffline() {
    statusText.textContent = 'You are offline';
    dot.style.background = '#f59e0b';
  }

  function update() {
    if (!navigator.onLine) {
      wasOffline = true;
      setOffline();
      headline.textContent = 'No connection';
      message.textContent =
        'Check your internet connection and try again. Pages you visited recently may still be available.';
      hint.textContent = 'Waiting for the network…';
      return;
    }

    setOnline();

    if (wasOffline) {
      headline.textContent = 'Connection restored';
      message.textContent = 'Reloading the app…';
      hint.textContent = 'Connection restored. Reloading…';
      setTimeout(function () {
        window.location.reload();
      }, 300);
      return;
    }

    headline.textContent = 'Connection looks fine';
    message.textContent = 'The app did not load. Open it again to continue.';
    hint.textContent = 'You are online. If the app did not load, try again.';
  }

  if (diagnosticsButton) {
    diagnosticsButton.addEventListener('click', function () {
      if (!window.YouGeDns || typeof window.YouGeDns.check !== 'function') {
        if (diagnosticsResult) diagnosticsResult.textContent = 'Diagnostics are unavailable. Check the connection and try again.';
        return;
      }
      diagnosticsButton.disabled = true;
      diagnosticsButton.textContent = 'Checking…';
      if (diagnosticsResult) diagnosticsResult.textContent = 'Checking Cloudflare DNS and ' + window.location.hostname + '…';
      window.YouGeDns.check({
        hostname: window.location.hostname,
        origin: window.location.origin,
        basePath: workerBase,
        online: navigator.onLine,
      }).then(function (result) {
        // Publish the result to the centralized Assistant state. This is a
        // browser event, not a second network request.
        if (window.CustomEvent && document.dispatchEvent) {
          document.dispatchEvent(new CustomEvent('youge:dns-result', { detail: result }));
        }
        if (!diagnosticsResult) return;
        diagnosticsResult.textContent = result.message + (result.caveat ? ' ' + result.caveat : '');
      }).catch(function () {
        if (window.CustomEvent && document.dispatchEvent) {
          document.dispatchEvent(new CustomEvent('youge:dns-result', {
            detail: { classification: 'error', message: 'Diagnostics could not complete.', failed: true }
          }));
        }
        if (diagnosticsResult) diagnosticsResult.textContent = 'Diagnostics could not complete. Retry when the connection is available.';
      }).then(function () {
        diagnosticsButton.disabled = false;
        diagnosticsButton.textContent = 'Retry diagnostics';
      });
    });
  }

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
})();
