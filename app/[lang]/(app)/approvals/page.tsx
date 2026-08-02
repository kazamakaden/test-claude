import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { getApprovedAccounts } from "@/services/approvals";
import { getDepartments } from "@/services/members";
import { ApproveAccountForm } from "@/components/approvals/approve-account-form";
import { RevokeAccountButton } from "@/components/approvals/revoke-account-button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { Locale } from "@/lib/i18n/config";
import { format } from "date-fns";

export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  // §19: the nav item is gated on member:manage, but that alone is UI only —
  // re-check server-side, same as every other protected page in this app.
  await requirePermission("member:manage", lang);

  const [dict, accounts, departments] = await Promise.all([
    getDictionary(lang),
    getApprovedAccounts(),
    getDepartments(),
  ]);
  const d = dict.approvals;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.title}
        </h1>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      <ApproveAccountForm departments={departments} lang={lang} dict={dict} />

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {accounts.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{d.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.columnEmail}</TableHead>
                <TableHead>{d.columnRole}</TableHead>
                <TableHead>{d.columnDepartment}</TableHead>
                <TableHead>{d.columnApprovedBy}</TableHead>
                <TableHead>{d.columnDate}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>{dict.roles[account.role]}</TableCell>
                  <TableCell>{account.departmentName ?? d.noDepartment}</TableCell>
                  <TableCell>{account.approvedByName ?? "—"}</TableCell>
                  <TableCell>{format(new Date(account.createdAt), "d MMM yyyy")}</TableCell>
                  <TableCell>
                    <RevokeAccountButton id={account.id} lang={lang} label={d.revoke} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
