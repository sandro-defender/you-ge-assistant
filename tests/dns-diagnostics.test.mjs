import test from 'node:test';
import assert from 'node:assert/strict';
import '../dns-diagnostics.js';

const { create, endpoint } = globalThis.YouGeDns;

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function dnsAnswer(url, overrides = {}) {
  const type = url.searchParams.get('type');
  const name = url.searchParams.get('name');
  const defaults = type === 'A'
    ? { Status: 0, Answer: [{ name, type: 1, TTL: 300, data: '192.0.2.12' }] }
    : { Status: 0, Answer: [{ name, type: 28, TTL: 300, data: '2001:db8::12' }] };
  return Object.assign(defaults, overrides);
}

function browserContext(overrides = {}) {
  return Object.assign({ hostname: 'portal.example.test', origin: 'https://portal.example.test', basePath: '/app/', online: true }, overrides);
}

function successfulFetch(overrides = {}) {
  return async (input, init) => {
    const url = new URL(input);
    if (url.href.startsWith(endpoint)) {
      assert.equal(init.headers.Accept, 'application/dns-json');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.referrerPolicy, 'no-referrer');
      return response(dnsAnswer(url, overrides.dns?.[url.searchParams.get('type')]));
    }
    if (overrides.appError) throw overrides.appError;
    return response({}, overrides.appStatus || 200);
  };
}

test('queries the detected hostname using Cloudflare DNS JSON for A and AAAA', async () => {
  const calls = [];
  const check = create({ fetch: async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    return url.href.startsWith(endpoint) ? response(dnsAnswer(url)) : response({});
  }, retries: 0 });
  const result = await check.check(browserContext());
  assert.equal(result.hostname, 'portal.example.test');
  assert.equal(result.resolver, 'Cloudflare DNS (1.1.1.1)');
  assert.equal(result.classification, 'normal_connectivity');
  assert.deepEqual(calls.filter((call) => call.url.href.startsWith(endpoint)).map((call) => [call.url.searchParams.get('name'), call.url.searchParams.get('type')]).sort(), [
    ['portal.example.test', 'A'], ['portal.example.test', 'AAAA'],
  ]);
});

test('treats a missing AAAA record as healthy when A records exist', async () => {
  const check = create({ fetch: successfulFetch({ dns: { AAAA: { Status: 0, Answer: [] } } }), retries: 0 });
  const result = await check.check(browserContext());
  assert.equal(result.classification, 'normal_connectivity');
  assert.equal(result.dns.flatMap((item) => item.answers).length, 1);
});

test('classifies NXDOMAIN only when both family queries agree and app does not respond', async () => {
  const fetch = async (input) => {
    const url = new URL(input);
    return url.href.startsWith(endpoint) ? response({ Status: 3, Answer: [] }) : response({}, 503);
  };
  const result = await create({ fetch, retries: 0 }).check(browserContext());
  assert.equal(result.classification, 'dns_resolution_failure');
  assert.match(result.message, /NXDOMAIN/);
});

test('classifies successful empty answers as missing address records, not an HTTP failure', async () => {
  const fetch = async (input) => {
    const url = new URL(input);
    return url.href.startsWith(endpoint) ? response({ Status: 0, Answer: [] }) : response({});
  };
  const result = await create({ fetch, retries: 0 }).check(browserContext());
  assert.equal(result.classification, 'dns_records_missing');
});

test('validates malformed Cloudflare JSON and reports DoH unavailable when app works', async () => {
  const fetch = async (input) => {
    const url = new URL(input);
    return url.href.startsWith(endpoint) ? { ok: true, status: 200, json: async () => ({ Status: 'bad', Answer: [] }) } : response({});
  };
  const result = await create({ fetch, retries: 0 }).check(browserContext());
  assert.equal(result.classification, 'cloudflare_doh_unavailable');
  assert.equal(result.dnsErrors.length, 2);
  assert.ok(result.dnsErrors.every((error) => error.kind === 'invalid_response'));
});

