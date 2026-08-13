import "server-only";
import { createClient, tryCreateClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Club, Department, Member, MemberFilters, MembersResult } from "@/types/members";
import type { Role } from "@/types/auth";
import { PER_PAGE_SIZE, type CreateMemberInput, type CreateDepartmentInput } from "@/schemas/members";

/**
 * §9 → snake_case column mapping. Whitelisted in schemas/members.ts so an
 * un-mapped column can never be interpolated raw into order().
 */
const SORT_COLUMNS = {
  fullName: "full_name",
  studentId: "student_id",
  academicYear: "academic_year",
  className: "class_name",
} as const;

// Explicit column list — never select("*"); citizen_id is column-revoked
// (0005_citizen_id_column_grants.sql) and a "*" would fail outright anyway.
//
// Split in two: `email` is selectable by `authenticated` (0005) but NOT by
// `anon` (0026 grants anon a narrower allow-list that omits it). Selecting
// the base list unconditionally and only adding email for signed-in
// viewers means a guest request can never hit 42501 on this column — a
// guest that DID try to select email would get a Postgres permission error
// that getMembers swallows into a silently empty directory (`{ rows: [],
// total: 0 }` on any error), which would look like "no members exist"
// rather than "you can't see this column". This split is what avoids that.
const MEMBER_COLUMNS_BASE =
  "id, full_name, avatar_url, role, position, student_id, department_id, class_name, club_id, academic_year, departments(name_th), clubs(name_th)";
const MEMBER_COLUMNS_WITH_EMAIL = `${MEMBER_COLUMNS_BASE}, email`;

/**
 * `includeEmail` defaults to false — fail-closed, matching 0005/0026's own
 * allow-list philosophy. The *page* decides via
 * can(role, "workspace:access"); this service stays role-agnostic.
 *
 * The two branches below look like they could share a helper, but a
 * runtime ternary INSIDE `.select()` collapses Supabase's compile-time
 * column parser into a useless `ParserError` type (tried that first) — a
 * generic helper over the builder's own type hits the same wall one level
 * up, since the real PostgrestFilterBuilder's `.eq()`/`.neq()` overloads
 * don't structurally satisfy a simplified shared constraint. Two full
 * branches, each with its own literal `.select()` call, is what keeps
 * Supabase's type inference working end to end.
 */
