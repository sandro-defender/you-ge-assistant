/*!
 * progressier.js — You.Ge Assistant PWA service worker
 * -------------------------------------------------
 * Implements: offline caching, share target, push notifications,
 * app badge, notification clicks and push-subscription renewal.
 *
 * Keep this file at /progressier.js when migrating existing apps so
 * previously registered service workers update in place without duplicates.
 *
 * No third-party requests, no build step.
 */
'use strict';

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const VERSION = '1.1.0';
const WORKER_DIRECTORY = new URL('./', self.location.href);
const REGISTRATION_SCOPE = self.registration && self.registration.scope
  ? new URL(self.registration.scope, self.location.href)
  : WORKER_DIRECTORY;
const SCOPE_PATH = REGISTRATION_SCOPE.pathname;
try {
  importScripts(new URL('domain-registry.js', self.location.href).href, new URL('domain-config.js', self.location.href).href);
} catch (error) {
  // Older integrations may not yet have the optional domain configuration files.
}
const DOMAIN_CONFIG = self.YouGeDomain && typeof self.YouGeDomain.resolve === 'function'
  ? self.YouGeDomain.resolve({
      hostname: self.location.hostname,
      origin: self.location.origin,
      protocol: self.location.protocol,
      pathname: SCOPE_PATH,
      basePath: SCOPE_PATH,
    })
  : { features: { offline: true } };
const OFFLINE_ENABLED = !DOMAIN_CONFIG.features || DOMAIN_CONFIG.features.offline !== false;

// Navigation targets in notifications come from push payloads and action data:
// data, never instructions. Restrict them to http(s) and in-scope paths so a
// payload cannot drive `client.navigate()`/`openWindow()` into a script-capable
// scheme (javascript:, data:) or a stripped-control-character look-alike.
function resolveNotificationTarget(raw) {
  if (self.YouGeDomain && typeof self.YouGeDomain.safeNavigationUrl === 'function') {
    return self.YouGeDomain.safeNavigationUrl(raw, self.location.href);
  }
  try {
    const url = new URL(String(raw == null ? '' : raw).trim(), self.location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return REGISTRATION_SCOPE.href;
    return url.href;
  } catch (error) {
    return REGISTRATION_SCOPE.href;
  }
}

const SHARING_ENABLED = !DOMAIN_CONFIG.features || DOMAIN_CONFIG.features.sharing !== false;
const PUSH_ENABLED = !DOMAIN_CONFIG.features || DOMAIN_CONFIG.features.push !== false;
const BADGES_ENABLED = !DOMAIN_CONFIG.features || DOMAIN_CONFIG.features.badges !== false;
const CACHE_NAMESPACE = `you-ge-assistant:${encodeURIComponent(self.location.hostname.toLowerCase())}:${encodeURIComponent(SCOPE_PATH)}:`;
const STATIC_CACHE = `${CACHE_NAMESPACE}static:v${VERSION}`;
const PAGE_CACHE = `${CACHE_NAMESPACE}pages:v${VERSION}`;
const LEGACY_CACHES = ['pwa-static-1.0.4', 'pwa-pages-1.0.4'];

// App-shell assets are resolved against the registered app scope, which may be
// narrower than the worker script directory when explicitly configured.
const SCOPE_URL = REGISTRATION_SCOPE.href;
const OFFLINE_URL = new URL('offline.html', SCOPE_URL).href;
const SHARE_TARGET_PATH = new URL('share-target', SCOPE_URL).pathname;
const HOME_URL = SCOPE_URL;
const SHARE_DB = 'progressiersharedfiles'; // same names the old client uses
const SHARE_STORE = 'progressiersharedfiles';
const NOTIF_DB = 'progressierSavedPushNotifications';
const NOTIF_STORE = 'progressierSavedPushNotifications';
const META_DB = 'pwakit';
const META_STORE = 'meta';
const DEFAULT_ICON = new URL((DOMAIN_CONFIG.branding && DOMAIN_CONFIG.branding.icon) || 'icons/icon-192.png', SCOPE_URL).href;
const WORKER_PATH = new URL(self.location.href).pathname;
const CLIENT_PATH = new URL('pwa.js', SCOPE_URL).pathname;
const MAX_SHARED_FILE_BYTES = 25 * 1024 * 1024;
const NAVIGATION_TIMEOUT_MS = 5000;
const MAX_CACHEABLE_BYTES = 6 * 1024 * 1024;

const STATIC_EXTENSIONS = /\.(?:css|m?js|png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|pdf)$/i;

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const noop = () => {};

function randomId(length = 12) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < length; i += 1) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

