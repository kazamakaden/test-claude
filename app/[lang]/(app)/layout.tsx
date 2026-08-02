import { SkipToContent } from "@/components/layout/skip-to-content";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import { DevRoleSwitcher } from "@/components/layout/dev-role-switcher";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import type { Locale } from "@/lib/i18n/config";

/**
 * Every route in this group requires workspace membership (§6): guests get
 * redirected to login. The guard returns the role, so no separate getRole()
 * call is needed for the nav. Session-backed role resolution replaces the
 * dev-cookie stub in §30.5.
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
  const [dict, role] = await Promise.all([
    getDictionary(lang),
    requirePermission("workspace:access", lang),
  ]);

  return (
    <>
      <SkipToContent label={dict.common.skipToContent} />
      <TopNav lang={lang} role={role} dict={dict} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer dict={dict} lang={lang} />
      <DevRoleSwitcher role={role} dict={dict} />
    </>
  );
}
