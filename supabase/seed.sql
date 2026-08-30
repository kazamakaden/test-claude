-- Departments and clubs for Udon Thani Technical College. `code` values use
-- the §14 7-digit department form so seeded student_id values parse
-- consistently against them.

insert into public.departments (code, name_th, name_en) values
  -- ปวช. — ประกาศนียบัตรวิชาชีพ (OVEC qualification digit 2)
  ('20101', 'ช่างยนต์',                'Automotive Technology'),
  ('20102', 'ช่างกลโรงงาน',            'Machine Shop Technology'),
  ('20103', 'ช่างเชื่อมโลหะ',           'Metal Welding Technology'),
  ('20104', 'ช่างไฟฟ้า',               'Electrical Technology'),
  ('20105', 'ช่างอิเล็กทรอนิกส์',        'Electronics Technology'),
  ('20106', 'ช่างก่อสร้าง',             'Building Construction'),
  ('20107', 'โยธา',                    'Civil Engineering'),
  ('20108', 'สถาปัตยกรรม',             'Architecture'),
  ('20109', 'ช่างซ่อมบำรุง',            'Maintenance Technology'),
  ('20128', 'ช่างเทคนิคคอมพิวเตอร์',    'Computer Technician'),
  ('20214', 'โลจิสติกส์',               'Logistics'),
  ('20901', 'เทคโนโลยีสารสนเทศ',        'Information Technology'),
  -- ปวส. — ประกาศนียบัตรวิชาชีพชั้นสูง (digit 3)
  ('30101', 'เทคนิคเครื่องกล',          'Mechanical Technology'),
  ('30102', 'เทคนิคการผลิต',           'Production Technology'),
  ('30103', 'เทคนิคโลหะ',              'Metal Technology'),
  ('30104', 'ไฟฟ้า (ไฟฟ้ากำลัง)',       'Electrical Power'),
  ('30105', 'เทคโนโลยีอิเล็กทรอนิกส์',   'Electronics Technology'),
  ('30106', 'ช่างก่อสร้าง',             'Building Construction'),
  ('30107', 'โยธา',                    'Civil Engineering'),
  ('30108', 'เทคนิคสถาปัตยกรรม',        'Architectural Technology'),
  ('30110', 'เทคนิคอุตสาหกรรม',         'Industrial Technology'),
  ('30121', 'เทคนิคยานยนต์ไฟฟ้า',       'Electric Vehicle Technology'),
  ('30128', 'เทคโนโลยีคอมพิวเตอร์',      'Computer Technology'),
  ('30901', 'เทคโนโลยีสารสนเทศ',        'Information Technology'),
  ('30902', 'คอมพิวเตอร์เกมและแอนิเมชั่น', 'Computer Game and Animation'),
  ('30903', 'เครือข่ายคอมพิวเตอร์และความปลอดภัย', 'Computer Network and Security'),
  ('30905', 'การจัดการโลจิสติกส์และซัพพลายเชน',  'Logistics and Supply Chain Management'),
  -- ทล.บ. — เทคโนโลยีบัณฑิต (digit 4)
  ('40101', 'เทคโนโลยีเครื่องยนต์',      'Engine Technology'),
  ('40104', 'เทคโนโลยีไฟฟ้า',           'Electrical Technology')
on conflict (code) do nothing;

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

-- `category` is NOT NULL with no default (0068), so every row must name one;
-- `publish_status` defaults to 'draft' for clients but these seeds are live
-- demo content, so they are published explicitly. The seed runs as the table
-- owner, where activities_publish_guard()'s staff check is carved out on
-- `auth.uid() is null`.
insert into public.activities (title, description, department_id, status, academic_year, starts_at, ends_at, location, is_public, category, publish_status) values
  ('ค่ายอาสาพัฒนาชุมชน', 'กิจกรรมจิตอาสาพัฒนาชุมชนรอบวิทยาลัย', (select id from public.departments where code = '30101'), 'completed', 69, now() - interval '45 days', now() - interval '44 days', 'ชุมชนรอบวิทยาลัย', true, 'org', 'published'),
  ('อบรมความปลอดภัยในโรงฝึกงาน', 'อบรมมาตรฐานความปลอดภัยสำหรับนักเรียนแผนกช่างไฟฟ้า', (select id from public.departments where code = '30104'), 'completed', 69, now() - interval '20 days', now() - interval '20 days', 'ห้องปฏิบัติการไฟฟ้า', false, 'club', 'published'),
  ('อบรมเตรียมความพร้อมกิจกรรม QR เข้าแถว', 'อบรมการใช้งานระบบ QR สำหรับเข้าร่วมกิจกรรม', (select id from public.departments where code = '30901'), 'pending', 69, now() + interval '6 days', now() + interval '6 days', 'ห้องปฏิบัติการคอมพิวเตอร์ 2', true, 'org', 'published'),
  ('ประชุมคณะกรรมการ อวท. ประจำเดือน', 'ประชุมติดตามความคืบหน้าโครงการประจำเดือน', null, 'pending', 69, now() + interval '3 days', now() + interval '3 days', 'ห้องประชุมใหญ่ อาคาร 1', true, 'org', 'published'),
  ('กิจกรรมจิตอาสาทำความสะอาดวัด', 'กิจกรรมบำเพ็ญประโยชน์ร่วมกับชุมชน', (select id from public.departments where code = '30101'), 'completed', 69, now() - interval '6 days', now() - interval '6 days', 'วัดในชุมชน', false, 'club', 'published'),
  ('ส่งเอกสารโครงการประจำภาคเรียน', 'กำหนดส่งเอกสารสรุปโครงการ', (select id from public.departments where code = '30106'), 'cancelled', 69, now() - interval '90 days', now() - interval '90 days', 'ตึกบริหาร', false, 'org', 'published');

