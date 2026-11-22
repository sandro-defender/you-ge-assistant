# Staff cross-origin recovery: information and evidence request

**Audience:** the Arena.ai agent inspecting the Staff application.
**Purpose:** collect the existing, reviewable facts needed for a separate SDK agent to finish a generic cross-origin recovery capability safely. This is **not** authorization to change Staff, install an SDK version, implement a new transfer protocol, deploy, or expose secrets. Read-only inspection and sanitized evidence only. Do not modify Staff PR #272.

**Scope and status:** SDK repository `sandro-defender/you-ge-assistant`, task branch `arena/b982ceb9-you-ge-assistant`, baseline `82a1ba36f290889f37c56d7c282b0d0112a402be`, draft PR #55. The source inspected here reports SDK `0.4.0`. Staff source, Staff's existing recovery/authentication protocol, and the referenced SDK `docs/architecture/assistant-sdk-cross-origin-recovery-change-request.md` are not in this checkout. Therefore all statements about Staff below are **questions, not claims**. Mark each requested item `existing`, `missing`, `unnecessary` (with justification), or `needs confirmation`, and give commit-pinned file/line evidence. `Missing` is a valid answer; do not invent an endpoint, field, behavior, policy, key or token.

## 1. Verified SDK architecture and constraints

| Verified SDK evidence | What it does — and does not do |
| --- | --- |
| `packages/assistant-sdk/package.json`, `src/index.js`, `src/index.d.ts` | Existing public `AssistantInstance` has `configure`, `getState`, `subscribe`, `setEndpointStatus`, `setSessionStatus`, `runDiagnostics`, `destroy`; no public recovery controller, recovery configuration, auth hook or session transfer API. Package exports do **not** expose `src/recovery/foundation.js`. |
| `src/assistant/index.js` `setEndpointStatus` / `setSessionStatus`; `src/index.d.ts` | Host-reported presentation conditions only. `primary`: `unknown|healthy|failed|unavailable|degraded`; `backup`: `unknown|active|inactive|failed`; `active`: `primary|backup|unknown`; session: `unknown|ok|issue`. These are **not** server authorization, destination-session verification or confirmed transport failures. |
| `src/recovery/foundation.js` `validateRecoveryConfiguration` and tests `sdk-recovery-foundation.test.mjs` | Internal, disconnected prototype validates explicit project/environment, a finite list (1–32), distinct canonical HTTPS origins, unique environment IDs/origins and exact selected origin. A successful selected environment is frozen. It does **not** attach a controller, start health checks or navigate. Strict canonical origin strings such as `https://primary.example` omit even the trailing `/`; values like `https://PRIMARY.example` or `https://primary.example:443` are rejected rather than normalized. |
| `src/recovery/foundation.js` `inspectVerifiedPolicy` and tests `sdk-recovery-policy-foundation.test.mjs` | Internal, disconnected metadata checker, **not** a signature verifier or a policy delivery mechanism. It compares already-verified claims to caller-supplied trusted scope/checkpoint and clocks; validates `automatic|manual`, numeric revision, revocation, expiry, 30-second max issuance age and 250 ms wall/monotonic elapsed-clock tolerance. Neither the checkpoint nor receipt clocks may be derived from untrusted storage. The values and tolerance are prototype choices requiring review, not Staff protocol facts. |
| `src/diagnostics/index.js` `createDiagnosticsIntegration`, `connectivityFailure` | Delegated diagnostics with cancellation/generation handling; broad classifications such as generic error/failed are not sufficient proof for automatic fallback. Browser failures do not establish DNS filtering, IP blocking, TLS or CORS cause. |
| `src/core/capabilities.js`, `src/adapters/react.js` `dispatchAssistantAction`, `src/assistant/assistant-widget.js` `dispatchAction` | Recovery/failover flags gate presentation/actions. Current React and classic actions emit actionable `youge:action`; no SDK recovery navigation executor exists. Existing host event consumers must be identified for later migration, not disabled in this information task. |
| `src/domain/index.js` `resolveDomain`, `safeNavigationUrl`; `src/config/index.js` | Domain matching supports wildcard/presentation use and ordinary configuration may use local LKG. Neither provides the exact environment isolation and trusted policy authority required for recovery. `safeNavigationUrl` alone is not a recovery destination allowlist. |
| `src/adapters/react.js` and `src/assistant/index.js` | External store, subscriptions and cleanup exist, but immutable recovery lifecycle, recovery-specific React handling and exclusive controller ownership are not implemented. |

