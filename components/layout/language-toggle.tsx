"use client";

import { usePathname, useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

export function LanguageToggle({
  lang,
  label,
}: {
  lang: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const targetLocale: Locale = lang === "th" ? "en" : "th";

  function handleToggle() {
    const segments = pathname.split("/");
    segments[1] = targetLocale;
    const nextPath = segments.join("/") || "/";

    document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=31536000; samesite=lax`;
    router.push(nextPath);
  }

  return (
    <Button variant="ghost" size="icon" aria-label={label} onClick={handleToggle}>
      <Languages />
    </Button>
  );
}
