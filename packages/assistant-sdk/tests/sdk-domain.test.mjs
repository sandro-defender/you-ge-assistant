import assert from 'node:assert/strict';
import test from 'node:test';
import {
  YouGeAssistant,
  buildManifest,
  createDomainResolver,
  detectRuntimeHostname,
  lkgStorageKey,
  normalizeHost,
  normalizePath,
  resolveDomain,
  rootDomain,
  safeNavigationUrl,
  validateDomainConfigDetailed,
  validateDomainRegistry,
} from '../src/index.js';
import * as SDK from '../src/index.js';

function makeStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    _map: map,
  };
}

test('supports multiple isolated project and domain configurations simultaneously', () => {
  const sharedStorage = makeStorage();
  const registry = {
    'alpha.example.com': {
      identity: { name: 'Alpha Workspace', shortName: 'Alpha' },
      branding: { themeColor: '#1d4ed8', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/', scope: '/', startUrl: '/?home=1', id: '/alpha-id' },
    },
    '*.beta.example.org/app/': {
      identity: { name: 'Beta Subpath App', shortName: 'Beta' },
      branding: { themeColor: '#047857', icon: 'icons/icon-192.png' },
      pwa: { basePath: '/app/', scope: './', startUrl: './?home=1', id: './' },
    },
  };

  const alpha = YouGeAssistant.create({
    projectId: 'proj-alpha',
    domain: 'alpha.example.com',
    domainRegistry: registry,
    features: [{ id: 'welcome', label: 'Alpha release' }],
    storage: sharedStorage,
    bindEvents: false,
  });

  const beta = YouGeAssistant.create({
    projectId: 'proj-beta',
    location: {
      hostname: 'team.beta.example.org',
      origin: 'https://team.beta.example.org',
      protocol: 'https:',
      pathname: '/app/dashboard',
    },
    domainRegistry: registry,
    features: [{ id: 'welcome', label: 'Beta release' }],
    storage: sharedStorage,
    bindEvents: false,
  });

  assert.equal(alpha.getState().project.name, 'Alpha Workspace');
  assert.equal(alpha.getState().project.id, 'proj-alpha', 'legacy projectId remains supported');
  assert.equal(alpha.getState().project.projectIdSource, 'projectId');
  assert.equal(alpha.getConfig().projectId, 'proj-alpha');
  assert.equal(alpha.getState().project.hostname, 'alpha.example.com');
  assert.equal(alpha.getState().project.configured, true);
  assert.equal(alpha.getState().appearance.themeColor, '#1d4ed8');

  assert.equal(beta.getState().project.name, 'Beta Subpath App');
  assert.equal(beta.getState().project.hostname, 'team.beta.example.org');
  assert.equal(beta.getState().project.basePath, '/app/');
  assert.equal(beta.getState().project.configured, true);
  assert.equal(beta.getState().appearance.themeColor, '#047857');

  // Dismissing a notice in alpha never suppresses notices in beta.
  assert.equal(alpha.dismiss('feature:welcome'), true);
  assert.equal(alpha.getState().notifications.length, 0);
  assert.equal(beta.getState().notifications.length, 1);

  alpha.destroy();
  beta.destroy();
});

test('treats unknown or arbitrary hostnames as unconfigured and never as authentication', () => {
  const registry = {
    'verified.example.com': {
      identity: { name: 'Verified App' },
      branding: { themeColor: '#111827' },
    },
  };

  const unknown = YouGeAssistant.create({
    domain: 'untrusted-host.invalid',
    domainRegistry: registry,
    bindEvents: false,
  });

  const state = unknown.getState();
  assert.equal(state.project.hostname, 'untrusted-host.invalid');
  assert.equal(state.project.configured, false, 'arbitrary host is never marked configured');
  assert.equal(state.project.name, 'You.Ge Assistant', 'receives neutral default identity');
  assert.equal(state.network.session.state, 'unknown', 'domain detection never implies an authenticated session');
  assert.equal('authenticated' in state.project, false);
  assert.equal('trusted' in state.project, false);

  unknown.destroy();
});

test('resolves exact host before wildcard, enforces path traversal checks, and builds scoped manifests', () => {
  const resolver = createDomainResolver({
    '*.example.co.uk': { identity: { name: 'Wildcard UK' } },
    'portal.example.co.uk': {
      identity: { name: 'Exact Portal UK', shortName: 'Portal' },
      pwa: { basePath: '/workspace/', scope: './', startUrl: './?launch=1', id: './' },
      shortcuts: [
        { name: 'Valid Shortcut', url: './tasks' },
        { name: 'Escaped Root', url: '/admin' },
        { name: 'Cross Origin', url: 'https://evil.example/phish' },
      ],
    },
  });

  assert.equal(normalizeHost('PORTAL.EXAMPLE.CO.UK.'), 'portal.example.co.uk');
  assert.equal(rootDomain('portal.example.co.uk'), 'example.co.uk');
  assert.equal(normalizePath('/workspace/../etc', '/'), null);

  const resolved = resolver.resolve({
    hostname: 'portal.example.co.uk',
    origin: 'https://portal.example.co.uk',
    protocol: 'https:',
    pathname: '/workspace/home',
  });
  assert.equal(resolved.identity.name, 'Exact Portal UK');
  assert.equal(resolved.domain.subdomain, 'portal');
  assert.equal(resolved.domain.basePath, '/workspace/');

  const manifest = buildManifest(resolved);
  assert.equal(manifest.name, 'Exact Portal UK');
  assert.equal(manifest.share_target.action, '/workspace/share-target');
  assert.deepEqual(manifest.shortcuts.map((s) => s.name), ['Valid Shortcut']);
});

test('normalizes runtime host inputs including URLs, ports, localhost and IP literals', () => {
  assert.equal(normalizeHost(' HTTPS://Portal.Example.COM.:8443/app?q=1 '), 'portal.example.com');
  assert.equal(normalizeHost('PORTAL.EXAMPLE.COM.:8443'), 'portal.example.com');
  assert.equal(normalizeHost('localhost:5173'), 'localhost');
  assert.equal(normalizeHost('127.0.0.1:4173'), '127.0.0.1');
  assert.equal(normalizeHost('[::1]:8080'), '[::1]');
  assert.equal(normalizeHost('::1'), '[::1]');
  assert.equal(normalizeHost('not a hostname'), '');
  assert.equal(normalizeHost('javascript:alert(1)'), '');
});

test('detects a hostname from browser-like locations or full development URLs', () => {
  assert.equal(detectRuntimeHostname({
    hostname: 'PORTAL.Example.COM.',
    origin: 'https://portal.example.com.',
  }), 'portal.example.com');
  assert.equal(detectRuntimeHostname({ href: 'http://localhost:5173/preview/' }), 'localhost');
  assert.equal(detectRuntimeHostname('https://[::1]:5173/app/'), '[::1]');
  assert.equal(detectRuntimeHostname({ host: '127.0.0.1:4173' }), '127.0.0.1');
});

test('resolves complete local-development URLs with ports and path-scoped IP configuration', () => {
  const resolved = resolveDomain('http://127.0.0.1:5173/portal/tasks', {
    '127.0.0.1/portal/': {
      identity: { name: 'Local Portal', shortName: 'Local' },
      pwa: { basePath: '/portal/', scope: './', startUrl: './' },
    },
  });
  assert.equal(resolved.domain.hostname, '127.0.0.1');
  assert.equal(resolved.domain.origin, 'http://127.0.0.1:5173');
  assert.equal(resolved.domain.protocol, 'http:');
  assert.equal(resolved.domain.pathname, '/portal/tasks');
  assert.equal(resolved.domain.basePath, '/portal/');
  assert.equal(resolved.identity.name, 'Local Portal');

  const ipv6 = resolveDomain('http://[::1]:8080/dev/', {
    '[::1]': { identity: { name: 'IPv6 Dev' } },
  });
  assert.equal(ipv6.domain.hostname, '[::1]');
  assert.equal(ipv6.domain.origin, 'http://[::1]:8080');
  assert.equal(ipv6.identity.name, 'IPv6 Dev');
});

test('Assistant resolves a URL-string location consistently with browser Location objects', () => {
  const assistant = YouGeAssistant.create({
    location: 'http://127.0.0.1:5173/portal/tasks',
    domainRegistry: {
      '127.0.0.1/portal/': {
        project: { id: 'local-portal' },
        identity: { name: 'Local Portal' },
        pwa: { basePath: '/portal/' },
      },
    },
    bindEvents: false,
  });
  const project = assistant.getState().project;
  assert.equal(project.hostname, '127.0.0.1');
  assert.equal(project.detectedHostname, '127.0.0.1');
  assert.equal(project.origin, 'http://127.0.0.1:5173');
  assert.equal(project.basePath, '/portal/');
  assert.equal(project.id, 'local-portal');
  assistant.destroy();
});

test('detailed domain validation reports actionable issues and keeps safe normalized defaults', () => {
  const result = validateDomainConfigDetailed({
    branding: { themeColor: 'not-a-color' },
    pwa: { basePath: '/../escape/', startUrl: 'javascript:alert(1)' },
  });
  assert.equal(result.valid, false);
  assert.equal(result.config.branding.themeColor, '#155eef');
  assert.equal(result.config.pwa.startUrl, './');
  assert.ok(result.issues.some((issue) => issue.code === 'invalid_theme_color' && issue.path === 'branding.themeColor'));
  assert.ok(result.issues.some((issue) => issue.code === 'invalid_base_path' && issue.path === 'pwa.basePath'));
  assert.ok(result.issues.some((issue) => issue.code === 'unsafe_start_url' && issue.path === 'pwa.startUrl'));
  for (const issue of result.issues) {
    assert.equal(typeof issue.message, 'string');
    assert.ok(issue.message.length > 0);
  }
  const longProjectId = validateDomainConfigDetailed({ project: { id: 'x'.repeat(81) } });
  assert.equal(longProjectId.valid, false);
  assert.ok(longProjectId.issues.some((issue) => issue.code === 'invalid_project_id'));
  assert.equal(longProjectId.config.project.id.length, 80, 'normalization remains safe and bounded');
});

test('registry validation normalizes keys, reports collisions and skips invalid entries', () => {
  const result = validateDomainRegistry({
    'PORTAL.Example.COM.': { identity: { name: 'Portal' } },
    'portal.example.com:443': { identity: { name: 'Duplicate' } },
    'bad host/path': { identity: { name: 'Invalid' } },
    'portal.example.com/../admin/': { identity: { name: 'Traversal' } },
  });
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.registry), ['portal.example.com']);
  assert.ok(result.issues.some((issue) => issue.code === 'duplicate_registry_key'));
  assert.ok(result.issues.some((issue) => issue.code === 'invalid_registry_key'));
  assert.ok(result.issues.some((issue) => issue.code === 'invalid_registry_path'));
});

