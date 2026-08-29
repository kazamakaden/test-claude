import { SkipToContent } from "@/components/layout/skip-to-content";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import { DevRoleSwitcher } from "@/components/layout/dev-role-switcher";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { getSessionProfile } from "@/lib/auth/get-role";
import type { Locale } from "@/lib/i18n/config";

/**
 * Every route in this group requires workspace membership (§6): guests get
 * redirected to login. requirePermission's own getRole() call and the
 * getSessionProfile() call below share one Supabase round trip per request
 * (React cache()), so fetching the full profile here for the nav's
 * name/avatar isn't a second query. Session-backed role resolution
 * replaces the dev-cookie stub in §30.5.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const [dict, role, profile] = await Promise.all([
    getDictionary(lang),
    requirePermission("workspace:access", lang),
    getSessionProfile(),
  ]);

  return (
    <>
      <SkipToContent label={dict.common.skipToContent} />
      <TopNav
        lang={lang}
        role={role}
        fullName={profile.fullName}
        avatarUrl={profile.avatarUrl}
        email={profile.email}
        passwordSet={profile.passwordSet}
        dict={dict}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer dict={dict} lang={lang} />
      <DevRoleSwitcher role={role} dict={dict} />
    </>
  );
}
