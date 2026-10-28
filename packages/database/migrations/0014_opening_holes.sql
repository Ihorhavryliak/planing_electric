ALTER TYPE "public"."opening_type" ADD VALUE IF NOT EXISTS 'hole';--> statement-breakpoint
ALTER TABLE "openings" ADD COLUMN IF NOT EXISTS "diameter" double precision;
