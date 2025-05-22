/**
 * Analytics Service for Safeguard Report
 * 
 * Tracks usage metrics, LLM response quality, and implementation status changes.
 */

const logger = require('../logger');
const db = require('../database');


// Timestamp format helper
const formatTimestamp = () => new Date().toISOString();

/**
 * Track report generation event
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
async function trackReportGeneration(projectId, userId, metadata = {}) {
  try {
    const timestamp = formatTimestamp();
    const eventType = 'report_generation';
    
    // Insert tracking record
    const query = `
      INSERT INTO analytics.events
        (event_type, user_id, project_id, timestamp, metadata)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      eventType,
      userId,
      projectId,
      timestamp,
      JSON.stringify({
        usedLLM: metadata.usedLLM || false,
        safeguardCount: metadata.safeguardCount || 0,
        processingTimeMs: metadata.processingTimeMs || 0,
        source: metadata.source || 'web',
        ...metadata
      })
    ]);
    
    console.log(`Tracked report generation for project ${projectId}`, {
      eventId: result.rows[0]?.id,
      userId,
      projectId
    });
  } catch (error) {
    // Don't let analytics errors affect the user experience
    console.error(`Error tracking report generation: ${error.message}`, {
      stack: error.stack,
      projectId,
      userId
    });
  }
}

/**
 * Track LLM response metrics
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 * @param {Object} metrics - LLM metrics
 * @returns {Promise<void>}
 */
async function trackLLMResponse(projectId, userId, metrics = {}) {
  try {
    const timestamp = formatTimestamp();
    const eventType = 'llm_response';
    
    // Insert tracking record
    const query = `
      INSERT INTO analytics.events
        (event_type, user_id, project_id, timestamp, metadata)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      eventType,
      userId,
      projectId,
      timestamp,
      JSON.stringify({
        provider: metrics.provider || 'unknown',
        model: metrics.model || 'unknown',
        processingTimeMs: metrics.processingTimeMs || 0,
        tokensUsed: metrics.tokensUsed || 0,
        promptTokens: metrics.promptTokens || 0,
        completionTokens: metrics.completionTokens || 0,
        errorOccurred: metrics.errorOccurred || false,
        taskType: metrics.taskType || 'unknown',
        ...metrics
      })
    ]);
    
    console.log(`Tracked LLM response for project ${projectId}`, {
      eventId: result.rows[0]?.id,
      userId,
      projectId,
      provider: metrics.provider
    });
  } catch (error) {
    // Don't let analytics errors affect the user experience
    console.error(`Error tracking LLM response: ${error.message}`, {
      stack: error.stack,
      projectId,
      userId
    });
  }
}

/**
 * Track implementation status change
 * @param {string} projectId - Project ID
 * @param {string} safeguardId - Safeguard ID
 * @param {string} userId - User ID
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
async function trackStatusChange(projectId, safeguardId, userId, oldStatus, newStatus, metadata = {}) {
  try {
    const timestamp = formatTimestamp();
    const eventType = 'status_change';
    
    // Insert tracking record
    const query = `
      INSERT INTO analytics.events
        (event_type, user_id, project_id, timestamp, metadata)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      eventType,
      userId,
      projectId,
      timestamp,
      JSON.stringify({
        safeguardId,
        oldStatus,
        newStatus,
        source: metadata.source || 'web',
        ...metadata
      })
    ]);
    
    console.log(`Tracked status change for safeguard ${safeguardId}`, {
      eventId: result.rows[0]?.id,
      userId,
      projectId,
      safeguardId,
      oldStatus,
      newStatus
    });
  } catch (error) {
    // Don't let analytics errors affect the user experience
    console.error(`Error tracking status change: ${error.message}`, {
      stack: error.stack,
      projectId,
      safeguardId,
      userId
    });
  }
}

/**
 * Track feature usage
 * @param {string} featureName - Feature name
 * @param {string} userId - User ID
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
async function trackFeatureUsage(featureName, userId, metadata = {}) {
  try {
    const timestamp = formatTimestamp();
    const eventType = 'feature_usage';
    
    // Insert tracking record
    const query = `
      INSERT INTO analytics.events
        (event_type, user_id, timestamp, metadata)
      VALUES
        ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      eventType,
      userId,
      timestamp,
      JSON.stringify({
        feature: featureName,
        source: metadata.source || 'web',
        ...metadata
      })
    ]);
    
    console.log(`Tracked feature usage: ${featureName}`, {
      eventId: result.rows[0]?.id,
      userId,
      feature: featureName
    });
  } catch (error) {
    // Don't let analytics errors affect the user experience
    console.error(`Error tracking feature usage: ${error.message}`, {
      stack: error.stack,
      feature: featureName,
      userId
    });
  }
}

/**
 * Get report generation statistics
 * @param {string} projectId - Optional project ID to filter by
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Statistics about report generation
 */
