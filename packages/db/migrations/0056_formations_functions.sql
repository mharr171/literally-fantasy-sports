-- Formations (D140, D172): only the server writes; signed-in players read.
-- A formation's sport, id, slots and built-in flag never change once it
-- exists, and none is ever deleted, so matches that used it replay the same.
-- Admins only turn formations on and off.
REVOKE ALL ON public.formations FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.formations TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.formations TO service_role;--> statement-breakpoint

CREATE FUNCTION public.formations_fixed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'formations are never deleted; turn it off instead';
  END IF;
  IF NEW.sport IS DISTINCT FROM OLD.sport OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.slots IS DISTINCT FROM OLD.slots OR NEW.built_in IS DISTINCT FROM OLD.built_in THEN
    RAISE EXCEPTION 'a formation can''t be changed once made; create a new one';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER formations_fixed
BEFORE UPDATE OR DELETE ON public.formations
FOR EACH ROW EXECUTE FUNCTION public.formations_fixed();--> statement-breakpoint

-- The built-in presets (D88), all on.
INSERT INTO public.formations (sport, id, built_in, enabled)
VALUES ('soccer', '4-4-2', true, true), ('soccer', '4-3-3', true, true),
       ('soccer', '4-2-3-1', true, true), ('soccer', '4-1-4-1', true, true),
       ('soccer', '3-5-2', true, true), ('soccer', '5-3-2', true, true)
ON CONFLICT DO NOTHING;
