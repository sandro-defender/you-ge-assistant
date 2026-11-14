/**
 * Static foundation contracts: manifest validity, install preservation,
 * service worker registration, offline behavior, domain/security boundaries,
 * identity, design-system and CI gates. Behavioral install coverage lives in
 * tests/install-experience.test.mjs.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import '../domain-config.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const has = (path) => existsSync(new URL(`../${path}`, import.meta.url));

const pwa = read('pwa.js');
const worker = read('you-ge-sw.js');
const legacyWorkerShim = read('progressier.js');
const styles = read('pwa.css');
const offlineHtml = read('offline.html');
const exampleCss = read('example/example.css');
const preview = read('example/src/FoundationPreview.tsx');
const architecture = read('ASSISTANT_ARCHITECTURE.md');

function pngSize(path) {
  const buffer = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', `${path} is a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('static fallback manifest is valid, in-scope and uses canonical identity while staff.you.ge preserves its installed id', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'You.Ge Assistant');
  assert.equal(manifest.short_name, 'You.Ge');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.id, '/', 'generic static fallback manifest uses canonical "/" id');
  assert.match(read('domain-registry.js'), /'staff\.you\.ge'[\s\S]*id:\s*'\/HIPSBNVemXtM8VMwRfWs'/, 'staff.you.ge preserves its installed id');
  assert.ok(manifest.start_url.startsWith(manifest.scope), 'start_url stays inside scope');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
  assert.ok(manifest.icons.some((icon) => String(icon.purpose).includes('maskable')));

  for (const icon of manifest.icons) {
    const src = icon.src.replace(/^\//, '');
    assert.ok(has(src), `${icon.src} exists`);
    const declared = /^(\d+)x(\d+)$/.exec(icon.sizes);
    const actual = pngSize(src);
    assert.equal(actual.width, Number(declared[1]));
    assert.equal(actual.height, Number(declared[2]));
  }

  assert.equal(manifest.share_target.action, '/share-target');
  for (const handler of manifest.protocol_handlers || []) {
    assert.ok(handler.url.includes('%s'), `${handler.protocol} has a %s placeholder`);
  }
  assert.equal(manifest.prefer_related_applications, false);
  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /javascript:|eval\(|Function\(|password|secret|token/i, 'no executable JS or secrets');
});

test('user-facing identity is You.Ge Assistant across the toolkit', () => {
  assert.equal(JSON.parse(read('package.json')).name, 'you-ge-assistant');
  assert.match(JSON.parse(read('package.json')).description, /You\.Ge Assistant/);
  assert.match(read('demo/index.html'), /<title>You\.Ge Assistant/);
  assert.match(offlineHtml, /Offline — You\.Ge Assistant/);
  assert.match(read('snippet.html'), /content="You\.Ge Assistant"/);
  assert.match(read('README.md'), /# You\.Ge Assistant/);
  // Canonical GitHub repository URL after the PWA-Helper -> you-ge-assistant
  // rename (2026-11-06). Old-name remnants are allowed only as intentional
  // history (session branch slugs, local sandbox paths, product language) —
  // never as github.com or github.io URLs.
  assert.match(read('README.md'), /github\.com\/sandro-defender\/you-ge-assistant/);
  const docsWithUrls = [
    'README.md', 'AGENTS.md', 'ASSISTANT_ARCHITECTURE.md', 'ARCHITECTURE_AUDIT.md',
    'demo/index.html', 'packages/assistant-sdk/package.json', 'packages/assistant-sdk/RELEASE.md',
    'packages/assistant-sdk/MIGRATION.md', 'packages/assistant-sdk/README.md',
  ].map(read).join('\n');
  assert.doesNotMatch(docsWithUrls, /github\.com\/sandro-defender\/PWA-Helper/, 'no stale github.com repository URLs');
  assert.doesNotMatch(docsWithUrls, /github\.io\/PWA-Helper/, 'no stale GitHub Pages URLs');
});

test('installation implementation keeps every documented browser path', () => {
  for (const token of [
    "addEventListener('beforeinstallprompt'",
    'event.preventDefault()',
    'event.prompt()',
    'event.userChoice',
    "addEventListener('appinstalled'",
    'function isStandalone()',
    'function isIOS()',
    'function isSafari()',
    "showHelp('ios')",
    "showHelp('generic')",
    'BANNER_INSTALL_COOKIE',
    'progressierinstallbanner',
    'pwakit:welcome',
    "[data-pwa-install]",
    'MutationObserver',
    'showInstallHelp: showHelp',
    'promptInstall: promptInstall',
  ]) {
    assert.ok(pwa.includes(token), `pwa.js preserves ${token}`);
  }
  assert.match(pwa, /showQrDialog\(\)/, 'desktop QR fallback is preserved');
  assert.match(pwa, /window\.alert\(title/, 'no-Shadow-DOM fallback is preserved');
});

test('install sheet and banner improvements add accessibility without changing behavior', () => {
  assert.match(pwa, /\.close:focus-visible,\.ok:focus-visible/);
  assert.match(pwa, /min-width:44px;min-height:44px/);
  assert.match(pwa, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(pwa, /aria-labelledby', 'pwa-install-title'/);
  assert.match(pwa, /aria-describedby', 'pwa-install-steps'/);
  assert.match(styles, /\.progressier-install-banner :focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  // Legacy toolbox sizing/placement is still verified against the original bundle.
  assert.match(styles, /z-index: 2147483643/);
  assert.match(styles, /width: 65px/);
});

test('service worker registration uses clean canonical you-ge-sw.js cutover while keeping progressier.js shim available', () => {
  assert.match(pwa, /\.register\(config\.swUrl, \{ scope: config\.swScope \}\)/);
  assert.match(pwa, /swUrl: resolveUrl\(dataset\.sw \|\| 'you-ge-sw\.js'\)/);
  assert.doesNotMatch(pwa, /legacy-preserved|swMigrationMode|isLegacyWorkerScriptUrl/);
  assert.match(legacyWorkerShim, /importScripts\(new URL\('you-ge-sw\.js'/);
  assert.match(pwa, /addEventListener\('controllerchange'/);
  assert.match(pwa, /SKIP_WAITING/);
  for (const event of ['install', 'activate', 'fetch', 'message', 'push', 'notificationclick']) {
    assert.ok(worker.includes("addEventListener('" + event + "'"), `worker handles ${event}`);
  }
  const clientVersion = /version:\s*'([^']+)'/.exec(pwa)[1];
  const workerVersion = /const VERSION = '([^']+)'/.exec(worker)[1];
  assert.equal(clientVersion, workerVersion, 'client and worker versions match');
});

test('offline shell and caches remain isolated and conservative', () => {
  for (const asset of ['offline.html', 'offline.js', 'offline.css', 'domain-config.js', 'domain-registry.js', 'dns-diagnostics.js', 'pwa.css', 'qrcode.js']) {
    assert.ok(worker.includes(`'${asset}'`), `${asset} is precached`);
  }
  assert.ok(worker.includes('CACHE_NAMESPACE') && worker.includes('self.location.hostname') && worker.includes('SCOPE_PATH'));
  assert.match(worker, /request\.headers\.has\('authorization'\)/);
  assert.match(worker, /no-store\|no-cache\|private/);
  assert.match(worker, /request\.mode === 'navigate'/);
  assert.ok(worker.includes('CLIENT_PATH'), 'pwa.js is deliberately not cached');
  assert.match(offlineHtml, /DNS recovery instructions/);
  assert.match(offlineHtml, /id="currentDomain"/);
  assert.match(offlineHtml, /id="retryLink"/);
});

test('domain detection stays injectable and never becomes authentication', () => {
  const domain = read('domain-config.js');
  assert.match(domain, /function resolve\(locationLike, optionalRegistry\)/);
  assert.match(domain, /normalizeHost/);
  assert.match(domain, /DEFAULTS/);
  assert.match(domain, /function validConfig/);
  const resolved = globalThis.YouGeDomain.resolve({
    hostname: 'unknown.example', origin: 'https://unknown.example',
    protocol: 'https:', pathname: '/', basePath: '/',
  });
  assert.equal(resolved.domain.configured, false, 'unknown hosts are not treated as verified');
  assert.doesNotMatch(JSON.stringify(resolved), /staff-you-ge|workers\.dev|token|secret/i);
  assert.match(read('domain-registry.js'), /configuration, not an access-control/);
  assert.match(architecture, /Hostname detection is \*\*never authentication\*\*|never authentication/);
  const runtime = [
    'pwa.js', 'you-ge-sw.js', 'progressier.js', 'domain-config.js', 'domain-registry.js',
    'dns-diagnostics.js', 'manifest-handler.js', 'offline.js', 'example/example.js',
  ].map(read).join('\n');
  assert.doesNotMatch(runtime, /staff-you-ge\.sandro-1990\.workers\.dev/, 'example backup URL is not a runtime default');
  assert.doesNotMatch(runtime, /eval\(|new Function\(/, 'no executable remote config');
});

test('architecture documents the platform, diagram, security boundaries and roadmap', () => {
  for (const phrase of [
    '## 3. Architecture diagram',
    '```mermaid',
    'flowchart TB',
    '## 8. Security boundaries',
    '## 11. Decisions that cannot be made yet',
    '## 12. Implementation roadmap',
    '@youge/assistant-sdk',
    'Last-known-good',
    'data-only JSON',
    'Preview Worker URL',
    'https://staff.you.ge',
    'https://staff-you-ge.sandro-1990.workers.dev',
  ]) {
    assert.ok(architecture.includes(phrase), `architecture covers ${phrase}`);
  }
  assert.match(architecture, /Example only; project-specific config, never a global default/);
  assert.match(read('FOUNDATION_AUDIT.md'), /## 6\. What is genuinely missing/);
  assert.match(read('INSTALLATION_EXPERIENCE.md'), /## 3\. Future SDK module design/);
});

test('adopted React Bits sources are TypeScript, dependency-free and reduced-motion aware', () => {
  const components = ['SpotlightCard', 'GlareHover', 'LatticeLoader'];
  for (const name of components) {
    const tsx = read(`example/src/react-bits/${name}.tsx`);
    const css = read(`example/src/react-bits/${name}.css`);
    assert.ok(tsx.includes(`const ${name}`) || tsx.includes(`function ${name}`), `${name} source is present`);
    assert.ok(!/from ['"](?:gsap|motion|@hugeicons|three|ogl)/.test(tsx), `${name} adds no runtime dependency`);
    assert.ok(!tsx.includes("'use client'"), `${name} has no Next.js-only directive`);
    assert.match(css, /prefers-reduced-motion: reduce/, `${name} respects reduced motion`);
  }
  assert.match(read('example/THIRD_PARTY_NOTICES.md'), /MIT \+ Commons Clause/);
});

test('foundation preview keeps essential UI usable without animation or React', () => {
  const html = read('example/index.html');
  assert.match(html, /id="assistant-foundation-root"/);
  assert.match(html, /<article class="foundation-card">/, 'static no-JS fallback');
  assert.match(html, /data-pwa-install/, 'fallback keeps the existing install hook');
  assert.match(preview, /role="status"/);
  assert.match(preview, /aria-live="polite"/);
  assert.match(preview, /aria-busy=/);
  assert.match(preview, /data-pwa-install/);
  assert.match(preview, /SpotlightCard|GlareHover|LatticeLoader/);
  assert.match(exampleCss, /min-height: 44px/);
  assert.match(exampleCss, /prefers-reduced-motion: reduce/);
  assert.match(exampleCss, /@media \(max-width: 900px\)/);
  // New UI uses inline SVG icons, not emoji, and conveys status with text too.
  assert.doesNotMatch(preview, /[\u{1F300}-\u{1FAFF}]/u, 'no emoji icons');
  assert.match(preview, /Connected|Offline/);
});

test('design skill report and persisted design system are applied records', () => {
  const report = read('DESIGN_FOUNDATION.md');
  assert.match(report, /\.claude\/skills\/ui-ux-pro-max\/SKILL\.md/);
  assert.match(report, /scripts\/search\.py/);
  assert.match(report, /--design-system/);
  assert.match(report, /--stack react/);
  assert.match(report, /React Bits/);
  assert.match(report, /SpotlightCard/);
  const master = read('design-system/you-ge-assistant/MASTER.md');
  assert.match(master, /SaaS \(General\)/);
  assert.doesNotMatch(master, /Luxury\/Premium Brand/);
  assert.match(master, /Local application notes/);
});

test('build and type-check gates are wired into CI', () => {
  const workflow = read('.github/workflows/check.yml');
  assert.match(workflow, /npm ci && npm run typecheck && npm run build/);
  assert.match(workflow, /node scripts\/check\.mjs/);
  assert.match(workflow, /npm test/);
  assert.equal(JSON.parse(read('example/package.json')).scripts.typecheck, 'tsc --noEmit -p tsconfig.json');
  assert.ok(has('example/tsconfig.json'));
});

/* ------------------------------------------------------------------ *
 * Audit regressions (2026-11): push payload navigation and the offline
 * status announcement.
 * ------------------------------------------------------------------ */

