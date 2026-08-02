import { z } from "zod";

const PERSONAL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
const ORG_DOMAIN = "udontech.ac.th";

/**
 * Shared by the login form (client) and the signIn Server Action (server) —
 * §30.5 requires both to validate with the same schema. Message values are
 * dictionary keys (auth.errors.*), not literal strings, so the Server Action
 * can localize with the caller's lang.
 */
export const loginSchema = z.object({
  email: z
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
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
