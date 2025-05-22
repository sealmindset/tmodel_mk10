-- Component Relations Migration
-- Creates tables for component safeguards, vulnerabilities, and other relations

-- Create component_safeguards junction table
CREATE TABLE IF NOT EXISTS threat_model.component_safeguards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES threat_model.components(id) ON DELETE CASCADE,
    safeguard_id UUID NOT NULL REFERENCES threat_model.safeguards(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'Planned', -- Planned, Implemented, Testing, Verified
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (component_id, safeguard_id)
);

-- Create component_vulnerabilities junction table
CREATE TABLE IF NOT EXISTS threat_model.component_vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES threat_model.components(id) ON DELETE CASCADE,
    vulnerability_id UUID NOT NULL REFERENCES threat_model.vulnerabilities(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'Open', -- Open, In Progress, Mitigated, Closed
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (component_id, vulnerability_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_component_safeguards_component_id ON threat_model.component_safeguards(component_id);
CREATE INDEX IF NOT EXISTS idx_component_safeguards_safeguard_id ON threat_model.component_safeguards(safeguard_id);
CREATE INDEX IF NOT EXISTS idx_component_vulnerabilities_component_id ON threat_model.component_vulnerabilities(component_id);
CREATE INDEX IF NOT EXISTS idx_component_vulnerabilities_vulnerability_id ON threat_model.component_vulnerabilities(vulnerability_id);

-- Add component_tags table for better tag management
CREATE TABLE IF NOT EXISTS threat_model.component_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL REFERENCES threat_model.components(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (component_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_component_tags_component_id ON threat_model.component_tags(component_id);
CREATE INDEX IF NOT EXISTS idx_component_tags_tag ON threat_model.component_tags(tag);

-- Add component_statistics view for quick access to component metrics
CREATE OR REPLACE VIEW threat_model.component_statistics AS
SELECT 
    c.id AS component_id,
    c.name AS component_name,
    COUNT(DISTINCT cs.safeguard_id) AS safeguard_count,
    COUNT(DISTINCT cv.vulnerability_id) AS vulnerability_count,
    COUNT(DISTINCT pc.project_id) AS project_count,
    c.created_at,
    c.updated_at
FROM 
    threat_model.components c
LEFT JOIN 
    threat_model.component_safeguards cs ON c.id = cs.component_id
LEFT JOIN 
    threat_model.component_vulnerabilities cv ON c.id = cv.component_id
LEFT JOIN 
    threat_model.project_components pc ON c.id = pc.component_id
GROUP BY 
    c.id, c.name, c.created_at, c.updated_at;
