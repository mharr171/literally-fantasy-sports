CREATE TABLE "game_config" (
	"scope" text NOT NULL,
	"version" integer NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_config_scope_version_key_pk" PRIMARY KEY("scope","version","key"),
	CONSTRAINT "game_config_key_format" CHECK ("game_config"."key" ~ '^[a-z][a-z0-9_.]{0,63}$')
);
--> statement-breakpoint
ALTER TABLE "game_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "game_config_versions" (
	"scope" text NOT NULL,
	"version" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "game_config_versions_scope_version_pk" PRIMARY KEY("scope","version"),
	CONSTRAINT "game_config_versions_scope" CHECK ("game_config_versions"."scope" in ('global', 'soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "game_config_versions_version_positive" CHECK ("game_config_versions"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "game_config_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_config" ADD CONSTRAINT "game_config_scope_version_game_config_versions_scope_version_fk" FOREIGN KEY ("scope","version") REFERENCES "public"."game_config_versions"("scope","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_config_versions" ADD CONSTRAINT "game_config_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "game_config_select" ON "game_config" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select public.is_admin()) or exists (
        select 1 from public.game_config_versions v
        where v.scope = "game_config"."scope" and v.version = "game_config"."version" and v.published_at is not null
      ));--> statement-breakpoint
CREATE POLICY "game_config_insert_admin" ON "game_config" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "game_config_update_admin" ON "game_config" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "game_config_delete_admin" ON "game_config" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "game_config_versions_select" ON "game_config_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("game_config_versions"."published_at" is not null or (select public.is_admin()));--> statement-breakpoint
CREATE POLICY "game_config_versions_insert_admin" ON "game_config_versions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "game_config_versions_update_admin" ON "game_config_versions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));--> statement-breakpoint
CREATE POLICY "game_config_versions_delete_admin" ON "game_config_versions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select public.is_admin()));