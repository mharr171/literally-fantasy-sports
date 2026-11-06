-- Account progress (D206.9): every season close writes one season_records
-- row, so a trigger on it adds the manager's milestones for that season in
-- the same transaction, for every sport. AI clubs have no owner and are
-- skipped. The same rules as the backfill in 0078.
CREATE FUNCTION public.record_account_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.account_progress (owner_id, sport, season_id, kind, value, season_number, created_at)
  SELECT t.owner_id, NEW.sport, NEW.season_id, k.kind, k.value, NEW.season_number, NEW.completed_at
  FROM public.teams t
  CROSS JOIN LATERAL (
    VALUES
      ('season_played', 1, true),
      ('title', 1, NEW.playoffs = 'champion'),
      ('final', 1, NEW.playoffs IN ('final', 'champion')),
      ('best_elo', NEW.elo_after, true)
  ) AS k(kind, value, earned)
  WHERE t.id = NEW.team_id AND t.kind = 'human' AND t.owner_id IS NOT NULL AND k.earned
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER season_records_account_progress
AFTER INSERT ON public.season_records
FOR EACH ROW EXECUTE FUNCTION public.record_account_progress();--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.record_account_progress() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- The admin view (ADR 0007 §9): each manager's totals per sport. Server only.
CREATE FUNCTION public.account_progress_summary()
RETURNS TABLE (
  owner_id uuid,
  display_name text,
  sport text,
  seasons integer,
  titles integer,
  finals integer,
  best_elo integer,
  last_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p.owner_id, pr.display_name, p.sport,
    (count(*) FILTER (WHERE p.kind = 'season_played'))::integer,
    (count(*) FILTER (WHERE p.kind = 'title'))::integer,
    (count(*) FILTER (WHERE p.kind = 'final'))::integer,
    max(p.value) FILTER (WHERE p.kind = 'best_elo'),
    max(p.created_at)
  FROM public.account_progress p
  LEFT JOIN public.profiles pr ON pr.id = p.owner_id
  GROUP BY p.owner_id, pr.display_name, p.sport
  ORDER BY p.sport, 4 DESC, 7 DESC NULLS LAST
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.account_progress_summary() FROM PUBLIC, anon, authenticated;
