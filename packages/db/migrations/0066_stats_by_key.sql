ALTER TABLE "player_careers" ADD COLUMN "stats" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "stats" jsonb DEFAULT '{}'::jsonb NOT NULL;