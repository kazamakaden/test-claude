export type DocumentStatus = "draft" | "signed" | "pending_approval" | "official";

export type DocumentSortColumn = "updatedAt" | "title" | "status";
export type DocumentSortDirection = "asc" | "desc";

export interface DocumentDraftContent {
  content: string | null;
  updatedAt: string;
}

/**
 * Owner/reviewer workflow shape. An approved document's public-facing
 * lifetime is on the books shelf, not here — see
 * services/documents.ts#approveDocument's bridge into `books` — so this
 * type only ever needs to describe the private draft/review side.
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
  /**
   * §12 e-book metadata — editable by the owner while the document is still
   * a draft (components/documents/document-form.tsx), then carried through
   * unchanged for the rest of the workflow so a reviewer can preview the
   * attached book (components/documents/flipbook-viewer.tsx) before
   * approving.
   */
  description: string | null;
  flipbookUrl: string | null;
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
