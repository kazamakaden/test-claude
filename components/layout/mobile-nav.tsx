"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "@/components/layout/nav-links";
import { Logo } from "@/components/layout/logo";
import type { NavItem } from "@/lib/navigation";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

export function MobileNav({
  items,
  lang,
  dict,
}: {
  items: NavItem[];
  lang: Locale;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={dict.common.openMenu}
            className="md:hidden"
          />
        }
      >
        <Menu />
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
      </SheetContent>
    </Sheet>
  );
}
