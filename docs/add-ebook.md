# How to add an e-book to the /documents shelf

Books are published on [AnyFlip](https://anyflip.com) (a free flipbook host)
and linked into `public.documents` from the Supabase Table Editor. There is
no admin upload form in the app yet — the college's own publications go
through AnyFlip's own site, then get linked here.

## 1. Publish the book on AnyFlip

1. Go to [anyflip.com](https://anyflip.com) and sign in (or create a free
   account for the college).
2. Upload the PDF and let it convert to a flipbook.
3. Once published, copy the book's URL. It looks like:

   ```text
   https://anyflip.com/<user-id>/<book-id>/
   ```

   That's the only URL format the app accepts — see the Notes below.

## 2. Add the row in Supabase

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → project
   `hmkciwgzbdszsgnbeakc` → **Table Editor** → **documents**.
2. Click **Insert row** and fill in:

   | column | value |
   |---|---|
   | `title` | The book's title, as it should appear on the shelf |
   | `description` | Optional short description (shown on the reader page) |
   | `status` | **`official`** — anything else stays hidden from the public shelf (see Notes) |
   | `flipbook_url` | The AnyFlip URL from step 1, e.g. `https://anyflip.com/aasdd/luel/` |
   | `published_at` | The date to show on the shelf — usually just now |

3. Save. The book appears on `/documents` immediately — no rebuild or
   redeploy needed.

## 3. To publish an e-book without a flipbook link yet

Leave `flipbook_url` empty and set `status` to `official` anyway — it still
shows up on the shelf, and opening it shows a "book not attached yet" page
instead of a broken viewer. Fill in `flipbook_url` later the same way.

## Notes

- **Only `status = 'official'` documents are public.** Rows with `draft` or
  `pending_approval` status exist for the future §12 document-approval
  workflow and stay invisible to guests — this is enforced by database RLS
  (`documents_select_official`, `0008_dashboard_rls.sql`), not just the UI.
- **`flipbook_url` must be a real AnyFlip link** — the database itself
  refuses anything else (`documents_flipbook_url_is_anyflip` constraint,
  `0013_documents_ebook.sql`). Pasting a Google Drive link, a raw PDF URL, or
  any other host will fail with a database error, not silently save.
- Removing a book from public view is the same as adding one: change its
  `status` away from `official`, or delete the row.
- There's no cover-image upload yet — every book on the shelf shows a
  designed placeholder cover instead. See `CLAUDE.md` §0 for why.
