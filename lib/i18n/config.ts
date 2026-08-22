export const locales = ["th", "en"] as const;
export const defaultLocale: Locale = "th";

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Shared by every Server Action that reads a hidden `lang` field off its
 * FormData (actions/activities.ts, actions/content.ts, actions/profile.ts,
 * actions/settings.ts) — was copy-pasted identically into each file before
 * this extraction (CLAUDE.md §21: "NEVER duplicate components
 * unnecessarily").
 */
export function readLang(formData: FormData): Locale {
  const raw = formData.get("lang");
  return typeof raw === "string" && isLocale(raw) ? raw : defaultLocale;
}
