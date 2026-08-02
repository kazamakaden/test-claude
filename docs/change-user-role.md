# How to change a user's role in Supabase

Roles live in `public.profiles.role`, not in Supabase Auth itself. There are
five roles: `guest` (not stored — it just means "no profile row"), `student`,
`teacher`, `aft_teacher`, `admin`.

## Method 1 — Table Editor (easiest, no SQL)

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → project
   `hmkciwgzbdszsgnbeakc` → **Table Editor** (left sidebar).
2. Select the **profiles** table.
3. Find the row for the user (search/filter by `email` or `full_name`).
4. Click the **role** cell for that row.
5. Pick the new value from the dropdown (`student` / `teacher` /
   `aft_teacher` / `admin`).
6. Press Enter or click away to save — it saves immediately, no separate
   "Save" button.

## Method 2 — SQL Editor (for scripting or bulk changes)

Dashboard → **SQL Editor** → New query:

```sql
update public.profiles
set role = 'teacher'  -- or 'student' | 'aft_teacher' | 'admin'
where email = 'someone@udontech.ac.th';
```

Run it, then verify:

```sql
select email, role from public.profiles where email = 'someone@udontech.ac.th';
```

## Notes

- **Both methods above work fine** even though the database also has a
  trigger (`prevent_role_self_escalation`) that blocks a *logged-in user*
  from changing their own role through the app. That trigger only fires
  when the request carries a real user session (a JWT); the dashboard's
  Table Editor and SQL Editor run as the database owner, not as any
  particular user, so they're unaffected.
- The role only takes effect the **next time that user's session refreshes**
  (next page load / next server request that calls `getRole()`). If you
  change your own role while logged into the app, reload the page.
- **Student ID emails** (numeric local-part, e.g. `69319010099@udontech.ac.th`)
  must additionally have a row in `public.approved_accounts` before they can
  even sign up — that's a separate step from changing an existing user's
  role. Manage that from the app itself at `/th/approvals` (admin only).
- Never grant `admin` through the app's `/th/approvals` UI — that page
  deliberately excludes `admin` from the role dropdown, on purpose (a
  compromised admin session shouldn't be able to mint more admins through a
  form). Promoting someone to `admin` should always go through one of the
  two methods above.
