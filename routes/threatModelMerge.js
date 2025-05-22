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
    // Get PostgreSQL threat models
    const pgModelsQuery = `
      SELECT tm.*, 
        COUNT(t.id)::integer as threat_count,
        COALESCE(AVG(t.risk_score), 0)::integer as avg_risk_score
      FROM threat_model.threat_models tm
      LEFT JOIN threat_model.threats t ON tm.id = t.threat_model_id
      GROUP BY tm.id
      ORDER BY tm.created_at DESC
    `;
    
    const pgModelsResult = await pool.query(pgModelsQuery);
    const pgModels = pgModelsResult.rows;
    
    res.render('threat-model-merge', {
      pgModels,
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
