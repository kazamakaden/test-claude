import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Locale } from "@/lib/i18n/config";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Only reachable with the short-lived session app/[lang]/auth/reset/route.ts
 * established from the recovery link — no session means either a stale
 * link, a direct hit on this URL, or Supabase not configured yet, all of
 * which should land back on /login rather than showing a form that would
 * just fail on submit.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/${lang}/login`);
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
