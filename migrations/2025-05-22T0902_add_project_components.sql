-- Migration: Add components and project_components tables for Assign Components modal
CREATE TABLE IF NOT EXISTS components (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS project_components (
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  component_id INTEGER REFERENCES components(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, component_id)
);
