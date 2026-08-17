import type { Role } from "@/types/auth";

/**
 * Authorization matrix — the single source of truth for §6.
 *
 * Deliberately isomorphic (no `server-only`): the matrix describes public
 * policy, not secrets, so Client Components may read it too. It is *not*
 * security on its own — see the RLS note at the bottom of this file.
 */

export const permissions = [
  /** Guest — §6 "Read official/public content only". */
  "content:read:official",

  /**
   * Membership of the authenticated area (§5 "Authenticated" routes).
   * Guests are public-only, so reaching the workspace is itself a capability.
   */
  "workspace:access",

  /** นักศึกษา อวท./ครู — §6 "submit project drafts". */
  "project:draft:submit",
  /**
   * Authoring an e-book / document draft. Split out from workspace:access,
   * which every signed-in user holds — without it a read-only student could
   * still create a book, contradicting the four-role model. RLS agrees
   * (books_insert_own/update/delete, 0047).
   */
  "document:draft:submit",
  /** Student — §6 "QR attendance". */
  "attendance:submit",
  /** Student — §6 "digital signature". */
  "document:sign",
  /** Student — §6 "notifications". */
  "notification:read",
  /** Student — §6 "profile". */
  "profile:read",
  "profile:update",

  /**
   * §18 org-wide reports. Its own permission rather than reusing
   * workspace:access, which a read-only `student` holds: attendance,
   * membership and workflow aggregates across the whole college are
   * operational data with no §6 basis for a student. They keep their own
   * attendance on the dashboard, which is scoped to them by RLS.
   */
  "report:view",

  /** Teacher — §6 "review drafts". */
  "project:draft:review",
  /** Teacher — §6 "comment". */
  "project:draft:comment",
  /** Teacher — §6 "recommend". */
  "project:recommend",

  /**
   * อาจารย์ อวท. (AFT advisor teacher) — the org-side approver for §11/§12
   * project and document workflows. Above plain teacher, below admin: no
   * user or system management.
   */
  "project:approve",
  "document:approve",
  "activity:manage",
  /**
   * Task 2: staff-editable public page copy (e.g. "11 ดี 11 เก่ง อวท.") —
   * distinct from activity:manage/document:approve, which are each scoped
   * to one content type; this is the general "edit site content" grant.
   */
  "content:manage",

  /**
   * §1: อวท. teacher can approve a pending signup and assign it a role
   * (student/teacher/aft_teacher), and edit an already-approved member's
   * department/class/club/student_id. Distinct from `member:manage`, which
   * stays admin-only for account-level management (e.g. granting `admin`).
   */
  "member:approve",

  /** Administrator — §6 students "Cannot: delete". */
  "content:delete",
  /** Administrator — §6 students "Cannot: manage users". */
  "member:manage",
  /** Administrator — §6 teachers "Cannot manage system". */
  "system:manage",
] as const;

export type Permission = (typeof permissions)[number];

/**
 * Composed cumulatively because §6 defines the roles that way:
 * "Teacher = Student permissions + …", "Administrator = full management".
 * The "Cannot" clauses in §6 are expressed by absence — a role that is not
 * listed here for a permission does not hold it.
 */
const guestPermissions = ["content:read:official"] as const satisfies readonly Permission[];

/**
 * Signed in, but READ-ONLY. A student sees public content, their own profile
 * and notifications, and — via workspace:access — which activities they have
 * missed. They author nothing: no project drafts, no attendance submissions,
 * no signatures, no e-books.
 */
const studentPermissions = [
  ...guestPermissions,
  "workspace:access",
  "notification:read",
  "profile:read",
  "profile:update",
] as const satisfies readonly Permission[];

/**
 * The people who actually run the organisation — shared by BOTH `aft`
 * (นักศึกษา อวท.) and `teacher` (ครู).
 *
 * ONE list, deliberately, referenced twice below. The two roles are identical
 * for authorization; they exist as separate roles so reporting can tell an
 * อวท. student member from actual staff. Keeping a single list means a future
 * edit cannot silently give one of them something the other lacks — if they
 * ever need to diverge, that should be a deliberate split of this constant.
 *
 * Everything a student has, plus authoring (project drafts, e-book drafts,
 * attendance, digital signature), the review stage of §11/§12, and management
 * of activities and public page copy.
 *
 * Deliberately NOT here: project:approve / document:approve. The approver has
 * to sit above whoever submits, and these roles submit — so approval is
 * admin's. That is what keeps "send a project and it stays a draft" true.
 * Also not here: member:approve — admin-only, since a ตำแหน่ง no longer
 * grants member editing (0049).
 */
const organisationPermissions = [
  ...studentPermissions,
  "project:draft:submit",
  "document:draft:submit",
  "attendance:submit",
  "document:sign",
  "report:view",
  "project:draft:review",
  "project:draft:comment",
  "project:recommend",
  "activity:manage",
  "content:manage",
] as const satisfies readonly Permission[];

const adminPermissions = [
  ...organisationPermissions,
  "project:approve",
  "document:approve",
  "member:approve",
  "content:delete",
  "member:manage",
  "system:manage",
] as const satisfies readonly Permission[];

