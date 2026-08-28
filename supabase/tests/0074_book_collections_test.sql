-- Matrix for 0074: books.collection — three named shelves.
--
-- Self-rolling-back and re-runnable. Asserts BOTH directions on purpose: a
-- test that only checks a book is absent from the wrong collection would also
-- pass against a query returning nothing at all, which is the failure mode the
-- 0064/0065/0072 matrices were each written to rule out. Case 04 is that guard.
--
-- The other half of this file is the boundary 0074 must NOT have moved.
-- `books` is the one table here with no column allow-list — anon/authenticated
-- hold table-wide INSERT/UPDATE, so `collection` was granted automatically and
-- nothing in the migration says otherwise. That is only safe because 0028's
-- policies carry the weight, so cases 07/08 re-prove exactly that: an owner
-- still cannot self-publish and still cannot transfer a book, despite holding
-- the column grants for `status` and `owner_id`.
--
-- Write-effect cases pick their assertion deliberately, because RLS refuses an
-- UPDATE in two different ways: a failing USING clause FILTERS (zero rows, no
-- exception, so an exception-based helper would read it as "allowed"), while a
-- failing WITH CHECK RAISES 42501. Cases 07/08 hit WITH CHECK and are asserted
-- as raises; case 06 asserts ROW_COUNT = 1 so the two are not both vacuous.

begin;

create temp table zz_results(id text, ok boolean, detail text) on commit drop;
-- The role switches below apply to this table too, so without this grant every
-- insert 42501s as `authenticated`/`anon`. A harness requirement, not part of
-- what is under test.
grant insert on zz_results to authenticated, anon;

do $$
declare
  teacher uuid;
  student uuid;
  admin_id uuid;
  book_id uuid;
  n int;
  affected int;
