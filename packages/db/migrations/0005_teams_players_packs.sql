CREATE TABLE "packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"kind" text NOT NULL,
	"focus" text NOT NULL,
	"tier" text NOT NULL,
	"seed" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"kept" jsonb,
	CONSTRAINT "packs_sport" CHECK ("packs"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "packs_kind" CHECK ("packs"."kind" in ('starter', 'bought')),
	CONSTRAINT "packs_focus" CHECK ("packs"."focus" in ('attack', 'midfield', 'defence', 'goal', 'any')),
	CONSTRAINT "packs_resolved_after_opened" CHECK ("packs"."resolved_at" is null or ("packs"."opened_at" is not null and "packs"."resolved_at" >= "packs"."opened_at"))
);
--> statement-breakpoint
ALTER TABLE "packs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text NOT NULL,
	"nationality" text NOT NULL,
	"age" integer NOT NULL,
	"primary_position" text NOT NULL,
	"secondary_position" text,
	"attributes" jsonb NOT NULL,
	"overall" integer NOT NULL,
	"potential" integer NOT NULL,
	"potential_low" integer NOT NULL,
	"potential_high" integer NOT NULL,
	"worth" integer NOT NULL,
	"chemistry_color" integer NOT NULL,
	"template_variant" text DEFAULT 'default' NOT NULL,
	"from_starter_pack" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_sport" CHECK ("players"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "players_overall_range" CHECK ("players"."overall" between 1 and 99 and "players"."potential" between 1 and 99),
	CONSTRAINT "players_potential_range" CHECK ("players"."potential_low" <= "players"."potential_high" and "players"."potential_high" <= 99),
	CONSTRAINT "players_age_range" CHECK ("players"."age" between 14 and 50),
	CONSTRAINT "players_worth_nonnegative" CHECK ("players"."worth" >= 0)
);
--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"name" text NOT NULL,
	"elo" integer DEFAULT 1500 NOT NULL,
	"funds" integer DEFAULT 0 NOT NULL,
	"energy" integer DEFAULT 3 NOT NULL,
	"energy_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_sport" CHECK ("teams"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "teams_name_length" CHECK (char_length(btrim("teams"."name")) between 3 and 30),
	CONSTRAINT "teams_funds_nonnegative" CHECK ("teams"."funds" >= 0),
	CONSTRAINT "teams_energy_nonnegative" CHECK ("teams"."energy" >= 0)
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "packs_team" ON "packs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "players_team" ON "players" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_owner_sport" ON "teams" USING btree ("owner_id","sport");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_sport_name" ON "teams" USING btree ("sport",lower("name"));--> statement-breakpoint
CREATE POLICY "packs_select_own" ON "packs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.teams tm where tm.id = "packs"."team_id" and tm.owner_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "players_select_own" ON "players" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.teams tm where tm.id = "players"."team_id" and tm.owner_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "teams_select_own" ON "teams" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("teams"."owner_id" = (select auth.uid()));