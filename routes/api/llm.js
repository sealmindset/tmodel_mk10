/**
 * LLM API Routes
 * 
 * Routes for LLM-related functionality (OpenAI and Ollama)
 */
const express = require('express');
const router = express.Router();
const openaiUtil = require('../../utils/openai');
const ollamaUtil = require('../../utils/ollama');
console.log('[DEBUG] ollamaUtil keys (llm.js):', Object.keys(ollamaUtil));

/**
 * @route GET /api/llm/events
 * @desc Get recent LLM API events for monitoring (OpenAI or Ollama)
 */
router.get('/events', async (req, res) => {
  try {
    const provider = req.query.provider || 'openai';
    let events = [];
    
    if (provider === 'openai') {
      events = openaiUtil.getApiEvents();
    } else if (provider === 'ollama') {
      events = ollamaUtil.getApiEvents();
    } else {
      // If invalid provider, return error
      return res.status(400).json({ error: 'Invalid provider specified' });
    }
    
    res.json(events);
  } catch (error) {
    console.error(`Error retrieving ${req.query.provider || 'LLM'} API events:`, error);
    res.status(500).json({ error: `Error retrieving ${req.query.provider || 'LLM'} API events` });
  }
});

/**
 * @route GET /api/llm/status
 * @desc Check the status of the LLM provider
 */
router.get('/status', async (req, res) => {
  try {
    const provider = req.query.provider || 'openai';
    let status = false;
    
    if (provider === 'openai') {
      status = await openaiUtil.checkStatus();
    } else if (provider === 'ollama') {
      status = await ollamaUtil.checkStatus();
    } else {
      return res.status(400).json({ error: 'Invalid provider specified' });
    }
    
    res.json({ success: true, [provider]: status });
  } catch (error) {
    console.error(`Error checking ${req.query.provider || 'LLM'} status:`, error);
    res.status(500).json({ 
      success: false, 
      error: `Error checking ${req.query.provider || 'LLM'} status` 
    });
  }
});

module.exports = router;
