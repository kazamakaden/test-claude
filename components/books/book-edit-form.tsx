"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUploader } from "@/components/books/file-uploader";
import { updateBookAction, type BookActionResult } from "@/actions/books";
import { BOOK_PDF_MAX_BYTES, BOOK_COVER_MAX_BYTES, SEASON_LABELS_TH, SEASON_LABELS_EN } from "@/lib/books";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import type { BookDetail } from "@/types/books";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function BookEditForm({
  book,
  ownerId,
  lang,
  dict,
}: {
  book: BookDetail;
  /** The current viewer's own id — always their own upload folder, even when a staff member is editing someone else's book (books_storage_insert_own, 0029, requires the folder to match the UPLOADER, not the book's original owner). */
  ownerId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const [state, formAction] = useActionState<BookActionResult | null, FormData>(updateBookAction, null);
  const d = dict.documents.manage;
  const seasonLabels = lang === "th" ? SEASON_LABELS_TH : SEASON_LABELS_EN;

  const errorMessage = state && !state.ok ? d.form.errors[state.messageKey] : undefined;
  const titleError = state && !state.ok && state.messageKey === "titleRequired" ? errorMessage : undefined;
  const yearError = state && !state.ok && state.messageKey === "yearInvalid" ? errorMessage : undefined;
  const seasonError = state && !state.ok && state.messageKey === "seasonInvalid" ? errorMessage : undefined;
  const flipbookError =
    state && !state.ok && state.messageKey === "flipbookUrlInvalid" ? errorMessage : undefined;
  const otherError =
    state && !state.ok && !titleError && !yearError && !seasonError && !flipbookError ? errorMessage : undefined;

  useEffect(() => {
    if (otherError) toast.error(otherError);
  }, [otherError]);

  useEffect(() => {
    if (state?.ok) toast.success(d.form.saved);
  }, [state, d.form.saved]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="id" value={book.id} />

      <FormField name="title" invalid={Boolean(titleError)}>
        <FormLabel>{d.form.titleLabel}</FormLabel>
        <Input name="title" required maxLength={200} defaultValue={book.title} />
        <FormError>{titleError}</FormError>
      </FormField>

      <FormField name="description">
        <FormLabel>{d.form.descriptionLabel}</FormLabel>
        <Textarea name="description" maxLength={2000} rows={3} defaultValue={book.description ?? ""} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField name="academicYear" invalid={Boolean(yearError)}>
          <FormLabel>{dict.documents.filterYear}</FormLabel>
          <Input name="academicYear" type="number" required defaultValue={book.academicYear} min={2500} max={2699} />
          <FormError>{yearError}</FormError>
        </FormField>

        <FormField name="season" invalid={Boolean(seasonError)}>
          <FormLabel>{dict.documents.filterSeason}</FormLabel>
          <Select name="season" defaultValue={String(book.season)}>
            <SelectTrigger aria-label={dict.documents.filterSeason} className="w-full">
              <SelectValue>{(value: string) => seasonLabels[Number(value)]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3].map((season) => (
                <SelectItem key={season} value={String(season)}>
                  {seasonLabels[season]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormError>{seasonError}</FormError>
        </FormField>
      </div>

      <FormField name="flipbookUrl" invalid={Boolean(flipbookError)}>
        <FormLabel>{d.form.flipbookUrlLabel}</FormLabel>
        <Input
          name="flipbookUrl"
          type="url"
          placeholder="https://fliphtml5.com/xxxx/yyyy/"
          defaultValue={book.flipbookUrl ?? ""}
        />
        <p className="text-sm text-muted-foreground">{d.form.flipbookUrlHint}</p>
        <FormError>{flipbookError}</FormError>
      </FormField>

      <FormField name="pdfPath">
        <FormLabel>{d.form.pdfLabel}</FormLabel>
        <FileUploader
          fieldName="pdfPath"
          bucket="books"
          accept="application/pdf"
          maxBytes={BOOK_PDF_MAX_BYTES}
          ownerId={ownerId}
          bookId={book.id}
          initialPath={book.pdfPath}
          uploadingLabel={d.form.uploading}
          attachedLabel={d.form.pdfAttached}
          tooLargeLabel={d.form.pdfTooLarge}
          failedLabel={d.form.uploadFailed}
        />
      </FormField>

      <FormField name="coverPath">
        <FormLabel>{d.form.coverLabel}</FormLabel>
        <FileUploader
          fieldName="coverPath"
          bucket="book-covers"
          accept="image/jpeg,image/png,image/webp"
          maxBytes={BOOK_COVER_MAX_BYTES}
          ownerId={ownerId}
          bookId={book.id}
          initialPath={book.coverPath}
          uploadingLabel={d.form.uploading}
          attachedLabel={d.form.coverAttached}
          tooLargeLabel={d.form.coverTooLarge}
          failedLabel={d.form.uploadFailed}
        />
      </FormField>

      <SubmitButton label={d.form.save} pendingLabel={d.form.saving} />
    </form>
  );
}
