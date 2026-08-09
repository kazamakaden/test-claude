import { z } from "zod";

/**
 * Task 5 web push subscribe/unsubscribe. Caps mirror the SQL CHECKs in
 * 0033_push_subscriptions.sql.
 */
export const savePushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url({ message: "invalidEndpoint" })
    .refine((v) => v.startsWith("https://"), { message: "invalidEndpoint" })
    .pipe(z.string().max(2000, { message: "invalidEndpoint" })),
  p256dhKey: z.string().trim().min(1).max(255, { message: "invalidKeys" }),
  authKey: z.string().trim().min(1).max(255, { message: "invalidKeys" }),
  userAgent: z.string().trim().max(500).nullable().catch(null),
});
export type SavePushSubscriptionInput = z.infer<typeof savePushSubscriptionSchema>;

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url({ message: "invalidEndpoint" }),
});
