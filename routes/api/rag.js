// routes/api/rag.js
// RAG retrieval endpoint for threat-level chunks (no projects/components/etc.)

const express = require('express');
const router = express.Router();
const db = require('../../database');
const logger = require('../../utils/logger').forModule('ragRoute');
const openaiUtil = require('../../utils/openai');
const { profileSubject } = require('../../utils/subjectProfiler');
const settingsService = require('../../services/settingsService');
const { ingestThreatModel } = require('../../services/ragIngestService');

// POST /api/rag/search
// Body: { query: string, topK?: number, maxDistance?: number }
router.post('/search', async (req, res) => {
  const startTs = Date.now();
  try {
    const { query, topK, maxDistance } = req.body || {};
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    // Settings with defaults
    const embeddingModel = await settingsService.getSetting('rag.embedding_model', 'text-embedding-3-small');
    const k = Math.max(1, Math.min(Number(topK) || (await settingsService.getSetting('rag.top_k', 8)), 50));
    const cutoff = Number(maxDistance) || (await settingsService.getSetting('rag.retrieval_distance_cutoff', 0.35));

    // Profile subject for optional applicability scoring
    const subjectProfile = profileSubject(query);

    // Ensure OpenAI client is ready and create embedding
    let queryEmbedding;
    try {
      await openaiUtil.refreshClient();
      // Diagnostic: confirm key presence/length at route call-time
      try {
        const diagKey = await openaiUtil.getApiKey();
        logger.info('Diag OpenAI key length before embeddings', { len: diagKey ? diagKey.length : 0 });
      } catch (e) {
        logger.warn('Diag could not read OpenAI key');
      }
      const embedStart = Date.now();
      const embedResp = await openaiUtil.openai.embeddings.create({
        model: embeddingModel,
        input: query
      });
      queryEmbedding = embedResp.data?.[0]?.embedding;
      if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
        logger.error('Failed to compute query embedding');
        return res.status(500).json({ success: false, error: 'Failed to compute query embedding' });
      }
      logger.info('Computed query embedding', { ms: Date.now() - embedStart, dim: queryEmbedding.length });
    } catch (embErr) {
      logger.error('Embedding error', { error: embErr.message });
      return res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Embedding error' : `Embedding error: ${embErr.message}` });
    }

    // Serialize embedding as pgvector literal: '[v1,v2,...]'
    const sqlVector = '[' + queryEmbedding.join(',') + ']';

    // KNN over threat chunks
    const sql = `
      WITH q AS (
        SELECT $1::vector AS query_embedding
      )
      SELECT id, source_table, record_id, section, threat_title, content, tokens, metadata,
             (embedding <=> (SELECT query_embedding FROM q)) AS distance
        FROM threat_model.rag_chunks
       WHERE section = 'threat'
       ORDER BY embedding <=> (SELECT query_embedding FROM q)
       LIMIT $2
    `;

    const qStart = Date.now();
    let result;
    try {
      result = await db.query(sql, [sqlVector, k * 4]); // overfetch for post-filter
    } catch (dbErr) {
      logger.error('DB query error in RAG', { error: dbErr.message });
      return res.status(500).json({ success: false, error: process.env.NODE_ENV === 'production' ? 'Database error' : `Database error: ${dbErr.message}` });
    }
    logger.info('Vector search done', { ms: Date.now() - qStart, rows: result.rows.length });

    // Post-filter by distance and simple applicability rules
    const matches = [];
    for (const row of result.rows) {
      const distance = Number(row.distance);
      if (!isFinite(distance) || distance > cutoff) continue;
      const md = row.metadata || {};

      // Applicability: if subject profile has env/platform, require some overlap when available
      let applicable = true;
      const env = Array.isArray(md.environment) ? md.environment : [];
      const plat = Array.isArray(md.platform) ? md.platform : [];

      const hasEnv = subjectProfile.environment.length > 0 && env.length > 0;
      const hasPlat = subjectProfile.platform.length > 0 && plat.length > 0;

      if (hasEnv && !subjectProfile.environment.some((t) => env.includes(t))) applicable = false;
      if (hasPlat && !subjectProfile.platform.some((t) => plat.includes(t))) applicable = false;

      if (!applicable) continue;

      // Score boost for applicability
      let boost = 0;
      if (hasEnv) boost += 0.02; // small improvement
      if (hasPlat) boost += 0.02;

      matches.push({ ...row, distance: Math.max(0, distance - boost) });
    }

    // Re-rank by (possibly boosted) distance and take topK
    matches.sort((a, b) => a.distance - b.distance);
    const top = matches.slice(0, k).map((m) => ({
      id: m.id,
      source_table: m.source_table,
      record_id: m.record_id,
      section: m.section,
      threat_title: m.threat_title,
      content: m.content,
      tokens: m.tokens,
      metadata: m.metadata,
      distance: m.distance
    }));

    const ms = Date.now() - startTs;
    logger.info('RAG search complete', { queryLen: query.length, k, cutoff, returned: top.length, ms, subjectProfile });

    res.json({ success: true, items: top, profile: subjectProfile, model: embeddingModel });
  } catch (err) {
    logger.error('RAG search error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Internal error running RAG search' });
  }
});

