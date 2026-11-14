/*!
 * @youge/assistant-sdk/adapters/pwa-kit — You.Ge Assistant window.PWA adapter
 * ---------------------------------------------------------------------------
 * Connects the SDK domain resolver and Assistant state cleanly to a host page
 * that also loads pwa.js / progressier.js / dns-diagnostics.js, without
 * overwriting active globals or registering any service worker.
 */

import { SDK_VERSION } from '../core/constants.js';
import { createDomainResolver } from '../domain/index.js';
import { deriveInstallationState } from '../installation/index.js';
import { attachAssistant } from '../assistant/index.js';

export function bridgePwaGlobals(options) {
  const opts = options || {};
  const root = opts.root || opts.window || (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!root) return { bridged: false, assistant: null, domain: null };

  if (opts.domainRegistry && typeof opts.domainRegistry === 'object') {
    root.YOU_GE_DOMAIN_REGISTRY = Object.assign(
      {},
      root.YOU_GE_DOMAIN_REGISTRY || {},
      opts.domainRegistry
    );
  }

  if (!root.YouGeDomain) {
    root.YouGeDomain = createDomainResolver(root.YOU_GE_DOMAIN_REGISTRY || {});
  }

  const assistant = opts.attach !== false
    ? attachAssistant(opts.assistantConfig || {}, { root: root })
    : null;

  if (!root.YouGeAssistantSDK) {
    root.YouGeAssistantSDK = {
      version: SDK_VERSION,
      domain: root.YouGeDomain,
      attach: function (cfg) { return attachAssistant(cfg, { root: root }); },
    };
  }

  return {
    bridged: true,
    assistant: assistant,
    domain: root.YouGeDomain,
  };
}

export function readToolkitSummary(targetRoot) {
  const root = targetRoot || (typeof globalThis !== 'undefined' ? globalThis : {});
  const pwa = root.PWA || null;
  const assistant = root.YouGeAssistant && root.YouGeAssistant.__state ? root.YouGeAssistant : null;
  const state = assistant && typeof assistant.getState === 'function' ? assistant.getState() : null;
  const installation = state && state.installation
    ? state.installation
    : deriveInstallationState({ pwa: pwa, enabled: true });

  return {
    hasPwaToolkit: Boolean(pwa && pwa.__pwaKit),
    hasAssistantState: Boolean(assistant),
    pwaVersion: pwa && pwa.version ? String(pwa.version) : null,
    sdkVersion: (assistant && assistant.version) ? String(assistant.version) : SDK_VERSION,
    origin: (state && state.project && state.project.origin) || (root.location && root.location.origin) || 'https://localhost',
    hostname: (state && state.project && state.project.hostname) || (root.location && root.location.hostname) || 'localhost',
    installation: installation,
  };
}
