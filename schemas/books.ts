import { z } from "zod";
import { isFlipHtml5EmbedUrl } from "@/lib/fliphtml5";

const bookIdSchema = z.uuid();

/** A malformed id can never reach a real row, so treat it as "not found" rather than a 500. */
export function parseBookId(id: string): string | null {
  const result = bookIdSchema.safeParse(id);
  return result.success ? result.data : null;
}

const PER_PAGE = 12;
export const BOOKS_PER_PAGE_SIZE = PER_PAGE;

const sortColumns = ["publishedAt", "title", "academicYear"] as const;

/** §3 shelf list filters — same construction as schemas/members.ts/documents.ts. */
export const booksFiltersSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  academicYear: z.coerce.number().int().nullable().catch(null),
  season: z.coerce.number().int().min(1).max(3).nullable().catch(null),
  sort: z.enum(sortColumns).catch("publishedAt"),
  direction: z.enum(["asc", "desc"]).catch("desc"),
  page: z.coerce.number().int().positive().catch(1),
});

export function parseBooksSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  return booksFiltersSchema.parse({
    search: single(searchParams.search) ?? "",
    academicYear: single(searchParams.year) ?? null,
    season: single(searchParams.season) ?? null,
    sort: single(searchParams.sort) ?? "publishedAt",
    direction: single(searchParams.dir) ?? "desc",
    page: single(searchParams.page) ?? "1",
  });
}

const yearField = z.coerce
  .number({ message: "yearInvalid" })
  .int({ message: "yearInvalid" })
  .min(2500, { message: "yearInvalid" })
  .max(2699, { message: "yearInvalid" });

const seasonField = z.coerce
  .number({ message: "seasonInvalid" })
  .int({ message: "seasonInvalid" })
  .min(1, { message: "seasonInvalid" })
  .max(3, { message: "seasonInvalid" });

/** Task 2's minimal create step: name, year, season -> draft. Everything else is edited afterward. */
export const createBookSchema = z.object({
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  academicYear: yearField,
  season: seasonField,
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, { message: "titleRequired" }).max(200),
  description: z.string().trim().max(2000).nullable().catch(null),
  academicYear: yearField,
  season: seasonField,
  // "" (an empty form field) means "no link attached", not a validation
  // error — only a genuinely non-empty value is checked against the
  // FlipHTML5 allow-list, same shape as schemas/documents.ts's flipbookUrl.
  flipbookUrl: z
    .string()
    .trim()
    .nullable()
    .catch(null)
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isFlipHtml5EmbedUrl(value), { message: "flipbookUrlInvalid" }),
  // Storage object paths, written by the two-phase upload flow (browser ->
  // Storage directly, then this hidden field carries the resulting path
  // into the ordinary Server Action) — never a raw file, since Server
  // Actions have a 1MB body default this codebase does not want to raise.
  pdfPath: z.string().trim().max(500).nullable().catch(null),
  coverPath: z.string().trim().max(500).nullable().catch(null),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const deleteBookSchema = z.object({ id: z.uuid() });

export const publishBookSchema = z.object({ id: z.uuid() });
export const unpublishBookSchema = z.object({ id: z.uuid() });
