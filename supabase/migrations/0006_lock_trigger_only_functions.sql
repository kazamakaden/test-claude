-- These four functions exist only to run as triggers and were never meant to
-- be invoked directly. Supabase's linter flagged all of them as publicly
-- callable via /rest/v1/rpc/<name> (anon and authenticated both). Calling
-- handle_new_user() directly would insert a bogus profiles row; the others
-- are no-ops outside a trigger context but should still not be exposed API
-- surface. current_role() and get_citizen_id() are intentionally left
-- callable — the former is a harmless self-lookup, the latter already
-- fails closed to non-admins.
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.prevent_role_self_escalation() from anon, authenticated;
revoke execute on function public.prevent_citizen_id_change() from anon, authenticated;
