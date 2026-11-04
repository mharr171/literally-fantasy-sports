-- Published config versions are frozen: matches record the version they
-- used, so changing it later would change their replays (Step 4, D59).
-- Drafts can be edited freely by admins, then published once.

CREATE FUNCTION public.game_config_versions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Create config versions as drafts, then publish them';
    END IF;
    NEW.created_by := coalesce(NEW.created_by, (SELECT auth.uid()));
    RETURN NEW;
  END IF;
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Config version %/% is published and frozen', OLD.scope, OLD.version;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.scope <> OLD.scope OR NEW.version <> OLD.version THEN
    RAISE EXCEPTION 'A config version cannot be renumbered';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER game_config_versions_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.game_config_versions
  FOR EACH ROW EXECUTE FUNCTION public.game_config_versions_guard();--> statement-breakpoint

CREATE FUNCTION public.game_config_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  target_scope text := coalesce(NEW.scope, OLD.scope);
  target_version integer := coalesce(NEW.version, OLD.version);
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.game_config_versions v
    WHERE v.scope = target_scope AND v.version = target_version AND v.published_at IS NOT NULL
  ) OR (TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM public.game_config_versions v
    WHERE v.scope = OLD.scope AND v.version = OLD.version AND v.published_at IS NOT NULL
  )) THEN
    RAISE EXCEPTION 'Config version %/% is published and frozen', target_scope, target_version;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER game_config_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.game_config
  FOR EACH ROW EXECUTE FUNCTION public.game_config_guard();--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.game_config_versions_guard() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.game_config_guard() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

-- Signed-out visitors get nothing. Signed-in players may read published
-- versions; the row-level security policies limit every write to admins.
REVOKE ALL ON public.game_config_versions, public.game_config FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_config_versions, public.game_config TO authenticated;
