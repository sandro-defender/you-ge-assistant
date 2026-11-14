#!/usr/bin/env node
/**
 * Verify a deployed copy of You.Ge Assistant.
 *
 *   node scripts/verify-deployment.mjs https://your-domain.example
 *   node scripts/verify-deployment.mjs http://localhost:3000
 *
 * Exits with code 1 when a hard requirement is missing.
 */

const target = process.argv[2];

if (!target) {
  console.error('Usage: node scripts/verify-deployment.mjs <deployed-url>');
  console.error('Example: node scripts/verify-deployment.mjs https://your-domain.example');
  process.exit(2);
}

const base = target.replace(/\/+$/, '');
const failures = [];
const warnings = [];
const notes = [];

function pass(message) {
  console.log('  \x1b[32mPASS\x1b[0m ' + message);
}
function warn(message) {
  warnings.push(message);
  console.log('  \x1b[33mWARN\x1b[0m ' + message);
}
function fail(message) {
  failures.push(message);
  console.log('  \x1b[31mFAIL\x1b[0m ' + message);
}
function info(message) {
  notes.push(message);
  console.log('  \x1b[36mINFO\x1b[0m ' + message);
}
function section(title) {
  console.log('\n' + title);
}

async function request(path, options) {
  return fetch(base + path, {
    redirect: 'follow',
    cache: 'no-store',
    ...options,
  });
}

function contentType(response) {
  return (response.headers.get('content-type') || '').toLowerCase();
}

