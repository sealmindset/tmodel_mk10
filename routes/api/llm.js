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

// Enforce provider-specific timeouts to avoid indefinite hangs
const OPENAI_TIMEOUT_MS = 45000; // 45s client-facing timeout for OpenAI
const OLLAMA_TIMEOUT_MS = 15000; // 15s timeout for Ollama CLI

function withTimeout(promise, ms, label = 'timeout') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    Promise.resolve(promise).then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

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
    
    // Provider-aware timeout
    const isOllama = (provider === 'ollama');
    const providerTimeout = isOllama ? OLLAMA_TIMEOUT_MS : OPENAI_TIMEOUT_MS;
    // Apply a response timeout slightly larger than the internal promise timeout
    try { res.setTimeout(providerTimeout + 5000); } catch (_) {}
    let response;
    const maxTokens = req.body.max_tokens || 2500;
    const modelToUse = model || (provider === 'ollama' ? 'llama3' : 'gpt-4');
    
    // Create an AbortController for Ollama so we can terminate the CLI process on timeout or client abort
    const controller = isOllama ? new AbortController() : null;
    const signal = controller ? controller.signal : undefined;

    // Build the provider call
    const callPromise = isOllama
      ? (ollamaUtil.getCompletion
          ? ollamaUtil.getCompletion(prompt, modelToUse, maxTokens, { timeoutMs: providerTimeout, signal })
          : ollamaUtil.generateText(prompt, modelToUse))
      : openaiUtil.getCompletion(prompt, modelToUse, maxTokens);

    // Abort the provider call if the client disconnects
    const onClientAbort = () => {
      try { if (controller) controller.abort(); } catch (_) {}
    };
    res.on('close', onClientAbort);
    res.on('finish', onClientAbort);
    req.on('aborted', onClientAbort);

    try {
      response = await withTimeout(callPromise, providerTimeout, 'request_timeout');
    } catch (err) {
      // Ensure we abort the Ollama CLI if we timed out at the route level
      if (controller) {
        try { controller.abort(); } catch (_) {}
      }
      throw err;
    } finally {
      // Cleanup listeners
      res.off('close', onClientAbort);
      res.off('finish', onClientAbort);
      req.off('aborted', onClientAbort);
    }
    
    // Record the prompt and completion in the API events
    if (isOllama) {
      ollamaUtil.logApiEvent('completion', {
        prompt,
        model: modelToUse || 'llama3',
        completion: response,
        timestamp: new Date()
      });
    } else {
      openaiUtil.logApiEvent('completion', {
        prompt,
        model: modelToUse || 'gpt-4',
        completion: response,
        timestamp: new Date()
      });
    }
    // Normalize output to plain text for UI consumption
    let textOut = '';
    if (provider === 'ollama') {
      textOut = typeof response === 'string' ? response : (response && response.response) || '';
    } else {
      try {
        if (response && Array.isArray(response.choices) && response.choices[0]) {
          textOut = response.choices[0].message?.content || response.choices[0].text || '';
        }
      } catch (e) {
        console.warn('[LLM] Failed to extract OpenAI text:', e);
        textOut = '';
      }
    }

    res.json({ success: true, text: textOut });
  } catch (error) {
    console.error(`Error generating LLM content:`, error);
    res.status(500).json({ 
      success: false, 
      error: `Error generating content: ${error.message}` 
    });
  }
});

module.exports = router;
