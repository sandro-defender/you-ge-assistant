#!/usr/bin/env node
/*!
 * scripts/assemble-pages.mjs
 * --------------------------
 * Shared GitHub Pages site assembly used by both `.github/workflows/pages.yml`
 * and automated Pages assembly tests.
 *
 * Usage:
 *   node scripts/assemble-pages.mjs [--out <dir>] [--base <basePath>]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDist } from './build.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function resolveCanonicalPath(targetPath) {
  const resolved = resolve(targetPath);
  let current = resolved;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const canonicalBase = existsSync(current) ? realpathSync(current) : current;
  const suffix = relative(current, resolved);
  return suffix ? join(canonicalBase, suffix) : canonicalBase;
}

export function validateOutputDir(outputDir) {
  if (typeof outputDir !== 'string' || !outputDir.trim()) {
    throw new Error('Unsafe output directory: outputDir must be a non-empty path.');
  }
  const resolved = resolve(outputDir);
  const canonical = resolveCanonicalPath(resolved);
  const canonicalRoot = resolveCanonicalPath(rootDir);
  const canonicalCwd = resolveCanonicalPath(process.cwd());

  for (const candidate of new Set([resolved, canonical])) {
    const fsRoot = parse(candidate).root;
    if (candidate === fsRoot) {
      throw new Error(`Unsafe output directory: cannot use filesystem root (${candidate}).`);
    }
    if (candidate === canonicalRoot || candidate === rootDir) {
      throw new Error(`Unsafe output directory: cannot use repository root (${candidate}).`);
    }
    if (candidate === canonicalCwd || candidate === resolve(process.cwd())) {
      throw new Error(`Unsafe output directory: cannot use current working directory (${candidate}).`);
    }
    if (canonicalRoot.startsWith(candidate + sep) || rootDir.startsWith(candidate + sep)) {
      throw new Error(`Unsafe output directory: cannot use a parent directory of the repository (${candidate}).`);
    }
  }
  return resolved;
}

export function assemblePages({
  outputDir = join(rootDir, '_site'),
  basePath = process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}` : '/you-ge-assistant',
} = {}) {
  const safeOutputDir = validateOutputDir(outputDir);
  const { outputDir: distDir } = buildDist();

  if (existsSync(safeOutputDir)) {
    rmSync(safeOutputDir, { recursive: true, force: true });
  }
  const exampleOutDir = join(safeOutputDir, 'example');
  mkdirSync(exampleOutDir, { recursive: true });

  // 1. Root feature-test playground
  cpSync(distDir, safeOutputDir, { recursive: true });
  cpSync(join(rootDir, 'examples/demo/index.html'), join(safeOutputDir, 'index.html'));
  cpSync(join(rootDir, 'examples/demo/manifest.webmanifest'), join(safeOutputDir, 'manifest.webmanifest'));

  // 2. Independent /example/ PWA
  const exampleDistDir = join(rootDir, 'examples/example/dist');
  if (!existsSync(exampleDistDir)) {
    throw new Error('Missing examples/example/dist — run `npm run build` in examples/example first.');
  }
  cpSync(distDir, exampleOutDir, { recursive: true });
  cpSync(exampleDistDir, exampleOutDir, { recursive: true });
  for (const file of ['example.js', 'manifest.webmanifest', 'THIRD_PARTY_NOTICES.md']) {
    cpSync(join(rootDir, 'examples/example', file), join(exampleOutDir, file));
  }

  // Shared product chrome is copied to both scopes; the Vite public dir supplies /example/.
  for (const file of ['product.css', 'product.js', 'assistant-symbol.svg', 'integration-preview.svg']) {
    cpSync(join(rootDir, 'examples/example/public', file), join(safeOutputDir, file));
  }

  // 3. Independent SDK-only consumer experience at /sdk-demo/.
  const sdkDemoDistDir = join(rootDir, 'examples/sdk-demo/dist');
  if (!existsSync(sdkDemoDistDir)) {
    throw new Error('Missing examples/sdk-demo/dist — run `npm ci && npm run build` in examples/sdk-demo first.');
  }
  cpSync(sdkDemoDistDir, join(safeOutputDir, 'sdk-demo'), { recursive: true });

  // 4. Scope-specific browserconfig.xml tile paths
  const normalizedBase = basePath.replace(/\/+$/, '');
  const rootBrowserConfigPath = join(safeOutputDir, 'browserconfig.xml');
  writeFileSync(
    rootBrowserConfigPath,
    readFileSync(rootBrowserConfigPath, 'utf8').replaceAll('src="/icons/', `src="${normalizedBase}/icons/`),
  );
  const exampleBrowserConfigPath = join(exampleOutDir, 'browserconfig.xml');
  writeFileSync(
    exampleBrowserConfigPath,
    readFileSync(exampleBrowserConfigPath, 'utf8').replaceAll('src="/icons/', `src="${normalizedBase}/example/icons/`),
  );

  // 4. Example-specific offline fallback branding
  const exampleOfflinePath = join(exampleOutDir, 'offline.html');
  writeFileSync(
    exampleOfflinePath,
    readFileSync(exampleOfflinePath, 'utf8').replace(
      'data-default-app-name="You.Ge Assistant"',
      'data-default-app-name="Staff Space"',
    ),
  );

  // 5. Disable Jekyll processing
  writeFileSync(join(safeOutputDir, '.nojekyll'), '');

  return { outputDir: safeOutputDir, exampleOutDir, basePath: normalizedBase };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const baseIdx = args.indexOf('--base');
  const result = assemblePages({
    outputDir: outIdx !== -1 && args[outIdx + 1] ? resolve(args[outIdx + 1]) : undefined,
    basePath: baseIdx !== -1 && args[baseIdx + 1] ? args[baseIdx + 1] : undefined,
  });
  console.log(`Assembled GitHub Pages site into ${result.outputDir} (base: ${result.basePath})`);
}
