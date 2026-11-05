ALTER TABLE "packs" ADD COLUMN "elo_shift" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "excluded_colors" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_choice" CHECK ("packs"."elo_shift" between -10 and 15 and cardinality("packs"."excluded_colors") <= 3);