test('aborts timed-out DoH requests and classifies a working app separately', async () => {
  let aborted = 0;
  const fetch = (input, init) => {
    const url = new URL(input);
    if (!url.href.startsWith(endpoint)) return Promise.resolve(response({}));
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => { aborted += 1; reject(new Error('aborted')); }, { once: true });
    });
  };
  const result = await create({ fetch, timeoutMs: 15, retries: 0 }).check(browserContext());
  assert.equal(aborted, 2);
  assert.equal(result.classification, 'cloudflare_doh_unavailable');
  assert.ok(result.dnsErrors.every((error) => error.kind === 'timeout'));
});

test('retries transient failures a bounded number of times and handles CORS/network rejection', async () => {
  const counts = { dns: 0 };
  const fetch = async (input) => {
    const url = new URL(input);
    if (url.href.startsWith(endpoint)) {
      counts.dns += 1;
      throw new TypeError('Failed to fetch');
    }
    return response({});
  };
  const result = await create({ fetch, retries: 1 }).check(browserContext());
  assert.equal(counts.dns, 4);
  assert.equal(result.classification, 'cloudflare_doh_unavailable');
  assert.ok(result.dnsErrors.every((error) => error.kind === 'network_or_cors'));
});

test('classifies app-host failure separately and flags DNS interference only as an unverified possibility', async () => {
  const result = await create({ fetch: successfulFetch({ appStatus: 503 }), retries: 0 }).check(browserContext());
  assert.equal(result.classification, 'application_host_unavailable');
  assert.equal(result.possibleDnsInterference, true);
  assert.match(result.message, /one possible explanation/);
  assert.match(result.caveat, /cannot inspect/);
});

test('distinguishes browser offline state and a configured backend health failure', async () => {
  const offline = await create({ fetch: async () => { throw new TypeError('Failed to fetch'); }, retries: 0 })
    .check(browserContext({ online: false }));
  assert.equal(offline.classification, 'general_internet_failure');

  const backendCheck = create({ fetch: async (input) => {
    const url = new URL(input);
    if (url.href.startsWith(endpoint)) return response(dnsAnswer(url));
    if (url.pathname === '/health') return response({}, 503);
    return response({});
  }, retries: 0 });
  const backend = await backendCheck.check(browserContext({ backendProbePath: '/health' }));
  assert.equal(backend.classification, 'backend_unavailable');
  assert.equal(backend.app.ok, true);
});

test('rejects invalid hostnames and cross-origin context instead of issuing probes', async () => {
  let requests = 0;
  const check = create({ fetch: async () => { requests += 1; return response({}); } });
  const invalidHost = await check.check(browserContext({ hostname: 'evil.test/path' }));
  const invalidOrigin = await check.check(browserContext({ origin: 'https://other.test' }));
  assert.equal(invalidHost.classification, 'unknown');
  assert.equal(invalidOrigin.classification, 'unknown');
  assert.equal(requests, 0);
});

test('deduplicates concurrent requests for the same origin and hostname', async () => {
  let dnsQueries = 0;
  const fetch = async (input) => {
    const url = new URL(input);
    if (url.href.startsWith(endpoint)) dnsQueries += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return url.href.startsWith(endpoint) ? response(dnsAnswer(url)) : response({});
  };
  const check = create({ fetch, retries: 0 });
  const [a, b] = await Promise.all([check.check(browserContext()), check.check(browserContext())]);
  assert.equal(dnsQueries, 2);
  assert.equal(a.checkedAt, b.checkedAt);
});