function isCacheable(response, request) {
  if (!response || !response.ok || response.status !== 200) return false;
  if (response.type !== 'basic') return false;
  if (request && request.headers.has('authorization')) return false;
  const cacheControl = response.headers.get('cache-control') || '';
  if (/\b(?:no-store|no-cache|private)\b/i.test(cacheControl)) return false;
  // Navigation HTML is cached only when the server explicitly marks it public.
  // This avoids persisting personalized pages by default; APIs are excluded below.
  if (request && request.mode === 'navigate' && !/\bpublic\b/i.test(cacheControl)) return false;
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_CACHEABLE_BYTES) return false;
  return true;
}

function deletedCaches(currentCaches) {
  return caches.keys().then((names) =>
    Promise.all(
      names
        .filter((name) => name.startsWith(CACHE_NAMESPACE) && !currentCaches.includes(name))
        .map((name) => caches.delete(name))
    )
  );
}

// Copy only URLs that belong to this worker's scope from the last known kit
// cache names. Leave legacy caches in place: older versions used shared names,
// so deleting them could erase another app's cache on a shared origin.
async function migrateLegacyCaches() {
  const [staticCache, pageCache] = await Promise.all([
    caches.open(STATIC_CACHE),
    caches.open(PAGE_CACHE),
  ]);
  for (const legacyName of LEGACY_CACHES) {
    if (!(await caches.has(legacyName))) continue;
    const legacy = await caches.open(legacyName).catch(() => null);
    if (!legacy) continue;
    const keys = await legacy.keys();
    for (const request of keys) {
      const url = new URL(request.url);
      if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) continue;
      const response = await legacy.match(request);
      if (!response) continue;
      if (legacyName.indexOf('pages') !== -1) {
        const cacheControl = response.headers.get('cache-control') || '';
        if (request.headers.has('authorization') || !/\bpublic\b/i.test(cacheControl) || /\b(?:private|no-store|no-cache)\b/i.test(cacheControl)) continue;
      }
      try {
        const targetCache = legacyName.indexOf('static') !== -1 ? staticCache : pageCache;
        if (!(await targetCache.match(request))) await targetCache.put(request, response);
      } catch (error) {
        noop();
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * IndexedDB helpers
 * ------------------------------------------------------------------ */

function openDB(name, store) {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(store)) {
        db.createObjectStore(store, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB error'));
  });
}

function idbPut(dbName, storeName, value) {
  return openDB(dbName, storeName).then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => {
          db.close();
          resolve(value);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

function idbGet(dbName, storeName, key) {
  return openDB(dbName, storeName).then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      })
  );
}

function idbDelete(dbName, storeName, key) {
  return openDB(dbName, storeName).then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      })
  );
}