export async function getMembers(
  filters: MemberFilters,
  options: { includeEmail?: boolean } = {}
): Promise<MembersResult> {
  const supabase = await tryCreateClient();
  if (!supabase) return { rows: [], total: 0 };
  const start = (filters.page - 1) * PER_PAGE_SIZE;

  if (options.includeEmail) {
    let query = supabase
      .from("profiles")
      .select(MEMBER_COLUMNS_WITH_EMAIL, { count: "exact" })
      // "Members" means approved accounts — a still-pending signup isn't
      // one yet, whatever the viewer's own role is. RLS already hides this
      // row from anon (0026); this also excludes it for every signed-in
      // viewer, since profiles_select_directory (0004) grants
      // `using (true)` with no role filter of its own.
      .neq("role", "pending");

    if (filters.search) {
      const q = filters.search.replace(/[%_]/g, "\\$&");
      query = query.or(`full_name.ilike.%${q}%,student_id.ilike.%${q}%`);
    }
    if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
    if (filters.academicYear !== null) query = query.eq("academic_year", filters.academicYear);
    if (filters.className) query = query.eq("class_name", filters.className);
    if (filters.clubId) query = query.eq("club_id", filters.clubId);

    const { data, error, count } = await query
      .order(SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
      .range(start, start + PER_PAGE_SIZE - 1);

    if (error || !data) return { rows: [], total: 0 };

    const rows: Member[] = data.map((m) => ({
      id: m.id,
      fullName: m.full_name ?? "",
      email: m.email,
      avatarUrl: m.avatar_url,
      role: m.role,
      position: m.position,
      studentId: m.student_id,
      departmentId: m.department_id,
      departmentName: m.departments?.name_th ?? null,
      className: m.class_name,
      clubId: m.club_id,
      clubName: m.clubs?.name_th ?? null,
      academicYear: m.academic_year,
    }));

    return { rows, total: count ?? 0 };
  }

  let query = supabase
    .from("profiles")
    .select(MEMBER_COLUMNS_BASE, { count: "exact" })
    .neq("role", "pending");

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.or(`full_name.ilike.%${q}%,student_id.ilike.%${q}%`);
  }
  if (filters.departmentId) query = query.eq("department_id", filters.departmentId);
  if (filters.academicYear !== null) query = query.eq("academic_year", filters.academicYear);
  if (filters.className) query = query.eq("class_name", filters.className);
  if (filters.clubId) query = query.eq("club_id", filters.clubId);

  const { data, error, count } = await query
    .order(SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
    .range(start, start + PER_PAGE_SIZE - 1);

  if (error || !data) return { rows: [], total: 0 };

  const rows: Member[] = data.map((m) => ({
    id: m.id,
    fullName: m.full_name ?? "",
    email: null,
    avatarUrl: m.avatar_url,
    role: m.role,
    position: m.position,
    studentId: m.student_id,
    departmentId: m.department_id,
    departmentName: m.departments?.name_th ?? null,
    className: m.class_name,
    clubId: m.club_id,
    clubName: m.clubs?.name_th ?? null,
    academicYear: m.academic_year,
  }));

  return { rows, total: count ?? 0 };
}

/**
 * §5: admin/aft_teacher own member data. RLS already permits this UPDATE
 * (profiles_update_admin, profiles_update_aft_teacher — 0002, 0024); the
 * two triggers those policies rely on are the actual authority on which
 * changes are legal: prevent_role_self_escalation (0024, role) and
 * prevent_member_identity_change (0025, department/club/class/student_id).
 * A caller here that violates either gets a Postgres exception, mapped
 * below to a message key rather than surfaced raw. student_id is UNIQUE —
 * a duplicate is a realistic data-entry mistake, mapped to its own key
 * rather than the generic "unknown".
 */
export async function updateMember(input: {
  id: string;
  role: Exclude<Role, "guest" | "pending" | "admin">;
  departmentId: string | null;
  clubId: string | null;
  className: string | null;
  studentId: string | null;
  fullName: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      role: input.role,
      department_id: input.departmentId,
      club_id: input.clubId,
      class_name: input.className,
      student_id: input.studentId,
      full_name: input.fullName,
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505" && error.message.includes("profiles_student_id_key")) {
      return { ok: false, error: "studentIdTaken" };
    }
    if (error.message.includes("insufficient privilege")) {
      return { ok: false, error: "forbiddenRole" };
    }
    return { ok: false, error: error.message };
  }
  // PostgREST reports success with no error when an UPDATE with no
  // .select() matches zero rows — chaining .select().maybeSingle() above
  // is what turns a stale/nonexistent id into a real failure instead of a
  // false "member updated" toast, matching the pattern services/books.ts
  // already uses for updateBook/deleteBook/publishBook/unpublishBook.
  if (!data) return { ok: false, error: "not found or not allowed" };
  return { ok: true };
}

/**
 * §1: admin-only "add user" for someone who can't use Google OAuth.
 * Deliberately two clients: the admin (service-role) client ONLY for
 * auth.admin.createUser — RLS has no authority over the auth schema, so
 * there's no way to do this without it — then the CALLER's own cookie-
 * scoped client for the profiles UPDATE, so RLS and the same
 * prevent_role_self_escalation / prevent_member_identity_change triggers
 * that govern updateMember above also govern account creation, rather than
 * bypassing them with the admin client for that part too.
 *
 * handle_new_user() (0023) already inserts a profiles row for any new
 * auth.users row — including one made via the Admin API — with a role/
 * student_id it guesses from the email's local part and password_set
 * defaulting false (0030). This UPDATE overwrites that guess with what the
 * caller actually chose, and sets password_set = true since the account
 * ships with a real, immediately-usable password.
 */
