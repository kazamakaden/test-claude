"use client";

import { useEffect, useState, useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createActivityAction,
  updateActivityAction,
  deleteActivityAction,
  type ActivityFormResult,
} from "@/actions/activities";
import type { MonthActivity } from "@/types/activities";
import type { Holiday } from "@/types/holidays";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

// useFormStatus only reports the correct pending state for a DOM descendant
// of the <form> it tracks — same note as member-edit-sheet.tsx's SaveButton.
function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function timeOf(iso: string | null): string {
  if (!iso) return "";
  return format(new Date(iso), "HH:mm");
}

function ActivityForm({
  date,
  editing,
  lang,
  dict,
  onDone,
  onCancel,
}: {
  date: Date;
  editing: MonthActivity | null;
  lang: Locale;
  dict: Dictionary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const d = dict.dashboard.calendar;
  const [state, formAction] = useActionState<ActivityFormResult | null, FormData>(
    editing ? updateActivityAction : createActivityAction,
    null
  );

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
    if (state?.ok) {
      toast.success(editing ? d.updated : d.created);
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dateIso = format(date, "yyyy-MM-dd");

  return (
    <form action={formAction} className="flex flex-1 flex-col overflow-hidden">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="date" value={dateIso} />
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
        <FormField name="title" invalid={Boolean(errorMessage)}>
          <FormLabel>{d.titleLabel}</FormLabel>
          <Input name="title" maxLength={200} defaultValue={editing?.title ?? ""} required />
        </FormField>

        <div className="flex gap-3">
          <FormField name="startTime" className="flex-1" invalid={Boolean(errorMessage)}>
            <FormLabel>{d.startTimeLabel}</FormLabel>
            <Input type="time" name="startTime" defaultValue={timeOf(editing?.startsAt ?? null)} required />
          </FormField>
          <FormField name="endTime" className="flex-1">
            <FormLabel>{d.endTimeLabel}</FormLabel>
            <Input type="time" name="endTime" defaultValue={timeOf(editing?.endsAt ?? null)} />
          </FormField>
        </div>

        <FormField name="location">
          <FormLabel>{d.locationLabel}</FormLabel>
          <Input name="location" maxLength={200} defaultValue={editing?.location ?? ""} />
        </FormField>

        <FormField name="description" invalid={Boolean(errorMessage)}>
          <FormLabel>{d.descriptionLabel}</FormLabel>
          <Textarea name="description" maxLength={2000} defaultValue={editing?.description ?? ""} />
          <FormError>{errorMessage}</FormError>
        </FormField>
      </div>

      <SheetFooter className="flex-row justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {d.cancel}
        </Button>
        <SaveButton label={editing ? d.save : d.add} pendingLabel={editing ? d.saving : d.adding} />
      </SheetFooter>
    </form>
  );
}

function DeleteActivityTrigger({
  activity,
  lang,
  dict,
}: {
  activity: MonthActivity;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.dashboard.calendar;
  // AlertDialogAction closes the dialog immediately on click (a Base UI
  // Close primitive) — same reasoning as member-delete-dialog.tsx for
  // discarding isPending rather than trying to show it.
  const [, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteActivityAction(lang, activity.id);
      if (!result.ok) {
        toast.error(d.errors.unknown);
        return;
      }
      toast.success(d.deleted);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="ghost" size="xs" aria-label={`${d.delete} ${activity.title}`} />}
      >
        <Trash2 className="size-3.5" aria-hidden />
        {d.delete}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.deleteConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {d.deleteConfirmDescription.replace("{title}", activity.title)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>{d.confirmDelete}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Opens when a calendar day is clicked (components/dashboard/calendar-grid.tsx
 * owns `date`/selection). Everyone sees that day's activities read-only;
 * canManage (activity:manage — aft_teacher/admin, re-checked server-side in
 * every action this renders, never trusted from this component alone) adds
 * inline Edit/Delete per activity and an "add" form, sharing one ActivityForm
 * for both create and edit.
 */
export function CalendarDaySheet({
  date,
  onOpenChange,
  events,
  holiday,
  canManage,
  lang,
  dict,
}: {
  date: Date | null;
  onOpenChange: (open: boolean) => void;
  events: MonthActivity[];
  holiday: Holiday | null;
  canManage: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const [editing, setEditing] = useState<MonthActivity | "new" | null>(null);
  const d = dict.dashboard.calendar;
  const locale = lang === "th" ? th : enUS;

  // A different day was clicked — always land back on the read-only list,
  // not mid-edit of the previous day's activity.
  useEffect(() => {
    setEditing(null);
  }, [date]);

  if (!date) return null;

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{format(date, "d MMMM yyyy", { locale })}</SheetTitle>
          {holiday ? (
            <p className="text-sm text-primary">
              {d.holidayLabel}: {holiday.name}
            </p>
          ) : null}
        </SheetHeader>

        {editing !== null ? (
          <ActivityForm
            date={date}
            editing={editing === "new" ? null : editing}
            lang={lang}
            dict={dict}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{d.noEventsOnDay}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{e.title}</p>
                      {canManage ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={`${d.edit} ${e.title}`}
                            onClick={() => setEditing(e)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            {d.edit}
                          </Button>
                          <DeleteActivityTrigger activity={e} lang={lang} dict={dict} />
                        </div>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {timeOf(e.startsAt)}
                      {e.endsAt ? `–${timeOf(e.endsAt)}` : ""}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                    {e.description ? <p className="text-xs text-muted-foreground">{e.description}</p> : null}
                  </li>
                ))}
              </ul>
            )}

            {canManage ? (
              <SheetFooter className="p-0 pt-2">
                <Button variant="outline" onClick={() => setEditing("new")}>
                  <Plus className="size-4" aria-hidden />
                  {d.addEvent}
                </Button>
              </SheetFooter>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
