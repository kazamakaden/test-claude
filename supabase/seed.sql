-- Departments and clubs for Udon Thani Technical College. `code` values use
-- the §14 7-digit department form so seeded student_id values parse
-- consistently against them.

insert into public.departments (code, name_th, name_en) values
  ('3190100', 'ช่างยนต์', 'Automotive Technology'),
  ('3190200', 'ช่างไฟฟ้ากำลัง', 'Electrical Power Technology'),
  ('3190300', 'ช่างอิเล็กทรอนิกส์', 'Electronics Technology'),
  ('3190400', 'ช่างก่อสร้าง', 'Construction Technology'),
  ('3190500', 'เทคโนโลยีสารสนเทศ', 'Information Technology'),
  ('3190600', 'การบัญชี', 'Accounting');

insert into public.clubs (name_th, name_en) values
  ('ชมรมอาสาพัฒนา', 'Community Service Club'),
  ('ชมรมกีฬา', 'Sports Club'),
  ('ชมรมดนตรี', 'Music Club'),
  ('ชมรมวิชาการ', 'Academic Club');

-- §8 dashboard demo data. attendance is deliberately left empty — every row
-- has a NOT NULL FK to profiles, and no real student accounts exist yet
-- (attendance only gets populated once §13 QR attendance is live and
-- students actually check in). document_drafts is also deliberately left
-- empty, to exercise a genuine empty state on the dashboard, per the note in
-- lib/dev-fixtures.ts's old (removed) comment that falsely claimed this.

insert into public.activities (title, description, department_id, status, academic_year, starts_at, ends_at, location, is_public) values
  ('ค่ายอาสาพัฒนาชุมชน', 'กิจกรรมจิตอาสาพัฒนาชุมชนรอบวิทยาลัย', (select id from public.departments where code = '3190100'), 'completed', 69, now() - interval '45 days', now() - interval '44 days', 'ชุมชนรอบวิทยาลัย', true),
  ('อบรมความปลอดภัยในโรงฝึกงาน', 'อบรมมาตรฐานความปลอดภัยสำหรับนักเรียนแผนกช่างไฟฟ้า', (select id from public.departments where code = '3190200'), 'completed', 69, now() - interval '20 days', now() - interval '20 days', 'ห้องปฏิบัติการไฟฟ้า', false),
  ('อบรมเตรียมความพร้อมกิจกรรม QR เข้าแถว', 'อบรมการใช้งานระบบ QR สำหรับเข้าร่วมกิจกรรม', (select id from public.departments where code = '3190500'), 'pending', 69, now() + interval '6 days', now() + interval '6 days', 'ห้องปฏิบัติการคอมพิวเตอร์ 2', true),
  ('ประชุมคณะกรรมการ อวท. ประจำเดือน', 'ประชุมติดตามความคืบหน้าโครงการประจำเดือน', null, 'pending', 69, now() + interval '3 days', now() + interval '3 days', 'ห้องประชุมใหญ่ อาคาร 1', true),
  ('กิจกรรมจิตอาสาทำความสะอาดวัด', 'กิจกรรมบำเพ็ญประโยชน์ร่วมกับชุมชน', (select id from public.departments where code = '3190100'), 'completed', 69, now() - interval '6 days', now() - interval '6 days', 'วัดในชุมชน', false),
  ('ส่งเอกสารโครงการประจำภาคเรียน', 'กำหนดส่งเอกสารสรุปโครงการ', (select id from public.departments where code = '3190400'), 'cancelled', 69, now() - interval '90 days', now() - interval '90 days', 'ตึกบริหาร', false);

insert into public.projects (title, description, status, department_id) values
  ('โครงการค่ายอาสาพัฒนาชุมชน', 'สรุปผลกิจกรรมค่ายอาสาพัฒนาชุมชนประจำปี', 'official', (select id from public.departments where code = '3190100')),
  ('โครงการอบรมทักษะดิจิทัลสำหรับนักเรียน', 'โครงการอบรมทักษะดิจิทัลพื้นฐาน', 'teacher_review', (select id from public.departments where code = '3190500')),
  ('โครงการซ่อมบำรุงอุปกรณ์ไฟฟ้าชุมชน', 'โครงการซ่อมบำรุงอุปกรณ์ไฟฟ้าให้ชุมชนรอบวิทยาลัย', 'draft', (select id from public.departments where code = '3190200'));

insert into public.documents (title, status) values
  ('รายงานสรุปกิจกรรมค่ายอาสา', 'draft'),
  ('หนังสือขออนุมัติจัดกิจกรรม', 'pending_approval');

insert into public.notifications (recipient_id, type, title, body, read) values
  (null, 'approval', 'โครงการ "ค่ายอาสาพัฒนาชุมชน" ได้รับการอนุมัติแล้ว', null, false),
  (null, 'deadline', 'ส่งร่างเอกสารกิจกรรมภายในวันที่ 5 สิงหาคม', null, false),
  (null, 'meeting', 'ประชุมคณะกรรมการ อวท. ประจำเดือน', null, true);

-- §14 allow-list demo row — the student half of the four demo accounts
-- documented in .demo-accounts.local.md (git-ignored, not this file, since
-- it holds real generated passwords). This row alone doesn't create the
-- auth.users account; that step is the Admin API, done once per environment.
insert into public.approved_accounts (email, role, department_id, note) values
  ('69319010099@udontech.ac.th', 'student',
   (select id from public.departments where code = '3190500'),
   'Demo account seeded for phase verification — see README')
  on conflict (email) do nothing;
