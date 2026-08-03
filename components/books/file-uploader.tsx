"use client";

import { useState, type ChangeEvent } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

/**
 * Two-phase upload: this component uploads straight to Supabase Storage
 * from the browser (authorized by the caller's own session under
 * books_storage_insert_own, 0029) and writes the resulting object path
 * into a hidden form field, so the surrounding <form>'s ordinary Server
 * Action submit only ever carries a short string — never the file bytes.
 * Server Actions default to a 1MB body limit this codebase does not want
 * to raise for a 25MB PDF.
 */
export function FileUploader({
  fieldName,
  bucket,
  accept,
  maxBytes,
  ownerId,
  bookId,
  initialPath,
  uploadingLabel,
  attachedLabel,
  tooLargeLabel,
  failedLabel,
}: {
  fieldName: string;
  bucket: "books" | "book-covers";
  accept: string;
  maxBytes: number;
  ownerId: string;
  bookId: string;
  initialPath: string | null;
  uploadingLabel: string;
  attachedLabel: string;
  tooLargeLabel: string;
  failedLabel: string;
}) {
  const [path, setPath] = useState(initialPath);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > maxBytes) {
      setError(tooLargeLabel);
      event.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "dat";
    const objectPath = `${ownerId}/${bookId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    setUploading(false);

    if (uploadError) {
      setError(failedLabel);
      return;
    }

    setPath(objectPath);
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={fieldName} value={path ?? ""} />
      <Input type="file" accept={accept} onChange={handleChange} disabled={uploading} />
      {uploading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden /> {uploadingLabel}
        </p>
      ) : null}
      {path && !uploading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Paperclip className="size-3" aria-hidden /> {attachedLabel}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
