import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectVerifiedPolicy } from '../src/recovery/foundation.js';

const now = 1_800_000_000_000;
const claims = () => ({ projectId: 'project', environmentId: 'production', configRevision: 'r1', issuer: 'authority', audience: 'production', mode: 'automatic', revision: 10, issuedAt: now - 1000, expiresAt: now + 10000, revoked: false });
const context = () => ({ projectId: 'project', environmentId: 'production', configRevision: 'r1', issuer: 'authority', audience: 'production', minimumRevision: 10, receivedAt: now, receivedMonotonic: 500, now, monotonicNow: 500 });

test('verified policy metadata is accepted only with a fresh scope-bound checkpoint', () => {
  const result = inspectVerifiedPolicy(claims(), context());
  assert.deepEqual(result, { ok: true, mode: 'automatic', revision: 10, receivedAt: now, expiresAt: now + 10000 });
  assert.ok(Object.isFrozen(result));
  const manual = claims(); manual.mode = 'manual';
  assert.equal(inspectVerifiedPolicy(manual, context()).mode, 'manual');
});

test('rejects missing or wrong environment, authority, audience, configuration and revision', () => {
  for (const [key, value] of [['projectId', 'other'], ['environmentId', 'preview'], ['configRevision', 'old'], ['issuer', 'other'], ['audience', 'preview'], ['mode', 'local'], ['revision', 9], ['revision', 10.5], ['revoked', true]]) {
    const c = claims(); c[key] = value;
    assert.equal(inspectVerifiedPolicy(c, context()).ok, false, key);
  }
  const noCheckpoint = context(); delete noCheckpoint.minimumRevision;
  assert.equal(inspectVerifiedPolicy(claims(), noCheckpoint).ok, false);
});

test('rejects stale, expired, future and inconsistent or rolled-back clocks', () => {
  const stale = claims(); stale.issuedAt = now - 30001;
  assert.equal(inspectVerifiedPolicy(stale, context()).ok, false);
  stale.issuedAt = now - 30000;
  assert.equal(inspectVerifiedPolicy(stale, context()).ok, false);
  const expiry = claims(); expiry.expiresAt = now;
  assert.equal(inspectVerifiedPolicy(expiry, context()).ok, false);
  const future = claims(); future.issuedAt = now + 1;
  assert.equal(inspectVerifiedPolicy(future, context()).ok, false);
  const backwards = context(); backwards.monotonicNow = 499;
  assert.equal(inspectVerifiedPolicy(claims(), backwards).ok, false);
  const shifted = context(); shifted.monotonicNow = 1000;
  assert.equal(inspectVerifiedPolicy(claims(), shifted).ok, false);
  const ancientReceipt = context(); ancientReceipt.receivedAt = now - 30001; ancientReceipt.receivedMonotonic = 0; ancientReceipt.monotonicNow = 30001;
  assert.equal(inspectVerifiedPolicy(claims(), ancientReceipt).ok, false);
});