function idbGetAll(dbName, storeName) {
  return openDB(dbName, storeName).then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/* ------------------------------------------------------------------ *
 * Badge counter
 * ------------------------------------------------------------------ */

async function getBadgeCount() {
  try {
    const record = await idbGet(META_DB, META_STORE, 'unread');
    return record && typeof record.count === 'number' ? record.count : 0;
  } catch (error) {
    return 0;
  }
}

async function setBadgeCount(count) {
  if (!BADGES_ENABLED) return;
  const safe = Math.max(0, Math.floor(count) || 0);
  try {
    await idbPut(META_DB, META_STORE, { id: 'unread', count: safe });
  } catch (error) {
    /* badge persistence is best-effort */
  }
  try {
    if (!('setAppBadge' in navigator)) return;
    if (safe > 0) await navigator.setAppBadge(safe);
    else await navigator.clearAppBadge();
  } catch (error) {
    /* unsupported platform */
  }
}

async function incrementBadge() {
  await setBadgeCount((await getBadgeCount()) + 1);
}

async function decrementBadge() {
  const count = await getBadgeCount();
  if (count > 0) await setBadgeCount(count - 1);
}

/* ------------------------------------------------------------------ *
 * Config (stored by the page via postMessage)
 * ------------------------------------------------------------------ */

async function getConfig() {
  try {
    const record = await idbGet(META_DB, META_STORE, 'config');
    return (record && record.value) || {};
  } catch (error) {
    return {};
  }
}

function base64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (OFFLINE_ENABLED) {
        const cache = await caches.open(STATIC_CACHE);
        const precache = [
          OFFLINE_URL,
          new URL('offline.js', SCOPE_URL).href,
          new URL('offline.css', SCOPE_URL).href,
          new URL('domain-config.js', SCOPE_URL).href,
          new URL('domain-registry.js', SCOPE_URL).href,
          new URL('dns-diagnostics.js', SCOPE_URL).href,
          new URL('assistant-state.js', SCOPE_URL).href,
          new URL('assistant-widget.js', SCOPE_URL).href,
          new URL('assistant-widget.css', SCOPE_URL).href,
          new URL('pwa.css', SCOPE_URL).href,
          new URL('qrcode.js', SCOPE_URL).href,
          DEFAULT_ICON,
          new URL('icons/icon-512.png', SCOPE_URL).href,
        ];
        await Promise.allSettled(
          precache.map((url) => cache.add(new Request(url, { cache: 'reload' })))
        );
      }
      // Do NOT skipWaiting here. Updates wait until the page asks for them,
      // which prevents mixing old HTML with new JS.
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (OFFLINE_ENABLED) await migrateLegacyCaches();
      await deletedCaches([STATIC_CACHE, PAGE_CACHE]);
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch (error) {
          noop();
        }
      }
      await self.clients.claim();
    })()
  );
});

/* ------------------------------------------------------------------ *
 * Fetch strategies
 * ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Share target POST — always handled, never cached.
  if (SHARING_ENABLED && request.method === 'POST' && url.origin === self.location.origin && url.pathname === SHARE_TARGET_PATH) {
    event.respondWith(handleShareTarget(request));
    return;
  }

  if (!OFFLINE_ENABLED) return;
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;
  if (request.headers.has('range')) return;
  if (url.pathname.indexOf('/api/') !== -1) return;
  if (url.pathname === WORKER_PATH || url.pathname === CLIENT_PATH) return;
  if (url.pathname === new URL('sw.js', SCOPE_URL).pathname) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function scopeOfflineResponse(response) {
  const source = await response.text();
  const safeBase = SCOPE_PATH.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '%3C');
  const html = source.replace(/<head(\b[^>]*)>/i, (opening) => `${opening}<base href="${safeBase}">`);
  const headers = new Headers(response.headers);
  ['content-length', 'content-encoding', 'content-md5', 'etag', 'last-modified'].forEach((name) => headers.delete(name));
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  try {
    const response = await Promise.race([
      controller ? fetch(request, { signal: controller.signal }) : fetch(request),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          if (controller) controller.abort();
          reject(new Error('timeout'));
        }, NAVIGATION_TIMEOUT_MS);
      }),
    ]);
    if (isCacheable(response, request)) {
      cache.put(request, response.clone()).catch(noop);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    const staticCache = await caches.open(STATIC_CACHE);
    const offline = (await staticCache.match(OFFLINE_URL)) || (await caches.match(OFFLINE_URL));
    if (offline) return scopeOfflineResponse(offline);

    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<p>You are offline. Reconnect and try again.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response, request)) {
        cache.put(request, response.clone()).catch(noop);
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    network.catch(noop);
    return cached;
  }

  const response = await network;
  if (response) return response;

  return new Response('', { status: 504, statusText: 'Offline' });
}

/* ------------------------------------------------------------------ *
 * Web Share Target
 * ------------------------------------------------------------------ */

function readFormString(form, key) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

