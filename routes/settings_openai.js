const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET OpenAI settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  res.render('settings_openai', { settings, message: null });
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
  res.render('settings_openai', { settings, message });
});

module.exports = router;
