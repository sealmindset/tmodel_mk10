-- PostgreSQL Database Initialization Script for Threat Model Generator Mk7
-- This script creates the database schema for the enhanced threat modeling platform

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for vector similarity search (if needed for LLM features)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Create database schema
CREATE SCHEMA IF NOT EXISTS threat_model;

-- Set the search path to our schema
SET search_path TO threat_model, public;

-- Projects table - represents a business system or application being threat modeled
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    business_unit VARCHAR(100),
    criticality VARCHAR(20) CHECK (criticality IN ('Critical', 'High', 'Medium', 'Low')),
    data_classification VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Active' CHECK (status IN ('Active', 'Archived', 'Draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    last_updated_by VARCHAR(100)
);

-- Components table - reusable system components that can be used across projects
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    version VARCHAR(30),
    is_reusable BOOLEAN DEFAULT TRUE,
    tags TEXT[], -- Array of tags for categorization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Project Components junction table - connects projects with components
CREATE TABLE IF NOT EXISTS project_components (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    notes TEXT,
    PRIMARY KEY (project_id, component_id)
);

-- Safeguards table - security controls that can be applied to components
CREATE TABLE IF NOT EXISTS safeguards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    effectiveness INTEGER CHECK (effectiveness BETWEEN 0 AND 100), -- 0-100%
    implementation_status VARCHAR(20) CHECK (implementation_status IN ('Planned', 'Implemented', 'Verified', 'N/A')),
    implementation_details TEXT,
    last_verified TIMESTAMP WITH TIME ZONE,
    verification_method VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Component Safeguards junction table - connects components with safeguards
CREATE TABLE IF NOT EXISTS component_safeguards (
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    safeguard_id UUID REFERENCES safeguards(id) ON DELETE CASCADE,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Implemented',
    PRIMARY KEY (component_id, safeguard_id)
);

-- Threat Models table - specific threat modeling sessions/documents
CREATE TABLE IF NOT EXISTS threat_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'In Review', 'Approved', 'Deprecated')),
    methodology VARCHAR(50), -- STRIDE, DREAD, etc.
    version VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Threats table - individual threats identified within a threat model
CREATE TABLE IF NOT EXISTS threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    threat_model_id UUID REFERENCES threat_models(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    category VARCHAR(50), -- Authentication, Authorization, etc.
    impact VARCHAR(20) CHECK (impact IN ('Critical', 'High', 'Medium', 'Low')),
    likelihood VARCHAR(20) CHECK (likelihood IN ('Very Likely', 'Likely', 'Possible', 'Unlikely')),
    risk_score INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN impact = 'Critical' AND likelihood = 'Very Likely' THEN 25
            WHEN impact = 'Critical' AND likelihood = 'Likely' THEN 20
            WHEN impact = 'Critical' AND likelihood = 'Possible' THEN 15
            WHEN impact = 'Critical' AND likelihood = 'Unlikely' THEN 10
            WHEN impact = 'High' AND likelihood = 'Very Likely' THEN 20
            WHEN impact = 'High' AND likelihood = 'Likely' THEN 16
            WHEN impact = 'High' AND likelihood = 'Possible' THEN 12
            WHEN impact = 'High' AND likelihood = 'Unlikely' THEN 8
            WHEN impact = 'Medium' AND likelihood = 'Very Likely' THEN 15
            WHEN impact = 'Medium' AND likelihood = 'Likely' THEN 12
            WHEN impact = 'Medium' AND likelihood = 'Possible' THEN 9
            WHEN impact = 'Medium' AND likelihood = 'Unlikely' THEN 6
            WHEN impact = 'Low' AND likelihood = 'Very Likely' THEN 10
            WHEN impact = 'Low' AND likelihood = 'Likely' THEN 8
            WHEN impact = 'Low' AND likelihood = 'Possible' THEN 6
            WHEN impact = 'Low' AND likelihood = 'Unlikely' THEN 4
            ELSE 0
        END
    ) STORED,
    status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'Mitigated', 'Accepted', 'Transferred')),
    mitigations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Vulnerabilities table - vulnerabilities discovered by scanning tools
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(50), -- ID in Rapid7, Nessus, etc.
    source VARCHAR(30) NOT NULL, -- "rapid7", "nessus", "manual", etc.
    name VARCHAR(100) NOT NULL,
    description TEXT,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low', 'Info')),
    cvss_score DECIMAL(3,1),
    cve_id VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'Fixed', 'In Progress', 'False Positive', 'Accepted')),
    remediation_steps TEXT,
    discovered_at TIMESTAMP WITH TIME ZONE,
    last_checked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Threat-Vulnerability mappings - connects threats with actual vulnerabilities
