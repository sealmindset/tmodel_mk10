#!/usr/bin/env node
/**
 * scripts/ingest-rag.js
 * Ingest threat-level chunks into threat_model.rag_chunks using OpenAI embeddings.
 *
 * - Reads threat models from threat_model.threat_models
 * - Parses threats using services/threatModelService.parseThreatsFromResponse
 * - Embeds each threat content via utils/openai
 * - Inserts into threat_model.rag_chunks with content_hash deduplication
 *
 * Usage:
 *   node scripts/ingest-rag.js [--limit 200] [--dry-run]
 */

const crypto = require('crypto');
const db = require('../database');
const logger = require('../utils/logger').forModule('ragIngest');
const openaiUtil = require('../utils/openai');
const settingsService = require('../services/settingsService');
const { parseThreatsFromResponse } = require('../services/threatModelService');

function argFlag(name, def = false) {
  return process.argv.includes(name) ? true : def;
}
function argInt(name, def) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) {
    const v = parseInt(process.argv[idx + 1], 10);
    return Number.isFinite(v) ? v : def;
  }
  return def;
}

const DRY_RUN = argFlag('--dry-run', false);
const LIMIT = argInt('--limit', 200);

const log = (level, msg, data) => {
  const entry = { module: 'ragIngest', msg, ...(data || {}) };
  if (level === 'error') console.error('[ragIngest]', entry);
  else if (level === 'warn') console.warn('[ragIngest]', entry);
  else console.log('[ragIngest]', entry);
};

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
  // crude heuristic: 4 chars per token average
  return Math.max(1, Math.ceil(text.length / 4));
}

async function fetchThreatModels(limit) {
  const sql = `
    SELECT id, title, description, response_text, model, created_by, created_at
    FROM threat_model.threat_models
    ORDER BY created_at DESC
    LIMIT $1
  `;
  const res = await db.query(sql, [limit]);
  return res.rows;
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
    row.embedding // must be a pgvector literal string '[v1,v2,...]'
  ];
  if (DRY_RUN) return { rowCount: 0, rows: [] };
  return db.query(sql, params);
}

async function main() {
  log('info', 'Begin ingestion', { DRY_RUN, LIMIT });

  // Ensure OpenAI client ready
  const ok = await openaiUtil.refreshClient();
  if (!ok) {
    throw new Error('OpenAI client not ready (no API key?)');
  }
  let apiKeyLen = 0;
  try {
    const k = await openaiUtil.getApiKey();
    apiKeyLen = k ? k.length : 0;
  } catch {}
  log('info', 'OpenAI client refreshed', { apiKeyLen });

  const embeddingModel = await settingsService.getSetting('rag.embedding_model', 'text-embedding-3-small');
  log('info', 'Embedding model', { embeddingModel });

  // Fetch recent threat models (adjust query for your needs)
  const models = await fetchThreatModels(LIMIT);
  log('info', 'Fetched threat models', { count: models.length });

  let totalParsed = 0;
  let totalInserted = 0;
  for (const m of models) {
    const threats = parseThreatsFromResponse(m.response_text || m.responseText || '');
    log('info', 'Parsed threats', { modelId: m.id, count: threats.length, title: m.title });
    totalParsed += threats.length;

    for (const t of threats) {
      const section = 'threat';
      const threatTitle = t.title || null;
      const content = t.content || t.description || t.title || '';
      if (!content || content.trim().length === 0) continue;

      // Embed
      let embedding;
      try {
        const resp = await openaiUtil.openai.embeddings.create({ model: embeddingModel, input: content });
        const vec = resp.data?.[0]?.embedding;
        if (!Array.isArray(vec) || vec.length === 0) {
          log('warn', 'Empty embedding', { modelId: m.id, threatTitle });
          continue;
        }
        embedding = '[' + vec.join(',') + ']';
      } catch (e) {
        log('error', 'Embedding failed', { error: e.message, modelId: m.id, threatTitle });
        continue;
      }

      const row = {
        source_table: 'threat_models_response',
        record_id: m.id,
        section,
        threat_title: threatTitle,
        content,
        content_hash: hashContent(m.id, threatTitle, content),
        tokens: estimateTokens(content),
        metadata: {
          title: m.title || null,
          description: m.description || null,
          model: m.model || null,
          created_by: m.created_by || null,
          source: 'postgres',
        },
        quality_score: null,
        embedding,
      };

      try {
        const res = await insertChunk({ ...row, metadata: JSON.stringify(row.metadata) });
        const inserted = res.rowCount || 0;
        totalInserted += inserted;
        log('info', 'Inserted chunk', { modelId: m.id, threatTitle, inserted });
      } catch (e) {
        log('error', 'Insert failed', { error: e.message, modelId: m.id, threatTitle });
      }
    }
  }

  log('info', 'Ingestion complete', { totalParsed, totalInserted, DRY_RUN });
}

main().then(() => process.exit(0)).catch((e) => {
  log('error', 'Fatal', { error: e.message, stack: e.stack });
  process.exit(1);
});
