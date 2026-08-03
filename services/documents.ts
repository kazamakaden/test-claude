import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  DocumentStatus,
  DocumentWorkflowDetail,
  DocumentWorkflowFilters,
  DocumentWorkflowSummary,
  DocumentsWorkflowResult,
} from "@/types/documents";
import type {
  CreateDocumentInput,
  RejectDocumentInput,
  SaveDocumentDraftInput,
} from "@/schemas/documents";
import { DOCUMENTS_PER_PAGE_SIZE } from "@/schemas/documents";
import { toFlipHtml5EmbedUrl } from "@/lib/fliphtml5";
import { deriveAcademicYearAndSeason } from "@/lib/books";

// ---------------------------------------------------------------------
// §12/§17 draft -> signed -> pending_approval -> official workflow. The
// public-facing shelf/reader reads from `books` (services/books.ts), not
// this table directly — approveDocument below bridges an approved row
// into `books` — so everything from here down is the private draft/review
// side only.
// ---------------------------------------------------------------------

/** §12 → snake_case column mapping, whitelisted so it's never interpolated raw into order(). */
const WORKFLOW_SORT_COLUMNS = {
  updatedAt: "updated_at",
  title: "title",
  status: "status",
} as const;

const WORKFLOW_COLUMNS =
  "id, title, status, owner_id, rejected_reason, published_at, created_at, updated_at, description, flipbook_url, profiles(full_name)";

type DocumentWorkflowRow = {
  id: string;
  title: string;
  status: DocumentStatus;
  owner_id: string | null;
  rejected_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  description: string | null;
  flipbook_url: string | null;
  profiles: { full_name: string | null } | null;
};

function toWorkflowSummary(row: DocumentWorkflowRow): DocumentWorkflowSummary {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    ownerName: row.profiles?.full_name ?? null,
    updatedAt: row.updated_at,
  };
}

/**
 * A caller's own documents (any status, via RLS's documents_select_own)
 * plus every official document — narrower than what reviewers can
 * technically see, same reasoning as services/projects.ts's listMyProjects.
 */
