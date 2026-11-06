ALTER TABLE "packs" DROP CONSTRAINT "packs_focus";--> statement-breakpoint
ALTER TABLE "season_records" DROP CONSTRAINT "season_records_playoffs";--> statement-breakpoint
ALTER TABLE "fixtures" ADD COLUMN "skipped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rest_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "traits" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_skipped_unplayed" CHECK (not "fixtures"."skipped" or "fixtures"."home_score" is null);--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_focus" CHECK (("packs"."sport" = 'soccer' and "packs"."focus" in ('attack', 'midfield', 'defence', 'goal', 'any')) or ("packs"."sport" = 'baseball' and "packs"."focus" in ('starters', 'relievers', 'infield', 'outfield', 'any')));--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_rest_days" CHECK ("players"."rest_days" between 0 and 30);--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_traits" CHECK (jsonb_typeof("players"."traits") = 'object');--> statement-breakpoint
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_playoffs" CHECK ("season_records"."playoffs" in ('none', 'wildcard', 'quarter', 'semi', 'final', 'champion'));--> statement-breakpoint
-- Managers read their own players' rest days and traits (ADR 0009 §3, §4).
GRANT SELECT (rest_days, traits) ON public.players TO authenticated;