// GET /api/rag/chunk/:id
// Fetch a single chunk by primary key id
router.get('/chunk/:id', async (req, res) => {
  const { id } = req.params;
  const startTs = Date.now();
  try {
    const sql = `
      SELECT id, source_table, record_id, section, threat_title, content, tokens, metadata
        FROM threat_model.rag_chunks
       WHERE id = $1
    `;
    const result = await db.query(sql, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    logger.info('Fetched rag chunk by id', { id, ms: Date.now() - startTs });
    return res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    logger.error('Error fetching rag chunk by id', { id, error: err.message });
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/rag/selftest
// Runs a lightweight diagnostic: count rows, check index presence, try a sample search
router.post('/selftest', async (req, res) => {
  const started = Date.now();
  const details = { steps: [] };
  try {
    // 1) Count chunks
    let count = 0;
    try {
      const c = await db.query("SELECT COUNT(*)::int AS c FROM threat_model.rag_chunks WHERE section = 'threat'");
      count = c.rows[0]?.c || 0;
      details.steps.push({ step: 'count_chunks', ok: true, count });
    } catch (e) {
      details.steps.push({ step: 'count_chunks', ok: false, error: e.message });
    }

    // 2) Check index on embedding
    try {
      const idx = await db.query(`
        SELECT indexname, indexdef
          FROM pg_indexes
         WHERE schemaname = 'threat_model'
           AND tablename = 'rag_chunks'
           AND indexdef ILIKE '%embedding%';
      `);
      details.steps.push({ step: 'check_index', ok: idx.rows.length > 0, indexes: idx.rows });
    } catch (e) {
      details.steps.push({ step: 'check_index', ok: false, error: e.message });
    }

    // 3) Sample search if we have any rows
    let sample = null;
    try {
      if (count > 0) {
        const cutoff = await settingsService.getSetting('rag.retrieval_distance_cutoff', 0.45);
        const body = { query: 'OAuth token theft', topK: 3, maxDistance: cutoff };
        // Reuse the same logic by calling our handler code path without HTTP
        await openaiUtil.refreshClient();
        const embeddingModel = await settingsService.getSetting('rag.embedding_model', 'text-embedding-3-small');
        const embedResp = await openaiUtil.openai.embeddings.create({ model: embeddingModel, input: body.query });
        const vec = '[' + embedResp.data?.[0]?.embedding.join(',') + ']';
        const sql = `
          WITH q AS (SELECT $1::vector AS query_embedding)
          SELECT id, threat_title, content, (embedding <=> (SELECT query_embedding FROM q)) AS distance
            FROM threat_model.rag_chunks
           WHERE section = 'threat'
           ORDER BY embedding <=> (SELECT query_embedding FROM q)
           LIMIT 5;
        `;
        const rows = await db.query(sql, [vec]);
        const matches = rows.rows
          .map(r => ({ id: r.id, threat_title: r.threat_title, distance: Number(r.distance) }))
          .filter(r => isFinite(r.distance) && r.distance <= body.maxDistance)
          .slice(0, body.topK);
        sample = { query: body.query, cutoff, returned: matches.length, matches };
        details.steps.push({ step: 'sample_search', ok: true, sample });
      } else {
        details.steps.push({ step: 'sample_search', ok: true, skipped: true, reason: 'no_rows' });
      }
    } catch (e) {
      details.steps.push({ step: 'sample_search', ok: false, error: e.message });
    }

    return res.json({ success: true, ms: Date.now() - started, details });
  } catch (err) {
    logger.error('RAG selftest error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Internal error running selftest' });
  }
});

// POST /api/rag/ingest/:modelId
// Ingest threat-level chunks for a specific threat model id
router.post('/ingest/:modelId', async (req, res) => {
  const { modelId } = req.params;
  const { cleanup } = req.body || {};
  const started = Date.now();
  try {
    if (!modelId) {
      return res.status(400).json({ success: false, error: 'modelId is required' });
    }
    const result = await ingestThreatModel(modelId, { cleanup: Boolean(cleanup) });
    return res.json({ success: true, ...result, ms: Date.now() - started });
  } catch (err) {
    logger.error('Per-model ingestion error', { modelId, error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
