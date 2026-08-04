import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import { signedInLandingTarget } from "@/lib/auth/require-role";
import type { Locale } from "@/lib/i18n/config";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);

  if (role !== "guest") {
    redirect(signedInLandingTarget(role, lang));
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {dict.auth.signUp}
        </h1>
      </div>
      <SignupForm lang={lang} dict={dict} />
    </div>
  );
}
