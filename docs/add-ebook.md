# How to add an e-book to the /documents shelf

Books are published on [FlipHTML5](https://fliphtml5.com) (a flipbook host)
and attached to a document through the app's own §12 draft workflow — there
is no separate upload/link form outside that workflow anymore. This
replaces the earlier AnyFlip-based, Table-Editor-only flow (see `CLAUDE.md`
§0 for why).

## 1. Publish the book on FlipHTML5

1. Go to [fliphtml5.com](https://fliphtml5.com) and sign in (or create a
   free account for the college).
2. Upload the PDF and let it convert to a flipbook.
3. Once published, copy the book's share link. It looks like:

   ```text
   https://fliphtml5.com/<id>/<book>/
   ```

   (The reader itself may live at `online.fliphtml5.com/<id>/<book>/` —
   either form is accepted, see the Notes below.)

## 2. Attach it through the draft workflow (the normal path)

1. Sign in as a student, teacher, `aft_teacher`, or admin and go to
   `/documents/manage` → **create a new document** (or open an existing
   draft you own).
2. Fill in the title, content, an optional description, and paste the
   FlipHTML5 link from step 1 into **Flipbook URL**. Leaving it blank is
   fine — the document still saves as a draft with "book not attached".
3. The document then follows the normal §12/§17 path: **sign** it
   (digital-signature confirmation), **submit for approval**, and an
   `aft_teacher` or admin reviews it — the reviewer sees a live preview of
   the attached book on the document's detail page before approving —
   and either **approves** (status becomes `official`, visible on the
   public `/documents` shelf) or **rejects** it back to the owner with a
   reason.

Only an `official` document is public. This is the same RLS-enforced rule
`docs/add-ebook.md` has always documented
(`documents_select_official`, `0008_dashboard_rls.sql`) — it now also means
a book can no longer be pushed straight to the public shelf by editing a row
directly; it must pass through sign → review → approve first.

## 3. Fallback: Table Editor (admin only, bypasses the workflow)

For a one-off fix or a row that predates this workflow, an admin can still
edit `public.documents` directly in the Supabase dashboard → **Table
Editor**. This skips the draft/sign/review steps entirely, so use it
sparingly — the in-app flow above is the intended path for anything new.

| column | value |
|---|---|
| `title` | The book's title, as it should appear on the shelf |
| `description` | Optional short description (shown on the reader page) |
| `status` | **`official`** — anything else stays hidden from the public shelf |
| `flipbook_url` | The FlipHTML5 URL from step 1, e.g. `https://fliphtml5.com/aasdd/luel/` |
| `published_at` | The date to show on the shelf — usually just now |

## Notes

- **Only `status = 'official'` documents are public**, enforced by database
  RLS (`documents_select_official`, `0008_dashboard_rls.sql`), not just the
  UI.
- **`flipbook_url` must be a real FlipHTML5 link** — the database itself
  refuses anything else (`documents_flipbook_url_is_fliphtml5` constraint,
  `0021_documents_fliphtml5.sql`), and the in-app form validates the same
  pattern before it ever reaches the database
  (`lib/fliphtml5.ts`/`schemas/documents.ts`). Both `fliphtml5.com/<id>/<book>`
  and `online.fliphtml5.com/<id>/<book>` are accepted and normalized to the
  `online.` reader host on save. Pasting a Google Drive link, a raw PDF URL,
  an AnyFlip link, or any other host will fail validation, not silently save.
- Removing a book from public view is the same as before: change its
  `status` away from `official` (or clear `flipbook_url` and re-submit
  through the workflow), or delete the row.
- There's no cover-image upload yet — every book on the shelf shows a
  designed placeholder cover instead. See `CLAUDE.md` §0 for why.
