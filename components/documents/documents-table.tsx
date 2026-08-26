import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, FileText } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CardEmpty } from "@/components/dashboard/card-states";
import type {
  DocumentSortColumn,
  DocumentStatus,
  DocumentWorkflowFilters,
  DocumentWorkflowSummary,
} from "@/types/documents";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

const SORTABLE_COLUMNS: { key: DocumentSortColumn; labelKey: "columnTitle" | "columnStatus" | "columnUpdated" }[] = [
  { key: "title", labelKey: "columnTitle" },
  { key: "status", labelKey: "columnStatus" },
  { key: "updatedAt", labelKey: "columnUpdated" },
];

const STATUS_VARIANT: Record<DocumentStatus, "default" | "secondary" | "outline"> = {
  draft: "outline",
  signed: "secondary",
  pending_approval: "secondary",
  official: "default",
};

function sortHref(
  pathname: string,
  searchParams: URLSearchParams,
  column: DocumentSortColumn,
  filters: DocumentWorkflowFilters
) {
  const params = new URLSearchParams(searchParams.toString());
  const nextDirection = filters.sort === column && filters.direction === "asc" ? "desc" : "asc";
  params.set("sort", column);
  params.set("dir", nextDirection);
  return `${pathname}?${params.toString()}`;
}

export function DocumentsTable({
  documents,
  filters,
  pathname,
  searchParams,
  lang,
  dict,
}: {
  documents: DocumentWorkflowSummary[];
  filters: DocumentWorkflowFilters;
  pathname: string;
  searchParams: URLSearchParams;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents.manage;
  const locale = lang === "th" ? th : enUS;

  if (documents.length === 0) {
    return (
      <CardEmpty
        icon={FileText}
        message={d.empty}
        ctaLabel={d.newDocumentCta}
        ctaHref="/documents/manage/new"
        lang={lang}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map(({ key, labelKey }) => {
            const active = filters.sort === key;
            const Icon = active ? (filters.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
            return (
              <TableHead key={key}>
                <Link
                  href={sortHref(pathname, searchParams, key, filters)}
                  className="flex items-center gap-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-sort={active ? (filters.direction === "asc" ? "ascending" : "descending") : "none"}
                >
                  {d[labelKey]}
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                </Link>
              </TableHead>
            );
          })}
          <TableHead>{d.columnOwner}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => (
          <TableRow key={doc.id}>
            <TableCell className="font-medium text-foreground">
              <Link
                href={`/${lang}/documents/manage/${doc.id}`}
                className="outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {doc.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[doc.status]}>{d.status[doc.status]}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {format(bangkokDate(doc.updatedAt), "d MMM yyyy", { locale })}
            </TableCell>
            <TableCell className="text-muted-foreground">{doc.ownerName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
