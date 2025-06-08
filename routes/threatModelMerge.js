/**
 * Threat Model Merge Routes
 * 
 * Provides routes for the threat model merge UI with hybrid EJS+React implementation
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const pool = require('../db/db');

/**
 * @route GET /merge-threat-models
 * @desc Render the threat model merge page with integrated React drag-and-drop UI
 * @access Private
 */
router.get('/merge-threat-models', ensureAuthenticated, async (req, res) => {
  try {
    // Get all threat models with proper field mapping for the React UI
    const { rows: threatModels } = await pool.query(`
      SELECT 
        tm.id, 
        tm.title, 
        tm.description, 
        tm.subject,
        tm.response_text,
        tm.system_context,
        tm.updated_at, 
        COUNT(t.id) AS threat_count
      FROM threat_model.threat_models tm
      LEFT JOIN threat_model.threats t ON t.threat_model_id = tm.id
      GROUP BY tm.id, tm.title, tm.description, tm.subject, tm.response_text, tm.system_context, tm.updated_at
      ORDER BY tm.updated_at DESC
    `);
    
    // Get detailed threat model data for compatibility with existing UI
    console.log('Fetching threat models from the database...');
    
    // First check if we have any threat models in the database
    const countQuery = 'SELECT COUNT(*) FROM threat_model.threat_models';
    const countResult = await pool.query(countQuery);
    const modelCount = parseInt(countResult.rows[0].count, 10);
    console.log(`Found ${modelCount} threat models in the database`);
    
    // If we have no threat models, add some seed data
    if (modelCount === 0) {
      console.log('No threat models found. Adding seed data...');
      try {
        await pool.query(`
          INSERT INTO threat_model.threat_models (title, description, system_context, response_text, created_at, updated_at)
          VALUES 
          ('API Gateway', 'Cloud API Gateway security assessment', 'AWS API Gateway with Lambda integrations', '## SQL Injection\n## XSS\n## CSRF', NOW(), NOW()),
          ('Data Warehouse', 'Data warehouse security model', 'Snowflake data warehouse with ETL pipelines', '## Data Leakage\n## Privilege Escalation\n## Insecure ETL', NOW(), NOW()),
          ('Mobile App', 'iOS mobile application', 'Native iOS app with backend APIs', '## Insecure Data Storage\n## Man-in-the-Middle\n## Broken Authentication', NOW(), NOW())
        `);
        console.log('Seed data added successfully');
      } catch (seedError) {
        console.error('Error adding seed data:', seedError);
      }
    }
    
    // Now get all threat models including any seed data we just added
    const pgModelsQuery = 'SELECT * FROM threat_model.threat_models ORDER BY created_at DESC';
    const pgModelsResult = await pool.query(pgModelsQuery);
    console.log(`Query returned ${pgModelsResult.rows.length} threat models`);
    
    const pgModels = pgModelsResult.rows.map(model => {
      let threat_count = 0;
      // Use response_text or fallback to response
      const responseText = model.response_text || model.response || '';
      // Use subject or fallback to subject_text
      const subject = model.subject || model.subject_text || '';
      if (responseText) {
        const threatPattern = /## (.*?)\n/g;
        let match;
        let matches = [];
        while ((match = threatPattern.exec(responseText)) !== null) {
          matches.push(match[1]);
        }
        threat_count = matches.length;
      }
      return {
        ...model,
        subject,
        response_text: responseText,
        responseText: responseText, // For compatibility with /results
        threat_count
      };
    });
    
    console.log('Processed threat models with threat counts:', 
      pgModels.map(m => ({ id: m.id, title: m.title, threat_count: m.threat_count })));
    
    // Render our hybrid page
    res.render('threat-model-merge-hybrid', {
      pgModels: pgModels, // Use consistent naming across both UIs
      redisModels: [], // For legacy template compatibility
      pageTitle: 'Merge Threat Models',
      active: 'threat-models'
    });
  } catch (error) {
    console.error('Error loading threat model merge page:', error);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading threat model merge page',
      errorDetails: error.message
    });
  }
});

module.exports = router;
