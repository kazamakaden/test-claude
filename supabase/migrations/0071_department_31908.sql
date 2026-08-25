-- Register สาขา 31908, so 69319080004@udontech.ac.th resolves a สาขา.
--
-- Same shape as 0054 and the same root cause: 0050 loaded the standard OVEC
-- list and removed the 31xxx block as invalid demo data, but Udon Thani
-- Technical College really does issue codes in that block. 0054 already had to
-- restore 31901 for exactly this reason; 31908 is the second one to surface,
-- found by checking which live accounts have no department:
--
--   student_id   | programme | สาขา before this migration
--   -------------+-----------+---------------------------
--   66209010020  | 20901     | เทคโนโลยีสารสนเทศ
--   67201060020  | 20106     | ช่างก่อสร้าง
--   69319010003  | 31901     | เทคโนโลยีสารสนเทศ   (restored by 0054)
--   69319010015  | 31901     | เทคโนโลยีสารสนเทศ   (restored by 0054)
--   69319080004  | 31908     | NONE  <- this migration
--
-- The name was supplied by the college, not inferred: guessing would put a
-- real student in the wrong สาขา, which is worse than the blank they have now.
--
-- 30908 is NOT registered here. No account uses it, and 0050's reasoning about
-- unissued codes still stands — register what the college actually issues, not
-- what the numbering scheme would permit.
--
-- Note for whoever reads a สาขา list afterwards and thinks it looks wrong:
-- 30903 already carries this same name, so 31908 is the THIRD same-name pair
-- (after 30901/31901 เทคโนโลยีสารสนเทศ). Both are ปวส., so the ระดับ prefix does
-- not separate them either. That is expected, and departmentOptionLabel()
-- already appends the code because of it — see CLAUDE.md §14.

insert into public.departments (code, name_th, name_en) values
  ('31908', 'เครือข่ายคอมพิวเตอร์และความปลอดภัย', 'Computer Networks and Security')
on conflict (code) do nothing;

-- Backfill, verbatim from 0051/0054 rather than rewritten for this code, so a
-- code registered later is picked up by the same statement. `department_id is
-- null` keeps a สาขา an admin set by hand from being overwritten by a guess
-- from the ID. prevent_member_identity_change (0025) guards department_id but
-- carves out `auth.uid() is null`, which is the path a migration runs on.
update public.profiles p
   set department_id = d.id
  from public.departments d
 where p.department_id is null
   and p.student_id is not null
   and d.code = substring(p.student_id from 3 for 5);
