import "server-only";
import crypto from "node:crypto";

/**
 * Token rules for the self-issued password-setup / reset link (0064).
 *
 * Pure functions and constants only — no database, no transport — so the
 * SQL matrix, the mailer check and the route can each exercise the parts
 * they care about without dragging the others in.
 */

/**
 * 60 minutes. Long enough to survive "I'll do it when I get home", short
 * enough that a link sitting in an inbox is not a standing key to the
 * account. Supabase's own recovery links default to the same hour.
 */
export const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * The handoff cookie's life, deliberately much shorter than the token's:
 * it only has to survive one redirect and the seconds it takes to type a
 * password.
 */
export const HANDOFF_COOKIE_MAX_AGE_S = 15 * 60;
export const HANDOFF_COOKIE_NAME = "pw_setup";

/** At most 3 links per account per 15 minutes. */
export const MINT_WINDOW_MS = 15 * 60 * 1000;
export const MINT_LIMIT = 3;

/**
 * 32 bytes from the CSPRNG, base64url so it survives a URL, a query string
 * and an email client's line-wrapping without escaping.
 *
 * 256 bits of entropy is why there is no rate limit on *guessing* a token
 * anywhere in this design — only on *minting* one. Guessing is not a threat
 * model at this size; being able to make the server email arbitrary college
 * addresses on demand is, which is what the mint throttle and Turnstile
 * address.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Lowercase hex sha256 — the exact shape 0064's CHECK constraint enforces.
 *
 * A single fast hash is correct here, unlike for a password: the input is
 * 256 bits of uniform randomness, so there is no dictionary to attack and
 * nothing for a slow KDF to buy. What it does buy is that the table holds
 * no usable credential.
 *
 * No constant-time comparison anywhere in this flow, and that is not an
 * oversight: the token is never compared in application code. It is looked
 * up by indexed equality inside Postgres, which leaks nothing an attacker
 * could walk a byte at a time the way a naive memcmp would. (lib/push-server.ts
 * does need timingSafeEqual — there the secret is compared in Node.)
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * A token is only ever accepted through this shape check first, so a
 * garbage or oversized query param never reaches the database at all.
 */
export function isWellFormedToken(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