begin
  select id into teacher from public.profiles where role in ('teacher','aft') limit 1;
  select id into student from public.profiles where role = 'student' limit 1;
  select id into admin_id from public.profiles where role = 'admin' limit 1;

  ----------------------------------------------------------------- as owner
  perform set_config('request.jwt.claims',
    json_build_object('sub', teacher, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- pdf_path is set because books_published_needs_pdf (0053) refuses a publish
  -- without one, and case 10 has to actually publish. It does not weaken case
  -- 07: RLS's WITH CHECK is evaluated before the table CHECK, confirmed by the
  -- 42501 that case recording rather than a 23514.
  insert into public.books (title, academic_year, season, status, owner_id, collection, pdf_path)
  values ('ZZ0074 good', 2569, 1, 'draft', teacher, 'aft11_good', 'zz0074/test.pdf')
  returning id into book_id;

  insert into zz_results values ('01 owner can create a filed book (guard)',
    book_id is not null, '');

  -- 02/03: "filed at upload" as a database fact, not a service-file
  -- convention. NOT NULL with no default is what makes the omission raise;
  -- the enum is what makes a typo raise.
  begin
    insert into public.books (title, academic_year, season, status, owner_id)
    values ('ZZ0074 nocollection', 2569, 1, 'draft', teacher);
    insert into zz_results values ('02 insert omitting collection refused', false, 'NOT refused');
  exception when others then
    insert into zz_results values ('02 insert omitting collection refused',
      sqlstate = '23502', format('sqlstate=%s %s', sqlstate, sqlerrm));
  end;

  begin
    insert into public.books (title, academic_year, season, status, owner_id, collection)
    values ('ZZ0074 badenum', 2569, 1, 'draft', teacher, 'not_a_collection');
    insert into zz_results values ('03 invalid collection refused', false, 'NOT refused');
  exception when others then
    insert into zz_results values ('03 invalid collection refused',
      sqlstate = '22P02', format('sqlstate=%s', sqlstate));
  end;

  -- 04 is the load-bearing guard for 05: the row must be visible AT ALL, or
  -- "absent from admin_info" proves nothing.
  select count(*) into n from public.books
   where id = book_id and collection = 'aft11_good';
  insert into zz_results values ('04 book IS in its own collection (guard)',
    n = 1, format('rows=%s', n));

  select count(*) into n from public.books
   where id = book_id and collection = 'admin_info';
  insert into zz_results values ('05 book is NOT in another collection',
    n = 0, format('rows=%s', n));

  -- 06: re-filing is an ordinary owner edit — no new policy, no privilege.
  update public.books set collection = 'aft11_skilled' where id = book_id;
  get diagnostics affected = row_count;
  insert into zz_results values ('06 owner can re-file their own draft',
    affected = 1, format('rows=%s', affected));

  -- 07/08: the boundary 0074 must not have moved.
  --
  -- These RAISE rather than filtering, and the distinction is worth stating
  -- because it is the opposite of what the header warns about. RLS filters via
  -- USING; it raises via WITH CHECK. Here books_update_own_draft's USING clause
  -- MATCHES (this is the owner, the row is still a draft, the role is teacher),
  -- so the row is selected for update and the failure lands on WITH CHECK ->
  -- 42501. Case 06 is the same statement shape and legitimately affects a row,
  -- which is what proves these two are refusals and not just no-ops.
  begin
    update public.books set status = 'published' where id = book_id;
    insert into zz_results values ('07 owner still cannot self-publish',
      false, 'NOT refused');
  exception when others then
    insert into zz_results values ('07 owner still cannot self-publish',
      sqlstate = '42501', format('sqlstate=%s %s', sqlstate, sqlerrm));
  end;

  begin
    update public.books set owner_id = student where id = book_id;
    insert into zz_results values ('08 owner still cannot transfer a book',
      false, 'NOT refused');
  exception when others then
    insert into zz_results values ('08 owner still cannot transfer a book',
      sqlstate = '42501', format('sqlstate=%s %s', sqlstate, sqlerrm));
  end;

  ---------------------------------------------------------------- as student
  perform set_config('request.jwt.claims',
    json_build_object('sub', student, 'role', 'authenticated')::text, true);

  select count(*) into n from public.books where id = book_id;
  insert into zz_results values ('09 student sees 0 rows for a draft',
    n = 0, format('rows=%s', n));

  ------------------------------------------------------------------ as admin
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);

  -- The other direction of 07: publish authority is unchanged and still lives
  -- with admin (books_staff_all), not with the owner.
  update public.books set status = 'published' where id = book_id;
  get diagnostics affected = row_count;
  insert into zz_results values ('10 admin CAN publish',
    affected = 1, format('rows=%s', affected));

  ------------------------------------------------------------------ as guest
  perform set_config('request.jwt.claims', null, true);
  reset role;
  set local role anon;

  select count(*) into n from public.books
   where id = book_id and collection = 'aft11_skilled';
  insert into zz_results values ('11 anon sees the published book in its collection',
    n = 1, format('rows=%s', n));

  select count(*) into n from public.books
   where id = book_id and collection = 'admin_info';
  insert into zz_results values ('12 anon does not see it under another collection',
    n = 0, format('rows=%s', n));

  ------------------------------------------------------------------- cleanup
  perform set_config('request.jwt.claims', null, true);
  reset role;
  delete from public.books where title like 'ZZ0074%';

  insert into zz_results values ('13 cleanup: no ZZ0074 rows left',
    (select count(*) from public.books where title like 'ZZ0074%') = 0, '');
end $$;

-- 14: every pre-existing row was backfilled. A NOT NULL column added to a
-- populated table is the step that silently fails if the backfill is skipped.
insert into zz_results
select '14 no NULL collection anywhere',
       count(*) = 0, format('nulls=%s', count(*))
from public.books where collection is null;

-- 15: no policy references the new column. Filing is not a privilege, and if a
-- later migration makes it one this case is where that shows up.
insert into zz_results
select '15 no policy references collection',
       count(*) = 0, format('policies=%s', count(*))
from pg_policies
where schemaname = 'public' and tablename = 'books'
  and (coalesce(qual,'') || coalesce(with_check,'')) like '%collection%';

select id, case when ok then 'PASS' else 'FAIL' end as status, detail
from zz_results order by id;

rollback;
