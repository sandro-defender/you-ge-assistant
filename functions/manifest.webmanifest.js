// Cloudflare Pages Functions adapter. Deploy this alongside the static files
// to return a fresh, validated manifest for the requested origin.
import '../src/domain/domain-registry.js';
import '../src/domain/domain-config.js';
import '../src/domain/manifest-handler.js';

export async function onRequest({ request }) {
  return globalThis.YouGeManifestHandler.handle(request);
}
