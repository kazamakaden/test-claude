import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";

/**
 * Refreshes the auth session and copies the resulting cookies onto
 * `response`. Must reuse the same response object the caller returns —
 * writing to a fresh NextResponse.next() here would drop the refreshed
 * cookies on the floor.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Revalidates the JWT with the auth server (never trust getSession()'s
  // unverified cookie contents on a code path that gates access).
  await supabase.auth.getUser();

  return response;
}
