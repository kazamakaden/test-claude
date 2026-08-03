import { z } from "zod";
import { isFlipHtml5EmbedUrl } from "@/lib/fliphtml5";

const documentIdSchema = z.uuid();

/** A malformed id can never reach a real row, so treat it as "not found" rather than a 500. */
export function parseDocumentId(id: string): string | null {
  const result = documentIdSchema.safeParse(id);
  return result.success ? result.data : null;
}

const PER_PAGE = 10;
const sortColumns = ["updatedAt", "title", "status"] as const;
const statuses = ["draft", "signed", "pending_approval", "official"] as const;

export const DOCUMENTS_PER_PAGE_SIZE = PER_PAGE;

/** §12 document workflow list filters — same construction as schemas/projects.ts. */
export const documentFiltersSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  status: z.enum(statuses).nullable().catch(null),
  sort: z.enum(sortColumns).catch("updatedAt"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().positive().catch(1),
});

export function parseDocumentsSearchParams(
  searchParams: Record<string, string | string[] | undefined>
) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return documentFiltersSchema.parse({
    search: single(searchParams.search) ?? "",
    status: single(searchParams.status) ?? null,
    sort: single(searchParams.sort) ?? "updatedAt",
    direction: single(searchParams.dir) ?? "desc",
    page: single(searchParams.page) ?? "1",
  });
}

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const saveDocumentDraftSchema = z.object({
  documentId: z.uuid(),
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  content: z.string().trim().max(20000).nullable().catch(null),
  description: z.string().trim().max(500).nullable().catch(null),
  // "" (an empty form field) means "no book attached yet", not a validation
  // error — only a genuinely non-empty value gets checked against the
  // FlipHTML5 allow-list (lib/fliphtml5.ts), same shape as the AnyFlip-era
  // check this replaces.
  flipbookUrl: z
    .string()
    .trim()
    .nullable()
    .catch(null)
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isFlipHtml5EmbedUrl(value), {
      message: "flipbookUrlInvalid",
    }),
});
export type SaveDocumentDraftInput = z.infer<typeof saveDocumentDraftSchema>;

/** §17: the confirm step requires typing this exact Thai word before saving. */
const CONFIRM_TEXT_TH = "ยืนยัน";

export const signDocumentSchema = z.object({
  documentId: z.uuid(),
  signatureData: z
    .string()
    .trim()
    .min(1, { message: "signatureRequired" })
    .refine((v) => v.startsWith("data:image/"), { message: "signatureInvalid" }),
  confirmText: z.literal(CONFIRM_TEXT_TH, { message: "confirmTextMismatch" }),
});
export type SignDocumentInput = z.infer<typeof signDocumentSchema>;

export const submitDocumentSchema = z.object({ documentId: z.uuid() });

export const rejectDocumentSchema = z.object({
  documentId: z.uuid(),
  reason: z.string().trim().min(1, { message: "reasonRequired" }).max(1000),
});
export type RejectDocumentInput = z.infer<typeof rejectDocumentSchema>;
