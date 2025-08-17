#!/usr/bin/env node
/**
 * scripts/peek-threat-models.js
 * Read-only: shows recent threat_models titles and response_text snippets
 */
const db = require('../database');

(async function main(){
  console.log('[peek] Begin');
  try {
    const res = await db.query(`
      SELECT id, title, created_at, LEFT(COALESCE(response_text,''), 800) AS snippet
      FROM threat_model.threat_models
      ORDER BY created_at DESC
      LIMIT 5
    `);
    for (const r of res.rows) {
      console.log('---');
      console.log(`[peek] id=${r.id} title=${r.title} created_at=${r.created_at}`);
      console.log('[peek] snippet:\n' + r.snippet);
    }
    console.log('[peek] Done');
  } catch (e) {
    console.error('[peek] ERROR', e.message);
    process.exit(1);
  }
})();
