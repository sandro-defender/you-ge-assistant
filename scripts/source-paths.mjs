import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const PUBLIC_TO_SOURCE = {
  'pwa.js': 'src/runtime/pwa.js',
  'pwa.css': 'src/runtime/pwa.css',
  'you-ge-sw.js': 'src/runtime/you-ge-sw.js',
  'progressier.js': 'src/runtime/progressier.js',
  'assistant-state.js': 'src/assistant/assistant-state.js',
  'assistant-widget.js': 'src/assistant/assistant-widget.js',
  'assistant-widget.css': 'src/assistant/assistant-widget.css',
  'domain-config.js': 'src/domain/domain-config.js',
  'domain-registry.js': 'src/domain/domain-registry.js',
  'dns-diagnostics.js': 'src/domain/dns-diagnostics.js',
  'manifest-handler.js': 'src/domain/manifest-handler.js',
  'offline.html': 'src/offline/offline.html',
  'offline.css': 'src/offline/offline.css',
  'offline.js': 'src/offline/offline.js',
  'qrcode.js': 'src/shared/qrcode.js',
  'browserconfig.xml': 'public/browserconfig.xml',
  'favicon.ico': 'public/favicon.ico',
  'manifest.webmanifest': 'public/manifest.webmanifest',
};

export function resolveSourcePath(rootDir, publicPath) {
  const normalized = publicPath.replace(/^\/+/, '');
  const mapped = PUBLIC_TO_SOURCE[normalized];
  if (mapped) {
    const mappedFull = join(rootDir, mapped);
    if (existsSync(mappedFull)) return mappedFull;
  }
  return join(rootDir, normalized);
}
