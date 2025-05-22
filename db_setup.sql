-- Create DB settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS threat_model.db_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create the trigger function
CREATE OR REPLACE FUNCTION threat_model.update_db_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS update_db_settings_timestamp ON threat_model.db_settings;
CREATE TRIGGER update_db_settings_timestamp
BEFORE UPDATE ON threat_model.db_settings
FOR EACH ROW
EXECUTE FUNCTION threat_model.update_db_settings_timestamp();

-- Insert default database connection settings
INSERT INTO threat_model.db_settings (key, value, description)
VALUES 
  ('POSTGRES_USER', 'postgres', 'PostgreSQL username'),
  ('POSTGRES_PASSWORD', 'postgres', 'PostgreSQL password'),
  ('POSTGRES_HOST', 'localhost', 'PostgreSQL host'),
  ('POSTGRES_PORT', '5432', 'PostgreSQL port'),
  ('POSTGRES_DB', 'postgres', 'PostgreSQL database name')
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
