-- Admins count as admins only when signed in with two-factor (M5, D103):
-- the session's JWT must be at assurance level aal2. A stolen password or
-- magic link alone can't read drafts or change any game setting.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT auth.jwt() ->> 'aal'), '') = 'aal2'
    AND coalesce(
      (SELECT p.is_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())),
      false
    )
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
