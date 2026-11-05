-- The global hall of fame's club lists (D121, ADR 0005): most titles,
-- highest Elo ever reached and most seasons played, each club once, from
-- the permanent season records. Read-only; only the server calls it.
CREATE FUNCTION public.hall_of_fame_clubs(p_sport text, p_limit integer)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH per_club AS (
    SELECT r.team_id,
           (array_agg(r.team_name ORDER BY r.season_number DESC))[1] AS name,
           count(*) FILTER (WHERE r.playoffs = 'champion')::int AS titles,
           max(r.elo_after)::int AS best_elo,
           count(*)::int AS seasons
    FROM public.season_records r
    WHERE r.sport = p_sport AND r.team_id IS NOT NULL
    GROUP BY r.team_id
  ),
  ranked AS (
    SELECT p.*, (g.team_id IS NOT NULL) AS has_ghost,
           t.colors
    FROM per_club p
    LEFT JOIN public.ghosts g ON g.team_id = p.team_id AND g.sport = p_sport
    LEFT JOIN public.teams t ON t.id = p.team_id
  )
  SELECT jsonb_build_object(
    'titles', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT team_id, name, colors, has_ghost, titles AS value FROM ranked
      WHERE titles > 0 ORDER BY titles DESC, best_elo DESC, name LIMIT p_limit) x), '[]'::jsonb),
    'elo', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT team_id, name, colors, has_ghost, best_elo AS value FROM ranked
      ORDER BY best_elo DESC, name LIMIT p_limit) x), '[]'::jsonb),
    'seasons', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT team_id, name, colors, has_ghost, seasons AS value FROM ranked
      ORDER BY seasons DESC, best_elo DESC, name LIMIT p_limit) x), '[]'::jsonb)
  )
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.hall_of_fame_clubs(text, integer) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.hall_of_fame_clubs(text, integer) TO service_role;
