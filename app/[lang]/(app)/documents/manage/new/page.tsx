import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { DocumentForm } from "@/components/documents/document-form";
import type { Locale } from "@/lib/i18n/config";

export default async function NewDocumentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang as Locale;

  await requirePermission("document:sign", lang);

  const dict = await getDictionary(lang);
  const d = dict.documents.manage;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {d.newDocumentCta}
        </h1>
        <p className="text-sm text-muted-foreground">{d.description}</p>
      </div>

      <DocumentForm mode="create" lang={lang} dict={dict} />
    </div>
  );
}
