-- Migration: Create safeguards table in threat_model schema
CREATE SCHEMA IF NOT EXISTS threat_model;

-- Drop incorrect table in public schema if it exists
DROP TABLE IF EXISTS safeguards;

CREATE TABLE IF NOT EXISTS threat_model.safeguards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    reusable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
