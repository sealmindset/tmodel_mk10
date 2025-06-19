-- 1. SCHEMAS
CREATE SCHEMA IF NOT EXISTS threat_models;
CREATE SCHEMA IF NOT EXISTS public;

-- 2. SEQUENCES
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND c.relname = 'threat_models_id_seq' AND n.nspname = 'threat_models') THEN
    CREATE SEQUENCE threat_models.threat_models_id_seq;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND c.relname = 'projects_id_seq' AND n.nspname = 'public') THEN
    CREATE SEQUENCE public.projects_id_seq;
  END IF;
END$$;

-- 3. TABLES
CREATE TABLE IF NOT EXISTS threat_models.threat_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  project_id integer,
  status text DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS public.projects (
  id integer PRIMARY KEY DEFAULT nextval('public.projects_id_seq'::regclass),
  name text NOT NULL,
  description text,
  business_unit text,
  criticality text DEFAULT 'Medium',
  data_classification text DEFAULT 'Other: Internal Use Only',
  status text DEFAULT 'Active',
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- 4. TABLE DRIFT CORRECTION
DO $$
BEGIN
  -- threat_models.threat_models drift correction
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'threat_models' AND table_name = 'threat_models' AND column_name = 'archived'
  ) THEN
    ALTER TABLE threat_models.threat_models ADD COLUMN archived boolean DEFAULT false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'threat_models' AND table_name = 'threat_models' AND column_name = 'name' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE threat_models.threat_models ALTER COLUMN name SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'threat_models' AND table_name = 'threat_models' AND column_name = 'status' AND column_default IS NULL
  ) THEN
    ALTER TABLE threat_models.threat_models ALTER COLUMN status SET DEFAULT 'active';
  END IF;
  -- public.projects drift correction
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN archived boolean DEFAULT false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'name' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.projects ALTER COLUMN name SET NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'criticality' AND column_default IS NULL
  ) THEN
    ALTER TABLE public.projects ALTER COLUMN criticality SET DEFAULT 'Medium';
  END IF;
END$$;

-- 5. INDEXES & UNIQUE CONSTRAINTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'threat_models' AND indexname = 'threat_models_project_id_idx'
  ) THEN
    CREATE INDEX threat_models_project_id_idx ON threat_models.threat_models (project_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'projects_name_idx'
  ) THEN
    CREATE INDEX projects_name_idx ON public.projects (name);
  END IF;
END$$;

-- 6. PRIMARY KEYS (already inline in CREATE TABLE IF NOT EXISTS)

-- 7. FOREIGN KEYS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'threat_models' AND table_name = 'threat_models' AND constraint_name = 'threat_models_project_id_fkey'
  ) THEN
    ALTER TABLE threat_models.threat_models
      ADD CONSTRAINT threat_models_project_id_fkey FOREIGN KEY (project_id)
      REFERENCES public.projects(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 8. VIEWS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views WHERE table_schema = 'threat_models' AND table_name = 'active_threat_models'
  ) THEN
    CREATE VIEW threat_models.active_threat_models AS
      SELECT * FROM threat_models.threat_models WHERE status = 'active';
  END IF;
END$$;

-- 9. FUNCTIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_threat_model_timestamp'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'threat_models')
  ) THEN
    CREATE OR REPLACE FUNCTION threat_models.update_threat_model_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END$$;

-- 10. TRIGGERS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_threat_model_timestamp'
      AND tgrelid = 'threat_models.threat_models'::regclass
  ) THEN
    CREATE TRIGGER set_threat_model_timestamp
    BEFORE UPDATE ON threat_models.threat_models
    FOR EACH ROW
    EXECUTE FUNCTION threat_models.update_threat_model_timestamp();
  END IF;
END$$;

-- 11. COMMENTS
COMMENT ON TABLE threat_models.threat_models IS 'Stores all threat model records for the system';
COMMENT ON COLUMN threat_models.threat_models.status IS 'Status of the threat model (active, archived, etc)';
COMMENT ON TABLE public.projects IS 'Stores all project records for the threat modeling system';
COMMENT ON COLUMN public.projects.criticality IS 'How critical the project is (High, Medium, Low)';

-- 12. OWNERSHIP & PRIVILEGES (optional)
-- ALTER TABLE threat_models.threat_models OWNER TO postgres;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON threat_models.threat_models TO postgres;
-- ALTER TABLE public.projects OWNER TO postgres;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO postgres;

-- Repeat for all other objects as introspected from the source database.