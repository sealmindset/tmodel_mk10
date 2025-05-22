-- Create settings table for application configuration
CREATE TABLE IF NOT EXISTS threat_model.settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    value_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create update trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION threat_model.update_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_settings_timestamp ON threat_model.settings;
CREATE TRIGGER update_settings_timestamp
BEFORE UPDATE ON threat_model.settings
FOR EACH ROW
EXECUTE FUNCTION threat_model.update_settings_timestamp();

-- Default settings to migrate from Redis
INSERT INTO threat_model.settings (key, value, value_type, description)
VALUES 
  ('llm.provider', 'ollama', 'string', 'Default LLM provider (ollama or openai)'),
  ('openai.api_model', 'gpt-3.5-turbo', 'string', 'Default OpenAI model'),
  ('ollama.model', 'llama3.3:latest', 'string', 'Default Ollama model')
ON CONFLICT (key) DO NOTHING;
