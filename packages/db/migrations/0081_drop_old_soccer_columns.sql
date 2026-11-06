ALTER TABLE "players" DROP CONSTRAINT "players_condition";--> statement-breakpoint
DROP INDEX "player_careers_stat_games";--> statement-breakpoint
DROP INDEX "player_careers_stat_goals";--> statement-breakpoint
DROP INDEX "player_careers_assists";--> statement-breakpoint
DROP INDEX "player_careers_tackles";--> statement-breakpoint
DROP INDEX "player_careers_saves";--> statement-breakpoint
DROP INDEX "players_stat_games";--> statement-breakpoint
DROP INDEX "players_stat_goals";--> statement-breakpoint
DROP INDEX "players_assists";--> statement-breakpoint
DROP INDEX "players_tackles";--> statement-breakpoint
DROP INDEX "players_saves";--> statement-breakpoint
ALTER TABLE "matchday_squads" DROP COLUMN "formation";--> statement-breakpoint
ALTER TABLE "matchday_squads" DROP COLUMN "lineup";--> statement-breakpoint
ALTER TABLE "matchday_squads" DROP COLUMN "bench";--> statement-breakpoint
ALTER TABLE "matchday_squads" DROP COLUMN "sub_plan";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "stat_games";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "stat_goals";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "wins";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "draws";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "losses";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "assists";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "tackles";--> statement-breakpoint
ALTER TABLE "player_careers" DROP COLUMN "saves";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "injured_weeks";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "suspended_weeks";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "stat_games";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "stat_goals";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "wins";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "draws";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "losses";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "assists";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "tackles";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "saves";--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_condition" CHECK ("players"."fitness" between 0 and 100 and "players"."injured_days" >= 0 and "players"."suspended_games" >= 0 and "players"."yellow_cards" >= 0 and "players"."form" between -1 and 1);