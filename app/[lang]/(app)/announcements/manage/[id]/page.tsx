import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/require-role";
import { can } from "@/lib/auth/permissions";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAnnouncementDraft } from "@/services/announcements";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { AnnouncementPublishControls } from "@/components/announcements/announcement-publish-controls";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/config";

/**
 * Staff editor for one announcement.
 *
 * Reads the raw th/en column pair rather than the localized view: an editor
 * that showed the Thai fallback in the English field would silently overwrite
 * "no English yet" with a copy of the Thai text on the next save.
 */
export default async function ManageAnnouncementPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  const role = await requirePermission("content:manage", lang);

  const dict = await getDictionary(lang);
  const draft = await getAnnouncementDraft(id);
  if (!draft) notFound();

  const d = dict.announcements;
  const published = draft.status === "published";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground">{d.manage}</h1>
          <Badge variant="outline">{published ? d.published : d.draft}</Badge>
        </div>
        <Link
          href={`/${lang}/announcements/${id}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {d.backToList}
        </Link>
      </header>

      <AnnouncementForm draft={draft} lang={lang} dict={dict} />

      <div className="border-t border-border pt-4">
        <AnnouncementPublishControls
          id={id}
          published={published}
          canDelete={can(role, "content:delete")}
          lang={lang}
          dict={dict}
        />
      </div>
    </div>
  );
}
