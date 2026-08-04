import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Locale } from "@/lib/i18n/config";
import { SetPasswordForm } from "./set-password-form";

/**
 * Reached right after a first-time Google sign-in
 * (app/[lang]/auth/callback/route.ts redirects here when profiles.password_set
 * is false). Supabase never emails a Google user on its own — the identity
 * is already verified, so there's nothing to confirm — so this page's one
 * job is to trigger that email itself via the existing requestPasswordReset
 * action, whose link already lands on /reset-password (the actual
 * password + confirm screen). No session, no reason to be here.
 */
export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const dict = await getDictionary(lang);

  if (!isSupabaseConfigured) {
    redirect(`/${lang}/login`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/${lang}/login`);
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {dict.auth.setPasswordTitle}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.auth.setPasswordDescription} <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </div>
      <SetPasswordForm lang={lang} email={user.email} dict={dict} />
    </div>
  );
}
