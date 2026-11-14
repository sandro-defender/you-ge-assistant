#!/usr/bin/env node
/**
 * Static checks for the kit. No dependencies, no network, no build.
 *
 *   node scripts/check.mjs
 *   npm run check
 *
 * Verifies:
 *   - JavaScript syntax of runtime and reference scripts
 *   - original and readable reference bundles are present
 *   - manifest is valid JSON with the required fields
 *   - every manifest icon exists and its real PNG size matches the declaration
 *   - offline / precache assets referenced by the worker exist
 *   - kit version is synchronized (worker VERSION, PWA.version, package.json)
 *   - precached assets did not change since the merge base without a
 *     synchronized kit-version bump (scripts/precache-integrity.mjs)
 *   - no leftover legacy hosted-script URLs in deployable files
 *
 * Exits 1 on failure.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPrecacheIntegrity } from './precache-integrity.mjs';
import { buildBrowserStateScript } from './sync-sdk-browser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const warnings = [];

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;

function pass(message) {
  console.log(`  ${green('PASS')} ${message}`);
}
function warn(message) {
  warnings.push(message);
  console.log(`  ${yellow('WARN')} ${message}`);
}
function fail(message) {
  failures.push(message);
  console.log(`  ${red('FAIL')} ${message}`);
}
function section(title) {
  console.log(`\n${title}`);
}

const at = (relative) => join(root, relative);

/* ------------------------------------------------------------------ *
 * 1. Files that must exist
 * ------------------------------------------------------------------ */

const requiredFiles = [
  'pwa.js',
  'pwa.css',
  'progressier.js',
  'domain-config.js',
  'domain-registry.js',
  'dns-diagnostics.js',
  'assistant-state.js',
  'assistant-widget.js',
  'assistant-widget.css',
  'manifest-handler.js',
  'manifest.webmanifest',
  'qrcode.js',
  'offline.html',
  'offline.css',
  'offline.js',
  'favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
];

section('Required files');
for (const file of requiredFiles) {
  if (existsSync(at(file))) pass(file);
  else fail(`${file} is missing`);
}

/* ------------------------------------------------------------------ *
 * 2. JavaScript syntax
 * ------------------------------------------------------------------ */

section('JavaScript syntax');
for (const file of [
  'pwa.js',
  'progressier.js',
  'offline.js',
  'domain-config.js',
  'domain-registry.js',
  'dns-diagnostics.js',
  'manifest-handler.js',
  'qrcode.js',
  'example/example.js',
  'reference/Script.js',
  'reference/Script.decompiled.js',
]) {
  if (!existsSync(at(file))) continue;
  try {
    execFileSync(process.execPath, ['--check', at(file)], { stdio: 'pipe' });
    pass(`${file} parses`);
  } catch (error) {
    const detail = String(error.stderr || error.message).split('\n').slice(0, 3).join(' ');
    fail(`${file} has a syntax error: ${detail}`);
  }
}

/* ------------------------------------------------------------------ *
 * 3. Reference artifacts (kept out of deployment)
 * ------------------------------------------------------------------ */

section('Reference artifacts');
for (const file of ['reference/Script.js', 'reference/Script.decompiled.js']) {
  if (existsSync(at(file))) pass(`${file} is preserved`);
  else fail(`${file} is missing`);
}

/* ------------------------------------------------------------------ *
 * 4. Manifest
 * ------------------------------------------------------------------ */

section('Manifest');

let manifest = null;
try {
  manifest = JSON.parse(readFileSync(at('manifest.webmanifest'), 'utf8'));
  pass('manifest.webmanifest is valid JSON');
} catch (error) {
  fail(`manifest.webmanifest does not parse: ${error.message}`);
}

function pngSize(file) {
  const buffer = readFileSync(file);
  if (buffer.length < 24 || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

if (manifest) {
  const requiredKeys = ['name', 'short_name', 'start_url', 'scope', 'display', 'icons'];
  for (const key of requiredKeys) {
    if (manifest[key]) pass(`manifest.${key} is set`);
    else fail(`manifest.${key} is missing`);
  }

  if (manifest.display !== 'standalone' && manifest.display !== 'fullscreen' && manifest.display !== 'minimal-ui') {
    warn(`manifest.display is "${manifest.display}"; installability expects standalone, fullscreen or minimal-ui`);
  }

  if (manifest.name !== 'You.Ge Assistant' || manifest.short_name !== 'You.Ge') {
    fail('static fallback manifest must use the You.Ge Assistant identity');
  } else {
    pass('static fallback manifest uses the You.Ge Assistant identity');
  }

  if (typeof manifest.id !== 'string' || !manifest.id) {
    warn('manifest.id is not set; browsers will derive one from start_url');
  }

  const start = manifest.start_url || '';
  const scope = manifest.scope || '/';
  if (start.startsWith('/') && !start.startsWith(scope) && scope !== '/') {
    fail(`start_url "${start}" is outside scope "${scope}"`);
  } else if (start) {
    pass('start_url is inside scope');
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    fail('manifest.icons is empty');
  } else {
    for (const icon of manifest.icons) {
      const src = String(icon.src || '');
      if (!src) {
        fail('an icon entry has no src');
        continue;
      }
      if (/^https?:/i.test(src)) {
        warn(`icon ${src} is remote; serve it from your own origin`);
        continue;
      }
      const file = at(src.replace(/^\//, ''));
      if (!existsSync(file)) {
        fail(`icon file ${src} does not exist`);
        continue;
      }
      const declared = String(icon.sizes || '').toLowerCase().split(/\s+/)[0];
      const match = /^(\d+)x(\d+)$/.exec(declared);
      const actual = pngSize(file);
      if (!actual) {
        fail(`${src} is not a readable PNG`);
      } else if (match && (Number(match[1]) !== actual.width || Number(match[2]) !== actual.height)) {
        fail(`${src} is ${actual.width}x${actual.height} but declares ${declared}`);
      } else {
        pass(`${src} is ${actual.width}x${actual.height}`);
      }
    }
  }

  const purposes = (manifest.icons || []).map((icon) => String(icon.purpose || 'any'));
  if (!purposes.some((purpose) => purpose.includes('maskable'))) {
    warn('no maskable icon; Android will letterbox the regular icon');
  } else {
    pass('a maskable icon is declared');
  }

  if (manifest.share_target && manifest.share_target.action !== '/share-target') {
    fail(`share_target.action is "${manifest.share_target.action}"; the worker handles /share-target`);
  }

  const handlers = manifest.protocol_handlers || [];
  for (const handler of handlers) {
    const url = String(handler.url || '');
    if (url && !url.includes('%s')) {
      fail(`protocol handler "${handler.protocol}" url has no %s placeholder`);
    }
  }
  if (handlers.length) pass(`${handlers.length} protocol handler(s) declared`);
}

/* ------------------------------------------------------------------ *
 * 5. Service worker assets and version
 * ------------------------------------------------------------------ */

section('Service worker');

const worker = existsSync(at('progressier.js')) ? readFileSync(at('progressier.js'), 'utf8') : '';
const client = existsSync(at('pwa.js')) ? readFileSync(at('pwa.js'), 'utf8') : '';
const styles = existsSync(at('pwa.css')) ? readFileSync(at('pwa.css'), 'utf8') : '';
const originalReference = existsSync(at('reference/Script.decompiled.js'))
  ? readFileSync(at('reference/Script.decompiled.js'), 'utf8')
  : '';

const workerVersion = /const VERSION = '([^']+)'/.exec(worker);
const clientVersion = /version:\s*'([^']+)'/.exec(client);
if (!workerVersion) {
  fail('progressier.js has no VERSION constant');
} else if (!clientVersion) {
  fail('pwa.js has no version field');
} else if (workerVersion[1] !== clientVersion[1]) {
  fail(`version mismatch: worker ${workerVersion[1]} vs client ${clientVersion[1]}`);
} else {
  pass(`version is ${workerVersion[1]} in both files`);
}

