-- Reverts 0066's policy consolidation. The five FK indexes it added are correct
-- and stay; this half was not.
--
-- 0066 called the merge behaviour-preserving. It is not, and the project's own
-- test caught it rather than a reviewer: 0065's 22-case matrix failed case 19 --
-- anon saw a draft -- and a direct probe isolated why.
--
--   The merged policy is `to anon, authenticated`, so its staff clause is
--   evaluated for the anon ROLE too. current_role() reads the JWT CLAIM, not the
--   Postgres role. So:
--     role anon + a JWT claim present  => current_role() = 'teacher' => drafts visible
--     role anon + no claims (real prod) => 0 drafts, correct
--
-- Not exploitable today: PostgREST sets the Postgres role and the claims
-- together, so they cannot diverge for a genuine anon request. But that is
-- exactly what the merge threw away -- the split makes the staff clause
-- unreachable for anon BY GRANT (`to authenticated`), instead of trusting role
-- and claim to agree. Swapping an enforced boundary for an assumed one, to save
-- a planner pass on a table holding double-digit rows, is the wrong side of §28.
--
-- 0066's own header gave this as the reason NOT to touch the other ~23
-- multiple_permissive_policies findings, and then made an exception for this
-- one. The exception was wrong for the same reason the rule is right. The
-- advisor warning on site_banners is left standing, deliberately.
--
-- Case 19b in supabase/tests/0065_site_banners_test.sql now pins this: it holds
-- a staff JWT claim while switching to the anon role and asserts zero drafts.
-- The merged policy fails it; the split passes.

drop policy if exists "site_banners_select_visible" on public.site_banners;

create policy "site_banners_select_published"
  on public.site_banners for select
  to anon, authenticated
  using ( status = 'published' );

create policy "site_banners_select_staff"
  on public.site_banners for select
  to authenticated
  using (
    ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );

-- The isolation probe ran outside a rolled-back transaction and left one row.
delete from public.site_banners where storage_path like 'ZZPROBE/%';
