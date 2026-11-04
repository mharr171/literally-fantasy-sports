-- True when the signed-in user's profile has is_admin set (D21). Used by
-- row-level security policies on admin-only tables. SECURITY DEFINER so it
-- can read profiles regardless of the caller's own policies; it only ever
-- reveals the caller's own flag.
CREATE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = (SELECT auth.uid())),
    false
  )
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
