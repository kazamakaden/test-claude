/**
 * `pending` = signed in, but not yet approved by an admin. Distinct from
 * `guest` (not signed in at all) so the app can tell the two apart and show
 * a "waiting for approval" page instead of bouncing back to login.
 */
export type Role = "guest" | "pending" | "student" | "teacher" | "aft_teacher" | "admin";

export const roles: readonly Role[] = [
  "guest",
  "pending",
  "student",
  "teacher",
  "aft_teacher",
  "admin",
];
