const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET LLM Provider settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  res.render('settings_llm_provider', { settings, message: null });
});

// POST LLM Provider selection
router.post('/', async (req, res) => {
  const provider = req.body.llmProvider;
  let message;
  if (provider === 'openai' || provider === 'ollama') {
    await settingsService.storeSetting('settings:llm:provider', provider, 'string');
    message = { type: 'success', text: `LLM provider updated to ${provider}` };
  } else {
    message = { type: 'danger', text: 'Invalid LLM provider selection.' };
  }
  const settings = await settingsService.getAllSettings();
  res.render('settings_llm_provider', { settings, message });
});

module.exports = router;
