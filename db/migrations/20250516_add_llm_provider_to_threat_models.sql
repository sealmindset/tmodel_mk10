-- Migration: Add llm_provider column to threat_model.threat_models if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'threat_model' 
          AND table_name = 'threat_models' 
          AND column_name = 'llm_provider'
    ) THEN
        ALTER TABLE threat_model.threat_models ADD COLUMN llm_provider VARCHAR(32);
    END IF;
END$$;
