-- Threat Modeler Mk10 - Full Database Initialization Script
-- Purpose: Recreate the entire PostgreSQL schema from scratch with all objects required by the app,
-- including RAG (pgvector) storage, without inserting any sample data.
--
-- Notes:
-- - This script is idempotent where practical (IF NOT EXISTS used liberally).
-- - It creates required extensions, schema, tables, indexes, views, and triggers.
-- - No data is inserted (no seeds). Configure app settings via the app or API.
--
-- Recommended psql invocation:
--   psql -h localhost -U postgres -d postgres -f db/full_init.sql

BEGIN;

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;         -- pgvector for embeddings

-- 2) Schema
CREATE SCHEMA IF NOT EXISTS threat_model;
SET search_path TO threat_model, public;

-- 3) Common trigger function for updated_at columns
CREATE OR REPLACE FUNCTION threat_model.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Core domain tables
-- Projects
CREATE TABLE IF NOT EXISTS threat_model.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  business_unit VARCHAR(100),
  criticality VARCHAR(20) CHECK (criticality IN ('Critical','High','Medium','Low')),
  data_classification VARCHAR(50),
  status VARCHAR(30) DEFAULT 'Active' CHECK (status IN ('Active','Archived','Draft','Planning','Development','Maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100),
  last_updated_by VARCHAR(100),
  last_vulnerability_sync TIMESTAMPTZ
);

-- Components
CREATE TABLE IF NOT EXISTS threat_model.components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  hostname VARCHAR(255),
  ip_address VARCHAR(45),
  type VARCHAR(50),
  description TEXT,
  version VARCHAR(30),
  is_reusable BOOLEAN DEFAULT TRUE,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100)
);

-- Project-Components junction
CREATE TABLE IF NOT EXISTS threat_model.project_components (
  project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  component_id UUID REFERENCES threat_model.components(id) ON DELETE CASCADE,
  notes TEXT,
  PRIMARY KEY (project_id, component_id)
);

-- Threat Models
CREATE TABLE IF NOT EXISTS threat_model.threat_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  component_id UUID REFERENCES threat_model.components(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  risk_score NUMERIC(5,2) CHECK (risk_score BETWEEN 0 AND 100),
  model_data JSONB,
  response_text TEXT,
  source VARCHAR(100),
  llm_provider VARCHAR(32),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100)
);

