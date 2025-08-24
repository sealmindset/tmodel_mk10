-- Migration to create the report_prompts table

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS threat_model.report_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type VARCHAR(100) NOT NULL, -- e.g., 'project_portfolio', 'component_inventory'
    name VARCHAR(255) NOT NULL, -- User-friendly name for the prompt, e.g., 'Executive PDF Template - Project Portfolio'
    report_prompt_text TEXT NOT NULL,
    llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    llm_model VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
    is_default BOOLEAN DEFAULT FALSE, -- Indicates if this is a system-provided, non-deletable default prompt
    created_by VARCHAR(100) DEFAULT 'system', -- As auth is bypassed, defaults to system
    updated_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_report_prompts_report_type ON threat_model.report_prompts(report_type);
CREATE INDEX IF NOT EXISTS idx_report_prompts_llm_provider ON threat_model.report_prompts(llm_provider);

-- Trigger to update 'updated_at' timestamp on any row update
CREATE OR REPLACE FUNCTION threat_model.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_report_prompts_modtime
    BEFORE UPDATE ON threat_model.report_prompts
    FOR EACH ROW
    EXECUTE FUNCTION threat_model.update_modified_column();

COMMENT ON TABLE threat_model.report_prompts IS 'Stores customizable LLM prompt templates for generating various reports.';
COMMENT ON COLUMN threat_model.report_prompts.report_type IS 'Identifier for the type of report this prompt is for (e.g., project_portfolio).';
COMMENT ON COLUMN threat_model.report_prompts.name IS 'A user-friendly name for the prompt template.';
COMMENT ON COLUMN threat_model.report_prompts.report_prompt_text IS 'The actual text of the LLM prompt for reports, potentially with placeholders.';
COMMENT ON COLUMN threat_model.report_prompts.llm_provider IS 'The LLM provider to be used with this prompt (e.g., openai, ollama).';
COMMENT ON COLUMN threat_model.report_prompts.llm_model IS 'The specific LLM model to be used (e.g., gpt-4, llama3:latest).';
COMMENT ON COLUMN threat_model.report_prompts.is_default IS 'True if this is a system-provided default prompt, otherwise false.';
