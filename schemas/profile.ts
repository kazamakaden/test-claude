import { z } from "zod";

/**
 * Task 3 /profile edit. full_name is the only self-editable field the
 * database actually permits — see types/profiles.ts's OwnProfile header for
 * why the rest render read-only.
 */
export const updateOwnProfileSchema = z.object({
  fullName: z.string().trim().min(1, { message: "fullNameRequired" }).max(120, { message: "fullNameTooLong" }),
});
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
