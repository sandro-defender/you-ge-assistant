import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/domain/dns-diagnostics.js';
import { connectivityFailure, dnsFailure } from '../packages/assistant-sdk/src/diagnostics/index.js';

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
    if (url.pathname === '/app/health') return response({}, 503);
    return response({});
  }, retries: 0 });
  const backend = await backendCheck.check(browserContext({ backendProbePath: '/app/health' }));
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

/* ------------------------------------------------------------------ *
 * Stage 3 regressions: online-failure classification and cancellation
 * ------------------------------------------------------------------ */

test('classifies an online device whose DoH and application probes both fail as a connectivity failure, not unknown', async () => {
  const fetch = async () => { throw new TypeError('Failed to fetch'); };
  const result = await create({ fetch, retries: 0 }).check(browserContext({ online: true }));

  assert.equal(result.online, true);
  assert.notEqual(result.classification, 'unknown', 'evidence supports a connectivity failure, not an inconclusive result');
  assert.equal(result.classification, 'application_host_unavailable');
  assert.equal(connectivityFailure(result), true, 'assistant state must raise a reachable-connection notice');
  assert.equal(result.possibleDnsInterference, false, 'no DNS answer exists, so DNS interference stays unclaimed');
  assert.match(result.message, /did not respond/i);
});

test('keeps offline and backend-failure precedence when DoH also fails', async () => {
  const offline = await create({ fetch: async () => { throw new TypeError('Failed to fetch'); }, retries: 0 })
    .check(browserContext({ online: false }));
  assert.equal(offline.classification, 'general_internet_failure');

  const backendCheck = create({ fetch: async (input) => {
    const url = new URL(input);
    if (url.href.startsWith(endpoint)) throw new TypeError('Failed to fetch');
    if (url.pathname === '/app/health') return response({}, 503);
    return response({});
  }, retries: 0 });
  const backend = await backendCheck.check(browserContext({ backendProbePath: '/app/health' }));
  assert.equal(backend.classification, 'backend_unavailable', 'a responsive app host still outranks a DoH failure');
});

function fakeSignal() {
  const listeners = new Set();
  const added = [];
  const removed = [];
  return {
    aborted: false,
    added,
    removed,
    get listenerCount() { return listeners.size; },
    addEventListener(type, listener) {
      added.push(type);
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      removed.push(type);
      listeners.delete(listener);
    },
    abort() {
      this.aborted = true;
      Array.from(listeners).forEach((listener) => listener({ type: 'abort' }));
    },
    fire() { Array.from(listeners).forEach((listener) => listener({ type: 'abort' })); },
  };
}

test('an already-aborted caller signal cancels without issuing any request', async () => {
  const signal = fakeSignal();
  signal.aborted = true;
  let requests = 0;
  const result = await create({ fetch: async () => { requests += 1; return response({}); }, retries: 0 })
    .check(browserContext(), { signal });

  assert.equal(requests, 0, 'cancellation is honored before any network work');
  assert.equal(result.classification, 'cancelled');
  assert.equal(result.cancelled, true);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.failed, false);
  assert.equal(dnsFailure(result), false);
  assert.equal(connectivityFailure(result), false, 'a cancellation is not a connectivity failure');
});

test('aborting mid-flight cancels every in-flight request and is distinguishable from a timeout', async () => {
  const signal = fakeSignal();
  const aborted = [];
  const fetch = (input, init) => {
    const url = new URL(input);
    return new Promise((resolve, reject) => {
      const onAbort = () => { aborted.push(url.href); };
      if (init && init.signal) init.signal.addEventListener('abort', onAbort, { once: true });
      // A cancelled caller never settles its fetches; only the abort path resolves the check.
      void resolve; void reject;
    });
  };

  const promise = create({ fetch, retries: 0, timeoutMs: 5000 }).check(browserContext(), { signal });
  await new Promise((resolve) => setTimeout(resolve, 10));
  signal.abort();
  const result = await promise;

  assert.equal(result.classification, 'cancelled');
  assert.equal(result.cancelled, true);
  assert.equal(result.dnsErrors.length, 0, 'cancellation is not reported as a probe failure');
  assert.equal(result.classification === 'cancelled' && result.dnsErrors.some((e) => e.kind === 'timeout'), false);
  assert.equal(aborted.length, 3, 'both DoH queries and the app probe are aborted through the internal controller');
  assert.equal(signal.listenerCount, 0, 'caller listeners are released');
  assert.ok(signal.added.length > 0 && signal.added.length === signal.removed.length);
});

