#!/usr/bin/env node
/**
 * Generate a VAPID key pair for Web Push.
 *
 *   node scripts/generate-vapid-keys.mjs
 *   node scripts/generate-vapid-keys.mjs --write
 *
 * --write saves .vapid-keys.json in the current directory without overwriting
 * an existing key file. Add that file to .gitignore and never expose the
 * private key to the browser.
 */

import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const shouldWrite = process.argv.includes('--write');
const target = '.vapid-keys.json';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

const x = Buffer.from(publicJwk.x, 'base64url');
const y = Buffer.from(publicJwk.y, 'base64url');
const d = Buffer.from(privateJwk.d, 'base64url');

// web-push expects the uncompressed EC point (0x04 || X || Y), base64url.
const publicKeyBytes = Buffer.concat([Buffer.from([0x04]), x, y]);
const publicKeyValue = publicKeyBytes.toString('base64url');
const privateKeyValue = d.toString('base64url');

const keys = {
  publicKey: publicKeyValue,
  privateKey: privateKeyValue,
};

if (shouldWrite) {
  try {
    // 'wx' creates the file exclusively, so a concurrent run or existing key
    // pair can never be silently replaced. The mode restricts access to owner.
    writeFileSync(target, JSON.stringify(keys, null, 2) + '\n', {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      console.error(`Refusing to overwrite existing ${target}. Move it aside or remove it explicitly before generating a new key pair.`);
    } else {
      console.error(`Could not write ${target}: ${error && error.message ? error.message : 'unknown file error'}`);
    }
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    // Do not print private key material in write mode: command output is often
    // captured by CI logs or terminal history collectors.
    console.log(`Wrote ${target} (mode 600). Keep the private key server-side.`);
    console.log('VAPID public key (safe to use in the browser):');
    console.log(publicKeyValue);
    console.log('\nEnvironment variables:');
    console.log('VAPID_PUBLIC_KEY=' + publicKeyValue);
    console.log('VAPID_SUBJECT=mailto:admin@example.com  # replace with an address you control');
  }
} else {
  console.log('VAPID public key (safe to use in the browser):\n');
  console.log(publicKeyValue);
  console.log('\nVAPID private key (server only — never commit or ship this):\n');
  console.log(privateKeyValue);
  console.log('\nEnvironment variables:\n');
  console.log('VAPID_PUBLIC_KEY=' + publicKeyValue);
  console.log('VAPID_PRIVATE_KEY=' + privateKeyValue);
  console.log('VAPID_SUBJECT=mailto:admin@example.com  # replace with an address you control');
  console.log('\nTip: pass --write to save them to .vapid-keys.json without printing the private key.');
}
