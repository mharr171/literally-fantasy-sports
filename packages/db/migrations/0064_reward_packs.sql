ALTER TABLE "packs" DROP CONSTRAINT "packs_kind";--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_kind" CHECK ("packs"."kind" in ('starter', 'bought', 'reward'));