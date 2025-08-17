const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');
const openaiUtil = require('../utils/openai');

// GET OpenAI settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  let models = [];
  try {
    models = await openaiUtil.fetchAvailableModels();
  } catch (e) {
    console.warn('[settings_openai] Could not fetch OpenAI models:', e?.message || e);
  }
  res.render('settings_openai', { settings, models, message: null });
});

// POST OpenAI settings
router.post('/', async (req, res) => {
  const { openai_api_key, openai_model } = req.body;
  let message;
  if (openai_api_key && openai_model) {
    await settingsService.storeSetting('openai.api_key', openai_api_key, 'string');
    await settingsService.storeSetting('openai.model', openai_model, 'string');
    message = { type: 'success', text: 'OpenAI settings updated.' };
  } else {
    message = { type: 'danger', text: 'Please provide both API key and model.' };
  }
  const settings = await settingsService.getAllSettings();
  let models = [];
  try {
    models = await openaiUtil.fetchAvailableModels();
  } catch (e) {
    console.warn('[settings_openai] Could not fetch OpenAI models on POST:', e?.message || e);
  }
  res.render('settings_openai', { settings, models, message });
});

module.exports = router;
