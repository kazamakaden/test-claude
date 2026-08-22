-- Replace the invented seed departments with the real OVEC (สอศ.) programme
-- codes for Udon Thani Technical College.
--
-- The seeded rows (31901–31906) were demo data from an early pass and are all
-- INVALID: OVEC codes are a leading qualification digit — 2 ปวช., 3 ปวส.,
-- 4 ทล.บ. — followed by a 4-digit programme id. There is no 31xxx block, so
-- every one of them would have mis-assigned a real student once
-- 0051 starts deriving สาขา from the student ID.
--
-- Order matters: insert the real rows, repoint everything that referenced an
-- invalid one, and only then delete. A FK must never be left dangling.

-- 1. The official list ------------------------------------------------------
insert into public.departments (code, name_th, name_en) values
  -- ปวช. — ประกาศนียบัตรวิชาชีพ (qualification digit 2)
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
  -- ปวส. — ประกาศนียบัตรวิชาชีพชั้นสูง (qualification digit 3)
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
  -- ทล.บ. — เทคโนโลยีบัณฑิต (qualification digit 4)
  ('40101', 'เทคโนโลยีเครื่องยนต์',      'Engine Technology'),
  ('40104', 'เทคโนโลยีไฟฟ้า',           'Electrical Technology')
on conflict (code) do update
  set name_th = excluded.name_th,
      name_en = excluded.name_en;

-- 2. Repoint demo content off the invalid rows -----------------------------
-- Reference counts checked live first; 31903 had none and 31906 had no
-- activities or projects, so only these four need remapping.
update public.activities a set department_id = n.id
  from public.departments o, public.departments n
 where a.department_id = o.id
   and (o.code, n.code) in (('31901','30101'), ('31902','30104'),
                            ('31904','30106'), ('31905','30901'));

update public.projects p set department_id = n.id
  from public.departments o, public.departments n
 where p.department_id = o.id
   and (o.code, n.code) in (('31901','30101'), ('31902','30104'),
                            ('31904','30106'), ('31905','30901'));

-- Profiles are NOT remapped alongside them. `student_id` is the authoritative
-- source and 0051's backfill derives the สาขา from it correctly; remapping
-- 66209010020 the same way its activities were would have put a ปวช. student
-- into the ปวส. IT department — right name, wrong qualification.
update public.profiles p set department_id = null
  from public.departments o
 where p.department_id = o.id
   and o.code in ('31901','31902','31903','31904','31905','31906');

-- 3. Now nothing references them -------------------------------------------
delete from public.departments
 where code in ('31901','31902','31903','31904','31905','31906');
