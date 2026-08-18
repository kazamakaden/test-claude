"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeAttendanceAction } from "@/actions/attendance";
import type { AttendanceMethod } from "@/types/attendance";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

/**
 * Remove control, rendered for MANUAL rows only.
 *
 * This mirrors remove_manual_attendance() (0062), which refuses a qr row with
 * 'qr_verified_not_removable' -- a scan is evidence the student was physically
 * present, and staff cannot quietly erase it. Hiding the button for qr rows
 * keeps the UI honest about a rule the database enforces anyway; the note in
 * the panel explains why, so its absence does not read as a bug.
 */
export function AttendeeRowActions({
  activityId,
  studentId,
  studentName,
  method,
  lang,
  dict,
}: {
  activityId: string;
  studentId: string;
  studentName: string | null;
  method: AttendanceMethod;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.activities.attendees;
  const errors = dict.activities.detailErrors;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (method !== "manual") return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      // Visible text stays a prefix of the accessible name (WCAG 2.5.3).
      aria-label={`${d.remove} ${studentName ?? ""}`.trim()}
      onClick={() => {
        if (!window.confirm(d.removeConfirm)) return;
        startTransition(async () => {
          const result = await removeAttendanceAction(lang, activityId, studentId);
          if (!result.ok) {
            toast.error(errors[result.messageKey as keyof typeof errors] ?? errors.unknown);
            return;
          }
          if (result.outcome === "qr_verified_not_removable") {
            toast.error(errors.qr_verified_not_removable);
            return;
          }
          router.refresh();
        });
      }}
    >
      <Trash2 aria-hidden className="mr-1 size-3.5" />
      {d.remove}
    </Button>
  );
}