test('resolves a relative backend probe path against the configured base path', async () => {
  async function probePaths(backendProbePath) {
    const probed = [];
    const fetch = async (input, init) => {
      const url = new URL(input);
      if (url.href.startsWith(endpoint)) return response(dnsAnswer(url));
      probed.push({ path: url.pathname, mode: init.mode, credentials: init.credentials });
      return response({});
    };
    const result = await create({ fetch, retries: 0 }).check(browserContext({ backendProbePath }));
    assert.equal(result.backend.ok, true);
    assert.equal(result.dohSkipped, false);
    return probed;
  }

  const relative = await probePaths('health');
  assert.deepEqual(relative.map((call) => call.path), ['/app/manifest.webmanifest', '/app/health']);
  assert.ok(relative.every((call) => call.mode === 'same-origin' && call.credentials === 'omit'));

  const rootRelative = await probePaths('/health');
  assert.deepEqual(rootRelative.map((call) => call.path), ['/app/manifest.webmanifest', '/health']);

  const appRelative = await probePaths('/app/health?probe=1');
  assert.deepEqual(appRelative.map((call) => call.path), ['/app/manifest.webmanifest', '/app/health']);
});

test('keeps response body parsing inside the configured timeout and abort scope', async () => {
  let aborted = 0;
  const fetch = (input, init) => {
    const url = new URL(input);
    if (!url.href.startsWith(endpoint)) return Promise.resolve(response({}));
    init.signal.addEventListener('abort', () => { aborted += 1; }, { once: true });
    return Promise.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) });
  };
  const started = Date.now();
  const result = await create({ fetch, timeoutMs: 20, retries: 0 }).check(browserContext());
  const elapsed = Date.now() - started;
  assert.equal(result.classification, 'cloudflare_doh_unavailable');
  assert.equal(result.applicationHostAvailable, true);
  assert.equal(result.dnsErrors.length, 2);
  assert.ok(result.dnsErrors.every((error) => error.kind === 'timeout'));
  assert.equal(aborted, 2, 'stalled bodies abort through the same controller');
  assert.ok(elapsed < 2000, `JSON parsing must stay bounded (took ${elapsed}ms)`);
});

test('skips public DoH for local and IP literal hosts and reports local results accurately', async () => {
  const contexts = [
    { hostname: 'localhost', origin: 'http://localhost:5173' },
    { hostname: 'team.localhost', origin: 'http://team.localhost:5173' },
    { hostname: '127.0.0.1', origin: 'http://127.0.0.1:5173' },
    { hostname: '[::1]', origin: 'http://[::1]:4173' },
  ];

  for (const override of contexts) {
    const calls = [];
    const fetch = async (input, init) => {
      const url = new URL(input);
      calls.push({ href: url.href, doh: url.href.startsWith(endpoint), mode: init.mode });
      return response({});
    };
    const result = await create({ fetch, retries: 0 }).check(browserContext(override));
    assert.equal(calls.filter((call) => call.doh).length, 0, `${override.hostname} must not query public DoH`);
    assert.equal(calls.length, 1, `${override.hostname} still probes the application host`);
    assert.equal(calls[0].href, new URL('manifest.webmanifest', new URL('/app/', override.origin)).href);
    assert.equal(calls[0].mode, 'same-origin');
    assert.equal(result.hostname, override.hostname);
    assert.equal(result.classification, 'normal_connectivity');
    assert.equal(result.dohAvailable, false);
    assert.equal(result.dohSkipped, true);
    assert.equal(result.possibleDnsInterference, false);
    assert.deepEqual(result.dns, []);
    assert.match(result.message, /local development host/i);
    assert.match(result.caveat, /cannot inspect/);
  }
});

test('reports a failing loopback host without false NXDOMAIN or DoH noise', async () => {
  const calls = [];
  const fetch = async (input) => {
    const url = new URL(input);
    calls.push(url.href);
    return response({}, 503);
  };
  const result = await create({ fetch, retries: 0 }).check(browserContext({ hostname: '[::1]', origin: 'http://[::1]:4173' }));
  assert.equal(calls.filter((href) => href.startsWith(endpoint)).length, 0);
  assert.equal(result.classification, 'application_host_unavailable');
  assert.equal(result.possibleDnsInterference, false);
  assert.equal(result.dohSkipped, true);
  assert.match(result.message, /local development host/i);

  const offline = await create({ fetch: async () => { throw new TypeError('Failed to fetch'); }, retries: 0 })
    .check(browserContext({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:5173', online: false }));
  assert.equal(offline.classification, 'general_internet_failure');
});
