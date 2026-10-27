-- Initialize the signaling section on existing plans. Loops live in the
-- calculation_settings JSONB document, alongside circuits/electrical settings.
UPDATE "plans"
SET "calculation_settings" = jsonb_set(
  "calculation_settings",
  '{signaling}',
  '{"loops":[]}'::jsonb,
  true
)
WHERE NOT ("calculation_settings" ? 'signaling');--> statement-breakpoint

-- Route discipline for signaling cables; existing routes remain power.
UPDATE "cable_routes"
SET "settings" = jsonb_set("settings", '{system}', '"power"'::jsonb, true)
WHERE NOT ("settings" ? 'system');
