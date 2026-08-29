import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pin } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { getAnnouncement } from "@/services/announcements";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/config";

/**
 * A single announcement. RLS decides visibility: a guest reaching a draft's id
 * gets nothing back and therefore a 404, which is the correct answer — it does
 * not confirm the row exists.
 */
export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);
  const announcement = await getAnnouncement(id, lang);

  if (!announcement) notFound();

  const role = await getRole();
  const canManage = can(role, "content:manage");
  const d = dict.announcements;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Link
        href={`/${lang}/announcements`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {d.backToList}
      </Link>

      <article className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {announcement.pinned ? (
              <Badge variant="outline">
                <Pin className="mr-1 size-3" aria-hidden="true" />
                {d.pinned}
              </Badge>
            ) : null}
            {announcement.status === "draft" ? <Badge variant="outline">{d.draft}</Badge> : null}
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {announcement.title}
          </h1>
          {announcement.publishedAt ? (
            <time
              dateTime={announcement.publishedAt}
              className="text-sm tabular-nums text-muted-foreground"
            >
              {new Date(announcement.publishedAt).toLocaleDateString(
                lang === "th" ? "th-TH" : "en-GB",
                { dateStyle: "long" }
              )}
            </time>
          ) : null}
        </header>

        {/* whitespace-pre-wrap, not dangerouslySetInnerHTML: the body is
            plain text authored by staff, and React escapes it. Rendering it as
            markup would introduce the first stored-XSS surface in this
            codebase for the sake of paragraph breaks. */}
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {announcement.body}
        </div>
      </article>

      {canManage ? (
        <div>
          <Link
            href={`/${lang}/announcements/manage/${announcement.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            {d.editButton}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
