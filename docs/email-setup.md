# Outbound email (SMTP)

This app sends its own password-setup and password-reset email. Supabase
Auth's mailer is not involved in either. This page covers why, how to
configure it, and where to look when nothing arrives.

## Why the app sends its own mail

Not preference — three separate blockers, each of which alone is enough:

1. **Project-level CAPTCHA.** This project enables Turnstile in Supabase →
   Authentication → Bot and Abuse Protection. That applies to every public
   auth endpoint, so a server-initiated `resetPasswordForEmail()` is refused
   with `captcha protection: request disallowed`. A CAPTCHA token can only
   come from a real browser, which a server-side call does not have.
2. **The built-in sender's rate limit.** Supabase's default
   `noreply@mail.app.supabase.io` caps out around two messages an hour
   (`429 over_email_send_rate_limit`) — fine for testing, not for a college.
3. **Custom SMTP through the dashboard has been fragile here.** It was
   configured once via Resend, then **cleared by the dashboard itself** when
   the toggle was switched off, and its domain never finished DNS
   verification. Configuration that lives only in a dashboard is
   configuration that can vanish without a commit.

Sending from the app moves all of that into environment variables, which
deploy with the code and can be checked at build time — `lib/env-guard.ts`
fails a Vercel production build outright when the SMTP variables are
missing, precisely so this cannot break silently.

## Setting it up with Gmail / Google Workspace

Google removed "less secure app access" in 2022. The only username/password
route is an **App Password**, and that requires 2-Step Verification first.

1. Sign in as the mailbox that will send (e.g. `noreply@udontech.ac.th`).
2. **Google Account → Security → 2-Step Verification** — turn it on. App
   Passwords do not appear until this is done.
3. **Google Account → Security → App passwords** — create one. Google shows
   a 16-character value **once**. Copy it now; it cannot be retrieved later.
   (Workspace admins can disable App Passwords org-wide; if the page is
   missing, that is why, and an admin has to allow them.)
4. Set the variables — locally in `.env.local`, and in the Vercel project's
   Environment Variables for Production **and** Preview:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=noreply@udontech.ac.th
   SMTP_PASSWORD=<the 16-character app password, no spaces>
   SMTP_FROM=AFT UDONTECH <noreply@udontech.ac.th>
   ```

5. Redeploy. `NEXT_PUBLIC_*` variables are inlined at build time; these are
   read at request time, but Vercel still needs a new deployment to pick up
   a changed environment.

### The details that actually bite

* **`SMTP_FROM` is not free text.** Gmail rewrites or rejects a From that is
  neither the authenticated mailbox nor one of its verified "Send mail as"
  aliases. If mail arrives showing a different sender than you set, this is
  why.
* **Port 465 is implicit TLS** (`secure: true`, derived from the port in
  `lib/mailer.ts`). Port 587 with STARTTLS also works. **Port 25 does not** —
  it is blocked by most hosts, Vercel included.
* **Paste the App Password without spaces.** Google displays it in four
  groups of four; the spaces are presentation only.
* **Sending limits:** Workspace allows roughly 2,000 recipients a day,
  consumer Gmail 500. Both are far above what password resets need, and far
  above Supabase's ~2/hour, which is the point.

## Any other provider

Nothing in `lib/mailer.ts` is Gmail-specific — it is plain SMTP auth. Point
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` at any provider. If you
go back to Resend, note that its domain still needs DKIM/SPF records in DNS
before it will accept a send; check `resend._domainkey.udontech.ac.th`
resolves before expecting mail to arrive.

## When no email arrives

The Server Action deliberately reports success either way — it returns the
same "check your email" panel whether the address is registered, throttled,
or the send failed, because varying the response would reveal which
`@udontech.ac.th` addresses exist. So **the response never tells you what
happened; the server log does.**

Look in Vercel → the deployment → Runtime Logs (or the terminal running
`npm run dev`) for one of:

| Log line | Meaning |
|---|---|
| `[mailer] SMTP is not configured …` | One of `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` is unset in this environment. |
| `[mailer] send failed: Invalid login …` | Wrong App Password, or the account password was used instead of one. |
| `[mailer] send failed: …ETIMEDOUT` | Outbound SMTP blocked on this port — check `SMTP_PORT`, and that it is not 25. |
| `[requestPasswordReset] no site URL configured …` | Neither `NEXT_PUBLIC_SITE_URL` nor `VERCEL_PROJECT_PRODUCTION_URL` is set, so no link could be built. Nothing was sent. |
| `[password-setup] throttle read failed …` | The service-role client could not read `password_setup_tokens`; check `SUPABASE_SECRET_KEY`. |
| *(nothing at all)* | The address has no `profiles` row, or this account already requested 3 links in the last 15 minutes. Both are silent by design. |

## Limits worth knowing

* **At most 3 links per account per 15 minutes** (`lib/password-tokens.ts`).
  The 4th is silently not sent — being throttled must not change the
  response, or it becomes a way to test whether an address is registered.
* **A link lasts 60 minutes and works once.** Setting a password also
  invalidates every other outstanding link for that account.
* **Spent token rows are never deleted.** Same choice as `qr_scan_attempts`:
  they accumulate slowly and are cheap. If that ever matters, delete rows
  where `expires_at < now() - interval '30 days'`; nothing reads them.
