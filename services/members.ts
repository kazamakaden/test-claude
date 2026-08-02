import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Club, Department, Member, MemberFilters, MembersResult } from "@/types/members";
import { PER_PAGE_SIZE } from "@/schemas/members";

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
const MEMBER_COLUMNS =
  "id, full_name, email, role, student_id, department_id, class_name, club_id, academic_year, departments(name_th), clubs(name_th)";

export async function getMembers(filters: MemberFilters): Promise<MembersResult> {
  const supabase = await createClient();
  const start = (filters.page - 1) * PER_PAGE_SIZE;

  let query = supabase
    .from("profiles")
    .select(MEMBER_COLUMNS, { count: "exact" });

  if (filters.search) {
    const q = filters.search.replace(/[%_]/g, "\\$&");
    query = query.or(`full_name.ilike.%${q}%,student_id.ilike.%${q}%`);
  }
  if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }
  if (filters.academicYear !== null) {
    query = query.eq("academic_year", filters.academicYear);
  }
  if (filters.className) {
    query = query.eq("class_name", filters.className);
  }
  if (filters.clubId) {
    query = query.eq("club_id", filters.clubId);
  }

  query = query
    .order(SORT_COLUMNS[filters.sort], { ascending: filters.direction === "asc" })
    .range(start, start + PER_PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error || !data) return { rows: [], total: 0 };

  const rows: Member[] = data.map((m) => ({
    id: m.id,
    fullName: m.full_name ?? "",
    email: m.email,
    role: m.role,
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

export async function getDepartments(): Promise<Department[]> {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("academic_year, class_name");

  if (error || !data) return { years: [], classNames: [] };

  const years = [...new Set(data.map((r) => r.academic_year).filter((y): y is number => y !== null))].sort();
  const classNames = [...new Set(data.map((r) => r.class_name).filter((c): c is string => c !== null))];

  return { years, classNames };
}