function pngSize(buffer) {
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function checkPage(path) {
  const response = await request(path);
  if (response.status !== 200) {
    fail(path + ' returned HTTP ' + response.status);
    return '';
  }
  pass(path + ' is reachable');
  return response.text();
}

async function checkAsset(path, expectedType, label) {
  try {
    const response = await request(path);
    if (response.status !== 200) {
      fail(label + ' (' + path + ') returned HTTP ' + response.status);
      return null;
    }
    const type = contentType(response);
    if (expectedType && !type.includes(expectedType)) {
      warn(label + ' content-type is "' + type + '" (expected ' + expectedType + ')');
    } else {
      pass(label + ' is served correctly (' + (type || 'no content-type') + ')');
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    fail(label + ' could not be fetched: ' + error.message);
    return null;
  }
}

async function main() {
  console.log('Checking ' + base);

  section('HTML entry point');
  const html = await checkPage('/');
  if (html) {
    if (/progressier\.app/i.test(html)) {
      fail('HTML still loads the legacy hosted client from progressier.app; remove those tags');
    } else {
      pass('no legacy hosted-client (progressier.app) tags in HTML');
    }
    if (/\/pwa\.js/.test(html)) pass('/pwa.js is referenced');
    else fail('/pwa.js is not referenced in the HTML');

    if (/rel=["']manifest["'][^>]*\/manifest\.webmanifest/i.test(html)) {
      pass('local manifest is linked');
    } else if (/rel=["']manifest["']/i.test(html)) {
      warn('a manifest is linked but not /manifest.webmanifest');
    } else {
      warn('no <link rel="manifest"> in the HTML (pwa.js injects one, but explicit is better)');
    }

    if (/\/progressier\.js/.test(html) && /<script[^>]+progressier\.js/i.test(html)) {
      warn('HTML loads /progressier.js as a page script; it should only be the service worker');
    }
    if (/theme-color/i.test(html)) pass('theme-color meta is present');
  }

  section('Manifest');
  let manifest = null;
  try {
    const response = await request('/manifest.webmanifest');
    if (response.status !== 200) {
      fail('manifest returned HTTP ' + response.status);
    } else {
      const type = contentType(response);
      if (!type.includes('manifest+json') && !type.includes('application/json')) {
        warn('manifest content-type is "' + type + '"; use application/manifest+json');
      } else {
        pass('manifest content-type is ' + type);
      }
      const text = await response.text();
      try {
        manifest = JSON.parse(text);
        pass('manifest is valid JSON');
      } catch (error) {
        fail('manifest is not valid JSON: ' + error.message);
      }
    }
  } catch (error) {
    fail('manifest could not be fetched: ' + error.message);
  }

  if (manifest) {
    const required = ['name', 'short_name', 'start_url', 'display', 'icons'];
    required.forEach((key) => {
      if (manifest[key] == null || (Array.isArray(manifest[key]) && !manifest[key].length)) {
        fail('manifest is missing "' + key + '"');
      }
    });
    if (!manifest.id) warn('manifest has no "id" (existing installs may get a new identity)');
    else info('manifest id: ' + manifest.id);
    info('start_url: ' + manifest.start_url);
    info('scope: ' + (manifest.scope || '(default: manifest directory)'));

    const origin = new URL(base).origin;
    try {
      const start = new URL(manifest.start_url, base);
      if (start.origin !== origin) warn('start_url is on a different origin: ' + start.href);
    } catch (error) {
      fail('start_url is not a valid URL');
    }

    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    if (!icons.some((icon) => String(icon.sizes || '').includes('192'))) {
      warn('manifest has no 192x192 icon');
    }
    if (!icons.some((icon) => String(icon.sizes || '').includes('512'))) {
      fail('manifest has no 512x512 icon (required for installability)');
    }
    if (!icons.some((icon) => String(icon.purpose || '').includes('maskable'))) {
      warn('manifest has no maskable icon');
    }

    section('Manifest icons');
    for (const icon of icons) {
      if (!icon.src) {
        fail('manifest icon without "src"');
        continue;
      }
      const url = new URL(icon.src, base);
      const isLocal = url.origin === origin;
      const path = isLocal ? url.pathname : url.href;
      try {
        const response = await request(path);
        if (response.status !== 200) {
          fail('icon ' + icon.src + ' returned HTTP ' + response.status);
          continue;
        }
        const type = contentType(response);
        if (!type.startsWith('image/')) {
          warn('icon ' + icon.src + ' has content-type "' + type + '"');
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const size = pngSize(buffer);
        if (!size) {
          warn('icon ' + icon.src + ' is not a PNG (cannot verify dimensions)');
        } else {
          const declared = String(icon.sizes || '');
          const expected = declared.match(/(\d+)x(\d+)/);
          if (expected && (Number(expected[1]) !== size.width || Number(expected[2]) !== size.height)) {
            fail(
              'icon ' + icon.src + ' is ' + size.width + 'x' + size.height + ' but declares ' + declared
            );
          } else {
            pass('icon ' + icon.src + ' is ' + size.width + 'x' + size.height);
          }
        }
      } catch (error) {
        fail('icon ' + icon.src + ' could not be fetched: ' + error.message);
      }
    }

    if (manifest.share_target) {
      warn(
        'share_target is configured; make sure /' +
          String(manifest.share_target.action || '').replace(/^\/+/, '') +
          ' works before the service worker controls the page'
      );
    }
    if (Array.isArray(manifest.protocol_handlers) && manifest.protocol_handlers.length) {
      info('protocol handlers: ' + manifest.protocol_handlers.map((item) => item.protocol).join(', '));
    }
  }

  section('Service worker');
  const sw = await checkAsset('/progressier.js', 'javascript', 'service worker');
  if (sw) {
    const source = sw.toString('utf8');
    if (source.includes('pwa-static-') || source.includes('__pwaKit')) {
      pass('service worker is the You.Ge Assistant worker (not a legacy hosted worker)');
    } else {
      fail('service worker does not look like the You.Ge Assistant worker');
    }
    try {
      const response = await request('/progressier.js');
      const allowed = response.headers.get('service-worker-allowed') || '';
      if (allowed.includes('/')) pass('Service-Worker-Allowed header is set');
      else warn('Service-Worker-Allowed header is missing (needed if the worker is not at the root)');

      const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
      if (!cacheControl || /max-age=0|no-cache|no-store/.test(cacheControl)) {
        pass('service worker is not cached long-term');
      } else {
        warn('service worker cache-control is "' + cacheControl + '"; use no-cache');
      }
    } catch (error) {
      /* already reported */
    }
  }

  section('Client assets');
  await checkAsset('/pwa.js', 'javascript', 'client script');
  await checkAsset('/pwa.css', 'text/css', 'component stylesheet');
  await checkAsset('/offline.html', 'text/html', 'offline page');
  await checkAsset('/offline.css', 'text/css', 'offline stylesheet');
  await checkAsset('/offline.js', 'javascript', 'offline script');
  await checkAsset('/favicon.ico', 'image', 'favicon');
  await checkAsset('/browserconfig.xml', 'xml', 'Windows tile config');
  await checkAsset('/icons/icon-144.png', 'image/png', 'Windows tile icon');
  await checkAsset('/icons/apple-touch-icon.png', 'image/png', 'Apple touch icon');

  section('Result');
  if (failures.length) {
    console.log('\x1b[31m' + failures.length + ' failure(s)\x1b[0m');
    failures.forEach((message) => console.log('  - ' + message));
  }
  if (warnings.length) {
    console.log('\x1b[33m' + warnings.length + ' warning(s)\x1b[0m');
    warnings.forEach((message) => console.log('  - ' + message));
  }
  if (!failures.length) {
    console.log('\x1b[32mDeployment looks good.\x1b[0m');
  }
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error('\nVerifier crashed: ' + error.stack);
  process.exitCode = 1;
});
