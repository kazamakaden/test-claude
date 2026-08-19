import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

/**
 * /{lang}/dashboard is gone as a page. Its ten §8 cards moved to
 * /{lang}/calendar (components/dashboard/dashboard-grid.tsx), and home is now
 * where a signed-in viewer lands.
 *
 * Kept as a redirect rather than deleted: this path is the old sign-in landing
 * target, sits in browser history and bookmarks, and is still written into
 * notification links and revalidatePath() calls. The route stays inside the
 * (app) group deliberately, so its layout's requirePermission("workspace:access")
 * still sends a guest to /login instead of bouncing them around the public site.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  redirect(`/${lang}`);
}
