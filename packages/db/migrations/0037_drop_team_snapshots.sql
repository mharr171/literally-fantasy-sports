ALTER TABLE "season_records" DROP CONSTRAINT "season_records_snapshot_id_team_snapshots_id_fk";
--> statement-breakpoint
ALTER TABLE "season_teams" DROP CONSTRAINT "season_teams_snapshot_id_team_snapshots_id_fk";
--> statement-breakpoint
ALTER TABLE "season_records" DROP COLUMN "snapshot_id";--> statement-breakpoint
ALTER TABLE "season_teams" DROP COLUMN "snapshot_id";--> statement-breakpoint
DROP TABLE "team_snapshots";
