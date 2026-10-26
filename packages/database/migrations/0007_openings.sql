CREATE TYPE "public"."opening_type" AS ENUM('door', 'window');
--> statement-breakpoint
CREATE TABLE "openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"floor_id" uuid NOT NULL,
	"wall_id" uuid NOT NULL,
	"type" "opening_type" NOT NULL,
	"offset" double precision NOT NULL,
	"width" double precision NOT NULL,
	"height" double precision NOT NULL DEFAULT 210,
	"sill_height" double precision NOT NULL DEFAULT 0,
	"flipped" boolean DEFAULT false NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "openings" ADD CONSTRAINT "openings_floor_id_floors_id_fk" FOREIGN KEY ("floor_id") REFERENCES "public"."floors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openings" ADD CONSTRAINT "openings_wall_id_walls_id_fk" FOREIGN KEY ("wall_id") REFERENCES "public"."walls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "openings_floor_idx" ON "openings" USING btree ("floor_id");--> statement-breakpoint
CREATE INDEX "openings_wall_idx" ON "openings" USING btree ("wall_id");