The previous progress report is `docs/architecture/assistant-sdk-cross-origin-recovery-progress-report.md`. Independent source checks above, not that report alone, establish this status. **No `configureRecovery`, `assistant.recovery`, recovery hook, typed lifecycle event or navigation contract exists yet.** References to those below are *future SDK integration points*, not instructions to call an existing API.

### Target constraints to assess, not claims about Staff

- One logical administrator-controlled Automatic/Manual policy for the project, with independently scoped Production and Preview policy delivery and authorization. A Production grant must not authorize Preview or vice versa. Host owns policy persistence, admin authorization and distribution.
- Explicit trusted project/environment/origin configuration; exact current document origin equals one configured role. Primary/fallback are the same logical application/workspace **within** one environment. No suffix/wildcard trust or environment selection from hostname alone.
- Eventual SDK owns one controller and one navigation executor. Automatic fallback requires two confirmed consecutive transport-unreachable/timeouts plus valid configuration, fresh policy, positive destination readiness, visible/eligible document, unsaved-work approval, host authorization, valid session transition and final rechecks. Offline, a single timeout, cancellation, HTTP 401/403/4xx/5xx, opaque responses and redirects do not independently qualify. Readiness is not authenticated-session verification.
- SDK fallback navigation must be to the exact configured destination **origin root**, without forwarding pathname, query, fragment, private state or credentials. Return to primary is user-confirmed even under Automatic policy and uses the same gates. Scheduled navigation is not proof of arrival. A separately reviewed host authentication protocol may have its own redirects, but it must not cause SDK fallback navigation to carry credentials in URLs or bypass root-navigation and destination validation requirements. If the existing protocol cannot satisfy these constraints, report the incompatibility; do not invent or weaken a replacement.
- No credentials, session tokens or authorization grants in SDK state/events/logs/telemetry, URLs, query strings or fragments. No broad credential-sharing CORS; no assumption that cross-origin cookies, storage or service workers are shared. Destination must independently validate its own session. Unsaved work remains host-owned.

## 2. Instructions for evidence and response

For **each numbered request**, return all eight: (1) exact information, (2) relevance/dependency, (3) actual format and values or explicit absence, (4) Staff owner/component, (5) evidence with repository commit + path + line range and tests, (6) security and isolation implications, (7) mapped SDK integration point listed below, (8) status. The Staff owner paths below are **search starting points**, not assertions they exist. If paths have moved, search and identify replacements.

Provide exact non-secret deployment values where authorized; otherwise provide a protected pointer plus a deterministic synthetic value and state what must be verified privately. Redact real user identifiers, cookies, passwords, bearer/session tokens, OAuth authorization codes, keys, secrets, database rows and real payloads. Sanitized examples must preserve structure, constraints, status codes and timing, and say explicitly that all values are synthetic. Never run against production credentials or mutate production state. Include repo revision/environment and distinguish source intent, deployed configuration and observed behavior; evidence of one is not proof of the others.

### SDK-owned data shapes available for comparison — **internal prototype only**

These are exact fields consumed by the current private helper, not a Staff API or an agreed public SDK contract:

