/**
 * §14 เลขบัตรประชาชน (Thai national ID).
 *
 * Deliberately dependency-free and isomorphic, the same shape as
 * lib/student-id.ts: one implementation used by the client form, the Server
 * Action and any future importer, so the rule cannot drift between them.
 *
 * The DATABASE checks the shape only — `profiles_citizen_id_format` (0075) is
 * `^[0-9]{13}$`. The CHECK DIGIT is checked here rather than in SQL, because a
 * digit-by-digit mod-11 expression in a CHECK constraint is unreadable and hard
 * to correct later. Shape is the backstop; this is the rule.
 *
 * That split matters more than usual for this column: `prevent_citizen_id_change`
 * (0003) lets the owner set it exactly ONCE and then only an admin may change
 * it, so a typo that passes validation is expensive to undo.
 */

const DIGITS = 13;

/** Digits only, so a value typed as `1-2345-67890-12-3` still validates. */
export function normalizeCitizenId(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * The official mod-11 check digit: each of the first 12 digits is weighted by
 * its distance from the end (13 down to 2), and the last digit must close the
 * sum. A number that is 13 digits but mistyped fails here, which is the whole
 * point of checking it at all.
 */
export function isValidCitizenId(value: string): boolean {
  const digits = normalizeCitizenId(value);
  if (digits.length !== DIGITS) return false;

  let sum = 0;
  for (let i = 0; i < DIGITS - 1; i += 1) {
    sum += Number(digits[i]) * (DIGITS - i);
  }

  return (11 - (sum % 11)) % 10 === Number(digits[DIGITS - 1]);
}

/** `1-2345-67890-12-3`, the grouping printed on the card itself. */
export function formatCitizenId(value: string): string {
  const d = normalizeCitizenId(value);
  if (d.length !== DIGITS) return value;
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}

/**
 * Everything but the last four digits, for anywhere the full number is more
 * than the reader needs. Not a security boundary — the boundary is 0005's
 * column grant and get_citizen_id()'s own check; this is only restraint about
 * what gets rendered.
 */
export function maskCitizenId(value: string): string {
  const d = normalizeCitizenId(value);
  if (d.length !== DIGITS) return value;
  return `•••• •••• • ${d.slice(9, 13)}`;
}

export const CITIZEN_ID_LENGTH = DIGITS;
