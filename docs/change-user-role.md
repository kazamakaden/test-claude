# How to change a user's role in Supabase

Roles live in `public.profiles.role`, not in Supabase Auth itself. There are
**five**: `guest` (not stored — it just means "no profile row"), `student`,
`aft` (นักศึกษา อวท.), `teacher` (ครู), and `admin`.

`profiles_role_allowed` (`0049`) is a CHECK constraint that permits exactly
those values, so writing anything else fails with `23514`. Two labels survive
in the `user_role` enum only because PostgreSQL cannot remove an enum value in
place, and **neither can be stored**:

* `pending` — a waiting room removed in `0046`. Signing up no longer needs
  approval, `/pending` is deleted, and `/approvals` is a bare redirect to
  `/members`. Older revisions of this file told you to approve people there.
* `aft_teacher` — merged away in the same migration. An earlier revision of
  this file listed it as a value to pick; doing so now raises `23514`.

## Where a role comes from in the first place

`handle_new_user()` assigns it at first sign-in from the email's local part
(§14): `^[0-9]{11,}$` is a student ID and lands `student`; any other local
part is a named staff address and lands `teacher`. Nobody is left waiting.

**`aft` is not normally written by hand.** An admin assigns an อวท. ตำแหน่ง
from `/th/members`, and `sync_role_with_position()` (`0049`) promotes
`student` → `aft` automatically, demoting back when the ตำแหน่ง is cleared.
`teacher` and `admin` are deliberately left alone by that trigger, because
`advisor` (ครู) is itself one of the eight offices. Prefer that route over the
methods below: it keeps role and ตำแหน่ง consistent, which a direct UPDATE
does not.

## Method 1 — Table Editor (easiest, no SQL)

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → project
   `hmkciwgzbdszsgnbeakc` → **Table Editor** (left sidebar).
2. Select the **profiles** table.
3. Find the row for the user (search/filter by `email` or `full_name`).
4. Click the **role** cell for that row.
5. Pick the new value — `student` / `aft` / `teacher` / `admin`. The dropdown
   also offers `pending` and `aft_teacher` because they are still enum labels;
   picking either is rejected on save by the CHECK.
6. Press Enter or click away to save — it saves immediately, no separate
   "Save" button.

## Method 2 — SQL Editor (for scripting or bulk changes)

Dashboard → **SQL Editor** → New query:

```sql
update public.profiles
set role = 'teacher'  -- or 'student' | 'aft' | 'admin'
where email = 'someone@udontech.ac.th';
```

Run it, then verify:

```sql
select email, role, position from public.profiles
where email = 'someone@udontech.ac.th';
```

## Notes

- **Both methods above work fine** even though the database also has triggers
  (`prevent_role_self_escalation`, `prevent_position_change`) that constrain
  who may change a role or grant a ตำแหน่ง through the app. Those fire only
  when the request carries a real user session; the dashboard's Table Editor
  and SQL Editor run as the database owner with no JWT, and every one of those
  guards has an explicit `auth.uid() is null` carve-out for exactly that.
- The role only takes effect the **next time that user's session refreshes**
  (next page load / next server request that calls `getRole()`). If you change
  your own role while logged into the app, reload the page.
- **Setting `role = 'aft'` directly leaves the member with no ตำแหน่ง**, so
  `/members` will show them as an อวท. member holding no office. That is legal
  but usually not what you meant — assign the ตำแหน่ง instead and let the
  trigger set the role.
- `admin` is deliberately not grantable through any form in the app, so one of
  the two methods above is the only way to mint one.