test('registry matching uses a stable lexical tie-break and malformed registry access fails closed', () => {
  const upperFirst = {
    '*.EXAMPLE.COM.': { identity: { name: 'Upper alias' } },
    '*.example.com': { identity: { name: 'Lower alias' } },
  };
  const lowerFirst = {
    '*.example.com': { identity: { name: 'Lower alias' } },
    '*.EXAMPLE.COM.': { identity: { name: 'Upper alias' } },
  };
  const upper = resolveDomain('https://team.example.com/', upperFirst);
  const lower = resolveDomain('https://team.example.com/', lowerFirst);
  assert.equal(upper.identity.name, 'Upper alias');
  assert.equal(lower.identity.name, 'Upper alias');

  const throwingEntry = Object.defineProperty({}, 'portal.example.com', {
    enumerable: true,
    get() { throw new Error('unreadable registry entry'); },
  });
  assert.doesNotThrow(() => resolveDomain('https://portal.example.com/', throwingEntry));
  assert.equal(resolveDomain('https://portal.example.com/', throwingEntry).domain.configured, false);
  const checked = validateDomainRegistry(throwingEntry);
  assert.equal(checked.valid, false);
  assert.ok(checked.issues.some((issue) => issue.code === 'invalid_domain_config'));

  const brokenKeys = new Proxy({}, { ownKeys() { throw new Error('unreadable registry'); } });
  assert.doesNotThrow(() => resolveDomain('https://portal.example.com/', brokenKeys));
  assert.equal(validateDomainRegistry(brokenKeys).valid, false);
  assert.doesNotThrow(() => createDomainResolver(brokenKeys));

  const brokenLocation = new Proxy({}, { get() { throw new Error('unreadable location'); } });
  assert.equal(detectRuntimeHostname(brokenLocation), '');
  assert.doesNotThrow(() => resolveDomain(brokenLocation, {}));
  assert.equal(resolveDomain(brokenLocation, {}).domain.hostname, 'localhost');
});

