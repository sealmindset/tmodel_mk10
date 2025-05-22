-- Additional tables needed for the threat model generator
-- This adds tables referenced in the controllers but missing from the initial schema

-- Set the search path to our schema
SET search_path TO threat_model, public;

-- Add function for updating timestamps (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Vulnerabilities table - for storing security vulnerabilities found in components
CREATE TABLE IF NOT EXISTS threat_model.vulnerabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID REFERENCES threat_model.components(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Info')),
    cve_id VARCHAR(20),
    status VARCHAR(30) DEFAULT 'Open' CHECK (status IN ('Open', 'Fixed', 'In Progress', 'Won''t Fix', 'False Positive')),
    remediation TEXT,
    discovered_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fixed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for threat models and threats
CREATE TABLE IF NOT EXISTS threat_model.threat_model_threats (
    threat_model_id UUID REFERENCES threat_model.threat_models(id) ON DELETE CASCADE,
    threat_id UUID REFERENCES threat_model.threats(id) ON DELETE CASCADE,
    notes TEXT,
    PRIMARY KEY (threat_model_id, threat_id)
);

-- Vulnerability scans table - for tracking vulnerability scan history
CREATE TABLE IF NOT EXISTS threat_model.vulnerability_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
    scan_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    scan_tool VARCHAR(100),
    scan_type VARCHAR(50),
    scan_result JSONB,
    vulnerabilities_found INTEGER DEFAULT 0,
    scan_status VARCHAR(20) DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_component_id ON threat_model.vulnerabilities(component_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON threat_model.vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON threat_model.vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_threat_model_threats_threat_model_id ON threat_model.threat_model_threats(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_threat_model_threats_threat_id ON threat_model.threat_model_threats(threat_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_scans_project_id ON threat_model.vulnerability_scans(project_id);

-- Add triggers to update timestamps
CREATE TRIGGER update_vulnerabilities_modtime
BEFORE UPDATE ON threat_model.vulnerabilities
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_vulnerability_scans_modtime
BEFORE UPDATE ON threat_model.vulnerability_scans
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Add some test data for development
INSERT INTO threat_model.vulnerabilities 
(component_id, title, severity, description, status) 
VALUES 
((SELECT id FROM threat_model.components LIMIT 1), 
 'SQL Injection Vulnerability', 
 'High', 
 'Potential SQL injection in login form allows attackers to bypass authentication.',
 'Open');

INSERT INTO threat_model.vulnerability_scans
(project_id, scan_tool, scan_type, vulnerabilities_found, scan_status)
VALUES
((SELECT id FROM threat_model.projects LIMIT 1),
 'Example Scanner', 
 'SAST',
 1,
 'Completed');
