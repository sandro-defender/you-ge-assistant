import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { assemblePages } from '../scripts/assemble-pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const landing = read('examples/landing/index.html');
const playground = read('examples/config-playground/index.html');

const destinations = [
  ['Instructions', 'example/#quickstart'],
  ['Demo', 'demo/'],
  ['SDK Demo', 'sdk-demo/'],
  ['Configuration Playground', 'config-playground/'],
];

test('unified landing page presents the four real destinations', () => {
  for (const [label, href] of destinations) {
    assert.match(landing, new RegExp(`<h3>${label}</h3>`), `destination ${label}`);
    assert.ok(landing.includes(`href="${href}"`), `link to ${href}`);
  }
  assert.match(landing, /id="destinations"/);
  assert.match(landing, /id="features"/);
  assert.match(landing, /id="help"/);
  for (const id of ['get-started', 'install-pwa', 'localization-features', 'diagnostics-features', 'developer-features']) {
    assert.ok(landing.includes(`id="${id}"`), `feature category ${id}`);
  }
  const featureLinks = [...landing.matchAll(/href="([^"#]+)"/g)].map((match) => match[1]);
  assert.ok(featureLinks.length >= 25, 'the landing page is a directory, not a documentation wall');
  assert.ok(featureLinks.filter((href) => href.includes('demo/')).length >= 5);
});

test('landing page distinguishes the full Assistant from the standalone SDK', () => {
  assert.match(landing, /id="product-vs-sdk"/);
  assert.match(landing, /<h3>You\.Ge Assistant<\/h3>/);
  assert.match(landing, /<h3>You\.Ge Assistant SDK<\/h3>/);
  assert.match(landing, /complete PWA product and runtime/);
  assert.match(landing, /@youge\/assistant-sdk/);
  assert.match(landing, /does not replace the Assistant runtime/);
  assert.match(landing, /host still owns its service worker/);
  assert.doesNotMatch(landing, /serviceWorker\.register/);
});

test('new pages stay isolated from the production runtime and keep a usable no-JS structure', () => {
  for (const [label, html] of [['landing', landing], ['playground', playground]]) {
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/);
    assert.match(html, /class="skip-link" href="#main"/);
    assert.match(html, /data-product-header/);
    assert.match(html, /data-menu-toggle/);
    assert.match(html, /aria-controls="product-navigation"/);
    assert.doesNotMatch(html, /<script[^>]+src="[^"]*(?:pwa\.js|assistant-state\.js|assistant-widget\.js|you-ge-sw\.js)/, `${label} loads no runtime script`);
    assert.doesNotMatch(html, /data-assistant-worker/);
  }
  const css = read('examples/landing/landing.css') + read('examples/config-playground/src/playground.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('preserved demo sources keep the original working controls with section anchors', () => {
  const demo = read('examples/demo/index.html');
  for (const id of ['demo-live', 'demo-install', 'demo-diagnostics', 'demo-ui', 'demo-theme', 'demo-language', 'demo-events']) {
    assert.ok(demo.includes(`id="${id}"`), `demo anchor ${id}`);
  }
  for (const marker of ['youge-install-button', 'btn-diagnostics', 'btn-permission', 'btn-update', 'id="log"']) {
    assert.ok(demo.includes(marker), `preserved demo control ${marker}`);
  }
  // The playground now lives at /demo/, so its links stay inside that scope.
  assert.match(demo, /href="\.\.\/example\/#quickstart"/);
  assert.doesNotMatch(demo, /href="example\//);
});

test('assembled hub routes, anchors and feature links resolve under the Pages base path', (t) => {
  if (
    !existsSync(resolve(root, 'examples/example/dist/index.html')) ||
    !existsSync(resolve(root, 'examples/sdk-demo/dist/index.html')) ||
    !existsSync(resolve(root, 'examples/config-playground/dist/index.html'))
  ) {
    t.skip('Build the Vite examples first (CI ordering)');
    return;
  }
  const site = mkdtempSync(join(tmpdir(), 'youge-hub-'));
  t.after(() => rmSync(site, { recursive: true, force: true }));
  execFileSync(process.execPath, ['scripts/assemble-pages.mjs', '--out', site, '--base', '/you-ge-assistant'], { cwd: root });

  const pages = [
    'index.html',
    'demo/index.html',
    'example/index.html',
    'example/workspace.html',
    'sdk-demo/index.html',
    'config-playground/index.html',
  ];
  for (const page of pages) {
    assert.ok(existsSync(join(site, page)), `direct route ${page}`);
  }

  const sdkSource = read('examples/sdk-demo/src/main.ts');
  for (const page of pages) {
    const source = readFileSync(join(site, page), 'utf8');
    for (const [, url] of source.matchAll(/<(?:script|link|a|img)\b[^>]*?\b(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
      if (/^(https?:|data:|mailto:)/.test(url)) continue;
      assert.ok(!url.startsWith('/'), `${page}: root-absolute ${url}`);
      assert.ok(existsSync(resolve(site, dirname(page), decodeURIComponent(url))), `${page}: missing ${url}`);
    }
    for (const [, href] of source.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
      if (/^(https?:|mailto:)/.test(href)) continue;
      const url = new URL(href, `https://pages.invalid/you-ge-assistant/${page}`);
      assert.ok(url.pathname.startsWith('/you-ge-assistant/'), href);
      let target = resolve(site, decodeURIComponent(url.pathname.slice('/you-ge-assistant/'.length)));
      if (url.pathname.endsWith('/')) target = join(target, 'index.html');
      if (url.hash) {
        const destination = readFileSync(target, 'utf8');
        // The SDK demo renders its sections at runtime from main.ts.
        const anchorSource = target.endsWith(join('sdk-demo', 'index.html')) ? sdkSource : destination;
        assert.ok(
          anchorSource.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
          `${page}: broken anchor ${href}`,
        );
      }
    }
  }

  const rootHtml = readFileSync(join(site, 'index.html'), 'utf8');
  const demoHtml = readFileSync(join(site, 'demo/index.html'), 'utf8');
  assert.equal(demoHtml, read('examples/demo/index.html'));
  assert.notEqual(rootHtml, demoHtml);
  assert.match(rootHtml, /href="demo\/"/);
  assert.match(demoHtml, /id="demo-diagnostics"/);
  assert.ok(existsSync(join(site, 'demo/manifest.webmanifest')));
  assert.ok(existsSync(join(site, 'demo/pwa.js')));
  assert.ok(existsSync(join(site, 'config-playground/assets')) || existsSync(join(site, 'config-playground')));
  assert.match(readFileSync(join(site, 'config-playground/index.html'), 'utf8'), /id="settings-form"/);
});
