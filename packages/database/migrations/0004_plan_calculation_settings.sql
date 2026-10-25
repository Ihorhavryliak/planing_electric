ALTER TABLE "plans" ADD COLUMN "calculation_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