export const permissionsByRole: Record<Role, readonly Permission[]> = {
  guest: guestPermissions,
  student: studentPermissions,
  // Same list on purpose — see organisationPermissions above.
  aft: organisationPermissions,
  teacher: organisationPermissions,
  admin: adminPermissions,
};

/**
 * Does `role` hold `permission`? Linear scan is fine — the matrix is tiny.
 *
 * `role` is erased to a plain string at runtime (it comes straight off the
 * database via getSessionProfile()), so a value this matrix doesn't know
 * about — a schema/code skew, an enum value added by a migration this
 * deployment hasn't caught up with yet — would otherwise throw reading
 * `permissionsByRole[role]` as undefined. Fail closed to "no permissions"
 * rather than crash the caller.
 */
export function can(role: Role, permission: Permission): boolean {
  return (permissionsByRole[role] ?? []).includes(permission);
}



/**
 * NOT SECURITY ON ITS OWN.
 *
 * §6 requires enforcement in Supabase RLS, not only UI/server checks. The
 * policies below are transcribed as real RLS: `activities`, `attendance`,
 * `projects`, `documents`, `document_drafts`, `notifications` are live
 * (`supabase/migrations/0008_dashboard_rls.sql`, extended for `aft_teacher`
 * in `0011_account_approvals.sql`), same for `profiles` (`0002_auth_rls.sql`,
 * extended for `aft_teacher` in `0024_member_approval_authority.sql`).
 * `approved_accounts` (`0011`) — a pre-approval roster — was dropped by
 * `0020_pending_signup_flow.sql`; every signup now lands with a role decided
 * by `handle_new_user()` (numeric local part -> `pending`, needs approval;
 * named local part -> `teacher`, immediate access — `0023`), and an admin or
 * aft_teacher assigns/reassigns a role afterward via `/approvals`, using
 * `profiles_select_directory`/`profiles_update_admin`/
 * `profiles_update_aft_teacher` (`0002`, `0004`, `0024`). The trigger
 * `prevent_role_self_escalation` (`0002`, rewritten in `0024`) is the actual
 * authority on *who may set what role* — no one may change their own role
 * (admin included), only admin may mint/demote an `admin` or grant
 * `aft_teacher`, and admin/aft_teacher may set any other role. A second
 * trigger, `prevent_member_identity_change` (`0025`), separately locks
 * `student_id`/`department_id`/`class_name`/`club_id` to admin/aft_teacher
 * only — `profiles_update_own` would otherwise let any user rewrite their
 * own membership fields (and, via the generated `academic_year`, their
 * year) with no trigger stopping them.
 * `project_drafts`, `qr_sessions`, `audit_logs` are still deferred to their
 * own §30.10 phases — the rows below for those are still just the contract
 * to transcribe when each phase lands.
 *
 *   content:read:official   activities, projects, documents, announcements
 *                           anon SELECT WHERE status = 'official'
 *   workspace:access        every authenticated table — policies require
 *                           auth.uid() IS NOT NULL
 *   project:draft:submit    project_drafts INSERT WHERE author = auth.uid()
 *   attendance:submit       attendance INSERT, one row per student/event,
 *                           server-verified GPS + fingerprint (§13, §15)
 *   document:sign           signature_records INSERT own
 *   notification:read       notifications SELECT WHERE recipient = auth.uid()
 *   profile:read/update     profiles SELECT/UPDATE own row; citizen ID and
 *                           the §15 sensitive columns stay admin-only
 *   project:draft:review    project_drafts SELECT for role teacher, aft_teacher
 *   project:draft:comment   project drafts comment INSERT for role teacher, aft_teacher
 *   project:recommend       project_drafts UPDATE (recommendation only)
 *   project:approve         projects UPDATE status -> 'official', aft_teacher + admin
 *   document:approve        documents UPDATE status -> 'official', aft_teacher + admin
 *   activity:manage         activities INSERT/UPDATE, aft_teacher + admin
 *   content:manage          content_blocks UPDATE, aft_teacher + admin
 *                           (0031/0032 — public page copy, e.g. "11 ดี 11
 *                           เก่ง อวท."; no INSERT/DELETE policy, the row set
 *                           is fixed by migration seed)
 *   member:approve          profiles UPDATE role/department_id/class_name/
 *                           club_id/student_id — aft_teacher + admin, both
 *                           subject to prevent_role_self_escalation and
 *                           prevent_member_identity_change (0024, 0025)
 *   content:delete          DELETE on content tables, admin only
 *   member:manage           admin-only account-level management (granting
 *                           'admin' itself stays out-of-band, not offered
 *                           through any UI — see schemas/approvals.ts)
 *   system:manage           departments, clubs, audit_logs, qr_sessions
 *
 * Role is read server-side via the SECURITY DEFINER helper
 * `public.current_role()` described in §30.4, never from client input.
 * `handle_new_user()` (`0001`, rewritten in `0011`) is the enforcement point
 * for the §14 numeric-student-ID allow-list — never trust an app-layer check
 * alone here, same lesson as the `@udontech.ac.th` domain check.
 */
