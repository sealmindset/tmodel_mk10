-- Migration: Drop legacy text column and set prompt_text as NOT NULL
ALTER TABLE threat_model.prompts DROP COLUMN IF EXISTS text;
ALTER TABLE threat_model.prompts ALTER COLUMN prompt_text SET NOT NULL;
