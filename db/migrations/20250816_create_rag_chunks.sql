-- 20250816_create_rag_chunks.sql
-- Phase 2: Postgres-only pgvector RAG storage (threat-level chunks)
-- Creates schema objects to store embeddings for prior threat model response content
-- and prompts, split at "Threat: <title>" granularity.

BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector

-- Ensure schema
CREATE SCHEMA IF NOT EXISTS threat_model;

-- Main table
CREATE TABLE IF NOT EXISTS threat_model.rag_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table    TEXT        NOT NULL,            -- 'threat_models_response' | 'threat_models_prompt'
  record_id       UUID        NOT NULL,            -- original threat_model id
  section         TEXT        NULL,                -- 'threat' | 'prompt'
  threat_title    TEXT        NULL,                -- parsed from "Threat: <title>"
  content         TEXT        NOT NULL,            -- exact text for the single threat (or prompt)
  content_hash    TEXT        NOT NULL,            -- sha256(record_id + threat_title + content)
  tokens          INT         NOT NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb, -- { subject, title, environment, platform, modality, data_sensitivity, threat_tags, assumptions }
  quality_score   NUMERIC(4,2) NULL,
  embedding       VECTOR(1536) NOT NULL,           -- OpenAI text-embedding-3-small
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate inserts of the same parsed chunk
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_chunks_unique_hash
  ON threat_model.rag_chunks (content_hash);

-- Lookup helpers
CREATE INDEX IF NOT EXISTS idx_rag_chunks_source
  ON threat_model.rag_chunks (source_table, record_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_threat_title
  ON threat_model.rag_chunks (threat_title);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_metadata_gin
  ON threat_model.rag_chunks USING GIN (metadata);

-- Vector index: choose one depending on pgvector version and dataset size
-- IVFFlat (recommended starting point; run ANALYZE after bulk load)
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_ivfflat
  ON threat_model.rag_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- If your pgvector version supports HNSW and data size warrants, you may instead:
-- CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
--   ON threat_model.rag_chunks
--   USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 200);

COMMIT;
