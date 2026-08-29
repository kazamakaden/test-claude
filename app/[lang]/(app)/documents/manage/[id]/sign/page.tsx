import { notFound, redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getSessionUserId } from "@/lib/auth/get-role";
import { requirePermission } from "@/lib/auth/require-role";
import { getDocumentForWorkflow } from "@/services/documents";
import { parseDocumentId } from "@/schemas/documents";
import { SignatureFlow } from "@/components/documents/signature-flow";
import type { Locale } from "@/lib/i18n/config";

export default async function SignDocumentPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = rawLang as Locale;

  await requirePermission("document:sign", lang);

  const id = parseDocumentId(rawId);
  if (!id) notFound();

  const [dict, document] = await Promise.all([getDictionary(lang), getDocumentForWorkflow(id)]);
  if (!document) notFound();

  const viewerUserId = await getSessionUserId();

  // Only the owner may sign, and only while the document is still a draft —
  // re-checked server-side; sign_document() (0016) enforces the same rule
  // at the database layer regardless of what this page allows.
  if (!viewerUserId || viewerUserId !== document.ownerId || document.status !== "draft") {
    redirect(`/${lang}/documents/manage/${document.id}`);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
          {document.title}
        </h1>
      </div>

      <SignatureFlow documentId={document.id} lang={lang} dict={dict} />
    </div>
  );
}
