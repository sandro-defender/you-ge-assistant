/*
 * Host-aware web manifest response helper.
 * Adapt this to your trusted edge/server routing framework. The registry is
 * public branding/configuration only; never put secrets in it.
 */
(function (root) {
  'use strict';

  function jsonResponse(body, status, head) {
    var headers = {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'Vary': 'Host',
      'X-Content-Type-Options': 'nosniff',
    };
    if (head) return new Response(null, { status: status, headers: headers });
    return new Response(JSON.stringify(body), { status: status, headers: headers });
  }

  function handle(request, registry) {
    var url;
    try {
      url = new URL(request.url);
    } catch (error) {
      return Promise.resolve(jsonResponse({ error: 'Invalid request URL' }, 400, request.method === 'HEAD'));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return Promise.resolve(jsonResponse({ error: 'Method not allowed' }, 405, request.method === 'HEAD'));
    }
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return Promise.resolve(jsonResponse({ error: 'HTTPS is required' }, 400, request.method === 'HEAD'));
    }
    if (!root.YouGeDomain || typeof root.YouGeDomain.resolve !== 'function') {
      return Promise.resolve(jsonResponse({ error: 'Domain configuration is unavailable' }, 500, request.method === 'HEAD'));
    }

    var hostname = root.YouGeDomain.normalizeHost(url.hostname);
    var manifestPath = url.pathname;
    var configuredPath = '/';
    var configuredEntry = registry || root.YOU_GE_DOMAIN_REGISTRY || {};
    var context = root.YouGeDomain.resolve({
      hostname: hostname,
      origin: url.origin,
      protocol: url.protocol,
      pathname: manifestPath,
      basePath: configuredPath,
    }, configuredEntry);
    // A manifest served from a directory inherits that deployment's base path
    // unless an explicit registry entry sets pwa.basePath.
    if (!context.domain.configured || !context.pwa.basePath) {
      context.domain.basePath = new URL('./', url).pathname;
    }

    var manifest = root.YouGeDomain.manifest(context);
    try {
      var scope = new URL(manifest.scope, url);
      var start = new URL(manifest.start_url, url);
      var id = new URL(manifest.id, url);
      if (scope.origin !== url.origin || start.origin !== url.origin || id.origin !== url.origin ||
          !start.pathname.startsWith(scope.pathname) ||
          !scope.pathname.startsWith(context.domain.basePath)) {
        return Promise.resolve(jsonResponse({ error: 'Resolved manifest escapes its application scope' }, 500, request.method === 'HEAD'));
      }
    } catch (error) {
      return Promise.resolve(jsonResponse({ error: 'Resolved manifest contains an invalid URL' }, 500, request.method === 'HEAD'));
    }
    return Promise.resolve(jsonResponse(manifest, 200, request.method === 'HEAD'));
  }

  root.YouGeManifestHandler = { handle: handle };
})(typeof globalThis !== 'undefined' ? globalThis : this);
