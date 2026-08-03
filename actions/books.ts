"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-role";
import {
  createBookSchema,
  updateBookSchema,
  deleteBookSchema,
  publishBookSchema,
  unpublishBookSchema,
} from "@/schemas/books";
import {
  createBook,
  updateBook,
  deleteBook,
  publishBook as publishBookService,
  unpublishBook as unpublishBookService,
} from "@/services/books";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type BookErrorKey =
  | "titleRequired"
  | "yearInvalid"
  | "seasonInvalid"
  | "flipbookUrlInvalid"
  | "descriptionTooLong"
  | "notFoundOrForbidden"
  | "needsContent"
  | "unknown";

export type BookActionResult = { ok: true; id: string } | { ok: false; messageKey: BookErrorKey };

function isBookErrorKey(value: string | undefined): value is BookErrorKey {
  return (
    value === "titleRequired" ||
    value === "yearInvalid" ||
    value === "seasonInvalid" ||
    value === "flipbookUrlInvalid" ||
    value === "descriptionTooLong"
  );
}

function getLang(formData: FormData): Locale {
  const raw = formData.get("lang");
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}

/** Task 2's minimal create step. Any signed-in, non-pending user may add a book — workspace:access is the matching existing permission (student/teacher/aft_teacher/admin). */
export async function createBookAction(
  _prevState: BookActionResult | null,
  formData: FormData
): Promise<BookActionResult> {
  const lang = getLang(formData);
  await requirePermission("workspace:access", lang);

  const parsed = createBookSchema.safeParse({
    title: formData.get("title"),
    academicYear: formData.get("academicYear"),
    season: formData.get("season"),
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isBookErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await createBook(parsed.data, user.id);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/documents`);
  redirect(`/${lang}/documents/${result.id}`);
}

export async function updateBookAction(
  _prevState: BookActionResult | null,
  formData: FormData
): Promise<BookActionResult> {
  const lang = getLang(formData);
  await requirePermission("workspace:access", lang);

  const parsed = updateBookSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    academicYear: formData.get("academicYear"),
    season: formData.get("season"),
    flipbookUrl: formData.get("flipbookUrl") || null,
    pdfPath: formData.get("pdfPath") || null,
    coverPath: formData.get("coverPath") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isBookErrorKey(rawKey) ? rawKey : "unknown" };
  }

  // RLS (books_update_own_draft / books_staff_all, 0028) is the actual
  // authority on whether this caller may touch this row — a disallowed
  // update just returns no row, mapped here rather than distinguishing
  // "not yours" from "doesn't exist" (§19, never leak existence).
  const result = await updateBook(parsed.data);
  if (!result.ok) return { ok: false, messageKey: "notFoundOrForbidden" };

  revalidatePath(`/${lang}/documents`);
  revalidatePath(`/${lang}/documents/${parsed.data.id}`);
  return { ok: true, id: parsed.data.id };
}

export type DeleteBookResult = { ok: true } | { ok: false; messageKey: "notFoundOrForbidden" | "unknown" };

export async function deleteBookAction(lang: Locale, id: string): Promise<DeleteBookResult> {
  await requirePermission("workspace:access", lang);

  const parsed = deleteBookSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, messageKey: "unknown" };

  const result = await deleteBook(parsed.data.id);
  if (!result.ok) return { ok: false, messageKey: "notFoundOrForbidden" };

  revalidatePath(`/${lang}/documents`);
  revalidatePath(`/${lang}/documents/${parsed.data.id}`);
  return { ok: true };
}

export type PublishBookResult =
  | { ok: true }
  | { ok: false; messageKey: "needsContent" | "notFoundOrForbidden" | "unknown" };

/** document:approve is the existing อวท. teacher/admin tier — the confirmed publish gate (task 2/3), same tier the §12 document workflow already uses. */
export async function publishBookAction(lang: Locale, id: string): Promise<PublishBookResult> {
  await requirePermission("document:approve", lang);

  const parsed = publishBookSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, messageKey: "unknown" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await publishBookService(parsed.data.id, user.id);
  if (!result.ok) {
    const key = result.error.includes("books_published_needs_content") ? "needsContent" : "notFoundOrForbidden";
    return { ok: false, messageKey: key };
  }

  revalidatePath(`/${lang}/documents`);
  revalidatePath(`/${lang}/documents/${parsed.data.id}`);
  return { ok: true };
}

export async function unpublishBookAction(
  lang: Locale,
  id: string
): Promise<{ ok: true } | { ok: false; messageKey: "notFoundOrForbidden" | "unknown" }> {
  await requirePermission("document:approve", lang);

  const parsed = unpublishBookSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, messageKey: "unknown" };

  const result = await unpublishBookService(parsed.data.id);
  if (!result.ok) return { ok: false, messageKey: "notFoundOrForbidden" };

  revalidatePath(`/${lang}/documents`);
  revalidatePath(`/${lang}/documents/${parsed.data.id}`);
  return { ok: true };
}
