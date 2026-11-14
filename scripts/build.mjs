#!/usr/bin/env node
/*!
 * scripts/build.mjs
 * -----------------
 * Assembles the public deployment output in `dist/` from organized source
 * directories (`src/`, `public/`, `icons/`).
 *
 * Preserves all existing root-level public URLs:
 *   /pwa.js, /pwa.css, /you-ge-sw.js, /progressier.js
 *   /assistant-state.js, /assistant-widget.js, /assistant-widget.css
 *   /domain-config.js, /domain-registry.js, /dns-diagnostics.js, /manifest-handler.js
 *   /offline.html, /offline.css, /offline.js
 *   /qrcode.js
 *   /browserconfig.xml, /favicon.ico, /manifest.webmanifest
 *   /icons/*
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(rootDir, 'dist');

const FILE_MAPPINGS = [
  // Runtime core & service worker
  ['src/runtime/pwa.js', 'pwa.js'],
  ['src/runtime/pwa.css', 'pwa.css'],
  ['src/runtime/you-ge-sw.js', 'you-ge-sw.js'],
  ['src/runtime/progressier.js', 'progressier.js'],

  // Assistant widget & generated state
  ['src/assistant/assistant-state.js', 'assistant-state.js'],
  ['src/assistant/assistant-widget.js', 'assistant-widget.js'],
  ['src/assistant/assistant-widget.css', 'assistant-widget.css'],

  // Domain & manifest
  ['src/domain/domain-config.js', 'domain-config.js'],
  ['src/domain/domain-registry.js', 'domain-registry.js'],
  ['src/domain/dns-diagnostics.js', 'dns-diagnostics.js'],
  ['src/domain/manifest-handler.js', 'manifest-handler.js'],

  // Offline fallback
  ['src/offline/offline.html', 'offline.html'],
  ['src/offline/offline.css', 'offline.css'],
  ['src/offline/offline.js', 'offline.js'],

  // Shared utilities
  ['src/shared/qrcode.js', 'qrcode.js'],

  // Public static assets
  ['public/browserconfig.xml', 'browserconfig.xml'],
  ['public/favicon.ico', 'favicon.ico'],
  ['public/manifest.webmanifest', 'manifest.webmanifest'],
];

export function buildDist(targetDir = distDir) {
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }
  mkdirSync(targetDir, { recursive: true });

  for (const [srcRel, destRel] of FILE_MAPPINGS) {
    const srcPath = join(rootDir, srcRel);
    const destPath = join(targetDir, destRel);
    if (!existsSync(srcPath)) {
      throw new Error(`Missing source file: ${srcRel}`);
    }
    cpSync(srcPath, destPath);
  }

  const iconsSrc = join(rootDir, 'icons');
  const iconsDest = join(targetDir, 'icons');
  if (!existsSync(iconsSrc)) {
    throw new Error('Missing icons directory: icons/');
  }
  cpSync(iconsSrc, iconsDest, { recursive: true });

  return {
    outputDir: targetDir,
    fileCount: FILE_MAPPINGS.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = buildDist();
  console.log(`Built ${result.fileCount} runtime/public files + icons/ into ${result.outputDir}`);
}
