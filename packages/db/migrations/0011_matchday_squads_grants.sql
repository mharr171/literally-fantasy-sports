-- Managers can read their own squad; only the server (service role), after
-- checking the squad with the engine, can save it.
REVOKE ALL ON public.matchday_squads FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.matchday_squads TO authenticated;
