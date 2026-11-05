CREATE TABLE "ai_settings" (
	"sport" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"pool_size" integer DEFAULT 250 NOT NULL,
	"runs_per_day" integer DEFAULT 12 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_sport" CHECK ("ai_settings"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "ai_settings_limits" CHECK ("ai_settings"."pool_size" between 0 and 1000 and "ai_settings"."runs_per_day" between 1 and 48)
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "kind" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "manager_name" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "ai" jsonb;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_kind" CHECK (("teams"."kind" = 'human' and "teams"."owner_id" is not null and "teams"."ai" is null) or ("teams"."kind" = 'ai' and "teams"."owner_id" is null and "teams"."manager_name" is not null and "teams"."ai" is not null));