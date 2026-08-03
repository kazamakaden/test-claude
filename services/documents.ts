import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  DocumentDetail,
  DocumentStatus,
  DocumentSummary,
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

// RLS (documents_select_official, 0008_dashboard_rls.sql) already scopes
// anon/authenticated to status = 'official' or their own rows — no status
// filter needed here, same as services/activities.ts relying on RLS rather
// than app-layer role branching.
export async function listDocuments(): Promise<DocumentSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, description, published_at, status")
    .eq("status", "official")
    .order("published_at", { ascending: false });

  if (error || !data) return [];

  return data.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.description,
    publishedAt: doc.published_at,
  }));
}

/**
 * A missing row (RLS hid it, or the id doesn't exist) returns null — the
 * caller calls notFound(), which is correct: a guest requesting a draft's id
 * genuinely gets no row back, indistinguishable from a bad id, and that is
 * the right behavior (§19, never leak existence via a different error).
 */
export async function getDocument(id: string): Promise<DocumentDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, description, published_at, flipbook_url, status")
    .eq("id", id)
    .eq("status", "official")
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    publishedAt: data.published_at,
    flipbookUrl: data.flipbook_url,
  };
}

// ---------------------------------------------------------------------
// §12/§17 draft -> signed -> pending_approval -> official workflow.
// Distinct from listDocuments/getDocument above, which serve the public
// official-only shelf and reader.
// ---------------------------------------------------------------------

/** §12 → snake_case column mapping, whitelisted so it's never interpolated raw into order(). */
const WORKFLOW_SORT_COLUMNS = {
  updatedAt: "updated_at",
  title: "title",
  status: "status",
} as const;

const WORKFLOW_COLUMNS =
  "id, title, status, owner_id, rejected_reason, published_at, created_at, updated_at, profiles(full_name)";

type DocumentWorkflowRow = {
  id: string;
  title: string;
  status: DocumentStatus;
  owner_id: string | null;
  rejected_reason: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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

  const { data: docData, error: docError } = await supabase
    .from("documents")
    .update({ title: input.title })
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
 * Sets published_at, which is what wires this into the already-built
 * public shelf (listDocuments above orders by published_at desc where
 * status='official') — without it, a newly-approved document would never
 * surface on /documents.
 */
export async function approveDocument(documentId: string) {
  return transitionDocument(documentId, {
    status: "official",
    published_at: new Date().toISOString(),
  });
}

export async function rejectDocument(input: RejectDocumentInput) {
  return transitionDocument(input.documentId, { status: "draft", rejected_reason: input.reason });
}
