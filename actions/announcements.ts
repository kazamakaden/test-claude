"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { announcementInputSchema } from "@/schemas/announcements";
import {
  createAnnouncement,
  updateAnnouncement,
  setAnnouncementStatus,
  deleteAnnouncement,
} from "@/services/announcements";
import { readLang, type Locale } from "@/lib/i18n/config";

type ErrorKey =
  | "titleRequired"
  | "titleTooLong"
  | "bodyTooLong"
  | "bodyRequiredToPublish"
  | "forbidden"
  | "notFound"
  | "unknown";

const KNOWN: readonly string[] = [
  "titleRequired",
  "titleTooLong",
  "bodyTooLong",
  "bodyRequiredToPublish",
  "forbidden",
  "notFound",
];

function toErrorKey(value: string | undefined): ErrorKey {
  return KNOWN.includes(value ?? "") ? (value as ErrorKey) : "unknown";
}

export type AnnouncementFormResult = { ok: true } | { ok: false; messageKey: ErrorKey };

function parse(formData: FormData) {
  return announcementInputSchema.safeParse({
    titleTh: formData.get("titleTh"),
    titleEn: formData.get("titleEn") || null,
    bodyTh: formData.get("bodyTh") ?? "",
    bodyEn: formData.get("bodyEn") || null,
    // A checkbox sends nothing when unchecked, so absence means false.
    pinned: formData.get("pinned") === "on",
  });
}

/**
 * All five actions gate on `content:manage` — the same grant that governs
 * editable page copy (0032), and the one 0060's RLS policies name. Deletion
 * additionally requires admin, enforced by announcements_delete_admin rather
 * than a second check here: `content:delete` is admin-only in the matrix, and
 * the database is where that has to hold.
 */
export async function createAnnouncementAction(
  _prev: AnnouncementFormResult | null,
  formData: FormData
): Promise<AnnouncementFormResult> {
  const lang = readLang(formData);
  await requirePermission("content:manage", lang);

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, messageKey: toErrorKey(parsed.error.issues[0]?.message) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "forbidden" };

  // author_id is the caller's own session id, never a form value —
  // announcements_insert_staff refuses anything else anyway.
  const result = await createAnnouncement(parsed.data, user.id);
  if (!result.ok) return { ok: false, messageKey: toErrorKey(result.error) };

  revalidatePath(`/${lang}/announcements`);
  redirect(`/${lang}/announcements/manage/${result.id}`);
}

export async function updateAnnouncementAction(
  _prev: AnnouncementFormResult | null,
  formData: FormData
): Promise<AnnouncementFormResult> {
  const lang = readLang(formData);
  await requirePermission("content:manage", lang);

  const id = String(formData.get("id") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, messageKey: toErrorKey(parsed.error.issues[0]?.message) };
  }

  const result = await updateAnnouncement(id, parsed.data);
  if (!result.ok) return { ok: false, messageKey: toErrorKey(result.error) };

  revalidatePath(`/${lang}/announcements`);
  revalidatePath(`/${lang}/announcements/${id}`);
  return { ok: true };
}

export async function publishAnnouncementAction(
  lang: Locale,
  id: string,
  publish: boolean
): Promise<AnnouncementFormResult> {
  await requirePermission("content:manage", lang);

  const result = await setAnnouncementStatus(id, publish ? "published" : "draft");
  if (!result.ok) return { ok: false, messageKey: toErrorKey(result.error) };

  // Both the list and the detail change shape on publish, and publishing also
  // writes a broadcast notification (0060), so the bell's count is stale too.
  revalidatePath(`/${lang}/announcements`);
  revalidatePath(`/${lang}/announcements/${id}`);
  revalidatePath(`/${lang}/notifications`);
  return { ok: true };
}

export async function deleteAnnouncementAction(
  lang: Locale,
  id: string
): Promise<AnnouncementFormResult> {
  await requirePermission("content:manage", lang);

  const result = await deleteAnnouncement(id);
  if (!result.ok) return { ok: false, messageKey: toErrorKey(result.error) };

  revalidatePath(`/${lang}/announcements`);
  return { ok: true };
}