CREATE TABLE IF NOT EXISTS threat_vulnerabilities (
    threat_id UUID REFERENCES threats(id) ON DELETE CASCADE,
    vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE CASCADE,
    match_confidence INTEGER CHECK (match_confidence BETWEEN 0 AND 100), -- 0-100%
    notes TEXT,
    PRIMARY KEY (threat_id, vulnerability_id)
);

-- Security incidents - records of actual security incidents
CREATE TABLE IF NOT EXISTS security_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    severity VARCHAR(20) CHECK (severity IN ('Critical', 'High', 'Medium', 'Low')),
    status VARCHAR(30) CHECK (status IN ('Open', 'Investigating', 'Contained', 'Resolved', 'Closed')),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    component_id UUID REFERENCES components(id) ON DELETE SET NULL,
    related_threat_id UUID REFERENCES threats(id) ON DELETE SET NULL,
    related_vulnerability_id UUID REFERENCES vulnerabilities(id) ON DELETE SET NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reported_by VARCHAR(100)
);

-- Rapid7 scan records - keeps track of scan history
CREATE TABLE IF NOT EXISTS scan_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(30) NOT NULL, -- "rapid7", "nessus", etc.
    scan_id VARCHAR(100), -- ID in the scanning tool
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    scan_type VARCHAR(50),
    vulnerabilities_found INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) CHECK (status IN ('Scheduled', 'Running', 'Completed', 'Failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance frameworks
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    version VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance requirements
CREATE TABLE IF NOT EXISTS compliance_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework_id UUID REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    requirement_id VARCHAR(50) NOT NULL, -- e.g., "PCI-DSS-3.2.1"
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Maps safeguards to compliance requirements
CREATE TABLE IF NOT EXISTS safeguard_compliance (
    safeguard_id UUID REFERENCES safeguards(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    notes TEXT,
    PRIMARY KEY (safeguard_id, requirement_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_component_name ON components(name);
CREATE INDEX IF NOT EXISTS idx_safeguard_name ON safeguards(name);
CREATE INDEX IF NOT EXISTS idx_threat_model_project ON threat_models(project_id);
CREATE INDEX IF NOT EXISTS idx_threat_component ON threats(component_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_component ON vulnerabilities(component_id);
CREATE INDEX IF NOT EXISTS idx_vulnerability_external_id ON vulnerabilities(external_id);
CREATE INDEX IF NOT EXISTS idx_incident_project ON security_incidents(project_id);

-- Create update trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply update timestamp triggers to all tables with updated_at column
CREATE TRIGGER update_projects_modtime
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_components_modtime
    BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_safeguards_modtime
    BEFORE UPDATE ON safeguards
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_threat_models_modtime
    BEFORE UPDATE ON threat_models
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_threats_modtime
    BEFORE UPDATE ON threats
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_vulnerabilities_modtime
    BEFORE UPDATE ON vulnerabilities
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Sample insert for demonstration (optional)
-- INSERT INTO projects (name, description, business_unit, criticality, data_classification)
-- VALUES ('Customer Portal', 'Web-based customer self-service portal', 'Customer Service', 'High', 'Confidential');

-- Comment this out for production use
-- SELECT 'Database initialization completed successfully!' AS status;
