#!/usr/bin/env node
/*!
 * scripts/sync-sdk-browser.mjs
 * ----------------------------
 * Deterministically synchronizes the classic browser script `assistant-state.js`
 * from the canonical ESM SDK core in `packages/assistant-sdk/src/`.
 *
 * This guarantees a single source of truth for Assistant state, priority
 * calculation, config validation, Last-Known-Good fallback, diagnostics
 * delegation and installation state across both ESM (`@youge/assistant-sdk`)
 * and classic `<script src="assistant-state.js">` deployments, with zero
 * external bundler dependencies.
 *
 * Usage:
 *   node scripts/sync-sdk-browser.mjs          # write assistant-state.js
 *   node scripts/sync-sdk-browser.mjs --check  # verify assistant-state.js is up to date
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const sdkSrcDir = join(rootDir, 'packages', 'assistant-sdk', 'src');
const targetFile = join(rootDir, 'assistant-state.js');

const SOURCE_MODULES = [
  'core/constants.js',
  'core/sanitize.js',
  'theme/index.js',
  'domain/index.js',
  'config/index.js',
  'diagnostics/index.js',
  'installation/index.js',
  'browser/index.js',
  'assistant/index.js',
];

function stripEsmSyntax(source) {
  return source
    // Remove leading file banner comments from individual modules
    .replace(/^\/\*![\s\S]*?\*\/\s*/m, '')
    // Remove multi-line or single-line static ESM imports
    .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    // Convert exported declarations into module-local declarations inside the IIFE
    .replace(/^\s*export\s+(?=(?:const|let|var|function)\s)/gm, '')
    // Remove any trailing export { ... } blocks if present
    .replace(/^\s*export\s*\{[\s\S]*?\};?\s*$/gm, '')
    .trim();
}

export function buildBrowserStateScript() {
  const sections = SOURCE_MODULES.map((relPath) => {
    const raw = readFileSync(join(sdkSrcDir, relPath), 'utf8');
    return `  /* --- ${relPath} --- */\n\n` +
      stripEsmSyntax(raw)
        .split('\n')
        .map((line) => (line.length ? '  ' + line : ''))
        .join('\n');
  });

  return `/*!
 * assistant-state.js — centralized You.Ge Assistant state model
 * -------------------------------------------------------------
 * Generated from packages/assistant-sdk/src/ via scripts/sync-sdk-browser.mjs.
 * Do not edit by hand; update packages/assistant-sdk/src/ and run:
 *   npm run sync:sdk
 *
 * Single source of truth for the floating assistant widget, React/ESM adapters
 * and project-level consumers. Keeps state calculation separate from DOM
 * rendering, never calls fetch(), never registers a service worker, and never
 * polls on an interval.
 */
(function (root) {
  'use strict';

  if (!root) return;
  if (root.YouGeAssistant && root.YouGeAssistant.__state &&
      (!root.YouGeAssistant.isDestroyed || !root.YouGeAssistant.isDestroyed())) {
    return;
  }

${sections.join('\n\n')}

  var api = attachAssistant(root.YOU_GE_ASSISTANT_CONFIG || {}, {
    root: root,
    useGlobalConfig: true,
  });

  root.YouGeAssistantSDK = {
    version: SDK_VERSION,
    kitCompatVersion: KIT_COMPAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    PRIORITY: PRIORITY,
    EVENT_NAMES: EVENT_NAMES,
    create: createAssistant,
    attach: attachAssistant,
    getGlobal: getGlobalAssistant,
    resolveDomain: resolveDomain,
    detectRuntimeHostname: detectRuntimeHostname,
    buildManifest: buildManifest,
    validateDomainConfig: validateDomainConfig,
    validateDomainConfigDetailed: validateDomainConfigDetailed,
    validateDomainRegistry: validateDomainRegistry,
    domain: createDomainResolver(root.YOU_GE_DOMAIN_REGISTRY || {}),
    validatePublishedConfig: validatePublishedConfig,
    // Adaptive theming — same validation/resolution in classic and ESM pages.
    THEME_MODES: THEME_MODES,
    THEME_TOKEN_KEYS: THEME_TOKEN_KEYS,
    NOTIFICATION_LEVELS: NOTIFICATION_LEVELS,
    NOTIFICATION_LEVEL_ICONS: NOTIFICATION_LEVEL_ICONS,
    NOTIFICATION_LEVEL_SHAPES: NOTIFICATION_LEVEL_SHAPES,
    NOTIFICATION_LEVEL_SVG_ATTRIBUTES: NOTIFICATION_LEVEL_SVG_ATTRIBUTES,
    notificationLevelMarkup: notificationLevelMarkup,
    normalizeNotificationLevel: normalizeNotificationLevel,
    NOTIFICATION_LEVEL_LABELS: NOTIFICATION_LEVEL_LABELS,
    normalizeTheme: normalizeTheme,
    resolveTheme: resolveTheme,
    detectHostScheme: detectHostScheme,
    contrastRatio: contrastRatio,
    detectInAppBrowser: detectInAppBrowser,
    isChromeHandoffCandidate: isChromeHandoffCandidate,
    buildChromeIntentUrl: buildChromeIntentUrl,
    chromeHandoffInstructions: chromeHandoffInstructions,
    createChromeHandoff: createChromeHandoff,
  };

  root.YouGeAssistant = api;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const checkOnly = process.argv.includes('--check');
  const expected = buildBrowserStateScript();
  if (checkOnly) {
    const current = readFileSync(targetFile, 'utf8');
    if (current !== expected) {
      console.error('assistant-state.js is out of sync with packages/assistant-sdk/src/. Run `npm run sync:sdk`.');
      process.exit(1);
    }
    console.log('assistant-state.js is in sync with @youge/assistant-sdk.');
  } else {
    writeFileSync(targetFile, expected, 'utf8');
    console.log('Synchronized assistant-state.js from packages/assistant-sdk/src/.');
  }
}
