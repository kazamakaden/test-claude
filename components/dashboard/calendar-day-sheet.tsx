"use client";

import { useEffect, useState, useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { Plus, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput } from "@/components/ui/time-input";
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
  publishActivityAction,
  type ActivityFormResult,
} from "@/actions/activities";
import type { MonthActivity } from "@/types/activities";
import type { Holiday } from "@/types/holidays";
import { ActivityDeleteDialog } from "@/components/activities/activity-delete-dialog";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";
import { bangkokDate } from "@/lib/datetime";

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
  return format(bangkokDate(iso), "HH:mm");
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

        {/* Native radios, not a Select: two options, no JavaScript needed, and
            `required` on both means the browser itself refuses an empty
            submission. 0068 makes the column NOT NULL with no default, so a
            missing category is a database refusal too — this is the friendly
            layer, not the boundary.

            Rendered on EDIT as well as create, and that is load-bearing rather
            than a nicety. This block used to be wrapped in `editing === null`,
            on the reasoning that the creator had already made the choice — but
            updateActivitySchema extends createActivitySchema, so it inherits
            `category` as REQUIRED. The edit form therefore submitted no
            category and every edit failed validation with categoryRequired:
            an existing activity could not be saved at all, not even a time
            change. Showing the control on both paths removes the special case
            instead of papering over it, and the column is updatable (0068
            grants UPDATE on it), so a mis-chosen category is now fixable. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">{d.categoryLabel}</legend>
          <div className="flex gap-4">
            {(["org", "club"] as const).map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="category"
                  value={value}
                  required
                  defaultChecked={(editing?.category ?? "org") === value}
                  className="size-4 accent-primary"
                />
                {value === "org" ? d.categoryOrg : d.categoryClub}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-3">
          <FormField name="startTime" className="flex-1" invalid={Boolean(errorMessage)}>
            <FormLabel>{d.startTimeLabel}</FormLabel>
            <TimeInput
              name="startTime"
              defaultValue={timeOf(editing?.startsAt ?? null)}
              required
              hourLabel={`${d.startTimeLabel} — ${d.hourLabel}`}
              minuteLabel={`${d.startTimeLabel} — ${d.minuteLabel}`}
            />
          </FormField>
          <FormField name="endTime" className="flex-1">
            <FormLabel>{d.endTimeLabel}</FormLabel>
            <TimeInput
              name="endTime"
              defaultValue={timeOf(editing?.endsAt ?? null)}
              hourLabel={`${d.endTimeLabel} — ${d.hourLabel}`}
              minuteLabel={`${d.endTimeLabel} — ${d.minuteLabel}`}
            />
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

/**
 * The confirmation step the spec asks for: a draft is not public until someone
 * says so on purpose.
 *
 * AlertDialog, the same primitive as the delete trigger above — its Action
 * closes on click, so isPending is discarded here for the same reason
 * documented there. The staff-only rule is re-checked server-side in
 * publishActivityAction AND again by activities_publish_guard (0068/0070); this
 * dialog is the friendly layer, never the boundary.
 */
function PublishActivityTrigger({
  activity,
  lang,
  dict,
}: {
  activity: MonthActivity;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.dashboard.calendar;
  const [, startTransition] = useTransition();

  const handlePublish = () => {
    startTransition(async () => {
      const result = await publishActivityAction(lang, activity.id);
      if (!result.ok) {
        toast.error(d.errors[result.messageKey] ?? d.errors.unknown);
        return;
      }
      toast.success(d.published);
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="outline" size="xs" aria-label={`${d.publish} ${activity.title}`} />}
      >
        <Send className="size-3.5" aria-hidden />
        {d.publish}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{d.publishConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {d.publishConfirmDescription.replace("{title}", activity.title)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{d.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handlePublish}>{d.confirmPublish}</AlertDialogAction>
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{e.title}</p>
                        {/* Only staff can see a draft at all — the 0068 SELECT
                            policies hide them from everyone else — so this badge
                            needs no role check of its own. */}
                        {e.publishStatus === "draft" ? (
                          <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                            {d.draftBadge}
                          </span>
                        ) : null}
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 items-center gap-1">
                          {e.publishStatus === "draft" ? (
                            <PublishActivityTrigger activity={e} lang={lang} dict={dict} />
                          ) : null}
                          <Button
                            variant="ghost"
                            size="xs"
                            aria-label={`${d.edit} ${e.title}`}
                            onClick={() => setEditing(e)}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                            {d.edit}
                          </Button>
                          <ActivityDeleteDialog
                            activityId={e.id}
                            title={e.title}
                            size="xs"
                            lang={lang}
                            dict={dict}
                          />
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
