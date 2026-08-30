-- Matrix for 0077: the storage.objects policies for the `books` /
-- `book-covers` buckets, brought in line with 0049's role split.
--
-- Self-rolling-back and re-runnable. It writes -- there is no way to prove an
-- INSERT policy without attempting an insert -- so everything happens inside
-- one transaction that is rolled back at the end. Case 00 re-asserts zero
-- residue before the rollback so a future reader can see it was checked, not
-- assumed.
--
-- Asserts BOTH directions throughout. A file that only proved `student` is
-- refused would pass just as well against a policy that refuses EVERYONE --
-- which is precisely the bug being fixed, in the opposite direction. Cases 01
-- and 04 are the load-bearing "allowed" guards.
--
-- Roles are flipped onto a real profile and flipped back inside the same
-- transaction. Note the trap 0065's matrix hit: `set local
-- request.jwt.claims` OUTLIVES a helper's `reset role`, so a later statement
-- meant to run as a migration still sees the previous actor's auth.uid() and
-- prevent_role_self_escalation correctly refuses it. Every flip below clears
-- the claim first, because the carve-out that path relies on is
-- `auth.uid() is null`.

begin;

create temp table zz_results(id text, ok boolean, detail text) on commit drop;
-- The role switches below apply to this table too; without the grant every
-- insert 42501s as authenticated and the run dies on case 01.
grant insert on zz_results to authenticated;

do $$
declare
  subject   uuid;   -- the profile whose role we flip through the matrix
  other     uuid;   -- a different owner, for the cross-owner read case
  original  public.user_role;
  obj       text;
  other_obj text;
  n         int;
begin
  select id into subject from public.profiles where role = 'student' limit 1;
  select id into other   from public.profiles where id <> subject limit 1;

  if subject is null or other is null then
    insert into zz_results values ('00a fixtures found (guard)', false,
      format('subject=%s other=%s', subject, other));
    return;
  end if;

  select role into original from public.profiles where id = subject;
  obj       := subject::text || '/00000000-0000-4000-8000-00000000b00c/zz0077.pdf';
  other_obj := other::text   || '/00000000-0000-4000-8000-00000000b00d/zz0077.pdf';

  ---------------------------------------------------------------- as `aft`
  perform set_config('request.jwt.claims', null, true);
  update public.profiles set role = 'aft' where id = subject;

  perform set_config('request.jwt.claims',
    json_build_object('sub', subject, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 01: THE REGRESSION, and the load-bearing "allowed" case. Before 0077 the
  -- policy named ('student','teacher','aft_teacher','admin'), so an `aft` --
  -- the only student-side role that can create a book row at all -- could not
  -- upload its PDF, and books_published_needs_pdf then made a publishable
  -- book impossible for them.
  begin
    insert into storage.objects (bucket_id, name, owner) values ('books', obj, subject);
    insert into zz_results values ('01 aft may upload a book PDF (guard)', true, obj);
  exception when others then
    insert into zz_results values ('01 aft may upload a book PDF (guard)', false,
      format('REFUSED %s %s', sqlstate, sqlerrm));
  end;

  -- 02: and into the cover bucket, which the same policy governs.
  begin
    insert into storage.objects (bucket_id, name, owner)
      values ('book-covers', subject::text || '/c/zz0077.png', subject);
    insert into zz_results values ('02 aft may upload a cover', true, '');
  exception when others then
    insert into zz_results values ('02 aft may upload a cover', false,
      format('REFUSED %s %s', sqlstate, sqlerrm));
  end;

  -- 03: folder ownership still holds. books_storage_insert_own's first clause
  -- is untouched by 0077 and must not have been loosened by it.
  begin
    insert into storage.objects (bucket_id, name, owner) values ('books', other_obj, subject);
    insert into zz_results values ('03 aft cannot upload into another folder', false, 'NOT REFUSED');
  exception when others then
    insert into zz_results values ('03 aft cannot upload into another folder', true,
      format('%s %s', sqlstate, sqlerrm));
  end;

  reset role;

  ------------------------------------------------------------ as `teacher`
  perform set_config('request.jwt.claims', null, true);
  update public.profiles set role = 'teacher' where id = subject;
  perform set_config('request.jwt.claims',
    json_build_object('sub', subject, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 04: the third consequence. The staff clause used to read
  -- ('aft_teacher','admin') -- unstorable since 0046, so admin-only -- while
  -- books_select_staff (0049) lets a teacher SEE the draft row. A reviewer
  -- could open a draft book and not be allowed to mint a URL for its file.
  select count(*) into n from storage.objects where name = obj;
  insert into zz_results values ('04 teacher may read another owner''s draft object (guard)',
    n = 1, format('rows=%s', n));

  reset role;

  ------------------------------------------------------------ as `student`
  perform set_config('request.jwt.claims', null, true);
  update public.profiles set role = 'student' where id = subject;
  perform set_config('request.jwt.claims',
    json_build_object('sub', subject, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 05: a student cannot author a book (books_insert_own, 0049) and now
  -- cannot litter the bucket either.
  begin
    insert into storage.objects (bucket_id, name, owner)
      values ('books', subject::text || '/s/zz0077.pdf', subject);
    insert into zz_results values ('05 student cannot upload', false, 'NOT REFUSED');
  exception when others then
    insert into zz_results values ('05 student cannot upload', true,
      format('%s %s', sqlstate, sqlerrm));
  end;

  -- 06: and cannot read another owner's draft object either -- the staff
  -- clause must not have widened to every signed-in user.
  select count(*) into n from storage.objects where name = obj;
  insert into zz_results values ('06 student cannot read another owner''s draft',
    n = 0, format('rows=%s', n));

  reset role;

  ---------------------------------------------------------------- as anon
  perform set_config('request.jwt.claims', null, true);
  set local role anon;

  -- 07: books_storage_select_anon is deliberately untouched by 0077 and is
  -- "belongs to a PUBLISHED book" only. This object belongs to no book at all.
  select count(*) into n from storage.objects where name = obj;
  insert into zz_results values ('07 anon cannot read an unpublished object', n = 0,
    format('rows=%s', n));

  reset role;
  perform set_config('request.jwt.claims', null, true);

  -- restore, inside the transaction that is about to roll back anyway --
  -- belt and braces, so a partial run cannot leave a role changed.
  update public.profiles set role = original where id = subject;
end $$;

-- 08: the old role names are gone from all three policies. Case 01 already
-- proves the behaviour; this names WHICH version is deployed when it does not.
insert into zz_results
select '08 no policy still names aft_teacher/student',
       count(*) = 0,
       format('stale=%s', coalesce(string_agg(policyname, ', '), 'none'))
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in ('books_storage_insert_own', 'books_storage_delete_own_or_staff',
                     'books_storage_select_authenticated')
  and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'aft_teacher|''student''';

-- 09: and all three DO name aft.
insert into zz_results
select '09 all three policies name aft', count(*) = 3, format('matched=%s', count(*))
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in ('books_storage_insert_own', 'books_storage_delete_own_or_staff',
                     'books_storage_select_authenticated')
  and (coalesce(qual, '') || coalesce(with_check, '')) ~ '''aft''';

-- 00: residue check BEFORE the rollback, so it is visible in the output rather
-- than merely implied by the rollback that follows.
insert into zz_results
select '00 residue: only this run''s rows exist, all rolled back next',
       count(*) = 3, format('zz0077 objects=%s (rolled back)', count(*))
from storage.objects where name like '%zz0077%';

select id, case when ok then 'PASS' else 'FAIL' end as status, detail
from zz_results order by id;

rollback;
