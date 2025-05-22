-- Clean PostgreSQL Database Initialization Script for Threat Model Generator Mk7
-- This script drops and recreates the schema and all tables

-- First drop the schema if it exists (cascade will remove all objects in it)
DROP SCHEMA IF EXISTS threat_model CASCADE;

-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database schema
CREATE SCHEMA threat_model;

-- Set the search path to our schema
SET search_path TO threat_model, public;

-- Projects table - represents a business system or application being threat modeled
CREATE TABLE threat_model.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    business_unit VARCHAR(100),
    criticality VARCHAR(20) CHECK (criticality IN ('Critical', 'High', 'Medium', 'Low')),
    data_classification VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Active' CHECK (status IN ('Active', 'Archived', 'Draft', 'Planning', 'Development', 'Maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    last_updated_by VARCHAR(100)
);

-- Components table - reusable system components that can be used across projects
CREATE TABLE threat_model.components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    hostname VARCHAR(255),
    ip_address VARCHAR(45),
    type VARCHAR(50),
    description TEXT,
    version VARCHAR(30),
    is_reusable BOOLEAN DEFAULT TRUE,
    tags TEXT[], -- Array of tags for categorization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Project Components junction table - connects projects with components
CREATE TABLE threat_model.project_components (
    project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
    component_id UUID REFERENCES threat_model.components(id) ON DELETE CASCADE,
    notes TEXT,
    PRIMARY KEY (project_id, component_id)
);

-- Threat Models table - represents an analysis of a component/system
CREATE TABLE threat_model.threat_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES threat_model.projects(id) ON DELETE CASCADE,
    component_id UUID REFERENCES threat_model.components(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    risk_score NUMERIC(5,2) CHECK (risk_score BETWEEN 0 AND 100),
    model_data JSONB,  -- For storing AI-generated model data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Threats table - represents potential threats identified in threat models
CREATE TABLE threat_model.threats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_model_id UUID REFERENCES threat_model.threat_models(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    threat_type VARCHAR(50),
    likelihood INTEGER CHECK (likelihood BETWEEN 1 AND 5),
    impact INTEGER CHECK (impact BETWEEN 1 AND 5),
    risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,
    status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'Mitigated', 'Accepted', 'Transferred')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safeguards table - security controls that can be applied to mitigate threats
CREATE TABLE threat_model.safeguards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    threat_id UUID REFERENCES threat_model.threats(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    description TEXT,
    effectiveness INTEGER CHECK (effectiveness BETWEEN 0 AND 100),
    implementation_status VARCHAR(20) CHECK (implementation_status IN ('Planned', 'Implemented', 'Verified', 'N/A')),
    implementation_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_projects_business_unit ON threat_model.projects(business_unit);
CREATE INDEX idx_projects_criticality ON threat_model.projects(criticality);
CREATE INDEX idx_projects_status ON threat_model.projects(status);
CREATE INDEX idx_project_components_project_id ON threat_model.project_components(project_id);
CREATE INDEX idx_project_components_component_id ON threat_model.project_components(component_id);
CREATE INDEX idx_threat_models_project_id ON threat_model.threat_models(project_id);
CREATE INDEX idx_threats_threat_model_id ON threat_model.threats(threat_model_id);
CREATE INDEX idx_threats_status ON threat_model.threats(status);
CREATE INDEX idx_safeguards_threat_id ON threat_model.safeguards(threat_id);

-- Add function for updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to update timestamps
CREATE TRIGGER update_projects_modtime
BEFORE UPDATE ON threat_model.projects
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_components_modtime
BEFORE UPDATE ON threat_model.components
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_threat_models_modtime
BEFORE UPDATE ON threat_model.threat_models
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_threats_modtime
BEFORE UPDATE ON threat_model.threats
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_safeguards_modtime
BEFORE UPDATE ON threat_model.safeguards
FOR EACH ROW EXECUTE FUNCTION update_modified_column();
