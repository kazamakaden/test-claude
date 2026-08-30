"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/require-role";
import {
  createDocumentSchema,
  saveDocumentDraftSchema,
  signDocumentSchema,
  rejectDocumentSchema,
} from "@/schemas/documents";
import {
  createDocument,
  saveDocumentDraft,
  signDocument as signDocumentService,
  submitDocumentForApproval,
  approveDocument as approveDocumentService,
  rejectDocument as rejectDocumentService,
} from "@/services/documents";
import { isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";

type DocumentErrorKey = "titleRequired" | "unknown";
export type SaveDocumentResult = { ok: true; id: string } | { ok: false; messageKey: DocumentErrorKey };

type SignErrorKey = "signatureRequired" | "signatureInvalid" | "confirmTextMismatch" | "unknown";
export type SignDocumentResult = { ok: true } | { ok: false; messageKey: SignErrorKey };

export type RejectDocumentResult = { ok: true } | { ok: false; messageKey: "reasonRequired" | "unknown" };

function isDocumentErrorKey(value: string | undefined): value is DocumentErrorKey {
  return value === "titleRequired";
}

function isSignErrorKey(value: string | undefined): value is SignErrorKey {
  return value === "signatureRequired" || value === "signatureInvalid" || value === "confirmTextMismatch";
}

function getLang(formData: FormData): Locale {
  const raw = formData.get("lang");
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}

/**
 * document:sign is the only document-side Student capability §6 names, so
 * it gates the whole owner flow here — create, edit, and the literal
 * signature — not just the last step. §6 separately calls out "submit
 * project drafts" as its own bullet for Projects, which is why that side
 * gets its own project:draft:submit permission and this one doesn't.
 */
export async function createDocumentAction(
  _prevState: SaveDocumentResult | null,
  formData: FormData
): Promise<SaveDocumentResult> {
  const lang = getLang(formData);
  await requirePermission("document:sign", lang);

  const parsed = createDocumentSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isDocumentErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, messageKey: "unknown" };

  const result = await createDocument(parsed.data, user.id);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/documents/manage`);
  redirect(`/${lang}/documents/manage/${result.id}`);
}

export async function saveDocumentDraftAction(
  _prevState: SaveDocumentResult | null,
  formData: FormData
): Promise<SaveDocumentResult> {
  const lang = getLang(formData);
  await requirePermission("document:sign", lang);

  const parsed = saveDocumentDraftSchema.safeParse({
    documentId: formData.get("documentId"),
    title: formData.get("title"),
    content: formData.get("content") || null,
    description: formData.get("description") || null,
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isDocumentErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const result = await saveDocumentDraft(parsed.data);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/documents/manage/${parsed.data.documentId}`);
  return { ok: true, id: parsed.data.documentId };
}

export async function signDocumentAction(
  _prevState: SignDocumentResult | null,
  formData: FormData
): Promise<SignDocumentResult> {
  const lang = getLang(formData);
  await requirePermission("document:sign", lang);

  const parsed = signDocumentSchema.safeParse({
    documentId: formData.get("documentId"),
    signatureData: formData.get("signatureData"),
    confirmText: formData.get("confirmText"),
  });

  if (!parsed.success) {
    const rawKey = parsed.error.issues[0]?.message;
    return { ok: false, messageKey: isSignErrorKey(rawKey) ? rawKey : "unknown" };
  }

  const result = await signDocumentService(parsed.data.documentId, parsed.data.signatureData);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/documents/manage/${parsed.data.documentId}`);
  redirect(`/${lang}/documents/manage/${parsed.data.documentId}`);
}

export async function submitDocument(documentId: string, lang: Locale) {
  await requirePermission("document:sign", lang);
  await submitDocumentForApproval(documentId);
  revalidatePath(`/${lang}/documents/manage/${documentId}`);
  // Submitting is what PUTS the document in front of a reviewer, so it has to
  // refresh the same two lists approveDocument/rejectDocument already do: the
  // owner's own list (whose status column just changed) and the review queue
  // (which just gained a row). Revalidating only the detail page left the
  // submitter looking at a stale status the moment they navigated back.
  revalidatePath(`/${lang}/documents/manage`);
  revalidatePath(`/${lang}/documents/review`);
}

export async function approveDocument(documentId: string, lang: Locale) {
  await requirePermission("document:approve", lang);
  await approveDocumentService(documentId);
  revalidatePath(`/${lang}/documents/manage/${documentId}`);
  revalidatePath(`/${lang}/documents/review`);
  revalidatePath(`/${lang}/documents`);
}

/** No OR-check needed here, unlike projects: only aft_teacher/admin ever reject a document. */
export async function rejectDocument(
  _prevState: RejectDocumentResult | null,
  formData: FormData
): Promise<RejectDocumentResult> {
  const lang = getLang(formData);
  await requirePermission("document:approve", lang);

  const parsed = rejectDocumentSchema.safeParse({
    documentId: formData.get("documentId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { ok: false, messageKey: "reasonRequired" };
  }

  const result = await rejectDocumentService(parsed.data);
  if (!result.ok) return { ok: false, messageKey: "unknown" };

  revalidatePath(`/${lang}/documents/manage/${parsed.data.documentId}`);
  revalidatePath(`/${lang}/documents/review`);
  return { ok: true };
}