test('push payload navigation targets are validated before the client is moved', () => {
  assert.match(worker, /function resolveNotificationTarget\(raw\)/, 'the worker funnels every target through one guard');
  assert.match(worker, /self\.YouGeDomain\.safeNavigationUrl\(raw, self\.location\.href\)/, 'the guard comes from the imported classic resolver');
  assert.match(
    worker,
    /if \(url\.protocol !== 'https:' && url\.protocol !== 'http:'\) return REGISTRATION_SCOPE\.href;/,
    'the fallback path still refuses script-capable schemes when domain-config.js is missing',
  );
  assert.match(worker, /targetUrl = new URL\(resolveNotificationTarget\(target\), self\.location\.origin\);/);
  assert.match(
    worker,
    /if \(targetUrl\.protocol !== 'https:' && targetUrl\.protocol !== 'http:'\) \{\s*targetUrl = new URL\(REGISTRATION_SCOPE\);/,
    'a re-check after URL construction, so an unusable value cannot reach navigate/openWindow',
  );
  const handler = /self\.addEventListener\('notificationclick'[\s\S]*?\n\}\);/.exec(worker);
  assert.ok(handler, 'the notificationclick handler exists');
  assert.doesNotMatch(handler[0], /new URL\(\s*\(?\s*data\.url/, 'no raw payload url is ever turned into a navigation target');
});

test('the offline page announces connection changes once, atomically', () => {
  assert.match(
    offlineHtml,
    /<span class="badge" role="status" aria-live="polite" aria-atomic="true">/,
    'the offline badge is the live region offline.js rewrites',
  );
  assert.match(offlineHtml, /<span class="dot" id="dot" aria-hidden="true"><\/span>/, 'the decorative dot is not announced');
  assert.match(offlineHtml, /id="diagnosticsResult" role="status" aria-live="polite"/, 'diagnostics results stay announced');
});
