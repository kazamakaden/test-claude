"use client";

import { useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitProject } from "@/actions/projects";
import type { Locale } from "@/lib/i18n/config";

export function SubmitProjectButton({ id, lang, label }: { id: string; lang: Locale; label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button disabled={isPending} onClick={() => startTransition(() => submitProject(id, lang))}>
      <Send className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
