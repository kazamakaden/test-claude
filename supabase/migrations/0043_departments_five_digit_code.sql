-- A department's code is 5 digits, not 7.
--
-- The 7-digit รหัสวิชา in a student ID is not atomic — it decomposes:
--
--   69   31901        00      15
--   └yr  └department  └group  └roll
--
-- 0042 assumed the whole 7 digits identified the department, so
-- lib/student-id.ts matched on all 7. That only ever worked for group `00`,
-- which is exactly what the six seeded rows happen to be. A real ช่างยนต์
-- student in group 02 has รหัสวิชา 3190102, matched nothing, and the auto-input
-- form offered to create a SECOND ช่างยนต์ department — the bug this fixes.
--
-- Narrowing the stored code (rather than keeping 7 digits and matching on
-- substr(code,1,5) in the app) is what makes the ambiguity unrepresentable:
-- with a substring match, 3190100 and 3190101 could both exist and both claim
-- prefix 31901, and no constraint could reject it. At 5 digits the existing
-- UNIQUE (code) does that job for free.
--
-- Safe on live data, verified before writing rather than assumed: all six
-- rows' 5-digit prefixes (31901..31906) are already distinct, so the UPDATE
-- below cannot violate departments_code_key.

-- Must go first: the existing CHECK demands exactly 7 digits, so the UPDATE
-- would fail against it.
alter table public.departments
  drop constraint departments_code_format;

update public.departments
   set code = substr(code, 1, 5)
 where length(code) = 7;

-- Re-assert the shape, now 5. Still the database layer of §19's three-layer
-- validation (Zod in schemas/members.ts and the parser in lib/student-id.ts
-- are the other two) — a 4- or 6-digit row would silently mis-parse every
-- student in that department.
alter table public.departments
  add constraint departments_code_format check (code ~ '^[0-9]{5}$');

comment on column public.departments.code is
  'Five-digit department code — digits 3-7 of a student ID. The two digits '
  'after it in the ID are the student''s group/classroom index, which belongs '
  'to the student, not the department, and is deliberately not stored here.';
