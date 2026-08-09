"use server";

import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { savePushSubscriptionSchema, deletePushSubscriptionSchema } from "@/schemas/push";
import { savePushSubscription, deletePushSubscription } from "@/services/push";
import type { Locale } from "@/lib/i18n/config";

export type PushActionResult = { ok: true } | { ok: false; error: "invalidEndpoint" | "invalidKeys" | "unknown" };

/**
 * Task 5. Plain-argument signature, not FormData — PushManager.subscribe()
 * is JavaScript-only (there is no no-JS path to preserve here, unlike the
 * form actions elsewhere in this codebase), same justified deviation
 * actions/activities.ts's deleteActivityAction(lang, id) already uses.
 * `user.id` is taken from the caller's own session, never an argument —
 * that, plus push_subscriptions_insert_own/update_own (0034), is the whole
 * authorization story.
 */
export async function savePushSubscriptionAction(
  lang: Locale,
  input: unknown
): Promise<PushActionResult> {
  await requirePermission("notification:read", lang);

  const parsed = savePushSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, error: rawKey === "invalidKeys" ? "invalidKeys" : "invalidEndpoint" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unknown" };

  const result = await savePushSubscription(user.id, parsed.data);
  if (!result.ok) return { ok: false, error: "unknown" };
  return { ok: true };
}

export async function deletePushSubscriptionAction(lang: Locale, endpoint: string): Promise<PushActionResult> {
  await requirePermission("notification:read", lang);

  const parsed = deletePushSubscriptionSchema.safeParse({ endpoint });
  if (!parsed.success) return { ok: false, error: "invalidEndpoint" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unknown" };

  const result = await deletePushSubscription(user.id, parsed.data.endpoint);
  if (!result.ok) return { ok: false, error: "unknown" };
  return { ok: true };
}