```ts
// validateRecoveryConfiguration(input, documentOrigin)
type PrototypeConfig = {
  projectId: string; activeEnvironmentId: string;
  environments: Array<{ projectId: string; environmentId: string; revision: string;
    primaryOrigin: string; fallbackOrigin: string }>;
};
// IDs/revision: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/; exact canonical HTTPS
// origins; 1–32 entries; all IDs and origins unique; current origin exact match.
// Returns {ok:true, environment, role:'primary'|'fallback'} or a redacted error.

type PrototypeVerifiedClaims = {
  projectId: string; environmentId: string; configRevision: string;
  issuer: string; audience: string; mode: 'automatic'|'manual';
  revision: number; issuedAt: number; expiresAt: number; revoked: false;
};
// inspectVerifiedPolicy also needs trusted {projectId, environmentId,
// configRevision, issuer, audience, minimumRevision, receivedAt,
// receivedMonotonic, now, monotonicNow}. Times are integer milliseconds;
// revision is a nonnegative safe integer. Verification and trustworthy
// checkpoint/receipt acquisition are NOT implemented by this function.
```

If Staff's actual types differ, supply the actual ones and mapping/evidence; do not change Staff to match this prototype. The SDK team must assess compatibility, freshness, clock behavior and whether this prototype should change.

## 3. Numbered Staff information checklist

### 1. Deployment identity and exact origin registry
- **Information / format:** For every relevant environment, return a table: stable project/workspace identity; explicit environment ID; trusted configuration revision and format; exact canonical HTTPS primary origin and fallback origin including non-default ports; which deployment owns each; whether both serve the same application/workspace/data; identity of any extra aliases and their intended rejection/handling. Give origins as origins only, no path/query/fragment. Describe source of configuration, who can change it, deployment trust and how revisions propagate/invalidate.
- **Why / SDK point:** needed by eventual instance-owned trusted configuration and current internal `validateRecoveryConfiguration`; not by hostname-based domain resolution.
- **Staff owner / evidence:** deployment/configuration owner, build/environment config, ingress/route config and config-validation tests; cite exact files/lines plus sanitized per-environment table and authoritative revision source.
- **Security:** production and preview must not share authorization; identify overlapping origins and whether this conflicts with prototype's global origin uniqueness; never take trust from query parameters, arbitrary host aliases or local preferences.
- **Status:** required; Staff values **missing** from this checkout.

### 2. Entry points, current controller and complete navigation sequence
- **Information / format:** Ordered sequence diagram for primary→fallback and fallback→primary, including triggers, document origin, exact root/path, HTTP redirect status and `Location` semantics at every hop, frontend/backend actor, side effects, timing and whether a hop is automatic or user-confirmed. Include direct fallback startup, refresh, back button, retry, multiple tabs and primary unreachable before SDK load. State which existing listeners/timers/components actually navigate, and whether direct fallback startup redirects back to primary.
- **Why / SDK point:** future exclusive controller, action dispatch, navigation executor, cooldown/loop prevention and compatibility with exact root-only navigation.
- **Staff owner / evidence:** search `src/shared/assistant-recovery.ts`, frontend recovery/bootstrap/router and handlers of `youge:action`, `location`, redirects; provide source + tests and sanitized network trace. These are leads, not verified file existence.
- **Security:** identify open redirect and URL-derived targets, credentials/private state in every hop; report any incompatibility with exact-root navigation rather than changing the protocol. Do not remove the existing controller during this task.
- **Status:** required; actual flow **needs confirmation**.

### 3. Identity, authentication and Google OAuth
- **Information / format:** Describe authentication provider(s), user identity key and account/workspace binding; existing browser→provider→callback→session sequence with actual host/path/method and all relevant cookie/redirect boundaries. For Google OAuth if used, report callback URI registrations per environment, state/nonce/PKCE use and validation, exact callback/continuation semantics, errors, expiry and account-selection behavior. If not used, mark unnecessary and identify actual provider. Explain which origin verifies identity and whether a session is already established at the other origin.
- **Why / SDK point:** future host auth/session adapter and destination-session verification; identity continuity is not established by SDK `setSessionStatus`.
- **Staff owner / evidence:** authentication frontend/backend; inspect `src/backend/backup-auth/oauth.ts` if present, OAuth callback routes, middleware and tests. Provide redacted synthetic sequence and configuration references, never provider credentials or real OAuth codes.
- **Security:** callback and provider protocols may themselves have URL parameters; enumerate precisely, identify sensitive values and exposure without asserting they are acceptable for SDK fallback navigation. Verify state binding, replay, environment and redirect URI isolation. If existing flow requires a credential in SDK destination URL, flag incompatibility.
- **Status:** required; Google OAuth and identity model **need confirmation**.

