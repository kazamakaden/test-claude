import "server-only";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  th: () => import("@/lib/i18n/dictionaries/th.json").then((m) => m.default),
  en: () => import("@/lib/i18n/dictionaries/en.json").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
