-- §18 global search across Members, Activities, Projects and Documents
-- (plus Books, which share the /documents shelf).
--
-- SEC-4 shaped this. Search is the easiest place in an app to leak data,
-- because one query fans out across tables whose access rules differ, and the
-- convenient implementation -- one privileged query, filtered afterwards -- is
-- exactly the wrong one. Three rules were applied:
--
-- 1. SECURITY INVOKER, never DEFINER, and never the service-role client. Each
--    subquery runs as the caller, so the existing per-table policies do the
--    scoping: a student sees official projects plus their own, a reviewer sees
--    drafts because reviewing is their job, an anon caller sees only public
--    activities and published books. Search therefore cannot show anyone
--    anything they could not already reach by browsing.
--
--    This is the OPPOSITE of the choice 0038 made for list_notifications, and
--    deliberately so. There, RLS was broader than the app's meaning of "mine"
--    (notifications_all_admin matches every row for an admin), so the RPC had
--    to re-state the scope itself. Here the policies already say precisely
--    what each role may see, so re-stating them would mean maintaining a
--    second copy of the access rules that could drift from the first. The test
--    file asserts the resulting per-role visibility rather than assuming it.
--
-- 2. NO CONTACT DETAILS. `profiles.email` is deliberately absent from the
--    member branch. It is column-granted to `authenticated` but not to `anon`
--    (0026), so selecting it inside a SECURITY INVOKER function would make the
--    whole search fail with 42501 for a guest rather than merely hiding one
--    field -- and a search box is not where anyone needs contact details
--    anyway. citizen_id is likewise absent, as are every §15 attendance
--    column: attendance is not searched at all.
--
-- 3. The wildcards are escaped HERE, not left to the caller. An unescaped `%`
--    turns a search into "match everything", which for the member directory is
--    a bulk export.

create extension if not exists pg_trgm with schema extensions;

-- Trigram indexes so ILIKE '%term%' does not table-scan. GIN, not GiST: this
-- is a read-mostly workload where lookup speed matters more than build cost.
create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin (full_name extensions.gin_trgm_ops);
create index if not exists profiles_student_id_trgm_idx
  on public.profiles using gin (student_id extensions.gin_trgm_ops);
create index if not exists activities_title_trgm_idx
  on public.activities using gin (title extensions.gin_trgm_ops);
create index if not exists projects_title_trgm_idx
  on public.projects using gin (title extensions.gin_trgm_ops);
create index if not exists documents_title_trgm_idx
  on public.documents using gin (title extensions.gin_trgm_ops);
create index if not exists books_title_trgm_idx
  on public.books using gin (title extensions.gin_trgm_ops);

create function public.search_all(p_query text, p_limit integer default 5)
returns table (
  entity text,
  id text,
  title text,
  subtitle text,
  sort_key timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      -- Escape the LIKE wildcards, then wrap. Note the escape must happen
      -- before the wrapping %, or it would escape our own.
      '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as term,
      -- Bounded regardless of what the caller asks for: this is one dropdown
      -- section, not an export endpoint.
      least(greatest(coalesce(p_limit, 5), 1), 20) as lim
  ),
  members as (
    -- sort_key is NULL here, not p.created_at, and that is not cosmetic:
    -- `anon` holds a column allow-list on profiles (0026) that covers
    -- full_name and student_id but NOT created_at. Selecting it made the whole
    -- search fail for guests with 42501 -- the entire function, not just the
    -- member section -- which is precisely the failure this file's header
    -- warns about for `email`. Found by testing as anon, not by reading.
    select 'member'::text, p.id::text, coalesce(p.full_name, ''), p.student_id,
           null::timestamptz
    from public.profiles p, q
    where p.full_name ilike q.term or p.student_id ilike q.term
    order by p.full_name
    limit (select lim from q)
  ),
  acts as (
    select 'activity'::text, a.id::text, a.title, a.location, a.starts_at
    from public.activities a, q
    where a.title ilike q.term
    order by a.starts_at desc
    limit (select lim from q)
  ),
  projs as (
    select 'project'::text, pr.id::text, pr.title, pr.status::text, pr.updated_at
    from public.projects pr, q
    where pr.title ilike q.term
    order by pr.updated_at desc
    limit (select lim from q)
  ),
  docs as (
    select 'document'::text, d.id::text, d.title, d.status::text, d.updated_at
    from public.documents d, q
    where d.title ilike q.term
    order by d.updated_at desc
    limit (select lim from q)
  ),
  bks as (
    select 'book'::text, b.id::text, b.title, b.status::text, b.updated_at
    from public.books b, q
    where b.title ilike q.term
    order by b.updated_at desc
    limit (select lim from q)
  )
  select * from members
  union all select * from acts
  union all select * from projs
  union all select * from docs
  union all select * from bks;
$$;

-- Callable by guests too: the RPC shows them exactly what the public pages
-- already show (public activities, published books, official projects and
-- documents, the member directory 0026 made public), because RLS -- not this
-- grant -- decides the rows.
grant execute on function public.search_all(text, integer) to anon, authenticated;

comment on function public.search_all(text, integer) is
  '§18 global search. SECURITY INVOKER on purpose: per-table RLS does the scoping, so results can never exceed what the caller could reach by browsing. Contact details (profiles.email, citizen_id) and every §15 attendance column are deliberately not searched.';