test('resolved domain config exposes validation feedback without changing safe fallback behavior', () => {
  const resolved = resolveDomain({ hostname: 'portal.example.com', origin: 'https://portal.example.com' }, {
    'portal.example.com': { branding: { themeColor: 'nope' } },
  });
  assert.equal(resolved.domain.validation.valid, false);
  assert.ok(resolved.domain.validation.issues.some((issue) => issue.path === 'branding.themeColor'));
  assert.equal(resolved.branding.themeColor, '#155eef');
});

test('domain entries map exact/path and wildcard host aliases to deterministic project IDs', () => {
  const registry = {
    '*.example.com': { project: { id: 'wildcard-project' } },
    'portal.example.com': { project: { id: 'exact-project' } },
    'portal.example.com/app/': { project: { id: 'path-project' } },
  };
  const pathMatch = resolveDomain('https://portal.example.com/app/tasks', registry);
  assert.equal(pathMatch.project.id, 'path-project');
  assert.equal(pathMatch.domain.projectId, 'path-project');
  assert.equal(pathMatch.domain.matchedRegistryKey, 'portal.example.com/app/');

  const wildcardMatch = resolveDomain('https://team.ops.example.com/', registry);
  assert.equal(wildcardMatch.project.id, 'wildcard-project');
  assert.equal(wildcardMatch.domain.projectId, 'wildcard-project');
  assert.equal(wildcardMatch.domain.subdomain, 'team.ops');
  assert.equal(wildcardMatch.domain.rootDomain, 'example.com');
});

