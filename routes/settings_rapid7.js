const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET Rapid7 settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  res.render('settings_rapid7', { settings, message: null });
});

// POST Rapid7 settings
router.post('/', async (req, res) => {
  const { rapid7_api_key } = req.body;
  let message;
  if (rapid7_api_key) {
    await settingsService.storeSetting('rapid7.api_key', rapid7_api_key, 'string');
    message = { type: 'success', text: 'Rapid7 API key updated.' };
  } else {
    message = { type: 'danger', text: 'Please provide the Rapid7 API key.' };
  }
  const settings = await settingsService.getAllSettings();
  res.render('settings_rapid7', { settings, message });
});

module.exports = router;