async function getReportGenerationStats(projectId = null, days = 30) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN (metadata->>'usedLLM')::boolean = true THEN 1 END) as llm_count,
        AVG((metadata->>'processingTimeMs')::float) as avg_processing_time,
        MAX((metadata->>'safeguardCount')::integer) as max_safeguard_count,
        MIN((metadata->>'safeguardCount')::integer) as min_safeguard_count,
        AVG((metadata->>'safeguardCount')::integer) as avg_safeguard_count
      FROM analytics.events
      WHERE 
        event_type = 'report_generation'
        AND timestamp >= NOW() - INTERVAL '${days} days'
    `;
    
    const params = [];
    
    if (projectId) {
      query += ` AND project_id = $1`;
      params.push(projectId);
    }
    
    const result = await db.query(query, params);
    
    return result.rows[0] || {
      total_count: 0,
      llm_count: 0,
      avg_processing_time: 0,
      max_safeguard_count: 0,
      min_safeguard_count: 0,
      avg_safeguard_count: 0
    };
  } catch (error) {
    console.error(`Error getting report generation stats: ${error.message}`, {
      stack: error.stack,
      projectId,
      days
    });
    
    // Return empty stats on error
    return {
      total_count: 0,
      llm_count: 0,
      avg_processing_time: 0,
      max_safeguard_count: 0,
      min_safeguard_count: 0,
      avg_safeguard_count: 0,
      error: error.message
    };
  }
}

/**
 * Get LLM response quality metrics
 * @param {string} projectId - Optional project ID to filter by
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Statistics about LLM responses
 */
async function getLLMResponseStats(projectId = null, days = 30) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN (metadata->>'errorOccurred')::boolean = true THEN 1 END) as error_count,
        AVG((metadata->>'processingTimeMs')::float) as avg_processing_time,
        AVG((metadata->>'tokensUsed')::integer) as avg_tokens_used,
        STRING_AGG(DISTINCT metadata->>'provider', ',') as providers
      FROM analytics.events
      WHERE 
        event_type = 'llm_response'
        AND timestamp >= NOW() - INTERVAL '${days} days'
    `;
    
    const params = [];
    
    if (projectId) {
      query += ` AND project_id = $1`;
      params.push(projectId);
    }
    
    const result = await db.query(query, params);
    
    return result.rows[0] || {
      total_count: 0,
      error_count: 0,
      avg_processing_time: 0,
      avg_tokens_used: 0,
      providers: ''
    };
  } catch (error) {
    console.error(`Error getting LLM response stats: ${error.message}`, {
      stack: error.stack,
      projectId,
      days
    });
    
    // Return empty stats on error
    return {
      total_count: 0,
      error_count: 0,
      avg_processing_time: 0,
      avg_tokens_used: 0,
      providers: '',
      error: error.message
    };
  }
}

/**
 * Get implementation status change statistics
 * @param {string} projectId - Optional project ID to filter by
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Statistics about implementation status changes
 */
async function getStatusChangeStats(projectId = null, days = 30) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN metadata->>'newStatus' = 'Implemented' THEN 1 END) as to_implemented_count,
        COUNT(CASE WHEN metadata->>'newStatus' = 'In Progress' THEN 1 END) as to_in_progress_count,
        COUNT(CASE WHEN metadata->>'newStatus' = 'Not Started' THEN 1 END) as to_not_started_count,
        COUNT(DISTINCT metadata->>'safeguardId') as unique_safeguards_count
      FROM analytics.events
      WHERE 
        event_type = 'status_change'
        AND timestamp >= NOW() - INTERVAL '${days} days'
    `;
    
    const params = [];
    
    if (projectId) {
      query += ` AND project_id = $1`;
      params.push(projectId);
    }
    
    const result = await db.query(query, params);
    
    return result.rows[0] || {
      total_count: 0,
      to_implemented_count: 0,
      to_in_progress_count: 0,
      to_not_started_count: 0,
      unique_safeguards_count: 0
    };
  } catch (error) {
    console.error(`Error getting status change stats: ${error.message}`, {
      stack: error.stack,
      projectId,
      days
    });
    
    // Return empty stats on error
    return {
      total_count: 0,
      to_implemented_count: 0,
      to_in_progress_count: 0,
      to_not_started_count: 0,
      unique_safeguards_count: 0,
      error: error.message
    };
  }
}

/**
 * Initialize analytics - creates required tables if they don't exist
 */
async function initializeAnalytics() {
  try {
    // Check if analytics schema exists, create if not
    await db.query(`
      CREATE SCHEMA IF NOT EXISTS analytics;
    `);
    
    // Create events table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics.events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        user_id VARCHAR(50),
        project_id VARCHAR(50),
        timestamp TIMESTAMP NOT NULL,
        metadata JSONB
      );
    `);
    
    // Create index on event_type for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_events_event_type ON analytics.events(event_type);
    `);
    
    // Create index on timestamp for faster time-based queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics.events(timestamp);
    `);
    
    // Create index on project_id for faster project-specific queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_events_project_id ON analytics.events(project_id);
    `);
    
    console.log('Analytics tables initialized successfully');
  } catch (error) {
    console.error(`Error initializing analytics tables: ${error.message}`, {
      stack: error.stack
    });
  }
}

// Initialize analytics tables when this module is loaded
initializeAnalytics().catch(error => {
  console.error(`Failed to initialize analytics: ${error.message}`, {
    stack: error.stack
  });
});

module.exports = {
  trackReportGeneration,
  trackLLMResponse,
  trackStatusChange,
  trackFeatureUsage,
  getReportGenerationStats,
  getLLMResponseStats,
  getStatusChangeStats
};
