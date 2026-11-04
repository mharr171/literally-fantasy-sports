CREATE TABLE "sport_settings" (
	"sport" text PRIMARY KEY NOT NULL,
	"energy_enabled" boolean DEFAULT true NOT NULL,
	"energy_refill_minutes" integer DEFAULT 15 NOT NULL,
	"energy_max" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sport_settings_sport" CHECK ("sport_settings"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "sport_settings_energy" CHECK ("sport_settings"."energy_refill_minutes" between 1 and 1440 and "sport_settings"."energy_max" between 1 and 20)
);
--> statement-breakpoint
ALTER TABLE "sport_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sport_settings_select" ON "sport_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "sport_settings_update_admin" ON "sport_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));