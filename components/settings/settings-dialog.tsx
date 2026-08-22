"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";
import { Separator } from "@/components/ui/separator";
import { ChangePasswordSection } from "@/components/settings/change-password-section";
import { FontSizeSection } from "@/components/settings/font-size-section";
import { PushSection } from "@/components/settings/push-section";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Task 4/5: Settings as a blurred overlay, not a route — see
 * components/ui/dialog.tsx for the stronger backdrop-blur treatment this
 * needs versus the sheet's lighter one. Stacked sections in one scrollable
 * column rather than Tabs: three Thai tab labels in a
 * w-[min(calc(100vw-2rem),32rem)] dialog is a real overflow risk at 375px,
 * and stacked sections are trivially keyboard/screen-reader operable
 * without any extra ARIA wiring.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  lang,
  dict,
  email,
  passwordSet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Locale;
  dict: Dictionary;
  email: string | null;
  passwordSet: boolean;
}) {
  const d = dict.settings;
  // Profile and Sign out live here now that the avatar opens this dialog
  // instead of a dropdown menu — see components/layout/user-menu.tsx.
  const { handleSignOut } = useSignOut(lang);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>{email ? `${d.description} — ${email}` : d.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 overflow-y-auto p-4">
          <ChangePasswordSection lang={lang} passwordSet={passwordSet} dict={dict} />
          <Separator />
          <FontSizeSection dict={dict} />
          <Separator />
          <PushSection lang={lang} dict={dict} />

          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/${lang}/profile`} onClick={() => onOpenChange(false)} />}
            >
              <User className="size-4" aria-hidden />
              {dict.nav.profile}
            </Button>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="size-4" aria-hidden />
              {dict.common.signOut}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
