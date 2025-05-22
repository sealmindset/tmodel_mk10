const express = require('express');
const router = express.Router();
const settingsService = require('../services/settingsService');

// GET AuditBoard settings page
router.get('/', async (req, res) => {
  const settings = await settingsService.getAllSettings();
  res.render('settings_auditboard', { settings, message: null });
});

// POST AuditBoard settings
router.post('/', async (req, res) => {
  const { auditboard_api_url, auditboard_api_key } = req.body;
  let message;
  if (auditboard_api_url && auditboard_api_key) {
    await settingsService.storeSetting('auditboard.api_url', auditboard_api_url, 'string');
    await settingsService.storeSetting('auditboard.api_key', auditboard_api_key, 'string');
    message = { type: 'success', text: 'AuditBoard API settings updated.' };
  } else {
    message = { type: 'danger', text: 'Please provide both the AuditBoard API URL and API key.' };
  }
  const settings = await settingsService.getAllSettings();
  res.render('settings_auditboard', { settings, message });
});

module.exports = router;
