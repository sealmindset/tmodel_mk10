-- Migration: Add response_text column to threat_model.threat_models if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'threat_model' 
          AND table_name = 'threat_models' 
          AND column_name = 'response_text'
    ) THEN
        ALTER TABLE threat_model.threat_models ADD COLUMN response_text TEXT;
    END IF;
END$$;
