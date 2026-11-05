CREATE TABLE "player_careers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text NOT NULL,
	"nationality" text NOT NULL,
	"primary_position" text NOT NULL,
	"retired_age" integer NOT NULL,
	"seasons" integer NOT NULL,
	"appearances" integer NOT NULL,
	"goals" integer NOT NULL,
	"best_overall" integer NOT NULL,
	"clubs" text[] NOT NULL,
	"retired_season" integer NOT NULL,
	"retired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_careers_sport" CHECK ("player_careers"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey'))
);
--> statement-breakpoint
ALTER TABLE "player_careers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "season_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"season_id" uuid,
	"sport" text NOT NULL,
	"season_number" integer NOT NULL,
	"team_name" text NOT NULL,
	"colors" text[] DEFAULT '{}'::text[] NOT NULL,
	"elo_before" integer NOT NULL,
	"elo_after" integer NOT NULL,
	"position" integer NOT NULL,
	"played" integer NOT NULL,
	"won" integer NOT NULL,
	"drawn" integer NOT NULL,
	"lost" integer NOT NULL,
	"scored" integer NOT NULL,
	"conceded" integer NOT NULL,
	"points" integer NOT NULL,
	"playoffs" text NOT NULL,
	"snapshot_id" uuid,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_records_sport" CHECK ("season_records"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "season_records_playoffs" CHECK ("season_records"."playoffs" in ('none', 'quarter', 'semi', 'final', 'champion'))
);
--> statement-breakpoint
ALTER TABLE "season_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "appearances" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "goals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "seasons" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "best_overall" integer;--> statement-breakpoint
ALTER TABLE "player_careers" ADD CONSTRAINT "player_careers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_snapshot_id_team_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."team_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_careers_team" ON "player_careers" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "season_records_season" ON "season_records" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "season_records_sport_elo" ON "season_records" USING btree ("sport","elo_after");--> statement-breakpoint
CREATE INDEX "season_records_team" ON "season_records" USING btree ("team_id");