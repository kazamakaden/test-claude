"use client";

import { useState } from "react";
import { fontSizes, FONT_SIZE_COOKIE, defaultFontSize, resolveFontSize, type FontSize } from "@/lib/font-size";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/types/i18n";

/**
 * Reads the live DOM attribute for initial state rather than a prop from
 * the server — the dialog itself is rendered unconditionally in the layout
 * (components/settings/settings-dialog-provider.tsx), so there is no
 * server-known "current" value to pass down without making the whole nav
 * tree depend on this cookie.
 */
function currentFontSize(): FontSize {
  if (typeof document === "undefined") return defaultFontSize;
  return resolveFontSize(document.documentElement.dataset.fontSize);
}

export function FontSizeSection({ dict }: { dict: Dictionary }) {
  const d = dict.settings.fontSize;
  const [value, setValue] = useState<FontSize>(currentFontSize);

  function handleSelect(next: FontSize) {
    setValue(next);
    document.documentElement.dataset.fontSize = next;
    document.cookie = `${FONT_SIZE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-heading text-sm font-medium text-foreground">{d.title}</h3>
      <p className="text-xs text-muted-foreground">{d.description}</p>
      <div role="radiogroup" aria-label={d.title} className="flex flex-wrap gap-2">
        {fontSizes.map((size) => (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={value === size}
            onClick={() => handleSelect(size)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50",
              value === size
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            {d.options[size]}
          </button>
        ))}
      </div>
      <p className="text-sm text-foreground" style={{ fontSize: "1.05em" }}>
        {d.preview}
      </p>
    </section>
  );
}
