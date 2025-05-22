-- Enterprise Architecture Migration for TModel MK7
-- This migration extends the database schema to support enterprise-scale security architecture management
-- Created: April 20, 2025

-- Set the search path to our schema
SET search_path TO threat_model, public;

-- 1. Enhance Projects table with additional business metadata
ALTER TABLE threat_model.projects 
ADD COLUMN IF NOT EXISTS business_impact TEXT,
ADD COLUMN IF NOT EXISTS compliance_requirements TEXT[],
ADD COLUMN IF NOT EXISTS security_posture_score INTEGER CHECK (security_posture_score BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS last_assessment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS risk_exposure_value NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS security_contact VARCHAR(100);

COMMENT ON COLUMN threat_model.projects.business_impact IS 'Description of the business impact if this project is compromised';
COMMENT ON COLUMN threat_model.projects.compliance_requirements IS 'Array of compliance frameworks this project must adhere to';
COMMENT ON COLUMN threat_model.projects.security_posture_score IS 'Overall security score (0-100) based on threat mitigations and safeguards';
COMMENT ON COLUMN threat_model.projects.risk_exposure_value IS 'Estimated financial impact of potential breaches in USD';
COMMENT ON COLUMN threat_model.projects.security_contact IS 'Primary security contact for this project';

-- 2. Enhance Components table for better reusability
ALTER TABLE threat_model.components
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50),
ADD COLUMN IF NOT EXISTS technology_stack VARCHAR(100),
ADD COLUMN IF NOT EXISTS data_assets TEXT[],
ADD COLUMN IF NOT EXISTS protocols TEXT[],
ADD COLUMN IF NOT EXISTS parent_component_id UUID REFERENCES threat_model.components(id) ON DELETE SET NULL;

COMMENT ON COLUMN threat_model.components.category IS 'High-level category (Business Component, Safeguard Component, etc.)';
COMMENT ON COLUMN threat_model.components.subcategory IS 'More specific category within the main category';
COMMENT ON COLUMN threat_model.components.technology_stack IS 'Technology stack used by this component';
COMMENT ON COLUMN threat_model.components.data_assets IS 'Array of data assets handled by this component';
COMMENT ON COLUMN threat_model.components.protocols IS 'Array of protocols used by this component';
COMMENT ON COLUMN threat_model.components.parent_component_id IS 'Reference to parent component for hierarchical relationships';

-- 3. Create Component Library table for reusable component templates
CREATE TABLE IF NOT EXISTS threat_model.component_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT,
    technology_stack VARCHAR(100),
    version VARCHAR(30),
    typical_safeguards TEXT[],
    common_threats TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    UNIQUE(name, version)
);

COMMENT ON TABLE threat_model.component_library IS 'Library of reusable component templates that can be instantiated in projects';

-- 4. Enhance Safeguards table with additional metadata
ALTER TABLE threat_model.safeguards
ADD COLUMN IF NOT EXISTS category VARCHAR(50),
ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50),
ADD COLUMN IF NOT EXISTS implementation_cost NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS maintenance_cost NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS effectiveness_justification TEXT,
ADD COLUMN IF NOT EXISTS last_effectiveness_review TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN threat_model.safeguards.category IS 'High-level category (Authentication, Authorization, Encryption, etc.)';
COMMENT ON COLUMN threat_model.safeguards.subcategory IS 'More specific category within the main category';
COMMENT ON COLUMN threat_model.safeguards.implementation_cost IS 'Estimated cost to implement this safeguard in USD';
COMMENT ON COLUMN threat_model.safeguards.maintenance_cost IS 'Estimated annual maintenance cost in USD';
COMMENT ON COLUMN threat_model.safeguards.effectiveness_justification IS 'Justification for the effectiveness rating';

-- 5. Create Safeguard Library table for reusable safeguard templates
CREATE TABLE IF NOT EXISTS threat_model.safeguard_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT,
    typical_effectiveness INTEGER CHECK (typical_effectiveness BETWEEN 0 AND 100),
    implementation_guide TEXT,
    verification_steps TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    UNIQUE(name, category)
);

COMMENT ON TABLE threat_model.safeguard_library IS 'Library of reusable safeguard templates that can be instantiated in components';

