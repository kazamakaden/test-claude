import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { CalendarDays, MapPin } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getRole } from "@/lib/auth/get-role";
import { getActivityDetail, getActivityEditors } from "@/services/activities";
import { getActivityAttendanceStats, listActivityAttendance, getActiveQrSession } from "@/services/attendance";
import { CardBoundary } from "@/components/dashboard/card-boundary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BannerCarousel } from "@/components/activities/banner-carousel";
import { BannerManager } from "@/components/activities/banner-manager";
import { AttendanceSummary } from "@/components/activities/attendance-summary";
import { AttendeeTable } from "@/components/activities/attendee-table";
import { AttendeeAddForm } from "@/components/activities/attendee-add-form";
import { InlineQrPanel } from "@/components/activities/inline-qr-panel";
import { EditorsPanel } from "@/components/activities/editors-panel";
import { QrSessionPanel } from "@/components/attendance/qr-session-panel";
import { CreateQrSessionForm } from "@/components/attendance/create-qr-session-form";

/**
 * Activity detail.
 *
 * PUBLIC on purpose, so a guest gets a real event page — banners, time, place.
 * What they see beyond that is decided by RLS, not by branching here: `anon`
 * holds no SELECT grant on `attendance` at all, a student sees only their own
 * row (attendance_select_own), and staff see every row
 * (attendance_select_reviewer). Re-deriving that in TypeScript would be a
 * second copy of the rules that could drift from the first.
 *
 * Each section sits behind its own Suspense + CardBoundary, the §30.7 pattern,
 * so one failing query cannot take the page down.
 */
export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang, id } = await params;
  if (!isLocale(rawLang)) notFound();
  const lang: Locale = rawLang;

  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";

  const [dict, activity, role] = await Promise.all([
    getDictionary(lang),
    getActivityDetail(id),
    getRole(),
  ]);

  if (!activity) notFound();

  const d = dict.activities;
  const locale = lang === "th" ? th : enUS;
  const canEdit = activity.canEdit;
  const isGuest = role === "guest";

  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <Link
          href={`/${lang}/activities`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← {d.backToList}
        </Link>
      </div>

      <BannerCarousel banners={activity.banners} title={activity.title} dict={dict} />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            {activity.title}
          </h1>
          <Badge variant="outline">{d.status[activity.status]}</Badge>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CalendarDays aria-hidden className="size-4" />
            <dt className="sr-only">{d.columnDate}</dt>
            <dd>{format(new Date(activity.startsAt), "d MMMM yyyy HH:mm", { locale })}</dd>
          </div>
          {activity.location && (
            <div className="flex items-center gap-1.5">
              <MapPin aria-hidden className="size-4" />
              <dt className="sr-only">{d.columnLocation}</dt>
              <dd>{activity.location}</dd>
            </div>
          )}
        </dl>
        {activity.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {activity.description}
          </p>
        )}
      </header>

      {canEdit && (
        <BannerManager
          activityId={activity.id}
          banners={activity.banners}
          lang={lang}
          dict={dict}
        />
      )}

      {canEdit && (
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
            <QrSection activityId={activity.id} lang={lang} dict={dict} />
          </CardBoundary>
        </Suspense>
      )}

      <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
        <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
          <SummarySection
            activityId={activity.id}
            expected={activity.expectedAttendees}
            dict={dict}
          />
        </CardBoundary>
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
          <AttendeesSection
            activityId={activity.id}
            search={search}
            canEdit={canEdit}
            isGuest={isGuest}
            lang={lang}
            dict={dict}
          />
        </CardBoundary>
      </Suspense>

      {canEdit && (
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <CardBoundary errorTitle={dict.common.errorTitle} retryLabel={dict.common.errorRetry}>
            <EditorsSection activityId={activity.id} lang={lang} dict={dict} />
          </CardBoundary>
        </Suspense>
      )}
    </main>
  );
}

async function QrSection({
  activityId,
  lang,
  dict,
}: {
  activityId: string;
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const session = await getActiveQrSession(activityId);

  // The panel is built on the SERVER and handed to the client toggle as
  // children: minting the first token needs the session secret, which no
  // browser may ever hold.
  return (
    <InlineQrPanel activityId={activityId} lang={lang} dict={dict}>
      {session ? (
        <QrSessionPanel session={session} activityId={activityId} lang={lang} dict={dict} />
      ) : (
        <CreateQrSessionForm activityId={activityId} lang={lang} dict={dict} />
      )}
    </InlineQrPanel>
  );
}

async function SummarySection({
  activityId,
  expected,
  dict,
}: {
  activityId: string;
  expected: number | null;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const stats = await getActivityAttendanceStats(activityId, expected);
  return <AttendanceSummary stats={stats} dict={dict} />;
}

async function AttendeesSection({
  activityId,
  search,
  canEdit,
  isGuest,
  lang,
  dict,
}: {
  activityId: string;
  search: string;
  canEdit: boolean;
  isGuest: boolean;
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const rows = await listActivityAttendance(activityId, search);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dict.activities.attendees.heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit && <AttendeeAddForm activityId={activityId} lang={lang} dict={dict} />}
        <AttendeeTable
          rows={rows}
          activityId={activityId}
          search={search}
          canManage={canEdit}
          isGuest={isGuest}
          lang={lang}
          dict={dict}
        />
      </CardContent>
    </Card>
  );
}

async function EditorsSection({
  activityId,
  lang,
  dict,
}: {
  activityId: string;
  lang: Locale;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const editors = await getActivityEditors(activityId);
  return <EditorsPanel activityId={activityId} editors={editors} lang={lang} dict={dict} />;
}
