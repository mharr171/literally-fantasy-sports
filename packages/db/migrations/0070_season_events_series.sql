ALTER TABLE "fixtures" DROP CONSTRAINT "fixtures_stage";--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "event" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "game_no" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sport_settings" ADD COLUMN "league_size" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_event" CHECK ("fixtures"."event" ~ '^[a-z][a-z0-9_]{0,23}$');--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_game_no" CHECK ("fixtures"."game_no" between 1 and 9);--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_stage" CHECK ("fixtures"."stage" ~ '^[a-z][a-z0-9_]{0,23}$');--> statement-breakpoint
ALTER TABLE "sport_settings" ADD CONSTRAINT "sport_settings_league_size" CHECK ("sport_settings"."league_size" between 4 and 30);