section('Domain and diagnostics architecture');
const domainSource = readFileSync(at('domain-config.js'), 'utf8');
const dnsSource = readFileSync(at('dns-diagnostics.js'), 'utf8');
const manifestHandlerSource = readFileSync(at('manifest-handler.js'), 'utf8');
if (domainSource.includes('window.location.hostname') || domainSource.includes('location.hostname')) {
  pass('domain resolver accepts runtime location data without component-specific hostname reads');
} else {
  pass('central domain resolver is present');
}
if (/staff\.you\.ge/i.test(dnsSource)) fail('DNS engine contains a hardcoded staff.you.ge target');
else pass('DNS engine has no hardcoded legacy hostname');
if (dnsSource.includes('cloudflare-dns.com/dns-query') && dnsSource.includes('application/dns-json') && dnsSource.includes('AbortController')) {
  pass('DoH endpoint, JSON API and AbortController timeout support are present');
} else {
  fail('DNS engine is missing required DoH/timeout configuration');
}
if (manifestHandlerSource.includes('private, no-store') && manifestHandlerSource.includes('Vary')) {
  pass('dynamic manifest responses disable shared caching and vary by host');
} else {
  fail('dynamic manifest response does not prevent cross-host cache reuse');
}
if (worker.includes('CACHE_NAMESPACE') && worker.includes('self.location.hostname') && worker.includes('SCOPE_PATH')) {
  pass('service-worker cache names include host and scope');
} else {
  fail('service-worker cache namespace is not domain/scope aware');
}
if (worker.includes('request.mode === \'navigate\'') && worker.includes('cache-control')) {
  pass('worker restricts caching to same-origin scoped requests and explicit public navigations');
} else {
  warn('review navigation caching privacy policy');
}
if (worker.includes('SHARING_ENABLED') && worker.includes('PUSH_ENABLED') && worker.includes('BADGES_ENABLED') && client.includes("config.features.qr === false")) {
  pass('per-domain sharing, push, badge and QR feature gates are present');
} else {
  fail('per-domain sharing, push, badge or QR feature gates are incomplete');
}
if (client.includes('showNetworkDiagnostics') && client.includes('runNetworkDiagnostics')) {
  pass('PWA client exposes diagnostics UI and API');
} else {
  fail('PWA client does not expose diagnostics UI and API');
}

const toolboxContract = [
  "toolbox: 'toolbox' in dataset",
  'function enableToolbox(options)',
  'function toolboxIsDesktop()',
  'new URLSearchParams(target.search)',
  'enableToolbox: enableToolbox',
  'showToolbox: showToolbox',
  'hideToolbox: hideToolbox',
  'disableToolbox: disableToolbox',
  'showInstallRequest: showInstallRequest',
];
if (toolboxContract.every((token) => client.includes(token))) {
  pass('floating toolbox configuration, visibility matching, API and install flow are present');
} else {
  fail('floating toolbox configuration, visibility matching, API or install flow is incomplete');
}

const toolboxStyles = [
  'z-index: 2147483643',
  'bottom: 17px',
  'width: 65px',
  'height: 65px',
  'border-radius: 50%',
  'scale(1.08)',
  'left: 20px',
  'right: 20px',
  'calc(50% - 32px)',
  'top: 17px',
  'width: 52px',
  'height: 52px',
];
const originalToolboxStyleMarkers = [
  'z-index: 2147483643;',
  'bottom: 17px',
  'width: 65px',
  'height: 65px',
  'border-radius: 50%',
  'transform:scale(1.08) !important',
  'left:20px',
  'right:20px',
  'calc(50% - 32px)',
  'top:17px',
  'width:52px;height:52px',
];
if (toolboxStyles.every((token) => styles.includes(token)) &&
    originalToolboxStyleMarkers.every((token) => originalReference.includes(token))) {
  pass('floating toolbox sizing, placement and hover styles match the original');
} else {
  fail('floating toolbox styles differ from the original sizing or placement');
}

section('Precache integrity');

// The precache list is read from the worker's own install handler, and the
// diff-aware gate compares it with the merge base (PRECACHE_INTEGRITY_BASE in
// CI, the default branch locally). See PRECACHE_INTEGRITY.md.
const precacheIntegrity = await runPrecacheIntegrity({
  root,
  baseRef: process.env.PRECACHE_INTEGRITY_BASE || '',
});
for (const name of precacheIntegrity.precache) {
  if (existsSync(at(name))) pass(`precache ${name} exists`);
  else fail(`precache ${name} is referenced but missing`);
}
if (precacheIntegrity.status === 'fail') {
  fail(precacheIntegrity.summary);
  console.log(precacheIntegrity.report.split('\n').map((line) => `       ${line}`).join('\n'));
} else if (precacheIntegrity.status === 'skipped') {
  warn(precacheIntegrity.summary);
} else {
  pass(precacheIntegrity.summary);
}

for (const name of ['share-target', 'offline.html', 'qrcode.js']) {
  if (!worker.includes(name)) warn(`progressier.js does not mention ${name}`);
}

/* ------------------------------------------------------------------ *
 * 6. No legacy hosted-script leftovers in deployable files
 *
 * `progressier.app` / `progressier.com` are the hosts of the hosted client
 * that You.Ge Assistant replaced. Deployable files must never load from them;
 * pwa.js names them only to scrub such tags from migrated pages.
 * ------------------------------------------------------------------ */

section('Legacy hosted-script leftovers');

const deployable = [
  'manifest.webmanifest',
  'offline.html',
  'offline.js',
  'offline.css',
  'pwa.css',
  'browserconfig.xml',
];
let leftovers = 0;
for (const file of deployable) {
  if (!existsSync(at(file))) continue;
  const text = readFileSync(at(file), 'utf8');
  const hits = text.match(/progressier\.(app|com)/g) || [];
  if (hits.length) {
    leftovers += hits.length;
    fail(`${file} still references ${hits[0]} (${hits.length} occurrence(s))`);
  }
}
if (!leftovers) pass('no legacy hosted-script URLs in deployable files');

// pwa.js is allowed to mention progressier.app because it rewrites leftover
// manifest links; anything more than that is suspicious.
const clientHits = (client.match(/progressier\.app/g) || []).length;
if (clientHits > 3) {
  warn(`pwa.js mentions progressier.app ${clientHits} times; check that these are only migration checks`);
} else if (clientHits) {
  pass('pwa.js only mentions progressier.app for migration checks');
}

/* ------------------------------------------------------------------ *
 * 7. GitHub Pages playground and user-facing example
 * ------------------------------------------------------------------ */

section('GitHub Pages examples');

const pagesRoot = new URL('https://pages.invalid/repo/');
const pagesBasePath = pagesRoot.pathname;
const examplePages = [
  {
    label: 'feature-test playground',
    html: 'demo/index.html',
    manifest: 'demo/manifest.webmanifest',
    publishedHtml: 'index.html',
    publishedManifest: 'manifest.webmanifest',
  },
  {
    label: 'user-facing example',
    html: 'example/index.html',
    manifest: 'example/manifest.webmanifest',
    publishedHtml: 'example/index.html',
    publishedManifest: 'example/manifest.webmanifest',
    viteBase: './',
  },
];
const seenExampleIds = new Map();
const exampleViteConfig = existsSync(at('example/vite.config.js'))
  ? readFileSync(at('example/vite.config.js'), 'utf8')
  : '';
