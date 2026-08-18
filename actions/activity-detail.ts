"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/require-role";
import { getSessionUserId } from "@/lib/auth/get-role";
import {
  addBannerSchema,
  removeBannerSchema,
  activityEditorSchema,
  expectedAttendeesSchema,
} from "@/schemas/activities";
import {
  addActivityBanner,
  removeActivityBanner,
  addActivityEditor,
  removeActivityEditor,
  updateExpectedAttendees,
} from "@/services/activities";
import type { Locale } from "@/lib/i18n/config";

export type DetailActionResult = { ok: true } | { ok: false; messageKey: string };

/**
 * Every action here guards twice, and the two guards do different jobs.
 *
 * requirePermission("activity:manage") is a COARSE gate: it redirects a
 * signed-out or non-staff caller cleanly instead of letting them reach a query
 * that would fail with a raw error. It does NOT establish that this caller may
 * edit THIS activity — `activity:manage` is role-wide.
 *
 * The per-row authority is can_edit_activity() (0061), enforced by RLS inside
 * every statement these call. That is the boundary. A staff member who is
 * neither owner nor co-editor passes the guard here and is refused by the
 * database, which the services translate into a "forbidden" message rather
 * than a crash.
 */

export async function addBannerAction(
  lang: Locale,
  activityId: string,
  storagePath: string
): Promise<DetailActionResult> {
  await requirePermission("activity:manage", lang);

  const parsed = addBannerSchema.safeParse({ activityId, storagePath });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const userId = await getSessionUserId();
  if (!userId) return { ok: false, messageKey: "forbidden" };

  const result = await addActivityBanner(parsed.data.activityId, parsed.data.storagePath, userId);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}/activities/${activityId}`);
  return { ok: true };
}

export async function removeBannerAction(
  lang: Locale,
  activityId: string,
  bannerId: string
): Promise<DetailActionResult> {
  await requirePermission("activity:manage", lang);

  const parsed = removeBannerSchema.safeParse({ activityId, bannerId });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const result = await removeActivityBanner(parsed.data.bannerId);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}/activities/${activityId}`);
  return { ok: true };
}

export async function addEditorAction(
  lang: Locale,
  activityId: string,
  userId: string
): Promise<DetailActionResult> {
  await requirePermission("activity:manage", lang);

  const parsed = activityEditorSchema.safeParse({ activityId, userId });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const grantedBy = await getSessionUserId();
  if (!grantedBy) return { ok: false, messageKey: "forbidden" };

  // Granting is OWNER-only, not co-editor -- otherwise a delegate could add
  // further delegates. That rule lives in activity_editors_insert_owner (0061),
  // which reads a.created_by directly rather than calling can_edit_activity().
  const result = await addActivityEditor(parsed.data.activityId, parsed.data.userId, grantedBy);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}/activities/${activityId}`);
  return { ok: true };
}

export async function removeEditorAction(
  lang: Locale,
  activityId: string,
  userId: string
): Promise<DetailActionResult> {
  await requirePermission("activity:manage", lang);

  const parsed = activityEditorSchema.safeParse({ activityId, userId });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const result = await removeActivityEditor(parsed.data.activityId, parsed.data.userId);
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}/activities/${activityId}`);
  return { ok: true };
}

export async function setExpectedAttendeesAction(
  lang: Locale,
  activityId: string,
  expectedAttendees: string
): Promise<DetailActionResult> {
  await requirePermission("activity:manage", lang);

  const parsed = expectedAttendeesSchema.safeParse({ activityId, expectedAttendees });
  if (!parsed.success) return { ok: false, messageKey: "invalidInput" };

  const result = await updateExpectedAttendees(
    parsed.data.activityId,
    parsed.data.expectedAttendees
  );
  if (!result.ok) return { ok: false, messageKey: result.error };

  revalidatePath(`/${lang}/activities/${activityId}`);
  return { ok: true };
}
