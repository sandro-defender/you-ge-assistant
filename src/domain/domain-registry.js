/*
 * Public domain-specific defaults. This is configuration, not an access-control
 * list; never place credentials or private API values here. Extend/replace these
 * entries for a deployment before loading pwa.js.
 */
globalThis.YOU_GE_DOMAIN_REGISTRY = Object.assign({}, globalThis.YOU_GE_DOMAIN_REGISTRY || {}, {
  // Keep this stable id to avoid silently changing the existing staff.you.ge PWA.
  'staff.you.ge': {
    identity: {
      name: 'You.Ge Assistant',
      shortName: 'You.Ge',
      description: 'Your installable, offline-ready web assistant.',
    },
    pwa: {
      id: '/HIPSBNVemXtM8VMwRfWs',
      startUrl: '/?launchedfrom=homescreen',
      scope: '/',
      basePath: '/',
    },
  },
});
