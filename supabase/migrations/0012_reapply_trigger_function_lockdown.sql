-- 0011's `create or replace function handle_new_user()` reset its grants to
-- the PostgreSQL default (PUBLIC EXECUTE), silently undoing 0006's revoke —
-- CREATE OR REPLACE does not preserve prior REVOKE/GRANT state the way one
-- might expect. Confirmed live via information_schema.role_routine_grants
-- immediately after 0011. Re-apply the lockdown. Any future `create or
-- replace function` on a trigger-only function in this file must repeat
-- this revoke in the same migration, or the security advisor will flag it
-- again (it did, immediately, until this fix).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
