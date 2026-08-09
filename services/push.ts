import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import type { SavePushSubscriptionInput } from "@/schemas/push";

/**
 * Task 5. Write path (push_subscriptions_insert_own/update_own, 0034) —
 * upsert on (user_id, endpoint) since a browser re-registering the same
 * endpoint (e.g. after a service-worker update) should replace its stored
 * keys, not fail on the unique constraint.
 */
export async function savePushSubscription(
  userId: string,
  input: SavePushSubscriptionInput
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

/**
 * Read path — tryCreateClient() fail-soft to null, same contract as every
 * other read function in this codebase.
 */
export async function getPushSubscription(userId: string, endpoint: string) {
  const supabase = await tryCreateClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
