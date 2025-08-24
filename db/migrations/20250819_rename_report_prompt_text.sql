-- Rename column prompt_text -> report_prompt_text on threat_model.report_prompts
-- Safe, idempotent-ish pattern with guard
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'threat_model' 
      AND table_name = 'report_prompts' 
      AND column_name = 'prompt_text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'threat_model' 
      AND table_name = 'report_prompts' 
      AND column_name = 'report_prompt_text'
  ) THEN
    ALTER TABLE threat_model.report_prompts RENAME COLUMN prompt_text TO report_prompt_text;
  END IF;

  -- Update comment if present
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'threat_model' AND c.relname = 'report_prompts' AND a.attname = 'report_prompt_text'
  ) THEN
    COMMENT ON COLUMN threat_model.report_prompts.report_prompt_text IS 'The actual text of the LLM prompt for reports, potentially with placeholders.';
  END IF;
END $$;
