const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../../middleware/auth');
const resultsService = require('../../services/resultsService');

// GET all threat models (as results)
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const results = await resultsService.getAllResults();
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[GET /api/results] Error:', error);
    res.status(500).json({ success: false, error: 'An error occurred while processing your request.', details: error.message });
  }
});

// GET a single threat model by ID
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await resultsService.getResultById(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[GET /api/results/:id] Error:', error);
    res.status(500).json({ success: false, error: 'An error occurred while processing your request.', details: error.message });
  }
});

// CREATE a new threat model
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const result = await resultsService.createResult(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error.name === 'ValidationError') {
      res.status(400).json({ success: false, error: error.message });
    } else {
      console.error('[POST /api/results] Error:', error);
      res.status(500).json({ success: false, error: 'An error occurred while processing your request.', details: error.message });
    }
  }
});

// UPDATE a threat model by ID
router.put('/:id', ensureAuthenticated, async (req, res) => {
  console.log('PUT /api/results/:id called', req.params, req.body);
  try {
    const { id } = req.params;
    const result = await resultsService.updateResult(id, req.body);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[PUT /api/results/:id] Error:', error, JSON.stringify(error));
    res.status(500).json({ success: false, error: error.message || JSON.stringify(error) || 'An error occurred while processing your request.' });
  }
});

// DELETE a threat model by ID
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await resultsService.deleteResult(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[DELETE /api/results/:id] Error:', error);
    res.status(500).json({ success: false, error: 'An error occurred while processing your request.', details: error.message });
  }
});

// Catch-all for unmatched API routes (debugging)
router.use((req, res, next) => {
  console.log('UNMATCHED API ROUTE:', req.method, req.originalUrl, req.body);
  next();
});

module.exports = router;