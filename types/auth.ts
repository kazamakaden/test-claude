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

/**
 * อวท. office (§ member positions). A SECOND, independent authorization axis
 * — not a rank within `Role`.
 *
 *   Role     = what tier of SYSTEM access you have (student … admin)
 *   Position = what OFFICE you hold in the organisation (ประธาน, กรรมการ …)
 *
 * A student can be ประธาน; a teacher can hold no office at all. `null` means
 * "general member", which is the default for every row and is what makes
 * read-only the safe default (see 0044).
 *
 * `advisor` deliberately does NOT reuse the name `teacher`: the ครู POSITION
 * and the `teacher` ROLE are different things, and naming them alike is how
 * the two axes would get conflated in code.
 */
export type MemberPosition =
  | "president"
  | "vice_president"
  | "receptionist"
  | "registrar"
  | "public_relations"
  | "secretary"
  | "advisor"
  | "committee";

/** Display order — matches the order the organisation lists its committee. */
export const memberPositions: readonly MemberPosition[] = [
  "president",
  "vice_president",
  "receptionist",
  "registrar",
  "public_relations",
  "secretary",
  "advisor",
  "committee",
];

export function isMemberPosition(value: unknown): value is MemberPosition {
  return typeof value === "string" && (memberPositions as readonly string[]).includes(value);
}