### 4. Existing session representation, verification and revocation
- **Information / format:** Enumerate session mechanisms (cookie, server record, bearer token or other), where authoritative state lives, account identity/workspace/environment binding, issuance, idle/absolute expiry and refresh, sign-out/revocation propagation, session version/epoch and all server checks. Supply a **redacted field inventory**, not session material: field name, type, meaning, authoritative source, optionality and whether credential/PII. Give exact server-side method/endpoint for destination independently determining authenticated identity and environment; specify request/response/status/failure shapes per §4.
- **Why / SDK point:** future session invalidation, destination-auth-required state and same-account confirmation before/after navigation; a client-side status or readiness response is not authorization.
- **Staff owner / evidence:** session middleware, auth boundary, session store, sign-out handlers and expiry/revocation tests; inspect `src/backend/backup-auth/boundary.ts` and `store.ts` if present.
- **Security:** do not supply real cookie/token/session values; identify timing and races where a revoked source or wrong account could retain a destination session; specify safe behavior that does not invalidate a usable fallback session.
- **Status:** required; **needs confirmation**.

### 5. Existing handoff/recovery protocol and precise wire contract
- **Information / format:** First answer whether an existing cross-origin handoff is used, fresh sign-in only, or neither. Provide the actual end-to-end protocol, not a proposed replacement: issuance/preparation, transport, redemption, destination validation and cleanup. For **each** request and response, complete the endpoint worksheet in §4. Include the actual field names/types and required/optional status for all of the following semantic items **where they exist**, or explicitly `absent`/`not applicable`: source and destination environment/origin/role; project/workspace; authenticated subject or opaque account binding; intended audience; authorization scope/decision; unique identifier/nonce; issuance/expiry/TTL and clock skew; use count/atomic single-use enforcement; credential transport and confidentiality; proof of possession or browser binding if any; preparation outcome; redemption/session establishment outcome; errors and safe retry semantics. Describe server-side validation of each, rejection status/code, replay store and atomicity, cancellation/revocation/sign-out behavior, duplicate submissions, concurrent tabs, idempotence and failure after partial completion. Give exact timing/expiry transitions and both directions separately.
- **Why / SDK point:** future lifecycle hooks must call a reviewed existing host protocol without exposing secret material or reporting a prepared session as authenticated. No hook signatures or token formats exist in the SDK yet.
- **Staff owner / evidence:** `src/backend/backup-auth/protocol.ts`, `boundary.ts`, `store.ts`, `oauth.ts`, `src/backend/routes/assistant-recovery.ts` if present; associated services, migrations, rate-limit/replay logic and positive/negative tests. Provide sanitized request/response examples and a step-by-step trace for success, expired, revoked, replayed, wrong-environment and wrong-account cases.
- **Security:** never send a real token, credential, key or user record. Identify if any credential traverses a URL/query/fragment, localStorage or logs, or if redirects to arbitrary paths are required. If any such behavior conflicts with the target, state exact file/function and stop; do not suggest SDK workarounds. If no safe protocol exists, report **missing** rather than inventing issuance or a short-lived token.
- **Status:** required; existence, format and safety **unknown**.

