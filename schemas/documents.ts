import { z } from "zod";
import { isAnyFlipEmbedUrl } from "@/lib/anyflip";

const documentIdSchema = z.uuid();

/** A malformed id can never reach a real row, so treat it as "not found" rather than a 500. */
export function parseDocumentId(id: string): string | null {
  const result = documentIdSchema.safeParse(id);
  return result.success ? result.data : null;
}

export const flipbookUrlSchema = z
  .string()
  .refine(isAnyFlipEmbedUrl, { message: "Must be a valid AnyFlip book URL" })
  .nullable();
