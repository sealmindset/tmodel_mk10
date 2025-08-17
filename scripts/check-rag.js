#!/usr/bin/env node
/**
 * scripts/check-rag.js
 * Safe, read-only checker for RAG storage.
 * - Verifies pgvector extension, schema and table existence
 * - Prints row count and a small sample
 *
 * Logs at each step to aid troubleshooting.
 */

const db = require('../database');
const { Pool } = require('pg');

const STEP = (name) => console.log(`[check-rag] STEP: ${name}`);
const INFO = (msg, obj) => console.log(`[check-rag] INFO: ${msg}`, obj || '');
const WARN = (msg, obj) => console.warn(`[check-rag] WARN: ${msg}`, obj || '');
const ERR = (msg, obj) => console.error(`[check-rag] ERROR: ${msg}`, obj || '');

async function query(sql, params = []) {
  try {
    return await db.query(sql, params);
  } catch (e) {
    ERR('Query failed', { sql, params, error: e.message });
    throw e;
  }
}

async function main() {
  STEP('Begin RAG storage verification');

  // Show connection info (non-sensitive)
  INFO('DB connection params', {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
  });

  // 1) Check pgvector extension
  STEP('Check pgvector extension');
  const ext = await query("SELECT extname, extversion FROM pg_extension WHERE extname='vector'");
  if (ext.rowCount === 0) {
    WARN('pgvector extension not found. Create it with: CREATE EXTENSION IF NOT EXISTS vector;');
  } else {
    INFO('pgvector extension', ext.rows[0]);
  }

  // 2) Ensure schema exists (read-only check)
  STEP('Check threat_model schema');
  const sch = await query("SELECT schema_name FROM information_schema.schemata WHERE schema_name='threat_model'");
  if (sch.rowCount === 0) {
    WARN("Schema 'threat_model' not found.");
  } else {
    INFO('Schema exists', sch.rows[0]);
  }

  // 3) Check table exists
  STEP('Check threat_model.rag_chunks table');
  const tbl = await query(
    "SELECT to_regclass('threat_model.rag_chunks') AS oid"
  );
  const exists = tbl.rows[0] && tbl.rows[0].oid !== null;
  INFO('rag_chunks exists?', { exists });

  if (!exists) {
    WARN('Table threat_model.rag_chunks not found. Run migration: db/migrations/20250816_create_rag_chunks.sql');
    return;
  }

  // 4) Show table details (vector dim type)
  STEP('Inspect embedding column type');
  const col = await query(
    "SELECT atttypid::regtype AS col_type FROM pg_attribute WHERE attrelid='threat_model.rag_chunks'::regclass AND attname='embedding'"
  );
  if (col.rowCount > 0) INFO('embedding column type', col.rows[0]);

  // 5) Row count
  STEP('Count rows');
  const cnt = await query('SELECT count(*)::int AS rows FROM threat_model.rag_chunks');
  const rows = cnt.rows[0].rows;
  INFO('Row count', { rows });

  // 6) Peek sample
  if (rows > 0) {
    STEP('Peek latest rows');
    const peek = await query(
      `SELECT id, source_table, section, threat_title, left(content, 120) AS sample, created_at
       FROM threat_model.rag_chunks
       ORDER BY created_at DESC
       LIMIT 5`
    );
    for (const r of peek.rows) {
      INFO('Sample row', r);
    }
  }

  STEP('Done');
}

main().then(() => process.exit(0)).catch((e) => {
  ERR('Fatal error', e);
  process.exit(1);
});
