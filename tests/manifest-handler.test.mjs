import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/domain/domain-config.js';
import '../src/domain/manifest-handler.js';

const { handle } = globalThis.YouGeManifestHandler;

const registry = {
  'staff.you.ge': {
    identity: { name: 'You.Ge Assistant', shortName: 'You.Ge' },
    pwa: { id: '/HIPSBNVemXtM8VMwRfWs', startUrl: '/?launchedfrom=homescreen', scope: '/', basePath: '/' },
  },
  '*.example.com': {
    identity: { name: 'Example Assistant', shortName: 'Example' },
    pwa: { startUrl: './?launchedfrom=homescreen', scope: './', basePath: '/app/' },
  },
};

async function manifestFor(url) {
  const response = await handle(new Request(url), registry);
  return { response, manifest: await response.json() };
}

test('serves validated host-specific manifest content without caching across domains', async () => {
  const { response, manifest } = await manifestFor('https://staff.you.ge/manifest.webmanifest');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/manifest+json; charset=utf-8');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('vary'), 'Host');
  assert.equal(manifest.name, 'You.Ge Assistant');
  assert.equal(manifest.id, '/HIPSBNVemXtM8VMwRfWs');
  assert.equal(manifest.start_url, '/?launchedfrom=homescreen');
});

test('unknown hosts receive safe defaults and their hostname is not reflected in privileged URLs', async () => {
  const { manifest } = await manifestFor('https://random.example.net/manifest.webmanifest');
  assert.equal(manifest.name, 'You.Ge Assistant');
  assert.equal(manifest.id, './');
  assert.equal(manifest.scope, './');
  assert.ok(manifest.icons.every((icon) => !/^https?:/i.test(icon.src)));
});

test('supports deployment subpaths with an in-scope id, start URL, scope, and share target', async () => {
  const { manifest } = await manifestFor('https://team.example.com/app/manifest.webmanifest');
  assert.equal(manifest.name, 'Example Assistant');
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './?launchedfrom=homescreen');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.share_target.action, '/app/share-target');
});

test('rejects non-HTTPS requests except local development', async () => {
  const response = await handle(new Request('http://example.com/manifest.webmanifest'), registry);
  assert.equal(response.status, 400);
  const local = await handle(new Request('http://localhost/manifest.webmanifest'), registry);
  assert.equal(local.status, 200);
});

test('supports HEAD and rejects methods that can mutate state', async () => {
  const head = await handle(new Request('https://example.com/manifest.webmanifest', { method: 'HEAD' }), registry);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const post = await handle(new Request('https://example.com/manifest.webmanifest', { method: 'POST' }), registry);
  assert.equal(post.status, 405);
});

test('rejects a configured manifest scope outside its configured app base path', async () => {
  const badRegistry = {
    'bad.example': { pwa: { basePath: '/app/', scope: '/', startUrl: '/?x' } },
  };
  const response = await handle(new Request('https://bad.example/app/manifest.webmanifest'), badRegistry);
  assert.equal(response.status, 500);
});
