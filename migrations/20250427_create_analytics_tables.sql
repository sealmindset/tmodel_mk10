-- Create analytics schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create events table for tracking
CREATE TABLE IF NOT EXISTS analytics.events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(50),
  project_id VARCHAR(50),
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_event_type ON analytics.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics.events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON analytics.events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON analytics.events(user_id);

-- Insert initial admin log
INSERT INTO analytics.events (event_type, timestamp, metadata)
VALUES ('system', NOW(), '{"message": "Analytics tables created", "version": "1.0"}');

-- Comments explaining the table structure
COMMENT ON TABLE analytics.events IS 'Stores all analytics events for safeguard reports and related features';
COMMENT ON COLUMN analytics.events.event_type IS 'Type of event (report_generation, llm_response, status_change, feature_usage)';
COMMENT ON COLUMN analytics.events.user_id IS 'ID of the user who triggered the event';
COMMENT ON COLUMN analytics.events.project_id IS 'ID of the project associated with the event (if applicable)';
COMMENT ON COLUMN analytics.events.timestamp IS 'When the event occurred';
COMMENT ON COLUMN analytics.events.metadata IS 'Additional JSON data specific to the event type';