const exampleManifest = at('example/manifest.webmanifest');
const publicExampleManifest = at('example/public/manifest.webmanifest');
if (existsSync(exampleManifest) && existsSync(publicExampleManifest)
  && readFileSync(exampleManifest, 'utf8') === readFileSync(publicExampleManifest, 'utf8')) {
  pass('example public manifest matches its route-local manifest');
} else {
  fail('example public manifest must match example/manifest.webmanifest');
}
if (/base:\s*['"]\.\/['"]/.test(exampleViteConfig)) {
  pass('user-facing example Vite build uses a project-path-safe relative base');
} else {
  fail('user-facing example Vite build must use base ./ for GitHub Pages subpaths');
}

const sharedRuntimeFiles = new Set([
  'pwa.js',
  'pwa.css',
  'progressier.js',
  'qrcode.js',
  'assistant-state.js',
  'assistant-widget.js',
  'assistant-widget.css',
  'offline.html',
  'offline.css',
  'offline.js',
  'browserconfig.xml',
  'favicon.ico',
]);

function pagesFile(url, label) {
  if (url.origin !== pagesRoot.origin || !url.pathname.startsWith(pagesBasePath)) {
    fail(`${label} points outside the GitHub Pages project path: ${url.href}`);
    return null;
  }

  const deployedPath = decodeURIComponent(url.pathname.slice(pagesBasePath.length));
  if (deployedPath.startsWith('example/')) {
    const exampleAsset = deployedPath.slice('example/'.length);
    if (sharedRuntimeFiles.has(exampleAsset) || exampleAsset.startsWith('icons/')) {
      return at(exampleAsset);
    }
  }
  return at(deployedPath);
}

function tagAttribute(tag, name) {
  const match = new RegExp(name + '="([^"]+)"', 'i').exec(tag);
  return match ? match[1] : '';
}

for (const page of examplePages) {
  const htmlPath = at(page.html);
  const manifestPath = at(page.manifest);
  if (!existsSync(htmlPath)) {
    fail(`${page.label} HTML is missing (${page.html})`);
    continue;
  }
  if (!existsSync(manifestPath)) {
    fail(`${page.label} manifest is missing (${page.manifest})`);
    continue;
  }

  const html = readFileSync(htmlPath, 'utf8');
  const publishedPageUrl = new URL(page.publishedHtml, pagesRoot);
  const linkTags = html.match(/<link\b[^>]*>/gi) || [];
  const manifestTag = linkTags.find((tag) => /\brel\s*=\s*["']manifest["']/i.test(tag));
  const manifestHref = manifestTag ? tagAttribute(manifestTag, 'href') : '';
  if (!manifestHref) {
    fail(`${page.label} has no manifest link`);
  } else {
    const expectedManifestUrl = new URL(page.publishedManifest, pagesRoot);
    // Vite rebases root-absolute public URLs for the GitHub Pages project path.
    const manifestUrl = page.viteBase === './' && manifestHref === '/manifest.webmanifest'
      ? expectedManifestUrl
      : new URL(manifestHref, publishedPageUrl);
    if (manifestUrl.href !== expectedManifestUrl.href) {
      fail(`${page.label} manifest link resolves to ${manifestUrl.pathname}, expected ${expectedManifestUrl.pathname}`);
    } else {
      pass(`${page.label} links to ${manifestUrl.pathname}`);
    }
  }

  const scriptTags = html.match(/<script\b[^>]*>/gi) || [];
  const pwaTag = scriptTags.find((tag) => /\bsrc\s*=\s*["'][^"']*pwa\.js(?:[?#][^"']*)?["']/i.test(tag));
  const pwaSrc = pwaTag ? tagAttribute(pwaTag, 'src') : '';
  let pwaUrl = null;
  if (!pwaSrc) {
    fail(`${page.label} does not load pwa.js`);
  } else {
    pwaUrl = new URL(pwaSrc, publishedPageUrl);
    const pwaPath = pagesFile(pwaUrl, `${page.label} pwa.js`);
    if (pwaPath && existsSync(pwaPath)) pass(`${page.label} pwa.js resolves to its deployed runtime`);
    else if (pwaPath) fail(`${page.label} pwa.js target does not exist: ${pwaUrl.pathname}`);
  }

  if (pwaTag && pwaUrl) {
    if (page.label === 'user-facing example') {
      const floatingRoot = /id="assistant-floating-root"/.test(html);
      const assistantModule = scriptTags.some((tag) => /src="\.\/src\/main\.jsx"/.test(tag));
      const assistantSource = existsSync(at('example/src/main.jsx'))
        ? readFileSync(at('example/src/main.jsx'), 'utf8')
        : '';
      const assistantMarkPath = at('example/src/assistant-mark.png');
      const assistantMarkSize = existsSync(assistantMarkPath) ? pngSize(assistantMarkPath) : null;
      const floatingStyles = readFileSync(at('example/example.css'), 'utf8');
      if (floatingRoot && assistantModule && !/ElectricLogo|electric-logo/.test(assistantSource)
        && /assistantMark/.test(assistantSource) && /<img className="assistant-mark-image"/.test(assistantSource)
        && assistantMarkSize?.width === 192 && assistantMarkSize?.height === 192
        && /\.assistant-widget\s*\{[^}]*position:\s*fixed/s.test(floatingStyles)) {
        pass(`${page.label} mounts the visible static logo mark in a fixed floating assistant`);
      } else {
        fail(`${page.label} is missing its fixed floating assistant logo or mount`);
      }
      if (/data-pwa-diagnostics/.test(assistantSource) && /data-pwa-install/.test(assistantSource)) {
        pass(`${page.label} floating assistant exposes working diagnostics and install actions`);
      } else {
        fail(`${page.label} floating assistant is missing diagnostics or install actions`);
      }
    } else if (/\bdata-toolbox(?:\s|=|>)/i.test(pwaTag)) {
      pass(`${page.label} enables the floating install toolbox`);
    } else {
      fail(`${page.label} is missing data-toolbox`);
    }

    const manifestSrc = tagAttribute(pwaTag, 'data-manifest') || 'manifest.webmanifest';
    const configuredManifestUrl = new URL(manifestSrc, pwaUrl);
    const expectedManifestUrl = new URL(page.publishedManifest, pagesRoot);
    if (configuredManifestUrl.href === expectedManifestUrl.href) {
      pass(`${page.label} runtime uses its route-local manifest`);
    } else {
      fail(`${page.label} runtime manifest resolves to ${configuredManifestUrl.pathname}, expected ${expectedManifestUrl.pathname}`);
    }

    const workerSrc = tagAttribute(pwaTag, 'data-sw') || 'progressier.js';
    const workerUrl = new URL(workerSrc, pwaUrl);
    const workerPath = pagesFile(workerUrl, `${page.label} service worker`);
    if (workerPath && existsSync(workerPath)) pass(`${page.label} service worker resolves to its deployed worker`);
    else if (workerPath) fail(`${page.label} service worker target does not exist: ${workerUrl.pathname}`);

    const scopeSrc = tagAttribute(pwaTag, 'data-sw-scope');
    const workerScopeUrl = scopeSrc ? new URL(scopeSrc, pwaUrl) : new URL('.', workerUrl);
    const expectedScopeUrl = new URL('.', publishedPageUrl);
    if (workerScopeUrl.pathname === expectedScopeUrl.pathname) {
      pass(`${page.label} service worker is scoped to its own route`);
    } else {
      fail(`${page.label} service worker scope is ${workerScopeUrl.pathname}, expected ${expectedScopeUrl.pathname}`);
    }
  }

  const stylesheetTag = linkTags.find((tag) => tag.includes('rel="stylesheet"'));
  if (stylesheetTag) {
    const stylesheetUrl = new URL(tagAttribute(stylesheetTag, 'href'), publishedPageUrl);
    const stylesheetPath = pagesFile(stylesheetUrl, `${page.label} stylesheet`);
    if (stylesheetPath && existsSync(stylesheetPath)) pass(`${page.label} stylesheet is included`);
    else if (stylesheetPath) fail(`${page.label} stylesheet is missing: ${stylesheetUrl.pathname}`);
  }

  if (page.label === 'user-facing example') {
    const appScript = scriptTags.find((tag) => tag.includes('src="example.js"'));
    if (!appScript) {
      fail(`${page.label} app script is missing from its HTML`);
    } else {
      const appScriptUrl = new URL(tagAttribute(appScript, 'src'), publishedPageUrl);
      const appScriptPath = pagesFile(appScriptUrl, `${page.label} app script`);
      if (appScriptPath && existsSync(appScriptPath)) pass(`${page.label} app script is included`);
      else if (appScriptPath) fail(`${page.label} app script target is missing: ${appScriptUrl.pathname}`);
    }
  }

  let pageManifest;
  try {
    pageManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    pass(`${page.label} manifest parses`);
  } catch (error) {
    fail(`${page.label} manifest is invalid JSON: ${error.message}`);
    continue;
  }

  const manifestUrl = new URL(page.publishedManifest, pagesRoot);
  const scopeUrl = new URL(pageManifest.scope || './', manifestUrl);
  const startUrl = new URL(pageManifest.start_url || './', manifestUrl);
  if (scopeUrl.origin !== pagesRoot.origin || startUrl.origin !== pagesRoot.origin || !startUrl.pathname.startsWith(scopeUrl.pathname)) {
    fail(`${page.label} start_url is outside its manifest scope`);
  } else {
    pass(`${page.label} start_url is inside its own scope`);
  }

  if (!pageManifest.id) {
    fail(`${page.label} manifest has no stable id`);
  } else {
    const id = new URL(pageManifest.id, manifestUrl).href;
    if (seenExampleIds.has(id)) {
      fail(`${page.label} shares a manifest id with ${seenExampleIds.get(id)}`);
    } else {
      seenExampleIds.set(id, page.label);
      pass(`${page.label} has a distinct install identity`);
    }
  }

  for (const icon of pageManifest.icons || []) {
    const iconUrl = new URL(icon.src || '', manifestUrl);
    const iconPath = pagesFile(iconUrl, `${page.label} icon`);
    if (!iconPath) continue;
    if (!existsSync(iconPath)) {
      fail(`${page.label} icon is missing: ${iconUrl.pathname}`);
      continue;
    }
    const actual = pngSize(iconPath);
    const declared = /^(\d+)x(\d+)$/.exec(String(icon.sizes || '').split(/\s+/)[0]);
    if (!actual || (declared && (Number(declared[1]) !== actual.width || Number(declared[2]) !== actual.height))) {
      fail(`${page.label} icon does not match its declared PNG size: ${iconUrl.pathname}`);
    } else {
      pass(`${page.label} icon ${iconUrl.pathname} is ${actual.width}x${actual.height}`);
    }
  }
}

for (const file of ['example/example.css', 'example/example.js']) {
  if (existsSync(at(file))) pass(`${file} exists`);
  else fail(`${file} is missing`);
}

/* ------------------------------------------------------------------ *
 * 7b. Platform foundation, design and install contracts
 * ------------------------------------------------------------------ */

section('You.Ge Assistant foundation contracts');

function contract(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

const foundationDocs = [
  'FOUNDATION_AUDIT.md',
  'ASSISTANT_ARCHITECTURE.md',
  'INSTALLATION_EXPERIENCE.md',
  'DESIGN_FOUNDATION.md',
  'WIDGET.md',
  'design-system/you-ge-assistant/MASTER.md',
];
for (const file of foundationDocs) {
  contract(existsSync(at(file)), `${file} is present`);
}

const architectureSource = existsSync(at('ASSISTANT_ARCHITECTURE.md'))
  ? readFileSync(at('ASSISTANT_ARCHITECTURE.md'), 'utf8') : '';
contract(/```mermaid[\s\S]*flowchart TB/.test(architectureSource), 'architecture includes a Mermaid diagram');
contract(/## 12\. Implementation roadmap/.test(architectureSource), 'architecture includes a phased roadmap');
contract(architectureSource.includes('https://staff-you-ge.sandro-1990.workers.dev')
  && architectureSource.includes('Example only'), 'backup URL is documented as a project-specific example only');
contract(architectureSource.includes('Preview Worker URL') && architectureSource.includes('never'), 'Preview Worker is explicitly ruled out as production backup');

const installDoc = existsSync(at('INSTALLATION_EXPERIENCE.md'))
  ? readFileSync(at('INSTALLATION_EXPERIENCE.md'), 'utf8') : '';
for (const token of ['beforeinstallprompt', 'event.prompt()', 'appinstalled', 'showHelp(\'ios\')', 'showHelp(\'generic\')', 'pwa.js']) {
  contract(installDoc.includes(token), `installation record documents ${token}`);
}

const installMarkers = [
  'aria-labelledby\', \'pwa-install-title\'',
  'aria-describedby\', \'pwa-install-steps\'',
  '.close:focus-visible,.ok:focus-visible',
  'min-width:44px;min-height:44px',
  '@media (prefers-reduced-motion:reduce)',
  'var(--progressierNote,#475569)',
];
contract(installMarkers.every((token) => client.includes(token)), 'install help sheet keeps its behavior with improved focus/contrast/motion');
contract(styles.includes('.progressier-install-banner :focus-visible'), 'install banner restores a visible keyboard focus ring');

const designSource = existsSync(at('DESIGN_FOUNDATION.md'))
  ? readFileSync(at('DESIGN_FOUNDATION.md'), 'utf8') : '';
contract(designSource.includes('SKILL.md') && designSource.includes('search.py'), 'design skill usage is reported with exact instructions and commands');
contract(designSource.includes('SpotlightCard') && designSource.includes('GlareHover') && designSource.includes('LatticeLoader'), 'React Bits adoption report names adopted components');
const masterSource = existsSync(at('design-system/you-ge-assistant/MASTER.md'))
  ? readFileSync(at('design-system/you-ge-assistant/MASTER.md'), 'utf8') : '';
contract(masterSource.includes('SaaS (General)') && !masterSource.includes('Luxury/Premium Brand'), 'design system uses the verified-fit SaaS match, not the rejected luxury match');

const reactBitsFiles = [
  'example/src/react-bits/SpotlightCard.tsx',
  'example/src/react-bits/SpotlightCard.css',
  'example/src/react-bits/GlareHover.tsx',
  'example/src/react-bits/GlareHover.css',
  'example/src/react-bits/LatticeLoader.tsx',
  'example/src/react-bits/LatticeLoader.css',
  'example/src/FoundationPreview.tsx',
  'example/tsconfig.json',
];
for (const file of reactBitsFiles) {
  contract(existsSync(at(file)), `${file} is vendored into the example`);
}
const reactBitsSources = reactBitsFiles
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => readFileSync(at(file), 'utf8'));
contract(reactBitsSources.every((text) => !/from ['"](?:gsap|motion|@hugeicons)/.test(text)), 'adopted React Bits sources add no runtime dependencies');
contract(reactBitsSources.every((text) => !text.includes("'use client'")), 'Next.js-only use client directives were removed from vendored sources');
const reactBitsStyles = reactBitsFiles
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(at(file), 'utf8'));
contract(reactBitsStyles.every((text) => text.includes('prefers-reduced-motion')), 'every adopted React Bits stylesheet has a reduced-motion override');
const examplePackage = JSON.parse(readFileSync(at('example/package.json'), 'utf8'));
contract(Boolean(examplePackage.scripts && examplePackage.scripts.typecheck), 'React example exposes a typecheck script');
const noticeSource = readFileSync(at('example/THIRD_PARTY_NOTICES.md'), 'utf8');
for (const name of ['SpotlightCard', 'GlareHover', 'LatticeLoader']) {
  contract(noticeSource.includes(name), `third-party notices list ${name}`);
}

const exampleHtmlSource = readFileSync(at('example/index.html'), 'utf8');
contract(exampleHtmlSource.includes('id="assistant-foundation-root"') && exampleHtmlSource.includes('<article class="foundation-card">'), 'foundation preview has a no-JS static fallback');
const mainSource = readFileSync(at('example/src/main.jsx'), 'utf8');
contract(mainSource.includes('<FoundationPreview />'), 'React example mounts the foundation preview');

const runtimeFiles = [
  'pwa.js', 'progressier.js', 'domain-config.js', 'domain-registry.js',
  'dns-diagnostics.js', 'manifest-handler.js', 'offline.js', 'example/example.js',
];
const runtimeText = runtimeFiles.map((file) => readFileSync(at(file), 'utf8')).join('\n');
contract(!runtimeText.includes('staff-you-ge.sandro-1990.workers.dev'), 'example backup URL is absent from runtime code');
contract(runtimeText.includes('data-pwa-install') && runtimeText.includes('promptInstall'), 'installation delegation and public API remain in the runtime');
contract(worker.includes('CLIENT_PATH'), 'worker continues to exclude pwa.js from caching (documented offline limitation)');

const packageText = readFileSync(at('package.json'), 'utf8');
contract(packageText.includes('"name": "you-ge-assistant"') && packageText.includes('You.Ge Assistant'), 'package identity remains You.Ge Assistant');

/* ------------------------------------------------------------------ *
 * 7c. Intelligent Floating Assistant contracts
 * ------------------------------------------------------------------ */

section('Intelligent Floating Assistant contracts');

const assistantState = readFileSync(at('assistant-state.js'), 'utf8');
const assistantWidget = readFileSync(at('assistant-widget.js'), 'utf8');
const assistantStyles = readFileSync(at('assistant-widget.css'), 'utf8');
const themeSource = readFileSync(at('packages/assistant-sdk/src/theme/index.js'), 'utf8');
const sdkConfigSource = readFileSync(at('packages/assistant-sdk/src/config/index.js'), 'utf8');
const sdkAssistantSource = readFileSync(at('packages/assistant-sdk/src/assistant/index.js'), 'utf8');
const demoHtmlSource = readFileSync(at('demo/index.html'), 'utf8');
const exampleHtmlSource2 = readFileSync(at('example/index.html'), 'utf8');
const offlineHtmlSource = readFileSync(at('offline.html'), 'utf8');
const snippetHtmlSource = readFileSync(at('snippet.html'), 'utf8');
const mainJsxSource = readFileSync(at('example/src/main.jsx'), 'utf8');
const themeStudioSource = readFileSync(at('example/src/ThemeStudio.jsx'), 'utf8');
const exampleCssSource = readFileSync(at('example/example.css'), 'utf8');
const sdkReactSource = readFileSync(at('packages/assistant-sdk/src/adapters/react.js'), 'utf8');
const pagesWorkflowSource = readFileSync(at('.github/workflows/pages.yml'), 'utf8');
const viteConfigSource = readFileSync(at('example/vite.config.js'), 'utf8');
const offlineJsSource = readFileSync(at('offline.js'), 'utf8');
const widgetDocSource = readFileSync(at('WIDGET.md'), 'utf8');

function withoutBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}
const assistantStateCode = withoutBlockComments(assistantState);
const assistantWidgetCode = withoutBlockComments(assistantWidget);

contract(/root\.YouGeAssistant = api/.test(assistantState), 'centralized state publishes window.YouGeAssistant');
contract(/configure: configure[\s\S]*getState:[\s\S]*subscribe: subscribe[\s\S]*destroy: destroy/.test(assistantState), 'SDK surface exposes configure, getState, subscribe and destroy');
contract(!/\bfetch\s*\(/.test(assistantStateCode) && !/\.register\s*\(/.test(assistantStateCode) && !/setInterval\s*\(/.test(assistantStateCode), 'state core makes no network requests, no duplicate SW registration and no polling');
contract(/PRIORITY\s*=\s*\{[^}]*critical:\s*1[^}]*auth:\s*2[^}]*backup:\s*3[^}]*install:\s*4[^}]*info:\s*5/s.test(assistantState), 'notification priority order is 1 connectivity, 2 auth, 3 backup, 4 install, 5 info');
contract(['youge:endpoint-status', 'youge:session-status', 'youge:dns-result', 'pwa:diagnostics', 'pwa:installable', 'pwa:installed', 'pwa:update'].every((name) => assistantState.includes(name)), 'state binds real project/PWA events once');
contract(/function bindOnce/.test(assistantState) && /function destroy/.test(assistantState), 'listeners are initialized once and can be cleaned up');
contract(/function isSuppressed/.test(assistantState) && /lastConditionKeys/.test(assistantState), 'dismissed/acknowledged notices are stored and reset when a condition resolves');
contract(!/\bfetch\s*\(/.test(assistantWidgetCode) && !/\.register\s*\(/.test(assistantWidgetCode) && !/setInterval\s*\(/.test(assistantWidgetCode), 'DOM widget makes no network requests, no SW registration and no polling');
contract(/api\.subscribe\(onState\)/.test(assistantWidget), 'DOM widget renders from the centralized state subscription');
const afterOnState = assistantWidget.split('function onState')[1] || '';
contract(!/openPanel\(\s*\);/.test(afterOnState), 'state updates never auto-open the panel');
contract(/Escape/.test(assistantWidget) && /aria-expanded/.test(assistantWidget) && /aria-controls/.test(assistantWidget) && /setAttribute\('role', 'status'\)/.test(assistantWidget), 'widget supports Escape, expanded state, controls and a live region');
contract(/data-pwa-install/.test(assistantWidget) && /data-pwa-diagnostics/.test(assistantWidget), 'install/diagnostics actions delegate to existing pwa.js instead of issuing duplicate prompts');
contract(/position: fixed/.test(assistantStyles) && /env\(safe-area-inset/.test(assistantStyles) && /prefers-reduced-motion/.test(assistantStyles) && /min-height: 44px/.test(assistantStyles) && /max-width: 480px/.test(assistantStyles), 'widget CSS covers fixed placement, safe areas, reduced motion, 44px targets and mobile viewport');
contract(/position:\s*'bottom-left'/.test(demoHtmlSource) && /data-toolbox/.test(demoHtmlSource), 'playground places the Assistant away from the existing install toolbox');
contract(/assistant-state\.js/.test(exampleHtmlSource2) && /YOU_GE_ASSISTANT_CONFIG/.test(exampleHtmlSource2), 'React example initializes the centralized state before rendering');
contract(/useSyncExternalStore/.test(mainJsxSource) && ['GlareHover', 'SpotlightCard', 'LatticeLoader'].every((name) => mainJsxSource.includes(name)), 'React renderer consumes centralized state and adopts zero-dependency React Bits components');
contract(/data-pwa-diagnostics/.test(mainJsxSource) && /data-pwa-install/.test(mainJsxSource), 'React quick actions preserve working diagnostics and install delegation');
contract(/assistant-state\.js/.test(offlineHtmlSource) && /assistant-widget\.js/.test(offlineHtmlSource), 'offline shell keeps the Assistant available');
contract(/assistant-state\.js/.test(snippetHtmlSource) && /assistant-widget\.js/.test(snippetHtmlSource) && /YOU_GE_ASSISTANT_CONFIG/.test(snippetHtmlSource), 'integration snippet documents the configurable SDK interface');
contract((pagesWorkflowSource.match(/assistant-state\.js/g) || []).length >= 2 && (pagesWorkflowSource.match(/assistant-widget\.css/g) || []).length >= 2, 'Pages workflow deploys the widget runtime to both app scopes');
contract(/assistant-state\.js/.test(viteConfigSource) && /assistant-widget\.js/.test(viteConfigSource), 'Vite development middleware serves the shared widget runtime');
contract(/youge:dns-result/.test(offlineJsSource), 'offline diagnostics publish their result into centralized state');
contract(widgetDocSource.includes('## 6. React Bits + mandatory design skill') && widgetDocSource.includes('ui-ux-pro-max-skill'), 'WIDGET.md records React Bits and the mandatory design skill');
contract(widgetDocSource.includes('Priority ladder') && widgetDocSource.includes('youge:endpoint-status'), 'WIDGET.md documents the priority ladder and project event contract');
contract(designSource.includes('## 8. Intelligent Floating Assistant'), 'DESIGN_FOUNDATION.md records the widget skill and React Bits application');

/* ------------------------------------------------------------------ *
 * 7d. @youge/assistant-sdk package contracts
 * ------------------------------------------------------------------ */

section('@youge/assistant-sdk package contracts');

const sdkRequired = [
  'packages/assistant-sdk/package.json',
  'packages/assistant-sdk/README.md',
  'packages/assistant-sdk/LICENSE',
  'packages/assistant-sdk/src/index.js',
  'packages/assistant-sdk/src/index.d.ts',
  'packages/assistant-sdk/src/domain/index.js',
  'packages/assistant-sdk/src/domain/index.d.ts',
  'packages/assistant-sdk/src/config/index.js',
  'packages/assistant-sdk/src/config/index.d.ts',
  'packages/assistant-sdk/src/diagnostics/index.js',
  'packages/assistant-sdk/src/diagnostics/index.d.ts',
  'packages/assistant-sdk/src/installation/index.js',
  'packages/assistant-sdk/src/installation/index.d.ts',
  'packages/assistant-sdk/src/assistant/index.js',
  'packages/assistant-sdk/src/theme/index.js',
  'packages/assistant-sdk/src/theme/index.d.ts',
  'packages/assistant-sdk/src/adapters/pwa-kit.js',
  'packages/assistant-sdk/src/adapters/react.js',
  'packages/assistant-sdk/src/adapters/react.d.ts',
];
for (const rel of sdkRequired) {
  contract(existsSync(at(rel)), `${rel} exists`);
}

const sdkPkg = JSON.parse(readFileSync(at('packages/assistant-sdk/package.json'), 'utf8'));
contract(sdkPkg.name === '@youge/assistant-sdk', 'SDK package name is @youge/assistant-sdk');
contract(sdkPkg.version === '0.2.0' && sdkPkg.private !== true, 'SDK package is release-ready at 0.2.0 (adaptive-theming minor release; publishing still gated by sdk-release-prep)');
contract(!sdkPkg.dependencies, 'SDK package has zero mandatory runtime dependencies');
contract(Boolean(sdkPkg.exports && sdkPkg.exports['.'] && sdkPkg.exports['./react']), 'SDK package declares explicit subpath exports');
contract(assistantState === buildBrowserStateScript(), 'assistant-state.js is deterministically synchronized with packages/assistant-sdk/src/');
contract(mainJsxSource.includes('@youge/assistant-sdk'), 'React example consumes @youge/assistant-sdk directly');
contract(designSource.includes('## 9. Phase 2 — `@youge/assistant-sdk`'), 'DESIGN_FOUNDATION.md records Phase 2 skill application');

// 0.1.1 feature release: Android in-app browser detection + Chrome handoff.
const sdkBrowserSource = readFileSync(at('packages/assistant-sdk/src/browser/index.js'), 'utf8');
contract(
  /export function detectInAppBrowser[\s\S]*export function buildChromeIntentUrl[\s\S]*export function createChromeHandoff/.test(sdkBrowserSource),
  'the SDK ships a reusable Android in-app browser detection + Chrome handoff module'
);
contract(
  Boolean(sdkPkg.exports['./browser'] && sdkPkg.exports['./browser'].types),
  'the browser subpath export ships with paired TypeScript types'
);
contract(
  /detectInAppBrowser[\s\S]*buildChromeIntentUrl[\s\S]*createChromeHandoff/.test(assistantState),
  'assistant-state.js bundles the Chrome handoff helpers for classic pages'
);
contract(
  /youge-chrome-offer/.test(assistantWidget) && /data-chrome-open/.test(assistantWidget) && /data-chrome-fallback/.test(assistantWidget),
  'the widget renders the Open in Chrome offer with a manual fallback'
);
// Adaptive theming (2026-11-07): shared tokens, isolation and the four modes.
contract(
  Boolean(sdkPkg.exports['./theme'] && sdkPkg.exports['./theme'].types),
  'the theme subpath export ships with paired TypeScript types'
);
contract(
  /THEME_MODES = \['auto', 'light', 'dark', 'custom'\]/.test(themeSource),
  'the four documented theme modes are the public set'
);
contract(
  /export function resolveTheme[\s\S]*export function themeToCssVariables/.test(themeSource)
    && /export function detectHostScheme/.test(themeSource),
  'the theme module resolves modes, detects the host scheme and emits CSS variables'
);
contract(
  /PROTECTED_VARIABLES = \[[\s\S]*--youge-offset-x[\s\S]*--youge-fab-size/.test(themeSource),
  'layout geometry (offsets, launcher size) is protected from theme overrides'
);
contract(
  /theme: \{[\s\S]*mode: 'auto',[\s\S]*inheritHost: false/.test(sdkConfigSource)
    && /themeMode: 'auto'/.test(sdkConfigSource),
  'bundled defaults carry the validated theme record and the flat legacy mode'
);
contract(
  /notification\.level = notificationLevel\(notification\.id, notification\.priority\)/.test(sdkAssistantSource),
  'every emitted notification carries a presentation level derived from the unchanged priority ladder'
);
contract(
  /\.youge-notice\[data-level="critical"\]/.test(assistantStyles) && /\.youge-notice\[data-level="success"\]/.test(assistantStyles),
  'notification levels are themed in the shipped stylesheet'
);
contract(
  /#youge-assistant-root \{[\s\S]*position: fixed !important/.test(assistantStyles)
    && /#youge-assistant-root\[hidden\][\s\S]*display: none !important/.test(assistantStyles),
  'the widget guards its layout without defeating its own hidden switch'
);
contract(
  /--youge-reset-letter-spacing: normal/.test(assistantStyles)
    && /box-sizing: var\(--youge-reset-box\)/.test(assistantStyles),
  'an inherited reset keeps host text styling out of the widget subtree'
);
contract(
  !/(^|\n)\s*\*\s*\{/.test(assistantStyles) && !/(^|\n):root\s*\{/.test(assistantStyles),
  'the widget stylesheet contains no global universal or :root rule'
);
contract(
  /normalizeNotificationLevel: normalizeNotificationLevel/.test(assistantState)
    && /NOTIFICATION_LEVEL_SHAPES: NOTIFICATION_LEVEL_SHAPES/.test(assistantState),
  'classic pages expose the same level metadata and glyph helpers as the ESM SDK'
);
contract(
  /data-scheme/.test(assistantWidget) && /resolveTheme\(/.test(assistantWidget) && /resolveTheme/.test(assistantState),
  'the DOM widget renders the resolved theme and classic pages expose the resolver'
);
contract(
  /theme\??: AssistantThemeConfig/.test(readFileSync(at('packages/assistant-sdk/src/config/index.d.ts'), 'utf8')),
  'the public theme configuration type is declared for integrators'
);
contract(
  /youge-assistant:chrome-offer-dismissed/.test(assistantWidget) && /youge-assistant:chrome-offer-dismissed/.test(mainJsxSource),
  'the Chrome offer dismissal persists per origin in both renderers'
);
contract(
  mainJsxSource.includes('createChromeHandoff') && mainJsxSource.includes('shouldOffer()'),
  'the React example demonstrates the handoff as an opt-in SDK feature'
);
contract(
  !/location\.href\s*=[^=]/.test(mainJsxSource),
  'the React example never force-redirects the visitor'
);

// Phase 5 (2026-11-07): the React example demonstrates the theme system.
contract(
  /resolveTheme/.test(themeStudioSource) && /resolveAppearanceTheme/.test(mainJsxSource),
  'the React example resolves themes through the shared SDK resolver'
);
contract(
  /THEME_MODES\.map/.test(themeStudioSource) && /mode: 'custom', tokens: preset\.tokens/.test(themeStudioSource),
  'the studio exposes every mode and sends validated tokens for custom mode'
);
contract(
  /inheritHost: true/.test(themeStudioSource) && /resolved\.warnings/.test(themeStudioSource),
  'host adaptation is demonstrated and validator warnings are surfaced'
);
contract(
  /data-theme=\{resolvedTheme\.mode\}/.test(mainJsxSource)
    && /data-scheme=\{resolvedTheme\.scheme\}/.test(mainJsxSource)
    && /style=\{themeStyle\(resolvedTheme\)\}/.test(mainJsxSource),
  'the sample widget publishes mode, scheme and token variables on its root'
);
contract(
  /notificationLevelElement/.test(sdkReactSource) && /NOTIFICATION_LEVEL_SHAPES/.test(sdkReactSource),
  'React renderers build the level glyphs from the shared SDK shapes'
);
contract(
  !/dangerouslySetInnerHTML/.test(mainJsxSource) && !/dangerouslySetInnerHTML/.test(themeStudioSource),
  'the React example injects no markup for themed glyphs'
);
contract(
  /\.notice-demo\[data-level="critical"\][\s\S]*border-left-width: 4px/.test(exampleCssSource)
    && /\.assistant-notice\[data-level="warning"\]/.test(exampleCssSource),
  'the example renders all five notice levels in both the gallery and the live widget'
);
contract(
  /btn-assistant-auto/.test(demoHtmlSource) && /btn-assistant-light/.test(demoHtmlSource)
    && /btn-assistant-dark/.test(demoHtmlSource) && /btn-assistant-custom/.test(demoHtmlSource)
    && /btn-assistant-host/.test(demoHtmlSource) && /btn-assistant-invalid/.test(demoHtmlSource),
  'the playground drives all four theme modes plus host adaptation and invalid input'
);
contract(
  /configure\(\{ theme: theme \}\)/.test(demoHtmlSource) && /getConfig\(\)\.meta\.warnings/.test(demoHtmlSource),
  'the playground uses the public configure() surface and shows validation warnings'
);
contract(
  /var\(--youge-font, inherit\)/.test(exampleCssSource)
    && /var\(--youge-surface, #ffffff\)/.test(exampleCssSource)
    && /var\(--youge-radius, 20px\)/.test(exampleCssSource),
  'example surfaces paint from the shared tokens with the sample palette as fallback'
);

// 0.1.1 feature release: floating entry point auto-scaling + manual adjustment.
contract(
  /--youge-fab-size: 56px/.test(assistantStyles) && /var\(--youge-fab-size\)/.test(assistantStyles),
  'the launcher diameter is one token shared by every responsive tier'
);
contract(
  /@media \(max-width: 480px\)[\s\S]*?--youge-fab-size: 54px/.test(assistantStyles)
    && /@media \(min-width: 768px\)[\s\S]*?--youge-fab-size: 60px/.test(assistantStyles)
    && /@media \(min-width: 1280px\)[\s\S]*?--youge-fab-size: 64px/.test(assistantStyles),
  'the launcher scales across phone, tablet and desktop tiers'
);
contract(
  /youge-assistant:fab-adjust/.test(assistantWidget) && /data-adjust-reset/.test(assistantWidget),
  'the widget persists manual icon adjustments and offers a reset to defaults'
);
contract(
  /\.youge-adjust-row input\[type="range"\][\s\S]*?min-height: 44px/.test(assistantStyles)
    && /\.youge-adjust-row input\[type="range"\][\s\S]*?touch-action: manipulation/.test(assistantStyles),
  'the manual adjustment controls are 44px touch targets'
);

const releaseWorkflow = readFileSync(at('.github/workflows/sdk-release-prep.yml'), 'utf8');
contract(/^on:\s*\n\s+workflow_dispatch:/m.test(releaseWorkflow), 'sdk-release-prep triggers on workflow_dispatch only');
contract(!/^\s+(push|pull_request):/m.test(releaseWorkflow), 'sdk-release-prep never triggers on push or pull_request');

// Job-block extraction (same slicing as validate-package.mjs) so each gate is
// checked against the job it belongs to.
const releaseJobBlock = (job) => {
  const start = releaseWorkflow.indexOf(`\n  ${job}:`);
  if (start === -1) return '';
  const rest = releaseWorkflow.slice(start);
  const nextJob = rest.slice(1).search(/\n  \S/);
  return nextJob === -1 ? rest : rest.slice(0, nextJob + 1);
};
const withoutCommentLines = (text) =>
  text.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
const releasePublishBlock = releaseJobBlock('publish');
const releaseStageBlock = withoutCommentLines(releaseJobBlock('stage'));
const releaseNonComment = withoutCommentLines(releaseWorkflow);

for (const gate of [
  'SDK_RELEASE_ENABLED',
  "github.event.inputs.action == 'Stage release on npm'",
  "github.event.inputs.action == 'Publish release to npm'",
  'id-token: write',
  'registry-url: https://registry.npmjs.org',
  'SDK_RELEASE_CONFIRM: publish',
]) {
  contract(releaseWorkflow.includes(gate), `sdk-release-prep publishing gate present: ${gate}`);
}
contract(
  !/confirm_(stage|publish)/.test(releaseWorkflow) &&
    ['Verify only', 'Stage release on npm', 'Publish release to npm', 'Verify OIDC trusted publishing'].every((label) => releaseWorkflow.includes(label)),
  'sdk-release-prep exposes ONE action dropdown (four labeled options) with no typed confirmation inputs',
);
const releaseAuthBlock = withoutCommentLines(releaseJobBlock('publish-authorization'));
contract(
  releaseAuthBlock.includes("action == 'Publish release to npm'") &&
    /refs\/heads\/main/.test(releaseAuthBlock) &&
    /needs:\s*verify\b/.test(releaseAuthBlock) &&
    releaseAuthBlock.includes('SDK_RELEASE_ENABLED is not') &&
    releaseAuthBlock.includes('exit 1') &&
    !releaseAuthBlock.includes('environment:') &&
    !/id-token:/.test(releaseAuthBlock) &&
    !/npm\s+(publish|stage|dist-tag)\b/.test(releaseAuthBlock),
  'sdk-release-prep publish-authorization gate fails loudly when SDK_RELEASE_ENABLED is missing, without environment, OIDC or npm access',
);
contract(
  releasePublishBlock.includes("action == 'Publish release to npm'") &&
    /refs\/heads\/main/.test(withoutCommentLines(releasePublishBlock)) &&
    /needs:\s*\[verify,\s*publish-authorization\]/.test(releasePublishBlock),
  'sdk-release-prep publish job requires the Publish release to npm selection from main, after verify and the authorization gate',
);
contract(
  releasePublishBlock.includes('environment: sdk-npm-publish'),
  'sdk-release-prep publishing gate present: environment: sdk-npm-publish',
);
// No npm token reference anywhere: BOTH the publish and the stage job
// authenticate via npm Trusted Publishing (OIDC) — verify, stage and publish
// all work without any stored npm credential.
contract(
  !/NODE_AUTH_TOKEN|secrets\.NPM_/.test(releaseNonComment),
  'sdk-release-prep authenticates via npm OIDC trusted publishing (no npm token reference anywhere in the workflow)',
);
contract(
  /node-version:\s*24/.test(releaseWorkflow),
  'sdk-release-prep publish job pins Node 24 (npm >= 11.5.1 / Node >= 22.14 required for OIDC trusted publishing)',
);

// First-publication `stage` job: manual-only with its own confirmation, after
// verification, inside the protected environment, OIDC permissions (staging
// needs `id-token: write` for `npm stage publish`), staging only (never
// publish / approve / reject).
contract(
  releaseStageBlock.includes("action == 'Stage release on npm'") &&
    !releaseStageBlock.includes('confirm_stage'),
  'sdk-release-prep stage job requires the Stage release on npm selection (no typed confirmation)',
);
contract(/refs\/heads\/main/.test(releaseStageBlock), 'sdk-release-prep stage job runs from main only (never untrusted branches)');
contract(/needs:\s*verify\b/.test(releaseStageBlock), 'sdk-release-prep stage job depends on the verify job');
contract(
  releaseStageBlock.includes('environment: sdk-npm-publish'),
  'sdk-release-prep stage job uses the protected sdk-npm-publish environment',
);
contract(
  (() => {
    const lines = releaseStageBlock.split('\n');
    const start = lines.findIndex((line) => line.trim() === 'permissions:');
    if (start === -1) return false;
    const end = lines.findIndex((line, i) => i > start && /^\s{4}\S/.test(line));
    const perm = lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
    const keys = [...perm.matchAll(/^\s+([a-z][a-z0-9-]*):/gm)].map((m) => m[1]);
    return (
      keys.length === 2 &&
      keys.includes('contents') &&
      keys.includes('id-token') &&
      /contents:\s*read/.test(perm) &&
      /id-token:\s*write/.test(perm)
    );
  })(),
  'sdk-release-prep stage job OIDC permissions (exactly contents: read + id-token: write)',
);
contract(
  releaseStageBlock.includes('npm stage publish') && !/npm\s+publish/.test(releaseStageBlock),
  'sdk-release-prep stage job stages with npm stage publish and never runs npm publish',
);
contract(
  !/npm\s+stage\s+(approve|reject)/.test(releaseNonComment),
  'sdk-release-prep never approves or rejects a stage (owner-only decision)',
);
contract(
  releaseStageBlock.includes('0.0.0-stage') &&
    /NOT published/.test(releaseStageBlock) &&
    /Staged Packages/.test(releaseStageBlock),
  'stage job summary states staged-NOT-published with the 0.0.0-stage placeholder and approval instructions',
);

/* ---- Non-mutating OIDC verification (manual action=oidc-check) ---------- */
const releaseOidcCheckBlock = withoutCommentLines(releaseJobBlock('oidc-check'));
contract(
  releaseOidcCheckBlock.includes("action == 'Verify OIDC trusted publishing'"),
  'sdk-release-prep offers the manually dispatched Verify OIDC trusted publishing action',
);
contract(
  /environment:\s*sdk-npm-publish/.test(releaseOidcCheckBlock) &&
    /id-token:\s*write/.test(releaseOidcCheckBlock) &&
    /node-version:\s*24/.test(releaseOidcCheckBlock) &&
    /github\.event\.inputs\.action == 'Verify OIDC trusted publishing'/.test(releaseOidcCheckBlock) &&
    /github\.ref == 'refs\/heads\/main'/.test(releaseOidcCheckBlock),
  'oidc-check requires the Verify OIDC trusted publishing selection AND github.ref=refs/heads/main, in the protected environment with OIDC id-token and Node 24',
);
contract(
  (() => {
    const lines = releaseOidcCheckBlock.split('\n');
    const start = lines.findIndex((line) => line.trim() === 'permissions:');
    if (start === -1) return false;
    const end = lines.findIndex((line, i) => i > start && /^\s{4}\S/.test(line));
    const perm = lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
    const keys = [...perm.matchAll(/^\s+([a-z][a-z0-9-]*):/gm)].map((m) => m[1]);
    return (
      keys.length === 2 &&
      keys.includes('contents') &&
      keys.includes('id-token') &&
      /contents:\s*read/.test(perm) &&
      /id-token:\s*write/.test(perm)
    );
  })(),
  'oidc-check permissions stay exactly contents: read + id-token: write',
);
contract(
  !/npm\s+(publish|stage|dist-tag|login|token|access|audit|config)\b/.test(releaseOidcCheckBlock) &&
    !/secrets\./.test(releaseOidcCheckBlock) &&
    !/NODE_AUTH_TOKEN/.test(releaseOidcCheckBlock) &&
    !/SDK_RELEASE_ENABLED\s*:/.test(releaseOidcCheckBlock) &&
    !/SDK_RELEASE_CONFIRM/.test(releaseOidcCheckBlock) &&
    !/registry-url:/.test(releaseOidcCheckBlock),
  'oidc-check job runs no npm command and holds no credential or release-authorization variable',
);
const oidcScriptPath = at('scripts/oidc-trust-check.mjs');
contract(existsSync(oidcScriptPath), 'scripts/oidc-trust-check.mjs exists');
const oidcScript = existsSync(oidcScriptPath) ? readFileSync(oidcScriptPath, 'utf8') : '';
const oidcScriptCode = oidcScript
  .split('\n')
  .filter((line) => !/^\s*\/\//.test(line))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');
contract(
  /oidc\/token\/exchange\/package\//.test(oidcScriptCode) &&
    /npm:registry\.npmjs\.org/.test(oidcScriptCode) &&
    /status === 201/.test(oidcScriptCode),
  'oidc-check script targets the documented npm OIDC token-exchange operation and fails unless it returns 201',
);
contract(
  /method: 'GET'/.test(oidcScriptCode) &&
    /method: 'POST'/.test(oidcScriptCode) &&
    !/method:\s*'(PUT|PATCH|DELETE|HEAD)'/.test(oidcScriptCode) &&
    !/\/-\/npm\/v1\/package\//.test(oidcScriptCode) &&
    !/dist-tag\s+(add|ls|rm|set|remove)/.test(oidcScriptCode) &&
    !/\bnpm\s+(publish|stage)\b/.test(oidcScriptCode),
  'oidc-check script issues only the GitHub id_token GET and the npm token-exchange POST (no registry mutation)',
);

// The `verify` job must never publish (comment lines excluded so a documented
// "never run npm publish here" note does not trip the contract).
const verifyJobBlock = withoutCommentLines(releaseJobBlock('verify'));
contract(!/npm\s+publish/.test(verifyJobBlock), 'sdk-release-prep verify job never publishes');
contract(
  !/SDK_RELEASE_ENABLED\s*:/.test(releaseNonComment),
  'sdk-release-prep keeps SDK_RELEASE_ENABLED a repository variable (never hardcoded)',
);
// The in-repo gates must never be described as making direct publishing
// impossible: SDK_RELEASE_CONFIRM / SDK_RELEASE_ENABLED are
// accidental-publish guards, not authorization boundaries (RELEASE.md §5).
contract(
  !/can never release|cannot publish directly|impossible to publish|makes publishing impossible/i.test(
    releaseWorkflow,
  ),
  'sdk-release-prep must not claim the in-repo gates make direct publishing impossible',
);
contract(
  /accidental-publish guard/i.test(releaseWorkflow),
  'sdk-release-prep must frame SDK_RELEASE_CONFIRM as an accidental-publish guard only',
);
contract(typeof sdkPkg.scripts?.prepublishOnly === 'string', 'SDK package keeps prepublishOnly validation as the final publish net');

function listSdkSourceFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) listSdkSourceFiles(full, acc);
    else if (name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

const sdkSources = listSdkSourceFiles(at('packages/assistant-sdk/src'));
contract(
  sdkSources.every((file) => {
    const stripped = withoutBlockComments(readFileSync(file, 'utf8'));
    return !/\bfetch\s*\(/.test(stripped) &&
      !/\.register\s*\(/.test(stripped) &&
      !/\bsetInterval\s*\(/.test(stripped) &&
      !/from\s+['"]react['"]|require\(['"]react['"]\)/.test(stripped);
  }),
  'SDK source modules have zero React runtime dependency, zero fetch, zero SW registration and zero polling'
);

/* ------------------------------------------------------------------ *
 * 8. Optional files worth having
 * ------------------------------------------------------------------ */

section('Optional files');

const optional = [
  ['icons/apple-touch-icon.png', 'iOS home-screen icon'],
  ['icons/favicon-32.png', 'PNG favicon'],
  ['browserconfig.xml', 'Windows tiles'],
  ['snippet.html', 'copy-paste head block'],
  ['LICENSE', 'license file'],
];

for (const [file, label] of optional) {
  if (existsSync(at(file))) pass(`${label} (${file})`);
  else warn(`${file} is missing (${label})`);
}

const iconBytes = existsSync(at('icons/icon-512.png')) ? statSync(at('icons/icon-512.png')).size : 0;
if (iconBytes && iconBytes < 3000) warn('icons/icon-512.png looks like a placeholder or is heavily compressed');

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

console.log('');
if (failures.length === 0) {
  console.log(green(`All checks passed${warnings.length ? ` with ${warnings.length} warning(s)` : ''}.`));
  process.exit(0);
}

console.log(red(`${failures.length} check(s) failed, ${warnings.length} warning(s).`));
console.log(cyan('Fix the FAIL lines above before deploying.'));
process.exit(1);
