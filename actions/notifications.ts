"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { markNotificationReadSchema } from "@/schemas/notifications";
import type { Locale } from "@/lib/i18n/config";

export type NotificationActionResult = { ok: boolean };

/**
 * Both actions below gate on notification:read server-side, and neither takes
 * a user id: the row written is always keyed to the caller's own session, and
 * notification_reads_insert_own (0036) rejects anything else even if this
 * check were bypassed. UI gating is never the boundary (§19).
 */

export async function markAllNotificationsReadAction(
  lang: Locale
): Promise<NotificationActionResult> {
  await requirePermission("notification:read", lang);

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) return { ok: false };

  revalidatePath(`/${lang}/notifications`);
  revalidatePath(`/${lang}`, "layout");
  return { ok: true };
}

export async function markNotificationReadAction(
  lang: Locale,
  id: string
): Promise<NotificationActionResult> {
  await requirePermission("notification:read", lang);

  const parsed = markNotificationReadSchema.safeParse({ id });
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // A read-mark is idempotent — re-reading something already read is not an
  // error, so a duplicate is ignored rather than surfaced.
  const { error } = await supabase
    .from("notification_reads")
    .upsert(
      { notification_id: parsed.data.id, user_id: user.id },
      { onConflict: "notification_id,user_id", ignoreDuplicates: true }
    );

  if (error) return { ok: false };

  revalidatePath(`/${lang}/notifications`);
  revalidatePath(`/${lang}`, "layout");
  return { ok: true };
}
