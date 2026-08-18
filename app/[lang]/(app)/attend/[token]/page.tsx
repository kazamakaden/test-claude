import { QrCode } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-role";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AttendanceConfirmForm } from "@/components/attendance/attendance-confirm-form";
import { attendanceTokenSchema } from "@/schemas/attendance";
import type { Locale } from "@/lib/i18n/config";

/**
 * §13: "Scan QR -> Open Website -> Confirm Attendance -> Type ยืนยัน -> Submit".
 *
 * The student's own camera app opens this URL — there is no in-app scanner, by
 * design: it keeps the client out of the trust path entirely and works on every
 * phone without a camera permission prompt or a new dependency.
 *
 * Lives under (app), not (public), so `attendance:submit` is enforced before the
 * form is ever rendered. Known rough edge, stated rather than hidden: a
 * signed-out scan lands on /login and the token is lost, so the student has to
 * scan again after signing in. Carrying a return-URL through the auth callback
 * would mean touching the redirect target that route deliberately hard-codes
 * (it is what keeps it free of an open-redirect), so it is left alone here.
 */
export default async function AttendPage({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { lang: rawLang, token: rawToken } = await params;
  const lang = rawLang as Locale;
  await requirePermission("attendance:submit", lang);
  const dict = await getDictionary(lang);

  // Validated here only to render the "bad code" state without a round trip.
  // record_attendance() re-checks the token by HMAC regardless — this is a
  // convenience, not the gate.
  const parsed = attendanceTokenSchema.safeParse(decodeURIComponent(rawToken));

  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <QrCode className="size-6" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {dict.attendance.title}
        </h1>
      </header>

      {parsed.success ? (
        <AttendanceConfirmForm token={parsed.data} lang={lang} dict={dict} />
      ) : (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          {dict.attendance.errors.invalidToken}
        </p>
      )}
    </main>
  );
}
