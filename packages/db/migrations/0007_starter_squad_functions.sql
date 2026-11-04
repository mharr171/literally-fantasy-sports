-- A pack's seed decides its players, including their hidden true potential
-- (D48), so managers can't read it: every packs column except the seed.
REVOKE SELECT ON public.packs FROM authenticated;--> statement-breakpoint
GRANT SELECT (
  id, team_id, sport, kind, focus, tier, created_at, opened_at, resolved_at, kept
) ON public.packs TO authenticated;--> statement-breakpoint

-- Creates a team with its 22 starter packs (D83) in one transaction, so a
-- team never exists without its packs. Seeds are random UUIDs made here.
-- Only the server (service role) may call it; it applies no game rules,
-- which the server checks with the engine first.
CREATE FUNCTION public.create_team_with_starter_packs(
  p_owner uuid,
  p_sport text,
  p_name text,
  p_packs jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
BEGIN
  INSERT INTO public.teams (owner_id, sport, name)
  VALUES (p_owner, p_sport, p_name)
  RETURNING id INTO v_team;

  INSERT INTO public.packs (team_id, sport, kind, focus, tier, seed)
  SELECT v_team, p_sport, 'starter', x.focus, x.tier, gen_random_uuid()::text
  FROM jsonb_to_recordset(p_packs) AS x(focus text, tier text);

  RETURN v_team;
END
$$;--> statement-breakpoint

-- Saves the players a manager kept from their starter packs and marks every
-- starter pack resolved, all at once. Refuses unless every starter pack is
-- opened and none is resolved yet, so a double submit can't add players
-- twice (the team row is locked while it checks).
CREATE FUNCTION public.resolve_starter_packs(
  p_team uuid,
  p_players jsonb,
  p_kept jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sport text;
  v_total integer;
  v_ready integer;
BEGIN
  SELECT sport INTO v_sport FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team % not found', p_team;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE opened_at IS NOT NULL AND resolved_at IS NULL)
  INTO v_total, v_ready
  FROM public.packs
  WHERE team_id = p_team AND kind = 'starter';
  IF v_total = 0 OR v_ready <> v_total THEN
    RAISE EXCEPTION 'starter packs are not ready to resolve (% of % ready)', v_ready, v_total;
  END IF;

  INSERT INTO public.players (
    team_id, sport, first_name, last_name, display_name, nationality, age,
    primary_position, secondary_position, attributes, overall, potential,
    potential_low, potential_high, worth, chemistry_color, template_variant,
    from_starter_pack
  )
  SELECT p_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant, true
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text
  );

  UPDATE public.packs
  SET resolved_at = now(),
      kept = coalesce(p_kept -> id::text, '[]'::jsonb)
  WHERE team_id = p_team AND kind = 'starter';
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.create_team_with_starter_packs(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.resolve_starter_packs(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_team_with_starter_packs(uuid, text, text, jsonb) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_starter_packs(uuid, jsonb, jsonb) TO service_role;