export async function createMember(
  input: CreateMemberInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      return { ok: false, error: "emailExists" };
    }
    return { ok: false, error: createError?.message ?? "unknown" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      role: input.role,
      department_id: input.departmentId,
      club_id: input.clubId,
      class_name: input.className,
      student_id: input.studentId,
      full_name: input.fullName,
      password_set: true,
    })
    .eq("id", created.user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    // A half-made account — auth.users exists but its profile never got
    // the caller's chosen role/identity fields — is worse than no account
    // at all, since it could still sign in with whatever handle_new_user()
    // guessed. Roll it back rather than leave it behind.
    await admin.auth.admin.deleteUser(created.user.id);

    if (error?.code === "23505" && error.message.includes("profiles_student_id_key")) {
      return { ok: false, error: "studentIdTaken" };
    }
    return { ok: false, error: "unknown" };
  }

  return { ok: true };
}

/**
 * §1: admin-only permanent delete. auth.admin.deleteUser removes the
 * auth.users row; profiles.id's `on delete cascade` (0001_auth.sql) takes
 * the profile with it — no separate profiles delete needed. Self-delete and
 * admin-row protection are enforced by the caller (actions/members.ts),
 * re-reading the target's actual role server-side rather than trusting the
 * form — this function does exactly what it's told.
 */
export async function deleteMember(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function getDepartments(): Promise<Department[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("departments")
    .select("id, code, name_th, name_en")
    .order("code");

  if (error || !data) return [];

  return data.map((d) => ({
    id: d.id,
    code: d.code,
    nameTh: d.name_th,
    nameEn: d.name_en,
  }));
}

export async function getClubs(): Promise<Club[]> {
  const supabase = await tryCreateClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name_th, name_en")
    .order("name_th");

  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    nameTh: c.name_th,
    nameEn: c.name_en,
  }));
}

/** Distinct year/class values for the filter dropdowns. */
export async function getFilterOptions(): Promise<{ years: number[]; classNames: string[] }> {
  const supabase = await tryCreateClient();
  if (!supabase) return { years: [], classNames: [] };
  const { data, error } = await supabase
    .from("profiles")
    .select("academic_year, class_name");

  if (error || !data) return { years: [], classNames: [] };

  const years = [...new Set(data.map((r) => r.academic_year).filter((y): y is number => y !== null))].sort();
  const classNames = [...new Set(data.map((r) => r.class_name).filter((c): c is string => c !== null))];

  return { years, classNames };
}

/**
 * Adds a new รหัสวิชา to the shared department list.
 *
 * Uses the CALLER's client, not the admin client: departments_insert_admin
 * (0042) is what actually authorises this, so a non-admin must be refused by
 * the database rather than only by the action's own permission check. Routing
 * it through the service-role client would bypass the very policy this feature
 * added.
 *
 * A zero-row result is treated as failure. RLS denials surface as "no rows"
 * rather than an error, so a bare `if (error)` would report success on a
 * silently-blocked insert — the same trap updateMember and
 * revokeProfileApproval already guard against.
 */
export async function createDepartment(
  input: CreateDepartmentInput
): Promise<{ ok: true; department: Department } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .insert({ code: input.code, name_th: input.nameTh, name_en: input.nameEn })
    .select("id, code, name_th, name_en")
    .maybeSingle();

  if (error) {
    // 23505 = unique_violation: the รหัสวิชา already exists, which is a
    // meaningful answer for the caller (select it) rather than a failure.
    if (error.code === "23505") return { ok: false, error: "departmentCodeTaken" };
    if (error.code === "23514") return { ok: false, error: "invalidDepartmentCode" };
    return { ok: false, error: "unknown" };
  }
  if (!data) return { ok: false, error: "notAllowed" };

  return {
    ok: true,
    department: { id: data.id, code: data.code, nameTh: data.name_th, nameEn: data.name_en },
  };
}
