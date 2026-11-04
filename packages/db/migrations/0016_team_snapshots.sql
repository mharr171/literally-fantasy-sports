CREATE TABLE "team_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"team_name" text NOT NULL,
	"season_number" integer NOT NULL,
	"elo" integer NOT NULL,
	"players" jsonb NOT NULL,
	"squad" jsonb NOT NULL,
	"stats" jsonb NOT NULL,
	"game_version" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_snapshots_sport" CHECK ("team_snapshots"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey'))
);
--> statement-breakpoint
ALTER TABLE "team_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "season_teams" ADD COLUMN "snapshot_id" uuid;--> statement-breakpoint
ALTER TABLE "team_snapshots" ADD CONSTRAINT "team_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_snapshots" ADD CONSTRAINT "team_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_snapshots_season" ON "team_snapshots" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "team_snapshots_sport_elo" ON "team_snapshots" USING btree ("sport","elo");--> statement-breakpoint
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_snapshot_id_team_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."team_snapshots"("id") ON DELETE set null ON UPDATE no action;