ALTER TABLE "players" DROP CONSTRAINT "players_condition";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "form" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "morale" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_condition" CHECK ("players"."fitness" between 0 and 100 and "players"."injured_weeks" >= 0 and "players"."suspended_weeks" >= 0 and "players"."yellow_cards" >= 0 and "players"."form" between -1 and 1);--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_morale_range" CHECK ("teams"."morale" between -1 and 1);