-- Database Schema for Threat Model Generator - Rapid7 Integration

-- Create threat_model schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS threat_model;

-- Vulnerabilities table
CREATE TABLE IF NOT EXISTS threat_model.vulnerabilities (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(100) UNIQUE, -- Rapid7 vulnerability ID
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50), -- Critical, High, Medium, Low
  cvss_score DECIMAL(3,1), -- CVSS score (0.0-10.0)
  status VARCHAR(50) NOT NULL DEFAULT 'Open', -- Open, In Progress, Fixed
  remediation TEXT,
  project_id INTEGER, -- FK to projects table
  asset_id VARCHAR(100), -- Rapid7 asset ID
  asset_name VARCHAR(255),
  first_found TIMESTAMP WITH TIME ZONE,
  last_found TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on project_id for faster filtering
CREATE INDEX IF NOT EXISTS vuln_project_idx ON threat_model.vulnerabilities(project_id);

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS vuln_status_idx ON threat_model.vulnerabilities(status);

-- Create index on severity for faster filtering
CREATE INDEX IF NOT EXISTS vuln_severity_idx ON threat_model.vulnerabilities(severity);

-- Components table (for systems, network elements, etc.)
CREATE TABLE IF NOT EXISTS threat_model.components (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255),
  ip_address VARCHAR(50),
  type VARCHAR(50) NOT NULL, -- Protocol, Network, System, Data Store, Boundary, External Party, Safeguard
  has_threat_model BOOLEAN DEFAULT false,
  threat_model_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Junction table linking projects and components
CREATE TABLE IF NOT EXISTS threat_model.project_components (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES threat_model.components(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, component_id)
);

-- Create indexes for project_components
CREATE INDEX IF NOT EXISTS project_components_project_idx ON threat_model.project_components(project_id);
CREATE INDEX IF NOT EXISTS project_components_component_idx ON threat_model.project_components(component_id);

-- Projects table (if it doesn't exist yet)
CREATE TABLE IF NOT EXISTS threat_model.projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  business_unit VARCHAR(100),
  criticality VARCHAR(50) DEFAULT 'Medium', -- Critical, High, Medium, Low
  data_classification VARCHAR(100) DEFAULT 'Internal Use Only', -- Updated for more detailed classifications
  status VARCHAR(50) DEFAULT 'Active', -- Active, Planning, Development, Maintenance, Archived
  external_id VARCHAR(100), -- Rapid7 project ID
  created_by VARCHAR(100),
  last_updated_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scan History table
CREATE TABLE IF NOT EXISTS threat_model.scan_history (
  id SERIAL PRIMARY KEY,
  scan_id VARCHAR(100) NOT NULL, -- Rapid7 scan ID
  project_id INTEGER REFERENCES threat_model.projects(id),
  status VARCHAR(50) NOT NULL, -- Running, Completed, Failed
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  total_vulnerabilities INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on scan_id for faster lookup
CREATE INDEX IF NOT EXISTS scan_history_scan_id_idx ON threat_model.scan_history(scan_id);

-- Threat Models table
CREATE TABLE IF NOT EXISTS threat_model.threat_models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'Draft', -- Draft, In Progress, Completed, Approved, Archived
  risk_score DECIMAL(4,2), -- Overall risk score (0-10)
  created_by VARCHAR(100),
  approved_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on project_id for faster lookup
CREATE INDEX IF NOT EXISTS threat_models_project_idx ON threat_model.threat_models(project_id);

-- Insert sample project if none exist
INSERT INTO threat_model.projects (name, description, business_unit, criticality, status)
SELECT 
  'Default Project', 
  'Default project for vulnerabilities', 
  'Engineering',
  'Medium',
  'Active'
WHERE NOT EXISTS (SELECT 1 FROM threat_model.projects);
