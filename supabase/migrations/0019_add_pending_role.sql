-- 'pending' — a signed-in user who has not yet been approved by an admin.
-- Holds guest-level permissions only (public content), never workspace
-- access, until an admin assigns them a real role via /approvals.
--
-- PostgreSQL forbids using a new enum value in the same transaction it was
-- added in, so this migration does nothing else — 0020 is where it's used.
-- Same reason 0010 exists as its own migration for 'aft_teacher'.
alter type public.user_role add value 'pending' before 'student';
