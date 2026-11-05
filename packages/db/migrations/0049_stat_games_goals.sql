ALTER TABLE "player_careers" ADD COLUMN "stat_games" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_careers" ADD COLUMN "stat_goals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "stat_games" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "stat_goals" integer DEFAULT 0 NOT NULL;