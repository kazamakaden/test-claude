import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Server Component / Server Action client. Server Components cannot write
 * cookies, so setAll() is a no-op there — middleware.ts owns session refresh.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — session refresh happens in
            // middleware.ts instead.
          }
        },
      },
    }
  );
}

/**
 * Same client as createClient(), but returns null instead of throwing when
 * Supabase isn't configured. createServerClient() throws synchronously on a
 * missing URL/key — fine for a write path that must have a real client, but
 * fatal for a read-only "list" service meant to fail soft to an empty
 * result (services/books.ts#listBooks/getBookYears intend exactly that via
 * their own `if (error || !data) return []` guards, but never get the
 * chance to run because the throw happens before any query does). Callers
 * that use this must already handle a null client the same way they handle
 * a query error.
 */
export async function tryCreateClient() {
  if (!isSupabaseConfigured) return null;
  return createClient();
}