test('explicit project identity outranks the legacy alias and mapped registry project', () => {
  const assistant = YouGeAssistant.create({
    project: { id: 'typed-project' },
    projectId: 'legacy-project',
    domain: 'service.example.net',
    domainRegistry: {
      'service.example.net': { project: { id: 'registry-project' } },
    },
    location: {
      hostname: 'Portal.Example.COM.',
      origin: 'https://portal.example.com',
      protocol: 'https:',
      pathname: '/work',
    },
    bindEvents: false,
  });
  const state = assistant.getState();
  assert.equal(state.project.id, 'typed-project');
  assert.equal(state.project.projectIdSource, 'project');
  assert.equal(state.project.detectedHostname, 'portal.example.com');
  assert.equal(state.project.hostname, 'service.example.net', 'legacy domain override remains the resolved host');
  assert.equal(state.project.matchedRegistryKey, 'service.example.net');
  assert.equal(state.project.domainValidation.valid, true);
  assert.deepEqual(assistant.getConfig().project, { id: 'typed-project' });
  assert.equal(assistant.getConfig().projectId, 'legacy-project');
  assert.ok(assistant.getConfig().meta.warnings.includes('project_id_conflict'));
  assistant.destroy();
});

test('invalid typed project IDs warn and fall through to the matched registry project', () => {
  const assistant = YouGeAssistant.create({
    project: { id: 'x'.repeat(81) },
    location: { hostname: 'portal.example.net', origin: 'https://portal.example.net', pathname: '/' },
    domainRegistry: { 'portal.example.net': { project: { id: 'registry-project' } } },
    bindEvents: false,
  });
  assert.equal(assistant.getState().project.id, 'registry-project');
  assert.equal(assistant.getState().project.projectIdSource, 'domainRegistry');
  assert.ok(assistant.getConfig().meta.warnings.includes('invalid_project_config'));
  assistant.destroy();
});

