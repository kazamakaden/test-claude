"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { recordAttendanceAction, type RecordAttendanceResult } from "@/actions/attendance";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const CONFIRM_TEXT_TH = "ยืนยัน";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * §13 confirm step. The GPS reading is collected here because only the browser
 * can produce one — but it is *evidence submitted for checking*, not a
 * decision: record_attendance() (0056) computes the haversine distance against
 * the session's own centre server-side and refuses out-of-range submissions
 * whatever this component sends. Editing the hidden fields buys nothing.
 *
 * Geolocation is requested up front rather than on submit, so a student who has
 * to grant permission does it while reading the page instead of watching a
 * spinner after tapping the button.
 */
export function AttendanceConfirmForm({
  token,
  lang,
  dict,
}: {
  token: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.attendance;
  const [confirmText, setConfirmText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "granted" | "denied">("idle");
  const [state, formAction] = useActionState<RecordAttendanceResult | null, FormData>(
    recordAttendanceAction,
    null
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeoState("denied");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("granted");
      },
      // Not a hard failure: an unfenced session needs no location at all, and
      // the server is what decides. Submitting without coordinates yields
      // `gps_required` only if the session actually has a fence.
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  if (state?.ok) {
    const recorded = state.outcome === "recorded";
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
        <h2 className="font-heading text-lg font-semibold text-foreground">
          {recorded ? d.recordedTitle : d.alreadyTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {recorded ? d.recordedDescription : d.alreadyDescription}
        </p>
        {/* buttonVariants on the Link, not <Button asChild>: this project's
            Button is Base UI's, which has no asChild -- alert-dialog.tsx uses
            the same approach. */}
        <Link href={`/${lang}/calendar`} className={buttonVariants({ variant: "outline" })}>
          {d.backToCalendar}
        </Link>
      </div>
    );
  }

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="token" value={token} />
      {coords ? (
        <>
          <input type="hidden" name="gpsLat" value={coords.lat} />
          <input type="hidden" name="gpsLng" value={coords.lng} />
        </>
      ) : null}
      {/* §15 duplicate-detection signal only. Deliberately coarse — a real
          fingerprinting library would collect far more than this feature
          needs, and the value is never an authorisation input. */}
      <input
        type="hidden"
        name="fingerprint"
        value={typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : ""}
      />

      <h2 className="font-heading text-base font-semibold text-foreground">{d.confirmTitle}</h2>
      <p className="text-sm text-muted-foreground">{d.confirmInstructions}</p>

      {geoState === "locating" ? (
        <p className="text-sm text-muted-foreground">{d.locating}</p>
      ) : null}
      {geoState === "denied" ? (
        <p className="text-sm text-muted-foreground">{d.locationNeeded}</p>
      ) : null}

      <FormField name="confirm" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.confirmLabel}</FormLabel>
        <Input
          name="confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={d.confirmPlaceholder}
          autoComplete="off"
        />
        {errorMessage ? <FormError>{errorMessage}</FormError> : null}
      </FormField>

      {/* Disabled until the word matches, so a mis-scan cannot record
          attendance with one stray tap. The server re-checks the literal
          anyway (schemas/attendance.ts), so this is UX, not enforcement. */}
      <fieldset disabled={confirmText.trim() !== CONFIRM_TEXT_TH} className="contents">
        <SubmitButton label={d.submit} pendingLabel={d.submitting} />
      </fieldset>
    </form>
  );
}
