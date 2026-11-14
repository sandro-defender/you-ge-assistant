/*!
 * @youge/assistant-sdk/diagnostics — diagnostics integration adapter
 * -------------------------------------------------------------------
 * Integrates with the existing DNS diagnostics module (YouGeDns / PWA) or an
 * explicit local runner without duplicating the DoH engine, issuing hidden
 * network requests, or introducing automatic polling.
 */

import { safeText } from '../core/sanitize.js';

const DNS_FAILURE_CLASSIFICATIONS = [
  'nxdomain',
  'dns_resolution_failure',
  'dns_records_missing',
  'possible_dns_interference',
  'dns_failure',
  'dns-error',
  'dns_failed',
  'missing_address_records',
  'servfail',
  'refused',
];

const CONNECTIVITY_FAILURE_CLASSIFICATIONS = [
  'general_internet_failure',
  'application_host_unavailable',
  'backend_unavailable',
  'error',
  'timeout',
];

// A caller-cancelled run is neither a DNS nor a connectivity failure: the user
// stopped it, so no critical notice may be raised from it.
export function isCancelledResult(dns) {
  if (!dns || typeof dns !== 'object') return false;
  return dns.cancelled === true ||
    String(dns.status || '').toLowerCase() === 'cancelled' ||
    String(dns.classification || '').toLowerCase() === 'cancelled';
}

export function cancelledDiagnosticsResult(reason) {
  return {
    status: 'cancelled',
    classification: 'cancelled',
    message: safeText(reason, 200) || 'Diagnostics were cancelled.',
    failed: false,
    cancelled: true,
  };
}

export function dnsFailure(dns) {
  if (isCancelledResult(dns)) return false;
  const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
  return DNS_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1;
}

export function connectivityFailure(dns) {
  if (isCancelledResult(dns)) return false;
  const classification = String((dns && dns.classification) || 'unknown').toLowerCase();
  return CONNECTIVITY_FAILURE_CLASSIFICATIONS.indexOf(classification) !== -1 || Boolean(dns && dns.failed);
}

export function normalizeDnsResult(result, DateCtor) {
  const raw = result && typeof result === 'object' ? result : {};
  const DateImpl = DateCtor || Date;
  const status = String(raw.status || 'complete');
  const classification = safeText(raw.classification || 'unknown', 60);
  const cancelled = raw.cancelled === true || status.toLowerCase() === 'cancelled' || classification.toLowerCase() === 'cancelled';
  const normalized = {
    status: cancelled ? 'cancelled' : status,
    classification: cancelled ? 'cancelled' : classification,
    message: safeText(raw.message || '', 240),
    checkedAt: raw.checkedAt ? safeText(raw.checkedAt, 60) : new DateImpl().toISOString(),
    failed: cancelled ? false : Boolean(raw.failed),
  };
  if (cancelled) normalized.cancelled = true;
  else if (typeof raw.cancelled === 'boolean') normalized.cancelled = raw.cancelled;
  return normalized;
}

export function resolveDiagnosticsRunner(options) {
  const opts = options || {};
  if (opts.services && typeof opts.services.diagnostics === 'function') {
    return opts.services.diagnostics;
  }
  const pwa = typeof opts.getPwa === 'function' ? opts.getPwa() : opts.pwa;
  if (pwa && typeof pwa.runNetworkDiagnostics === 'function') {
    return function (runOptions) {
      return pwa.runNetworkDiagnostics(runOptions);
    };
  }
  const dns = typeof opts.getDns === 'function' ? opts.getDns() : opts.dns;
  if (dns && typeof dns.check === 'function') {
    return function (runOptions) {
      const ctx = typeof opts.getContext === 'function' ? opts.getContext() : (opts.context || {});
      const context = {
        hostname: ctx.hostname,
        origin: ctx.origin,
        basePath: ctx.basePath || '/',
        online: ctx.online !== false,
      };
      // Probe paths change the effective app/backend diagnostic target, so the
      // engine must receive the same ones the assistant's DNS identity uses.
      if (typeof ctx.appProbePath === 'string' && ctx.appProbePath) context.appProbePath = ctx.appProbePath;
      if (typeof ctx.backendProbePath === 'string' && ctx.backendProbePath) context.backendProbePath = ctx.backendProbePath;
      return dns.check(context, runOptions);
    };
  }
  return null;
}

/** Normalizes the accepted signal shapes (an AbortSignal or `{ signal }`). */
export function resolveRunSignal(signal) {
  if (!signal) return null;
  const candidate = typeof signal.addEventListener === 'function'
    ? signal
    : (signal.signal && typeof signal.signal === 'object' ? signal.signal : null);
  if (!candidate || typeof candidate.addEventListener !== 'function') return null;
  return candidate;
}

