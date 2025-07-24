/**
 * LLM API Routes
 * 
 * Routes for LLM-related functionality (OpenAI and Ollama)
 * Includes report content generation endpoint
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

/**
 * @route POST /api/llm/generate
 * @desc Generate content using LLM (OpenAI or Ollama)
 * Used by the Reports app to generate content for report sections
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, provider, model } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }
    
    let response;
    const maxTokens = req.body.max_tokens || 2500;
    
    if (provider === 'ollama') {
      // For Ollama, getCompletion is more appropriate but fall back to the existing method if needed
      response = ollamaUtil.getCompletion ? 
                await ollamaUtil.getCompletion(prompt, model || 'llama3', maxTokens) : 
                await ollamaUtil.generateText(prompt, model || 'llama3');
    } else {
      // Default to OpenAI - use getCompletion which exists in the utility
      response = await openaiUtil.getCompletion(prompt, model || 'gpt-4', maxTokens);
    }
    
    // Record the prompt and completion in the API events
    if (provider === 'ollama') {
      ollamaUtil.logApiEvent('completion', {
        prompt,
        model: model || 'llama3',
        completion: response,
        timestamp: new Date()
      });
    } else {
      openaiUtil.logApiEvent('completion', {
        prompt,
        model: model || 'gpt-4',
        completion: response,
        timestamp: new Date()
      });
    }
    
    res.json({ success: true, text: response });
  } catch (error) {
    console.error(`Error generating LLM content:`, error);
    res.status(500).json({ 
      success: false, 
      error: `Error generating content: ${error.message}` 
    });
  }
});

module.exports = router;
