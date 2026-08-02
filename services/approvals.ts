import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ApproveAccountInput } from "@/schemas/approvals";
import type { ApprovedAccount } from "@/types/approvals";

// Explicit column list — never select("*"); RLS already admin-only-gates
// this table (0011_account_approvals.sql), but the same discipline as
// profiles/citizen_id applies: never rely on a select("*") being safe just
// because the caller happens to be allowed to run it today.
const APPROVED_ACCOUNT_COLUMNS =
  "id, email, role, department_id, note, created_at, departments(name_th), profiles(full_name)";

export async function getApprovedAccounts(): Promise<ApprovedAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approved_accounts")
    .select(APPROVED_ACCOUNT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    departmentId: row.department_id,
    departmentName: row.departments?.name_th ?? null,
    note: row.note,
    approvedByName: row.profiles?.full_name ?? null,
    createdAt: row.created_at,
  }));
}

export async function addApprovedAccount(
  input: ApproveAccountInput,
  approvedBy: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("approved_accounts").insert({
    email: input.email,
    role: input.role,
    department_id: input.departmentId,
    note: input.note,
    approved_by: approvedBy,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeApprovedAccount(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("approved_accounts").delete().eq("id", id);
  return !error;
}
