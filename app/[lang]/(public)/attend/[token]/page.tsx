import { QrCode } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-role";
import { getSessionProfile } from "@/lib/auth/get-role";
import { redirect } from "next/navigation";
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
 * Lives under (public) — moved out of (app), and NOT a weakening. `attendance:
 * submit` is still enforced below, server-side, before anything renders; what
 * changed is the ORDER. The (app) layout's own requirePermission runs before
 * any page in that group, so a signed-out scan was redirected by the LAYOUT and
 * the token-preserving branch below never executed. Verified, not assumed: a
 * guest hitting /th/attend/<token> under (app) landed on a bare /th/login.
 *
 * A SIGNED-OUT scan used to land on /login with the token thrown away, so the
 * student had to walk back and scan again -- at a real event, in a queue. It
 * now carries the token to /login and back through sign-in.
 *
 * What is carried is the TOKEN, never a return-URL, and that is the whole
 * reason this is safe: attendanceTokenSchema admits `^[a-z0-9]{10}\.[0-9a-f]{8}$`
 * -- no slash, colon or second dot -- and the callback BUILDS
 * `/{lang}/attend/{token}` from it. So the auth route keeps the
 * "redirect target is never caller-supplied" property it hard-codes for.
 *
 * Only a guest is diverted. A signed-in viewer falls through to
 * requirePermission, which still owns the set-password gate and the
 * permission refusal -- an account mid-onboarding must not be routed past it.
 */
export default async function AttendPage({
  params,
}: {
  params: Promise<{ lang: string; token: string }>;
}) {
  const { lang: rawLang, token: rawToken } = await params;
  const lang = rawLang as Locale;

  // Validated here only to render the "bad code" state without a round trip.
  // record_attendance() re-checks the token by HMAC regardless — this is a
  // convenience, not the gate.
  const parsed = attendanceTokenSchema.safeParse(decodeURIComponent(rawToken));

  const profile = await getSessionProfile();
  if (profile.userId === null && parsed.success) {
    redirect(`/${lang}/login?attend=${encodeURIComponent(parsed.data)}`);
  }

  await requirePermission("attendance:submit", lang);
  const dict = await getDictionary(lang);

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
