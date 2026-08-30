import { notFound } from "next/navigation";
import { QrCode } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-role";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { tryCreateClient } from "@/lib/supabase/server";
import { getActiveQrSession, listActivityAttendance } from "@/services/attendance";
import { QrSessionPanel } from "@/components/attendance/qr-session-panel";
import { AttendanceList } from "@/components/attendance/attendance-list";
import { CreateQrSessionForm } from "@/components/attendance/create-qr-session-form";
import type { Locale } from "@/lib/i18n/config";

/**
 * §13 staff side: create a session, display its rotating QR, watch check-ins
 * arrive. Gated on `activity:manage` — the same boundary create_qr_session()
 * and current_qr_token() each re-check for themselves (0056), since both are
 * SECURITY DEFINER and reachable over REST without going through this page.
 */
export default async function ActivityQrPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id } = await params;
  const lang = rawLang as Locale;
  await requirePermission("activity:manage", lang);
  const dict = await getDictionary(lang);

  const supabase = await tryCreateClient();
  const activity = supabase
    ? (await supabase.from("activities").select("id, title, starts_at").eq("id", id).maybeSingle()).data
    : null;

  if (!activity) notFound();

  const [session, attendees] = await Promise.all([
    getActiveQrSession(id),
    // The scan display is a live feed, not a browsable record: the newest page
    // is the whole point of it, so it takes page 1 and no pager. The full,
    // paginated list is on the activity's own detail page.
    listActivityAttendance(id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <QrCode className="size-4" aria-hidden="true" />
          {dict.attendance.qr.title}
        </span>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{activity.title}</h1>
      </header>

      {session ? (
        <QrSessionPanel session={session} activityId={id} lang={lang} dict={dict} />
      ) : (
        <CreateQrSessionForm activityId={id} lang={lang} dict={dict} />
      )}

      <AttendanceList rows={attendees.rows} dict={dict} lang={lang} />
    </div>
  );
}
