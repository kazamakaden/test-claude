/**
 * Task 5: Settings > font size. Isomorphic (no server-only) — read both in
 * app/[lang]/layout.tsx (server) and font-size-section.tsx (client), same
 * split as lib/i18n/config.ts's Locale.
 *
 * Cookie-backed, not localStorage: every route in this app already reads
 * cookies() (both (app)/layout.tsx and (public)/layout.tsx call
 * getSessionProfile()), so there is no first-paint flash to solve with a
 * next-themes-style blocking script — the server can just render the right
 * value. Same idiom as NEXT_LOCALE in language-toggle.tsx.
 */
export const FONT_SIZE_COOKIE = "APP_FONT_SIZE";

export const fontSizes = ["sm", "base", "lg", "xl"] as const;
export type FontSize = (typeof fontSizes)[number];
export const defaultFontSize: FontSize = "base";

/**
 * The cookie is user-controlled and its value is interpolated directly into
 * an html[data-font-size] attribute (app/[lang]/layout.tsx) — whitelisting
 * here is what stands between that and an attribute-injection primitive,
 * not just data hygiene.
 */
export function resolveFontSize(value: string | undefined): FontSize {
  return (fontSizes as readonly string[]).includes(value ?? "") ? (value as FontSize) : defaultFontSize;
}
