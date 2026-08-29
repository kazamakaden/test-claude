import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

/**
 * "11 ดี 11 เก่ง อวท." moved onto /documents, which now shows the two lists
 * (11 ดี / 11 เก่ง) instead of a single free-text block.
 *
 * Kept as a redirect rather than deleted — the same call /dashboard got when
 * it folded into /calendar. The URL is in bookmarks and was a nav tab for
 * months; a 404 would be a worse answer than the page it moved to.
 */
export default async function Aft11RedirectPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  redirect(`/${rawLang as Locale}/documents`);
}
