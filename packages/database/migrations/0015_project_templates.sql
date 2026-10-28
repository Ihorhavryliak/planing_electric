CREATE TABLE "project_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"preview_svg" text NOT NULL,
	"plan_payload" jsonb NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_templates_code_unique" ON "project_templates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "project_templates_public_idx" ON "project_templates" USING btree ("is_public");
