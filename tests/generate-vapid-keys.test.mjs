import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/generate-vapid-keys.mjs', import.meta.url));

function runGenerator(directory, ...args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    encoding: 'utf8',
  });
}

test('writing VAPID keys creates a private file without printing the private key', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'you-ge-vapid-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const result = runGenerator(directory, '--write');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /VAPID public key/);
  assert.match(result.stdout, /Wrote \.vapid-keys\.json/);
  assert.doesNotMatch(result.stdout, /VAPID_PRIVATE_KEY|VAPID private key/);

  const keyFile = join(directory, '.vapid-keys.json');
  const keys = JSON.parse(readFileSync(keyFile, 'utf8'));
  assert.match(keys.publicKey, /^[A-Za-z0-9_-]+$/);
  assert.match(keys.privateKey, /^[A-Za-z0-9_-]+$/);
  assert.equal(statSync(keyFile).mode & 0o777, 0o600);
});

test('writing VAPID keys refuses to overwrite an existing key file', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'you-ge-vapid-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const keyFile = join(directory, '.vapid-keys.json');
  const original = '{"keep":"existing keys"}\n';
  writeFileSync(keyFile, original, { mode: 0o600 });

  const result = runGenerator(directory, '--write');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to overwrite existing/i);
  assert.equal(readFileSync(keyFile, 'utf8'), original);
  assert.doesNotMatch(result.stdout, /VAPID_PRIVATE_KEY|VAPID private key/);
});
