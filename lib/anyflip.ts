/**
 * §12 document workflow, e-book/flipbook extension. Single source of truth
 * for what counts as a valid AnyFlip embed URL — imported by
 * schemas/documents.ts (write-time validation) and
 * components/documents/flipbook-viewer.tsx (the last line of defense before
 * a value is ever placed in an iframe src). Mirrors lib/turnstile.ts's shape:
 * a small pure module, no server-only, since both a Zod schema and a Client
 * Component need it.
 */
export const ANYFLIP_URL_PATTERN =
  /^https:\/\/(www\.)?anyflip\.com\/([a-z0-9]+)\/([a-z0-9]+)\/?$/i;

export function isAnyFlipEmbedUrl(url: string): boolean {
  return ANYFLIP_URL_PATTERN.test(url);
}

/**
 * Normalizes a valid AnyFlip URL to the canonical https://anyflip.com/x/y/
 * form the embed iframe expects, regardless of how it was pasted (www.,
 * missing trailing slash, mixed case host). Returns null for anything that
 * fails the same allow-list isAnyFlipEmbedUrl checks — callers must treat a
 * null the same as "no book attached", never fall back to the raw input.
 */
export function toAnyFlipEmbedUrl(url: string): string | null {
  const match = ANYFLIP_URL_PATTERN.exec(url);
  if (!match) return null;
  const [, , user, book] = match;
  return `https://anyflip.com/${user}/${book}/`;
}
