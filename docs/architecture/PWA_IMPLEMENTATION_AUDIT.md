# PWA implementation audit and worker ownership

Audited against `302c338`, then adjusted for the permanent host-worker ownership requirement. The existing implementation is the source of truth; classifications below describe the resulting implementation and note deliberate compatibility changes.

| Capability | Classification | Evidence and boundaries |
| --- | --- | --- |
| Install prompt and guidance | Complete for existing flows | `src/runtime/pwa.js` captures `beforeinstallprompt`, consumes it once, observes `appinstalled`, and offers iOS/generic instructions or configured desktop QR. `tests/install-experience.test.mjs` exercises these flows. The SDK delegates; it does not capture a second prompt. |
| Installed and display mode detection | Partially implemented | `isStandalone()` checks four display modes, iOS `navigator.standalone`, and Android referrer; `getState()` also uses the launch query, accepted prompt and `appinstalled`. Browser tabs cannot generally determine whether a separate installation exists. An accepted prompt is treated as installed for compatibility, not independent proof of completion. Only the standalone media query is observed for changes. |
| Worker registration and ownership | Unsafe before this change; corrected for host ownership | The classic toolkit previously registered its configured worker automatically, potentially replacing a same-scope host worker. It now never registers or unregisters one. The SDK and bridge also remain registration-free. Existing host worker source, registration, scope, caching and event handlers are untouched. |
| Update detection and waiting worker | Partially implemented | When explicitly opted into a host-registered Assistant worker, the toolkit detects an already-waiting worker and observes `updatefound`, exposes `hasUpdate`, watches lifecycle and reconciles on visibility checks. An installation already in progress when lookup resolves may have fired `updatefound` before the listener was attached. Detection also depends on browser behavior and a controlling worker. Custom workers remain under host control. |
| Notification and controlled refresh | Partially implemented | For the opted-in Assistant worker, toolkit state and events feed the SDK notification/action; `applyUpdate()` sends `SKIP_WAITING` to the waiting worker and reloads only when the requested worker controls the page. Duplicate in-flight calls are guarded. The fallback allows retry if activation did not occur. Visibility reconciliation notifies state subscribers but does not dispatch an update event for a newly discovered waiting worker. |
| Status and diagnostics | Complete for existing diagnostic scope | Toolkit `getState()`/`onChange()`, SDK `getState()` and existing on-demand network/DNS diagnostics provide status. Diagnostics are connectivity checks, not comprehensive worker health or installation verification. |
| SDK and integrations | Complete for existing contracts, subject to runtime limitations | SDK installation and update methods delegate to an existing toolkit or explicitly injected host adapter; `bridgePwaGlobals`, browser bundle, widget and React adapters reuse assistant state. Tests include `tests/sdk-integration.test.mjs` and SDK tests. Absent or unsupported worker lookup resolves safely. |

## Migration and explicit integration

**This is a deliberate lifecycle compatibility change:** `PWA.register()` retains its name, signature and promise, but performs a lookup rather than browser registration. `PWA.ready` resolves to a matching opted-in registration or `null`; lookup occurs on load or on an earlier `PWA.register()` call. Existing sites relying on automatic kit registration must migrate their worker ownership into the host. Without a host-registered worker, worker-dependent offline, push, share and update behavior is unavailable. Install UI and diagnostics remain independent. `PWA.ready` is the first lookup result and cannot change after it settles. If the host registers the optional worker later, call `PWA.register()` again: it retries the lookup and resolves to the matching registration without a reload. Concurrent calls share one lookup.

For a project **without an existing worker**, the project owner may deliberately configure and register the optional `you-ge-sw.js` using the host's own deployment and registration lifecycle, with an appropriate scope. This is the host's decision, not an Assistant registration operation. After that registration exists, add `data-assistant-worker` to the `pwa.js` script tag to opt in to the toolkit worker protocol. `data-sw` specifies the expected Assistant worker URL; only the canonical worker or existing compatibility shim next to the runtime is accepted. All active, waiting and installing scripts must match that URL. The attribute is an assertion by the host that it has installed the actual Assistant worker at that URL, not an automatic proof of worker source. Do not opt in if that URL serves a custom worker. `data-sw-scope` remains available as compatibility configuration; it does not change the host's registration scope. Checking first and then registering is not atomic and is not a safe way for the toolkit to avoid replacing a host worker.

For an **existing custom worker**, leave `data-assistant-worker` absent. The runtime will not query, register, update, message or take over that worker. Keep the host's install, caching and update code intact. To surface the host's update UI through the SDK, inject an adapter using the existing API; the host implements the following methods by delegating to its own update mechanism:

```js
const assistant = YouGeAssistant.create({ projectId: 'my-app' }, {
  pwa: {
    getState: () => ({ hasUpdate: hostUpdates.isAvailable() }),
    onChange: (listener) => hostUpdates.subscribe(() => listener({ hasUpdate: hostUpdates.isAvailable() })),
    applyUpdate: () => hostUpdates.apply(),
  },
});
```

