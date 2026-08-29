import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import { isSessionExpired } from "@/lib/auth/session-timeout";

/**
 * Refreshes the auth session and copies the resulting cookies onto
 * `response`. Must reuse the same response object the caller returns —
 * writing to a fresh NextResponse.next() here would drop the refreshed
 * cookies on the floor.
 *
 * Also enforces the 12-hour hard session cap: a session past
 * SESSION_MAX_AGE_MS is signed out here (its cookie deletions flow through
 * the same setAll onto `response`) and reported via `sessionExpired`, so the
 * caller can redirect to login with an explanatory message.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse
): Promise<{ response: NextResponse; sessionExpired: boolean }> {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isSessionExpired(user.last_sign_in_at)) {
    await supabase.auth.signOut();
    return { response, sessionExpired: true };
  }

  return { response, sessionExpired: false };
}
