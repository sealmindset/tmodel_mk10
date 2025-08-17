/**
 * services/ragIngestService.js
 * Ingests RAG chunks for a specific threat model (record_id) by parsing its
 * response text into threat-level chunks, embedding them, and storing rows in
 * threat_model.rag_chunks. Can optionally cleanup prior chunks for the model.
 */

const crypto = require('crypto');
const db = require('../database');
const logger = require('../utils/logger').forModule('ragIngestService');
const openaiUtil = require('../utils/openai');
const settingsService = require('../services/settingsService');
const { getThreatModel, parseThreatsFromResponse } = require('../services/threatModelService');

function hashContent(recordId, threatTitle, content) {
  const h = crypto.createHash('sha256');
  h.update(String(recordId || ''));
  h.update('|');
  h.update(String(threatTitle || ''));
  h.update('|');
  h.update(String(content || ''));
  return h.digest('hex');
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

async function cleanupExistingChunks(recordId, section = 'threat') {
  await db.query(
    `DELETE FROM threat_model.rag_chunks WHERE record_id = $1 AND section = $2`,
    [recordId, section]
  );
}

async function insertChunk(row) {
  const sql = `
    INSERT INTO threat_model.rag_chunks (
      source_table, record_id, section, threat_title, content, content_hash,
      tokens, metadata, quality_score, embedding
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (content_hash) DO NOTHING
    RETURNING id
  `;
  const params = [
    row.source_table,
    row.record_id,
    row.section,
    row.threat_title,
    row.content,
    row.content_hash,
    row.tokens,
    row.metadata,
    row.quality_score,
    row.embedding
  ];
  return db.query(sql, params);
}

/**
 * Ingest threat-level RAG chunks for a single threat model UUID
 * @param {string} modelId UUID of the threat model in threat_model.threat_models
 * @param {{cleanup?: boolean}} options
 */
async function ingestThreatModel(modelId, options = {}) {
  const { cleanup = false } = options;
  const started = Date.now();
  logger.info('Begin per-model ingestion', { modelId, cleanup });

  if (!modelId) throw new Error('modelId is required');

  // 1) Load model
  const tm = await getThreatModel(modelId);
  if (!tm || !tm.pgRecord) {
    throw new Error(`Threat model ${modelId} not found`);
  }

  const responseText = tm.responseText || tm.pgRecord.response_text || '';
  const title = tm.pgRecord.title || null;
  const description = tm.pgRecord.description || null;
  const created_by = tm.pgRecord.created_by || null;
  const model = tm.pgRecord.model || null;

  // 2) Parse threats
  const threats = parseThreatsFromResponse(responseText);
  logger.info('Parsed threats from response', { modelId, count: threats.length, title });

  if (cleanup) {
    await cleanupExistingChunks(modelId, 'threat');
    logger.info('Cleaned up existing RAG chunks for model', { modelId });
  }

  // 3) Ensure OpenAI client and embedding model
  await openaiUtil.refreshClient();
  const embeddingModel = await settingsService.getSetting('rag.embedding_model', 'text-embedding-3-small');

  let totalInserted = 0;

  for (const t of threats) {
    const section = 'threat';
    const threatTitle = t.title || null;
    const content = t.content || t.description || t.title || '';
    if (!content || content.trim().length === 0) continue;

    // 3a) Embed
    let embedding;
    try {
      const resp = await openaiUtil.openai.embeddings.create({ model: embeddingModel, input: content });
      const vec = resp.data?.[0]?.embedding;
      if (!Array.isArray(vec) || vec.length === 0) {
        logger.warn('Empty embedding', { modelId, threatTitle });
        continue;
      }
      embedding = '[' + vec.join(',') + ']';
    } catch (e) {
      logger.error('Embedding failed', { error: e.message, modelId, threatTitle });
      continue;
    }

    const row = {
      source_table: 'threat_models_response',
      record_id: modelId,
      section,
      threat_title: threatTitle,
      content,
      content_hash: hashContent(modelId, threatTitle, content),
      tokens: estimateTokens(content),
      metadata: JSON.stringify({ title, description, model, created_by, source: 'postgres' }),
      quality_score: null,
      embedding,
    };

    try {
      const res = await insertChunk(row);
      const inserted = res.rowCount || 0;
      totalInserted += inserted;
      logger.info('Inserted chunk', { modelId, threatTitle, inserted });
    } catch (e) {
      logger.error('Insert failed', { error: e.message, modelId, threatTitle });
    }
  }

  const ms = Date.now() - started;
  logger.info('Per-model ingestion complete', { modelId, totalInserted, ms });
  return { modelId, inserted: totalInserted, ms };
}

module.exports = {
  ingestThreatModel,
};
