import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecoveryConfiguration } from '../src/recovery/foundation.js';

const config = () => ({
  projectId: 'project', activeEnvironmentId: 'production',
  environments: [
    { projectId: 'project', environmentId: 'production', revision: 'r1', primaryOrigin: 'https://primary.example', fallbackOrigin: 'https://fallback.example' },
    { projectId: 'project', environmentId: 'preview', revision: 'r2', primaryOrigin: 'https://preview.example', fallbackOrigin: 'https://preview-backup.example' },
  ],
});

test('recovery configuration selects only an exact configured environment and document origin', () => {
  const result = validateRecoveryConfiguration(config(), 'https://primary.example');
  assert.equal(result.ok, true);
  assert.equal(result.environment.environmentId, 'production');
  assert.equal(result.role, 'primary');
  assert.equal(validateRecoveryConfiguration(config(), 'https://fallback.example').role, 'fallback');
  assert.equal(validateRecoveryConfiguration(config(), 'https://preview.example').ok, false);
  assert.equal(validateRecoveryConfiguration(config(), 'https://primary.example:444').ok, false);
});

test('recovery rejects unsafe, ambiguous, non-HTTPS and non-origin addresses', () => {
  for (const origin of ['http://primary.example', 'https://user:pass@primary.example', 'https://primary.example/path', 'https://primary.example/?token=x', 'https://primary.example/#x', 'https://*.example', 'https://primary.example/', 'https://PRIMARY.example', 'https://primary.example:443', 'null']) {
    const input = config(); input.environments[0].primaryOrigin = origin;
    assert.equal(validateRecoveryConfiguration(input, 'https://primary.example').ok, false, origin);
  }
  const duplicate = config(); duplicate.environments[1].fallbackOrigin = duplicate.environments[0].primaryOrigin;
  assert.equal(validateRecoveryConfiguration(duplicate, 'https://primary.example').ok, false);
  const same = config(); same.environments[0].fallbackOrigin = same.environments[0].primaryOrigin;
  assert.equal(validateRecoveryConfiguration(same, 'https://primary.example').ok, false);
  const wrongProject = config(); wrongProject.environments[1].projectId = 'different';
  assert.equal(validateRecoveryConfiguration(wrongProject, 'https://primary.example').ok, false);
});

test('validated configuration is detached and immutable', () => {
  const input = config(); const result = validateRecoveryConfiguration(input, 'https://primary.example');
  input.environments[0].primaryOrigin = 'https://attacker.example';
  assert.equal(result.environment.primaryOrigin, 'https://primary.example');
  assert.ok(Object.isFrozen(result.environment));
  assert.ok(Object.isFrozen(result));
});
