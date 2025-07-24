-- UUID Standardization Migration
-- This script migrates the reports.report table to use UUIDs instead of integers for project_id

-- Step 1: Add UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create a mapping table between public.projects and threat_model.projects
CREATE TABLE IF NOT EXISTS public.project_uuid_mapping (
    integer_id INTEGER NOT NULL,
    uuid_id UUID NOT NULL,
    CONSTRAINT project_uuid_mapping_pkey PRIMARY KEY (integer_id),
    CONSTRAINT project_uuid_mapping_uuid_id_key UNIQUE (uuid_id)
);

-- Step 3: Populate the mapping table with existing relations
-- This assumes that project names match between the schemas
INSERT INTO public.project_uuid_mapping (integer_id, uuid_id)
SELECT p.id, tp.id
FROM public.projects p
JOIN threat_model.projects tp ON p.name = tp.name
ON CONFLICT DO NOTHING;

-- Step 4: Add new UUID column to reports.report
ALTER TABLE reports.report ADD COLUMN project_uuid UUID;

-- Step 5: Update the project_uuid values using the mapping table
UPDATE reports.report r
SET project_uuid = m.uuid_id
FROM public.project_uuid_mapping m
WHERE r.project_id = m.integer_id;

-- Step 6: Handle any NULL project_uuid values (for projects that don't have a mapping)
-- Option 1: Create entries in threat_model.projects for missing projects
DO $$
DECLARE
    project_rec RECORD;
BEGIN
    FOR project_rec IN 
        SELECT r.project_id, p.name, p.description, p.business_unit, p.criticality 
        FROM reports.report r
        JOIN public.projects p ON r.project_id = p.id
        WHERE r.project_uuid IS NULL
    LOOP
        WITH new_project AS (
            INSERT INTO threat_model.projects 
            (name, description, business_unit, criticality) 
            VALUES 
            (project_rec.name, project_rec.description, project_rec.business_unit, project_rec.criticality)
            RETURNING id
        )
        INSERT INTO public.project_uuid_mapping (integer_id, uuid_id)
        SELECT project_rec.project_id, new_project.id FROM new_project;
    END LOOP;
END $$;

-- Update remaining NULL UUIDs
UPDATE reports.report r
SET project_uuid = m.uuid_id
FROM public.project_uuid_mapping m
WHERE r.project_id = m.integer_id
AND r.project_uuid IS NULL;

-- Step 7: Make project_uuid NOT NULL after ensuring all values are set
ALTER TABLE reports.report ALTER COLUMN project_uuid SET NOT NULL;

-- Step 8: Update foreign key constraints
ALTER TABLE reports.report 
DROP CONSTRAINT report_project_id_fkey;

ALTER TABLE reports.report
ADD CONSTRAINT report_project_uuid_fkey
FOREIGN KEY (project_uuid) REFERENCES threat_model.projects(id) ON DELETE CASCADE;

-- Step 9: Update all application code and views that reference project_id
-- This step is to be implemented in the application code

-- Step 10: Once application code is updated and verified, drop the old column
-- ALTER TABLE reports.report DROP COLUMN project_id;
-- Note: Keep the old column temporarily for rollback capability
-- After sufficient testing, the column can be dropped with the command above

-- Step 11: Rename the new column to match the old convention (optional)
-- ALTER TABLE reports.report RENAME COLUMN project_uuid TO project_id;
-- Note: This step is optional and depends on whether you want to maintain the column name 'project_id'

-- Step 12: Update the database sequence if needed (if renaming column)
-- This is only necessary if you want to reuse the 'project_id' name
-- Otherwise, you'd update your application code to reference 'project_uuid' instead

-- Final step: Verification query
SELECT 
    r.id, 
    r.project_id, 
    r.project_uuid, 
    tm.name as threat_model_name,
    p.name as public_name
FROM 
    reports.report r
LEFT JOIN 
    threat_model.projects tm ON r.project_uuid = tm.id
LEFT JOIN 
    public.projects p ON r.project_id = p.id;
