ALTER TABLE "users" ADD COLUMN "onboarding" jsonb NOT NULL DEFAULT '{}'::jsonb;
