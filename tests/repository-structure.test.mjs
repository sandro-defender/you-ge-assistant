import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test('repository documentation and independent examples use their organized locations', () => {
  for (const path of [
    'docs/architecture/REPOSITORY_STRUCTURE.md',
    'docs/architecture/ASSISTANT_ARCHITECTURE.md',
    'docs/guides/INTEGRATION.md',
    'docs/guides/snippet.html',
    'docs/operations/PRECACHE_INTEGRITY.md',
    'docs/reference/COMPATIBILITY_CONTRACTS.md',
    'docs/design-system/you-ge-assistant/MASTER.md',
    'examples/demo/index.html',
    'examples/example/package.json',
    'examples/example/package-lock.json',
    'examples/push-server/README.md',
    'functions/manifest.webmanifest.js',
    'reference/README.md',
    'PARITY.md',
  ]) assert.ok(exists(path), `${path} exists`);

  for (const removed of [
    'ADAPTIVE_THEME_AUDIT.md', 'ASSISTANT_ARCHITECTURE.md',
    'COMPATIBILITY_CONTRACTS.md', 'DESIGN_FOUNDATION.md',
    'INTEGRATION.md', 'PRECACHE_INTEGRITY.md', 'snippet.html',
    'demo/index.html', 'example/index.html', 'design-system/you-ge-assistant/MASTER.md',
  ]) assert.equal(exists(removed), false, `${removed} is no longer at the old location`);

  const examplePackage = JSON.parse(read('examples/example/package.json'));
  assert.equal(examplePackage.dependencies['@youge/assistant-sdk'], 'file:../../packages/assistant-sdk');
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /cp examples\/demo\/index\.html _site\/index\.html/);
  assert.match(workflow, /cp -r examples\/example\/dist\/\. _site\/example\//);
  assert.match(read('.github/workflows/check.yml'), /working-directory: examples\/example/);
});

test('canonical and legacy public runtime files remain at their unchanged root paths', () => {
  const publicFiles = [
    'you-ge-sw.js', 'progressier.js', 'pwa.js', 'pwa.css',
    'assistant-state.js', 'assistant-widget.js', 'assistant-widget.css',
    'manifest.webmanifest', 'offline.html', 'offline.css', 'offline.js',
    'domain-config.js', 'domain-registry.js', 'dns-diagnostics.js',
    'qrcode.js', 'browserconfig.xml', 'favicon.ico',
    'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  ];
  for (const path of publicFiles) assert.ok(exists(path), `/${path} remains present`);

  const shim = read('progressier.js');
  assert.match(shim, /importScripts\(new URL\('you-ge-sw\.js', self\.location\.href\)\.href\);/);
  const worker = read('you-ge-sw.js');
  for (const path of ['offline.html', 'offline.css', 'offline.js', 'assistant-state.js']) {
    assert.ok(worker.includes(path), `${path} remains part of the worker's own asset references`);
  }
  const pages = read('.github/workflows/pages.yml');
  for (const path of ['you-ge-sw.js', 'progressier.js', 'pwa.js', 'manifest.webmanifest', 'offline.html']) {
    assert.ok(pages.includes(path), `Pages assembly still publishes ${path}`);
  }
});
