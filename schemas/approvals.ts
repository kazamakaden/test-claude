import { z } from "zod";
import { roles } from "@/types/auth";

/**
 * Shared by the approval form (client) and its Server Action (server) —
 * same pattern as schemas/auth.ts. `role` excludes "guest" (never a real
 * role), "pending" (approving *to* pending is a no-op), and "admin"
 * (granting admin through this form invites privilege escalation via a
 * compromised admin session — promote to admin directly in the database,
 * deliberately out of band from this UI).
 */
const assignableRoles = roles.filter(
  (r): r is Exclude<(typeof roles)[number], "guest" | "pending" | "admin"> =>
    r !== "guest" && r !== "pending" && r !== "admin"
);

export const approveUserSchema = z.object({
  id: z.uuid(),
  role: z.enum(assignableRoles, { message: "invalidRole" }),
  departmentId: z.uuid().nullable().catch(null),
});

export type ApproveUserInput = z.infer<typeof approveUserSchema>;
