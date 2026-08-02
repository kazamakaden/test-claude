-- §10 activity statistics and §9 member-by-department counts, aggregated in
-- SQL rather than pulled into TS (§23). SECURITY INVOKER (the default,
-- stated explicitly) so RLS still applies to the caller — these must not
-- repeat the SECURITY DEFINER cleanup 0006 had to do.

create function public.get_activity_stats()
returns table (month text, attendance bigint, completed bigint, pending bigint)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    to_char(months.month, 'Mon') as month,
    coalesce(att.attendance_count, 0) as attendance,
    coalesce(act.completed_count, 0) as completed,
    coalesce(act.pending_count, 0) as pending
  from (
    select generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) as month
  ) months
  left join (
    select date_trunc('month', a.recorded_at) as month, count(*) as attendance_count
    from public.attendance a
    group by 1
  ) att on att.month = months.month
  left join (
    select
      date_trunc('month', a.starts_at) as month,
      count(*) filter (where a.status = 'completed') as completed_count,
      count(*) filter (where a.status = 'pending') as pending_count
    from public.activities a
    group by 1
  ) act on act.month = months.month
  order by months.month;
$$;

create function public.get_member_stats()
returns table (department text, member_count bigint)
language sql
security invoker
stable
set search_path = ''
as $$
  select d.name_th as department, count(p.id) as member_count
  from public.departments d
  left join public.profiles p on p.department_id = d.id
  group by d.id, d.name_th
  order by member_count desc;
$$;
