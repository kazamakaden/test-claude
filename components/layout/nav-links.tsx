"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  FileText,
  FolderKanban,
  Home,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const iconByKey: Partial<Record<keyof Dictionary["nav"], typeof Home>> = {
  home: Home,
  calendar: Calendar,
  projects: FolderKanban,
  activities: Megaphone,
  documents: FileText,
  aft11: Sparkles,
  members: Users,
  reports: BarChart3,
  approvals: ShieldCheck,
};

/** gap-1 between items, in px — used when measuring what fits. */
const GAP = 4;

function isActive(pathname: string, lang: Locale, href: string) {
  const target = `/${lang}${href === "/" ? "" : href}`;
  if (href === "/") return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
}

const linkClass =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function NavLinks({
  items,
  lang,
  dict,
  orientation = "horizontal",
  onNavigate,
}: {
  items: NavItem[];
  lang: Locale;
  dict: Dictionary;
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  if (orientation === "vertical") {
    return (
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = iconByKey[item.key];
          const active = isActive(pathname, lang, item.href);
          return (
            <li key={item.href}>
              <Link
                href={`/${lang}${item.href === "/" ? "" : item.href}`}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  linkClass,
                  active ? "text-brand-ink" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon ? <Icon className="size-4" aria-hidden /> : null}
                {dict.nav[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return <HorizontalNav items={items} lang={lang} dict={dict} pathname={pathname} />;
}

/**
 * Renders as many items as actually fit and moves the rest into a chevron
 * dropdown.
 *
 * Measured rather than split at a fixed breakpoint: English labels are far
 * longer than Thai ("11 Good 11 Skilled — AFT" vs "11 ดี 11 เก่ง อวท."), the
 * item count varies by role, and Settings lets the user change the font size
 * (`data-font-size` on the root) — which changes label widths *without*
 * changing the container width. A hardcoded "show N items at lg" rule would
 * silently overflow in some of those combinations.
 *
 * The hidden list below is the measurement source: it always contains every
 * item at full width, so widths stay readable even while the visible row is
 * truncated. It is also what makes the font-size case work — a ResizeObserver
 * on the container alone would never fire for it.
 */
function HorizontalNav({
  items,
  lang,
  dict,
  pathname,
}: {
  items: NavItem[];
  lang: Locale;
  dict: Dictionary;
  pathname: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLLIElement>(null);

  // Start with everything visible so the server render and the first client
  // render agree (no hydration mismatch, no flash); the effect narrows it.
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const widths = Array.from(measure.children).map(
        (child) => (child as HTMLElement).offsetWidth
      );
      if (widths.length === 0) return;

      const available = container.clientWidth;
      if (available === 0) return;

      const totalAll = widths.reduce((sum, w) => sum + w, 0) + GAP * (widths.length - 1);
      if (totalAll <= available) {
        setVisibleCount(widths.length);
        return;
      }

      // Something must collapse, so the trigger's own width has to be reserved.
      const triggerWidth = triggerRef.current?.offsetWidth ?? 44;
      let used = triggerWidth;
      let count = 0;
      for (const w of widths) {
        const next = used + w + GAP;
        if (next > available) break;
        used = next;
        count += 1;
      }
      setVisibleCount(count);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [items]);

  // Re-measure once fonts finish loading: label widths shift when a webfont
  // swaps in, and that resizes the measurement list rather than the container.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    let cancelled = false;
    fonts.ready.then(() => {
      if (cancelled) return;
      measureRef.current?.dispatchEvent(new Event("resize"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  const activeIndex = items.findIndex((item) => isActive(pathname, lang, item.href));
  const activeIsHidden = activeIndex >= visibleCount && activeIndex !== -1;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      {/* Measurement copy — never shown, never focusable, never announced.
          The `overflow-hidden` wrapper is load-bearing, not decoration:
          `visibility: hidden` still contributes to scroll width, so without
          it this full-width list pushed the document's scrollWidth past the
          viewport and produced real horizontal scroll. Clipping does not
          affect offsetWidth, so the measurements are unchanged. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-0 w-full overflow-hidden"
      >
      <ul
        ref={measureRef}
        className="invisible flex items-center gap-1"
      >
        {items.map((item) => (
          <li key={item.href}>
            <span className={linkClass}>{dict.nav[item.key]}</span>
          </li>
        ))}
      </ul>
      </div>

      {/* `overflow-x-auto` is the no-JS safety net, not styling. Until the
          measuring effect runs — and forever if the visitor has JS off — this
          row renders every item, which at 1024–1279px in English is wider than
          the space available and pushed the whole document into horizontal
          scroll (measured: 1178px wide at a 1024px viewport). Scrolling the row
          instead of the page keeps every item reachable without JS, which
          clipping would not: the overflow dropdown cannot open without JS, so
          anything cut off would be unreachable rather than merely offscreen.
          `py-1` keeps the active underline (`-bottom-[1px]`) inside the scroll
          box — an `overflow-x` value forces `overflow-y` to compute to `auto`,
          so a child hanging 1px below would otherwise be clipped. */}
      <ul className="flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visible.map((item, index) => {
          const active = index === activeIndex;
          return (
            <li key={item.href} className="relative">
              <Link
                href={`/${lang}${item.href === "/" ? "" : item.href}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  linkClass,
                  active ? "text-brand-ink" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {dict.nav[item.key]}
              </Link>
              {active ? <NavUnderline /> : null}
            </li>
          );
        })}

        {overflow.length > 0 ? (
          <li ref={triggerRef} className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={dict.common.moreMenu}
                    className={cn(
                      "rounded-lg",
                      activeIsHidden ? "text-brand-ink" : "text-muted-foreground"
                    )}
                  />
                }
              >
                <ChevronDown aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {overflow.map((item) => {
                  const Icon = iconByKey[item.key];
                  const active = isActive(pathname, lang, item.href);
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      render={
                        <Link href={`/${lang}${item.href === "/" ? "" : item.href}`} />
                      }
                      aria-current={active ? "page" : undefined}
                      className={cn(active && "text-brand-ink")}
                    >
                      {Icon ? <Icon className="size-4" aria-hidden /> : null}
                      {dict.nav[item.key]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Only ever one underline in the tree: two nodes sharing a
                framer-motion layoutId fight over the shared animation. */}
            {activeIsHidden ? <NavUnderline /> : null}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function NavUnderline() {
  return (
    <motion.div
      layoutId="nav-underline"
      className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-accent-glow"
      transition={{ duration: 0.22, ease: "easeOut" }}
    />
  );
}
