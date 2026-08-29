# Adding an e-book to the shelf

Books on `/documents` are plain PDF files. Clicking a book opens its PDF in
a new tab using the browser's own viewer — there is no flipbook host and no
embedded reader (removed in `0053_remove_fliphtml5.sql`).

You need the **นักศึกษา อวท. (`aft`)**, **ครู (`teacher`)** or
**ผู้ดูแลระบบ (`admin`)** role. A plain `student` is read-only and will not
see the "เพิ่มหนังสือ" button.

## 1. Create the book

1. Go to **เอกสาร / Documents** and click **เพิ่มหนังสือ**.
2. Enter the title, academic year (Buddhist, e.g. `2569`) and semester.
3. Save. The book is created as a **draft** and you land on its detail page.

A draft is visible only to you and to staff. It does not appear on the
public shelf.

## 2. Upload the PDF

On the book's detail page, use the **ไฟล์ PDF** field.

| Limit | Value |
|---|---|
| Format | PDF only |
| Maximum size | 25 MB |

Optionally add a description and a cover image (JPEG/PNG/WebP, max 2 MB).
Without a cover, the shelf draws a generated placeholder from the title.

The file uploads straight from your browser to Storage, then the form saves
its path — so the 25 MB limit is not constrained by the Server Action body
size.

Once a PDF is attached you can open it yourself from the detail page
(**เปิดไฟล์ PDF**) to check it before anyone else sees it.

## 3. Publish

Publishing requires `document:approve` — **admin only**. An owner cannot
publish their own book; that separation is what keeps a submitted book a
draft until someone else has looked at it.

An admin opens the book and clicks **เผยแพร่**.

**A book with no PDF cannot be published.** The database refuses it
(`books_published_needs_pdf`), and the form will say so rather than failing
silently. This is what guarantees a visitor never sees a book with nothing
behind it.

## Admin fallback: the Table Editor

For a one-off fix you can edit `public.books` directly in the Supabase
dashboard.

| Column | Value |
|---|---|
| `title` | The book's name |
| `academic_year` | 4-digit Buddhist year, e.g. `2569` |
| `season` | `1`, `2` or `3` (ภาคเรียนที่ 1 / 2 / ฤดูร้อน) |
| `pdf_path` | Storage object path in the `books` bucket |
| `status` | `draft` or `published` |

Notes:

- `pdf_path` is a **path inside the private bucket**, not a URL. The app
  mints a signed URL per request; pasting a public URL here will not work.
- Setting `status = 'published'` with `pdf_path` empty is rejected by
  `books_published_needs_pdf`.
- Uploads follow the path convention `{owner_id}/{book_id}/{uuid}.pdf` —
  the first folder segment is the ownership check in the Storage policies
  (`0029_books_storage.sql`), so a hand-made path should match it.

## Removing a book

Owners and staff get a delete control on both the shelf card and the detail
page. Deleting removes the row and then cleans up its Storage objects.
