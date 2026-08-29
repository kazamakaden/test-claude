import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { can } from "@/lib/auth/permissions";
import type { Role } from "@/types/auth";
import type { SavePushSubscriptionInput } from "@/schemas/push";
import type { Locale } from "@/lib/i18n/config";

/**
 * Task 5. Write path (push_subscriptions_insert_own/update_own, 0034) —
 * upsert on (user_id, endpoint) since a browser re-registering the same
 * endpoint (e.g. after a service-worker update) should replace its stored
 * keys, not fail on the unique constraint.
 */
export async function savePushSubscription(
  userId: string,
  input: SavePushSubscriptionInput,
  locale: Locale
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: input.endpoint,
        p256dh_key: input.p256dhKey,
        auth_key: input.authKey,
        user_agent: input.userAgent,
        // Server-derived from the caller's [lang] segment, never from the
        // request body — a client has no business choosing what language
        // the server will later compose its notifications in (0040).
        locale,
      },
      { onConflict: "user_id,endpoint" }
    )
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not allowed" };
  return { ok: true };
}

/**
 * `.eq("user_id", userId)` alongside the RLS `using (user_id = auth.uid())`
 * is redundant with RLS in principle, but explicit here since a delete has
 * no useful "wrong owner" distinction to report — either it's the caller's
 * own row or it silently deletes zero rows.
 */
export async function deletePushSubscription(
  userId: string,
  endpoint: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** One row per device to deliver to, with the language it asked for. */
export interface PushTarget {
  id: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  locale: Locale;
}

/**
 * Every subscription that should receive a given notification.
 *
 * Uses the **service-role** client, not the caller's: this runs from a
 * database webhook with no user session at all, and must read subscriptions
 * belonging to other people. That is exactly the privilege boundary
 * `lib/supabase/admin.ts` exists for, and exactly why /api/push/dispatch
 * authenticates its caller before ever reaching this function.
 *
 * `recipientId === null` is a broadcast (§16) and fans out to every member.
 * Role is re-checked here rather than trusted from subscribe time: 0034's
 * insert policy required a real member role *then*, but a member can since
 * have been revoked to `pending`, and a revoked user must stop receiving
 * notifications on their phone as well as in the app.
 */
export async function listPushTargets(recipientId: string | null): Promise<PushTarget[]> {
  if (!isSupabaseAdminConfigured) return [];
  const supabase = createAdminClient();

  let query = supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key, locale, profiles!inner(role)");

  if (recipientId) query = query.eq("user_id", recipientId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .filter((row) => {
      // Supabase types an embedded !inner join as an array in some shapes and
      // an object in others depending on the inferred relationship; normalise
      // rather than assume, so a schema-cache change can't silently drop every
      // recipient.
      const joined = row.profiles as unknown;
      const profile = Array.isArray(joined) ? joined[0] : joined;
      const role = (profile as { role?: string } | undefined)?.role;
      return role !== undefined && can(role as Role, "notification:read");
    })
    .map((row) => ({
      id: row.id,
      endpoint: row.endpoint,
      p256dhKey: row.p256dh_key,
      authKey: row.auth_key,
      locale: (row.locale === "en" ? "en" : "th") as Locale,
    }));
}

/**
 * Drops subscriptions the push service has told us are gone (404/410).
 * Without this the table grows a permanent tail of dead endpoints that are
 * retried on every future notification.
 */
export async function deletePushSubscriptionsById(ids: string[]): Promise<number> {
  if (ids.length === 0 || !isSupabaseAdminConfigured) return 0;
  const supabase = createAdminClient();

  const { error } = await supabase.from("push_subscriptions").delete().in("id", ids);
  if (error) return 0;
  return ids.length;
}
