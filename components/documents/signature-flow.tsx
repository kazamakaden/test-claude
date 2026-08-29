"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormError } from "@/components/ui/form";
import { SignaturePad, type SignaturePadHandle } from "@/components/documents/signature-pad";
import { signDocumentAction, type SignDocumentResult } from "@/actions/documents";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/types/i18n";

const CONFIRM_TEXT_TH = "ยืนยัน";

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** §17: Open draft -> Sign -> Preview -> Confirm -> type "ยืนยัน" -> Save, as one continuous flow. */
export function SignatureFlow({
  documentId,
  lang,
  dict,
}: {
  documentId: string;
  lang: Locale;
  dict: Dictionary;
}) {
  const d = dict.documents.manage.sign;
  const padRef = useRef<SignaturePadHandle>(null);
  const [step, setStep] = useState<"draw" | "preview" | "confirm">("draw");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [drawError, setDrawError] = useState<string | null>(null);
  const [state, formAction] = useActionState<SignDocumentResult | null, FormData>(
    signDocumentAction,
    null
  );

  const errorMessage = state && !state.ok ? d.errors[state.messageKey] : undefined;

  useEffect(() => {
    if (errorMessage) toast.error(errorMessage);
  }, [errorMessage]);

  const goToPreview = () => {
    const url = padRef.current?.getDataUrl() ?? null;
    if (!url) {
      setDrawError(d.errors.signatureRequired);
      return;
    }
    setDrawError(null);
    setDataUrl(url);
    setStep("preview");
  };

  if (step === "draw") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-foreground">{d.title}</h2>
        <p className="text-sm text-muted-foreground">{d.drawInstructions}</p>
        <SignaturePad ref={padRef} />
        {drawError ? <p className="text-sm text-destructive">{drawError}</p> : null}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => padRef.current?.clear()}>
            {d.clear}
          </Button>
          <Button onClick={goToPreview}>{d.previewTitle}</Button>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-base font-semibold text-foreground">{d.previewTitle}</h2>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a locally-drawn signature data URL, not a remote image
          <img
            src={dataUrl}
            alt={d.previewTitle}
            className="h-48 w-full rounded-lg border border-input bg-white object-contain"
          />
        ) : null}
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setStep("draw")}>
            {d.back}
          </Button>
          <Button onClick={() => setStep("confirm")}>{d.confirmLabel}</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="signatureData" value={dataUrl ?? ""} readOnly />

      <h2 className="font-heading text-base font-semibold text-foreground">{d.confirmLabel}</h2>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a locally-drawn signature data URL, not a remote image
        <img
          src={dataUrl}
          alt={d.previewTitle}
          className="h-32 w-full rounded-lg border border-input bg-white object-contain"
        />
      ) : null}

      <FormField name="confirmText" invalid={Boolean(errorMessage)}>
        <FormLabel>{d.confirmPlaceholder}</FormLabel>
        <Input
          name="confirmText"
          required
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_TEXT_TH}
        />
        <FormError>{errorMessage}</FormError>
      </FormField>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setStep("preview")}>
          {d.back}
        </Button>
        <SaveButton label={d.save} pendingLabel={d.saving} />
      </div>
    </form>
  );
}
