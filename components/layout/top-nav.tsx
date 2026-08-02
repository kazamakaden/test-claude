import { Logo } from "@/components/layout/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { UserMenu } from "@/components/layout/user-menu";
import { navFor } from "@/lib/navigation";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

export function TopNav({
  lang,
  role,
  dict,
}: {
  lang: Locale;
  role: Role;
  dict: Dictionary;
}) {
  const items = navFor(role);

  return (
    <header className="sticky top-0 z-40 h-20 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Logo lang={lang} />
          <nav aria-label={dict.common.mainNav} className="hidden md:block">
            <NavLinks items={items} lang={lang} dict={dict} />
          </nav>
        </div>

        <div className="flex items-center gap-1">
          {role !== "guest" ? (
            <NotificationsButton label={dict.nav.notifications} />
          ) : null}
          <div className="hidden md:block">
            <UserMenu lang={lang} role={role} dict={dict} />
          </div>
          <MobileNav items={items} lang={lang} dict={dict} />
        </div>
      </div>
    </header>
  );
}
