-- Migration: Add category column to threats table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'threat_model' 
          AND table_name = 'threats' 
          AND column_name = 'category'
    ) THEN
        ALTER TABLE threat_model.threats ADD COLUMN category VARCHAR(100);
    END IF;
END$$;
