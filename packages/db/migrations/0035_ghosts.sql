CREATE TABLE "ghosts" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"season_id" uuid,
	"sport" text NOT NULL,
	"team_name" text NOT NULL,
	"season_number" integer NOT NULL,
	"elo" integer NOT NULL,
	"players" jsonb NOT NULL,
	"squad" jsonb NOT NULL,
	"game_version" text NOT NULL,
	"frozen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ghosts_sport" CHECK ("ghosts"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey'))
);
--> statement-breakpoint
ALTER TABLE "ghosts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "season_teams" ADD COLUMN "source_team_id" uuid;--> statement-breakpoint
ALTER TABLE "season_teams" ADD COLUMN "clone" jsonb;--> statement-breakpoint
ALTER TABLE "ghosts" ADD CONSTRAINT "ghosts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghosts" ADD CONSTRAINT "ghosts_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ghosts_sport_elo" ON "ghosts" USING btree ("sport","elo");--> statement-breakpoint
ALTER TABLE "season_teams" ADD CONSTRAINT "season_teams_source_team_id_teams_id_fk" FOREIGN KEY ("source_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;