"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormField, FormLabel, FormDescription, FormError } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/types/i18n";

type PasswordRuleKey =
  | "passwordRuleLength"
  | "passwordRuleUppercase"
  | "passwordRuleLowercase"
  | "passwordRuleSymbol";

const RULES: { test: (value: string) => boolean; labelKey: PasswordRuleKey }[] = [
  { test: (value) => value.length >= 8, labelKey: "passwordRuleLength" },
  { test: (value) => /[A-Z]/.test(value), labelKey: "passwordRuleUppercase" },
  { test: (value) => /[a-z]/.test(value), labelKey: "passwordRuleLowercase" },
  { test: (value) => /[^A-Za-z0-9]/.test(value), labelKey: "passwordRuleSymbol" },
];

/**
 * §7: live client-side feedback for the upper/lower/symbol/length rule that
 * schemas/auth.ts's newPasswordField enforces server-side — this is UX
 * only, the schema is the actual enforcement. Keeps `required`/`minLength`/
 * `autoComplete="new-password"` on a real <input name>, so the JS-disabled
 * submission path (§30.9) still posts a real value and still gets rejected
 * server-side with a real error if it doesn't qualify.
 */
export function PasswordStrengthField({
  name = "password",
  label,
  invalid = false,
  errorMessage,
  dict,
}: {
  name?: string;
  label: string;
  /** Drives the red-ring styling independently of whether errorMessage text renders here. */
  invalid?: boolean;
  errorMessage?: string;
  dict: Dictionary;
}) {
  const [value, setValue] = useState("");
  const d = dict.auth;

  return (
    <FormField name={name} invalid={invalid}>
      <FormLabel>{label}</FormLabel>
      <Input
        name={name}
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <FormDescription render={<div />}>
        <p className="text-xs text-muted-foreground">{d.passwordRulesLabel}</p>
        <ul aria-live="polite" className="mt-1 flex flex-col gap-0.5">
          {RULES.map((rule) => {
            const met = rule.test(value);
            const Icon = met ? Check : X;
            return (
              <li
                key={rule.labelKey}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  met ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {d[rule.labelKey]}
              </li>
            );
          })}
        </ul>
      </FormDescription>
      <FormError>{errorMessage}</FormError>
    </FormField>
  );
}
