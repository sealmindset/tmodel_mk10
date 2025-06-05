-- Migration: Create app_logs table to store application logs
CREATE SCHEMA IF NOT EXISTS threat_model;

CREATE TABLE IF NOT EXISTS threat_model.app_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL,
    module VARCHAR(255),
    message TEXT NOT NULL,
    data TEXT,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_logs_level ON threat_model.app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_module ON threat_model.app_logs(module);
