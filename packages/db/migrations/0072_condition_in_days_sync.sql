-- Condition in days and games (ADR 0007 §5). Soccer's week is one day and
-- one game, so injured_days and suspended_games equal the week columns that
-- record_week and season close write during M16. A trigger copies them on
-- every insert and change; M17 moves the writers and drops the old columns.
CREATE FUNCTION public.sync_soccer_condition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.sport = 'soccer' THEN
    NEW.injured_days := NEW.injured_weeks;
    NEW.suspended_games := NEW.suspended_weeks;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER players_sync_soccer_condition
BEFORE INSERT OR UPDATE OF injured_weeks, suspended_weeks
ON public.players
FOR EACH ROW EXECUTE FUNCTION public.sync_soccer_condition();--> statement-breakpoint

-- Backfill every soccer player (D131: backfill, never wipe).
UPDATE public.players
SET injured_days = injured_weeks, suspended_games = suspended_weeks
WHERE sport = 'soccer';--> statement-breakpoint

-- Managers read their own players' condition, as they read the week columns.
GRANT SELECT (injured_days, suspended_games) ON public.players TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.sync_soccer_condition() FROM PUBLIC, anon, authenticated;
