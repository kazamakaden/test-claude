import { z } from "zod";

const PERSONAL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
const ORG_DOMAIN = "udontech.ac.th";

/**
 * Shared by every auth form (client) and its matching Server Action
 * (server) — §30.5 requires both to validate with the same schema. Message
 * values are dictionary keys (auth.errors.*), not literal strings, so a
 * Server Action can localize with the caller's lang.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "invalidEmail" }))
  .superRefine((email, ctx) => {
    if (email.endsWith(`@${ORG_DOMAIN}`)) return;

    const domain = email.split("@")[1];
    if (domain && PERSONAL_DOMAINS.includes(domain)) {
      ctx.addIssue({ code: "custom", message: "personalDomain" });
      return;
    }

    ctx.addIssue({ code: "custom", message: "wrongDomain" });
  });

/**
 * Sign-in deliberately carries no strength rules — an account created
 * before a policy change must still be able to log in with whatever
 * password it already has.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "passwordRequired" }),
});
export type SignInInput = z.infer<typeof signInSchema>;

// GoTrue hashes with bcrypt, which silently truncates past 72 bytes — the
// max is real, not arbitrary.
const newPasswordField = z
  .string()
  .min(8, { message: "passwordTooShort" })
  .max(72, { message: "passwordTooLong" });

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const resetRequestSchema = z.object({
  email: emailSchema,
});
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

export const newPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwordMismatch",
    path: ["confirmPassword"],
  });
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
