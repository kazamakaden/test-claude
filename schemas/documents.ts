import { z } from "zod";

const documentIdSchema = z.uuid();

/** A malformed id can never reach a real row, so treat it as "not found" rather than a 500. */
export function parseDocumentId(id: string): string | null {
  const result = documentIdSchema.safeParse(id);
  return result.success ? result.data : null;
}
