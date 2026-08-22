"use client";

import { useId, useState } from "react";

/**
 * A 24-hour time field.
 *
 * `<input type="time">` cannot be forced to 24-hour: Chrome renders it from the
 * BROWSER's language, ignoring the page's `lang`, so a Thai page viewed in an
 * English-language browser shows an AM/PM picker. Nothing in this codebase
 * formats time as AM/PM — every `format()` call is already `HH:mm` — so the
 * picker was the only place it appeared, and no attribute or stylesheet fixes
 * it. Hence an input we control.
 *
 * Two native `<select>`s rather than a custom popover: they keep the OS picker
 * on mobile, need no JavaScript to be usable, and cannot produce an invalid
 * time. Minutes are 0-59, not 5-minute steps, so no existing activity time
 * becomes unselectable.
 *
 * The hidden input preserves the form contract — `name` still submits `HH:mm`,
 * so actions/activities.ts and the Zod schema are untouched.
 */
export function TimeInput({
  name,
  defaultValue,
  required,
  hourLabel,
  minuteLabel,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  hourLabel: string;
  minuteLabel: string;
}) {
  const id = useId();
  const [hour, minute] = splitTime(defaultValue);
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  // Empty stays empty: end time is optional, and submitting "00:00" for a blank
  // field would silently invent midnight.
  const value = h && m ? `${h}:${m}` : "";

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label={hourLabel}
        id={`${id}-h`}
        value={h}
        onChange={(event) => setH(event.target.value)}
        required={required}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">--</option>
        {range(24).map((n) => (
          <option key={n} value={pad(n)}>
            {pad(n)}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-muted-foreground">
        :
      </span>
      <select
        aria-label={minuteLabel}
        id={`${id}-m`}
        value={m}
        onChange={(event) => setM(event.target.value)}
        required={required}
        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">--</option>
        {range(60).map((n) => (
          <option key={n} value={pad(n)}>
            {pad(n)}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function splitTime(value: string | undefined): [string, string] {
  if (!value) return ["", ""];
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? [match[1], match[2]] : ["", ""];
}