### 6. Authorization and administrative global policy
- **Information / format:** Provide actual project-wide Automatic/Manual persistence record and how one logical setting/revision applies to Production and Preview; administrator identity, per-environment authority, authorization rules, concurrency/CAS, revision ordering, audit/revocation and per-environment distribution. For each environment enumerate exact trusted policy issuer, audience, project/environment claims, configuration revision binding, mode, issued-at, expiry, numeric/other revision, revocation indicator, signing/verification algorithm, key identifiers/rotation, trusted checkpoint and validity/freshness behavior, with the real schema or explicit `absent`. Describe policy update while evaluation is pending, authority unreachable, cold start, clock skew and a trusted revision high-water source. Report whether any fallback/independent environment-local authority remains reachable when primary is unreachable. Distinguish policy authentication from transition/session authorization.
- **Why / SDK point:** future policy acquisition/verifier and controller epoch; existing `inspectVerifiedPolicy` merely checks supplied authenticated metadata. Prototype's 30 seconds is not established as a Staff fact. A browser cache alone is not a trusted authority or rollback checkpoint.
- **Staff owner / evidence:** `src/backend/services/recovery-policy.ts`, `src/frontend/recovery-permission.ts`, admin settings/permissions and routes if present; tests and deployment distribution config; policy endpoint worksheet in §4. Provide only public verification material or protected references, never signing secrets.
- **Security:** show Preview cannot accept Production claims/grants, or vice versa, even when policy revision/mode is logically common. Explain revocation maximum latency, key rotation and stale authority failure; if verified fresh policy cannot be obtained, automatic switching must remain blocked.
- **Status:** required; policy distribution and authorization **need confirmation**.

### 7. Endpoint health, readiness and outage observations
- **Information / format:** For each primary/fallback and environment, identify actual anonymous health/readiness path, method, exact success/status/body semantics, cache headers, credentials, redirects and expected CORS response to the opposite configured origin. Supply timeout/retry guidance, health-vs-readiness distinctions, and examples for degraded/401/403/4xx/5xx/redirect/opaque/offline/network timeout. Explain what positive readiness means operationally and what it does not prove about sessions.
- **Why / SDK point:** future host-provided readiness adapter, primary failure confirmation and sustained restoration monitor. Core repository rule excludes hidden SDK fetch and interval polling; the host probe may not choose an arbitrary destination origin.
- **Staff owner / evidence:** health routes, middleware, CORS/cache/ingress and tests; sanitized HTTP samples using §4. Demonstrate intended `no-store`, bounded timeout, omitted credentials, readable positive response and redirect rejection or mark incompatibilities.
- **Security:** no broad credential-sharing CORS; unknown/opaque/redirected destination readiness must not authorize automatic switch. Do not label DNS/IP filtering as proven from browser exceptions.
- **Status:** required; endpoints and semantics **need confirmation**.

### 8. Browser session/cookie boundaries
- **Information / format:** Per environment and origin, list cookie **names or redacted identifiers**, purpose, issuer, `Secure`, `HttpOnly`, `SameSite`, `Domain` (host-only versus shared scope), `Path`, expiry and `Partitioned` if applicable; distinguish production/preview and source/destination. Explain CORS credentials, CSRF/origin checks and storage mechanisms. Supply tested browser matrix for top-level cross-origin navigation, OAuth redirects and fallback boot: browser/version/OS, normal/private/installed PWA, same-site vs cross-site, third-party-cookie restrictions and actual results.
- **Why / SDK point:** future auth/session hook compatibility and destination verification; origin differs even where browser same-site rules might differ.
- **Staff owner / evidence:** cookie serialization, auth middleware, CORS/CSRF configuration, browser integration tests and sanitized response headers; no real Set-Cookie values.
- **Security:** `Domain` scope or same-site behavior is not a substitute for independent environment authorization; do not assert cross-origin storage/service-worker sharing or request broad credential CORS. Separate synthetic/jsdom results from native-device acceptance.
- **Status:** required; attributes and real-browser behavior **need confirmation**.