test('a cancelled run does not poison the deduplicated in-flight map or later retries', async () => {
  const signal = fakeSignal();
  let hanging = true;
  let dnsCalls = 0;
  const fetch = async (input, init) => {
    const url = new URL(input);
    if (hanging) {
      // A cancelled run's requests only settle when their controller aborts,
      // exactly as a real fetch behaves.
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new TypeError('Failed to fetch')), { once: true });
      });
    }
    if (url.href.startsWith(endpoint)) {
      dnsCalls += 1;
      return response(dnsAnswer(url));
    }
    return response({});
  };
  const engine = create({ fetch, timeoutMs: 5000, retries: 0 });

  const first = engine.check(browserContext(), { signal });
  await new Promise((resolve) => setTimeout(resolve, 0));
  signal.abort();
  const cancelled = await first;
  assert.equal(cancelled.classification, 'cancelled');
  assert.equal(cancelled.cancelled, true);

  hanging = false;
  const ok = await engine.check(browserContext());
  assert.equal(ok.classification, 'normal_connectivity', 'a later uncancelled retry still runs normally');
  assert.equal(dnsCalls, 2, 'the retry issues fresh DoH queries instead of joining the abandoned run');
});

test('a caller abort never cancels an unrelated concurrent caller sharing the same host', async () => {
  const signal = fakeSignal();
  const fetch = async (input, init) => {
    const url = new URL(input);
    if (url.href.startsWith(endpoint)) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response(dnsAnswer(url));
    }
    return response({});
  };
  const engine = create({ fetch, retries: 0 });

  const cancellable = engine.check(browserContext(), { signal });
  const independent = engine.check(browserContext());
  await new Promise((resolve) => setTimeout(resolve, 0));
  signal.abort();
  const [cancelled, ok] = await Promise.all([cancellable, independent]);

  assert.equal(cancelled.classification, 'cancelled');
  assert.equal(ok.classification, 'normal_connectivity', 'the uncancelled call is unaffected by another caller signal');
});

test('without a caller signal the engine keeps its existing signature and behavior', async () => {
  const result = await create({ fetch: successfulFetch(), retries: 0 }).check(browserContext());
  assert.equal(result.classification, 'normal_connectivity');
  assert.equal(result.status, undefined, 'no cancellation status leaks into ordinary results');
});

