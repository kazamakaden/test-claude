import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

/**
 * Registration is Google-only (§ current work item) — the same single
 * button /login already offers, so a separate signup page no longer has
 * anything distinct to show. Kept as a redirect rather than deleted
 * outright so an old bookmark/link to /signup still lands somewhere useful.
 */
export default async function SignupPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  redirect(`/${lang}/login`);
}
