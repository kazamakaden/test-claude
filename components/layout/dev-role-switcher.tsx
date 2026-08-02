"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Role } from "@/types/auth";
import { roles } from "@/types/auth";
import type { Dictionary } from "@/types/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function setDevRoleCookie(role: Role) {
  document.cookie = `dev_role=${role}; path=/; max-age=31536000; samesite=lax`;
}

export function DevRoleSwitcher({
  role,
  dict,
}: {
  role: Role;
  dict: Pick<Dictionary, "common" | "roles">;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (process.env.NODE_ENV !== "development" || isSupabaseConfigured) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <label htmlFor="dev-role" className="text-muted-foreground">
        {dict.common.devRole}
      </label>
      <select
        id="dev-role"
        className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        value={role}
        disabled={isPending}
        onChange={(event) => {
          setDevRoleCookie(event.target.value as Role);
          startTransition(() => router.refresh());
        }}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {dict.roles[r]}
          </option>
        ))}
      </select>
    </div>
  );
}
