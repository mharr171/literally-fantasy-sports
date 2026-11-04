-- Teams created before starting funds existed get them too. Nothing could
-- earn or spend funds before this migration, so 0 means "never had any".
UPDATE public.teams SET funds = 10000 WHERE funds = 0;--> statement-breakpoint

-- Buys a pack (D47): takes the price from the team's funds and opens the
-- pack straight away. Refuses when funds are short or the team still has a
-- bought pack to keep or sell. The server works out the price with the
-- engine; only the server (service role) may call this.
CREATE FUNCTION public.buy_pack(
  p_team uuid,
  p_focus text,
  p_tier text,
  p_price integer
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sport text;
  v_funds integer;
  v_pack uuid;
BEGIN
  IF p_price <= 0 THEN
    RAISE EXCEPTION 'pack price must be positive';
  END IF;
  SELECT sport, funds INTO v_sport, v_funds
  FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team % not found', p_team;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.packs
    WHERE team_id = p_team AND kind = 'bought' AND resolved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'finish your open pack first';
  END IF;
  IF v_funds < p_price THEN
    RAISE EXCEPTION 'not enough funds';
  END IF;

  UPDATE public.teams SET funds = funds - p_price WHERE id = p_team;
  INSERT INTO public.packs (team_id, sport, kind, focus, tier, seed, opened_at)
  VALUES (p_team, v_sport, 'bought', p_focus, p_tier, gen_random_uuid()::text, now())
  RETURNING id INTO v_pack;
  RETURN v_pack;
END
$$;--> statement-breakpoint

-- Keeps some of a bought pack's players and bulk-resells the rest (D49):
-- adds the kept players, pays the resale money and marks the pack resolved,
-- all at once. Refuses a pack that isn't this team's open bought pack, so
-- it can't pay out twice.
CREATE FUNCTION public.resolve_bought_pack(
  p_team uuid,
  p_pack uuid,
  p_players jsonb,
  p_kept jsonb,
  p_refund integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sport text;
BEGIN
  IF p_refund < 0 THEN
    RAISE EXCEPTION 'resale money cannot be negative';
  END IF;
  SELECT sport INTO v_sport FROM public.packs
  WHERE id = p_pack AND team_id = p_team AND kind = 'bought'
    AND opened_at IS NOT NULL AND resolved_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack is not open';
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
         x.potential_high, x.worth, x.chemistry_color, x.template_variant, false
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text
  );

  UPDATE public.teams SET funds = funds + p_refund WHERE id = p_team;
  UPDATE public.packs SET resolved_at = now(), kept = p_kept WHERE id = p_pack;
END
$$;--> statement-breakpoint

-- Releases (p_refund 0) or bulk-sells a player from the roster (D49, D54).
-- Refuses when the team would drop below p_min_roster players. The team row
-- is locked so two removals can't both slip under the minimum.
CREATE FUNCTION public.remove_player(
  p_team uuid,
  p_player uuid,
  p_refund integer,
  p_min_roster integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_refund < 0 THEN
    RAISE EXCEPTION 'resale money cannot be negative';
  END IF;
  PERFORM 1 FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team % not found', p_team;
  END IF;
  SELECT count(*) INTO v_count FROM public.players WHERE team_id = p_team;
  IF v_count <= p_min_roster THEN
    RAISE EXCEPTION 'roster would drop below % players', p_min_roster;
  END IF;

  DELETE FROM public.players WHERE id = p_player AND team_id = p_team;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'player is not on this team';
  END IF;
  UPDATE public.teams SET funds = funds + p_refund WHERE id = p_team;
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.buy_pack(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.resolve_bought_pack(uuid, uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.remove_player(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.buy_pack(uuid, text, text, integer) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_bought_pack(uuid, uuid, jsonb, jsonb, integer) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.remove_player(uuid, uuid, integer, integer) TO service_role;
