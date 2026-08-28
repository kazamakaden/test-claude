# Parked routes

`(unused)` is a **route group**: the parentheses mean it does not appear in the
URL. `/th/projects`, `/th/reports` and `/th/audit` keep working exactly as
before, inherit the same `(app)` layout and its auth guard, and every internal
link to them still resolves. Nothing here is disabled — it is only unlisted.

They were dropped from the seven-tab nav (`lib/navigation.ts`) when the front of
the app was restructured around หน้าแรก / ปฏิทิน / กิจกรรม /
สภาพทั่วไปและการบริหารองค์การ / 11 ดี 11 เก่ง อวท. / สมาชิก / ประกาศ. The folder
name is the label: these are built, tested and working, just not part of the
current navigation.

* `projects` — the §11 draft → teacher review → admin approval workflow.
* `reports` — §18 reporting (`0058`'s three RPCs, gated on `assert_report_viewer`).
* `audit`   — the §19 audit trail (`audit_logs`, `0057`, admin only).

Their `services/`, `actions/` and `components/` deliberately stay where they
are: they are imported from here and, in the case of reports, from the dashboard
cards too. Their `nav.projects` / `nav.reports` / `nav.audit` dictionary keys
also stay — each page reads its own key as its `<h1>`.

Deleting any of this is a separate decision and should be made explicitly, not
inferred from the folder name.
