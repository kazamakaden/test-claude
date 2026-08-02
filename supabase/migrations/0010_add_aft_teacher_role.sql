-- อาจารย์ อวท. (AFT advisor teacher) — a role between teacher and admin.
-- PostgreSQL forbids using a new enum value in the same transaction it was
-- added in, so this migration does nothing else; 0011 is where it's used.
alter type public.user_role add value 'aft_teacher' after 'teacher';
