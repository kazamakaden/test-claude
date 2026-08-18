import "server-only";
import { interpolate } from "@/lib/i18n/interpolate";
import { TOKEN_TTL_MS } from "@/lib/password-tokens";
import type { MailMessage } from "@/lib/mailer";
import type { Dictionary } from "@/types/i18n";

/**
 * The password-setup email's body, in the recipient's language.
 *
 * Text is a dictionary lookup (auth.email.*) rather than a literal, for the
 * same reason 0036's notifications store a message_key instead of a rendered
 * sentence: this project is Thai-primary with an English toggle, and a
 * sentence baked in at one place is wrong for half the audience.
 *
 * Every message is sent as BOTH text/plain and text/html. Not politeness —
 * a Gmail-sent HTML-only message is markedly more likely to be filed as
 * spam, and some college mail clients still render plain text only.
 */

/**
 * Escapes the five characters that can break out of HTML text or an
 * attribute value.
 *
 * React does this automatically everywhere else in this app; an email body
 * is a raw string we assemble ourselves, so it is the one place in the
 * codebase where escaping is our job. The interpolated values here are our
 * own URL and the recipient's own address — not attacker-controlled in any
 * path that reaches this function — but escaping unconditionally is what
 * keeps that true after the next edit.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildPasswordLinkEmail({
  to,
  link,
  dict,
}: {
  to: string;
  link: string;
  dict: Dictionary;
}): MailMessage {
  const d = dict.auth.email;
  const minutes = String(Math.round(TOKEN_TTL_MS / 60000));
  const intro = interpolate(d.intro, { email: to });
  const expiry = interpolate(d.expiry, { minutes });

  const text = [
    d.heading,
    "",
    intro,
    "",
    link,
    "",
    expiry,
    d.ignore,
    "",
    "— " + d.signature,
  ].join("\n");

  // Inline styles only, and a table-free single-column layout: email clients
  // strip <style> blocks and support flex/grid inconsistently. Colours are
  // the §3 steel-navy palette's literal values — CSS custom properties do
  // not exist in an email.
  const html = `<!doctype html>
<html lang="th">
<body style="margin:0;padding:24px;background:#F6F8FA;font-family:'IBM Plex Sans Thai',-apple-system,Segoe UI,sans-serif;color:#0C121C;line-height:1.7;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE3EA;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1F4A75;">${escapeHtml(d.heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;">${escapeHtml(intro)}</p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#1F4A75;color:#FFFFFF;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(d.cta)}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;color:#5A6B80;">${escapeHtml(expiry)}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#5A6B80;">${escapeHtml(d.fallback)}</p>
    <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${escapeHtml(link)}" style="color:#1F4A75;">${escapeHtml(link)}</a></p>
    <p style="margin:0 0 24px;font-size:13px;color:#5A6B80;">${escapeHtml(d.ignore)}</p>
    <hr style="border:none;border-top:1px solid #DDE3EA;margin:0 0 16px;">
    <p style="margin:0;font-size:12px;color:#5A6B80;">${escapeHtml(d.signature)}</p>
  </div>
</body>
</html>`;

  return { to, subject: d.subject, text, html };
}