-- Threats
CREATE TABLE IF NOT EXISTS threat_model.threats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  threat_model_id UUID REFERENCES threat_model.threat_models(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  threat_type VARCHAR(50),
  likelihood INT CHECK (likelihood BETWEEN 1 AND 5),
  impact INT CHECK (impact BETWEEN 1 AND 5),
  risk_score INT GENERATED ALWAYS AS (likelihood * impact) STORED,
  status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open','Mitigated','Accepted','Transferred')),
  category VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safeguards
CREATE TABLE IF NOT EXISTS threat_model.safeguards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  threat_id UUID REFERENCES threat_model.threats(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  description TEXT,
  effectiveness INT CHECK (effectiveness BETWEEN 0 AND 100),
  implementation_status VARCHAR(20) CHECK (implementation_status IN ('Planned','Implemented','Verified','N/A')),
  implementation_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Vulnerabilities and related
CREATE TABLE IF NOT EXISTS threat_model.vulnerabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id UUID REFERENCES threat_model.components(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  severity VARCHAR(20) CHECK (severity IN ('Critical','High','Medium','Low','Info')),
  cve_id VARCHAR(20),
  status VARCHAR(30) DEFAULT 'Open' CHECK (status IN ('Open','Fixed','In Progress','Won''t Fix','False Positive')),
  remediation TEXT,
  discovered_date TIMESTAMPTZ DEFAULT NOW(),
  fixed_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cvss_score NUMERIC(3,1)
);

CREATE TABLE IF NOT EXISTS threat_model.vulnerability_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  scan_date TIMESTAMPTZ DEFAULT NOW(),
  scan_tool VARCHAR(100),
  scan_type VARCHAR(50),
  scan_result JSONB,
  vulnerabilities_found INT DEFAULT 0,
  scan_status VARCHAR(20) DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) Additional relations
-- Threat Model <-> Threats junction
CREATE TABLE IF NOT EXISTS threat_model.threat_model_threats (
  threat_model_id UUID REFERENCES threat_model.threat_models(id) ON DELETE CASCADE,
  threat_id UUID REFERENCES threat_model.threats(id) ON DELETE CASCADE,
  notes TEXT,
  PRIMARY KEY (threat_model_id, threat_id)
);

-- Project <-> Threat Models M:N
CREATE TABLE IF NOT EXISTS threat_model.project_threat_models (
  project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  threat_model_id UUID REFERENCES threat_model.threat_models(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by VARCHAR(100),
  notes TEXT,
  PRIMARY KEY (project_id, threat_model_id)
);

-- Component relations
CREATE TABLE IF NOT EXISTS threat_model.component_safeguards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES threat_model.components(id) ON DELETE CASCADE,
  safeguard_id UUID NOT NULL REFERENCES threat_model.safeguards(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'Planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (component_id, safeguard_id)
);

CREATE TABLE IF NOT EXISTS threat_model.component_vulnerabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES threat_model.components(id) ON DELETE CASCADE,
  vulnerability_id UUID NOT NULL REFERENCES threat_model.vulnerabilities(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'Open',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (component_id, vulnerability_id)
);

CREATE TABLE IF NOT EXISTS threat_model.component_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES threat_model.components(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (component_id, tag)
);

-- 7) Reporting, prompts, logs, settings
CREATE TABLE IF NOT EXISTS threat_model.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_model.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_model.results (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  project_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_model.report_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  prompt_text TEXT NOT NULL,
  llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
  llm_model VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
  is_default BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100) DEFAULT 'system',
  updated_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_model.app_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level VARCHAR(10) NOT NULL,
  module VARCHAR(255),
  message TEXT NOT NULL,
  data TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS threat_model.settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  value_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_model.llm_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  task_type TEXT,
  model_provider TEXT,
  model_name TEXT,
  tokens_prompt INT,
  tokens_completion INT,
  tokens_total INT,
  cost_usd NUMERIC(10,6),
  currency TEXT,
  prompt TEXT,
  response TEXT,
  meta JSONB
);

