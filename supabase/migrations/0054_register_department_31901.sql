-- Restore สาขา 31901, which 0050 deleted in error.
--
-- 0050's header states the seeded rows 31901–31906 "are all INVALID: ... There
-- is no 31xxx block". That reasoning is sound for the generic OVEC scheme, but
-- it is wrong about 31901 specifically: Udon Thani Technical College really
-- does issue it. Checked against the live database before writing this —
--
--   programme code | real accounts | registered after 0050
--   ---------------+---------------+----------------------
--   20901          | 1             | yes
--   31901          | 2             | NO  <- deleted here
--   30901          | 0             | yes
--
-- Both 31901 accounts (69319010003@, 69319010015@) sign in with Google using a
-- college-issued identity, so the code is not something we can "correct" on our
-- side — rewriting their email to 30901 would break their sign-in. The code is
-- real; the department row was the thing missing.
--
-- Symptom this fixes: 0051 resolves สาขา by looking `departments.code` up from
-- the student ID. With no 31901 row that lookup yields NULL, so both accounts
-- signed in successfully (the lookup fails open by design) but with no สาขา.
--
-- Do NOT re-delete 31901 as invalid demo data. It is in use.

insert into public.departments (code, name_th, name_en) values
  ('31901', 'เทคโนโลยีสารสนเทศ', 'Information Technology')
on conflict (code) do nothing;

-- Backfill anyone whose สาขา could not be resolved before the row existed.
-- Deliberately generic rather than hardcoded to 31901 — identical to 0051's
-- backfill, so any code registered later is picked up by the same statement.
-- `department_id is null` keeps a สาขา an admin set by hand from being
-- overwritten by a guess from the ID.
update public.profiles p
   set department_id = d.id
  from public.departments d
 where p.department_id is null
   and p.student_id is not null
   and d.code = substring(p.student_id from 3 for 5);
