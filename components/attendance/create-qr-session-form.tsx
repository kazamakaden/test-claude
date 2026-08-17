"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel } from "@/components/ui/form";
import { createQrSessionAction, type CreateQrSessionResult } from "@/actions/attendance";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * §13 "Admin creates dynamic QR sessions": Event ID, Expiration, GPS radius.
 *
 * The GPS fence is optional and all-or-nothing — an activity held online or
 * off-site should not be forced to invent coordinates, but a radius with no
 * centre would be a fence that silently checks nothing. The action rejects a
 * half-filled fence with its own message, and qr_sessions_gps_all_or_nothing
 * (0056) is the database backstop behind it.
 */
export function CreateQrSessionForm({
  activityId,
  lang,
  dict,
}: {
  activityId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.attendance.qr;
  const [state, formAction] = useActionState<CreateQrSessionResult | null, FormData>(
    createQrSessionAction,
    null
  );
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });

  useEffect(() => {
    if (state && !state.ok) toast.error(d.errors[state.messageKey]);
  }, [state, d]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="activityId" value={activityId} />

      <p className="text-sm text-muted-foreground">{d.noSession}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="expiresInMinutes">
          <FormLabel>{d.expiresInMinutesLabel}</FormLabel>
          <Input name="expiresInMinutes" type="number" min={5} max={1440} defaultValue={120} />
        </FormField>
        <FormField name="rotationSeconds">
          <FormLabel>{d.rotationSecondsLabel}</FormLabel>
          <Input name="rotationSeconds" type="number" min={10} max={300} defaultValue={30} />
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium text-foreground">{d.fenceLegend}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField name="gpsLat">
            <FormLabel>{d.gpsLatLabel}</FormLabel>
            <Input
              name="gpsLat"
              inputMode="decimal"
              value={coords.lat}
              onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))}
            />
          </FormField>
          <FormField name="gpsLng">
            <FormLabel>{d.gpsLngLabel}</FormLabel>
            <Input
              name="gpsLng"
              inputMode="decimal"
              value={coords.lng}
              onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))}
            />
          </FormField>
          <FormField name="radiusMetres">
            <FormLabel>{d.radiusLabel}</FormLabel>
            <Input name="radiusMetres" type="number" min={10} max={10000} />
          </FormField>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((pos) =>
                setCoords({
                  lat: pos.coords.latitude.toFixed(6),
                  lng: pos.coords.longitude.toFixed(6),
                })
              )
            }
          >
            {d.useMyLocation}
          </Button>
        </div>
      </fieldset>

      <div>
        <SubmitButton label={d.create} pendingLabel={d.creating} />
      </div>
    </form>
  );
}