test('the global check forwards run options while preserving factory options and caller cancellation', async () => {
  const signal = fakeSignal();
  let requests = 0;
  const fetch = async (input) => {
    requests += 1;
    const url = new URL(input);
    if (url.href.startsWith(endpoint)) await new Promise((resolve) => setTimeout(resolve, 25));
    return url.href.startsWith(endpoint) ? response(dnsAnswer(url)) : response({});
  };

  const pending = globalThis.YouGeDns.check(browserContext(), {
    fetch,
    retries: 0,
    timeoutMs: 1000,
    signal,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  signal.abort();
  const result = await pending;

  assert.equal(requests, 3, 'factory options still configure the global engine');
  assert.equal(result.classification, 'cancelled', 'the second argument is also passed to the run');
  assert.equal(result.cancelled, true);
  assert.equal(signal.listenerCount, 0, 'the global wrapper releases the caller listener');
});

/* ------------------------------------------------------------------ *
 * Stage 5.3 / D3 — host classification: local vs private vs public IP
 * ------------------------------------------------------------------ */

test('classifies hosts as localhost, loopback, private or public instead of treating every IP literal as local (D3)', async () => {
  const cases = [
    // Local hostnames.
    { host: 'localhost', origin: 'http://localhost:5173', kind: 'localhost', message: /local development host/i },
    { host: 'team.localhost', origin: 'http://team.localhost:5173', kind: 'localhost', message: /local development host/i },
    // Loopback addresses (IPv4 and bracketed IPv6).
    { host: '127.0.0.1', origin: 'http://127.0.0.1:5173', kind: 'loopback', message: /local development host/i },
    { host: '127.255.255.254', origin: 'http://127.255.255.254:5173', kind: 'loopback', message: /local development host/i },
    { host: '[::1]', origin: 'http://[::1]:4173', kind: 'loopback', message: /local development host/i },
    { host: '[::ffff:7f00:1]', origin: 'http://[::ffff:7f00:1]:4173', kind: 'loopback', message: /local development host/i },
    // Private, link-local and carrier-grade NAT ranges are local-only, but they
    // are a different thing from loopback and are described as such.
    { host: '10.1.2.3', origin: 'http://10.1.2.3:8080', kind: 'private', message: /private|local-only/i },
    { host: '172.16.5.5', origin: 'http://172.16.5.5:8080', kind: 'private', message: /private|local-only/i },
    { host: '172.31.255.1', origin: 'http://172.31.255.1:8080', kind: 'private', message: /private|local-only/i },
    { host: '192.168.1.10', origin: 'http://192.168.1.10:8080', kind: 'private', message: /private|local-only/i },
    { host: '169.254.10.10', origin: 'http://169.254.10.10:8080', kind: 'private', message: /private|local-only/i },
    { host: '100.64.0.7', origin: 'http://100.64.0.7:8080', kind: 'private', message: /private|local-only/i },
    { host: '[fd00::1]', origin: 'http://[fd00::1]:8080', kind: 'private', message: /private|local-only/i },
    { host: '[fe80::1]', origin: 'http://[fe80::1]:8080', kind: 'private', message: /private|local-only/i },
    // Public IP literals are production-style targets: public DNS name
    // resolution does not apply, but they are not development hosts.
    { host: '8.8.8.8', origin: 'http://8.8.8.8', kind: 'public-ip', message: /IP address/i },
    { host: '1.1.1.1', origin: 'http://1.1.1.1', kind: 'public-ip', message: /IP address/i },
    { host: '203.0.113.10', origin: 'http://203.0.113.10', kind: 'public-ip', message: /IP address/i },
    { host: '93.184.216.34', origin: 'https://93.184.216.34', kind: 'public-ip', message: /IP address/i },
    { host: '[2001:db8::12]', origin: 'http://[2001:db8::12]', kind: 'public-ip', message: /IP address/i },
    { host: '[2606:4700:4700::1111]', origin: 'http://[2606:4700:4700::1111]', kind: 'public-ip', message: /IP address/i },
    // Ordinary hostnames keep querying public DoH.
    { host: 'portal.example.test', origin: 'https://portal.example.test', kind: 'hostname', message: /Cloudflare DNS resolved/i },
  ];

  for (const testCase of cases) {
    const calls = [];
    const fetch = async (input, init) => {
      const url = new URL(input);
      calls.push({ href: url.href, doh: url.href.startsWith(endpoint) });
      if (url.href.startsWith(endpoint)) return response(dnsAnswer(url));
      return response({});
    };
    const result = await create({ fetch, retries: 0 }).check(browserContext({ hostname: testCase.host, origin: testCase.origin }));
    const dohCalls = calls.filter((call) => call.doh).length;
    const label = testCase.host;

    assert.equal(result.hostname, testCase.host, label);
    assert.equal(result.hostKind, testCase.kind, `${label} is classified as ${testCase.kind}`);
    assert.equal(result.classification, 'normal_connectivity', label);
    assert.equal(result.dohSkipped, testCase.kind !== 'hostname', `${label} DoH skip flag matches the host kind`);
    assert.equal(dohCalls, testCase.kind === 'hostname' ? 2 : 0, `${label} DoH query count`);
    assert.equal(result.possibleDnsInterference, false, label);
    assert.match(result.message, testCase.message, `${label} message`);

    if (testCase.kind === 'public-ip') {
      assert.doesNotMatch(result.message, /local development host/i, `${label} must not be described as a local development host`);
      assert.ok(result.message.includes(testCase.host), `${label} message names the IP address it is talking about`);
      assert.equal(calls.length, 1, `${label} still probes the application host`);
    }
    if (testCase.kind === 'hostname') {
      assert.equal(result.dohAvailable, true, label);
      assert.ok(result.dns.length === 2, `${label} DoH evidence is reported`);
    }
  }
});

test('reports a failing public IP literal without local-development wording or DNS interference', async () => {
  const result = await create({ fetch: async () => response({}, 503), retries: 0 })
    .check(browserContext({ hostname: '8.8.8.8', origin: 'http://8.8.8.8' }));

  assert.equal(result.classification, 'application_host_unavailable');
  assert.equal(result.hostKind, 'public-ip');
  assert.equal(result.dohSkipped, true);
  assert.equal(result.possibleDnsInterference, false);
  assert.match(result.message, /IP address/i);
  assert.doesNotMatch(result.message, /local development host/i);
});

test('classifies private development addresses distinctly from loopback', async () => {
  const loopback = await create({ fetch: async () => response({}), retries: 0 })
    .check(browserContext({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:5173' }));
  const privateHost = await create({ fetch: async () => response({}), retries: 0 })
    .check(browserContext({ hostname: '192.168.1.10', origin: 'http://192.168.1.10:8080' }));

  assert.notEqual(loopback.hostKind, privateHost.hostKind, 'private ranges are not reported as loopback');
  assert.notEqual(loopback.message, privateHost.message, 'the user-facing explanation distinguishes them');
  assert.equal(loopback.dohSkipped, true);
  assert.equal(privateHost.dohSkipped, true);
});

test('rejects malformed host values without issuing any probe', async () => {
  const malformed = ['', ' ', 'exa mple.com', 'exa_mple.com', '-bad.example', 'a..b', 'http://example.com', 'example.com/path', 42, null];
  for (const hostname of malformed) {
    let requests = 0;
    const result = await create({ fetch: async () => { requests += 1; return response({}); }, retries: 0 })
      .check(browserContext({ hostname, origin: 'https://portal.example.test' }));
    assert.equal(result.classification, 'unknown', `${String(hostname)} is rejected`);
    assert.equal(requests, 0, `${String(hostname)} issues no request`);
  }
});

test('confines probes to the deployment base, including encoded segments', async () => {
  const cases = [
    ['/', 'health', '/health'],
    ['/', '/health', '/health'],
    ['/portal', 'health?check=1', '/portal/health?check=1'],
    ['/portal/', '/portal/health', '/portal/health'],
    ['/my%20app', 'api/v%32/health', '/my%20app/api/v%32/health'],
  ];
  for (const [basePath, backendProbePath, expected] of cases) {
    const calls = [];
    const result = await create({ retries: 0, fetch: async (input, init) => {
      const url = new URL(input);
      if (url.href.startsWith(endpoint)) return response(dnsAnswer(url));
      assert.equal(init.redirect, 'error');
      calls.push(url.pathname + url.search);
      return response({});
    }}).check(browserContext({ basePath, backendProbePath }));
    assert.equal(result.backend.ok, true);
    assert.equal(calls[1], expected);
  }
});

test('rejects cross-origin, traversal, encoded separators and base escapes without unsafe requests', async () => {
  for (const path of ['/health', '/app2/health', '../health', '%2e%2e/health', 'x%2f..%2fhealth', 'x%5c..', '%252e%252e/health', '//evil.test/x', 'https://evil.test/x', 'http+foo:x', '%zz']) {
    const calls = [];
    const result = await create({ retries: 0, fetch: async (input) => {
      const url = new URL(input);
      if (url.href.startsWith(endpoint)) return response(dnsAnswer(url));
      calls.push(url.href);
      return response({});
    }}).check(browserContext({ backendProbePath: path, appProbePath: path }));
    assert.equal(result.backend, null, path);
    assert.deepEqual(calls, ['https://portal.example.test/app/manifest.webmanifest'], path);
  }
  for (const basePath of ['//evil.test/', '/app/../', '/app%2felse/', '/app?x', '/%zz']) {
    let count = 0;
    const result = await create({ retries: 0, fetch: async () => { count++; return response({}); } }).check(browserContext({ basePath }));
    assert.equal(result.classification, 'unknown', basePath);
    assert.equal(count, 0, basePath);
  }
});

test('caller cancellation aborts stalled JSON bodies without leaving signal listeners', async () => {
  const signal = fakeSignal();
  let bodies = 0;
  let aborted = 0;
  const check = create({ retries: 0, timeoutMs: 1000, fetch: async (input, init) => {
    if (!String(input).startsWith(endpoint)) return response({});
    init.signal.addEventListener('abort', () => { aborted++; }, { once: true });
    return { ok: true, status: 200, json: () => { bodies++; return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); } };
  }});
  const promise = check.check(browserContext(), { signal });
  while (bodies < 2) await new Promise((resolve) => setTimeout(resolve, 0));
  signal.abort();
  const result = await promise;
  assert.equal(result.classification, 'cancelled');
  assert.equal(aborted, 2);
  assert.equal(signal.listenerCount, 0);
});

test('classifies synchronous and asynchronous JSON failures as invalid responses', async () => {
  for (const json of [() => { throw new Error('broken'); }, () => Promise.reject(new Error('broken'))]) {
    const result = await create({ retries: 0, fetch: async (input) => String(input).startsWith(endpoint) ? { ok: true, status: 200, json } : response({}) }).check(browserContext());
    assert.deepEqual(result.dnsErrors.map((error) => error.kind), ['invalid_response', 'invalid_response']);
  }
});

test('canonicalizes IPv6 loopback and preserves active private LAN origin', async () => {
  for (const [hostname, origin, kind] of [['[0:0:0:0:0:0:0:1]', 'http://[::1]:8080', 'loopback'], ['192.168.1.8', 'http://192.168.1.8:8080', 'private'], ['[fd00::1]', 'http://[fd00::1]:8080', 'private']]) {
    const calls = [];
    const result = await create({ retries: 0, fetch: async (input) => { calls.push(input); return response({}); } }).check(browserContext({ hostname, origin, basePath: '/app', backendProbePath: 'health' }));
    assert.equal(result.hostKind, kind);
    assert.equal(result.dohSkipped, true);
    assert.deepEqual(calls, [origin + '/app/manifest.webmanifest', origin + '/app/health']);
  }
});

test('relative origin is resolved only against the active browser origin', async () => {
  const previous = globalThis.location;
  globalThis.location = { href: 'http://localhost:5173/app/page', origin: 'http://localhost:5173', hostname: 'localhost' };
  try {
    const calls = [];
    const engine = create({ retries: 0, fetch: async (input) => { calls.push(input); return response({}); } });
    const result = await engine.check({ hostname: 'localhost', origin: '/app/', basePath: '/app', backendProbePath: 'health' });
    assert.equal(result.classification, 'normal_connectivity');
    assert.deepEqual(calls, ['http://localhost:5173/app/manifest.webmanifest', 'http://localhost:5173/app/health']);
    const rejected = await engine.check({ hostname: 'localhost', origin: 'http://localhost:9999', basePath: '/app' });
    assert.equal(rejected.classification, 'unknown');
    assert.equal(calls.length, 2);
  } finally {
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  }
});
