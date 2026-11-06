-- Reward packs (D181, ADR 0006 §6): a free pack for the club's playoff
-- finish (Gold for the champion, Silver for the finalist, Basic for a
-- semi-finalist), granted in the same transaction that closes the season so
-- it can only be granted once. It lands unopened; the club opens it when it
-- likes, then keeps or sells its players like a bought pack. Only the
-- server may call these.

-- Closes the season (as close_season, which stays for the version running
-- during a deploy) and grants its reward pack, moved with the club's Elo.
CREATE FUNCTION public.close_season_with_reward(
  p_season uuid,
  p_updates jsonb,
  p_retired jsonb,
  p_review jsonb,
  p_snapshot jsonb,
  p_elo_shift integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
  v_sport text;
  v_tier text;
BEGIN
  SELECT team_id, sport INTO v_team, v_sport FROM public.seasons WHERE id = p_season;
  PERFORM public.close_season(p_season, p_updates, p_retired, p_review, p_snapshot);
  v_tier := CASE p_snapshot -> 'stats' ->> 'playoffs'
    WHEN 'champion' THEN 'gold'
    WHEN 'final' THEN 'silver'
    WHEN 'semi' THEN 'basic'
  END;
  IF v_tier IS NOT NULL THEN
    INSERT INTO public.packs (team_id, sport, kind, focus, tier, seed, elo_shift)
    VALUES (v_team, v_sport, 'reward', 'any', v_tier, gen_random_uuid()::text,
            coalesce(p_elo_shift, 0));
  END IF;
END
$$;--> statement-breakpoint

-- Opens one of the club's reward packs, unless another pack is open.
CREATE FUNCTION public.open_reward_pack(p_team uuid, p_pack uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.teams WHERE id = p_team FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.packs
    WHERE team_id = p_team AND kind IN ('bought', 'reward')
      AND opened_at IS NOT NULL AND resolved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'finish your open pack first';
  END IF;
  UPDATE public.packs SET opened_at = now()
  WHERE id = p_pack AND team_id = p_team AND kind = 'reward' AND opened_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that reward pack is not waiting to be opened';
  END IF;
END
$$;--> statement-breakpoint

-- Buying waits while a reward pack is open, as it does for a bought one.
CREATE OR REPLACE FUNCTION public.buy_pack_with_choices(
  p_team uuid,
  p_focus text,
  p_tier text,
  p_price integer,
  p_elo_shift integer,
  p_excluded integer[]
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
    WHERE team_id = p_team AND kind IN ('bought', 'reward')
      AND opened_at IS NOT NULL AND resolved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'finish your open pack first';
  END IF;
  IF v_funds < p_price THEN
    RAISE EXCEPTION 'not enough funds';
  END IF;

  UPDATE public.teams SET funds = funds - p_price WHERE id = p_team;
  INSERT INTO public.packs (team_id, sport, kind, focus, tier, seed, opened_at,
                            elo_shift, excluded_colors)
  VALUES (p_team, v_sport, 'bought', p_focus, p_tier, gen_random_uuid()::text, now(),
          p_elo_shift, coalesce(p_excluded, '{}'))
  RETURNING id INTO v_pack;
  RETURN v_pack;
END
$$;--> statement-breakpoint

-- Keeping and selling works the same for an open reward pack.
CREATE OR REPLACE FUNCTION public.resolve_bought_pack(
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
  WHERE id = p_pack AND team_id = p_team AND kind IN ('bought', 'reward')
    AND opened_at IS NOT NULL AND resolved_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack is not open';
  END IF;

  INSERT INTO public.players (
    team_id, sport, first_name, last_name, display_name, nationality, age,
    primary_position, secondary_position, attributes, overall, potential,
    potential_low, potential_high, worth, chemistry_color, template_variant,
    secondary_template_variant, from_starter_pack
  )
  SELECT p_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant,
         coalesce(x.secondary_template_variant, 'default'), false
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text,
    secondary_template_variant text
  );

  UPDATE public.teams SET funds = funds + p_refund WHERE id = p_team;
  UPDATE public.packs SET resolved_at = now(), kept = p_kept WHERE id = p_pack;
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.close_season_with_reward(uuid, jsonb, jsonb, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.close_season_with_reward(uuid, jsonb, jsonb, jsonb, jsonb, integer) TO service_role;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.open_reward_pack(uuid, uuid) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.open_reward_pack(uuid, uuid) TO service_role;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.buy_pack_with_choices(uuid, text, text, integer, integer, integer[]) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.resolve_bought_pack(uuid, uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
