import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import { BOOKS_PER_PAGE_SIZE } from "@/schemas/books";
import type { CreateBookInput, UpdateBookInput } from "@/schemas/books";
import type { BookDetail, BookFilters, BookSummary, BooksResult } from "@/types/books";

/** §3 → snake_case column mapping, whitelisted so it's never interpolated raw into order(). */
const SORT_COLUMNS = {
  publishedAt: "published_at",
  title: "title",
  academicYear: "academic_year",
} as const;

const BOOK_SUMMARY_COLUMNS =
  "id, title, academic_year, season, status, cover_path, pdf_path, published_at, owner_id";

/**
 * RLS (books_select_published/own/staff, 0028) scopes visibility — same as
 * services/documents.ts relying on RLS rather than app-layer role
 * branching. A guest gets published-only, an owner also gets their own
 * drafts, staff gets everything.
 */
export async function listBooks(filters: BookFilters): Promise<BooksResult> {
  const supabase = await tryCreateClient();
  if (!supabase) return { rows: [], total: 0 };
  const start = (filters.page - 1) * BOOKS_PER_PAGE_SIZE;

  let query = supabase.from("books").select(BOOK_SUMMARY_COLUMNS, { count: "exact" });

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.ilike("title", `%${q}%`);
  }
  if (filters.academicYear !== null) query = query.eq("academic_year", filters.academicYear);
  if (filters.season !== null) query = query.eq("season", filters.season);

  const { data, error, count } = await query
    .order(SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc", nullsFirst: false })
    .range(start, start + BOOKS_PER_PAGE_SIZE - 1);

  if (error || !data) return { rows: [], total: 0 };

  const rows: BookSummary[] = data.map((b) => ({
    id: b.id,
    title: b.title,
    academicYear: b.academic_year,
    season: b.season,
    status: b.status,
    coverPath: b.cover_path,
    pdfPath: b.pdf_path,
    publishedAt: b.published_at,
    ownerId: b.owner_id,
  }));

  return { rows, total: count ?? 0 };
}

/**
 * A missing row (RLS hid it, or the id doesn't exist) returns null — the
 * caller calls notFound(), same "never leak existence via a different
 * error" contract as services/documents.ts#getDocument (§19).
 */
export async function getBook(id: string): Promise<BookDetail | null> {
  // tryCreateClient, not createClient: this is a read path whose caller
  // already handles null by calling notFound(), and createServerClient()
  // throws *synchronously* when the env vars are absent — above the page's
  // own boundary, so it surfaces as a bare 500 rather than a 404. Same
  // convention (and same lesson) as listBooks/getBookYears/getMembers.
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  // `profiles(full_name)` alone is ambiguous — books has two FKs to
  // profiles (owner_id, published_by) — so PostgREST needs the specific
  // relationship hinted, or this fails to type at compile time.
  const { data, error } = await supabase
    .from("books")
    .select(
      "id, title, description, academic_year, season, status, pdf_path, cover_path, owner_id, published_at, owner:profiles!books_owner_id_fkey(full_name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    academicYear: data.academic_year,
    season: data.season,
    status: data.status,
    pdfPath: data.pdf_path,
    coverPath: data.cover_path,
    ownerId: data.owner_id,
    ownerName: data.owner?.full_name ?? null,
    publishedAt: data.published_at,
  };
}

/** Task 2's minimal create step. books_insert_own (0028) pins status='draft' regardless. */
export async function createBook(
  input: CreateBookInput,
  ownerId: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .insert({ title: input.title, academic_year: input.academicYear, season: input.season, owner_id: ownerId })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, id: data.id };
}

