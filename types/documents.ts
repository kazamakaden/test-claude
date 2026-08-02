export type DocumentStatus = "draft" | "signed" | "pending_approval" | "official";

/**
 * Shelf-listing shape — no flipbook_url, since the shelf only ever shows a
 * placeholder cover (see components/documents/book-cover.tsx) and links to
 * the reader route rather than embedding the frame inline.
 */
export interface DocumentSummary {
  id: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
}

/** Reader-page shape — the only place flipbook_url is ever read. */
export interface DocumentDetail extends DocumentSummary {
  flipbookUrl: string | null;
}
