import { Logo } from "@/components/layout/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Suspense } from "react";
import { GlobalSearch } from "@/components/search/global-search";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { UserMenu } from "@/components/layout/user-menu";
import { SettingsDialogProvider } from "@/components/settings/settings-dialog-provider";
import { navFor } from "@/lib/navigation";
import { can } from "@/lib/auth/permissions";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

export function TopNav({
  lang,
  role,
  fullName,
  avatarUrl,
  email,
  passwordSet,
  dict,
}: {
  lang: Locale;
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  passwordSet: boolean;
  dict: Dictionary;
}) {
  const items = navFor(role);

  return (
    <header className="sticky top-0 z-40 h-20 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Logo lang={lang} role={role} />
          <nav aria-label={dict.common.mainNav} className="hidden min-w-0 flex-1 lg:flex">
            <NavLinks items={items} lang={lang} dict={dict} />
          </nav>
        </div>

        <div className="flex items-center gap-1">
          {/* §18. Rendered for every role including guest: search_all (0059)
              is SECURITY INVOKER, so a guest sees only the public content the
              public pages already show. */}
          <GlobalSearch lang={lang} dict={dict} />
          {/* notification:read, not `role !== "guest"`: `pending` sits at
              guest-level permissions, so the old check showed a bell that
              could only bounce them back to /pending. */}
          {can(role, "notification:read") ? (
            <Suspense fallback={<NotificationsButton lang={lang} dict={dict} />}>
              <NotificationsBell lang={lang} dict={dict} />
            </Suspense>
          ) : null}
          <SettingsDialogProvider lang={lang} dict={dict} email={email} passwordSet={passwordSet}>
            <div className="hidden lg:block">
              <UserMenu lang={lang} role={role} fullName={fullName} avatarUrl={avatarUrl} email={email} dict={dict} />
            </div>
            <MobileNav
              items={items}
              lang={lang}
              role={role}
              fullName={fullName}
              avatarUrl={avatarUrl}
              email={email}
              dict={dict}
            />
          </SettingsDialogProvider>
        </div>
      </div>
    </header>
  );
}
