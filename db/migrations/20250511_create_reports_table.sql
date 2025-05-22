-- Migration: Create reports table for threat model dashboard
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'threat_model' 
          AND table_name = 'reports'
    ) THEN
        CREATE TABLE threat_model.reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END$$;

-- Trigger to auto-update updated_at on row update
CREATE OR REPLACE FUNCTION threat_model.update_reports_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_on_reports ON threat_model.reports;
CREATE TRIGGER set_updated_at_on_reports
BEFORE UPDATE ON threat_model.reports
FOR EACH ROW EXECUTE PROCEDURE threat_model.update_reports_updated_at_column();
