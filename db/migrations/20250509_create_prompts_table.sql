-- Migration: Create prompts table for LLM prompt storage
CREATE TABLE IF NOT EXISTS threat_model.prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to auto-update updated_at on row update
CREATE OR REPLACE FUNCTION threat_model.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_on_prompts ON threat_model.prompts;
CREATE TRIGGER set_updated_at_on_prompts
BEFORE UPDATE ON threat_model.prompts
FOR EACH ROW EXECUTE PROCEDURE threat_model.update_updated_at_column();
