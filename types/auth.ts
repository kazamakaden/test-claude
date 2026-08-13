/**
 * Four roles.
 *
 *   guest    not signed in — public/official content only
 *   student  signed in, READ-ONLY: own profile, notifications, and which
 *            activities they have missed. Cannot author content.
 *   teacher  นักศึกษา อวท. / ครู — submits project drafts, takes attendance,
 *            signs documents, reviews/comments/recommends, and manages
 *            activities and site content
 *   admin    everything, including approving projects and documents
 *
 * `pending` and `aft_teacher` were removed (0046/0047): signing up no longer
 * needs approval, and nothing sits between teacher and admin. Both survive as
 * `user_role` enum LABELS only because PostgreSQL cannot drop an enum value in
 * place — the `profiles_role_allowed` CHECK is what actually prevents either
 * from being stored, so this union is not merely a convention.
 */
export type Role = "guest" | "student" | "teacher" | "admin";

export const roles: readonly Role[] = ["guest", "student", "teacher", "admin"];

/**
 * Narrow a role read from the database to the four the app knows.
 *
 * `user_role` still carries `pending` and `aft_teacher` as enum labels
 * (PostgreSQL cannot drop them), so the generated `Database` type is wider
 * than `Role`. The `profiles_role_allowed` CHECK means no row can actually
 * hold one — but a value arriving here that this app does not recognise is
 * precisely the schema/code skew this project has hit before, so it fails
 * CLOSED to guest rather than being cast through.
 */
export function toRole(value: string | null | undefined): Role {
  return (roles as readonly string[]).includes(value ?? "") ? (value as Role) : "guest";
}

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
