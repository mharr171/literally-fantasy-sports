-- Admins can read the log (row-level security checks is_admin); only the
-- server writes it, after checking the caller is an admin.
REVOKE ALL ON public.admin_actions FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.admin_actions TO authenticated;