export async function listMyDocuments(
  ownerId: string,
  filters: DocumentWorkflowFilters
): Promise<DocumentsWorkflowResult> {
  const supabase = await createClient();
  const start = (filters.page - 1) * DOCUMENTS_PER_PAGE_SIZE;

  let query = supabase
    .from("documents")
    .select(WORKFLOW_COLUMNS, { count: "exact" })
    .or(`owner_id.eq.${ownerId},status.eq.official`);

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${q}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query
    .order(WORKFLOW_SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
    .range(start, start + DOCUMENTS_PER_PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  return { rows: (data as DocumentWorkflowRow[]).map(toWorkflowSummary), total: count ?? 0 };
}

/** Reviewer queue — relies on documents_select_reviewer for the actual visibility grant. */
export async function listReviewDocuments(
  filters: DocumentWorkflowFilters
): Promise<DocumentsWorkflowResult> {
  const supabase = await createClient();
  const start = (filters.page - 1) * DOCUMENTS_PER_PAGE_SIZE;

  let query = supabase
    .from("documents")
    .select(WORKFLOW_COLUMNS, { count: "exact" })
    .eq("status", "pending_approval");

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${q}%`);
  }

  query = query
    .order(WORKFLOW_SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
    .range(start, start + DOCUMENTS_PER_PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error || !data) return { rows: [], total: 0 };

  return { rows: (data as DocumentWorkflowRow[]).map(toWorkflowSummary), total: count ?? 0 };
}

/**
 * No status filter (unlike the public getDocument) — RLS scopes
 * visibility. Draft content and signature existence are fetched as
 * separate queries rather than a nested select, since document_drafts'
 * embed cardinality (one row per document, enforced by 0016's unique
 * constraint) isn't worth depending on PostgREST's relationship-inference
 * behavior for.
 */
export async function getDocumentForWorkflow(id: string): Promise<DocumentWorkflowDetail | null> {
  const supabase = await createClient();

  const [docResult, draftResult, signatureResult] = await Promise.all([
    supabase.from("documents").select(WORKFLOW_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("document_drafts").select("content, updated_at").eq("document_id", id).maybeSingle(),
    supabase.from("signature_records").select("id").eq("document_id", id).limit(1).maybeSingle(),
  ]);

  if (docResult.error || !docResult.data) return null;
  const row = docResult.data as DocumentWorkflowRow;

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    ownerId: row.owner_id,
    ownerName: row.profiles?.full_name ?? null,
    rejectedReason: row.rejected_reason,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    draft: draftResult.data
      ? { content: draftResult.data.content, updatedAt: draftResult.data.updated_at }
      : null,
    hasSignature: Boolean(signatureResult.data),
    description: row.description,
    flipbookUrl: row.flipbook_url,
  };
}

export async function createDocument(
  input: CreateDocumentInput,
  ownerId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({ title: input.title, owner_id: ownerId, status: "draft" })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };

  // Not wrapped in a transaction: if this second insert fails, the result
  // is just a document with no draft row yet, which saveDocumentDraft's
  // upsert below self-heals on first save — a UX inconvenience, not the
  // "signature exists but status didn't move" class of inconsistency that
  // justified sign_document() being a single atomic function.
  await supabase
    .from("document_drafts")
    .insert({ document_id: data.id, content: null, created_by: ownerId });

  return { ok: true, id: data.id };
}

export async function saveDocumentDraft(
  input: SaveDocumentDraftInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  // Normalize before writing so what lands in the column is always the
  // canonical https://online.fliphtml5.com/x/y/ form regardless of which
  // valid variant (bare share link, www., mixed case) the owner pasted —
  // schemas/documents.ts already refused anything that fails
  // isFlipHtml5EmbedUrl, so toFlipHtml5EmbedUrl here can't return null for
  // a non-null input.
  const flipbookUrl = input.flipbookUrl ? toFlipHtml5EmbedUrl(input.flipbookUrl) : null;

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .update({ title: input.title, description: input.description, flipbook_url: flipbookUrl })
    .eq("id", input.documentId)
    .select("id")
    .maybeSingle();

  if (docError || !docData) {
    return { ok: false, error: docError?.message ?? "not found or not allowed" };
  }

  const { error: draftError } = await supabase
    .from("document_drafts")
    .upsert({ document_id: input.documentId, content: input.content }, { onConflict: "document_id" });

  if (draftError) return { ok: false, error: draftError.message };
  return { ok: true };
}

export async function signDocument(
  documentId: string,
  signatureData: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_document", {
    p_document_id: documentId,
    p_signature_data: signatureData,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function transitionDocument(
  documentId: string,
  patch: Database["public"]["Tables"]["documents"]["Update"]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", documentId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}

export async function submitDocumentForApproval(documentId: string) {
  return transitionDocument(documentId, { status: "pending_approval" });
}

/**
 * Sets published_at, then bridges onto the public books shelf (confirmed
 * decision: an approved document auto-lists as a book) — upserted on
 * source_document_id (0027's unique constraint) so this stays idempotent
 * rather than risking a duplicate. Only a document that actually has a
 * book link is bridged: one with neither a link nor a PDF would violate
 * books_published_needs_content (0027) outright, and there'd be nothing to
 * read anyway. The bridge is best-effort and never blocks or fails the
 * underlying document approval — the §12 trigger/RLS/UI stay untouched.
 */
export async function approveDocument(documentId: string) {
  const result = await transitionDocument(documentId, {
    status: "official",
    published_at: new Date().toISOString(),
  });
  if (!result.ok) return result;

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("title, description, flipbook_url, owner_id")
    .eq("id", documentId)
    .maybeSingle();

  if (doc?.flipbook_url) {
    const now = new Date();
    const { academicYear, season } = deriveAcademicYearAndSeason(now);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("books").upsert(
      {
        source_document_id: documentId,
        title: doc.title,
        description: doc.description,
        flipbook_url: doc.flipbook_url,
        academic_year: academicYear,
        season,
        status: "published",
        owner_id: doc.owner_id,
        published_at: now.toISOString(),
        published_by: user?.id ?? null,
      },
      { onConflict: "source_document_id" }
    );
  }

  return result;
}

export async function rejectDocument(input: RejectDocumentInput) {
  return transitionDocument(input.documentId, { status: "draft", rejected_reason: input.reason });
}
