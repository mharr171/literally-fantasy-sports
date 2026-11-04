-- Create a profile for every new account. The display name comes from the
-- Google profile name when there is one, otherwise the part of the email
-- before the "@". Players can change it later.
CREATE FUNCTION public.default_display_name(meta jsonb, email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT left(btrim(coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Manager'
  )), 40)
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.default_display_name(jsonb, text) FROM PUBLIC, anon, authenticated;--> statement-breakpoint

CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, public.default_display_name(new.raw_user_meta_data, new.email));
  RETURN new;
END;
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();--> statement-breakpoint

-- Accounts created before this migration get a profile too.
INSERT INTO public.profiles (id, display_name)
SELECT u.id, public.default_display_name(u.raw_user_meta_data, u.email)
FROM auth.users u
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

-- Supabase grants every table in "public" to anon and authenticated by default.
-- Narrow that: signed-out visitors get nothing, signed-in players can read
-- their own row (RLS) and change only their display name. Profiles are
-- created by the trigger above; is_admin is set by hand (D21).
REVOKE ALL ON public.profiles FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.profiles TO authenticated;--> statement-breakpoint
GRANT UPDATE (display_name) ON public.profiles TO authenticated;