async function handleShareTarget(request) {
  const fallback = new URL('?launchedfrom=share', HOME_URL);
  try {
    const form = await request.formData();
    const id = randomId();
    const record = {
      id,
      url: readFormString(form, 'url'),
      title: readFormString(form, 'title'),
      text: readFormString(form, 'text'),
      createdAt: Date.now(),
    };

    const file = form.get('file');
    if (file && typeof file !== 'string' && file.size > 0 && file.size <= MAX_SHARED_FILE_BYTES) {
      record.buffer = await file.arrayBuffer();
      record.type = file.type || 'application/octet-stream';
      record.filename = file.name || 'shared-file';
    }

    await idbPut(SHARE_DB, SHARE_STORE, record);

    fallback.searchParams.set('fileid', id);
    if (record.url) {
      fallback.searchParams.set('url', record.url);
      fallback.searchParams.set('sharedurl', record.url);
    }
    if (record.title) {
      fallback.searchParams.set('title', record.title);
      fallback.searchParams.set('sharedtitle', record.title);
    }
    if (record.text) {
      fallback.searchParams.set('text', record.text);
      fallback.searchParams.set('sharedtext', record.text);
    }
    return Response.redirect(fallback.href, 303);
  } catch (error) {
    return Response.redirect(fallback.href, 303);
  }
}

/* ------------------------------------------------------------------ *
 * Push notifications
 * ------------------------------------------------------------------ */

function normalizePushPayload(event) {
  if (!event.data) return { title: 'New notification', body: '' };
  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    return { title: 'New notification', body: event.data.text() };
  }

  // Declarative Web Push wraps everything in a "notification" object.
  if (payload && payload.notification) {
    const notification = payload.notification;
    return {
      title: notification.title || 'New notification',
      body: notification.body || '',
      icon: notification.icon,
      url: notification.navigate || notification.url,
      tag: notification.tag,
      actions: notification.actions,
      requireInteraction: notification.requireInteraction,
      silent: notification.silent,
      data: notification.data || payload.data || {},
      timestamp: notification.timestamp,
      unread: payload.unread != null ? payload.unread : notification.data && notification.data.unread,
    };
  }

  return {
    title: payload.title || 'New notification',
    body: payload.body || '',
    icon: payload.icon,
    url: payload.url || payload.navigate,
    tag: payload.tag,
    actions: payload.actions,
    requireInteraction: payload.requireInteraction,
    silent: payload.silent,
    data: payload.data || {},
    timestamp: payload.timestamp,
    unread: payload.unread != null ? payload.unread : payload.data && payload.data.unread,
  };
}

function unreadCount(value) {
  if (value == null) return null;
  const number = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isNaN(number) ? null : Math.max(0, number);
}

async function storeNotification(payload, data, id) {
  try {
    await idbPut(NOTIF_DB, NOTIF_STORE, {
      id,
      title: payload.title,
      body: payload.body || '',
      icon: payload.icon || DEFAULT_ICON,
      url: data.url || '/',
      tag: payload.tag || '',
      timestamp: payload.timestamp || Date.now(),
      read: false,
      wasClicked: null,
    });
  } catch (error) {
    /* history is best-effort */
  }
}

async function markNotificationClicked(id) {
  if (!id) return;
  try {
    const record = await idbGet(NOTIF_DB, NOTIF_STORE, id);
    if (!record) return;
    record.wasClicked = new Date().toISOString();
    record.read = true;
    await idbPut(NOTIF_DB, NOTIF_STORE, record);
  } catch (error) {
    /* ignore */
  }
}

