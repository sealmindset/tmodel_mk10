// routes/threat-models-merge.js
// New PostgreSQL-only batch merge endpoint for threat models
const express = require('express');
const router = express.Router();
const db = require('../db/pool-wrapper'); // Adjust if you use a different DB wrapper

/**
 * POST /api/threat-models/merge-batch
 * Body: { primaryId: string, sourceIds: string[] }
 * Atomically merges threats from source models into the primary model
 */
router.post('/api/threat-models/merge-batch', async (req, res) => {
  const { primaryId, sourceIds } = req.body;
  if (!primaryId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    return res.status(400).json({ error: 'primaryId and sourceIds[] required' });
  }
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Fetch primary model
    const { rows: [primary] } = await client.query('SELECT * FROM threat_models WHERE id = $1 FOR UPDATE', [primaryId]);
    if (!primary) throw new Error('Primary model not found');
    let mergedThreats = new Set(JSON.parse(primary.threats || '[]'));
    // Fetch and merge source models
    for (const srcId of sourceIds) {
      const { rows: [src] } = await client.query('SELECT * FROM threat_models WHERE id = $1', [srcId]);
      if (!src) continue;
      JSON.parse(src.threats || '[]').forEach(t => mergedThreats.add(t));
    }
    // Update primary model
    await client.query(
      'UPDATE threat_models SET threats = $1, threat_count = $2, updated_at = NOW() WHERE id = $3',
      [JSON.stringify(Array.from(mergedThreats)), mergedThreats.size, primaryId]
    );
    await client.query('COMMIT');
    res.json({ success: true, mergedThreatCount: mergedThreats.size });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/threat-models/list
 * Returns all threat models for the React UI (id, title, threat_count, updated_at, response)
 */
router.get('/api/threat-models/list', async (req, res) => {
  try {
    const client = await db.connect();
    const { rows } = await client.query(`
      SELECT m.id, m.name AS title, m.description, m.updated_at, COUNT(t.id) AS threat_count
      FROM threat_models m
      LEFT JOIN threats t ON t.threat_model_id = m.id
      GROUP BY m.id, m.name, m.description, m.updated_at
      ORDER BY m.updated_at DESC
    `);
    client.release();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