insert into public.projects (title, description, status, department_id) values
  ('โครงการค่ายอาสาพัฒนาชุมชน', 'สรุปผลกิจกรรมค่ายอาสาพัฒนาชุมชนประจำปี', 'official', (select id from public.departments where code = '30101')),
  ('โครงการอบรมทักษะดิจิทัลสำหรับนักเรียน', 'โครงการอบรมทักษะดิจิทัลพื้นฐาน', 'teacher_review', (select id from public.departments where code = '30901')),
  ('โครงการซ่อมบำรุงอุปกรณ์ไฟฟ้าชุมชน', 'โครงการซ่อมบำรุงอุปกรณ์ไฟฟ้าให้ชุมชนรอบวิทยาลัย', 'draft', (select id from public.departments where code = '30104'));

insert into public.documents (title, status) values
  ('รายงานสรุปกิจกรรมค่ายอาสา', 'draft'),
  ('หนังสือขออนุมัติจัดกิจกรรม', 'pending_approval');

-- §12 documents — status 'official' so anon can see them
-- (documents_select_official, 0008_dashboard_rls.sql).
--
-- These are DOCUMENTS, not the e-book shelf. The two were briefly the same
-- thing: `documents.flipbook_url` held a third-party flipbook link and
-- approveDocument() copied an approved document onto the shelf. 0053 removed
-- the flipbook integration entirely — the column is gone from both tables and
-- the bridge with it — so a document has no file of its own and the shelf
-- reads `books` (below). This insert used to name flipbook_url and would fail
-- with 42703 on a fresh database.
insert into public.documents (title, description, status, published_at) values
  ('ปฏิทินกิจกรรม อวท. ตัวอย่าง', 'ตัวอย่างเอกสารอย่างเป็นทางการสำหรับสาธิตระบบ', 'official', now() - interval '10 days'),
  ('คู่มือนักเรียน อวท. (ตัวอย่าง)', 'เอกสารอย่างเป็นทางการสำหรับสาธิตระบบ', 'official', now() - interval '30 days'),
  ('รายงานประจำปี อวท. (ตัวอย่าง)', 'เอกสารอย่างเป็นทางการสำหรับสาธิตระบบ', 'official', now() - interval '60 days');

-- §3 public books shelf (0027–0029). Separate from the `documents` rows
-- above, and no longer connected to them at all: 0053 removed
-- approveDocument()'s document -> shelf bridge along with the flipbook
-- columns, so the only way onto this shelf is an upload.
--
-- All three rows here are 'draft', not 'published', and must be:
-- books_published_needs_pdf (0053, replacing 0027's needs_content) refuses a
-- published row with no pdf_path outright — confirmed live, 23514, when a
-- first attempt at this seed tried 'published'. Seeding a PDF is not
-- possible from a SQL file, since the file has to exist in the private
-- `books` Storage bucket first. A genuinely file-less book can only legally
-- be a draft, so a
-- fresh guest visiting /documents sees the honest empty "no published
-- books yet" state, and staff/an owner browsing while signed in sees these
-- three exercising the year/season filters and search instead.
-- owner_id/published_by are left null — the demo accounts these would
-- otherwise reference are created out-of-band via the Admin API, not
-- guaranteed to exist when this script runs.
-- `collection` is NOT NULL with no default (0074), so every row must name its
-- shelf. One per collection so all three pages have something to render.
insert into public.books (title, description, academic_year, season, status, collection) values
  ('วารสาร อวท. ภาคเรียนที่ 1 (ตัวอย่าง)', 'ตัวอย่างหนังสือประจำภาคเรียนที่ 1 ยังไม่แนบไฟล์', 2569, 1, 'draft', 'aft11_good'),
  ('รายงานประจำปีการศึกษา 2568 (ตัวอย่าง)', 'ตัวอย่างหนังสือปีการศึกษาก่อนหน้า ยังไม่แนบไฟล์', 2568, 2, 'draft', 'aft11_skilled'),
  ('ร่างวารสาร อวท. ภาคเรียนที่ 2 (ตัวอย่าง)', 'ร่างหนังสือที่ยังไม่เผยแพร่', 2569, 2, 'draft', 'admin_info');

-- Broadcast rows (recipient_id null) are visible to every signed-in user.
-- No `read` column: 0037 moved read state into notification_reads, since a
-- single boolean on a shared broadcast row can't be per-user. These carry no
-- message_key — they're free-text announcements, rendered from `title`.
insert into public.notifications (recipient_id, type, title, body) values
  (null, 'approval', 'โครงการ "ค่ายอาสาพัฒนาชุมชน" ได้รับการอนุมัติแล้ว', null),
  (null, 'deadline', 'ส่งร่างเอกสารกิจกรรมภายในวันที่ 5 สิงหาคม', null),
  (null, 'meeting', 'ประชุมคณะกรรมการ อวท. ประจำเดือน', null);

-- §14 demo accounts (documented in .demo-accounts.local.md, git-ignored since
-- it holds real generated passwords) need nothing seeded here, and the reason
-- has changed twice.
--
-- Originally an address had to be listed in an `approved_accounts` roster
-- before it could sign up at all; 0020 dropped that table and replaced it with
-- a `pending` waiting room; 0046 then removed the waiting room too. Current
-- behaviour: handle_new_user() assigns the role from the email's local part
-- (§14) at first sign-in, so a numeric-ID address lands `student` and a named
-- address lands `teacher` with no seed-time or admin step in between.
--
-- The one role that still needs a human action is `aft`, and it is not written
-- directly: an admin assigns an อวท. ตำแหน่ง from /members and
-- sync_role_with_position() (0049) promotes student -> aft. Seeding it here
-- would need a profiles row, which needs an auth.users row, which this file
-- cannot create.
