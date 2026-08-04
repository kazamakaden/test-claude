import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { signedInLandingTarget } from "@/lib/auth/require-role";
import type { Locale } from "@/lib/i18n/config";
import { LoginForm } from "./login-form";

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

  // Set by app/[lang]/auth/callback/route.ts when a redirect back here
  // carries a reason — a non-college Google account, a failed OAuth
  // handshake, or a magic-link exchange failure. Checked against
  // dict.auth.errors' own keys rather than a hardcoded list, so a renamed
  // or removed error key can't silently go undetected here.
  const rawError = (await searchParams).error;
  const errorValue = Array.isArray(rawError) ? rawError[0] : rawError;
  const initialErrorKey =
    errorValue && errorValue in dict.auth.errors
      ? (errorValue as keyof typeof dict.auth.errors)
      : undefined;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {dict.nav.login}
        </h1>
      </div>
      <LoginForm lang={lang} dict={dict} initialErrorKey={initialErrorKey} />
    </div>
  );
}
