export const locales = ["th", "en"] as const;
export const defaultLocale: Locale = "th";

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
