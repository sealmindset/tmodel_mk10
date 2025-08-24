-- reports_schema.sql
-- Creates the schema and tables for the Reports application

-- Create a dedicated schema for reports
CREATE SCHEMA IF NOT EXISTS reports;

-- Create reports table
CREATE TABLE IF NOT EXISTS reports.report (
  id SERIAL PRIMARY KEY,
  project_uuid UUID NOT NULL REFERENCES threat_model.projects(id) ON DELETE CASCADE,
  template_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL, -- Store report content as JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports.report_revision (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports.report(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS reports.template (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_content TEXT NOT NULL, -- Markdown with placeholders
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports.content_section (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports.report(id) ON DELETE CASCADE,
  section_name TEXT NOT NULL,
  content TEXT NOT NULL,
  llm_provider TEXT NOT NULL, -- 'openai', 'ollama', etc.
  llm_model TEXT NOT NULL,
  prompt_used TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default template for Threat Model Report
INSERT INTO reports.template (name, description, template_content)
VALUES (
  'Threat Model Reference Architecture',
  'Standard reference architecture report for threat modeling projects',
  E'h1. Threat Model Generator – Reference Architecture

{panel:title=Executive Overview|titleBGColor=#F0F0F0|borderStyle=solid}
This reference architecture document provides both **strategic** and **technical** context for the Threat Model Generator.  
**Audience:** Engineering Teams, Executives, Auditors  
**Trigger:** On‑demand via report component  
**Format:** Markdown with Confluence macros  
{panel}

h2. 1. Project Summary  
||Key||Value||
|*Project Name*|{{PROJECT_NAME}}|
|*Business Unit*|{{BUSINESS_UNIT}}|
|*Criticality*|{{CRITICALITY}}|
|*Data Classification*|{{DATA_CLASSIFICATION}}|
|*Status*|{{STATUS}}|

h2. 2. Architecture Diagram  
{panel:title=Architecture Diagram}
!{{DIAGRAM_PATH}}|thumbnail!
{panel}

h2. 3. CI/CD Pipeline Integration  
A DevSecOps pipeline ensures code quality and security gates:  
{code:language=bash}
# CI/CD Steps Example
git checkout {{BRANCH}}
npm install
npm test
npm run lint
docker build -t {{IMAGE_NAME}}:{{VERSION}} .
docker push {{IMAGE_NAME}}:{{VERSION}}
kubectl apply -f deployment.yaml
{code}

h2. 4. System Components Inventory  
{{COMPONENTS_TABLE}}

h2. 5. Threat Models & Vulnerability Summary  
{{THREAT_MODELS_TABLE}}

h2. 6. Safeguard Identification Methodology

1. *Threat‑to‑Control Mapping*  
   {{THREAT_CONTROL_MAPPING}}

2. *Automated Control Validation*  
   {code:language=yaml}
{{CONTROL_VALIDATION}}
{code}

3. *Governance & Audit Trail*  
   {{GOVERNANCE_TABLE}}

h2. 7. Terraform Scaffolding for Secure IaC

h3. 7.1 Module Structure  
{{MODULE_STRUCTURE}}

h3. 7.2 Security Configuration  
{code:language=hcl}
{{SECURITY_CONFIG}}
{code}

h3. 7.3 Scaffolding Steps

# 1. Initialize Terraform modules  
{code}
terraform init
{code}

# 2. Validate and plan  
{code}
terraform validate
terraform plan -var-file=envs/{{ENVIRONMENT}}.tfvars
{code}

# 3. Apply for each environment  
{code}
terraform apply -auto-approve -var-file=envs/prod.tfvars
{code}

# 4. Document variables/outputs in `README.md`

h2. 8. Compliance & Reporting  
{{COMPLIANCE_CONTENT}}
{panel:title=Audit Summary}
{{AUDIT_SUMMARY}}
{panel}
'
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION reports.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_report_timestamp'
  ) THEN
    CREATE TRIGGER update_report_timestamp
    BEFORE UPDATE ON reports.report
    FOR EACH ROW EXECUTE FUNCTION reports.update_timestamp();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_template_timestamp'
  ) THEN
    CREATE TRIGGER update_template_timestamp
    BEFORE UPDATE ON reports.template
    FOR EACH ROW EXECUTE FUNCTION reports.update_timestamp();
  END IF;
END $$;
