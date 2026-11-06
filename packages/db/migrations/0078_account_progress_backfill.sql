-- Account progress (D206.9): narrow the grants, then fill it from the seasons
-- managers have already finished. A row per season played, title and final,
-- and the club's Elo at each season's end (the best is the highest row).
REVOKE ALL ON public.account_progress FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.account_progress TO authenticated;--> statement-breakpoint
INSERT INTO public.account_progress (owner_id, sport, season_id, kind, value, season_number, created_at)
SELECT t.owner_id, sr.sport, sr.season_id, k.kind, k.value, sr.season_number, sr.completed_at
FROM public.season_records sr
JOIN public.teams t ON t.id = sr.team_id AND t.kind = 'human' AND t.owner_id IS NOT NULL
CROSS JOIN LATERAL (
  VALUES
    ('season_played', 1, true),
    ('title', 1, sr.playoffs = 'champion'),
    ('final', 1, sr.playoffs IN ('final', 'champion')),
    ('best_elo', sr.elo_after, true)
) AS k(kind, value, earned)
WHERE k.earned
ON CONFLICT DO NOTHING;
