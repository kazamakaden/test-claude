import { z } from "zod";

/**
 * §5 announcement authoring. Mirrors the database constraints rather than
 * inventing looser ones — the CHECKs in 0060 are the real authority, and a
 * schema that allowed more would just turn a clear message into a 23514.
 */
export const announcementInputSchema = z.object({
  titleTh: z
    .string()
    .trim()
    .min(1, { message: "titleRequired" })
    .max(200, { message: "titleTooLong" }),
  // Nullable rather than defaulting to the Thai text: storing a copy would
  // make "no English yet" indistinguishable from "deliberately the same", and
  // the fallback belongs at render time.
  titleEn: z.string().trim().max(200, { message: "titleTooLong" }).nullable().catch(null),
  bodyTh: z.string().trim().max(20000, { message: "bodyTooLong" }),
  bodyEn: z.string().trim().max(20000, { message: "bodyTooLong" }).nullable().catch(null),
  pinned: z.boolean().catch(false),
});

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

/**
 * Publishing has one extra rule the draft form does not: there must be
 * something to read. announcements_published_needs_body (0060) is the
 * backstop; this exists so the caller gets "add a body first" rather than a
 * raw constraint violation — the same fragility CLAUDE.md records for
 * publishBookAction, which identifies its constraint by name.
 */
export const publishAnnouncementSchema = z.object({
  id: z.uuid(),
  bodyTh: z.string().trim().min(1, { message: "bodyRequiredToPublish" }),
});
