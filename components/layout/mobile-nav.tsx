"use client";

import { useRef, useState } from "react";
import { MenuIcon, type MenuIconHandle } from "@animateicons/react/lucide";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
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
  const menuIconRef = useRef<MenuIconHandle>(null);
  const prefersReducedMotion = useReducedMotion();

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
      </SheetContent>
    </Sheet>
  );
}
