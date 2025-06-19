-- Idempotent schema.sql for tmodel_mk10

CREATE TABLE IF NOT EXISTS public.projects (
    id serial PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    owner_id integer,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.threat_models (
    id serial PRIMARY KEY,
    project_id integer REFERENCES public.projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    risk_score numeric CHECK (risk_score >= 0 AND risk_score <= 100),
    redis_id text UNIQUE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    llm_provider text
);

CREATE TABLE IF NOT EXISTS public.threats (
    id serial PRIMARY KEY,
    threat_model_id integer REFERENCES public.threat_models(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    category text,
    severity text,
    likelihood text,
    impact text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
    id serial PRIMARY KEY,
    project_id integer REFERENCES public.projects(id) ON DELETE CASCADE,
    threat_model_id integer REFERENCES public.threat_models(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    summary text
);

CREATE TABLE IF NOT EXISTS public.results (
    id serial PRIMARY KEY,
    report_id integer REFERENCES public.reports(id) ON DELETE CASCADE,
    threat_id integer REFERENCES public.threats(id) ON DELETE CASCADE,
    finding text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id serial PRIMARY KEY,
    key text UNIQUE NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_logs (
    id serial PRIMARY KEY,
    message text NOT NULL,
    level text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prompts (
    id serial PRIMARY KEY,
    prompt_text text NOT NULL,
    response_text text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.llm_usage_log (
    id serial PRIMARY KEY,
    prompt_id integer REFERENCES public.prompts(id) ON DELETE SET NULL,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON public.projects(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_threat_models_redis_id ON public.threat_models(redis_id);
CREATE INDEX IF NOT EXISTS idx_threat_models_project_id ON public.threat_models(project_id);
CREATE INDEX IF NOT EXISTS idx_threats_threat_model_id ON public.threats(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON public.reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_threat_model_id ON public.reports(threat_model_id);
CREATE INDEX IF NOT EXISTS idx_results_report_id ON public.results(report_id);
CREATE INDEX IF NOT EXISTS idx_results_threat_id ON public.results(threat_id);