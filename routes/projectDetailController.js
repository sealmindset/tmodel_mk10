/**
 * Project Detail Controller
 * Handles the routes for project detail view, integrating project data, components,
 * threat models, and vulnerability statistics
 */

const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const pool = require('../db/db');

/**
 * Get project details including components, threat models, and vulnerabilities
 */
// Helper: Validate UUID v4
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

router.get('/projects/:id', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    // Backend UUID validation
    if (!isValidUUID(projectId)) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Invalid project ID. Please check the URL or contact support.'
      });
    }
    
    // Get project details
    const projectQuery = `
      SELECT * FROM threat_model.projects 
      WHERE id = $1
    `;
    const projectResult = await pool.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Project not found'
      });
    }
    
    const project = projectResult.rows[0];
    
    // Get components associated with this project
    const componentsQuery = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM threat_model.vulnerabilities v WHERE v.component_id = c.id) AS vulnerability_count,
        (SELECT COUNT(*) FROM threat_model.vulnerabilities v WHERE v.component_id = c.id AND v.severity = 'Critical') AS critical_count,
        (SELECT COUNT(*) FROM threat_model.vulnerabilities v WHERE v.component_id = c.id AND v.severity = 'High') AS high_count,
        (SELECT COUNT(*) FROM threat_model.vulnerabilities v WHERE v.component_id = c.id AND v.severity = 'Medium') AS medium_count,
        (SELECT COUNT(*) FROM threat_model.vulnerabilities v WHERE v.component_id = c.id AND v.severity = 'Low') AS low_count
      FROM threat_model.components c
      JOIN threat_model.project_components pc ON c.id = pc.component_id
      WHERE pc.project_id = $1
      ORDER BY c.name
    `;
    const componentsResult = await pool.query(componentsQuery, [projectId]);
    const components = componentsResult.rows;
    
    // Get threat models for this project
    const threatModelsQuery = `
      SELECT tm.*, 
        (SELECT COUNT(*) FROM threat_model.threat_model_threats tmt WHERE tmt.threat_model_id = tm.id) AS threat_count,
        (SELECT AVG(t.risk_score) FROM threat_model.threats t 
         JOIN threat_model.threat_model_threats tmt ON t.id = tmt.threat_id 
         WHERE tmt.threat_model_id = tm.id) AS avg_risk_score
      FROM threat_model.threat_models tm
      JOIN threat_model.project_threat_models ptm ON tm.id = ptm.threat_model_id
      WHERE ptm.project_id = $1
      ORDER BY tm.created_at DESC
    `;
    const threatModelsResult = await pool.query(threatModelsQuery, [projectId]);
    const threatModels = threatModelsResult.rows;
    
    // Get overall statistics from PostgreSQL database
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM threat_model.project_threat_models ptm
         WHERE ptm.project_id = $1) AS pg_threat_model_count,
         
        (SELECT COUNT(*) FROM threat_model.threats t 
         JOIN threat_model.threat_model_threats tmt ON t.id = tmt.threat_id
         JOIN threat_model.threat_models tm ON tmt.threat_model_id = tm.id
         JOIN threat_model.project_threat_models ptm ON tm.id = ptm.threat_model_id
         WHERE ptm.project_id = $1) AS threat_count,
        
        (SELECT COUNT(*) FROM threat_model.vulnerabilities v
         JOIN threat_model.components c ON v.component_id = c.id
         JOIN threat_model.project_components pc ON c.id = pc.component_id
         WHERE pc.project_id = $1) AS vulnerability_count,
         
        (SELECT COUNT(*) FROM threat_model.vulnerabilities v
         JOIN threat_model.components c ON v.component_id = c.id
         JOIN threat_model.project_components pc ON c.id = pc.component_id
         WHERE pc.project_id = $1 AND v.status = 'Open') AS open_vulnerability_count,
         
        (SELECT AVG(t.risk_score) FROM threat_model.threats t 
         JOIN threat_model.threat_model_threats tmt ON t.id = tmt.threat_id
         JOIN threat_model.threat_models tm ON tmt.threat_model_id = tm.id
         JOIN threat_model.project_threat_models ptm ON tm.id = ptm.threat_model_id
         WHERE ptm.project_id = $1) AS avg_risk_score
    `;
    const statsResult = await pool.query(statsQuery, [projectId]);
    const stats = statsResult.rows[0] || {};
    
    // Use only PostgreSQL-derived values for stats
    stats.threat_model_count = stats.pg_threat_model_count || 0;
    stats.threat_count = stats.threat_count || 0;
    
    // Get vulnerability statistics by severity
    const vulnStatsQuery = `
      SELECT v.severity, COUNT(*) as count
      FROM threat_model.vulnerabilities v
      JOIN threat_model.components c ON v.component_id = c.id
      JOIN threat_model.project_components pc ON c.id = pc.component_id
      WHERE pc.project_id = $1
      GROUP BY v.severity
    `;
    const vulnStatsResult = await pool.query(vulnStatsQuery, [projectId]);
    
    // Format vulnerability stats for the chart
    const vulnerabilityStats = {};
    vulnStatsResult.rows.forEach(row => {
      vulnerabilityStats[row.severity] = parseInt(row.count);
    });
    
    // Get top 5 vulnerabilities
    const vulnerabilitiesQuery = `
      SELECT v.*, c.name AS component_name
      FROM threat_model.vulnerabilities v
      JOIN threat_model.components c ON v.component_id = c.id
      JOIN threat_model.project_components pc ON c.id = pc.component_id
      WHERE pc.project_id = $1
      ORDER BY 
        CASE 
          WHEN v.severity = 'Critical' THEN 1
          WHEN v.severity = 'High' THEN 2
          WHEN v.severity = 'Medium' THEN 3
          WHEN v.severity = 'Low' THEN 4
          ELSE 5
        END,
        v.created_at DESC
      LIMIT 5
    `;
    const vulnerabilitiesResult = await pool.query(vulnerabilitiesQuery, [projectId]);
    const vulnerabilities = vulnerabilitiesResult.rows;
    
    // Get latest scan
    const latestScanQuery = `
      SELECT * FROM threat_model.vulnerability_scans
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const latestScanResult = await pool.query(latestScanQuery, [projectId]);
    const latestScan = latestScanResult.rows[0];
    
    // Helper functions for badges and styling
    const getCriticalityClass = (criticality) => {
      switch(criticality) {
        case 'Critical': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        case 'Low': return 'success';
        default: return 'secondary';
      }
    };
    
    const getStatusClass = (status) => {
      switch(status) {
        case 'Active': return 'success';
        case 'Planning': return 'info';
        case 'Development': return 'primary';
        case 'Maintenance': return 'warning';
        case 'Archived': return 'secondary';
        default: return 'secondary';
      }
    };
    
    const getComponentTypeClass = (type) => {
      switch(type) {
        case 'Web Application': return 'primary';
        case 'Mobile Application': return 'info';
        case 'API': return 'success';
        case 'Desktop Application': return 'warning';
        case 'Database': return 'danger';
        case 'Server': return 'dark';
        case 'Network': return 'secondary';
        default: return 'light';
      }
    };
    
    const getThreatModelStatusClass = (status) => {
      switch(status) {
        case 'Draft': return 'warning';
        case 'Active': return 'success';
        case 'Archived': return 'secondary';
        case 'Reviewed': return 'info';
        default: return 'primary';
      }
    };
    
    console.log('[DEBUG] Passing to view:', { threatModels }); // Debug: log before render
    res.render('project-detail', {
      project,
      components,
      threatModels,
      stats,
      vulnerabilityStats,
      vulnerabilities,
      latestScan,
      pageTitle: `${project.name} - Project Details`,
      active: 'projects',
      // Add helper functions to template locals
      getCriticalityClass,
      getStatusClass,
      getComponentTypeClass,
      getThreatModelStatusClass
    });
  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).render('error', {
      message: 'Error loading project details',
      error: {
        status: 500,
        stack: error.stack
      }
    });
  }
});

// Route for new report form moved to routes/projects.js to keep all /projects/* under the /projects router

/**
 * Create new component for a project
 */
router.post('/api/projects/:id/components', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { component_id } = req.body;
    
    // Link component to project
    const query = `
      INSERT INTO threat_model.project_components (project_id, component_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    
    const result = await pool.query(query, [projectId, component_id]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding component to project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * New threat model form for a project
 */
router.get('/projects/:id/threat-models/new', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Get project details
    const projectQuery = 'SELECT * FROM threat_model.projects WHERE id = $1';
    const projectResult = await pool.query(projectQuery, [projectId]);
    
    if (projectResult.rows.length === 0) {
      return res.status(404).render('error', {
        errorCode: 404,
        errorMessage: 'Project not found',
        errorDetails: `No project found with ID ${projectId}`
      });
    }
    
    const project = projectResult.rows[0];
    
    // Get LLM provider settings from Redis
    const redisUtil = require('../utils/redis');
    await redisUtil.connect(); // Ensure Redis is connected
    
    // Use the getRedisValue helper function to get settings
    const llmProvider = await redisUtil.getRedisValue('settings:llm:provider', 'openai');
    const openaiModel = await redisUtil.getRedisValue('settings:api:openai:model', 'gpt-4');
    const ollamaModel = await redisUtil.getRedisValue('settings:api:ollama:model', 'llama3.3');
    
    // Get available Ollama models if using Ollama
    let availableOllamaModels = [];
    const ollamaUtil = require('../utils/ollama');
console.log('[DEBUG] ollamaUtil keys (projectDetailController.js):', Object.keys(ollamaUtil));
    
    if (llmProvider === 'ollama') {
      try {
        const ollamaStatus = await ollamaUtil.checkStatus();
        if (ollamaStatus) {
          availableOllamaModels = await ollamaUtil.getModels();
          
          // Make sure our selected model is in the list
          const modelExists = availableOllamaModels.some(model => model.name === ollamaModel);
          if (!modelExists && ollamaModel) {
            // Add our selected model to the list if it's not there
            availableOllamaModels.push({ name: ollamaModel });
          }
          
          // Add llama3.3 if it's not in the list
          const llama3Exists = availableOllamaModels.some(model => model.name === 'llama3.3' || model.name === 'llama3.3:latest');
          if (!llama3Exists) {
            availableOllamaModels.push({ name: 'llama3.3:latest' });
          }
          
          if (availableOllamaModels.length === 0) {
            // Fallback if no models are found
            availableOllamaModels = [{ name: ollamaModel || 'llama3.3:latest' }];
          }
        }
      } catch (err) {
        console.error('Error fetching Ollama models:', err);
      }
    }
    // Get components for this project
    const componentsQuery = `
      SELECT c.* 
      FROM threat_model.components c
      JOIN threat_model.project_components pc ON c.id = pc.component_id
      WHERE pc.project_id = $1
      ORDER BY c.name
    `;
    const componentsResult = await pool.query(componentsQuery, [projectId]);
    const components = componentsResult.rows;
    
    res.render('threat-model-new', {
      project,
      components,
      pageTitle: `New Threat Model - ${project.name}`,
      active: 'projects',
      llmProvider,
      openaiModel,
      ollamaModel,
      availableOllamaModels
    });
  } catch (error) {
    console.error('Error loading threat model form:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading threat model form',
      errorDetails: error.message
    });
  }
});

