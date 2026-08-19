# Facebook banner import

The homepage (`/{lang}`) shows a carousel of banner images. Staff upload them by
hand, and — optionally — the college Facebook Page's newest photo is pulled in
once a day.

## What it does

`services/facebook-banner.ts#importLatestFacebookBanner()`:

1. asks the Graph API for the Page's newest **uploaded** photo
   (`type=uploaded`, not `tagged` — the latter is other people's content),
2. skips it if `facebook_post_id` is already in `site_banners`,
3. downloads the widest variant and **copies it into our own Storage bucket**,
4. inserts a row with `source = 'facebook'`, `status = 'draft'`.

An admin then sets the academic year and เทอม and publishes it, on the homepage
itself.

## Three decisions worth not re-litigating

**Polling, not a Meta Webhook.** A webhook delivers in seconds instead of hours,
but needs a Meta App, an App Secret, HMAC `X-Hub-Signature-256` verification on
every delivery, a public callback answering `hub.challenge`, and App Review. It
does **not** remove the Page token either — the `feed` payload carries a post id,
not a usable image URL, so the Graph call and its expiry remain. And because Meta
drops deliveries, a webhook design still needs a polling fallback. For a banner
that changes a few times a *year*, the latency is worth nothing.

**Copied, not hotlinked.** Facebook's CDN URLs are signed and short-lived, and
the Page token expires. A homepage linking straight at them would go blank on
its own schedule. Once the bytes are in our bucket the banner outlives the
token, the post being deleted, and Facebook rate limits alike.

**It lands as a draft.** A post carries no academic year and no เทอม, so it
cannot satisfy `site_banners_published_needs_term` (0065). More importantly, the
review step is the only thing between the college homepage and whatever was
posted last. If that ever proves to be a nuisance, auto-publishing is a small
isolated change — default the year/term from today's date and insert as
`published` — but it should be a decision, not a drift.

## Setup

1. **Page ID** — the numeric id, not the vanity `@handle`. Facebook Page →
   About → Page transparency, or `https://graph.facebook.com/{handle}?fields=id`.
2. **Page access token** with `pages_read_engagement`, from Graph API Explorer,
   then exchanged for a long-lived one.
3. Set `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN` and `CRON_SECRET` in
   Vercel (Production + Preview).
4. `vercel.json` already declares the schedule: `0 1 * * *` — **01:00 UTC, which
   is 08:00 Asia/Bangkok**. Vercel Cron reads it on the next deploy.

## When it stops working

Every failure is a 200 with a `reason`, not a 5xx — a scheduler that gets a 5xx
retries forever against a box that can never succeed. Look at the cron run's
response body first, then Vercel Runtime Logs for the detail:

| body | meaning |
|---|---|
| `{"skipped":"not_configured"}` | the two `FACEBOOK_*` vars are not set |
| `{"ok":false,"reason":"graph_401"}` | **the token expired** — the expected failure. Reissue it |
| `{"ok":false,"reason":"graph_unreachable"}` | network/timeout |
| `{"ok":true,"outcome":"already_imported"}` | normal: the newest post is already in |
| `{"ok":true,"outcome":"no_posts"}` | the Page has no uploaded photos |
| `401` with no body | `CRON_SECRET` is unset or the caller did not present it |

To run it by hand:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/banners/facebook
```

## Scheduled maintenance cost

A long-lived Page token expires in about 60 days. That is the one part of this
feature with a recurring cost, and it fails visibly (`graph_401`) rather than
silently. Existing banners are unaffected.
