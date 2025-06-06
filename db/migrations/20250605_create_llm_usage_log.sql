-- Migration: Create LLM Usage Log Table
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS threat_model;

CREATE TABLE IF NOT EXISTS threat_model.llm_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
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

CREATE INDEX IF NOT EXISTS idx_llm_usage_session_id ON threat_model.llm_usage_log(session_id);
