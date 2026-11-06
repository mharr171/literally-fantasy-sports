-- Sport toggles (D207, ADR 0007 §12): admins turn each sport's Public and
-- AI world switches on and off; row-level security already limits updates
-- to admins.
GRANT UPDATE (public, ai_enabled) ON public.sport_settings TO authenticated;--> statement-breakpoint

-- Baseball arrives hidden, with its AI world off (D207), and the roster and
-- league of D196 and D199. Soccer keeps both switches on (the defaults).
INSERT INTO public.sport_settings (sport, roster_min, roster_max, bench_max, league_size, public, ai_enabled)
VALUES ('baseball', 14, 30, 5, 15, false, false)
ON CONFLICT (sport) DO NOTHING;
