// routes/threat-models-merge.js
// New PostgreSQL-only batch merge endpoint for threat models
const express = require('express');
const router = express.Router();
const db = require('../db/pool-wrapper'); // Adjust if you use a different DB wrapper
const { ingestThreatModel } = require('../services/ragIngestService');

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
    const { rows: [primary] } = await client.query('SELECT * FROM threat_model.threat_models WHERE id = $1 FOR UPDATE', [primaryId]);
    if (!primary) throw new Error('Primary model not found');
    // Helper to dedupe threats by title+content
    function dedupeThreats(threats) {
      const seen = new Set();
      const result = [];
      for (const t of threats) {
        if (!t || typeof t !== 'object') continue;
        const key = (t.title || t.name || '') + '|' + (t.content || t.description || '');
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            title: t.title || t.name || 'Untitled Threat',
            content: t.content || t.description || ''
          });
        }
      }
      return result;
    }
    // Helper to parse threats robustly, fallback to response_text if needed
    function parseThreatsField(model) {
      // Try to parse threats JSON
      try {
        if (model.threats && typeof model.threats === 'string' && model.threats.trim() !== '') {
          const parsed = JSON.parse(model.threats);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (err) {
        // Will fallback below
      }
      // Fallback: parse from response_text Markdown if available
      if (model.response_text && typeof model.response_text === 'string' && model.response_text.trim() !== '') {
        // Split on Markdown '##' headers
        const sections = model.response_text.split(/(^|\n)## /).filter(s => s.trim() !== '');
        return sections.map(section => {
          // First line = title, rest = content
          const [firstLine, ...rest] = section.split('\n');
          return {
            title: firstLine ? firstLine.trim() : 'Untitled Threat',
            content: rest.join('\n').trim()
          };
        });
      }
      // No threats found
      return [];
    }

    let allThreats = [];
    allThreats = allThreats.concat(parseThreatsField(primary));
    for (const srcId of sourceIds) {
      const { rows: [src] } = await client.query('SELECT * FROM threat_model.threat_models WHERE id = $1', [srcId]);
      if (!src) continue;
      allThreats = allThreats.concat(parseThreatsField(src));
    }
    const mergedThreats = dedupeThreats(allThreats);

    await client.query(
      'UPDATE threat_model.threat_models SET threats = $1, threat_count = $2, updated_at = NOW() WHERE id = $3',
      [JSON.stringify(mergedThreats), mergedThreats.length, primaryId]
    );
    await client.query('COMMIT');
    // Schedule RAG ingestion for primary model after successful merge
    try {
      setImmediate(async () => {
        try {
          console.log('[RAG] Scheduling ingestion (merge-batch legacy) for', primaryId);
          const resp = await ingestThreatModel(primaryId, { cleanup: true });
          console.log('[RAG] Ingestion complete (merge-batch legacy)', resp);
        } catch (e) {
          console.error('[RAG] Ingestion error (merge-batch legacy) for', primaryId, e);
        }
      });
    } catch (e) {
      console.error('[RAG] Failed to schedule ingestion (merge-batch legacy)', e);
    }
    res.json({ success: true, mergedThreatCount: mergedThreats.length });
  } catch (e) {
    await client.query('ROLLBACK');
    // Log full error stack and request data for debugging
    console.error('[merge-batch ERROR]', {
      error: e && e.stack ? e.stack : e,
      requestBody: req.body
    });
    res.status(500).json({ error: e.message || String(e) });
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

// GET /api/threat-models/:id - fetch full details for a single threat model
router.get('/api/threat-models/:id', async (req, res) => {
  try {
    const client = await db.connect();
    const { id } = req.params;
    const query = `
      SELECT m.id, m.title, m.description, m.updated_at, m.threats, m.response_text
      FROM threat_model.threat_models m
      WHERE m.id = $1
      LIMIT 1
    `;
    // Accept UUID as string, do not cast to integer
    const { rows } = await client.query(query, [id]);
    client.release();
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Threat model not found' });
    }
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
