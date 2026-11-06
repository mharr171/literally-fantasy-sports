-- Lineups as sport-defined groups (ADR 0007 §3). Soccer's squad columns
-- stay where saves write during M16; a trigger copies them into
-- `lineup_data` on every insert and change, so readers can move to it in
-- the next PR. Other groups in `lineup_data` are kept. M17 drops the
-- columns (ADR 0007 §13).
CREATE FUNCTION public.sync_soccer_lineup()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT sport FROM public.teams WHERE id = NEW.team_id) = 'soccer' THEN
    NEW.lineup_data := coalesce(NEW.lineup_data, '{}'::jsonb) || jsonb_build_object(
      'formation', NEW.formation,
      'starters', NEW.lineup,
      'bench', NEW.bench,
      'subPlan', NEW.sub_plan
    );
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER matchday_squads_sync_soccer_lineup
BEFORE INSERT OR UPDATE OF formation, lineup, bench, sub_plan
ON public.matchday_squads
FOR EACH ROW EXECUTE FUNCTION public.sync_soccer_lineup();--> statement-breakpoint

-- Backfill every existing soccer squad (D131: backfill, never wipe).
UPDATE public.matchday_squads ms SET lineup_data = ms.lineup_data || jsonb_build_object(
  'formation', ms.formation, 'starters', ms.lineup, 'bench', ms.bench, 'subPlan', ms.sub_plan
)
FROM public.teams tm WHERE tm.id = ms.team_id AND tm.sport = 'soccer';--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.sync_soccer_lineup() FROM PUBLIC, anon, authenticated;
