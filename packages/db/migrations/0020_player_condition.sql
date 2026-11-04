ALTER TABLE "players" ADD COLUMN "fitness" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "injured_weeks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "suspended_weeks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "yellow_cards" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_condition" CHECK ("players"."fitness" between 0 and 100 and "players"."injured_weeks" >= 0 and "players"."suspended_weeks" >= 0 and "players"."yellow_cards" >= 0);