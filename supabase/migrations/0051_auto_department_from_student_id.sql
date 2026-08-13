-- Fill a student's สาขา automatically from their college email at sign-in.
--
-- The email local part IS the student ID (§14), and its digits 3-7 are the
-- 5-digit OVEC programme code — the same fixed-width split lib/student-id.ts
-- documents and parseStudentId() already implements for the admin's Auto
-- input screen. Until now that parse existed ONLY client-side, so a student
-- signing in got student_id and academic_year but never department_id.
--
-- 69 30901 00 15  ->  department code 30901  ->  ปวส. เทคโนโลยีสารสนเทศ
-- 66 20901 00 20  ->  department code 20901  ->  ปวช. เทคโนโลยีสารสนเทศ

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  local_part  text := split_part(new.email, '@', 1);
  is_student  boolean := local_part ~ '^[0-9]{11,}$';
  from_google boolean := coalesce(new.raw_app_meta_data -> 'providers' ? 'google', false);
begin
  insert into public.profiles (id, email, role, student_id, department_id, full_name, avatar_url)
  values (
    new.id,
    new.email,
    case when is_student then 'student'::public.user_role
                         else 'teacher'::public.user_role end,
    case when is_student then local_part else null end,
    -- A scalar subquery yields NULL for a programme the college has not
    -- registered, which IS the intended behaviour: a missing สาขา must never
    -- block a real student from signing in. They get the field filled in by
    -- an admin later; everything else about the account still works.
    case when is_student
      then (select d.id from public.departments d
             where d.code = substring(local_part from 3 for 5))
      else null end,
    case when from_google
      then left(coalesce(new.raw_user_meta_data ->> 'full_name',
                          new.raw_user_meta_data ->> 'name'), 100)
      else null end,
    case when from_google
         and coalesce(new.raw_user_meta_data ->> 'avatar_url',
                       new.raw_user_meta_data ->> 'picture') ~ '^https://'
      then coalesce(new.raw_user_meta_data ->> 'avatar_url',
                     new.raw_user_meta_data ->> 'picture')
      else null end
  );
  return new;
end;
$function$;

-- MANDATORY. `create or replace` resets grants to the PostgreSQL default of
-- PUBLIC EXECUTE, silently undoing an earlier REVOKE — this exact function was
-- reopened that way by 0011 and had to be fixed in 0012.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Backfill existing members. Guarded to `department_id is null` so a สาขา an
-- admin set deliberately is never overwritten by a guess from the ID.
update public.profiles p
   set department_id = d.id
  from public.departments d
 where p.department_id is null
   and p.student_id is not null
   and d.code = substring(p.student_id from 3 for 5);