test('configured project updates emit snapshots and isolate persisted notice state', () => {
  const storage = makeStorage();
  const assistant = YouGeAssistant.create({
    location: {
      hostname: 'alpha.example.com',
      origin: 'https://alpha.example.com',
      protocol: 'https:',
      pathname: '/',
    },
    domainRegistry: {
      'alpha.example.com': { project: { id: 'alpha' } },
      'beta.example.net': { project: { id: 'beta' } },
    },
    features: [{ id: 'welcome', label: 'Welcome' }],
    storage,
    bindEvents: false,
  });
  const transitions = [];
  const unsubscribe = assistant.subscribe((state) => transitions.push(state.project.id), { immediate: false });

  assert.equal(assistant.getState().project.id, 'alpha');
  assert.equal(assistant.getState().project.projectIdSource, 'domainRegistry');
  assert.equal(assistant.dismiss('feature:welcome'), true);
  assert.ok(storage.getItem('youge-assistant:notices:alpha'));
  assert.equal(assistant.getState().notifications.length, 0);

  assistant.configure({ domain: 'beta.example.net' });
  assert.equal(assistant.getState().project.id, 'beta');
  assert.equal(assistant.getState().project.detectedHostname, 'alpha.example.com');
  assert.equal(assistant.getState().notifications.some((item) => item.id === 'feature:welcome'), true);

  assistant.configure({ project: { id: 'explicit-beta' } });
  assert.equal(assistant.getState().project.id, 'explicit-beta');
  assert.equal(assistant.getState().project.projectIdSource, 'project');
  assistant.configure({ project: null, domain: 'alpha.example.com' });
  assert.equal(assistant.getState().project.id, 'alpha');
  assert.equal(assistant.getState().notifications.some((item) => item.id === 'feature:welcome'), false);
  assert.deepEqual(transitions, ['alpha', 'beta', 'explicit-beta', 'alpha']);

  unsubscribe();
  assistant.destroy();
});

test('registry-derived project identity can load its own Last-Known-Good config on first attach', () => {
  const storage = makeStorage();
  storage.setItem(lkgStorageKey('customer-project'), JSON.stringify({
    schemaVersion: 1,
    revision: 'registry-lkg',
    projectId: 'customer-project',
    config: { position: 'top-left' },
  }));
  const assistant = YouGeAssistant.create({
    location: {
      hostname: 'portal.customer.example',
      origin: 'https://portal.customer.example',
      protocol: 'https:',
      pathname: '/',
    },
    domainRegistry: {
      'portal.customer.example': { project: { id: 'customer-project' } },
    },
    publishedConfig: { schemaVersion: 99 },
    storage,
    bindEvents: false,
  });

  assert.equal(assistant.getState().project.id, 'customer-project');
  assert.equal(assistant.getConfig().meta.source, 'last-known-good');
  assert.equal(assistant.getConfig().meta.revision, 'registry-lkg');
  assert.equal(assistant.getConfig().position, 'top-left');
  assistant.destroy();
});

/* ------------------------------------------------------------------ *
 * Audit regressions (2026-11): navigation targets taken from push
 * payloads, manifest shortcuts or host attributes must be validated
 * before they reach an <a href>, client.navigate() or openWindow().
 * ------------------------------------------------------------------ */

