import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardEmpty } from "@/components/dashboard/card-states";
import { getDraftDocuments } from "@/services/dashboard";
import { can } from "@/lib/auth/permissions";
import type { Role } from "@/types/auth";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export async function DraftDocumentsCard({
  role,
  lang,
  dict,
}: {
  role: Role;
  lang: Locale;
  dict: Dictionary;
}) {
  const documents = await getDraftDocuments(role);
  const d = dict.dashboard.draftDocuments;
  // document:approve, not project:draft:review — that permission gates
  // *project* drafts, an unrelated table; this card is about documents.
  const isReviewer = can(role, "document:approve");
  const targetHref = isReviewer ? "/documents/review" : "/documents/manage";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isReviewer ? d.titleTeacher : d.titleStudent}</CardTitle>
        <CardDescription>{d.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <CardEmpty
            icon={FileText}
            message={d.empty}
            ctaLabel={d.emptyCta}
            ctaHref={targetHref}
            lang={lang}
          />
        ) : (
          // The link has to live here too, not only in the empty state: a
          // reviewer with documents actually waiting on them is exactly who
          // needs to reach /documents/review, and the empty-state CTA is by
          // definition not rendered then.
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-foreground">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">{doc.ownerName}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {d.status[doc.status]}
                  </Badge>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              nativeButton={false}
              render={<Link href={`/${lang}${targetHref}`} />}
            >
              {isReviewer ? d.viewAllReview : d.viewAllManage}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
