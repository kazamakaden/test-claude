import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DocumentDetail, DocumentSummary } from "@/types/documents";

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
