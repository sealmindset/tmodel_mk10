-- Migration: Create threat_model.results table
CREATE TABLE IF NOT EXISTS threat_model.results (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    project_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Optional: Add index for project_id if used for lookups
CREATE INDEX IF NOT EXISTS idx_results_project_id ON threat_model.results(project_id);
