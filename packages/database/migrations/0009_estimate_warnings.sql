ALTER TABLE "estimates" ADD COLUMN "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL;
