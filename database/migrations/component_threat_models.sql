-- Migration file to create component_threat_models table
-- This table tracks which threat models are assigned to which components

-- Check if the table exists before creating it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'threat_model' AND tablename = 'component_threat_models'
    ) THEN
        -- Create the junction table for components and threat models
        CREATE TABLE threat_model.component_threat_models (
            id SERIAL PRIMARY KEY,
            component_id UUID NOT NULL,
            threat_model_id UUID NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_component FOREIGN KEY (component_id) REFERENCES threat_model.components(id) ON DELETE CASCADE,
            CONSTRAINT fk_threat_model FOREIGN KEY (threat_model_id) REFERENCES threat_model.threat_models(id) ON DELETE CASCADE,
            CONSTRAINT unique_component_threat_model UNIQUE (component_id, threat_model_id)
        );

        -- Add index for faster lookups
        CREATE INDEX idx_component_threat_models_component ON threat_model.component_threat_models(component_id);
        CREATE INDEX idx_component_threat_models_threat_model ON threat_model.component_threat_models(threat_model_id);
        
        RAISE NOTICE 'Created component_threat_models table';
    ELSE
        RAISE NOTICE 'component_threat_models table already exists';
    END IF;
END
$$;
