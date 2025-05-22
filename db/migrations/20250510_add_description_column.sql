-- Migration: Add description column to prompts table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'threat_model' 
          AND table_name = 'prompts' 
          AND column_name = 'description'
    ) THEN
        ALTER TABLE threat_model.prompts ADD COLUMN description TEXT;
    END IF;
END$$;
