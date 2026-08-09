"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useSignOut } from "@/hooks/use-sign-out";
import { useSettingsDialog } from "@/components/settings/settings-dialog-provider";
import { getInitials } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

export function UserMenu({
  lang,
  role,
  fullName,
  avatarUrl,
  email,
  dict,
}: {
  lang: Locale;
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  dict: Dictionary;
}) {
  // Hooks must run unconditionally on every render of this component
  // instance — both are cheap no-ops for the guest branch below, which
  // never renders anything that calls handleSignOut/openSettings.
  const { handleSignOut } = useSignOut(lang);
  const { openSettings } = useSettingsDialog();

  if (role === "guest") {
    return (
      <div className="flex items-center gap-1">
        <ThemeToggle label={dict.common.toggleTheme} />
        <LanguageToggle lang={lang} label={dict.common.toggleLanguage} />
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={`/${lang}/login`} />}
        >
          {dict.nav.login}
        </Button>
      </div>
    );
  }

  const initials = getInitials(fullName);
  const displayName = fullName ?? email?.split("@")[0] ?? null;

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              aria-label={dict.nav.profile}
              className="h-auto rounded-full px-2 py-1"
            />
          }
        >
          <Avatar size="sm">
            <AvatarImage src={avatarUrl ?? undefined} referrerPolicy="no-referrer" />
            <AvatarFallback>{initials ?? <User className="size-4" />}</AvatarFallback>
          </Avatar>
          {displayName ? (
            <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {fullName || email ? (
            <>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                {fullName ? <span className="text-sm font-medium text-foreground">{fullName}</span> : null}
                {email ? <span className="text-xs font-normal text-muted-foreground">{email}</span> : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            render={<Link href={`/${lang}/profile`} />}
          >
            <User />
            {dict.nav.profile}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openSettings}>
            <Settings />
            {dict.common.settings}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
            <LogOut />
            {dict.common.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThemeToggle label={dict.common.toggleTheme} />
      <LanguageToggle lang={lang} label={dict.common.toggleLanguage} />
    </div>
  );
}
