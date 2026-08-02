"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revokeAccount } from "@/actions/approvals";
import type { Locale } from "@/lib/i18n/config";

export function RevokeAccountButton({
  id,
  lang,
  label,
}: {
  id: string;
  lang: Locale;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => revokeAccount(id, lang))}
    >
      <X className="size-4" aria-hidden />
      {label}
    </Button>
  );
}
