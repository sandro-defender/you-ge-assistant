# Push server example

Minimal Node sender for You.Ge Assistant. It receives browser subscriptions
and sends notifications that match `you-ge-sw.js`'s expected payload.

## Run

```bash
cd examples/push-server
npm install

node ../../scripts/generate-vapid-keys.mjs --write
```

Then set the keys and start it:

```bash
# bash
VAPID_PUBLIC_KEY="..." \
VAPID_PRIVATE_KEY="..." \
VAPID_SUBJECT="mailto:admin@example.com" \
node server.js
```

```powershell
# PowerShell
$env:VAPID_PUBLIC_KEY="..."
$env:VAPID_PRIVATE_KEY="..."
$env:VAPID_SUBJECT="mailto:admin@example.com"
node server.js
```

On the site, load `pwa.js` with:

```html
<script
  src="/pwa.js"
  defer
  data-vapid-public-key="THE_PUBLIC_KEY"
  data-push-endpoint="/api/push/subscribe"
></script>
```

Use the same origin for the endpoint (or add CORS yourself). If the push server
runs on another port during development, put it behind your normal reverse proxy
so `/api/push/*` is same-origin.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Subscription count |
| `GET` | `/api/push/public-key` | Public VAPID key |
| `POST` | `/api/push/subscribe` | Store `{ subscription }` or a raw subscription |
| `DELETE` | `/api/push/subscribe` | Remove `{ endpoint }` |
| `POST` | `/api/push/send` | Send `{ title, body, url, icon, tag, unread, actions }` |
| `POST` | `/api/push/test` | Same as send, for testing |

## Test

```bash
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{"title":"You.Ge Assistant","body":"Hello from the push server","url":"/"}'
```

## Production notes

- Key subscriptions by your logged-in user, not just by endpoint. This example
  uses the endpoint so it stays dependency-free.
- Protect `/api/push/subscribe`, `/api/push/send` and `/api/push/test` with the
  same session/auth middleware as the rest of your application.
- Keep `subscriptions.json` out of git. It contains endpoint secrets.
- `404` and `410` responses mean the subscription is gone; the example removes it.
- The service worker also handles `pushsubscriptionchange` and re-subscribes, but
  it relies on `data-push-endpoint` being present in the page config.
- Notification images and icons must be publicly reachable over HTTPS.
