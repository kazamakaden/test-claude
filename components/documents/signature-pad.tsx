"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  getDataUrl: () => string | null;
}

/** Thin wrapper around react-signature-canvas — draw, clear, read out as a data URL. */
export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const padRef = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      clear: () => padRef.current?.clear(),
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      getDataUrl: () => {
        if (!padRef.current || padRef.current.isEmpty()) return null;
        return padRef.current.getTrimmedCanvas().toDataURL("image/png");
      },
    }));

    return (
      <SignatureCanvas
        ref={padRef}
        penColor="black"
        canvasProps={{
          className: className ?? "h-48 w-full rounded-lg border border-input bg-white",
          "aria-label": "signature-pad",
        }}
      />
    );
  }
);
