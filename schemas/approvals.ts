import { z } from "zod";
import { roles } from "@/types/auth";

/**
 * Shared by the approvals form (client) and its Server Action (server) —
 * same pattern as schemas/auth.ts. `role` excludes "guest" (never a signup
 * target) and "admin" (granting admin through a form invites privilege
 * escalation via a compromised admin session — promote to admin directly
 * in the database, deliberately out of band from this UI).
 */
const approvableRoles = roles.filter(
  (r): r is Exclude<(typeof roles)[number], "guest" | "admin"> => r !== "guest" && r !== "admin"
);

export const approveAccountSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "invalidEmail" }))
    .refine((email) => email.endsWith("@udontech.ac.th"), { message: "wrongDomain" }),
  role: z.enum(approvableRoles, { message: "invalidRole" }),
  departmentId: z.uuid().nullable().catch(null),
  note: z.string().trim().max(200).nullable().catch(null),
});

export type ApproveAccountInput = z.infer<typeof approveAccountSchema>;
