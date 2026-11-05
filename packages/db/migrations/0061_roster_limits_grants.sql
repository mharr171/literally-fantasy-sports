-- Admins change roster limits (D182) like the energy switches: row-level
-- security checks is_admin, and only these columns can be updated.
GRANT UPDATE (roster_min, roster_max, bench_max) ON public.sport_settings TO authenticated;
