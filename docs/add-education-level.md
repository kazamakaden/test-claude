# Adding a new สาขา or a new education level

Two different things get called "adding a new class". They need very different
amounts of work, so start here:

| What you want | What it takes |
|---|---|
| A new **สาขา** (programme) under ปวช. / ปวส. / ทล.บ. | **No code.** You do it yourself in the app — §1 below |
| A new **ระดับ** (qualification level), i.e. a student ID starting with a digit the system has no name for | A small code change — §2 below |

Almost every request is the first one.

---

## 1. Adding a new สาขา — no developer needed

You need the **ผู้ดูแลระบบ (`admin`)** role.

### The easy way: let the student ID fill it in

1. Go to **สมาชิก / Members** → **กรอกอัตโนมัติ**.
2. Paste the student's college email, e.g. `69319010015@udontech.ac.th`.
3. The panel decodes the ID and shows the ปี, รหัสวิชา, รหัสสาขา, กลุ่ม, เลขที่
   and ระดับ. If that รหัสสาขา is not registered yet, an **เพิ่มสาขา** box
   appears with the code already filled in — you only type the Thai and English
   names.
4. Save. Every student whose ID carries that code now resolves to it
   automatically, including ones who signed up earlier.

### The direct way

**สมาชิก / Members** → the **สาขา** table has its own add form. Enter the
5-digit code, Thai name and English name.

The code must be exactly 5 digits (`^[0-9]{5}$`) and must be unique. Nothing
restricts which digit it starts with — see §2 for what that digit means.

> **The code cannot be edited afterwards, only renamed.** A member's สาขา is
> resolved by matching that code against their student ID, so changing it would
> silently detach everyone who resolves through it. Fixing a wrong code means
> adding the correct one and moving members over.

---

## 2. Adding a new ระดับ (qualification level)

### First, check you actually need one

The **first digit of the 5-digit รหัสสาขา** is the qualification:

| Digit | ระดับ | Example |
|---|---|---|
| `2` | ปวช. — ประกาศนียบัตรวิชาชีพ | `20901` เทคโนโลยีสารสนเทศ |
| `3` | ปวส. — ประกาศนียบัตรวิชาชีพชั้นสูง | `30901`, `31901` เทคโนโลยีสารสนเทศ |
| `4` | ทล.บ. — เทคโนโลยีบัณฑิต | `40101` เทคโนโลยีเครื่องยนต์ |

**About ป.ตรี specifically:** `4` (ทล.บ. — เทคโนโลยีบัณฑิต) is *already* a
bachelor's degree. If the new programmes are ทล.บ. programmes, you do **not**
need a new level — add them as สาขา under §1, or change the label if you want
it to read ป.ตรี.

You need a new level only if the college genuinely issues student IDs whose
รหัสสาขา starts with a digit not in the table above.

### Nothing breaks while you wait

An unrecognised digit is **not** an error. It was made that way deliberately so
a new qualification can never block admitting a real student. Until the level is
named:

* the student signs in normally;
* their สาขา still resolves, as long as the 5-digit code is registered (§1);
* their ระดับ displays as **ไม่ทราบระดับชั้น** / *Unknown level*.

It is cosmetic. There is no outage and no rush.

### The change

Everything lives in **`lib/student-id.ts`** plus the two dictionaries. Using a
hypothetical digit `5` called ป.ตรี:

1. **`lib/student-id.ts`** — add the level to the `StudentLevel` union:

   ```ts
   export type StudentLevel = "vocational" | "diploma" | "bachelor" | "graduate" | null;
   ```

2. **`lib/student-id.ts`** — add the digit to `studentLevelFromProgramCode`:

   ```ts
   case "5":
     return "graduate"; // ป.ตรี
   ```

3. **`lib/student-id.ts`** — add the key to `LevelLabels`:

   ```ts
   graduate: string;
   ```

4. **`lib/i18n/dictionaries/th.json`** and **`en.json`** — add the label under
   `common.levels`:

   ```jsonc
   "common": { "levels": { …, "graduate": "ป.ตรี" } }
   ```

Then `npx tsc --noEmit && npm run lint && npm run build`.

**No migration, no database change, no RLS.** The level is *derived* from the
code's first digit and never stored. A `departments.level` column would be a
second source of truth that could drift from `code`; deriving it cannot.

### The compiler finds the steps you forget

Do step 1 first and let TypeScript drive. Adding only the union member and the
`case` produces exactly these errors — real output from actually doing it, not
an illustration. (Line and column numbers are omitted because they shift; `tsc`
prints them and they will point at the right place.)

```
components/members/autoinput-form.tsx: error TS7053: Element implicitly
  has an 'any' type because expression of type '"vocational" | "diploma" |
  "bachelor" | "graduate"' can't be used to index type '{ vocational: string;
  diploma: string; bachelor: string; unknown: string; }'.
  Property 'graduate' does not exist on type '{ vocational: string;
  diploma: string; bachelor: string; unknown: string; }'.

lib/student-id.ts: error TS7053: Element implicitly has an 'any' type
  because expression of type '"vocational" | "diploma" | "bachelor" |
  "graduate"' can't be used to index type 'LevelLabels'.
  Property 'graduate' does not exist on type 'LevelLabels'.
```

The second names step 3 (`LevelLabels`). The first names step 4 — that type is
the resolved shape of `th.json`, so the error means the Thai key is missing. A
missing **English** key is a compile error too, because `types/i18n.ts` derives
the dictionary type from the Thai file.

So **a clean `tsc` means you did not miss a spot.** That is the whole
verification.

### Where it shows up

Once added, the new label appears automatically in:

* **สมาชิก → กรอกอัตโนมัติ** — the ระดับ field of the decoded panel;
* **สมาชิก → the สาขา table** — the ระดับ column;
* **the สาขา dropdowns** on the members filter and the member edit sheet, as
  the prefix in `ปวส. — เทคโนโลยีสารสนเทศ (30901)`.

No component needs editing — they all read the same two helpers,
`departmentLevelLabel` and `departmentOptionLabel`.

> **Why the code is in that label:** `30901` and `31901` are *both* ปวส. *and*
> both named เทคโนโลยีสารสนเทศ, so the level and name together are still
> ambiguous. The code is the only value guaranteed unique.
