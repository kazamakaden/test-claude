-- ระดับชั้น (ปวช./ปวส./ทล.บ.) for a member, derived from their student ID.
--
-- THE BUG THIS FIXES. handle_new_user() inserts exactly
-- (id, email, role, student_id, department_id, full_name, avatar_url) -- read
-- from pg_proc, not assumed. `class_name` is not in that list and nothing else
-- writes it, so it is NULL for every student who has ever signed in (5 of 5
-- live). §9's Class filter reads its options from
-- services/members.ts#getFilterOptions, which selects distinct class_name --
-- so the dropdown has always been empty and the column always blank.
--
-- GENERATED, NOT BACKFILLED, and that is the whole design. `profiles.
-- academic_year` (0003) is already a generated column from student_id for
-- exactly this reason, and 0043/0054 made the same call for a department's
-- level: "a level column on departments would be a second source of truth that
-- can drift from code; this cannot."
--
-- The level is the 3rd character of the student ID -- the first digit of the
-- 5-digit OVEC programme code (§14):
--
--     66 20901 00 20
--     ^^ ^          year entered, then the programme code whose first digit is
--        |          the qualification: 2 ปวช., 3 ปวส., 4 ทล.บ.
--
-- Deliberately NOT a year-of-study or a group number. A label like ปวช.1/1
-- contains how long the student has been enrolled, which changes every May, so
-- any stored form of it is silently wrong twelve months later on every row.
-- The level never changes for a given student ID, so a generated column is
-- exactly right and can be filtered on with a plain equality.
--
-- Values match lib/student-id.ts#StudentLevel so the TS union and the column
-- cannot drift apart; an unrecognised digit yields NULL rather than failing,
-- the same fail-soft rule §14 sets for a future qualification.

alter table public.profiles
  add column if not exists student_level text
  generated always as (
    case substring(student_id from 3 for 1)
      when '2' then 'vocational'
      when '3' then 'diploma'
      when '4' then 'bachelor'
      else null
    end
  ) stored;

comment on column public.profiles.student_level is
  'ปวช./ปวส./ทล.บ. derived from the 3rd digit of student_id. Generated -- never written, never drifts. Mirrors lib/student-id.ts#StudentLevel.';

-- 0005 replaced profiles' table-level SELECT grant with a per-column
-- allow-list, so a NEW COLUMN IS INVISIBLE until it is named here. That is the
-- exact trap 0030 hit and documented; checked for directly this time rather
-- than found by a later 403.
grant select (student_level) on public.profiles to anon, authenticated;

-- No INSERT or UPDATE grant: a generated column cannot be written at all, and
-- naming it in one would be a lie about what is possible.

create index if not exists profiles_student_level_idx
  on public.profiles (student_level);
