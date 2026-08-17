import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel } from "@/components/ui/form";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { Department } from "@/types/members";
import type { ReportFilters } from "@/schemas/reports";
import { departmentOptionLabel } from "@/lib/student-id";

/**
 * A plain GET <form>, not a client component: the filters are URL state, so
 * submitting navigates and the report is shareable and bookmarkable. It also
 * means the whole page keeps working with JavaScript disabled (§30.9 item 3),
 * which a Select-driven client filter would not — the same reason
 * /activities' status tiles are <Link>s rather than a fourth dropdown.
 *
 * A native <select> rather than the Base UI Select used elsewhere, for that
 * same reason: Base UI's needs JS to open.
 */
export function ReportFiltersForm({
  filters,
  departments,
  lang,
  dict,
}: {
  filters: ReportFilters;
  departments: Department[];
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.reports;

  return (
    <form
      method="GET"
      action={`/${lang}/reports`}
      className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <FormField name="from" className="min-w-40 flex-1">
        <FormLabel>{d.filterFrom}</FormLabel>
        <Input type="date" name="from" defaultValue={filters.from ?? ""} />
      </FormField>

      <FormField name="to" className="min-w-40 flex-1">
        <FormLabel>{d.filterTo}</FormLabel>
        <Input type="date" name="to" defaultValue={filters.to ?? ""} />
      </FormField>

      <FormField name="dept" className="min-w-52 flex-1">
        <FormLabel>{d.filterDepartment}</FormLabel>
        <select
          name="dept"
          defaultValue={filters.departmentId ?? ""}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">{d.allDepartments}</option>
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {/* Includes the code: 30901 and 31901 are BOTH ปวส. and both
                  named เทคโนโลยีสารสนเทศ, so a level-and-name label renders
                  two identical options (CLAUDE.md §14). */}
              {departmentOptionLabel(dep.code, lang === "th" ? dep.nameTh : dep.nameEn, dict.common.levels)}
            </option>
          ))}
        </select>
      </FormField>

      <div className="flex items-center gap-2">
        <Button type="submit">{d.apply}</Button>
        <Link href={`/${lang}/reports`} className={buttonVariants({ variant: "outline" })}>
          {d.clearFilters}
        </Link>
      </div>
    </form>
  );
}
