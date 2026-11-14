# Reference

> Third-party compatibility evidence, not You.Ge Assistant product material.
> These are unmodified artifacts of the hosted client (Progressier) that
> `staff.you.ge` used before migrating to You.Ge Assistant. They are kept only to
> prove parity for the legacy contracts listed in
> [`COMPATIBILITY_CONTRACTS.md`](../COMPATIBILITY_CONTRACTS.md) and are never
> deployed. Their file names and contents are preserved verbatim; retiring or
> restructuring this folder requires separate owner approval.

`progressier.json` is the original one-line JSON manifest that hosted service
served for `staff.you.ge`. `progressier.decompiled.json` is its pretty-printed JSON
copy; the original manifest is preserved unchanged.

`Script.js` is a user-supplied copy of the hosted client bundle.
`Script.decompiled.js` is a readable, Prettier-formatted copy for inspection; it
is not a clean-room reimplementation or part of the runtime. Both client files
are kept only for local parity research and must not be deployed.

The readable client copy can be regenerated with:

```sh
npm exec --yes --package=prettier@3.6.2 -- prettier reference/Script.js \
  --parser babel > reference/Script.decompiled.js
```

The deployed manifest is `/manifest.webmanifest`. It keeps the original install
continuity fields (`id`, `start_url`, scope and both protocol handlers) and
otherwise carries the You.Ge Assistant identity (name, colors, local icons), a
share target, categories and `launch_handler`.

Do not deploy this folder.
