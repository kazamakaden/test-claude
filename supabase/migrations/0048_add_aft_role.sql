-- `aft` = นักศึกษา อวท., an อวท. student member. Distinct from `teacher` (ครู),
-- who is actual staff — the two hold identical permissions but are different
-- people, and reporting needs to tell them apart.
--
-- ALONE IN ITS OWN MIGRATION, deliberately: PostgreSQL cannot use a new enum
-- value in the same transaction that adds it. 0010 (`aft_teacher`) and 0019
-- (`pending`) hit this same rule. 0049 is what actually uses the value.
alter type public.user_role add value if not exists 'aft';
