import { z } from "zod";

/**
 * Bounds mirror 0065's CHECK constraints exactly. They are the friendly layer,
 * not the boundary — the database refuses the same values independently, which
 * is what protects a direct REST call that never passes through here.
 */
export const academicYearField = z.coerce.number().int().min(2500).max(2700);
export const termField = z.coerce.number().int().refine((n) => n === 1 || n === 2, {
  message: "term must be 1 or 2",
});

/**
 * The path the browser uploaded to. Constrained rather than trusted: this value
 * arrives from the client and is written into a row that later mints a public
 * URL, so a traversal segment or a path pointing at another bucket's convention
 * must not survive. `{uuid}.{ext}` is the only shape 0065's bucket ever uses.
 */
export const bannerStoragePathSchema = z
  .string()
  .regex(/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i, "unexpected storage path");

export const createBannerSchema = z.object({
  storagePath: bannerStoragePathSchema,
});

export const publishBannerSchema = z.object({
  id: z.uuid(),
  academicYear: academicYearField,
  term: termField,
});

/**
 * The delete target: either one academic year + เทอม, or every draft. `scope`
 * exists because a draft has no year or term to select it by, so "delete the
 * drafts" cannot be expressed as a year/term pair.
 */
export const deleteBannerGroupSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("term"),
    academicYear: academicYearField,
    term: termField,
  }),
  z.object({ scope: z.literal("drafts") }),
]);

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type PublishBannerInput = z.infer<typeof publishBannerSchema>;
export type DeleteBannerGroupInput = z.infer<typeof deleteBannerGroupSchema>;
