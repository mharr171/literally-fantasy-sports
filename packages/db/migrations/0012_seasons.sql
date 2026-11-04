CREATE TABLE "fixtures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"week" integer NOT NULL,
	"stage" text NOT NULL,
	"home_slot" integer NOT NULL,
	"away_slot" integer NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"winner" text,
	"summary" jsonb,
	"played_at" timestamp with time zone,
	CONSTRAINT "fixtures_stage" CHECK ("fixtures"."stage" in ('league', 'semi', 'final')),
	CONSTRAINT "fixtures_winner" CHECK ("fixtures"."winner" is null or "fixtures"."winner" in ('home', 'away')),
	CONSTRAINT "fixtures_two_teams" CHECK ("fixtures"."home_slot" <> "fixtures"."away_slot")
);
--> statement-breakpoint
ALTER TABLE "fixtures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "season_teams" (
	"season_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"start_rating" integer NOT NULL,
	"elo" integer NOT NULL,
	CONSTRAINT "season_teams_season_id_slot_pk" PRIMARY KEY("season_id","slot"),
	CONSTRAINT "season_teams_kind" CHECK ("season_teams"."kind" in ('manager', 'ai', 'ghost'))
);
--> statement-breakpoint
ALTER TABLE "season_teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'regular' NOT NULL,
	"week" integer DEFAULT 1 NOT NULL,
	"seed" text NOT NULL,
	"start_elo" integer NOT NULL,
	"config_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "seasons_sport" CHECK ("seasons"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "seasons_status" CHECK ("seasons"."status" in ('regular', 'playoffs', 'finished'))
);
--> statement-breakpoint
ALTER TABLE "seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixtures_season_week" ON "fixtures" USING btree ("season_id","week");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_team_number" ON "seasons" USING btree ("team_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_active" ON "seasons" USING btree ("team_id") WHERE "seasons"."status" <> 'finished';--> statement-breakpoint
CREATE POLICY "fixtures_select_own" ON "fixtures" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.seasons s join public.teams tm on tm.id = s.team_id where s.id = "fixtures"."season_id" and tm.owner_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "season_teams_select_own" ON "season_teams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.seasons s join public.teams tm on tm.id = s.team_id where s.id = "season_teams"."season_id" and tm.owner_id = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "seasons_select_own" ON "seasons" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.teams tm where tm.id = "seasons"."team_id" and tm.owner_id = (select auth.uid())));