-- PostgreSQL Schema as Extracted from Live Database (as of 2025-06-19T09:10:53-05:00)

-- TABLE: projects
-- Access method: heap
CREATE TABLE public.projects (
    id serial PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    owner_id integer,
    UNIQUE (name)
);

-- TABLE: threat_models
-- Access method: heap
CREATE TABLE public.threat_models (
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

-- TABLE: threats
-- Access method: heap
CREATE TABLE public.threats (
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

-- TABLE: reports
-- Access method: heap
CREATE TABLE public.reports (
    id serial PRIMARY KEY,
    project_id integer REFERENCES public.projects(id) ON DELETE CASCADE,
    threat_model_id integer REFERENCES public.threat_models(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    summary text
);

-- TABLE: results
-- Access method: heap
CREATE TABLE public.results (
    id serial PRIMARY KEY,
    report_id integer REFERENCES public.reports(id) ON DELETE CASCADE,
    threat_id integer REFERENCES public.threats(id) ON DELETE CASCADE,
    finding text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- TABLE: settings
-- Access method: heap
CREATE TABLE public.settings (
    id serial PRIMARY KEY,
    key text UNIQUE NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now()
);

-- TABLE: app_logs
-- Access method: heap
CREATE TABLE public.app_logs (
    id serial PRIMARY KEY,
    message text NOT NULL,
    level text,
    created_at timestamp with time zone DEFAULT now()
);

-- TABLE: prompts
-- Access method: heap
CREATE TABLE public.prompts (
    id serial PRIMARY KEY,
    prompt_text text NOT NULL,
    response_text text,
    created_at timestamp with time zone DEFAULT now()
);

-- TABLE: llm_usage_log
-- Access method: heap
CREATE TABLE public.llm_usage_log (
    id serial PRIMARY KEY,
    prompt_id integer REFERENCES public.prompts(id) ON DELETE SET NULL,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes, Constraints, and Relationships
CREATE UNIQUE INDEX idx_projects_name ON public.projects(name);
CREATE UNIQUE INDEX idx_threat_models_redis_id ON public.threat_models(redis_id);
CREATE INDEX idx_threat_models_project_id ON public.threat_models(project_id);
CREATE INDEX idx_threats_threat_model_id ON public.threats(threat_model_id);
CREATE INDEX idx_reports_project_id ON public.reports(project_id);
CREATE INDEX idx_reports_threat_model_id ON public.reports(threat_model_id);
CREATE INDEX idx_results_report_id ON public.results(report_id);
CREATE INDEX idx_results_threat_id ON public.results(threat_id);

-- Foreign-key constraints and referenced-by relationships are defined inline above.

-- Sequences (implicit via serial columns)
-- projects_id_seq, threat_models_id_seq, threats_id_seq, reports_id_seq, results_id_seq, settings_id_seq, app_logs_id_seq, prompts_id_seq, llm_usage_log_id_seq