-- 20250823_reports_drop_project_id.sql
-- Purpose: Rely solely on project_uuid in reports.report and remove legacy project_id
-- Safe for reruns where possible; will no-op if already applied.

BEGIN;

-- 1) Ensure project_uuid column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'reports' AND table_name = 'report' AND column_name = 'project_uuid'
  ) THEN
    ALTER TABLE reports.report ADD COLUMN project_uuid UUID;
  END IF;
END $$;

-- 2) Backfill project_uuid if possible (best-effort) using mapping table
-- Requires optional mapping table public.project_uuid_mapping(integer_id INT, uuid_id UUID)
-- Only fill where project_uuid is NULL and project_id exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='project_uuid_mapping'
  ) THEN
    UPDATE reports.report r
    SET project_uuid = m.uuid_id
    FROM public.project_uuid_mapping m
    WHERE r.project_uuid IS NULL AND m.integer_id = r.project_id;
  END IF;
END $$;

-- 3) Enforce NOT NULL on project_uuid (will fail if any rows still NULL)
ALTER TABLE reports.report
  ALTER COLUMN project_uuid SET NOT NULL;

-- 4) Ensure FK to threat_model.projects on project_uuid exists
DO $$
DECLARE
  fk_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND tc.table_schema = 'reports'
     AND tc.table_name = 'report'
     AND kcu.column_name = 'project_uuid'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    ALTER TABLE reports.report
      ADD CONSTRAINT report_project_uuid_fkey
      FOREIGN KEY (project_uuid)
      REFERENCES threat_model.projects(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- 5) Drop legacy FK on project_id if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='reports' AND table_name='report' AND constraint_name='report_project_id_fkey'
  ) THEN
    ALTER TABLE reports.report DROP CONSTRAINT report_project_id_fkey;
  END IF;
END $$;

-- 6) Drop legacy project_id column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='reports' AND table_name='report' AND column_name='project_id'
  ) THEN
    ALTER TABLE reports.report DROP COLUMN project_id;
  END IF;
END $$;

COMMIT;
