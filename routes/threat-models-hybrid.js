// routes/threat-models-hybrid.js
// Hybrid page combining EJS and React UI for threat model merging
const express = require('express');
const router = express.Router();
const db = require('../db/pool-wrapper'); // Use the same DB wrapper as the merge route

// Debug middleware to log all requests to this router
router.use((req, res, next) => {
  console.log('[HYBRID ROUTE] Request received:', req.method, req.url);
  next();
});

// Test route to verify router is registered
router.get('/hybrid-test', (req, res) => {
  console.log('[HYBRID ROUTE] Test route accessed');
  res.send('Hybrid router is working');
});

// Route to render the hybrid EJS+React page
router.get('/threat-models/hybrid', async (req, res) => {
  try {
    // Connect to database
    const client = await db.connect();
    
    // Get all threat models with threat counts
    const { rows: threatModels } = await client.query(`
      SELECT m.id, m.name AS title, m.description, m.updated_at, COUNT(t.id) AS threat_count
      FROM threat_models m
      LEFT JOIN threats t ON t.threat_model_id = m.id
      GROUP BY m.id, m.name, m.description, m.updated_at
      ORDER BY m.updated_at DESC
    `);
    
    client.release();
    
    // Render the hybrid page with the data
    res.render('threat-model-merge-hybrid', { 
      threatModels,
      pageTitle: 'Merge Threat Models - Hybrid UI'
    });
  } catch (err) {
    console.error('Error in hybrid page:', err);
    res.status(500).send('Server error loading the hybrid threat model merge page');
  }
});

module.exports = router;
