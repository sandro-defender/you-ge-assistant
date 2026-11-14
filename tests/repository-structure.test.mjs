import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { assemblePages, validateOutputDir } from '../scripts/assemble-pages.mjs';
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
    const rootHtml = readFileSync(join(outputDir, 'index.html'), 'utf8');
    const exampleHtml = readFileSync(join(exampleOutDir, 'index.html'), 'utf8');
    assert.notEqual(rootHtml, exampleHtml, 'root and /example/ index.html must be distinct');

    const rootManifest = JSON.parse(readFileSync(join(outputDir, 'manifest.webmanifest'), 'utf8'));
    const exampleManifest = JSON.parse(readFileSync(join(exampleOutDir, 'manifest.webmanifest'), 'utf8'));
    assert.notEqual(rootManifest.name, exampleManifest.name);
    assert.notEqual(rootManifest.short_name, exampleManifest.short_name);

    // Verify relative references in HTML, CSS, manifests, and service-worker scripts resolve within each scope
    const isExternalOrSpecial = (ref) =>
      !ref ||
      ref.startsWith('#') ||
      ref.startsWith('http://') ||
      ref.startsWith('https://') ||
      ref.startsWith('data:') ||
      ref.startsWith('mailto:') ||
      ref.startsWith('tel:');

    const assertScopeRef = (scopeDir, ref, sourceLabel) => {
      if (isExternalOrSpecial(ref)) return;
      const clean = ref.split(/[?#]/)[0].replace(/^\.\//, '');
      if (!clean || clean.startsWith('/')) return;
      const target = resolve(scopeDir, clean);
      assert.ok(target.startsWith(outputDir), `${sourceLabel} reference "${ref}" escapes assembled site`);
      assert.ok(existsSync(target), `${sourceLabel} reference "${ref}" resolves in ${scopeDir}`);
    };

    for (const [label, scopeDir, html, manifest] of [
      ['root', outputDir, rootHtml, rootManifest],
      ['example', exampleOutDir, exampleHtml, exampleManifest],
    ]) {
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        assertScopeRef(scopeDir, match[1], `${label} index.html`);
      }
      for (const icon of manifest.icons || []) {
        assertScopeRef(scopeDir, icon.src, `${label} manifest.webmanifest`);
      }
      const offlineCss = readFileSync(join(scopeDir, 'offline.css'), 'utf8');
      for (const match of offlineCss.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
        assertScopeRef(scopeDir, match[1], `${label} offline.css`);
      }
    }

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

test('assemblePages rejects dangerous output paths before deleting anything', () => {
  const repoRoot = resolve(dirname(new URL('..', import.meta.url).pathname));
  const parentDir = dirname(repoRoot);

  for (const unsafe of ['', '   ', '/', repoRoot, process.cwd(), parentDir]) {
    assert.throws(
      () => validateOutputDir(unsafe),
      /Unsafe output directory/,
      `validateOutputDir must reject "${unsafe}"`,
    );
    assert.throws(
      () => assemblePages({ outputDir: unsafe }),
      /Unsafe output directory/,
      `assemblePages must reject "${unsafe}"`,
    );
  }
});

test('assemblePages rejects symlinked paths pointing to repository root or protected parent', (t) => {
  const repoRoot = resolve(dirname(new URL('..', import.meta.url).pathname));
  const parentDir = dirname(repoRoot);
  const tempBase = mkdtempSync(join(tmpdir(), 'youge-symlink-test-'));

  try {
    const repoLink = join(tempBase, 'repo-link');
    const parentLink = join(tempBase, 'parent-link');
    try {
      symlinkSync(repoRoot, repoLink, 'dir');
      symlinkSync(parentDir, parentLink, 'dir');
    } catch (error) {
      if (error && (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOTSUP')) {
        t.skip(`Symlink creation unsupported in this environment: ${error.code}`);
        return;
      }
      throw error;
    }

    for (const unsafeLink of [repoLink, join(repoLink, '.'), parentLink]) {
      assert.throws(
        () => validateOutputDir(unsafeLink),
        /Unsafe output directory/,
        `validateOutputDir must reject symlinked protected path "${unsafeLink}"`,
      );
      assert.throws(
        () => assemblePages({ outputDir: unsafeLink }),
        /Unsafe output directory/,
        `assemblePages must reject symlinked protected path "${unsafeLink}"`,
      );
    }

    // Valid nested nonexistent directory under tempBase must still be allowed
    const validNested = join(tempBase, 'nested', 'site-out');
    assert.equal(validateOutputDir(validNested), resolve(validNested));
  } finally {
    rmSync(tempBase, { recursive: true, force: true });
  }
});
