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

export type DocumentSortColumn = "updatedAt" | "title" | "status";
export type DocumentSortDirection = "asc" | "desc";

export interface DocumentDraftContent {
  content: string | null;
  updatedAt: string;
}

/**
 * Owner/reviewer workflow shape — distinct from DocumentDetail above, which
 * hardcodes status='official' and never needs draft content or signature
 * info.
 */
export interface DocumentWorkflowDetail {
  id: string;
  title: string;
  status: DocumentStatus;
  ownerId: string | null;
  ownerName: string | null;
  rejectedReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  draft: DocumentDraftContent | null;
  hasSignature: boolean;
}

export interface DocumentWorkflowSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  ownerName: string | null;
  updatedAt: string;
}

export interface DocumentWorkflowFilters {
  search: string;
  status: DocumentStatus | null;
  sort: DocumentSortColumn;
  direction: DocumentSortDirection;
  page: number;
}

export interface DocumentsWorkflowResult {
  rows: DocumentWorkflowSummary[];
  total: number;
}
