-- Migration: Add Redis-mapped columns to threat_models and create settings table
-- Date: 2025-05-09

-- Add columns to threat_models for Redis-mapped fields (if missing)
ALTER TABLE threat_model.threat_models
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS response TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS text TEXT,
  ADD COLUMN IF NOT EXISTS threat_count INTEGER,
  ADD COLUMN IF NOT EXISTS merge_metadata JSONB;

-- Create settings table for system-wide key/value pairs
CREATE TABLE IF NOT EXISTS threat_model.settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
