// services/promptService.js
// Service for CRUD operations on prompts in PostgreSQL

const dbSettingsService = require('./dbSettingsService');
const TABLE = 'threat_model.prompts';

async function getAllPrompts() {
  console.log('[promptService] getAllPrompts called');
  const query = `SELECT * FROM ${TABLE} ORDER BY created_at DESC`;
  const pool = await dbSettingsService.getConnection();
  try {
    console.log('[promptService] Executing query:', query);
    const res = await pool.query(query);
    console.log('[promptService] getAllPrompts result count:', res.rows.length);
    return res.rows;
  } catch (error) {
    console.error('[promptService] Error in getAllPrompts:', error);
    throw error;
  }
}

async function getPromptById(id) {
  console.log('[promptService] getPromptById called with id:', id);
  const query = `SELECT * FROM ${TABLE} WHERE id = $1`;
  const pool = await dbSettingsService.getConnection();
  try {
    console.log('[promptService] Executing query:', query, 'with id:', id);
    const res = await pool.query(query, [id]);
    console.log('[promptService] getPromptById found:', res.rows[0]);
    return res.rows[0] || null;
  } catch (error) {
    console.error('[promptService] Error in getPromptById:', error);
    throw error;
  }
}

async function createPrompt({ id, title, prompt_text, description }) {
  console.log('[promptService] createPrompt called with:', { id, title, prompt_text, description });
  const pool = await dbSettingsService.getConnection();
  try {
    const res = await pool.query(
      `INSERT INTO ${TABLE} (id, title, prompt_text, description) VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4) RETURNING *`,
      [id || null, title, prompt_text, description || null]
    );
    return res.rows[0];
  } catch (error) {
    console.error('[promptService] Error in createPrompt:', error);
    throw error;
  }
}

async function updatePrompt(id, { title, prompt_text, description }) {
  console.log('[promptService] updatePrompt called with:', { id, title, prompt_text, description });
  const pool = await dbSettingsService.getConnection();
  try {
    const res = await pool.query(
      `UPDATE ${TABLE} SET title = $2, prompt_text = $3, description = $4 WHERE id = $1 RETURNING *`,
      [id, title, prompt_text, description || null]
    );
    return res.rows[0];
  } catch (error) {
    console.error('[promptService] Error in updatePrompt:', error);
    throw error;
  }
}

async function deletePrompt(id) {
  console.log('[promptService] deletePrompt called with id:', id);
  const query = `DELETE FROM ${TABLE} WHERE id = $1`;
  const pool = await dbSettingsService.getConnection();
  try {
    console.log('[promptService] Executing query:', query, 'with id:', id);
    await pool.query(query, [id]);
    console.log('[promptService] deletePrompt completed for id:', id);
    return true;
  } catch (error) {
    console.error('[promptService] Error in deletePrompt:', error);
    throw error;
  }
}

module.exports = {
  getAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
};
