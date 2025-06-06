// routes/llm-usage.js
const express = require('express');
const router = express.Router();
const pool = require('../db/db');

// GET /llm-usage - Render the LLM Usage Meter page (EJS template)
router.get('/', async (req, res) => {
  res.render('llm-usage', {}); // DataTables will fetch data via AJAX
});

// GET /api/llm-usage - Return paginated/filterable usage logs as JSON for DataTables
router.get('/api/llm-usage', async (req, res) => {
  // DataTables params
  const limit = parseInt(req.query.length, 10) || 25;
  const offset = parseInt(req.query.start, 10) || 0;
  const search = req.query.search && req.query.search.value ? req.query.search.value : '';

  // Simple search in task_type, model_name, or session_id
  let where = '';
  let params = [];
  if (search) {
    where = `WHERE task_type ILIKE $1 OR model_name ILIKE $1 OR session_id::text ILIKE $1`;
    params.push(`%${search}%`);
  }
  const countQuery = `SELECT COUNT(*) FROM threat_model.llm_usage_log ${where}`;
  const dataQuery = `SELECT id, timestamp, session_id, task_type, model_provider, model_name, tokens_prompt, tokens_completion, tokens_total, cost_usd, currency FROM threat_model.llm_usage_log ${where} ORDER BY timestamp DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  const countParams = [...params];
  const dataParams = [...params, limit, offset];

  const [countResult, dataResult] = await Promise.all([
    pool.query(countQuery, countParams),
    pool.query(dataQuery, dataParams)
  ]);

  res.json({
    draw: req.query.draw ? parseInt(req.query.draw, 10) : 1,
    recordsTotal: parseInt(countResult.rows[0].count, 10),
    recordsFiltered: parseInt(countResult.rows[0].count, 10),
    data: dataResult.rows
  });
});

// GET /api/llm-usage/:id - Return details for a single usage event
router.get('/api/llm-usage/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    'SELECT * FROM threat_model.llm_usage_log WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json(result.rows[0]);
});

module.exports = router;
