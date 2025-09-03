-- RTG schema and tables
-- Uses UUID id PK and api_id bigserial unique, per project conventions
-- Safe to run multiple times with IF NOT EXISTS guards

BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema 'reports' if not exists
CREATE SCHEMA IF NOT EXISTS reports;

-- report_templates: latest editable record per template name
CREATE TABLE IF NOT EXISTS reports.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id bigserial UNIQUE,
  name text NOT NULL UNIQUE,
  description text,
  content_md text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- report_template_versions: immutable versioned content per template
CREATE TABLE IF NOT EXISTS reports.report_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id bigserial UNIQUE,
  template_id uuid NOT NULL REFERENCES reports.report_templates(id) ON DELETE CASCADE,
  version int NOT NULL,
  content_md text NOT NULL,
  changelog text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_template_version UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_rtv_template_id ON reports.report_template_versions(template_id);

-- generated_reports: output from LLM tied to template version and project
CREATE TABLE IF NOT EXISTS reports.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id bigserial UNIQUE,
  template_id uuid NOT NULL REFERENCES reports.report_templates(id) ON DELETE SET NULL,
  template_version int NOT NULL,
  project_id uuid NOT NULL,
  output_md text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gr_project_id ON reports.generated_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_gr_template_id ON reports.generated_reports(template_id);

-- Helper function to auto-create a version row when inserting/updating templates
CREATE OR REPLACE FUNCTION reports.fn_template_version_upsert()
RETURNS trigger AS $$
DECLARE
  next_version int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    next_version := 1;
    INSERT INTO reports.report_template_versions (template_id, version, content_md, changelog, created_by)
    VALUES (NEW.id, next_version, NEW.content_md, 'initial', NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- increment from current max version
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM reports.report_template_versions WHERE template_id = NEW.id;
    INSERT INTO reports.report_template_versions (template_id, version, content_md, changelog, created_by)
    VALUES (NEW.id, next_version, NEW.content_md, 'auto version on update', NEW.created_by);
    NEW.updated_at = now();
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_template_version_insert ON reports.report_templates;
CREATE TRIGGER trg_template_version_insert
AFTER INSERT ON reports.report_templates
FOR EACH ROW EXECUTE FUNCTION reports.fn_template_version_upsert();

DROP TRIGGER IF EXISTS trg_template_version_update ON reports.report_templates;
CREATE TRIGGER trg_template_version_update
AFTER UPDATE OF content_md ON reports.report_templates
FOR EACH ROW EXECUTE FUNCTION reports.fn_template_version_upsert();

-- Optional: views to expose via PostgREST using api_id aliases
-- By convention, expose api views with numeric id and include uuid as uuid
CREATE SCHEMA IF NOT EXISTS api;

CREATE OR REPLACE VIEW api.report_templates AS
SELECT rt.api_id AS id,
       rt.id AS uuid,
       rt.name,
       rt.description,
       rt.content_md,
       rt.created_by,
       rt.created_at,
       rt.updated_at
FROM reports.report_templates rt;

CREATE OR REPLACE VIEW api.report_template_versions AS
SELECT rtv.api_id AS id,
       rtv.id AS uuid,
       rtv.template_id,
       rtv.version,
       rtv.content_md,
       rtv.changelog,
       rtv.created_by,
       rtv.created_at
FROM reports.report_template_versions rtv;

CREATE OR REPLACE VIEW api.generated_reports AS
SELECT gr.api_id AS id,
       gr.id AS uuid,
       gr.template_id,
       gr.template_version,
       gr.project_id,
       gr.output_md,
       gr.created_by,
       gr.created_at
FROM reports.generated_reports gr;

COMMIT;
