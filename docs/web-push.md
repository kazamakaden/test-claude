# Web push delivery

The in-app notification pipeline (§16) is driven entirely by Postgres
triggers: `notify_roles`, `notify_project_status_change`,
`notify_document_status_change` and `notify_member_role_change`
(`0036_notification_events.sql`) insert into `public.notifications`. **No
application code ever inserts a notification.**

That is the reason push delivery is an HTTP endpoint rather than something a
Server Action calls: the only component that knows a notification happened is
the database, so the database has to be the thing that starts the send.

```
project/document/role change
  → 0036 trigger inserts into public.notifications
    → Supabase Database Webhook (INSERT)
      → POST /api/push/dispatch      (x-push-secret)
        → services/push.ts#listPushTargets   (service role)
          → web-push → the browser's push service
            → public/sw.js `push` handler shows the notification
```

## 1. Environment variables

Set all four, in Vercel (Production + Preview) and in `.env.local` for dev:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public half; inlined into the client bundle by design |
| `VAPID_PRIVATE_KEY` | Signing key — server-only, never `NEXT_PUBLIC_` |
| `VAPID_SUBJECT` | `mailto:` contact required by the VAPID spec |
| `PUSH_DISPATCH_SECRET` | Shared secret for the webhook; `openssl rand -base64 32` |

Generate the keypair with `npx web-push generate-vapid-keys` and keep both
halves together — the private key is the only thing that can reach a
subscription created with its matching public key, so rotating it invalidates
every subscription already stored.

`SUPABASE_SECRET_KEY` must also be set: the dispatch route reads other users'
subscriptions, which no user session is allowed to do.

Until `PUSH_DISPATCH_SECRET` is set, `/api/push/dispatch` rejects **every**
caller with 401 and nothing is sent. Until the VAPID keys are set, the
Settings toggle does not render at all (`lib/push.ts#isPushConfigured`).

## 2. Create the Database Webhook

Dashboard → Database → Webhooks → *Create a new hook*:

- Table `public.notifications`, event **Insert** only
- Type **HTTP Request**, method **POST**
- URL `https://<your-domain>/api/push/dispatch`
- HTTP header `x-push-secret: <PUSH_DISPATCH_SECRET>`

Equivalent SQL, if you prefer it reproducible in a migration rather than
configured by hand (requires the `pg_net` extension, which Supabase enables
for webhooks anyway):

```sql
create trigger notifications_push_dispatch
  after insert on public.notifications
  for each row execute function supabase_functions.http_request(
    'https://<your-domain>/api/push/dispatch',
    'POST',
    '{"Content-Type":"application/json","x-push-secret":"<PUSH_DISPATCH_SECRET>"}',
    '{}',
    '5000'
  );
```

Note this embeds the secret in the trigger definition, which is readable by
anyone who can inspect the schema — acceptable for a webhook secret whose only
power is "may ask the server to send an already-created notification", but do
not reuse a secret from anywhere else.

## 3. Language

Pushes are composed on the server, long after the reader navigated away, so
the reader's locale cannot be read from the URL the way the in-app UI reads
it. `push_subscriptions.locale` (`0040`) records the `[lang]` segment the user
was on when they subscribed, set server-side from the Server Action's own
`lang` argument — never from the request body.

Text is rendered with `lib/notifications.ts#notificationMessage`, the same
function the bell and `/notifications` use, so push wording cannot drift from
in-app wording.

## 4. Dead subscriptions

A browser silently discards a subscription (permission revoked, profile
cleared, app uninstalled). The push service then answers `404`/`410`, and the
dispatch route deletes those rows. Any other failure is left in place to be
retried by the next notification — a transient 5xx from the push service is
not a reason to forget a real device.

## 5. What this does not do

- **No retry of its own.** One attempt per notification per device. The
  endpoint always returns 2xx once authenticated, so the webhook does not
  re-fire and re-notify everyone because one device failed.
- **No batching or rate limiting.** A broadcast fans out one request per
  subscription, in parallel. Fine at this project's scale; revisit before
  thousands of subscribers.
- **No delivery receipt.** Web push is fire-and-forget; a 201 from the push
  service means it accepted the message, not that anyone saw it.
