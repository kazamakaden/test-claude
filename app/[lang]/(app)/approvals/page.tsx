import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n/config";

/**
 * /approvals is gone — approving a pending signup now happens on /members,
 * alongside every other member-management action, so there is one place to
 * manage people rather than two.
 *
 * Kept as a redirect rather than deleted outright: this URL is in browser
 * histories and, more importantly, is the `link` baked into the
 * `accountApproved` notification rows that 0036's triggers have already
 * written. Deleting the route would turn those into 404s retroactively.
 */
export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  redirect(`/${rawLang as Locale}/members`);
}
