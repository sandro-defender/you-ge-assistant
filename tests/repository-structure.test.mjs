import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemblePages } from '../scripts/assemble-pages.mjs';
import { buildDist } from '../scripts/build.mjs';
import { PUBLIC_TO_SOURCE } from '../scripts/source-paths.mjs';
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
  assert.match(workflow, /node scripts\/assemble-pages\.mjs/);
  assert.match(read('.github/workflows/check.yml'), /working-directory: examples\/example/);
});

test('source files are organized under src/ and public/ while build output preserves all root public URLs', () => {
  const publicFiles = [
    'you-ge-sw.js', 'progressier.js', 'pwa.js', 'pwa.css',
    'assistant-state.js', 'assistant-widget.js', 'assistant-widget.css',
    'manifest.webmanifest', 'offline.html', 'offline.css', 'offline.js',
    'domain-config.js', 'domain-registry.js', 'dns-diagnostics.js',
    'qrcode.js', 'browserconfig.xml', 'favicon.ico',
    'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  ];

  // Runtime and public assets should live in src/ or public/, not at repo root
  for (const pub of Object.keys(PUBLIC_TO_SOURCE)) {
    assert.ok(!exists(pub), `${pub} should not remain at repository root`);
    assert.ok(exists(PUBLIC_TO_SOURCE[pub]), `${PUBLIC_TO_SOURCE[pub]} exists in organized source`);
  }

  // Build output preserves all public URLs at root
  const { outputDir } = buildDist();
  for (const path of publicFiles) {
    assert.ok(existsSync(join(outputDir, path)), `dist/${path} is present in build output`);
  }

  const shim = read('src/runtime/progressier.js');
  assert.match(shim, /importScripts\(new URL\('you-ge-sw\.js', self\.location\.href\)\.href\);/);
  const worker = read('src/runtime/you-ge-sw.js');
  for (const path of ['offline.html', 'offline.css', 'offline.js', 'assistant-state.js']) {
    assert.ok(worker.includes(path), `${path} remains part of the worker's own asset references`);
  }
  const pages = read('.github/workflows/pages.yml');
  assert.match(pages, /node scripts\/assemble-pages\.mjs/);
});

test('assemblePages produces independent root and /example/ scopes with all runtime assets andrewritten paths', () => {
  const tempSite = mkdtempSync(join(tmpdir(), 'youge-pages-test-'));
  try {
    const { outputDir, exampleOutDir } = assemblePages({
      outputDir: tempSite,
      basePath: '/you-ge-assistant',
    });

    assert.ok(existsSync(join(outputDir, '.nojekyll')), '.nojekyll is present');

    const sharedRuntime = [
      'you-ge-sw.js', 'progressier.js', 'pwa.js', 'pwa.css',
      'assistant-state.js', 'assistant-widget.js', 'assistant-widget.css',
      'offline.html', 'offline.css', 'offline.js',
      'domain-config.js', 'domain-registry.js', 'dns-diagnostics.js',
      'qrcode.js', 'browserconfig.xml', 'favicon.ico',
      'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
    ];

    for (const scopeDir of [outputDir, exampleOutDir]) {
      assert.ok(existsSync(join(scopeDir, 'index.html')), 'index.html exists');
      assert.ok(existsSync(join(scopeDir, 'manifest.webmanifest')), 'manifest.webmanifest exists');
      for (const file of sharedRuntime) {
        assert.ok(existsSync(join(scopeDir, file)), `${file} exists in ${scopeDir}`);
      }
      const shim = readFileSync(join(scopeDir, 'progressier.js'), 'utf8');
      assert.match(shim, /importScripts\(new URL\('you-ge-sw\.js', self\.location\.href\)\.href\);/);
    }

    // Root vs /example/ manifests and index.html are distinct (no accidental overwriting)
    const rootManifest = JSON.parse(readFileSync(join(outputDir, 'manifest.webmanifest'), 'utf8'));
    const exampleManifest = JSON.parse(readFileSync(join(exampleOutDir, 'manifest.webmanifest'), 'utf8'));
    assert.notEqual(rootManifest.name, exampleManifest.name);

    // Scope-specific browserconfig.xml tile paths
    const rootBrowserConfig = readFileSync(join(outputDir, 'browserconfig.xml'), 'utf8');
    const exampleBrowserConfig = readFileSync(join(exampleOutDir, 'browserconfig.xml'), 'utf8');
    assert.match(rootBrowserConfig, /src="\/you-ge-assistant\/icons\//);
    assert.match(exampleBrowserConfig, /src="\/you-ge-assistant\/example\/icons\//);

    // Example-specific offline branding
    const rootOffline = readFileSync(join(outputDir, 'offline.html'), 'utf8');
    const exampleOffline = readFileSync(join(exampleOutDir, 'offline.html'), 'utf8');
    assert.match(rootOffline, /data-default-app-name="You\.Ge Assistant"/);
    assert.match(exampleOffline, /data-default-app-name="Staff Space"/);

    // Example app files
    for (const file of ['example.js', 'THIRD_PARTY_NOTICES.md']) {
      assert.ok(existsSync(join(exampleOutDir, file)), `${file} exists in /example/`);
    }
  } finally {
    rmSync(tempSite, { recursive: true, force: true });
  }
});
