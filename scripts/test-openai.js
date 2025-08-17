#!/usr/bin/env node
/*
 * scripts/test-openai.js
 * Purpose: Verify that an OpenAI API key is valid and that a simple prompt
 * returns a response. If an API key is provided via CLI, use it directly.
 * Otherwise, use the DB-backed key via utils/openai.js.
 *
 * Usage:
 *   node scripts/test-openai.js                 # use key from DB
 *   node scripts/test-openai.js --api-key=KEY   # use provided key
 *   node scripts/test-openai.js KEY             # positional key
 */

require('dotenv').config();

const openaiUtil = require('../utils/openai');
const dbService = require('../services/dbSettingsService');

function parseApiKeyArg(argv) {
  // Support --api-key=, -k= and first positional argument
  const eqArg = argv.find(a => a.startsWith('--api-key=')) || argv.find(a => a.startsWith('-k='));
  if (eqArg) return eqArg.split('=')[1];
  // If no named arg, treat first non-flag positional as the key
  const positional = argv.filter(a => !a.startsWith('-'));
  // argv[0] is node, argv[1] is script, so the first positional candidate is argv[2]
  if (positional.length >= 3) return positional[2];
  return null;
}

async function sendDirectChat(apiKey, model, prompt, maxTokens = 20) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API returned ${res.status}: ${res.statusText} — ${body}`);
  }
  return res.json();
}

(async () => {
  const startTs = new Date().toISOString();
  console.log('[TEST][OpenAI] Starting OpenAI connectivity test at', startTs);

  try {
    const apiKeyArg = parseApiKeyArg(process.argv);
    if (apiKeyArg) {
      console.log('[TEST][OpenAI] API key provided via CLI. Skipping DB key lookup.');
      // Verify provided key quickly
      const check = await openaiUtil.testConnection(apiKeyArg);
      console.log('[TEST][OpenAI] testConnection() result:', check);
      if (!check.success) {
        console.error('[TEST][OpenAI][ERROR] Provided API key failed verification:', check.error);
        process.exit(2);
      }

      // Resolve model (try DB settings for model if available; otherwise default)
      let model = 'gpt-4.1';
      try {
        const pool = await dbService.getConnection();
        console.log(`[TEST][OpenAI] DB connected → ${pool.options.host}:${pool.options.port}/${pool.options.database}`);
        const preferred = await openaiUtil.getPreferredOpenAIConfig();
        if (preferred?.model) model = preferred.model;
      } catch (e) {
        console.warn('[TEST][OpenAI] Could not resolve model from DB settings, using default gpt-4');
      }
      console.log(`[TEST][OpenAI] Using model: ${model}`);

      const prompt = 'Reply with the single word: pong';
      console.log('[TEST][OpenAI] Sending test prompt (direct HTTP) ...');
      const resp = await sendDirectChat(apiKeyArg, model, prompt, 20);
      const text = resp?.choices?.[0]?.message?.content || '';
      console.log('[TEST][OpenAI] Raw API response (truncated to 200 chars):');
      console.log(String(text).slice(0, 200));
      if (!text) {
        console.error('[TEST][OpenAI][ERROR] Did not receive text content in response.');
        process.exit(3);
      }
      console.log('[TEST][OpenAI] Success. Received content from OpenAI.');
      process.exit(0);
    }

    // Fallback: Legacy flow using DB-backed key and util
    console.log('[TEST][OpenAI] No API key provided via CLI. Using DB-backed key.');
    console.log('[TEST][OpenAI] Establishing DB connection (for api_keys lookup)...');
    const pool = await dbService.getConnection();
    console.log(`[TEST][OpenAI] DB connected → ${pool.options.host}:${pool.options.port}/${pool.options.database}`);

    console.log('[TEST][OpenAI] Verifying API key via utils/openai.verifyApiKey()...');
    const verification = await openaiUtil.verifyApiKey();
    console.log('[TEST][OpenAI] Verification result:', verification);
    if (!verification.valid) {
      console.error('[TEST][OpenAI][ERROR] API key invalid or missing:', verification.message);
      process.exit(2);
    }

    console.log('[TEST][OpenAI] Resolving preferred model from settings...');
    const preferred = await openaiUtil.getPreferredOpenAIConfig();
    const model = preferred?.model || 'gpt-4.1';
    console.log(`[TEST][OpenAI] Using model: ${model}`);

    const prompt = 'Reply with the single word: pong';
    console.log('[TEST][OpenAI] Sending test prompt via utils/openai.getCompletion() ...');
    const resp = await openaiUtil.getCompletion(prompt, model, 20, {
      task_type: 'connectivity_test',
      meta: { initiated_by: 'scripts/test-openai.js' }
    });
    const text = resp?.choices?.[0]?.message?.content || resp?.choices?.[0]?.text || '';
    console.log('[TEST][OpenAI] Raw API response (truncated to 200 chars):');
    console.log(String(text).slice(0, 200));
    if (!text) {
      console.error('[TEST][OpenAI][ERROR] Did not receive text content in response.');
      process.exit(3);
    }
    console.log('[TEST][OpenAI] Success. Received content from OpenAI.');
    process.exit(0);
  } catch (err) {
    console.error('[TEST][OpenAI][FATAL] An error occurred during the test:', err?.message || err);
    if (err?.response?.status) {
      console.error('[TEST][OpenAI] HTTP status:', err.response.status);
      console.error('[TEST][OpenAI] Error body:', JSON.stringify(err.response.data));
    }
    process.exit(1);
  }
})();
