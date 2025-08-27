-- Report Template Microservice Schema
-- Schema: report_templates

CREATE SCHEMA IF NOT EXISTS report_templates;

-- Core template metadata
CREATE TABLE IF NOT EXISTS report_templates.template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    latest_version_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versioned content table
CREATE TABLE IF NOT EXISTS report_templates.template_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES report_templates.template(id) ON DELETE CASCADE,
    version INT NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintain latest_version_id via trigger
CREATE OR REPLACE FUNCTION report_templates.set_latest_version()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE report_templates.template
    SET latest_version_id = NEW.id,
        updated_at = NOW()
    WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_latest_version ON report_templates.template_version;
CREATE TRIGGER tr_set_latest_version
AFTER INSERT ON report_templates.template_version
FOR EACH ROW EXECUTE FUNCTION report_templates.set_latest_version();

-- Basic RLS: allow read to all, write to role "template_editor"
ALTER TABLE report_templates.template ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates.template_version ENABLE ROW LEVEL SECURITY;

-- Guard against duplicate policy creation when re-running this file
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'report_templates' AND tablename = 'template' AND policyname = 'read_templates'
  ) THEN
    EXECUTE 'CREATE POLICY read_templates ON report_templates.template FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'report_templates' AND tablename = 'template_version' AND policyname = 'read_template_version'
  ) THEN
    EXECUTE 'CREATE POLICY read_template_version ON report_templates.template_version FOR SELECT USING (true)';
  END IF;

  -- Write policies: use FOR ALL (covers INSERT/UPDATE/DELETE) for compatibility across PG versions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'report_templates' AND tablename = 'template' AND policyname = 'write_templates'
  ) THEN
    EXECUTE 'CREATE POLICY write_templates ON report_templates.template FOR ALL TO template_editor USING (true) WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'report_templates' AND tablename = 'template_version' AND policyname = 'write_template_version'
  ) THEN
    EXECUTE 'CREATE POLICY write_template_version ON report_templates.template_version FOR ALL TO template_editor USING (true) WITH CHECK (true)';
  END IF;
END
$$;
