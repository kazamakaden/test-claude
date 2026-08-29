-- Two performance-advisor findings, both verified against the live project
-- before acting rather than trusted from the lint output.
--
-- 1. FIVE FOREIGN KEYS WITH NO COVERING INDEX. Same lint and same fix as 0015,
--    which cleared the previous batch. Harmless at today's row counts and free
--    to add now; the alternative is a sequential scan on the referenced table
--    every time a profile is deleted (each of these is an ON DELETE SET NULL or
--    a cascade path). `site_banners_created_by_idx` is one this project's own
--    0065 introduced hours earlier -- fixed here rather than left as a known
--    wart.
--
-- 2. THE TWO site_banners SELECT POLICIES BECOME ONE. Permissive policies OR
--    together, so the planner runs both for every authenticated read. Merging
--    them is behaviour-preserving:
--
--      anon           current_role() has no profile row to read, so the array
--                     test is false and the clause reduces to status =
--                     'published' -- exactly what site_banners_select_published
--                     gave it.
--      student        same.
--      aft/tea/admin  the array test is true, so every row -- exactly what the
--                     OR of the two policies gave them.
--
--    Deliberately NOT extended to the ~23 other multiple_permissive_policies
--    findings on activities/books/documents/projects/profiles. Those stack
--    across several migrations and several roles, and rewriting the
--    access-control layer to save a planner pass on tables holding double-digit
--    row counts is the wrong trade -- an RLS gap introduced while chasing an
--    optimisation costs incomparably more than the optimisation gains. This one
--    is different only because both policies were written in the same migration
--    on the same day, and 0065's 22-case matrix re-runs to prove it.
--
-- NOT ACTED ON, and recorded so it is not "fixed" later by someone reading the
-- lint without this note: 18 `unused_index` findings. Those indexes are unused
-- because this project has almost no production rows yet, not because they are
-- pointless -- profiles_full_name_trgm_idx backs §18 global search,
-- activities_department_idx backs the §10 filters. Dropping them would remove
-- exactly the indexes the app needs once it holds real data.

create index if not exists activity_banners_uploaded_by_idx
  on public.activity_banners (uploaded_by);
create index if not exists activity_editors_granted_by_idx
  on public.activity_editors (granted_by);
create index if not exists attendance_recorded_by_idx
  on public.attendance (recorded_by);
create index if not exists content_blocks_updated_by_idx
  on public.content_blocks (updated_by);
create index if not exists site_banners_created_by_idx
  on public.site_banners (created_by);

drop policy if exists "site_banners_select_published" on public.site_banners;
drop policy if exists "site_banners_select_staff" on public.site_banners;

create policy "site_banners_select_visible"
  on public.site_banners for select
  to anon, authenticated
  using (
    status = 'published'
    or ( select public.current_role() ) = any (array['aft','teacher','admin']::public.user_role[])
  );
