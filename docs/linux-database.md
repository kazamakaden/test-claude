# Working with the Supabase database from Linux

This project's Supabase project (`hmkciwgzbdszsgnbeakc`) is **hosted**, not
self-hosted — there is no local Postgres/Docker stack to run. "Linux" here
just means: how do you connect to and manage that hosted project from a
Linux machine, the same way README.md's "Running on Linux" section covers
running the Next.js app itself (that section doesn't touch the database at
all — this doc fills that gap).

## Prerequisites

```bash
# psql — for running SQL directly against the hosted project
sudo apt install postgresql-client   # Debian/Ubuntu
sudo dnf install postgresql          # Fedora/RHEL
sudo pacman -S postgresql            # Arch
```

The Supabase CLI is **not required** just to apply migrations — see
"Applying the pending migrations" below. It's only needed if you want
`supabase db push`/`gen types` to work going forward (Path B).

If you do want it, per the [official supabase/cli
README](https://github.com/supabase/cli): `npm install -g supabase` is
**not supported** — the CLI is deliberately not distributable that way.
Use one of:

```bash
# Homebrew (works on Linux, not just macOS)
brew install supabase/tap/supabase

# or a project-local dev dependency
npm install -D supabase   # then run it as `npx supabase ...`

# or a distro package from https://github.com/supabase/cli/releases
# (.deb / .rpm / .apk / .pkg.tar.zst)
```

## Connecting

Get the connection string from the Supabase dashboard → project
`hmkciwgzbdszsgnbeakc` → **Project Settings → Database → Connection
string** (choose "Session pooler" for a one-off `psql` session; the
"Transaction pooler" URI does not support all `psql` metacommands).

```bash
psql "postgresql://postgres.hmkciwgzbdszsgnbeakc:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

Never put the password in shell history or a committed file — paste it
interactively, or export it to an env var for that shell session only:

```bash
export PGPASSWORD='...'
psql "postgresql://postgres.hmkciwgzbdszsgnbeakc@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

## Applying the pending migrations

`supabase/migrations/0001` through `0015` were already applied by hand
(SQL Editor / Supabase MCP), so the hosted project's own migration-history
table has no record of them. **`supabase/migrations/0016`, `0017`, and
`0018`** — the entire Projects/Documents draft → review → approve
workflow, its RLS policies, and the status-transition triggers — are
**not yet applied**.

### Method 1 — SQL Editor (simplest, no CLI needed)

1. Dashboard → project `hmkciwgzbdszsgnbeakc` → **SQL Editor** → New query.
2. Open `supabase/migrations/0016_project_document_workflow_tables.sql`,
   paste its full contents, run it.
3. Repeat for `0017_project_document_workflow_rls.sql`, then
   `0018_transition_trigger_service_role_bypass.sql`.

**Order matters** — `0017`'s RLS policies reference columns `0016` adds,
and `0018` replaces functions `0016` creates.

### Method 2 — psql from Linux

```bash
cd supabase/migrations
for f in 0016_project_document_workflow_tables.sql \
         0017_project_document_workflow_rls.sql \
         0018_transition_trigger_service_role_bypass.sql; do
  psql "$DATABASE_URL" -f "$f" -v ON_ERROR_STOP=1
done
```

`-v ON_ERROR_STOP=1` is important — without it, `psql` keeps going after a
failed statement and you can end up with a partially-applied migration.

**Do not run `supabase db push` for this** unless you've completed Path B
below first — see "The `db push` trap."

## Adopting the CLI for future migrations (optional, one-time)

If you want `supabase db push`/`migration new`/`gen types` to work going
forward instead of copy-pasting SQL by hand:

```bash
npx supabase init                                   # writes supabase/config.toml
npx supabase login                                   # opens a browser for an access token
npx supabase link --project-ref hmkciwgzbdszsgnbeakc
```

Then tell the CLI that `0001`–`0018` are already live, so it doesn't try
to replay them:

```bash
npx supabase migration repair --status applied \
  0001 0002 0003 0004 0005 0006 0007 0008 0009 \
  0010 0011 0012 0013 0014 0015 0016 0017 0018
```

(If you applied `0016`–`0018` via Method 1/2 above *before* running
`repair`, include them in that list too — the point is the remote history
table and the local migration files must agree on what's already applied
before `db push` is safe to use.)

After that, `npx supabase db push` will correctly apply only genuinely new
migration files.

### The `db push` trap

Running `supabase db push` against this project **before** the `repair`
step above will try to replay `0001_auth.sql` onward from scratch and fail
loudly on `relation "profiles" already exists` (or similar) — because the
CLI's local view of "what's applied" starts empty, while the actual
database already has everything through `0015` (and now `0016`–`0018`).
This isn't dangerous — it fails on `CREATE TABLE`/`CREATE POLICY`
conflicts rather than silently corrupting anything — but it's a confusing
wall of errors if you don't know why. Run `migration repair` first.

## Regenerating types

`types/database.ts` is currently **hand-patched**, not generated — the
session that wrote `0016`–`0018` had no live database access, so the
`signature_records` table, `sign_document()` function, and
`rejected_reason` columns were typed by hand to match the SQL. Once the
migrations above are actually applied, regenerate for real:

```bash
npx supabase gen types typescript --linked > types/database.ts
npx tsc --noEmit
```

The `tsc` run matters here specifically: it's what would catch any
mismatch between the hand-patch and what the migrations actually produced
on the server — for example if a column ended up nullable when the
hand-patch assumed required, or a function's argument order differs.

## Verifying it worked

The migrations add RLS policies and triggers, not just tables — applying
the SQL successfully doesn't by itself prove the *access control* is
correct. At minimum:

1. Confirm the new objects exist:
   ```sql
   select table_name from information_schema.tables
     where table_schema = 'public' and table_name = 'signature_records';
   select proname from pg_proc where proname like 'enforce_%_status_transition';
   ```
2. Spot-check RLS as at least a student and a teacher account (real JWTs,
   not the service-role key, which bypasses RLS entirely and will report
   false positives). This project's own precedent for this — the `0005`
   `citizen_id` and `0008` `attendance` column-grant work, both documented
   in `CLAUDE.md` §0 — is a full per-role test matrix, not a single manual
   click-through. The Projects/Documents RLS + trigger interaction added in
   `0016`–`0018` is exactly the kind of change that precedent exists for:
   confirm a student can create/edit their own draft but not touch anyone
   else's, a plain teacher can recommend a `teacher_review` project but not
   approve one still at `admin_approval`, and that skipping straight from
   `draft` to `pending_approval` (bypassing the signature step) is actually
   rejected, not just assumed rejected because the code looks right.

## Troubleshooting

**`permission denied for table X`** — expected, not a bug, if it happens
on a column this project explicitly restricts (`profiles.citizen_id`,
`attendance.gps_lat`/`gps_lng`/`device_fingerprint`/`browser`/`ip`). See
README.md's migration notes on `0005`/`0008` for why. If it happens
somewhere unexpected, check `information_schema.role_routine_grants` and
the relevant `create policy` statement before assuming the grant is wrong
— Supabase's security advisor output can lag behind the database's actual
state (documented precedent in `CLAUDE.md` §0).

**Connection refused / timeout** — the direct connection
(`db.<ref>.supabase.co:5432`) doesn't work from every network; prefer the
pooler host (`aws-0-<region>.pooler.supabase.com`) shown in the dashboard's
connection-string panel, which supports both IPv4 and IPv6.

**`relation already exists` on `supabase db push`** — see "The `db push`
trap" above; you skipped `migration repair`.
