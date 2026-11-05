CREATE TABLE "formations" (
	"sport" text NOT NULL,
	"id" text NOT NULL,
	"slots" jsonb,
	"built_in" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "formations_sport_id_pk" PRIMARY KEY("sport","id"),
	CONSTRAINT "formations_sport" CHECK ("formations"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "formations_id" CHECK ("formations"."id" ~ '^[0-9]([0-9-]*[0-9])?[a-z]{0,2}$' and length("formations"."id") <= 16),
	CONSTRAINT "formations_slots" CHECK (("formations"."built_in" and "formations"."slots" is null) or (not "formations"."built_in" and jsonb_typeof("formations"."slots") = 'array' and jsonb_array_length("formations"."slots") = 11))
);
--> statement-breakpoint
ALTER TABLE "formations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "formations_select" ON "formations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);