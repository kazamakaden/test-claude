import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Locale } from "@/lib/i18n/config";
import type { Role } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";

export function UserMenu({
  lang,
  role,
  dict,
}: {
  lang: Locale;
  role: Role;
  dict: Dictionary;
}) {
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

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={dict.nav.profile}
              className="rounded-full"
            />
          }
        >
          <Avatar size="sm">
            <AvatarFallback>
              <User className="size-4" />
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={<Link href={`/${lang}/profile`} />}
          >
            <User />
            {dict.nav.profile}
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings />
            {dict.common.settings}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
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
