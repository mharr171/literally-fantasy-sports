CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"clubs" integer DEFAULT 0 NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"ran" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"weeks_played" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "ai_runs_sport" CHECK ("ai_runs"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey'))
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "ai_runs_started" ON "ai_runs" USING btree ("started_at");