### 9. Infrastructure, routing, storage and isolation
- **Information / format:** List deployment topology per environment, edge/Worker route patterns, binding names/types (not values), D1/KV/durable-object or other storage schema names and relevant columns/indexes/unique constraints, transactions, TTL/cleanup, multi-region consistency, rate limiting, ingress/egress and policy/health reachability when the primary is down. State explicitly if Cloudflare Workers or D1 are not used. Describe where auth, replay, policy and readiness authorities run and whether preview/production share any backing service or keys.
- **Why / SDK point:** feasibility of host auth adapter, independent policy, single-use redemption and cross-tab coordination; SDK cannot enforce server-side replay or cross-origin global locking with local browser storage.
- **Staff owner / evidence:** deployment manifests, sanitized route/binding configuration, migrations, stores, integration tests and topology diagram, with revision. No binding secrets, private D1 data, credentials or access tokens.
- **Security:** environment-scoped audience and server-side enforcement even if infrastructure is shared; prove atomic use/revocation and avoid exposing internal topology/secret values beyond approved channels.
- **Status:** required; infrastructure use and isolation **need confirmation**.

### 10. Fallback landing, failure and application-state continuity
- **Information / format:** Give exact behavior when fallback root loads with existing valid destination session, prepared-but-unredeemed handoff, absent/expired/invalid session, signed-out user, wrong account, unavailable authority, and authentication/redirect failure. Explain actual message and available retry/sign-in actions. Describe restoration of workspace, route and unsaved work: what is server-persisted, host-managed, transient, or lost; when unsaved-work veto applies; whether any navigation currently forwards paths, query, fragments or private state. Explain primary-return behavior when auth is unavailable and whether current code automatically returns.
- **Why / SDK point:** future destination-session state, host unsaved-work hook, user-confirmed return and UI integration. SDK cannot promise restoration of private state; exact origin-root navigation forbids forwarding arbitrary route/private state.
- **Staff owner / evidence:** fallback bootstrap/router, recovery UI, unsaved-change guards, session checks and tests; sanitized behavior matrix for each case. Include precise redirect and error examples via §4.
- **Security:** do not silently discard unsaved work or destroy a usable fallback session; no credential/private state in URL or SDK events. If route restoration requires disallowed URL data, identify exact incompatibility rather than proposing an insecure workaround.
- **Status:** required; landing and state restoration **need confirmation**.

### 11. Existing SDK integration, ownership, cancellation and UI
- **Information / format:** Identify installed SDK version/source and its real import/attachment locations; every assistant instance/root, React/classic renderer, `youge:action` listener and existing recovery trigger/executor. Enumerate exact host APIs/events for unsaved-work approval, sign-out, session revocation, policy/config changes, document eligibility, cancellation and teardown, including timing and lifetime. List accessible UI surfaces, focus behavior and who controls manual fallback and return; provide user-facing non-sensitive failure categories.
- **Why / SDK point:** future instance lifecycle, `subscribe`/React external store, event/action dispatch and epoch invalidation. Existing SDK action event remains actionable today; future migration must remove or delegate competing host navigation only when SDK is complete and approved.
- **Staff owner / evidence:** SDK bridge/bootstrap, React providers, recovery components, router/action listeners and tests; include source line references and a call graph.
- **Security:** no duplicate execution, unsafe action replay or credentials in UI/event payloads; client conditions do not establish server authorization. Do not implement new host orchestration or change the current one in this information task.
- **Status:** required; integration and event inventory **needs confirmation**.

### 12. Test evidence and unresolved incompatibilities
- **Information / format:** Provide test inventory as `path :: test name :: environment/fixture :: observed assertion :: covers/does not cover`, with exact commands and result counts if actually run. Include synthetic fixtures for isolated Production/Preview policy and authorization, exact origins, failure classifications, redirect/opaque behavior, readiness, consent veto, auth rejection/expiry, session revocation/sign-out, one-time replay, concurrent tabs, destination verification, fallback failure and user-confirmed return. Report missing coverage rather than fabricate it. Provide architecture/change-request documentation if available.
- **Why / SDK point:** informs SDK adapter and complete regression/security matrix; the SDK's two helper tests do not test Staff or a recovery flow.
- **Staff owner / evidence:** corresponding frontend/backend/auth/routing tests, CI configuration and browser/device tests. Distinguish simulated outcomes and real native-device evidence with version/date.
- **Security:** synthetic credentials/IDs only; no private production data. List each conflict with exact source and expected/actual behavior. SDK agent must stop affected integration until resolved.
- **Status:** required; actual tests and protocol document **missing from this checkout**.

