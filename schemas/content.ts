import { z } from "zod";

/**
 * Task 2 content-block edit (content:manage — aft_teacher/admin,
 * lib/auth/permissions.ts). `bodyEn`/`titleEn` are optional: an empty
 * string coming out of a <Textarea> is normalized to null so the reader
 * falls back to the Thai text, per the confirmed decision (separate th/en
 * fields, en falls back to th when empty).
 */
export const updateContentBlockSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/, { message: "unknown" }),
  titleTh: z.string().trim().min(1, { message: "titleRequired" }).max(200, { message: "titleTooLong" }),
  titleEn: z
    .string()
    .trim()
    .max(200, { message: "titleTooLong" })
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  bodyTh: z.string().trim().max(20000, { message: "bodyTooLong" }),
  bodyEn: z
    .string()
    .trim()
    .max(20000, { message: "bodyTooLong" })
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});
export type UpdateContentBlockInput = z.infer<typeof updateContentBlockSchema>;
