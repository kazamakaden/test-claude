import { SkipToContent } from "@/components/layout/skip-to-content";
import { TopNav } from "@/components/layout/top-nav";
import { Footer } from "@/components/layout/footer";
import { DevRoleSwitcher } from "@/components/layout/dev-role-switcher";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import type { Locale } from "@/lib/i18n/config";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;
  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);

  return (
    <>
      <SkipToContent label={dict.common.skipToContent} />
      <TopNav lang={lang} role={role} dict={dict} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer dict={dict} />
      <DevRoleSwitcher role={role} dict={dict} />
    </>
  );
}
