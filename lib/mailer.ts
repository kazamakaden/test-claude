import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outbound email (§16), replacing Supabase Auth's own sender for the
 * password-setup / password-reset link.
 *
 * `server-only`: SMTP_PASSWORD is a Google App Password. It must never be
 * reachable from a module the client bundle pulls in — Next.js would replace
 * a non-NEXT_PUBLIC_ value with undefined rather than leak it, but a
 * build-tool guarantee is the wrong thing to rely on for a credential.
 * Same reasoning as lib/push-server.ts.
 */
const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT ?? "465");
const user = process.env.SMTP_USER ?? "";
const password = process.env.SMTP_PASSWORD ?? "";

/**
 * The envelope sender. Gmail rewrites (or rejects) a From that is neither
 * the authenticated account nor one of its verified "Send mail as" aliases,
 * so this is not free text — see docs/email-setup.md.
 */
const from = process.env.SMTP_FROM ?? "";

/**
 * Same "hide rather than half-enable" shape as isPushSendConfigured /
 * isTurnstileConfigured / isSupabaseAdminConfigured. A deployment without
 * these does not crash; it declines to send and says so in the server log,
 * while the caller still returns its uniform response.
 */
export const isMailerConfigured = Boolean(user && password && from);

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * A NEW, unpooled transport per send.
 *
 * Unpooled is nodemailer's default, so this is an absence rather than a
 * setting — but it is a deliberate absence. Pooling is worse than useless on
 * Vercel: each invocation is a fresh process, so a pool never gets a second
 * send to amortise over, and a long-lived socket in a function about to be
 * frozen is a leak. On the self-hosted target the cost is one TLS handshake
 * per password reset, which is nothing at this volume.
 *
 * Port 465 with secure:true is implicit TLS. 587/STARTTLS also works with
 * Gmail, so `secure` is derived from the port rather than hard-coded —
 * setting secure:true on 587 hangs until timeout, which looks exactly like
 * "the network is blocking us".
 *
 * Note @types/nodemailer is still 8.x while the runtime is 9.x; 9.0.0's only
 * breaking change is stricter TLS validation when fetching remote attachment
 * content, which this app never does.
 */
function createTransport(): Transporter {
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });
}

/**
 * Returns true only when the SMTP server actually accepted the message.
 *
 * Never throws: every caller of this is an action whose response must not
 * vary with the outcome (the account-enumeration guard in
 * requestPasswordReset returns {ok:true} whether or not an address exists,
 * and an SMTP failure must not become a side channel that distinguishes
 * them). The failure is logged instead, because "no email arrived" is
 * otherwise indistinguishable from a wrong App Password — see
 * docs/email-setup.md, which points at this log line.
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  if (!isMailerConfigured) {
    console.error(
      "[mailer] SMTP is not configured (SMTP_USER / SMTP_PASSWORD / SMTP_FROM) — message not sent."
    );
    return false;
  }

  try {
    const transport = createTransport();
    await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return true;
  } catch (error) {
    console.error("[mailer] send failed:", error instanceof Error ? error.message : error);
    return false;
  }
}
