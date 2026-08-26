import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRole, getSessionUserId } from "@/lib/auth/get-role";
import { can } from "@/lib/auth/permissions";
import { getBook } from "@/services/books";
import { parseBookId } from "@/schemas/books";
import { canOpenBookPdf, SEASON_LABELS_TH, SEASON_LABELS_EN } from "@/lib/books";
import { BookFileActions } from "@/components/books/book-file-actions";
import { BookNotAttached } from "@/components/books/book-not-attached";
import { BookEditForm } from "@/components/books/book-edit-form";
import { PublishControls } from "@/components/books/publish-controls";
import { DeleteBookButton } from "@/components/books/delete-book-button";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { bangkokDate } from "@/lib/datetime";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: rawId } = await params;
  const lang = rawLang as Locale;
  const id = parseBookId(rawId);

  // A malformed id can never match a real row — treat it the same as "not
  // found" below rather than a 500, and never leak whether an id exists.
  const [dict, role, book] = await Promise.all([
    getDictionary(lang),
    getRole(),
    id ? getBook(id) : Promise.resolve(null),
  ]);

  if (!book) notFound();

  const viewerUserId = await getSessionUserId();

  const viewerId = viewerUserId;
  const isOwner = viewerId !== null && book.ownerId === viewerId;
  const isStaff = can(role, "document:approve");
  const canEdit = isStaff || (isOwner && book.status === "draft");
  const canDelete = isStaff || isOwner;

  const d = dict.documents;
  const locale = lang === "th" ? th : enUS;
  const seasonLabels = lang === "th" ? SEASON_LABELS_TH : SEASON_LABELS_EN;
  const showEditor = canEdit && viewerId !== null;
  // canDelete is exactly "owner or staff" — the audience allowed to open an
  // unpublished draft's file (lib/books.ts#canOpenBookPdf). RLS has already
  // refused the row entirely to anyone else.
  const canRead = canOpenBookPdf(book, canDelete);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/${lang}/documents`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {d.backToShelf}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-gradient-brand font-heading text-2xl font-semibold tracking-tight">
            {book.title}
          </h1>
          {book.description ? <p className="text-sm text-muted-foreground">{book.description}</p> : null}
          <p className="text-xs text-muted-foreground">
            {seasonLabels[book.season]} {book.academicYear}
            {book.status === "draft" ? ` · ${d.draftBadge}` : ""}
          </p>
          {book.publishedAt ? (
            <p className="text-xs text-muted-foreground">
              {d.publishedAt} {format(bangkokDate(book.publishedAt), "d MMM yyyy", { locale })}
            </p>
          ) : null}
          {book.ownerName ? (
            <p className="text-xs text-muted-foreground">
              {dict.documents.manage.detail.ownerLabel}: {book.ownerName}
            </p>
          ) : null}
        </div>

        {isStaff || isOwner ? (
          <div className="flex items-center gap-2">
            {isStaff ? <PublishControls id={book.id} status={book.status} lang={lang} dict={dict} /> : null}
            {canDelete ? (
              <DeleteBookButton
                bookId={book.id}
                title={book.title}
                lang={lang}
                dict={dict}
                redirectTo={`/${lang}/documents`}
                trigger={
                  <Button variant="destructive">
                    <Trash2 className="size-4" aria-hidden />
                    {d.confirmDelete}
                  </Button>
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {canRead && book.pdfPath ? (
        <div className="flex flex-col gap-2">
          {showEditor ? (
            <h2 className="font-heading text-sm font-medium text-muted-foreground">{d.readBook}</h2>
          ) : null}
          <BookFileActions pdfPath={book.pdfPath} title={book.title} dict={dict} />
        </div>
      ) : showEditor ? null : (
        // Someone who cannot edit is only ever here for a published book,
        // which books_published_needs_pdf (0053) guarantees has a file — so
        // this is the "the file failed to sign" case, not a missing upload.
        <BookNotAttached dict={dict} />
      )}

      {canEdit && viewerId ? <BookEditForm book={book} ownerId={viewerId} lang={lang} dict={dict} /> : null}
    </div>
  );
}