/**
 * Clone a threat model
 */
router.post('/api/threat-models/:id/clone', ensureAuthenticated, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const threatModelId = req.params.id;
    const { project_id } = req.body;
    
    // Get the original threat model
    const getModelQuery = `
      SELECT * FROM threat_model.threat_models 
      WHERE id = $1
    `;
    const modelResult = await client.query(getModelQuery, [threatModelId]);
    
    if (modelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Threat model not found'
      });
    }
    
    const originalModel = modelResult.rows[0];
    
    // Create new threat model with incremented version
    const newModelQuery = `
      INSERT INTO threat_model.threat_models 
        (name, description, project_id, status, model_version, created_by)
      VALUES 
        ($1, $2, $3, 'Draft', $4, $5)
      RETURNING *
    `;
    
    const modelVersion = parseFloat(originalModel.model_version || '1.0') + 0.1;
    const newModelName = `${originalModel.name} (Copy)`;
    
    const newModelResult = await client.query(newModelQuery, [
      newModelName,
      originalModel.description,
      project_id,
      modelVersion.toFixed(1),
      req.user.id
    ]);
    
    const newModel = newModelResult.rows[0];
    
    // Copy all threats from the original model
    const getThreatMappingsQuery = `
      SELECT * FROM threat_model.threat_model_threats
      WHERE threat_model_id = $1
    `;
    const threatMappingsResult = await client.query(getThreatMappingsQuery, [threatModelId]);
    
    // Insert all threat mappings for the new model
    for (const mapping of threatMappingsResult.rows) {
      const newMappingQuery = `
        INSERT INTO threat_model.threat_model_threats
          (threat_model_id, threat_id, notes)
        VALUES
          ($1, $2, $3)
      `;
      
      await client.query(newMappingQuery, [
        newModel.id,
        mapping.threat_id,
        mapping.notes
      ]);
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      data: newModel
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cloning threat model:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
