-- Representative game data for the persistence check (D131): a real club
-- and an AI club with players, squads, a season and its records, a ghost,
-- a retired player's career and a published settings version with
-- template variants. Loaded on the base branch's schema before the new
-- migrations run; see scripts/persistence-check.ts.
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-4000-8000-000000000001', 'persist@example.com');

INSERT INTO public.teams (id, owner_id, sport, name, colors)
VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'soccer', 'Persist Rovers', '{red,white}');

SELECT public.create_ai_team('soccer', 'Persist Athletic', '{navy,gold}', 'Ana Silva',
  '{"personality":"steady","pace":"normal","formation":"4-4-2"}', '[{"focus":"any","tier":"starter"}]');

INSERT INTO public.players (team_id, sport, first_name, last_name, display_name, nationality,
  age, primary_position, attributes, overall, potential, potential_low, potential_high, worth, chemistry_color)
SELECT t.id, 'soccer', 'P', 'One', 'P One', 'ENG', 24, 'ST', '{}', 60, 70, 65, 75, 2000, 1
FROM public.teams t WHERE t.name IN ('Persist Rovers', 'Persist Athletic');

INSERT INTO public.matchday_squads (team_id, lineup_data)
SELECT t.id, '{"formation":"4-4-2","starters":[],"bench":[],"subPlan":[]}' FROM public.teams t
WHERE t.name IN ('Persist Rovers', 'Persist Athletic');

INSERT INTO public.seasons (id, team_id, sport, number, status, seed, start_elo, config_version, closed_at)
VALUES ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 'soccer', 1, 'finished', 'seed', 1500, 'defaults', now());

INSERT INTO public.season_records (team_id, season_id, sport, season_number, team_name, elo_before, elo_after,
  position, played, won, drawn, lost, scored, conceded, points, playoffs)
VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'soccer', 1,
  'Persist Rovers', 1500, 1520, 3, 22, 11, 5, 6, 30, 22, 38, 'quarter');

INSERT INTO public.ghosts (team_id, season_id, sport, team_name, season_number, elo, players, squad, game_version)
VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'soccer',
  'Persist Rovers', 1, 1520, '[]', '{}', 'test');

INSERT INTO public.player_careers (team_id, sport, first_name, last_name, display_name, nationality,
  primary_position, retired_age, seasons, appearances, goals, best_overall, clubs, retired_season)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'soccer', 'Old', 'Timer', 'Old Timer', 'ESP', 'CB', 37,
  12, 300, 8, 78, '{"Persist Rovers"}', 1);

INSERT INTO public.game_config_versions (scope, version, note)
VALUES ('soccer', 900, 'persistence check');
INSERT INTO public.game_config (scope, version, key, value)
VALUES ('soccer', 900, 'variants.enabled', '{"ST":["poacher"]}');
UPDATE public.game_config_versions SET published_at = now() WHERE scope = 'soccer' AND version = 900;

-- An admin-made formation, turned off (D140). Skipped on a base branch
-- from before formations existed.
DO $$
BEGIN
  IF to_regclass('public.formations') IS NOT NULL THEN
    INSERT INTO public.formations (sport, id, slots, built_in, enabled)
    VALUES ('soccer', '4-5-1', '[{"position":"GK","x":50,"y":6},{"position":"LB","x":12,"y":26},{"position":"CB","x":37,"y":22},{"position":"CB","x":63,"y":22},{"position":"RB","x":88,"y":26},{"position":"LM","x":12,"y":58},{"position":"CM","x":30,"y":52},{"position":"CM","x":50,"y":48},{"position":"CM","x":70,"y":52},{"position":"RM","x":88,"y":58},{"position":"ST","x":50,"y":85}]', false, false)
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;

-- A manager's season milestones (D206.9). Skipped on a base branch from
-- before account progress existed.
DO $$
BEGIN
  IF to_regclass('public.account_progress') IS NOT NULL THEN
    INSERT INTO public.account_progress (owner_id, sport, season_id, kind, value, season_number)
    VALUES ('00000000-0000-4000-8000-000000000001', 'soccer', '00000000-0000-4000-8000-0000000000c1', 'season_played', 1, 1)
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;
