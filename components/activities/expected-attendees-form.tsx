"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setExpectedAttendeesAction } from "@/actions/activity-detail";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Sets the denominator of the attendance percentage.
 *
 * There is no enrolment table in this schema, so the number of people expected
 * at an event is something the owner states -- see AttendanceSummary for why a
 * derived denominator would make the figure always 100%. Until this control
 * existed the column was unsettable through the UI, so the percentage never
 * rendered for any activity and the summary always showed its `noExpected`
 * branch.
 *
 * Blank clears it (the schema maps "" to null), which is why the field is not
 * `required`: removing an expectation is as legitimate as setting one, and
 * makes the summary fall back to the plain checked-in count.
 */
export function ExpectedAttendeesForm({
  activityId,
  expected,
  lang,
  dict,
}: {
  activityId: string;
  expected: number | null;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities.dashboard;
  const errors = dict.activities.detailErrors;
  const router = useRouter();
  const [value, setValue] = useState(expected === null ? "" : String(expected));
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await setExpectedAttendeesAction(lang, activityId, value.trim());
      if (result.ok) {
        router.refresh();
        return;
      }
      const key = result.messageKey as keyof typeof errors;
      toast.error(errors[key] ?? errors.unknown);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="expected-attendees" className="text-xs font-medium text-foreground">
          {d.expectedLabel}
        </label>
        <Input
          id="expected-attendees"
          name="expectedAttendees"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-32"
          aria-describedby="expected-attendees-hint"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {d.save}
      </Button>
      <p id="expected-attendees-hint" className="w-full text-xs text-muted-foreground">
        {d.expectedHint}
      </p>
    </form>
  );
}