## 4. Required HTTP and protocol evidence worksheet

Complete **one row per actual endpoint or protocol step**, both environments and both directions. This is a collection schema, **not** an invented HTTP API. `not applicable` and `missing` are valid; do not insert placeholder values as if they were real.

| Field | Exact answer required |
| --- | --- |
| Step and owner | Existing function/route and purpose; caller, server, environment, source/destination role; source evidence. |
| Endpoint | Actual scheme/origin and path, method, route binding, request content type, authentication and CSRF/origin requirements; whether redirect occurs. Provide real non-secret values only through an approved channel. |
| Request | Every actual header/cookie/body/query field: exact name, type, required/optional, semantic meaning, allowed values, trust source, validation and sensitivity. Redact values; explicitly identify credentials and whether any enter URLs. |
| Success | Actual HTTP status, exact response body/header fields and types, cookie attributes, result meaning and authoritative server-side checks. Distinguish preparation from destination authentication. |
| Failure | Actual status and stable error code/body for unauthenticated, unauthorized, expired, revoked, replayed, wrong environment/project/audience/origin/account, redirect, rate limit, timeout, unavailable dependency, malformed input and internal error; say `not implemented` if absent. Include retryability and safe user-visible category. |
| Timing and concurrency | Issued-at/expiry/TTL, clock skew, timeout, cancellation, atomic single use/idempotence, duplicate requests, session sign-out/revocation, cleanup and recovery after partial failure. |
| Redirect / CORS / cache | Actual redirect status and target allowlist, `Location` validation, anonymous vs credentialed CORS headers, cache-control; any effect of browsers blocking cross-site cookies. |
| Evidence | Commit-pinned source, tests and sanitized mock trace; mark observed vs inferred and test environment. |

For example, a **worksheet response**, not a proposed endpoint: `step: [existing function name or absent]; request.fields: [{name: [actual], type: [actual], required: [yes/no], validatedBy: [file:function], sensitive: [yes/no]}]; success.status: [actual]; failures: [{case: replay, status: [actual or absent], code: [actual or absent]}]`. Do not paste live credentials.

## 5. Ownership and integration contract

**SDK already provides:** public Assistant instance lifecycle, state subscriptions, host-reported endpoint/session presentation, diagnostics delegation, capability gates and React external-store adapter. The two additional validation helpers are private and disconnected. They do not constitute a working recovery capability, host authentication integration, verified policy delivery or a navigation executor.

**SDK must implement later:** a single instance-owned recovery controller and executor; strict environment/origin validation; health/failure evaluation; policy freshness/epoch checks; serialized fallback and user-confirmed return; retry/cooldown/cancellation; redacted events/state; action ownership; and React/lifecycle cleanup. No public hook signatures or live endpoint calls are fixed yet. Review the actual Staff protocol before designing adapters; if incompatible, stop and report.

**Staff must supply/retain:** trusted deployment identity/configuration; environment-isolated authority and policy distribution; application-specific readiness interpretation; admin authorization; unsaved-work protection; auth/session preparation, redemption and revocation; destination server-side verification and account continuity; application UI and safe handling of sign-in/errors. Supply the information in §3–4 rather than implementing a speculative SDK integration. Existing host controller continues as-is until a separately authorized migration; after the SDK is complete, Staff must replace/delegate it, not add a competing controller or executor. The SDK must not duplicate Staff's backend authentication protocol.

## 6. Explicit unresolved questions and SDK-side blockers

