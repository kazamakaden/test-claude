import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { getDepartments, getClubs } from "@/services/members";
import { AutoInputForm } from "@/components/members/autoinput-form";
import type { Locale } from "@/lib/i18n/config";

/**
 * §14 "Auto input". Admin-only: requirePermission("member:manage") re-checks
 * server-side here, and createMemberAction/createDepartmentAction re-check
 * again — the button on /members merely hides the entry point (§19).
 */
export default async function AutoInputPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requirePermission("member:manage", lang);

  // Both already fail soft to [] via tryCreateClient, so an unconfigured or
  // unreachable Supabase renders an empty picker rather than crashing the page.
  const [dict, departments, clubs] = await Promise.all([
    getDictionary(lang),
    getDepartments(),
    getClubs(),
  ]);
  const d = dict.members.autoinput;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${lang}/members`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {d.backToMembers}
        </Link>
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.title}
        </h1>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      <AutoInputForm departments={departments} clubs={clubs} lang={lang} dict={dict} />
    </div>
  );
}
