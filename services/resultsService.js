const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');

// List all threat models
async function getAllResults() {
  const res = await db.query('SELECT * FROM threat_model.threat_models ORDER BY created_at DESC');
  return res.rows;
}

// Get a single threat model by ID
async function getResultById(id) {
  const res = await db.query('SELECT * FROM threat_model.threat_models WHERE id = $1', [id]);
  return res.rows[0] || null;
}

// Create a new threat model
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

async function createResult(fields) {
  if (!fields.title) throw new ValidationError('Title is required');
  if (!fields.response_text) throw new ValidationError('response_text is required');
  try {
    // Debug: log incoming payload
    console.log('[resultsService.createResult] Incoming fields:', JSON.stringify(fields));
    const id = uuidv4();
    const now = new Date();
    const {
      title, description, response_text, model, created_by, project_id,
      subject_text, model_provider, raw_model_input, metadata, redis_id,
      response, threat_count, merge_metadata, source
    } = fields;
    const res = await db.query(
      `INSERT INTO threat_model.threat_models
        (id, title, description, response_text, model, created_by, project_id, subject_text, model_provider, raw_model_input, metadata, redis_id, response, threat_count, merge_metadata, source, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
        RETURNING *`,
      [
        id, title, description || '', response_text || '', model || null, created_by || null, project_id || null,
        subject_text || null, model_provider || null, raw_model_input || null, metadata || null, redis_id || null,
        response || null, threat_count || null, merge_metadata || null, source || 'web', now
      ]
    );
    return res.rows[0];
  } catch (error) {
    // Only log DB errors as errors, validation errors are handled by controller
    if (!(error instanceof ValidationError)) {
      console.error('[resultsService.createResult] DB error:', error.message, error.stack);
    }
    throw error;
  }
}


// Update a threat model by ID
async function updateResult(id, fields) {
  if (!id || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    throw new ValidationError('updateResult requires id and at least one field to update');
  }
  try {
    console.log('[resultsService.updateResult] id:', id, 'fields:', JSON.stringify(fields));
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
    values.push(new Date()); // updated_at
    setClauses.push(`updated_at = $${idx++}`);
    values.push(id);
    const query = `UPDATE threat_model.threat_models SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await db.query(query, values);
    if (!res.rows[0]) {
      console.warn(`[resultsService.updateResult] No result found for id: ${id}`);
    }
    return res.rows[0] || null;
  } catch (error) {
    // Only log DB errors as errors, validation errors are handled by controller
    if (!(error instanceof ValidationError)) {
      console.error('[resultsService.updateResult] DB error:', error.message, error.stack);
    }
    throw error;
  }
}

// Delete a threat model by ID
async function deleteResult(id) {
  const res = await db.query('DELETE FROM threat_model.threat_models WHERE id = $1 RETURNING *', [id]);
  return res.rows[0] || null;
}

module.exports = {
  getAllResults,
  getResultById,
  createResult,
  updateResult,
  deleteResult
};