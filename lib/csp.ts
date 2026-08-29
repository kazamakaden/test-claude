/**
 * Content-Security-Policy (§19).
 *
 * Ships as TWO headers, deliberately:
 *
 * 1. `Content-Security-Policy` — an ENFORCED subset containing only
 *    directives whose correctness can be established without loading a
 *    third-party host.
 * 2. `Content-Security-Policy-Report-Only` — the full strict policy,
 *    observed but not enforced.
 *
 * The split exists because the riskiest allow-list — Cloudflare Turnstile
 * on the login form — cannot be verified from the build/dev environment:
 * the host is unreachable there, so a wrong entry looks identical to a
 * correct one until it reaches production and silently kills login. This
 * project has already lost sign-in once to a hostname allow-list (Turnstile
 * error 110200 on a second Vercel domain); doing that again with a CSP
 * would be worse, because a blocked script produces no server-side signal
 * at all.
 *
 * FlipHTML5 used to be the second such allow-list. Migration 0053 removed
 * that integration entirely — books are plain PDFs opened in a new tab now
 * — so both its frame-src entries are gone, and with the inline <object>
 * viewer gone too, object-src is 'none' in both policies.
 *
 * So the enforced half buys the wins that are free and immediate —
 * clickjacking, <base> injection, form exfiltration — while the half that
 * could break a page is watched first. Promote the report-only policy to
 * enforced once real traffic shows it clean; see the CSP section of README.
 */

/** Where Supabase REST, Realtime and Storage live for this deployment. */
function supabaseOrigin(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "https://*.supabase.co";
  try {
    return new URL(url).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

function supabaseWebsocket(): string {
  return supabaseOrigin().replace(/^https:/, "wss:");
}

/**
 * Enforced now. Every directive here is either self-contained or was checked
 * against actual usage in this repo:
 *
 * - `object-src 'none'` — the usual hardening default, and now actually
 *   reachable. It used to be relaxed to allow Supabase Storage because
 *   components/books/pdf-viewer.tsx embedded the PDF in an `<object>`;
 *   that component is gone (0053) and the PDF opens in its own tab, so
 *   nothing on any page needs a plugin/object source.
 * - `form-action 'self'` is safe for Google sign-in: that path is a 302
 *   redirect issued by Supabase, not a cross-origin form POST.
 * - `frame-ancestors 'none'` — nothing embeds this app.
 * - `base-uri 'none'` — no <base> tag anywhere.
 */
export function enforcedCsp(): string {
  return [
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Observed only, for now.
 *
 * `script-src` carries 'unsafe-inline': Next.js App Router injects inline
 * hydration scripts, and the alternative — a per-request nonce from
 * middleware — opts every page out of static generation, which this app
 * relies on for 54 prerendered routes. Stated plainly rather than dressed
 * up: with 'unsafe-inline' this policy restricts *where code and data may
 * come from*; it does not stop injected inline script. It is defence in
 * depth on top of React's escaping (and the repo has no
 * dangerouslySetInnerHTML/eval), not a substitute for it.
 *
 * `style-src` needs 'unsafe-inline' unconditionally — React renders the
 * `style` prop as an inline attribute, which book-cover.tsx and
 * global-error.tsx both rely on.
 */
export function reportOnlyCsp(isDev: boolean): string {
  const supabase = supabaseOrigin();
  const ws = supabaseWebsocket();

  return [
    "default-src 'self'",
    // 'unsafe-eval' only in dev: the dev server's React Refresh needs it,
    // production never should.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    // data:/blob: cover the signature canvas (toDataURL) and generated
    // previews; googleusercontent is the avatar a Google sign-in brings with
    // it (components/layout/user-menu.tsx renders it directly).
    `img-src 'self' data: blob: ${supabase} https://*.googleusercontent.com`,
    "font-src 'self' data:",
    // wss: is not optional — 0035's realtime calendar subscription opens a
    // WebSocket, and connect-src governs it.
    `connect-src 'self' ${supabase} ${ws}`,
    "frame-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    // public/sw.js
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
