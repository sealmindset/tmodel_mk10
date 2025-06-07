/**
 * Threat Model Merge Routes
 * 
 * Provides routes for the threat model merge UI
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const pool = require('../db/db');

/**
 * @route GET /merge-threat-models
 * @desc Render the threat model merge page
 * @access Private
 */
router.get('/merge-threat-models', ensureAuthenticated, async (req, res) => {
  try {
    // Get all threat models from PostgreSQL
    const pgModelsQuery = 'SELECT * FROM threat_model.threat_models ORDER BY created_at DESC';
    const pgModelsResult = await pool.query(pgModelsQuery);
    // Compute threat_count for each model by parsing response_text
    const pgModels = pgModelsResult.rows.map(model => {
      let threat_count = 0;
      if (model.response_text) {
        const threatPattern = /## (.*?)\n/g;
        let match;
        let matches = [];
        while ((match = threatPattern.exec(model.response_text)) !== null) {
          matches.push(match[1]);
        }
        threat_count = matches.length;
      }
      return {
        ...model,
        threat_count
      };
    });
    res.render('threat-model-merge', {
      pgModels,
      redisModels: [], // Always provide redisModels for template compatibility
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
