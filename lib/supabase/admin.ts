import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role client — bypasses RLS entirely. Only ever used for
 * auth.users operations (create/delete a member account) that RLS cannot
 * express, since RLS governs public.profiles rows, not the auth schema.
 * Every other write in this app goes through lib/supabase/server.ts's
 * cookie-scoped client so RLS and the profiles triggers still apply.
 *
 * `server-only` (this file) plus never importing SUPABASE_SECRET_KEY under
 * a NEXT_PUBLIC_ name is what keeps this key out of the client bundle.
 */
export const isSupabaseAdminConfigured = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
);

export function createAdminClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