self.addEventListener('push', (event) => {
  if (!PUSH_ENABLED) return;
  event.waitUntil(
    (async () => {
      const payload = normalizePushPayload(event);
      const rawData = payload.data && typeof payload.data === 'object' ? payload.data : {};
      const notificationId = randomId(10);
      const data = Object.assign({}, rawData, {
        url: payload.url || rawData.url || '/',
        notificationId,
        actions: Array.isArray(payload.actions) ? payload.actions : rawData.actions,
      });

      const options = {
        body: payload.body,
        icon: payload.icon || DEFAULT_ICON,
        data,
        tag: payload.tag,
        renotify: Boolean(payload.tag),
        requireInteraction: Boolean(payload.requireInteraction),
        silent: Boolean(payload.silent),
        timestamp: payload.timestamp || Date.now(),
      };

      if (Array.isArray(payload.actions)) {
        options.actions = payload.actions.slice(0, 2).map((action) => ({
          action: String(action.action || ''),
          title: String(action.title || ''),
          icon: action.icon,
        }));
      }

      await self.registration.showNotification(payload.title, options);
      await storeNotification(payload, data, notificationId);

      const explicitUnread = unreadCount(payload.unread);
      if (explicitUnread != null) {
        await setBadgeCount(explicitUnread);
      } else {
        const open = await self.registration.getNotifications();
        await setBadgeCount(open.length);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let target = data.url || '/';
  if (event.action && Array.isArray(data.actions)) {
    const action = data.actions.find((entry) => entry && entry.action === event.action);
    if (action && action.url) target = action.url;
  }
  let targetUrl;
  try {
    targetUrl = new URL(resolveNotificationTarget(target), self.location.origin);
  } catch (error) {
    targetUrl = new URL(REGISTRATION_SCOPE);
  }
  if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
    targetUrl = new URL(REGISTRATION_SCOPE);
  }
  targetUrl.hash = data.hash || targetUrl.hash;

  event.waitUntil(
    (async () => {
      await markNotificationClicked(data.notificationId);

      const remaining = await self.registration.getNotifications();
      await setBadgeCount(remaining.length);

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        try {
          if (new URL(client.url).origin !== targetUrl.origin) continue;
          await client.focus();
          if ('navigate' in client) await client.navigate(targetUrl.href);
          return;
        } catch (error) {
          noop();
        }
      }

      if (self.clients.openWindow) await self.clients.openWindow(targetUrl.href);
    })()
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  if (!PUSH_ENABLED) return;
  event.waitUntil(
    (async () => {
      try {
        const config = await getConfig();
        if (!config.applicationServerKey) return;

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(config.applicationServerKey),
        });

        if (config.pushEndpoint) {
          await fetch(config.pushEndpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
          });
        }
      } catch (error) {
        noop();
      }
    })()
  );
});

/* ------------------------------------------------------------------ *
 * Messages from the page
 * ------------------------------------------------------------------ */

self.addEventListener('message', (event) => {
  const message = event.data || {};
  const respond = (payload) => {
    if (event.ports && event.ports[0]) event.ports[0].postMessage(payload);
  };

  switch (message.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'SET_BADGE':
      event.waitUntil(setBadgeCount(message.count).then(() => respond({ ok: true })));
      break;

    case 'CLEAR_BADGE':
      event.waitUntil(setBadgeCount(0).then(() => respond({ ok: true })));
      break;

    case 'GET_BADGE':
      event.waitUntil(getBadgeCount().then((count) => respond({ count })));
      break;

    case 'PWA_CONFIG':
      event.waitUntil(
        idbPut(META_DB, META_STORE, {
          id: 'config',
          value: message.config || {},
        }).then(() => respond({ ok: true }))
      );
      break;

    case 'GET_NOTIFICATIONS':
      event.waitUntil(
        idbGetAll(NOTIF_DB, NOTIF_STORE)
          .then((notifications) => {
            notifications.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
            respond({ notifications });
          })
          .catch(() => respond({ notifications: [] }))
      );
      break;

    case 'MARK_NOTIFICATIONS_READ':
      event.waitUntil(
        idbGetAll(NOTIF_DB, NOTIF_STORE)
          .then((notifications) =>
            Promise.all(
              notifications.map((notification) =>
                idbPut(NOTIF_DB, NOTIF_STORE, Object.assign({}, notification, { read: true }))
              )
            )
          )
          .then(() => respond({ ok: true }))
          .catch(() => respond({ ok: false }))
      );
      break;

    case 'CLEAR_CACHES': {
      const includeStatic = Boolean(message.includeStatic);
      event.waitUntil(
        caches
          .keys()
          .then((names) =>
            Promise.all(
              names
                .filter((name) => name.startsWith(CACHE_NAMESPACE))
                .filter((name) => includeStatic || !name.includes(':static:'))
                .map((name) => caches.delete(name))
            )
          )
          .then(() => respond({ ok: true }))
      );
      break;
    }

    default:
      break;
  }
});
