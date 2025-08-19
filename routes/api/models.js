// routes/api/models.js
// CRUD endpoints for /api/models

const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../../middleware/auth');
const db = require('../../db/db');
const { v4: uuidv4 } = require('uuid');
const { ingestThreatModel } = require('../../services/ragIngestService');

/**
 * @route   GET /api/models
 * @desc    Get all models
 * @access  Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM threat_model.threat_models ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GET /api/models] Error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/models/:id
 * @desc    Get a single model by ID
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM threat_model.threat_models WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[GET /api/models/:id] Error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/models
 * @desc    Create a new model
 * @access  Private
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { title, description, response_text, model, model_version, status, project_id, source } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const id = uuidv4();
    const now = new Date();
    const result = await db.query(
      'INSERT INTO threat_model.threat_models (id, title, description, response_text, model, model_version, status, project_id, source, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *',
      [id, title, description || '', response_text || '', model || '', model_version || '', status || 'Draft', project_id || null, source || 'manual', now]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[POST /api/models] Error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   PUT /api/models/:id
 * @desc    Update a model
 * @access  Private
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, response_text, model, model_version, status, project_id, source } = req.body;
    const now = new Date();
    const result = await db.query(
      'UPDATE threat_model.threat_models SET title = $1, description = $2, response_text = $3, model = $4, model_version = $5, status = $6, project_id = $7, source = $8, updated_at = $9 WHERE id = $10 RETURNING *',
      [title, description || '', response_text || '', model || '', model_version || '', status || 'Draft', project_id || null, source || 'manual', now, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    // Schedule ingestion to refresh RAG for manual edits
    try {
      setImmediate(async () => {
        try {
          console.log('[RAG] Scheduling ingestion (manual PUT) for', id);
          const resp = await ingestThreatModel(id, { cleanup: true });
          console.log('[RAG] Ingestion complete (manual PUT)', resp);
        } catch (e) {
          console.error('[RAG] Ingestion error (manual PUT) for', id, e);
        }
      });
    } catch (e) {
      console.error('[RAG] Failed to schedule ingestion (manual PUT)', e);
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[PUT /api/models/:id] Error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/models/:id
 * @desc    Delete a model
 * @access  Private
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM threat_model.threat_models WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Model not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[DELETE /api/models/:id] Error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
