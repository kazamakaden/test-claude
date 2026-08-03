/**
 * §12 document workflow, e-book/flipbook extension. Single source of truth
 * for what counts as a valid FlipHTML5 embed URL — imported by
 * schemas/documents.ts (write-time validation) and
 * components/documents/flipbook-viewer.tsx (the last line of defense before
 * a value is ever placed in an iframe src). Mirrors lib/turnstile.ts's shape:
 * a small pure module, no server-only, since both a Zod schema and a Client
 * Component need it.
 *
 * Replaces lib/anyflip.ts (see CLAUDE.md §0 for the host switch). FlipHTML5
 * serves the reader on a different host (online.fliphtml5.com) than the
 * share link a person actually copies out of their dashboard
 * (fliphtml5.com) — both are accepted here, but always normalized to the
 * reader host. The path segments allow a wider charset than AnyFlip's did
 * (letters, digits, underscore, hyphen, 4-40 chars) because FlipHTML5 lets
 * an account customize its book link to that shape.
 */
export const FLIPHTML5_URL_PATTERN =
  /^https:\/\/(www\.|online\.)?fliphtml5\.com\/([a-z0-9_-]{1,40})\/([a-z0-9_-]{1,40})\/?$/i;

export function isFlipHtml5EmbedUrl(url: string): boolean {
  return FLIPHTML5_URL_PATTERN.test(url);
}

/**
 * Normalizes a valid FlipHTML5 URL to the canonical
 * https://online.fliphtml5.com/x/y/ embed form, regardless of how it was
 * pasted (bare fliphtml5.com share link, www., missing trailing slash,
 * mixed case host). Returns null for anything that fails the same
 * allow-list isFlipHtml5EmbedUrl checks — callers must treat a null the
 * same as "no book attached", never fall back to the raw input.
 */
export function toFlipHtml5EmbedUrl(url: string): string | null {
  const match = FLIPHTML5_URL_PATTERN.exec(url);
  if (!match) return null;
  const [, , user, book] = match;
  return `https://online.fliphtml5.com/${user}/${book}/`;
}
