/*!
 * progressier.js — Temporary legacy service worker compatibility shim
 * -------------------------------------------------------------------------
 * Canonical service worker: you-ge-sw.js
 *
 * Kept during the You.Ge Assistant 1.x compatibility period so explicit
 * data-sw="/progressier.js" integrations or any browser still polling
 * /progressier.js execute the canonical You.Ge Assistant worker runtime via
 * importScripts without HTTP 404 errors. Fresh and default registrations use
 * /you-ge-sw.js; see COMPATIBILITY_CONTRACTS.md for the sunset policy.
 */
'use strict';

importScripts(new URL('you-ge-sw.js', self.location.href).href);
