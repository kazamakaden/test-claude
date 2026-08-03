import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole } from "@/lib/auth/get-role";
import type { Locale } from "@/lib/i18n/config";

/**
 * Landing spot for a signed-in user with role='pending' — every
 * requirePermission() guard sends them here instead of /login (see
 * deniedRedirectTarget in lib/auth/require-role.ts), so this page must not
 * itself require a permission or it would loop. getRole() is enough:
 * "guest" means no real session (or Supabase isn't configured), so send
 * them to log in; anything past "pending" means an admin already approved
 * them, so send them on to the dashboard instead of stranding them here.
 */
export default async function PendingApprovalPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  const [dict, role] = await Promise.all([getDictionary(lang), getRole()]);

  if (role === "guest") redirect(`/${lang}/login`);
  if (role !== "pending") redirect(`/${lang}/dashboard`);

  const d = dict.pending;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center sm:px-6 lg:px-8">
      <Hourglass className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-xl font-semibold text-foreground">{d.title}</h1>
      <p className="text-sm text-muted-foreground">{d.description}</p>
    </div>
  );
}
