ALTER TABLE "cable_routes" ADD COLUMN "start_point_id" uuid;--> statement-breakpoint
ALTER TABLE "cable_routes" ADD COLUMN "end_point_id" uuid;--> statement-breakpoint
ALTER TABLE "cable_routes" ADD CONSTRAINT "cable_routes_start_point_id_electrical_points_id_fk" FOREIGN KEY ("start_point_id") REFERENCES "public"."electrical_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cable_routes" ADD CONSTRAINT "cable_routes_end_point_id_electrical_points_id_fk" FOREIGN KEY ("end_point_id") REFERENCES "public"."electrical_points"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "cable_routes" AS r
SET "start_point_id" = p."id"
FROM "electrical_points" AS p
WHERE p."floor_id" = r."floor_id"
  AND (r."geometry"->0->>'x')::double precision = p."x"
  AND (r."geometry"->0->>'y')::double precision = p."y";--> statement-breakpoint
UPDATE "cable_routes" AS r
SET "end_point_id" = p."id"
FROM "electrical_points" AS p
WHERE p."floor_id" = r."floor_id"
  AND (r."geometry"->(jsonb_array_length(r."geometry") - 1)->>'x')::double precision = p."x"
  AND (r."geometry"->(jsonb_array_length(r."geometry") - 1)->>'y')::double precision = p."y";
