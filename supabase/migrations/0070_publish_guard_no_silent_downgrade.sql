-- Corrects activities_publish_guard() from 0068. Found by 0068's own test
-- matrix (case 09), not by review.
--
-- WHAT 0068 GOT WRONG. The guard's else-branch read:
--
--     elsif new.publish_status <> 'published' then
--       new.published_at := null;
--       new.is_public    := false;
--
-- The intent was "withdrawing a public activity must not trip
-- activities_public_needs_published". The effect was broader: it fired on EVERY
-- update of an already-draft row, so a caller setting `is_public = true` on a
-- draft had it silently forced back to false. The statement reported success
-- and did the opposite of what was asked -- a fail-soft that hides a mistake
-- instead of refusing it, which is the wrong side of §28 for a visibility flag.
--
-- Now it fires only on a genuine published -> draft TRANSITION. Setting
-- is_public on a draft reaches the CHECK constraint and raises 23514, which is
-- what the caller needs to see.
--
-- published_at is still cleared for any non-published row: that is bookkeeping
-- the client cannot write anyway (it is absent from the UPDATE grant), so
-- normalising it silently costs nothing and hides nothing.
--
-- ALSO WORTH RECORDING, because it looked like a second bug and is not.
-- 0068's test case 27 ("a demoted owner publishes their own draft") expected
-- this trigger to raise. It does not -- the UPDATE returns ZERO ROWS instead,
-- because 0068's new SELECT policies mean a demoted owner can no longer see
-- their own draft (it is not published, and they are no longer staff), so
-- `update ... where id = X` matches nothing and the trigger never runs. The
-- outcome is correct and the guard is still worth keeping: it is the layer that
-- still holds if a future migration widens the SELECT policies, and it covers
-- the paths where the row IS visible. The test assertion was what was wrong --
-- RLS FILTERS UPDATE rather than raising, this project's own documented trap,
-- so that case now asserts ROW_COUNT.

create or replace function public.activities_publish_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publish_status = 'published'
     and (tg_op = 'INSERT' or old.publish_status is distinct from 'published') then

    -- coalesce(..., false): current_role() is NULL for a caller with no profile
    -- row, and NULL propagates through `= any`, so a bare negation would skip
    -- this raise and fail OPEN. Same reasoning as 0056's create_qr_session.
    if ( select auth.uid() ) is not null
       and not coalesce(
             ( select public.current_role() )
               = any (array['aft','teacher','admin']::public.user_role[]),
             false) then
      raise exception 'only staff may publish an activity' using errcode = '42501';
    end if;

    new.published_at := coalesce(new.published_at, now());

  elsif new.publish_status <> 'published' then
    new.published_at := null;

    -- Only on an actual withdrawal. Forcing this on every draft update is what
    -- 0068 got wrong -- see the header.
    if tg_op = 'UPDATE' and old.publish_status = 'published' then
      new.is_public := false;
    end if;
  end if;

  return new;
end;
$$;

-- create or replace RESETS grants to PUBLIC EXECUTE. The 0011 -> 0012 trap,
-- which is exactly why this line is repeated here rather than assumed from 0068.
revoke execute on function public.activities_publish_guard() from public, anon, authenticated;