-- 6. Create Security Metrics table for tracking security posture over time
CREATE TABLE IF NOT EXISTS threat_model.security_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
    metric_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    security_posture_score INTEGER CHECK (security_posture_score BETWEEN 0 AND 100),
    threat_count INTEGER DEFAULT 0,
    mitigated_threat_count INTEGER DEFAULT 0,
    vulnerability_count INTEGER DEFAULT 0,
    remediated_vulnerability_count INTEGER DEFAULT 0,
    safeguard_count INTEGER DEFAULT 0,
    verified_safeguard_count INTEGER DEFAULT 0,
    risk_exposure_value NUMERIC(12, 2),
    notes TEXT,
    created_by VARCHAR(100),
    UNIQUE(project_id, metric_date)
);

COMMENT ON TABLE threat_model.security_metrics IS 'Historical security metrics for tracking security posture over time';

-- 7. Create Business Impact Analysis table
CREATE TABLE IF NOT EXISTS threat_model.business_impact_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
    component_id UUID REFERENCES threat_model.components(id) ON DELETE CASCADE,
    confidentiality_impact VARCHAR(20) CHECK (confidentiality_impact IN ('Critical', 'High', 'Medium', 'Low', 'None')),
    integrity_impact VARCHAR(20) CHECK (integrity_impact IN ('Critical', 'High', 'Medium', 'Low', 'None')),
    availability_impact VARCHAR(20) CHECK (availability_impact IN ('Critical', 'High', 'Medium', 'Low', 'None')),
    financial_impact NUMERIC(12, 2),
    reputational_impact VARCHAR(20) CHECK (reputational_impact IN ('Critical', 'High', 'Medium', 'Low', 'None')),
    regulatory_impact VARCHAR(20) CHECK (regulatory_impact IN ('Critical', 'High', 'Medium', 'Low', 'None')),
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_by VARCHAR(100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, component_id)
);

COMMENT ON TABLE threat_model.business_impact_analysis IS 'Business impact analysis for components within projects';

-- 8. Create Rapid7 Asset Mapping table
CREATE TABLE IF NOT EXISTS threat_model.rapid7_asset_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES threat_model.components(id) ON DELETE CASCADE,
    rapid7_asset_id VARCHAR(100) NOT NULL,
    rapid7_asset_name VARCHAR(200),
    mapping_confidence INTEGER CHECK (mapping_confidence BETWEEN 0 AND 100),
    last_sync_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    UNIQUE(component_id, rapid7_asset_id)
);

COMMENT ON TABLE threat_model.rapid7_asset_mapping IS 'Mapping between components and Rapid7 assets';

-- 9. Create Executive Dashboard Settings table
CREATE TABLE IF NOT EXISTS threat_model.executive_dashboard_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    dashboard_name VARCHAR(100) NOT NULL,
    project_ids UUID[] DEFAULT ARRAY[]::UUID[],
    metric_types TEXT[] DEFAULT ARRAY['security_posture', 'risk_exposure', 'compliance']::TEXT[],
    time_period VARCHAR(20) DEFAULT '3m' CHECK (time_period IN ('1m', '3m', '6m', '1y', 'all')),
    refresh_interval INTEGER DEFAULT 24, -- hours
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, dashboard_name)
);

COMMENT ON TABLE threat_model.executive_dashboard_settings IS 'Settings for executive dashboards';

-- 10. Create views for easier reporting

-- Project Security Posture View
CREATE OR REPLACE VIEW threat_model.project_security_posture AS
SELECT 
    p.id AS project_id,
    p.name AS project_name,
    p.business_unit,
    p.criticality,
    p.security_posture_score,
    p.risk_exposure_value,
    COUNT(DISTINCT tm.id) AS threat_model_count,
    COUNT(DISTINCT c.id) AS component_count,
    COUNT(DISTINCT s.id) AS safeguard_count,
    COUNT(DISTINCT t.id) AS threat_count,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Mitigated') AS mitigated_threat_count,
    COUNT(DISTINCT v.id) AS vulnerability_count,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'Remediated') AS remediated_vulnerability_count,
    CASE 
        WHEN COUNT(DISTINCT t.id) = 0 THEN 100
        ELSE ROUND((COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Mitigated')::NUMERIC / 
                   NULLIF(COUNT(DISTINCT t.id), 0)::NUMERIC) * 100)
    END AS threat_mitigation_percentage,
    p.updated_at,
    p.last_assessment_date
