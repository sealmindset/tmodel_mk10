-- Migration: Fix NULL prompt_text values and set NOT NULL constraint
UPDATE threat_model.prompts SET prompt_text = '' WHERE prompt_text IS NULL;
ALTER TABLE threat_model.prompts ALTER COLUMN prompt_text SET NOT NULL;
