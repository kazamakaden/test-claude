import Link from "next/link";
import { ArrowLeft, PenLine } from "lucide-react";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { requirePermission } from "@/lib/auth/require-role";
import { getRole } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getDocumentForWorkflow } from "@/services/documents";
import { parseDocumentId } from "@/schemas/documents";
import { DocumentForm } from "@/components/documents/document-form";
import { SubmitDocumentButton } from "@/components/documents/submit-document-button";
import { DocumentReviewActions } from "@/components/documents/document-review-actions";
import { FlipbookViewer } from "@/components/documents/flipbook-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

export default async function DocumentWorkflowDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = rawLang as Locale;

  await requirePermission("document:sign", lang);

  const id = parseDocumentId(rawId);
  if (!id) notFound();

  const [dict, role, document] = await Promise.all([
    getDictionary(lang),
    getRole(),
    getDocumentForWorkflow(id),
  ]);
  if (!document) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = Boolean(user && user.id === document.ownerId);

  const d = dict.documents.manage;
  const canEdit = isOwner && document.status === "draft";
  const canSign = isOwner && document.status === "draft" && document.draft?.content;
  const canSubmit = isOwner && document.status === "signed";
  const canReview = document.status === "pending_approval" && can(role, "document:approve");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/${lang}/documents/manage`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {d.detail.backToList}
      </Link>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {document.title}
          </h1>
          <Badge variant="outline">{d.status[document.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {d.detail.ownerLabel}: {document.ownerName ?? "—"}
        </p>
      </div>

      {document.rejectedReason ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <strong>{d.rejectedReasonLabel}:</strong> {document.rejectedReason}
        </div>
      ) : null}

      {document.status === "official" ? (
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/${lang}/documents/${document.id}`} />}
        >
          {d.detail.viewPublished}
        </Button>
      ) : null}

      {canEdit ? (
        <>
          <DocumentForm mode="edit" document={document} lang={lang} dict={dict} />
          {canSign ? (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={`/${lang}/documents/manage/${document.id}/sign`} />}
            >
              <PenLine className="size-4" aria-hidden />
              {d.sign.title}
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {document.draft?.content || "—"}
            </p>
          </div>

          {document.status !== "draft" ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-foreground">{d.detail.bookPreviewTitle}</h2>
              <FlipbookViewer title={document.title} flipbookUrl={document.flipbookUrl} dict={dict} />
            </div>
          ) : null}
        </>
      )}

      {canSubmit ? (
        <SubmitDocumentButton id={document.id} lang={lang} label={d.actions.submitForApproval} />
      ) : null}

      {canReview ? <DocumentReviewActions id={document.id} lang={lang} dict={dict} /> : null}
    </div>
  );
}
