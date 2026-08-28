"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { BOOK_COLLECTIONS } from "@/lib/book-collections";
import type { BookCollection } from "@/types/books";
import type { Dictionary } from "@/types/i18n";

/**
 * Which shelf a book sits on (0074), on BOTH the create and the edit form.
 *
 * Deliberately a visible control rather than a hidden field carrying whichever
 * page the viewer came from. A required field the form does not render is
 * unsatisfiable by construction — the exact shape of the activity-edit bug
 * where updateActivitySchema inherited a required `category` the edit sheet
 * never showed, so no activity could be saved at all. It also makes a book
 * filed on the wrong shelf fixable, which a hidden field would not.
 */
export function CollectionSelect({
  dict,
  defaultValue,
  error,
}: {
  dict: Dictionary;
  defaultValue: BookCollection;
  error?: string;
}) {
  const labels = dict.documents.collections;

  return (
    <FormField name="collection" invalid={Boolean(error)}>
      <FormLabel>{dict.documents.manage.form.collectionLabel}</FormLabel>
      <Select name="collection" defaultValue={defaultValue}>
        <SelectTrigger aria-label={dict.documents.manage.form.collectionLabel} className="w-full">
          {/* Base UI shows the raw stored value without this render function —
              the "__all__" defect already fixed once on the members filters. */}
          <SelectValue>{(value: string) => labels[value as BookCollection]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {BOOK_COLLECTIONS.map((collection) => (
            <SelectItem key={collection} value={collection}>
              {labels[collection]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormError>{error}</FormError>
    </FormField>
  );
}
