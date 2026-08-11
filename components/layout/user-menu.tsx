"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
  // Must run unconditionally — the guest branch below returns early, and a
  // hook called only after that would break rules-of-hooks if role changes
  // without a remount.
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
      {/* The avatar opens Settings directly rather than a dropdown. Profile
          and Sign out moved into that dialog so nothing became unreachable.
          The accessible name starts with the visible name (WCAG 2.5.3 "Label
          in Name") — an aria-label of just "settings" would not contain the
          visible text. */}
      <Button
        variant="ghost"
        onClick={openSettings}
        aria-label={displayName ? `${displayName} — ${dict.common.settings}` : dict.common.settings}
        className="h-auto rounded-full px-2 py-1"
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
      </Button>
      <ThemeToggle label={dict.common.toggleTheme} />
      <LanguageToggle lang={lang} label={dict.common.toggleLanguage} />
    </div>
  );
}
