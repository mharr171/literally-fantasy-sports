ALTER TABLE "seasons" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "review" jsonb;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "intake_taken" jsonb;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "intake_resolved_at" timestamp with time zone;