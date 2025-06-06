// utils/llmUsageLogger.js
// Central utility to log LLM usage events to the database
const pool = require('../db/db');
const logger = require('./logger').forModule('llmUsageLogger');

/**
 * Log an LLM usage event
 * @param {Object} params
 * @param {UUID} params.session_id - UUID grouping all related LLM calls (optional)
 * @param {String} params.task_type - e.g., 'threat_model', 'genmore', 'ai_assistant', etc.
 * @param {String} params.model_provider - 'openai', 'ollama', etc.
 * @param {String} params.model_name
 * @param {Number} params.tokens_prompt
 * @param {Number} params.tokens_completion
 * @param {Number} params.tokens_total
 * @param {Number} params.cost_usd
 * @param {String} params.currency
 * @param {String} params.prompt
 * @param {String} params.response
 * @param {Object} params.meta - Additional info (JSON)
 */
async function logLlmUsage({
  session_id = null,
  task_type = null,
  model_provider = null,
  model_name = null,
  tokens_prompt = null,
  tokens_completion = null,
  tokens_total = null,
  cost_usd = null,
  currency = null,
  prompt = null,
  response = null,
  meta = null
}) {
  try {
    const query = `
      INSERT INTO threat_model.llm_usage_log
        (session_id, task_type, model_provider, model_name, tokens_prompt, tokens_completion, tokens_total, cost_usd, currency, prompt, response, meta)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, timestamp;
    `;
    const values = [
      session_id,
      task_type,
      model_provider,
      model_name,
      tokens_prompt,
      tokens_completion,
      tokens_total,
      cost_usd,
      currency,
      prompt,
      response,
      meta ? JSON.stringify(meta) : null
    ];
    const result = await pool.query(query, values);
    logger.info(`Logged LLM usage event: ${result.rows[0].id}`);
    return result.rows[0];
  } catch (err) {
    logger.error('Failed to log LLM usage event', err);
    throw err;
  }
}

module.exports = { logLlmUsage };
