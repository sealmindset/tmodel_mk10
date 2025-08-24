-- 2025-08-19 Create table for generated reports
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS threat_model.report_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  template_id UUID NULL, -- from report_templates.template via PostgREST; nullable if external
  model_provider TEXT NOT NULL CHECK (model_provider IN ('openai','ollama')),
  model_name TEXT NOT NULL,
  content TEXT NOT NULL,         -- markdown output
  prompt TEXT NOT NULL,          -- final composed prompt sent to LLM
  tokens_prompt INT NULL,
  tokens_completion INT NULL,
  cost_usd NUMERIC(12,6) NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed')),
  error TEXT NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_instances_project ON threat_model.report_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_report_instances_template ON threat_model.report_instances(template_id);

COMMIT;
