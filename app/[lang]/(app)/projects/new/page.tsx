import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { getDepartments } from "@/services/members";
import { ProjectForm } from "@/components/projects/project-form";
import type { Locale } from "@/lib/i18n/config";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requirePermission("project:draft:submit", lang);

  const [dict, departments] = await Promise.all([getDictionary(lang), getDepartments()]);
  const d = dict.projects;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.newProjectCta}
        </h1>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      <ProjectForm mode="create" departments={departments} lang={lang} dict={dict} />
    </div>
  );
}
