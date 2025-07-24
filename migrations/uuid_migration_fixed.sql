-- UUID Migration Script (Fixed Version)
-- This script ensures proper UUID usage between threat_model.projects and reports.report

-- Step 1: Add UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Add UUID column to threat_model.projects if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'threat_model' 
                   AND table_name = 'projects' 
                   AND column_name = 'uuid') THEN
        ALTER TABLE threat_model.projects ADD COLUMN uuid UUID DEFAULT uuid_generate_v4();
    END IF;
END $$;

-- Step 3: Set NOT NULL constraint on uuid column after ensuring all rows have values
UPDATE threat_model.projects SET uuid = uuid_generate_v4() WHERE uuid IS NULL;
ALTER TABLE threat_model.projects ALTER COLUMN uuid SET NOT NULL;

-- Step 4: Add a unique constraint to uuid column to ensure uniqueness
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'projects_uuid_key') THEN
        ALTER TABLE threat_model.projects ADD CONSTRAINT projects_uuid_key UNIQUE (uuid);
    END IF;
END $$;

-- Step 5: Update reports.report to use the UUID from threat_model.projects
-- First, make sure we have a view that maps integer IDs to projects
CREATE OR REPLACE VIEW reports.projects AS
SELECT p.id, p.name, p.description, p.uuid, p.business_unit, p.criticality
FROM threat_model.projects p;

-- Step 6: Update the existing reports (if any) to use the correct UUID
UPDATE reports.report r
SET project_uuid = p.uuid
FROM threat_model.projects p
WHERE r.project_id = p.id;

-- Step 7: Add a foreign key constraint to ensure data integrity
-- First remove any existing constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_project_uuid_fkey') THEN
        ALTER TABLE reports.report DROP CONSTRAINT report_project_uuid_fkey;
    END IF;
END $$;

-- Add the new constraint
ALTER TABLE reports.report ADD CONSTRAINT report_project_uuid_fkey
FOREIGN KEY (project_uuid) REFERENCES threat_model.projects(uuid) ON DELETE CASCADE;

-- Final verification query
SELECT 'Success: UUID migration complete.' AS status;
