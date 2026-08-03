-- 0016's transition triggers exempt admin/aft_teacher via current_role(),
-- which derives from auth.uid(). A service-role connection has no JWT, so
-- auth.uid() is NULL and current_role() matches neither exemption — and
-- unlike RLS, triggers are NOT bypassed by the service role. That makes any
-- server-side UPDATE of these tables' status (a seed script, an Admin-API
-- data fix, a future migration backfilling rows) fail with
-- "illegal ... status transition".
--
-- Nothing is broken today (supabase/seed.sql only INSERTs, and these
-- triggers are UPDATE-only), so this is a latent operational footgun rather
-- than a live bug — but it is exactly the kind that surfaces mid-incident,
-- when someone needs a data fix and can't apply one.
--
-- No JWT means the request did not come through PostgREST as a user, so it
-- is out of scope for a guard whose entire purpose is constraining what a
-- *user* may do to their own workflow rows. The user-facing guarantee is
-- unchanged: every authenticated request carries a non-NULL auth.uid(), so
-- students and teachers still cannot skip a stage.

create or replace function public.enforce_project_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- No JWT (service role / direct SQL) — not a user-initiated request.
  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() in ('admin', 'aft_teacher') then
    return new;
  end if;

  if old.status = new.status then
    return new; -- editing content without a stage change is always fine
  end if;

  if not (
    (old.status = 'draft' and new.status = 'teacher_review') or
    (old.status = 'teacher_review' and new.status = 'admin_approval') or
    (old.status = 'teacher_review' and new.status = 'draft')
  ) then
    raise exception 'illegal project status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_document_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- No JWT (service role / direct SQL) — not a user-initiated request.
  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() in ('admin', 'aft_teacher') then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'signed') or
    (old.status = 'signed' and new.status = 'pending_approval')
  ) then
    raise exception 'illegal document status transition: % -> %', old.status, new.status;
  end if;

  return new;
end;
$$;

-- CREATE OR REPLACE FUNCTION resets a function's grants to the PostgreSQL
-- default (PUBLIC EXECUTE) — the exact trap 0011 fell into with
-- handle_new_user() and 0012 had to clean up afterwards, per 0012's own
-- warning that any future `create or replace` on a trigger-only function
-- must repeat the revoke in the same migration. 0016 created these two
-- without one at all, so this is both the required re-revoke and the
-- first-time lockdown.
revoke execute on function public.enforce_project_status_transition() from public, anon, authenticated;
revoke execute on function public.enforce_document_status_transition() from public, anon, authenticated;