`hostUpdates` represents existing application code, not a provided API. Include installation methods in the adapter if that SDK instance also needs toolkit installation delegation. The host owns all effects and decides if and when to refresh. The classic toolkit will not send `SKIP_WAITING`, invoke `registration.update()` or reload for a custom worker, even when `data-auto-update` is present. Worker-specific toolkit push and messaging likewise require an opted-in Assistant worker; host push integrations remain the host's responsibility.

No public method signatures, aliases, versions or storage keys changed. Successful `applyUpdate()` means a request was sent, not that activation is guaranteed. If no control change occurs after three seconds, the page stays in place and the waiting update remains retryable; a later unsolicited `controllerchange` does not force a reload. Node harnesses exercise custom-worker isolation, host adapter delegation, no-worker behavior, lookup failures, opted-in updates and fallback; real browsers and deployed host integrations have not been tested.

## Registration compatibility audit and migration

Repository search for `PWA.register()`, `YouGePWA.register()`, `progressier.register()` and `serviceWorker.register()` found no application production call sites: direct calls are in the runtime tests and compatibility documentation; `PARITY.md` lists the legacy alias. The classic runtime previously registered automatically on load and `PWA.register()` and `progressier.register()` triggered that path early. `examples/demo/index.html` observes the controller and `navigator.serviceWorker.ready`; without a host registration the latter can remain pending. The SDK does not register workers. Repository search cannot identify downstream applications, which must be inventoried by their owners.

Existing applications that depended on `pwa.js` alone to register the worker, called either registration API expecting it to perform registration, or relied on `data-sw`/`data-sw-scope` to change a browser registration require migration. Their host must deliberately take ownership of registration and scope, and opt in with `data-assistant-worker` only for the actual Assistant worker. Example host-side sequencing, after the project owner has established that this deployment has no existing or competing service worker and has chosen the Assistant worker:

```js
// Run under the host's existing registration policy, not as an automatic
// Assistant migration or a check-then-register test for worker ownership.
const registration = await navigator.serviceWorker.register('/you-ge-sw.js', { scope: '/' });
// The pwa.js script has data-assistant-worker and has already initialized.
const connected = await window.YouGePWA.register();
if (!connected) console.warn('Assistant worker integration was not connected');
```

A host must coordinate with its own framework, other tabs and registration logic; checking for no registration immediately before registering is not an atomic ownership guarantee. Do not use this recipe on a host with an existing worker. Preserve that worker and use an SDK adapter for its update lifecycle. Calling `register()` without the opt-in, or with a custom worker, returns `null` without registration. `PWA.ready` remains the initial result, so use the returned promise from a later `register()` call after the host has registered. Unsupported browsers and failed lookups return `null`; registration errors in the host's own call remain the host's responsibility. Globals, aliases and method signatures remain, but automatic registration is intentionally no longer backward-compatible because it could replace a host worker.

## Feature-control audit and remaining work

| Requested control | Existing capability | Gap |
| --- | --- | --- |
| Installation detection and guidance | `modules.installation` gates SDK installation UI/delegation; domain `features.installation` gates classic guidance. | Detection and guidance are not independently configurable across SDK and classic runtime. |
| Update detection | `modules.updates` gates SDK update presentation and action. | No independent detection gate; the opted-in classic toolkit still observes updates. |
| Update notifications | `modules.updates` gates SDK update notifications. | Not independent from SDK update action; classic update prompt has separate behavior. |
| Automatic activation | Classic `data-auto-update` is opt-in and defaults off. | No shared SDK/admin control. |
| User-controlled update/refresh | SDK `modules.updates` gates `applyUpdate()` and its action; toolkit `applyUpdate()` exists. | No independent shared control. |
| Offline diagnostics | Existing `modules.diagnostics` and classic domain diagnostics feature gate on-demand DNS/network diagnostics. | No independent offline diagnostics control. |
| Cache diagnostics | None found. | No existing cache diagnostics or control; design must avoid inspecting or modifying host-owned caches without authorization. |

The SDK configuration normalizer in `packages/assistant-sdk/src/config/index.js` only accepts keys in `BUNDLED_DEFAULTS.modules`; adding consistent independent controls requires SDK changes and regeneration of `src/assistant/assistant-state.js` via `npm run sync:sdk`. That bundle is one of the service worker's 13 precached assets. Repository policy and `npm run check:precache` require a synchronized kit version bump when it changes. The requested pinned kit `1.2.2` and prohibition on weakening the gate therefore block a complete, consistent implementation. No parallel classic-only configuration or unsynchronized SDK behavior was added. Owner direction is needed to reconcile these constraints before implementing and testing the controls; the permanent architectural rule is recorded in `AGENTS.md`.