FROM 
    threat_model.projects p
LEFT JOIN 
    threat_model.project_components pc ON p.id = pc.project_id
LEFT JOIN 
    threat_model.components c ON pc.component_id = c.id
LEFT JOIN 
    threat_model.project_threat_models ptm ON p.id = ptm.project_id
LEFT JOIN 
    threat_model.threat_models tm ON ptm.threat_model_id = tm.id
LEFT JOIN 
    threat_model.threats t ON tm.id = t.threat_model_id
LEFT JOIN 
    threat_model.component_safeguards cs ON c.id = cs.component_id
LEFT JOIN 
    threat_model.safeguards s ON cs.safeguard_id = s.id
LEFT JOIN 
    threat_model.vulnerabilities v ON c.id = v.component_id
GROUP BY 
    p.id, p.name, p.business_unit, p.criticality, p.security_posture_score, 
    p.risk_exposure_value, p.updated_at, p.last_assessment_date;

-- Component Security Posture View
CREATE OR REPLACE VIEW threat_model.component_security_posture AS
SELECT 
    c.id AS component_id,
    c.name AS component_name,
    c.type,
    c.category,
    c.technology_stack,
    COUNT(DISTINCT s.id) AS safeguard_count,
    COUNT(DISTINCT s.id) FILTER (WHERE cs.status = 'Implemented') AS implemented_safeguard_count,
    COUNT(DISTINCT v.id) AS vulnerability_count,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'Remediated') AS remediated_vulnerability_count,
    COUNT(DISTINCT pc.project_id) AS project_count,
    ARRAY_AGG(DISTINCT p.name) AS project_names,
    c.updated_at
FROM 
    threat_model.components c
LEFT JOIN 
    threat_model.component_safeguards cs ON c.id = cs.component_id
LEFT JOIN 
    threat_model.safeguards s ON cs.safeguard_id = s.id
LEFT JOIN 
    threat_model.vulnerabilities v ON c.id = v.component_id
LEFT JOIN 
    threat_model.project_components pc ON c.id = pc.component_id
LEFT JOIN 
    threat_model.projects p ON pc.project_id = p.id
GROUP BY 
    c.id, c.name, c.type, c.category, c.technology_stack, c.updated_at;

-- Create indexes for the new columns and tables
CREATE INDEX IF NOT EXISTS idx_components_category ON threat_model.components(category);
CREATE INDEX IF NOT EXISTS idx_components_parent ON threat_model.components(parent_component_id);
CREATE INDEX IF NOT EXISTS idx_safeguards_category ON threat_model.safeguards(category);
CREATE INDEX IF NOT EXISTS idx_component_library_name ON threat_model.component_library(name);
CREATE INDEX IF NOT EXISTS idx_safeguard_library_name ON threat_model.safeguard_library(name);
CREATE INDEX IF NOT EXISTS idx_security_metrics_project ON threat_model.security_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_security_metrics_date ON threat_model.security_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_business_impact_project ON threat_model.business_impact_analysis(project_id);
CREATE INDEX IF NOT EXISTS idx_rapid7_mapping_component ON threat_model.rapid7_asset_mapping(component_id);
CREATE INDEX IF NOT EXISTS idx_rapid7_mapping_asset ON threat_model.rapid7_asset_mapping(rapid7_asset_id);

-- Add update triggers for new tables
CREATE TRIGGER update_component_library_modtime
    BEFORE UPDATE ON threat_model.component_library
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_safeguard_library_modtime
    BEFORE UPDATE ON threat_model.safeguard_library
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_business_impact_modtime
    BEFORE UPDATE ON threat_model.business_impact_analysis
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_rapid7_mapping_modtime
    BEFORE UPDATE ON threat_model.rapid7_asset_mapping
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_executive_dashboard_modtime
    BEFORE UPDATE ON threat_model.executive_dashboard_settings
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
