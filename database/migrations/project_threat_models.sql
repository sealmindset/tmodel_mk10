-- Migration for Project-ThreatModel assignment junction table
-- This implements a many-to-many relationship between projects and threat models

-- Junction table for Project-ThreatModel assignments
CREATE TABLE IF NOT EXISTS threat_model.project_threat_models (
    project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
    threat_model_id UUID REFERENCES threat_model.threat_models(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(100),
    notes TEXT,
    PRIMARY KEY (project_id, threat_model_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_threat_models_project_id ON threat_model.project_threat_models(project_id);
CREATE INDEX IF NOT EXISTS idx_project_threat_models_threat_model_id ON threat_model.project_threat_models(threat_model_id);

-- Add comment to table
COMMENT ON TABLE threat_model.project_threat_models IS 'Junction table for many-to-many relationship between projects and threat models';
