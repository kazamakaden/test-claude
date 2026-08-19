"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MenuIcon, type MenuIconHandle } from "@animateicons/react/lucide";
import { LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/layout/nav-links";
import { Logo } from "@/components/layout/logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSignOut } from "@/hooks/use-sign-out";
import { useSettingsDialog } from "@/components/settings/settings-dialog-provider";
import { getInitials } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

/**
 * UserMenu is `hidden lg:block` (top-nav.tsx), so below 1024px this sheet
 * is the ONLY place sign-out, the theme toggle, and the language toggle
 * exist at all — a previously-undetected gap: there used to be no way to
 * do any of those three things on a narrow viewport. Fixed by rendering
 * the same user-menu affordances here, in the footer, rather than only the
 * nav links.
 */
export function MobileNav({
  items,
  lang,
  role,
  fullName,
  avatarUrl,
  email,
  dict,
}: {
  items: NavItem[];
  lang: Locale;
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);
  const menuIconRef = useRef<MenuIconHandle>(null);
  const prefersReducedMotion = useReducedMotion();
  const initials = getInitials(fullName);
  const { handleSignOut } = useSignOut(lang);
  const { openSettings } = useSettingsDialog();

  // Driven from the button rather than the icon's own hover — Button sets
  // [&_svg]:pointer-events-none, so the icon never sees mouse events.
  const startAnimation = () => menuIconRef.current?.startAnimation();
  const stopAnimation = () => menuIconRef.current?.stopAnimation();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        onMouseEnter={startAnimation}
        onMouseLeave={stopAnimation}
        onFocus={startAnimation}
        onBlur={stopAnimation}
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={dict.common.openMenu}
            className="lg:hidden"
          />
        }
      >
        {/* size={16} matches the size-4 the Button applies to plain lucide
            icons; the library drops `className` on the svg, so sizing has
            to come from this prop. */}
        <MenuIcon
          ref={menuIconRef}
          size={16}
          duration={0.3}
          isAnimated={!prefersReducedMotion}
        />
      </SheetTrigger>
      <SheetContent side="left" className="w-3/4 p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle render={<div />}>
            <Logo lang={lang} />
          </SheetTitle>
        </SheetHeader>
        <nav aria-label={dict.common.mainNav} className="flex-1 overflow-y-auto p-4">
          <NavLinks
            items={items}
            lang={lang}
            dict={dict}
            orientation="vertical"
            onNavigate={() => setOpen(false)}
          />
        </nav>
        <SheetFooter className="gap-3 border-t border-border">
          {role !== "guest" ? (
            <>
              {fullName || email ? (
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage src={avatarUrl ?? undefined} referrerPolicy="no-referrer" />
                    <AvatarFallback>{initials ?? <User className="size-4" />}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden">
                    {fullName ? (
                      <span className="truncate text-sm font-medium text-foreground">{fullName}</span>
                    ) : null}
                    {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  className="justify-start"
                  nativeButton={false}
                  render={<Link href={`/${lang}/profile`} onClick={() => setOpen(false)} />}
                >
                  <User className="size-4" aria-hidden />
                  {dict.nav.profile}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    // Close the sheet before opening Settings — both are
                    // Base UI Dialogs, and stacking two open popups means
                    // two focus traps and two scroll locks fighting.
                    setOpen(false);
                    openSettings();
                  }}
                >
                  <Settings className="size-4" aria-hidden />
                  {dict.common.settings}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setOpen(false);
                    handleSignOut();
                  }}
                >
                  <LogOut className="size-4" aria-hidden />
                  {dict.common.signOut}
                </Button>
              </div>
            </>
          ) : (
            <Button
              nativeButton={false}
              render={<Link href={`/${lang}/login`} onClick={() => setOpen(false)} />}
            >
              {dict.nav.login}
            </Button>
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle label={dict.common.toggleTheme} />
            <LanguageToggle lang={lang} label={dict.common.toggleLanguage} />
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
