import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { signedInLandingTarget } from "@/lib/auth/require-role";
import type { Locale } from "@/lib/i18n/config";
import { LoginForm } from "./login-form";
import { attendanceTokenSchema } from "@/schemas/attendance";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);

  if (role !== "guest") {
    redirect(signedInLandingTarget(role, lang));
  }

  // Set by app/[lang]/auth/google/callback/route.ts when a redirect back here
  // carries a reason — a non-college Google account or a failed OAuth
  // handshake. Checked against dict.auth.errors' own keys rather than a
  // hardcoded list, so a renamed or removed error key can't silently go
  // undetected here.
  const sp = await searchParams;
  const rawError = sp.error;
  const errorValue = Array.isArray(rawError) ? rawError[0] : rawError;
  const initialErrorKey =
    errorValue && errorValue in dict.auth.errors
      ? (errorValue as keyof typeof dict.auth.errors)
      : undefined;

  // Set by actions/auth.ts's updatePassword() after the set-password flow
  // completes — same defensive check-against-dictionary-keys pattern as
  // initialErrorKey above.
  // A QR token the viewer scanned while signed out (attend/[token]/page.tsx
  // sends them here rather than dropping it). Validated against the same schema
  // the scan itself uses, so only a well-formed token is ever echoed back into
  // the page — and it is a token, never a URL.
  const rawAttend = sp.attend;
  const attendValue = Array.isArray(rawAttend) ? rawAttend[0] : rawAttend;
  const attendParsed = attendanceTokenSchema.safeParse(attendValue ?? "");
  const attendToken = attendParsed.success ? attendParsed.data : undefined;

  const rawNotice = sp.notice;
  const noticeValue = Array.isArray(rawNotice) ? rawNotice[0] : rawNotice;
  const initialNoticeKey =
    noticeValue && noticeValue in dict.auth.notices
      ? (noticeValue as keyof typeof dict.auth.notices)
      : undefined;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {dict.nav.login}
        </h1>
      </div>
      {/* Server-rendered, not a toast. An expired or already-used
          password link is a routine outcome of the 0064 email flow, and
          this message is the ONLY thing that explains it — so it has to
          survive JavaScript being off (§30.9 item 3), which a sonner toast
          in a useEffect does not. Checked directly in the raw HTML rather
          than assumed: before this, ?error=sessionExpired rendered nothing
          visible at all, the message appearing only inside the serialized
          dictionary payload. */}
      {initialErrorKey ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {dict.auth.errors[initialErrorKey]}
        </p>
      ) : null}
      {initialNoticeKey ? (
        <p
          role="status"
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
        >
          {dict.auth.notices[initialNoticeKey]}
        </p>
      ) : null}

      <LoginForm lang={lang} dict={dict} attendToken={attendToken} />
    </div>
  );
}
