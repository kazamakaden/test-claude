"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBookAction, type BookActionResult } from "@/actions/books";
import { CollectionSelect } from "@/components/books/collection-select";
import { SEASON_LABELS_TH, SEASON_LABELS_EN } from "@/lib/books";
import type { Locale } from "@/lib/i18n/config";
import type { BookCollection } from "@/types/books";
import type { Dictionary } from "@/types/i18n";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Task 2's minimal create step: name, year, season -> draft. Everything else is edited on the resulting book's own page. */
export function BookCreateForm({
  lang,
  dict,
  defaultCollection,
}: {
  lang: Locale;
  dict: Dictionary;
  defaultCollection: BookCollection;
}) {
  const [state, formAction] = useActionState<BookActionResult | null, FormData>(createBookAction, null);
  const d = dict.documents.manage;
  const seasonLabels = lang === "th" ? SEASON_LABELS_TH : SEASON_LABELS_EN;
  const currentBuddhistYear = new Date().getFullYear() + 543;

  const errorMessage = state && !state.ok ? d.form.errors[state.messageKey] : undefined;
  const titleError = state && !state.ok && state.messageKey === "titleRequired" ? errorMessage : undefined;
  const yearError = state && !state.ok && state.messageKey === "yearInvalid" ? errorMessage : undefined;
  const seasonError = state && !state.ok && state.messageKey === "seasonInvalid" ? errorMessage : undefined;
  const collectionError =
    state && !state.ok && state.messageKey === "collectionRequired" ? errorMessage : undefined;

  useEffect(() => {
    if (errorMessage && !titleError && !yearError && !seasonError && !collectionError) {
      toast.error(errorMessage);
    }
  }, [errorMessage, titleError, yearError, seasonError, collectionError]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />

      <FormField name="title" invalid={Boolean(titleError)}>
        <FormLabel>{d.form.titleLabel}</FormLabel>
        <Input name="title" required maxLength={200} />
        <FormError>{titleError}</FormError>
      </FormField>

      <CollectionSelect dict={dict} defaultValue={defaultCollection} error={collectionError} />

      <FormField name="academicYear" invalid={Boolean(yearError)}>
        <FormLabel>{dict.documents.filterYear}</FormLabel>
        <Input name="academicYear" type="number" required defaultValue={currentBuddhistYear} min={2500} max={2699} />
        <FormError>{yearError}</FormError>
      </FormField>

      <FormField name="season" invalid={Boolean(seasonError)}>
        <FormLabel>{dict.documents.filterSeason}</FormLabel>
        <Select name="season" defaultValue="1">
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

      <SubmitButton label={d.form.create} pendingLabel={d.form.creating} />
    </form>
  );
}
