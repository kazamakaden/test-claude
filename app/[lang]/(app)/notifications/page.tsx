import { Bell } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  return (
    <PageShell
      title={dict.nav.notifications}
      icon={Bell}
      emptyTitle={dict.common.comingSoon}
      emptyDescription={dict.common.comingSoonDescription}
    />
  );
}