-- 8) Reference Architecture
CREATE TABLE IF NOT EXISTS threat_model.reference_architecture_category (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS threat_model.reference_architecture_option (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES threat_model.reference_architecture_category(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS threat_model.safeguard_reference_architecture (
  safeguard_id UUID NOT NULL REFERENCES threat_model.safeguards(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES threat_model.reference_architecture_category(id),
  option_id INT NOT NULL REFERENCES threat_model.reference_architecture_option(id),
  color VARCHAR(20) NOT NULL,
  PRIMARY KEY (safeguard_id, option_id)
);

-- 9) RAG storage (pgvector)
CREATE TABLE IF NOT EXISTS threat_model.rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table TEXT NOT NULL,             -- 'threat_models_response' | 'threat_models_prompt'
  record_id UUID NOT NULL,                -- original threat_model id
  section TEXT NULL,                      -- 'threat' | 'prompt'
  threat_title TEXT NULL,                 -- parsed from "Threat: <title>"
  content TEXT NOT NULL,                  -- exact text for the single threat (or prompt)
  content_hash TEXT NOT NULL,             -- sha256(record_id + threat_title + content)
  tokens INT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_score NUMERIC(4,2) NULL,
  embedding VECTOR(1536) NOT NULL,        -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10) Indexes
-- Core
CREATE INDEX IF NOT EXISTS idx_projects_business_unit ON threat_model.projects(business_unit);
CREATE INDEX IF NOT EXISTS idx_projects_criticality   ON threat_model.projects(criticality);
CREATE INDEX IF NOT EXISTS idx_projects_status        ON threat_model.projects(status);
CREATE INDEX IF NOT EXISTS idx_project_components_project_id  ON threat_model.project_components(project_id);
CREATE INDEX IF NOT EXISTS idx_project_components_component_id ON threat_model.project_components(component_id);
CREATE INDEX IF NOT EXISTS idx_threat_models_project_id ON threat_model.threat_models(project_id);
CREATE INDEX IF NOT EXISTS idx_threats_threat_model_id ON threat_model.threats(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_threats_status          ON threat_model.threats(status);
CREATE INDEX IF NOT EXISTS idx_safeguards_threat_id    ON threat_model.safeguards(threat_id);

-- Vulnerabilities
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_component_id ON threat_model.vulnerabilities(component_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity     ON threat_model.vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status       ON threat_model.vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_project_id ON threat_model.vulnerability_scans(project_id);

-- Junctions and tags
CREATE INDEX IF NOT EXISTS idx_threat_model_threats_threat_model_id ON threat_model.threat_model_threats(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_threat_model_threats_threat_id      ON threat_model.threat_model_threats(threat_id);
CREATE INDEX IF NOT EXISTS idx_component_tags_component_id ON threat_model.component_tags(component_id);
CREATE INDEX IF NOT EXISTS idx_component_tags_tag          ON threat_model.component_tags(tag);

-- Reports/Prompts/Logs/Settings
CREATE INDEX IF NOT EXISTS idx_report_prompts_report_type ON threat_model.report_prompts(report_type);
CREATE INDEX IF NOT EXISTS idx_report_prompts_llm_provider ON threat_model.report_prompts(llm_provider);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON threat_model.app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_module ON threat_model.app_logs(module);
CREATE INDEX IF NOT EXISTS idx_llm_usage_session_id ON threat_model.llm_usage_log(session_id);

-- RAG indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_chunks_unique_hash ON threat_model.rag_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_source        ON threat_model.rag_chunks(source_table, record_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_threat_title  ON threat_model.rag_chunks(threat_title);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata_gin  ON threat_model.rag_chunks USING GIN (metadata);
-- Vector index (IVFFlat). After bulk load, run: ANALYZE threat_model.rag_chunks;
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_ivfflat
  ON threat_model.rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Alternative HNSW (uncomment if supported/preferred)
-- CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
--   ON threat_model.rag_chunks USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 200);

-- 11) Triggers
-- Set updated_at on updates where present
DO $$
BEGIN
  -- projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_modtime'
  ) THEN
    CREATE TRIGGER update_projects_modtime
      BEFORE UPDATE ON threat_model.projects
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_modified_column();
  END IF;

  -- components
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_components_modtime'
  ) THEN
    CREATE TRIGGER update_components_modtime
      BEFORE UPDATE ON threat_model.components
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_modified_column();
  END IF;

  -- threat_models
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_threat_models_modtime'
  ) THEN
    CREATE TRIGGER update_threat_models_modtime
      BEFORE UPDATE ON threat_model.threat_models
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_modified_column();
  END IF;

  -- threats
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_threats_modtime'
  ) THEN
    CREATE TRIGGER update_threats_modtime
      BEFORE UPDATE ON threat_model.threats
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_modified_column();
  END IF;

  -- safeguards
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_safeguards_modtime'
  ) THEN
    CREATE TRIGGER update_safeguards_modtime
      BEFORE UPDATE ON threat_model.safeguards
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_modified_column();
  END IF;

  -- prompts
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_on_prompts'
  ) THEN
    CREATE TRIGGER set_updated_at_on_prompts
      BEFORE UPDATE ON threat_model.prompts
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_modified_column();
  END IF;

  -- reports
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_on_reports'
  ) THEN
    CREATE OR REPLACE FUNCTION threat_model.update_reports_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER set_updated_at_on_reports
      BEFORE UPDATE ON threat_model.reports
      FOR EACH ROW EXECUTE PROCEDURE threat_model.update_reports_updated_at_column();
  END IF;

  -- report_prompts
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_report_prompts_modtime'
  ) THEN
    CREATE TRIGGER update_report_prompts_modtime
      BEFORE UPDATE ON threat_model.report_prompts
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_modified_column();
  END IF;

  -- settings
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_settings_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION threat_model.update_settings_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER update_settings_timestamp
      BEFORE UPDATE ON threat_model.settings
      FOR EACH ROW EXECUTE FUNCTION threat_model.update_settings_timestamp();
  END IF;
END $$;

COMMIT;

-- End of full_init.sql
