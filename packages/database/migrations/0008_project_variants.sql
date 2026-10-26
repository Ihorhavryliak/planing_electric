CREATE TYPE "public"."variant_status" AS ENUM('active', 'archived');
--> statement-breakpoint
CREATE TABLE "project_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "variant_status" DEFAULT 'active' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_variants" ADD CONSTRAINT "project_variants_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_variants_project_idx" ON "project_variants" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_variants_project_name_unique" ON "project_variants" USING btree ("project_id","name");