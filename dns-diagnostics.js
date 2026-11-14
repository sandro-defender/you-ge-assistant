/*!
 * dns-diagnostics.js — on-demand Cloudflare DNS-over-HTTPS diagnostics.
 * This cannot inspect the device's configured DNS resolver or prove DNS blocking.
 */
(function (root) {
  'use strict';

  var ENDPOINT = 'https://cloudflare-dns.com/dns-query';
  var inflight = new Map();
  var fetchIdentities = new WeakMap();
  var nextFetchIdentity = 0;
  var STATUS = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
  var HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/i;
  var IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  var IPV6_BRACKET_PATTERN = /^\[[0-9a-f:.]+\]$/i;

  function makeError(kind, message) {
    var error = new Error(message || kind);
    error.kind = kind;
    return error;
  }

  function isIpv4Literal(host) {
    if (!IPV4_PATTERN.test(host)) return false;
    return host.split('.').every(function (part) {
      var octet = Number(part);
      return octet >= 0 && octet <= 255;
    });
  }

  function isIpv6Literal(host) {
    if (!IPV6_BRACKET_PATTERN.test(host)) return false;
    try {
      return new URL('http://' + host).hostname.toLowerCase() === host;
    } catch (error) {
      return false;
    }
  }

  function ipv4Octets(host) {
    if (!isIpv4Literal(host)) return null;
    return host.split('.').map(function (part) { return Number(part); });
  }

  function inIpv4Range(octets, first, second, bits) {
    var value = ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
    var base = ((first << 24) >>> 0) + (second << 16);
    var size = Math.pow(2, 32 - bits);
    return value >= base && value < base + size;
  }

  function ipv4Kind(host) {
    var octets = ipv4Octets(host);
    if (!octets) return '';
    // Loopback is 127.0.0.0/8; it is the one range browsers can serve a
    // development app from without any network interface.
    if (octets[0] === 127) return 'loopback';
    if (inIpv4Range(octets, 10, 0, 8) ||
        inIpv4Range(octets, 172, 16, 12) ||
        inIpv4Range(octets, 192, 168, 16) ||
        inIpv4Range(octets, 169, 254, 16) ||
        inIpv4Range(octets, 100, 64, 10)) return 'private';
    return 'public-ip';
  }

  // Expands a validated IPv6 literal into its eight 16-bit groups so that
  // compressed and fully written spellings classify identically.
  function expandIpv6(literal) {
    var text = literal.toLowerCase();
    var tail = [];
    var tailMatch = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
    if (tailMatch) {
      var embedded = tailMatch[1].split('.').map(Number);
      tail = [((embedded[0] << 8) | embedded[1]).toString(16), ((embedded[2] << 8) | embedded[3]).toString(16)];
      text = text.slice(0, tailMatch.index).replace(/:$/, '');
    }
    var halves = text.split('::');
    var head = halves[0] ? halves[0].split(':') : [];
    var rest = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
    rest = rest.concat(tail);
    var missing = 8 - head.length - rest.length;
    var groups = head.concat(new Array(missing > 0 ? missing : 0).fill('0'), rest);
    if (groups.length !== 8) return null;
    return groups.map(function (group) { return parseInt(group || '0', 16) || 0; });
  }

  function ipv6Kind(host) {
    if (!isIpv6Literal(host)) return '';
    var groups = expandIpv6(host.slice(1, -1));
    if (!groups) return 'public-ip';
    var first = groups[0];
    var onlyLastSet = groups.slice(0, 7).every(function (group) { return group === 0; });
    if (onlyLastSet && groups[7] === 1) return 'loopback';
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible forms keep their IPv4
    // meaning, so ::ffff:127.0.0.1 is loopback and ::ffff:8.8.8.8 is public.
    if (groups.slice(0, 5).every(function (group) { return group === 0; }) &&
        (groups[5] === 0xffff || groups[5] === 0)) {
      var mapped = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
      return ipv4Kind(mapped.join('.'));
    }
    if ((first & 0xfe00) === 0xfc00) return 'private';
    if ((first & 0xffc0) === 0xfe80) return 'private';
    if ((first & 0xffc0) === 0xfec0) return 'private';
    return 'public-ip';
  }

  // Host classification. The kinds are separate because they mean different
  // things to the user:
  //   localhost — the browser resolves it locally by specification.
  //   loopback  — 127.0.0.0/8 and ::1; a local development address.
  //   private   — RFC1918, carrier-grade NAT and link-local ranges (plus their
  //               IPv6 equivalents). Local-only, but reached over a network
  //               interface rather than the loopback device, so it is not
  //               reported as loopback.
  //   public-ip — any other IP literal. A production-style target that happens
  //               not to be a DNS name: public DoH still cannot resolve it,
  //               but it is never described as a development host.
  // An empty string means "ordinary DNS hostname" (public DoH applies).
  function hostKind(host) {
    if (!host) return '';
    if (host === 'localhost' || host.slice(-10) === '.localhost') return 'localhost';
    var ipv4 = ipv4Kind(host);
    if (ipv4) return ipv4;
    return ipv6Kind(host);
  }

  // Every non-hostname kind is never resolved by public DNS, so querying
  // Cloudflare DoH for it would only produce misleading NXDOMAIN noise.
  function skipsPublicDoh(kind) {
    return Boolean(kind);
  }

  function describeTarget(host, kind) {
    if (kind === 'public-ip') {
      return 'This app is served from the IP address ' + host +
        '. Public Cloudflare DNS resolves DNS names, not IP literals, so the DNS lookup was skipped. ';
    }
    if (kind === 'private') {
      return 'This app is served from a private or local-only IP address, so public Cloudflare DNS ' +
        'checks were skipped. ';
    }
    return 'This is a local development host, so public Cloudflare DNS checks were skipped. ';
  }

  // The response consumer (including body parsing) runs inside the same timeout
  // and AbortController scope as the request itself, so a stalled body cannot
  // outlive `timeoutMs`. An optional caller signal rides the same controller:
  // a caller abort reuses the existing abort path but rejects with a distinct
  // `cancelled` kind, so cancellation is never reported as a timeout or an
  // ordinary probe failure, and the caller listener is always released.
  function timeoutRequest(fetchImpl, url, options, timeoutMs, AbortControllerImpl, consume, callerSignal) {
    if (callerSignal && callerSignal.aborted) {
      return Promise.reject(makeError('cancelled', 'Request cancelled by the caller'));
    }
    var controller = AbortControllerImpl ? new AbortControllerImpl() : null;
    var timer;
    var onCallerAbort = null;
    var requestOptions = Object.assign({}, options);
    if (controller) requestOptions.signal = controller.signal;
    var request = Promise.resolve().then(function () { return fetchImpl(url, requestOptions); });
    if (typeof consume === 'function') request = request.then(consume);
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(makeError('timeout', 'Request timed out'));
      }, timeoutMs);
    });
    var races = [request, timeout];
    if (callerSignal && typeof callerSignal.addEventListener === 'function') {
      races.push(new Promise(function (_, reject) {
        onCallerAbort = function () {
          if (typeof callerSignal.removeEventListener === 'function') {
            callerSignal.removeEventListener('abort', onCallerAbort);
          }
          if (controller) {
            try { controller.abort(); } catch (error) { /* the request is already over */ }
          }
          reject(makeError('cancelled', 'Request cancelled by the caller'));
        };
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }));
    }
    return Promise.race(races).finally(function () {
      clearTimeout(timer);
      if (onCallerAbort && typeof callerSignal.removeEventListener === 'function') {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    });
  }

  // Resolves with the run's own result, or short-circuits to a cancelled result
  // the moment the caller aborts. The underlying run keeps settling on its own
  // (its requests are aborted), so no rejection ever goes unhandled.
  function untilCancelled(promise, signal, buildCancelledResult) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      function cleanup() {
        if (onAbort && typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onAbort);
      }
      var onAbort = function () {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(buildCancelledResult());
      };
      if (!signal || typeof signal.addEventListener !== 'function') {
        promise.then(resolve, reject);
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(function (value) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      }, function (error) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      });
    });
  }

  function fetchIdentity(fetchImpl) {
    if (!fetchImpl || (typeof fetchImpl !== 'function' && typeof fetchImpl !== 'object')) return 'none';
    if (!fetchIdentities.has(fetchImpl)) fetchIdentities.set(fetchImpl, ++nextFetchIdentity);
    return fetchIdentities.get(fetchImpl);
  }

  function create(options) {
    options = options || {};
    var fetchImpl = options.fetch || root.fetch;
    var AbortControllerImpl = options.AbortController || root.AbortController;
    var timeoutMs = Number(options.timeoutMs) > 0 ? Math.min(15000, Number(options.timeoutMs)) : 5000;
    var retries = options.retries == null ? 1 : Math.max(0, Math.min(2, Number(options.retries) || 0));
    if (typeof fetchImpl !== 'function') {
      return { check: function () { return Promise.resolve({ classification: 'unknown', message: 'Fetch is unavailable in this browser.' }); } };
    }

    function checkedResponse(consume) {
      return function (response) {
        if (!response || typeof response.ok !== 'boolean') throw makeError('invalid_response', 'The server returned an invalid response.');
        if (!response.ok) {
          var statusError = makeError('http_error', 'HTTP ' + response.status);
          statusError.status = response.status;
          throw statusError;
        }
        return consume ? consume(response) : response;
      };
    }

    function fetchWithRetry(url, requestOptions, isDns, consume, callerSignal) {
      var attempt = 0;
      function run() {
        return timeoutRequest(fetchImpl, url, requestOptions, timeoutMs, AbortControllerImpl, checkedResponse(consume), callerSignal).catch(function (error) {
          if (error instanceof TypeError && !error.kind) error.kind = 'network_or_cors';
          // A caller cancellation is final: never retried, never reclassified.
          if (error.kind === 'cancelled') throw error;
          var retryable = error.kind === 'timeout' || error.kind === 'network_or_cors' ||
            (error.kind === 'http_error' && error.status >= 500);
          if (retryable && attempt < retries) {
            attempt += 1;
            return run();
          }
          if (!error.kind) error.kind = isDns ? 'network_or_cors' : 'application_unavailable';
          throw error;
        });
      }
      return run();
    }

    function parseDnsBody(type, response) {
      return response.json().catch(function () {
        throw makeError('invalid_response', 'Cloudflare returned invalid JSON.');
      }).then(function (body) {
        if (!body || !Number.isInteger(body.Status) || body.Status < 0 || body.Status > 5 || !Array.isArray(body.Answer || [])) {
          throw makeError('invalid_response', 'Cloudflare returned an invalid DNS response.');
        }
        var expectedType = type === 'A' ? 1 : 28;
        var answers = (body.Answer || []).filter(function (answer) {
          return answer && Number.isInteger(Number(answer.type)) && Number(answer.type) === expectedType &&
            typeof answer.data === 'string' && answer.data.length > 0;
        });
        return { type: type, status: body.Status, statusText: STATUS[body.Status], answers: answers };
      });
    }

    function query(hostname, type, callerSignal) {
      var url = new URL(ENDPOINT);
      url.searchParams.set('name', hostname);
      url.searchParams.set('type', type);
      return fetchWithRetry(url.href, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/dns-json' },
      }, true, function (response) {
        return parseDnsBody(type, response);
      }, callerSignal);
    }

    function probe(url, callerSignal) {
      return fetchWithRetry(url, {
        method: 'GET',
        mode: 'same-origin',
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/manifest+json, application/json, */*' },
      }, false, function (response) {
        return { ok: true, status: response.status };
      }, callerSignal).catch(function (error) {
        // A cancelled probe must not be summarized as a failed probe.
        if (error && error.kind === 'cancelled') throw error;
        return { ok: false, kind: error.kind || 'application_unavailable', status: error.status || null };
      });
    }

    function cancelledResult(host, origin, online, message) {
      return {
        hostname: host,
        origin: origin,
        resolver: 'Cloudflare DNS (1.1.1.1)',
        endpoint: ENDPOINT,
        checkedAt: new Date().toISOString(),
        classification: 'cancelled',
        status: 'cancelled',
        cancelled: true,
        failed: false,
        message: message || 'Diagnostics were cancelled before they finished.',
        online: online,
        dohAvailable: false,
        dohSkipped: false,
        applicationHostAvailable: false,
        possibleDnsInterference: false,
        dns: [],
        dnsErrors: [],
        app: { ok: false, kind: 'cancelled', status: null },
        backend: null,
      };
    }

    function check(context, runOptions) {
      context = context || {};
      var optionsIn = runOptions && typeof runOptions === 'object' ? runOptions : {};
      var callerSignal = optionsIn.signal && typeof optionsIn.signal === 'object' ? optionsIn.signal : null;
      var host = String(context.hostname || '').toLowerCase().replace(/\.$/, '');
      if (callerSignal && callerSignal.aborted) {
        return Promise.resolve(cancelledResult(host, context.origin || (root.location && root.location.origin),
          context.online !== false, 'Diagnostics were cancelled before any request was made.'));
      }
      var kind = hostKind(host);
      if (!kind && !HOST_PATTERN.test(host)) {
        return Promise.resolve({ hostname: host, classification: 'unknown', hostKind: 'invalid', message: 'The current hostname is not a valid DNS name.' });
      }
      var localHost = skipsPublicDoh(kind);
      var origin;
      try {
        origin = new URL(context.origin || root.location.origin).origin;
        if (new URL(origin).hostname.toLowerCase() !== host) throw new Error('Origin hostname mismatch');
        if (root.location && root.location.hostname &&
            (host !== root.location.hostname.toLowerCase().replace(/\.$/, '') || origin !== root.location.origin)) {
          throw new Error('Diagnostics must target the active origin');
        }
      } catch (error) {
        return Promise.resolve({ hostname: host, classification: 'unknown', message: 'The current origin could not be validated.' });
      }
      var basePath = String(context.basePath || '/');
      if (basePath.charAt(0) !== '/' || basePath.indexOf('..') !== -1 || basePath.indexOf('\\') !== -1) basePath = '/';
      if (basePath.charAt(basePath.length - 1) !== '/') basePath += '/';
      var probeBaseUrl = new URL(basePath, origin);
      var appProbeUrl;
      try {
        appProbeUrl = new URL(context.appProbePath || 'manifest.webmanifest', probeBaseUrl).href;
        if (new URL(appProbeUrl).origin !== origin) throw new Error('cross-origin probe');
      } catch (error) {
        appProbeUrl = new URL('manifest.webmanifest', origin).href;
      }
      var backendProbeUrl = '';
      if (context.backendProbePath) {
        try {
          // Relative backend paths follow the configured base path like the app
          // probe; root-relative paths still resolve against the origin.
          backendProbeUrl = new URL(context.backendProbePath, probeBaseUrl).href;
          if (new URL(backendProbeUrl).origin !== origin) backendProbeUrl = '';
        } catch (error) { backendProbeUrl = ''; }
      }
      var key = [host, origin, basePath, appProbeUrl, backendProbeUrl, context.online !== false,
        timeoutMs, retries, fetchIdentity(fetchImpl), fetchIdentity(AbortControllerImpl)].join('|');
      var buildCancelled = function () {
        return cancelledResult(host, origin, context.online !== false);
      };
      if (inflight.has(key)) {
        var shared = inflight.get(key);
        // Deduplication stays single-flight for ordinary callers. A caller that
        // brought a signal only observes the shared run, so its own cancellation
        // can never abort requests another caller is waiting for.
        return callerSignal ? untilCancelled(shared, callerSignal, buildCancelled) : shared;
      }

      var dnsPromise = localHost ? Promise.resolve([]) : Promise.all([query(host, 'A', callerSignal), query(host, 'AAAA', callerSignal)].map(function (promise) {
        return promise.then(function (value) { return { value: value }; }, function (error) { return { error: error }; });
      }));
      var appPromise = probe(appProbeUrl, callerSignal);
      var backendPromise = backendProbeUrl ? probe(backendProbeUrl, callerSignal) : Promise.resolve(null);
      var resultPromise = Promise.all([dnsPromise, appPromise, backendPromise]).then(function (parts) {
        var dns = parts[0];
        var app = parts[1];
        var backend = parts[2];
        var validDns = dns.filter(function (item) { return item.value; }).map(function (item) { return item.value; });
        var dnsErrors = dns.filter(function (item) { return item.error; }).map(function (item) { return item.error; });
        var answers = validDns.reduce(function (all, item) { return all.concat(item.answers); }, []);
        var statuses = validDns.map(function (item) { return item.status; });
        var online = context.online !== false;
        var classification = 'unknown';
        var message = 'Results are inconclusive. Retry the diagnostics.';
        var caveat = 'JavaScript cannot inspect your device’s normal DNS resolver. A DoH result does not prove that the browser resolver is blocked.';

        if (!online && !app.ok) {
          classification = 'general_internet_failure';
          message = 'The browser reports no network connection, and the application host did not respond.';
        } else if (backend && !backend.ok && app.ok) {
          classification = 'backend_unavailable';
          message = 'The application host responds, but its configured backend health endpoint did not.';
        } else if (localHost) {
          // Public DoH cannot resolve loopback, private or IP-literal hosts, so
          // the same-origin probe result is the only meaningful signal. The
          // wording follows the host kind: only `localhost` and loopback are a
          // development host, and a public IP literal says so plainly.
          var target = describeTarget(host, kind);
          if (app.ok) {
            classification = 'normal_connectivity';
            message = target + 'The application host responded.';
          } else {
            classification = 'application_host_unavailable';
            message = target + (kind === 'private'
              ? 'The application host did not respond; verify the server is running on that address and port.'
              : (kind === 'public-ip'
                ? 'The application host did not respond; verify the server address, port and TLS configuration.'
                : 'The application host did not respond; verify that the local development server is running.'));
          }
        } else if (statuses.length === 2 && statuses.every(function (status) { return status === 3; })) {
          classification = app.ok ? 'inconclusive' : 'dns_resolution_failure';
          message = app.ok
            ? 'Cloudflare reports NXDOMAIN while this app responded. The results conflict; check DNS propagation and retry.'
            : 'Cloudflare DNS returned NXDOMAIN for the current hostname.';
        } else if (statuses.length === 2 && statuses.every(function (status) { return status === 0; }) && !answers.length) {
          classification = 'dns_records_missing';
          message = 'Cloudflare returned NOERROR but no A or AAAA address records for this hostname.';
        } else if (statuses.length === 2 && statuses.every(function (status) { return status === 0; }) && answers.length) {
          if (app.ok) {
            classification = 'normal_connectivity';
            message = 'Cloudflare DNS resolved this hostname and the application host responded.';
          } else {
            classification = 'application_host_unavailable';
            message = 'Cloudflare DNS resolved this hostname, but the application host did not respond. DNS interference is one possible explanation; IP routing, TLS, CDN, firewall, or server problems can produce the same result.';
          }
        } else if (!validDns.length && app.ok) {
          classification = 'cloudflare_doh_unavailable';
          message = 'The application host responded, but Cloudflare DNS-over-HTTPS could not be reached or validated.';
        } else if (!validDns.length && !app.ok && !online) {
          classification = 'general_internet_failure';
          message = 'The browser reports no network connection; neither the application nor the DoH endpoint responded.';
        } else if (!validDns.length && !app.ok) {
          // Reached only while online (the offline case is classified above), so
          // both the DoH endpoint and the application host are unreachable with
          // no DNS evidence: that is a connectivity failure with a known cause
          // set, not an inconclusive result.
          classification = 'application_host_unavailable';
          message = 'The browser reports a connection, but the application host and Cloudflare DNS-over-HTTPS did not respond. Network, CORS, TLS, routing, or server availability may be involved.';
        } else if (validDns.length && dnsErrors.length) {
          classification = app.ok ? 'inconclusive' : 'possible_dns_interference';
          message = 'DNS checks returned mixed results. Retry; this is not enough evidence to identify DNS interference.';
        } else if (statuses.some(function (status) { return status !== 0 && status !== 3; })) {
          classification = 'cloudflare_doh_unavailable';
          message = 'Cloudflare DNS returned an error status: ' + validDns.map(function (item) { return item.statusText; }).join(', ') + '.';
        }

        return {
          hostname: host,
          origin: origin,
          // Additive field: the classification the wording above is based on —
          // 'localhost' | 'loopback' | 'private' | 'public-ip' | 'hostname'.
          hostKind: kind || 'hostname',
          resolver: 'Cloudflare DNS (1.1.1.1)',
          endpoint: ENDPOINT,
          checkedAt: new Date().toISOString(),
          classification: classification,
          message: message,
          caveat: caveat,
          online: online,
          dohAvailable: validDns.length > 0,
          dohSkipped: localHost,
          applicationHostAvailable: app.ok,
          possibleDnsInterference: classification === 'application_host_unavailable' && answers.length > 0 && online,
          dns: validDns.map(function (item) { return { type: item.type, status: item.status, statusText: item.statusText, answers: item.answers }; }),
          dnsErrors: dnsErrors.map(function (error) { return { kind: error.kind || 'unknown', message: error.message }; }),
          app: app,
          backend: backend,
        };
      }).catch(function (error) {
        // Probes aborted by the caller reject; report cancellation separately
        // from a probe failure instead of surfacing it as an error result.
        if (error && error.kind === 'cancelled') {
          return cancelledResult(host, origin, context.online !== false, 'Diagnostics were cancelled by the caller.');
        }
        throw error;
      }).finally(function () { inflight.delete(key); });
      if (!callerSignal) {
        inflight.set(key, resultPromise);
        return resultPromise;
      }
      // A run started by a cancelled caller is isolated from the dedup map: it
      // is abandoned the moment the caller aborts, so a later retry has to start
      // a fresh check instead of latching onto a run nobody awaits.
      return untilCancelled(resultPromise, callerSignal, buildCancelled);
    }

    return { check: check };
  }

  root.YouGeDns = {
    endpoint: ENDPOINT,
    create: create,
    check: function (context, options) { return create(options).check(context); },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
