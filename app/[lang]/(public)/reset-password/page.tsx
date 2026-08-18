import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { HANDOFF_COOKIE_NAME, isWellFormedToken } from "@/lib/password-tokens";
import { peekToken } from "@/services/password-setup";
import type { Locale } from "@/lib/i18n/config";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * The password + confirm screen, reached only through the handoff cookie
 * app/[lang]/auth/set-password/route.ts sets after validating an emailed
 * link (0064).
 *
 * Gated on the COOKIE, not on a Supabase session — this flow establishes no
 * session, because the person using it is by definition someone who cannot
 * sign in. A stale cookie, a direct hit on this URL, or a link that expired
 * between the click and the page load all land back on /login with the
 * message that says to request a new one, rather than showing a form whose
 * submit could only fail.
 *
 * peekToken() here is a re-check, not the check: the token was already
 * validated by the route that set the cookie. It costs one indexed lookup
 * and closes the window where a link expires (or is spent in another tab)
 * while this page sits open.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  const token = (await cookies()).get(HANDOFF_COOKIE_NAME)?.value;
  if (!isWellFormedToken(token) || !(await peekToken(token))) {
    redirect(`/${lang}/login?error=sessionExpired`);
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {dict.auth.resetTitle}
        </h1>
      </div>
      <ResetPasswordForm lang={lang} dict={dict} />
    </div>
  );
}
