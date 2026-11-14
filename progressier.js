/*!
 * progressier.js — Temporary legacy service worker migration shim
 * -------------------------------------------------------------------------
 * Canonical service worker: you-ge-sw.js
 *
 * Kept during the You.Ge Assistant migration compatibility period so existing
 * installations registered at /progressier.js update in place to the canonical
 * You.Ge Assistant worker runtime without 404 errors, duplicate registrations,
 * or dropped push subscriptions. New deployments register /you-ge-sw.js by
 * default; see COMPATIBILITY_CONTRACTS.md for the compatibility window and
 * sunset policy.
 */
'use strict';

importScripts(new URL('you-ge-sw.js', self.location.href).href);
