/* Internal recovery foundation. Not an authorization or a navigation API. */

const RECOVERY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const INVALID_CONFIGURATION = Object.freeze({ ok: false, error: 'invalid-configuration' });
const ORIGIN_MISMATCH = Object.freeze({ ok: false, error: 'origin-mismatch' });

function validRecoveryId(value) {
  return typeof value === 'string' && RECOVERY_ID.test(value);
}

function exactHttpsOrigin(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value &&
      !url.username && !url.password && !url.hostname.includes('*') &&
      url.pathname === '/' && !url.search && !url.hash;
  } catch (_) {
    return false;
  }
}

/** Validate trusted host bootstrap, not browser-supplied data. Never infer an environment. */
export function validateRecoveryConfiguration(input, documentOrigin) {
  if (!input || typeof input !== 'object' || !validRecoveryId(input.projectId) ||
      !validRecoveryId(input.activeEnvironmentId) || !Array.isArray(input.environments) ||
      input.environments.length === 0 || input.environments.length > 32) return INVALID_CONFIGURATION;
  const ids = new Set();
  const origins = new Set();
  let selected = null;
  for (const entry of input.environments) {
    if (!entry || typeof entry !== 'object' || entry.projectId !== input.projectId ||
        !validRecoveryId(entry.environmentId) || !validRecoveryId(entry.revision) ||
        ids.has(entry.environmentId) || !exactHttpsOrigin(entry.primaryOrigin) ||
        !exactHttpsOrigin(entry.fallbackOrigin) || origins.has(entry.primaryOrigin) ||
        origins.has(entry.fallbackOrigin) || entry.primaryOrigin === entry.fallbackOrigin) return INVALID_CONFIGURATION;
    ids.add(entry.environmentId);
    origins.add(entry.primaryOrigin);
    origins.add(entry.fallbackOrigin);
    if (entry.environmentId === input.activeEnvironmentId) {
      selected = Object.freeze({ projectId: entry.projectId, environmentId: entry.environmentId,
        revision: entry.revision, primaryOrigin: entry.primaryOrigin, fallbackOrigin: entry.fallbackOrigin });
    }
  }
  if (!selected) return INVALID_CONFIGURATION;
  if (documentOrigin !== selected.primaryOrigin && documentOrigin !== selected.fallbackOrigin) return ORIGIN_MISMATCH;
  return Object.freeze({ ok: true, environment: selected,
    role: documentOrigin === selected.primaryOrigin ? 'primary' : 'fallback' });
}

const POLICY_MAX_AGE_MS = 30000;
const POLICY_CLOCK_TOLERANCE_MS = 250;
const POLICY_UNAVAILABLE = Object.freeze({ ok: false, error: 'policy-unavailable' });

/**
 * Check already-authenticated claims, never authenticate them. The caller must
 * obtain both claims and minimumRevision from the trusted, environment-scoped
 * verifier/authority and record receipt clocks itself, not from persisted data.
 * This internal helper alone must never be used to authorize a transition.
 */
export function inspectVerifiedPolicy(claims, context) {
  if (!claims || !context || typeof claims !== 'object' || typeof context !== 'object') return POLICY_UNAVAILABLE;
  for (const key of ['projectId', 'environmentId', 'configRevision']) {
    if (!validRecoveryId(context[key]) || claims[key] !== context[key]) return POLICY_UNAVAILABLE;
  }
  for (const key of ['issuer', 'audience']) {
    if (typeof context[key] !== 'string' || !context[key] || context[key].length > 512 ||
        context[key].trim() !== context[key] || claims[key] !== context[key]) return POLICY_UNAVAILABLE;
  }
  if ((claims.mode !== 'automatic' && claims.mode !== 'manual') || claims.revoked !== false ||
      !Number.isSafeInteger(claims.revision) || claims.revision < 0 ||
      !Number.isSafeInteger(context.minimumRevision) || context.minimumRevision < 0 ||
      claims.revision < context.minimumRevision) return POLICY_UNAVAILABLE;
  const times = [claims.issuedAt, claims.expiresAt, context.receivedAt, context.receivedMonotonic, context.now, context.monotonicNow];
  if (!times.every(Number.isSafeInteger) || times.some((time) => time < 0)) return POLICY_UNAVAILABLE;
  const wallElapsed = context.now - context.receivedAt;
  const monotonicElapsed = context.monotonicNow - context.receivedMonotonic;
  if (claims.issuedAt > context.receivedAt || claims.issuedAt > context.now ||
      claims.expiresAt <= context.now || claims.expiresAt <= claims.issuedAt ||
      context.now - claims.issuedAt >= POLICY_MAX_AGE_MS || wallElapsed < 0 || monotonicElapsed < 0 ||
      monotonicElapsed > POLICY_MAX_AGE_MS ||
      Math.abs(wallElapsed - monotonicElapsed) > POLICY_CLOCK_TOLERANCE_MS) return POLICY_UNAVAILABLE;
  return Object.freeze({ ok: true, mode: claims.mode, revision: claims.revision,
    receivedAt: context.receivedAt, expiresAt: Math.min(claims.expiresAt, claims.issuedAt + POLICY_MAX_AGE_MS) });
}
