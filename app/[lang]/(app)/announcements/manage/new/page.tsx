import { requirePermission } from "@/lib/auth/require-role";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import type { Locale } from "@/lib/i18n/config";

/** Staff: write a new announcement. It starts as a draft — publishing is a
 *  separate, deliberate step, because publishing notifies everyone. */
export default async function NewAnnouncementPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  await requirePermission("content:manage", lang);
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        {dict.announcements.newButton}
      </h1>
      <AnnouncementForm lang={lang} dict={dict} />
    </div>
  );
}
