-- Stats by key (ADR 0007 §2). Soccer's stat columns stay the place
-- record_week and close_season write to during M16; a trigger copies them
-- into `stats` on every insert and every change, so readers can move to
-- `stats` now. Other keys in `stats` are kept. M17 moves the writers to
-- `stats` and drops the columns (ADR 0007 §13).
CREATE FUNCTION public.sync_soccer_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.sport = 'soccer' THEN
    NEW.stats := coalesce(NEW.stats, '{}'::jsonb) || jsonb_build_object(
      'games', NEW.stat_games,
      'wins', NEW.wins,
      'draws', NEW.draws,
      'losses', NEW.losses,
      'goals', NEW.stat_goals,
      'assists', NEW.assists,
      'tackles', NEW.tackles,
      'saves', NEW.saves
    );
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER players_sync_soccer_stats
BEFORE INSERT OR UPDATE OF stat_games, wins, draws, losses, stat_goals, assists, tackles, saves
ON public.players
FOR EACH ROW EXECUTE FUNCTION public.sync_soccer_stats();--> statement-breakpoint

CREATE TRIGGER player_careers_sync_soccer_stats
BEFORE INSERT OR UPDATE OF stat_games, wins, draws, losses, stat_goals, assists, tackles, saves
ON public.player_careers
FOR EACH ROW EXECUTE FUNCTION public.sync_soccer_stats();--> statement-breakpoint

-- Backfill every existing soccer row (D131: backfill, never wipe).
UPDATE public.players SET stats = stats || jsonb_build_object(
  'games', stat_games, 'wins', wins, 'draws', draws, 'losses', losses,
  'goals', stat_goals, 'assists', assists, 'tackles', tackles, 'saves', saves
) WHERE sport = 'soccer';--> statement-breakpoint

UPDATE public.player_careers SET stats = stats || jsonb_build_object(
  'games', stat_games, 'wins', wins, 'draws', draws, 'losses', losses,
  'goals', stat_goals, 'assists', assists, 'tackles', tackles, 'saves', saves
) WHERE sport = 'soccer';--> statement-breakpoint

-- The hall of fame ranks by these (D121); one index per stat and table.
CREATE INDEX players_stats_games ON public.players (sport, (stats -> 'games') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX players_stats_goals ON public.players (sport, (stats -> 'goals') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX players_stats_assists ON public.players (sport, (stats -> 'assists') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX players_stats_tackles ON public.players (sport, (stats -> 'tackles') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX players_stats_saves ON public.players (sport, (stats -> 'saves') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX player_careers_stats_games ON public.player_careers (sport, (stats -> 'games') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX player_careers_stats_goals ON public.player_careers (sport, (stats -> 'goals') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX player_careers_stats_assists ON public.player_careers (sport, (stats -> 'assists') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX player_careers_stats_tackles ON public.player_careers (sport, (stats -> 'tackles') DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX player_careers_stats_saves ON public.player_careers (sport, (stats -> 'saves') DESC NULLS LAST);--> statement-breakpoint

-- The top players of all time for one stat (D121), current and retired
-- together, best first: what the public hall of fame lists. Club names
-- only, never managers (ADR 0005).
CREATE FUNCTION public.hall_of_fame_players(p_sport text, p_stat text, p_limit integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.value DESC, t.name), '[]'::jsonb)
  FROM (
    SELECT * FROM (
      (SELECT p.id, p.display_name AS name, p.primary_position AS position,
              tm.name AS club, p.team_id, false AS retired,
              (p.stats ->> p_stat)::integer AS value
       FROM public.players p JOIN public.teams tm ON tm.id = p.team_id
       WHERE p.sport = p_sport AND (p.stats -> p_stat) > '0'::jsonb
       ORDER BY p.stats -> p_stat DESC NULLS LAST
       LIMIT p_limit)
      UNION ALL
      (SELECT c.id, c.display_name, c.primary_position,
              coalesce(c.clubs[cardinality(c.clubs)], '?'), c.team_id, true,
              (c.stats ->> p_stat)::integer
       FROM public.player_careers c
       WHERE c.sport = p_sport AND (c.stats -> p_stat) > '0'::jsonb
       ORDER BY c.stats -> p_stat DESC NULLS LAST
       LIMIT p_limit)
    ) both_lists
    ORDER BY value DESC, name
    LIMIT p_limit
  ) t
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.hall_of_fame_players(text, text, integer) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.hall_of_fame_players(text, text, integer) TO service_role;--> statement-breakpoint

-- Managers read their own players' stats, as they read the stat columns.
GRANT SELECT (stats) ON public.players TO authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.sync_soccer_stats() FROM PUBLIC, anon, authenticated;