export async function updateBook(input: UpdateBookInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not authenticated" };

  // Defense-in-depth (§19): pdfPath/coverPath arrive as plain hidden-field
  // strings from the two-phase upload flow (browser -> Storage directly,
  // then this Server Action). RLS on storage.objects already requires the
  // *upload* to have landed in the caller's own folder, but a tampered
  // hidden field could otherwise reference any path this same caller is
  // later allowed to read (their own drafts, or anything published — see
  // 0029's storage SELECT policy) rather than a path they actually
  // uploaded.
  //
  // Only check ownership when the path is actually CHANGING. The edit
  // form always round-trips the book's existing pdfPath/coverPath as a
  // hidden field (components/books/file-uploader.tsx's initialPath) even
  // when the viewer never touches the file input — for staff editing a
  // student's already-uploaded book, that hidden field still carries the
  // *original owner's* path, not the staff member's own. Rejecting an
  // unchanged path here would block every staff metadata-only edit on any
  // book that already has content attached.
  const { data: existing } = await supabase
    .from("books")
    .select("pdf_path, cover_path")
    .eq("id", input.id)
    .maybeSingle();

  if (input.pdfPath && input.pdfPath !== existing?.pdf_path && !input.pdfPath.startsWith(`${user.id}/`)) {
    return { ok: false, error: "invalid pdf path" };
  }
  if (input.coverPath && input.coverPath !== existing?.cover_path && !input.coverPath.startsWith(`${user.id}/`)) {
    return { ok: false, error: "invalid cover path" };
  }

  const { data, error } = await supabase
    .from("books")
    .update({
      title: input.title,
      description: input.description,
      academic_year: input.academicYear,
      season: input.season,
      pdf_path: input.pdfPath,
      cover_path: input.coverPath,
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}

/**
 * Removes the row, then best-effort cleans up its storage objects. A
 * cleanup failure leaves an orphaned object rather than a broken book —
 * the safer failure direction, accepted rather than adding a pg_cron
 * sweeper for what should be a rare case.
 */
export async function deleteBook(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { data: existing } = await supabase.from("books").select("pdf_path, cover_path").eq("id", id).maybeSingle();

  const { data, error } = await supabase.from("books").delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };

  if (existing?.pdf_path) await supabase.storage.from("books").remove([existing.pdf_path]);
  if (existing?.cover_path) await supabase.storage.from("book-covers").remove([existing.cover_path]);

  return { ok: true };
}

/** Staff-only in practice (books_staff_all, 0028) — the actual transition an owner's own UPDATE policy can never reach. */
export async function publishBook(
  id: string,
  publishedBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .update({ status: "published", published_at: new Date().toISOString(), published_by: publishedBy })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}

export async function unpublishBook(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .update({ status: "draft", published_at: null, published_by: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: error?.message ?? "not found or not allowed" };
  return { ok: true };
}

/** Distinct academic years for the shelf filter dropdown — only among books this viewer can actually see (RLS-scoped, same as the query it mirrors). */
export async function getBookYears(): Promise<number[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("books").select("academic_year");

  if (error || !data) return [];

  return [...new Set(data.map((r) => r.academic_year))].sort((a, b) => b - a);
}

/**
 * Signed URL minted per request with the *caller's own* client — never the
 * service-role key, which this codebase never puts in a request path. TTL
 * matches components/documents' precedent of "regenerated per render", not
 * cached.
 *
 * `downloadAs` (task 6): a plain HTML `download` attribute is silently
 * ignored on a cross-origin URL, and Supabase Storage is always a
 * different origin from the app — so the only way to make a PDF actually
 * download instead of navigate is Storage's own `?download=` query param,
 * which makes the response carry `Content-Disposition: attachment`.
 * Passing a filename here (rather than `true`) is what names the saved
 * file instead of leaving it as the opaque storage object id. The token
 * signs the *path*, not the query string, so the same signed URL would
 * still work without `download` too — this is purely a response-header
 * toggle, not a second permission check.
 *
 * Deliberately NOT passed as the SDK's own `{ download }` option — the
 * installed `@supabase/storage-js` builds that query param with
 * `URLSearchParams` (percent-encodes non-ASCII bytes) and then runs the
 * *entire* URL through `encodeURI()` again, which re-escapes the `%`
 * characters `URLSearchParams` just produced. For an ASCII filename this
 * is a no-op; for a Thai title — the common case for this project's book
 * titles, per lib/books.ts#bookPdfFilename's own comment — it corrupts the
 * filename into literal `%E0%B9…` text (verified directly: reproduced the
 * SDK's exact `encodeURI(base + "&" + params.toString())` sequence in
 * Node). Working around it by minting the plain signed URL first and
 * appending `download=` ourselves, encoded exactly once, avoids the SDK's
 * internal re-encoding pass entirely.
 */
export async function getSignedPdfUrl(path: string, downloadAs?: string): Promise<string | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("books").createSignedUrl(path, 3600);
  if (error || !data) return null;
  if (!downloadAs) return data.signedUrl;
  return `${data.signedUrl}&download=${encodeURIComponent(downloadAs)}`;
}

/**
 * Signs a whole page of objects in ONE Storage round trip.
 *
 * The shelf renders 12 cards, each needing a cover URL and (now that a card
 * links straight at its file) a PDF URL — 24 sequential round trips if each
 * card mints its own. `createSignedUrls` takes the batch instead. Callers
 * pass the paths they already hold from the list query, so this adds no
 * extra database read.
 *
 * Returns a path -> URL map; a path that failed to sign is simply absent,
 * which callers treat the same as "no file", never as a hard error.
 */
export async function getSignedUrlMap(
  bucket: "books" | "book-covers",
  paths: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();

  const supabase = await tryCreateClient();
  if (!supabase) return new Map();

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, 3600);
  if (error || !data) return new Map();

  return new Map(
    data.flatMap((entry) =>
      entry.signedUrl && entry.path ? [[entry.path, entry.signedUrl] as [string, string]] : []
    )
  );
}

export async function getSignedCoverUrl(path: string): Promise<string | null> {
  const supabase = await tryCreateClient();
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("book-covers").createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}
