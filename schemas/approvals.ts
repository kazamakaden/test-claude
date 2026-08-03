import { z } from "zod";
import { roles } from "@/types/auth";

/**
 * Shared by the approval form (client) and its Server Action (server) —
 * same pattern as schemas/auth.ts. `role` excludes "guest" (never a real
 * role), "pending" (approving *to* pending is a no-op), and "admin"
 * (granting admin through this form invites privilege escalation via a
 * compromised admin session — promote to admin directly in the database,
 * deliberately out of band from this UI).
 *
 * `aft_teacher` stays in this schema — an admin actor may still grant it —
 * but is narrowed three separate times for a non-admin (aft_teacher) actor:
 * the Select in components/approvals/approve-user-card.tsx never renders it
 * as an option, actions/approvals.ts#approveUser rejects it server-side
 * with a localized message, and prevent_role_self_escalation (0024) is the
 * actual database-level authority that would reject it regardless of what
 * the first two layers let through.
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
