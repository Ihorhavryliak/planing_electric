CREATE TYPE "public"."estimate_type" AS ENUM('power', 'signaling');--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "type" "estimate_type" DEFAULT 'power' NOT NULL;
