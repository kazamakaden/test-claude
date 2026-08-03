"use client";

import { useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitDocument } from "@/actions/documents";
import type { Locale } from "@/lib/i18n/config";

export function SubmitDocumentButton({ id, lang, label }: { id: string; lang: Locale; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button disabled={isPending} onClick={() => startTransition(() => submitDocument(id, lang))}>
      <Send className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
