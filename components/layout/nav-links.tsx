"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  FileText,
  FolderKanban,
  Home,
  Megaphone,
  Sparkles,
  Users,
} from "lucide-react";
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
};

function isActive(pathname: string, lang: Locale, href: string) {
  const target = `/${lang}${href === "/" ? "" : href}`;
  if (href === "/") return pathname === target;
  return pathname === target || pathname.startsWith(`${target}/`);
}

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

  return (
    <ul
      className={cn(
        "flex",
        orientation === "horizontal"
          ? "items-center gap-1"
          : "flex-col gap-1"
      )}
    >
      {items.map((item) => {
        const href = `/${lang}${item.href === "/" ? "" : item.href}`;
        const active = isActive(pathname, lang, item.href);
        const Icon = iconByKey[item.key];

        return (
          <li key={item.href} className="relative">
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "text-brand-ink"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {orientation === "vertical" && Icon ? (
                <Icon className="size-4" aria-hidden />
              ) : null}
              {dict.nav[item.key]}
            </Link>
            {active && orientation === "horizontal" ? (
              <motion.div
                layoutId="nav-underline"
                className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-accent-glow"
                transition={{ duration: 0.22, ease: "easeOut" }}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
