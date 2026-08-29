import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-role";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { listAuditLogs } from "@/services/audit";
import { parseAuditSearchParams, AUDIT_PER_PAGE_SIZE } from "@/schemas/audit";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditTable } from "@/components/audit/audit-table";
import { Pagination } from "@/components/table/pagination";
import type { Locale } from "@/lib/i18n/config";

/**
 * §19 audit trail, admin only.
 *
 * `system:manage` rather than `member:manage`: this is a system-level view that
 * spans members, attendance, projects, documents and books, and RLS
 * (audit_logs_select_admin, 0057) admits only admin regardless — the guard here
 * exists so a non-admin gets a redirect instead of a confusingly empty table.
 */
export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  await requirePermission("system:manage", lang);

  const dict = await getDictionary(lang);
  const rawSearchParams = await searchParams;
  const filters = parseAuditSearchParams(rawSearchParams);
  const { rows, total } = await listAuditLogs(filters);

  // An out-of-range ?page= yields zero rows, and components/table/pagination.tsx
  // renders nothing at total === 0 — stranding the viewer on a blank page with
  // no way back. Same fix 0039 made for /notifications.
  if (rows.length === 0 && filters.page > 1) {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.entityTable) params.set("entity", filters.entityTable);
    const qs = params.toString();
    redirect(`/${lang}/audit${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScrollText className="size-4" aria-hidden="true" />
          {dict.audit.title}
        </span>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{dict.audit.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.audit.description}</p>
      </header>

      <AuditFilters dict={dict} />

      <AuditTable rows={rows} dict={dict} lang={lang} />

      <Pagination
        page={filters.page}
        total={total}
        perPage={AUDIT_PER_PAGE_SIZE}
        pathname={`/${lang}/audit`}
        searchParams={
          new URLSearchParams(
            Object.entries(rawSearchParams).flatMap(([k, v]) =>
              v === undefined ? [] : [[k, Array.isArray(v) ? (v[0] ?? "") : v] as [string, string]]
            )
          )
        }
        dict={dict}
      />
    </div>
  );
}