1. Do the actual Staff roots and current fallback startup/redirect flow satisfy exact configured root-only navigation, without URL-carried credentials? Can the existing protocol redeem/verify the destination session without changing that rule?
2. Does the host support prepared session **and/or** fresh sign-in, and is continuity verified server-side for the same account/workspace/environment in both directions? What happens on expiry, sign-out, replay and wrong environment?
3. Can independently scoped trusted policy and a rollback-resistant checkpoint be obtained when primary is unreachable? Can its revocation/freshness semantics meet the proposed bound? What are the authority/key/clock guarantees? How should manual mode behave if authority is unavailable? Owner decision is needed.
4. Which health probes are readable anonymously with redirects rejected and credential omission? Can browser observations distinguish transport failure from cancellation/offline/HTTP/opaque? They cannot establish filtering cause.
5. How are cross-tab/flow replay and unsaved work coordinated? Browser locks/storage cannot prove a single executor across origins. What does the reviewed host protocol enforce?
6. How are primary restoration and return implemented today, and can automatic return be disabled in the eventual migration while preserving a usable fallback session?
7. SDK implementation is incomplete: no public recovery API, cryptographic policy verifier, controller, session hooks, navigation, recovery React integration or full test matrix. The existing snapshot-mutability and destroyed React adapter issues are documented with reproductions in `assistant-sdk-cross-origin-recovery-phase1.md`; neither is fixed. Classic action dispatch remains host-owned today.
8. The previously requested SDK version change to 0.4.1 has not been made; changing the synced precached bundle requires separate kit-version authorization under repository rules. This information request does not authorize a version or release change.

## 7. Response template

Copy this template **for each request 1–12**, and attach separate worksheets (§4) for each actual protocol step. Keep real sensitive material out of the response.

```text
Request number/title:
Status: existing | missing | unnecessary | needs confirmation
Exact value/behavior or reason absent:
Environment and scope: [Production / Preview / both; project, source/destination role]
Actual schema / configuration / HTTP worksheet: [sanitized; include field names/types/validation]
Owner/component:
Evidence: [repository + commit + path:line range; test path::name; command/result if run]
Observed versus inferred: [source intent / deployment configuration / test / device observation]
Security, expiry, authorization, revocation, replay and redaction implications:
SDK need and mapping: [specific current helper or FUTURE controller/policy/probe/session/action hook]
Compatibility with exact-root navigation and per-environment isolation:
Missing facts, conflicting behavior, safe failure and decisions needed:
```

Also return an endpoint/protocol index, a per-environment origin/configuration table, a sequence diagram in both directions, a browser evidence matrix, and a test/fixture inventory. If access to sensitive configuration is restricted, identify the authoritative owner and a secure review path, and supply synthetic structurally faithful examples only.

## 8. Acceptance checklist for the SDK agent

- [ ] Staff repo commit, source/test references and environment-specific deployment facts are supplied or clearly marked unavailable; no secrets, real credentials or private user records are included.
- [ ] Every item 1–12 has a status and evidence, including explicit absence/unnecessary explanations; each existing protocol step has a complete §4 worksheet and sanitized examples.
- [ ] Exact trusted origin pairs, selected environment, project/workspace identity and revision source are confirmed; Production/Preview authorization isolation is evidenced, not assumed.
- [ ] Existing current flow and all navigation/redirect hops are mapped; exact-root and no-credential-in-URL compatibility is demonstrated, or incompatibility is explicitly escalated.
- [ ] Existing authentication/session/recovery protocol is reviewed end-to-end, including server-authoritative identity, destination verification, expiry, replay prevention, revocation, sign-out and wrong-environment/account behavior; no replacement protocol was invented.
- [ ] Global policy persistence, independent environment authority, freshness, revision rollback and outage behavior are evidenced or clearly identified as blocking. Unsaved-work, readiness, cancellation and restoration/return contracts are covered.
- [ ] Cookies, CORS, Worker/binding/storage topology, browser restrictions and actual host action ownership are documented with tests; synthetic and native-device evidence are distinguished.
- [ ] Any missing or unsafe host capability remains a blocker for the affected SDK flow. Responses do not claim that private SDK helpers or planned public APIs already implement recovery, or authorize a release, deployment or Staff modification.
