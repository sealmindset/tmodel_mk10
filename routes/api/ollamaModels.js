const express = require('express');
const router = express.Router();
const { getOllamaModels } = require('../../utils/ollamaModelList');

// GET /api/ollama-models - Returns all available Ollama models
router.get('/', async (req, res) => {
  try {
    const models = await getOllamaModels();
    res.json({ success: true, models });
  } catch (err) {
    console.error('[ROUTE] Error fetching Ollama models:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch Ollama models' });
  }
});

module.exports = router;