const emptyResolver = createDomainResolver({});

function resolveUrl(value) {
  return safeNavigationUrl(value, '/');
}

test('the navigation guard is reachable from the root and the ./domain subpath', () => {
  assert.equal(typeof SDK.safeNavigationUrl, 'function');
  assert.equal(SDK.safeNavigationUrl, safeNavigationUrl);
  assert.equal(typeof emptyResolver.safeNavigationUrl, 'function');
  assert.equal(emptyResolver.safeNavigationUrl('javascript:alert(1)', '/fallback'), '/fallback');
});

test('same-document paths pass through untouched', () => {
  for (const path of ['/inbox', '/inbox?tab=alerts', 'settings/notifications', './help', '#top']) {
    assert.equal(resolveUrl(path), path, `${JSON.stringify(path)} is already safe`);
  }
});

test('absolute URLs are only kept when they are http(s)', () => {
  assert.equal(
    resolveUrl('https://app.example.test/checkout?utm=1'),
    'https://app.example.test/checkout?utm=1',
  );
  assert.equal(resolveUrl('http://localhost:5173/preview'), 'http://localhost:5173/preview');
  assert.equal(resolveUrl('HTTPS://APP.EXAMPLE.TEST/'), 'HTTPS://APP.EXAMPLE.TEST/');
});

test('script-capable schemes fall back instead of reaching href or window.open', () => {
  for (const value of [
    'javascript:alert(1)',
    '  javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  ]) {
    assert.equal(resolveUrl(value), '/', `${value.slice(0, 24)} must not survive`);
    assert.equal(safeNavigationUrl(value), '/', 'both copies fall back to the app root when no fallback is given');
  }
});

test('protocol-relative and backslash tricks cannot escape the origin', () => {
  for (const value of ['//evil.test/pwn', '  //evil.test', '\\\\evil.test\\x', '/\\evil.test']) {
    assert.equal(resolveUrl(value), '/', `${value} would leave the origin`);
  }
});

test('blank or non-string values fall back rather than producing undefined hrefs', () => {
  for (const value of [null, undefined, 42, {}, [], '', '   ']) {
    assert.equal(resolveUrl(value), '/');
    assert.equal(safeNavigationUrl(value, '/signed-in'), '/signed-in');
  }
});

test('validates diagnostics probe paths and keeps only safe same-origin probes', () => {
  const valid = validateDomainConfigDetailed({
    diagnostics: { appProbePath: 'manifest.webmanifest', backendProbePath: '/health' },
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.config.diagnostics, { appProbePath: 'manifest.webmanifest', backendProbePath: '/health' });

  const unsafe = [
    'https://evil.example/health',
    '//evil.example/health',
    'javascript:alert(1)',
    '\\\\evil.example\\health',
    '../admin/health',
    'health/../../admin',
    ' health ',
    '',
    42,
    null,
  ];
  unsafe.forEach((value) => {
    const result = validateDomainConfigDetailed({ diagnostics: { appProbePath: value, backendProbePath: value } });
    assert.equal(result.valid, false, `${String(value)} must be rejected`);
    assert.ok(result.issues.some((issue) => issue.code === 'invalid_diagnostics_probe' && issue.path === 'diagnostics.appProbePath'));
    assert.ok(result.issues.some((issue) => issue.code === 'invalid_diagnostics_probe' && issue.path === 'diagnostics.backendProbePath'));
    assert.equal(result.config.diagnostics.appProbePath, undefined);
    assert.equal(result.config.diagnostics.backendProbePath, undefined);
  });

  const notAnObject = validateDomainConfigDetailed({ diagnostics: 'manifest.webmanifest' });
  assert.equal(notAnObject.valid, false);
  assert.ok(notAnObject.issues.some((issue) => issue.code === 'invalid_diagnostics' && issue.path === 'diagnostics'));
  assert.deepEqual(notAnObject.config.diagnostics, {});
});
