import { z } from "zod";
import { isValidCitizenId, normalizeCitizenId } from "@/lib/citizen-id";

/**
 * Task 3 /profile edit. full_name is the only self-editable field the
 * database actually permits — see types/profiles.ts's OwnProfile header for
 * why the rest render read-only.
 */
export const updateOwnProfileSchema = z.object({
  fullName: z.string().trim().min(1, { message: "fullNameRequired" }).max(120, { message: "fullNameTooLong" }),
});
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;

/**
 * §14 เลขบัตรประชาชน. Stored digits-only; the form may be typed with the dashes
 * printed on the card, so normalize before validating.
 *
 * No `.catch()` — a bad number must surface as `citizenIdInvalid`, never be
 * silently dropped. That matters more here than elsewhere: the owner may set
 * this exactly ONCE (prevent_citizen_id_change, 0003), so a value that
 * disappears quietly would be indistinguishable from one that saved.
 *
 * `refine` rather than a regex: the shape is the DATABASE's job
 * (profiles_citizen_id_format, 0075) and the mod-11 check digit is this
 * layer's — see lib/citizen-id.ts for why the two are split.
 */
export const setOwnCitizenIdSchema = z.object({
  citizenId: z
    .string()
    .transform(normalizeCitizenId)
    .refine(isValidCitizenId, { message: "citizenIdInvalid" }),
});
export type SetOwnCitizenIdInput = z.infer<typeof setOwnCitizenIdSchema>;