export function createDiagnosticsIntegration(options) {
  const opts = options || {};
  const AbortImpl = opts.AbortController || (typeof AbortController !== 'undefined' ? AbortController : null);
  let inFlight = null;
  // Per-run ownership record: the run that started last owns the controller,
  // its abort listeners and its detach function. A run's finalizer retires
  // only its own record, so a stale run can never detach a newer run's
  // controller or strip a newer run's caller abort listener.
  let currentRun = null;
  // Bumped by `clear()`: a run that was cleared must never report a result
  // afterwards, otherwise an abandoned check could overwrite newer state.
  let generation = 0;

  function run(runOptions) {
    if (inFlight) return inFlight;
    const runOpts = Object.assign({}, runOptions || {});
    const callerSignal = resolveRunSignal(runOpts.signal);
    if (callerSignal && callerSignal.aborted) {
      const cancelled = cancelledDiagnosticsResult('Diagnostics were cancelled before they started.');
      if (typeof opts.onResult === 'function') opts.onResult(cancelled);
      return Promise.resolve(cancelled);
    }
    const runner = resolveDiagnosticsRunner(opts);
    if (!runner) {
      const unavailable = {
        classification: 'unknown',
        message: 'Network diagnostics are not available on this page.',
        status: 'unavailable',
      };
      if (typeof opts.onResult === 'function') opts.onResult(unavailable);
      return Promise.resolve(unavailable);
    }

    // One controller per run, always. The caller's signal (if any) is bridged
    // onto it, so `clear()` — which `destroy()` calls — can always stop the run,
    // the caller's own signal is never mutated here, and a cancellation is
    // tracked separately from a timeout or an ordinary probe failure.
    let cancelled = false;
    let onOwnAbort = null;
    let onCallerAbort = null;
    let runController = null;
    if (AbortImpl) {
      runController = new AbortImpl();
      onOwnAbort = function () { cancelled = true; };
      runController.signal.addEventListener('abort', onOwnAbort, { once: true });
    }
    if (callerSignal) {
      onCallerAbort = function () {
        if (runController) {
          try { runController.abort(); } catch (error) { /* already settled */ }
        } else {
          cancelled = true;
        }
      };
      if (callerSignal.aborted) onCallerAbort();
      else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }
    const runDetach = function () {
      if (callerSignal && onCallerAbort) callerSignal.removeEventListener('abort', onCallerAbort);
      if (runController && onOwnAbort) runController.signal.removeEventListener('abort', onOwnAbort);
    };
    const signal = runController ? runController.signal : callerSignal;
    if (signal) runOpts.signal = signal;
    else delete runOpts.signal;

    const runGeneration = generation;
    const stillCurrent = function () { return runGeneration === generation; };
    // This run owns its controller, its abort listeners and this detach
    // function. Nothing else may retire them while this run is current.
    const record = { controller: runController, detach: runDetach, generation: runGeneration };
    currentRun = record;
    if (typeof opts.onStart === 'function') opts.onStart();
    const finished = Promise.resolve()
      .then(function () {
        // Cancelled before the runner started: skip the network work entirely.
        if (cancelled) throw Object.assign(new Error('Diagnostics were cancelled.'), { kind: 'cancelled' });
        return runner(runOpts);
      })
      .then(function (result) {
        // Once the run was cancelled, a late resolution is discarded: a
        // cancellation must never turn into a reported result.
        if (cancelled) {
          const stopped = cancelledDiagnosticsResult('Diagnostics were cancelled.');
          if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(stopped);
          return stopped;
        }
        const safeResult = result && typeof result === 'object' ? result : {};
        if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(safeResult);
        return safeResult;
      })
      .catch(function (error) {
        // A run stopped by its own signal is a cancellation, never a failure.
        if (cancelled || (error && error.kind === 'cancelled')) {
          const stopped = cancelledDiagnosticsResult('Diagnostics were cancelled.');
          if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(stopped);
          return stopped;
        }
        const failed = {
          classification: 'error',
          message: safeText(error && error.message, 200) || 'Diagnostics failed.',
          status: 'error',
          failed: true,
        };
        if (stillCurrent() && typeof opts.onResult === 'function') opts.onResult(failed);
        return failed;
      })
      .then(function (finalResult) {
        if (inFlight === finished) inFlight = null;
        // Per-run ownership: retire only this run's own record, and only
        // while it still owns the current slot. An older run that was cleared
        // (or replaced by a newer run) must never detach the newer run's
        // controller or remove the newer run's caller abort listener.
        if (currentRun === record) {
          currentRun = null;
          record.detach();
        }
        return finalResult;
      });
    inFlight = finished;
    return inFlight;
  }

  function clear() {
    // Invalidate the current run first: whatever it reports from here on is
    // discarded, so a late response can neither raise a notice nor overwrite
    // state that belongs to a different project or domain. Retiring the
    // record before aborting/detaching makes the run's own late finalizer a
    // no-op, so it can never touch a run started afterwards.
    generation += 1;
    const run = currentRun;
    if (run) {
      currentRun = null;
      if (run.controller) {
        try { run.controller.abort(); } catch (error) { /* already settled */ }
      }
      run.detach();
    }
    inFlight = null;
  }

  return {
    run: run,
    clear: clear,
    isRunning: function () { return Boolean(inFlight); },
  };
}
