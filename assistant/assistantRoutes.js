// assistantRoutes.js
// Express router for Assistant AI module
const express = require('express');
const router = express.Router();
const assistantController = require('./assistantController');

// Chat endpoint (handles provider selection and mirror mode)
router.post('/chat', assistantController.handleChat);

// Fetch available models per provider
router.get('/models', assistantController.getModels);

// Fetch chat history
router.get('/history', assistantController.getHistory);

// Save/update assistant settings
router.post('/settings', assistantController.saveSettings);

module.exports = router;
