-- Game data is read-only for players: every change goes through the server,
-- which validates it with the engine and writes with the service role. This
-- is what stops faked results (roadmap Step 8, "Cheating").
REVOKE ALL ON public.teams, public.players, public.packs FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.teams, public.packs TO authenticated;--> statement-breakpoint

-- Every player column except the hidden true potential (D48). Queries must
-- name their columns: "select *" on players is refused for players.
GRANT SELECT (
  id, team_id, sport, first_name, last_name, display_name, nationality, age,
  primary_position, secondary_position, attributes, overall,
  potential_low, potential_high, worth, chemistry_color, template_variant,
  from_starter_pack, created_at
) ON public.players TO authenticated;
