CREATE TABLE "account_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"sport" text NOT NULL,
	"season_id" uuid,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"season_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_progress_sport" CHECK ("account_progress"."sport" in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')),
	CONSTRAINT "account_progress_kind" CHECK ("account_progress"."kind" in ('season_played', 'title', 'final', 'best_elo'))
);
--> statement-breakpoint
ALTER TABLE "account_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account_progress" ADD CONSTRAINT "account_progress_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_progress" ADD CONSTRAINT "account_progress_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_progress_once" ON "account_progress" USING btree ("season_id","kind");--> statement-breakpoint
CREATE INDEX "account_progress_owner" ON "account_progress" USING btree ("owner_id","sport");--> statement-breakpoint
CREATE POLICY "account_progress_select_own" ON "account_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("account_progress"."owner_id" = (select auth.uid()));