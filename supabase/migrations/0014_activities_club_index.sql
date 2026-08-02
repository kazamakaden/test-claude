-- §10 activities filtering gained a Club filter (/activities), but
-- 0007_dashboard_tables.sql only indexed department_id, status, academic_year,
-- and starts_at — club_id was missed despite being the same kind of FK as
-- department_id. Harmless at today's row count, but a real gap against the
-- pattern already established for this table.

create index activities_club_idx on public.activities (club_id);
