CREATE TABLE "matchday_squads" (
	"team_id" uuid PRIMARY KEY NOT NULL,
	"formation" text NOT NULL,
	"lineup" jsonb NOT NULL,
	"bench" jsonb NOT NULL,
	"sub_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matchday_squads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "matchday_squads" ADD CONSTRAINT "matchday_squads_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "matchday_squads_select_own" ON "matchday_squads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.teams tm where tm.id = "matchday_squads"."team_id" and tm.owner_id = (select auth.uid())));