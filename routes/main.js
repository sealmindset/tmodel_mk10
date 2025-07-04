const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const promptService = require('../services/promptService');

// Import needed utilities
const openaiUtil = require('../utils/openai');
const ollamaUtil = require('../utils/ollama');
console.log('[DEBUG] ollamaUtil keys (main.js):', Object.keys(ollamaUtil));

// No Redis client needed; all statistics and models now come from PostgreSQL only.
const threatModelService = require('../services/threatModelService');
const db = require('../database');
const settingsService = require('../services/settingsService');

// Dashboard (now the index route)
router.get('/', async (req, res) => {
  try {
    // Get stats for dashboard
    const stats = {
      totalModels: await getTotalModelCount(),
      totalReports: await getTotalReportCount(),
      avgThreatsPerModel: await getAverageThreatsPerModel(),
      modelsByMonth: await getModelsByMonth(),
      topThreatCategories: await getTopThreatCategories()
    };
    
    // Get recent activity
    const recentActivity = await getRecentActivity(10);

    res.render('dashboard', {
      user: req.session.username,
      stats,
      recentActivity
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).send('Error loading dashboard.');
  }
});

// Create new threat model page
const { getOllamaModels } = require('../utils/ollamaModelList');
router.get('/create', async (req, res) => {

// Handle threat model creation (POST)
router.post('/create', async (req, res) => {
  try {
    const { subject, llmProvider, model } = req.body;
    if (!subject) {
      return res.status(400).render('create', {
        user: req.session.username,
        error: 'System to Analyze (subject) is required.',
        success: null,
        llmProvider,
        openaiModel: await settingsService.getSettingByKey('openai.api_model'),
        ollamaModel: await settingsService.getSettingByKey('ollama.model'),
        availableOllamaModels: []
      });
    }
    // Determine provider
    const provider = llmProvider || await settingsService.getSettingByKey('llm.provider');
    let completion = '';
    let usedModel = model;
    if (provider === 'ollama') {
      // Use selected Ollama model or fallback
      usedModel = usedModel || await settingsService.getSettingByKey('ollama.model') || 'llama3.3:latest';
      completion = await ollamaUtil.getCompletion(subject, usedModel);
    } else {
      // Use OpenAI or other provider logic
      usedModel = usedModel || await settingsService.getSettingByKey('openai.api_model') || 'gpt-3.5-turbo';
      completion = await openaiUtil.getCompletion(subject, usedModel);
    }
    // Save the threat model (ensure single creation)
    const newModel = await threatModelService.createThreatModel({
      title: subject,
      description: subject,
      model: usedModel,
      responseText: completion,
      createdBy: req.session.username || 'unknown',
      createdAt: new Date().toISOString()
    });
    return res.redirect(`/results?subjectid=${newModel.id}`);
  } catch (error) {
    console.error('Error creating threat model:', error);
    return res.status(500).render('create', {
      user: req.session.username,
      error: 'Failed to create threat model. ' + (error.message || ''),
      success: null,
      llmProvider: await settingsService.getSettingByKey('llm.provider'),
      openaiModel: await settingsService.getSettingByKey('openai.api_model'),
      ollamaModel: await settingsService.getSettingByKey('ollama.model'),
      availableOllamaModels: []
    });
  }
});
  try {
    // Get LLM provider settings from PostgreSQL
    const llmProvider = await settingsService.getSettingByKey('llm.provider');
    const openaiModel = await settingsService.getSettingByKey('openai.api_model');
    const ollamaModel = await settingsService.getSettingByKey('ollama.model');

    console.log('LLM Provider from DB:', llmProvider);
    console.log('OpenAI Model from DB:', openaiModel);
    console.log('Ollama Model from DB:', ollamaModel);

    // Initialize available Ollama models with DB default only as fallback
    let availableOllamaModels = [{ name: ollamaModel }];

    // If Ollama is the provider, get the local model list using the CLI utility
    if (llmProvider === 'ollama') {
      try {
        availableOllamaModels = await getOllamaModels();
        // Fallback if none found
        if (!availableOllamaModels || availableOllamaModels.length === 0) {
          availableOllamaModels = [{ name: ollamaModel || 'llama3.3:latest' }];
        }
        // Ensure the DB default is in the list
        const modelExists = availableOllamaModels.some(model => model.name === ollamaModel);
        if (!modelExists && ollamaModel) {
          availableOllamaModels.push({ name: ollamaModel });
        }
      } catch (err) {
        console.error('Error fetching Ollama models:', err);
        availableOllamaModels = [{ name: ollamaModel || 'llama3.3:latest' }];
      }
    }

    res.render('create', {
      user: req.session.username,
      error: null,
      success: null,
      llmProvider,
      openaiModel,
      ollamaModel,
      availableOllamaModels
    });
  } catch (error) {
    console.error('Error loading create page:', error);
    res.status(500).send('Error loading create page.');
  }
});

// Helper functions for dashboard statistics using PostgreSQL only
async function getComponentsByType() {
  const result = await db.query('SELECT type, COUNT(*) FROM threat_model.components GROUP BY type');
  return result.rows.map(row => ({ type: row.type, count: parseInt(row.count, 10) }));
}

async function getSafeguardsByType() {
  const result = await db.query('SELECT type, COUNT(*) FROM threat_model.safeguards GROUP BY type');
  return result.rows.map(row => ({ type: row.type, count: parseInt(row.count, 10) }));
}

async function getTotalModelCount() {
  // Use threatModelService to count all threat models
  const result = await db.query('SELECT COUNT(*) FROM threat_model.threat_models');
  return parseInt(result.rows[0].count, 10);
}

async function getTotalReportCount() {
  // If you have a reports table, count all reports; otherwise, return 0
  const result = await db.query('SELECT COUNT(*) FROM threat_model.reports');
  return parseInt(result.rows[0].count, 10);
}

async function getAverageThreatsPerModel() {
  // Calculate average number of threats per model from DB
  const result = await db.query('SELECT AVG(threat_count) as avg FROM (SELECT COUNT(*) as threat_count FROM threat_model.threats GROUP BY threat_model_id) as counts');
  return parseFloat(result.rows[0].avg) || 0;
}

async function getModelsByMonth() {
  // Group models by month for charting
  const result = await db.query("SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) FROM threat_model.threat_models GROUP BY month ORDER BY month DESC LIMIT 12");
  return result.rows.map(row => ({ month: row.month, count: parseInt(row.count, 10) }));
}

async function getTopThreatCategories() {
  // Find top threat categories by count
  const result = await db.query("SELECT category, COUNT(*) FROM threat_model.threats GROUP BY category ORDER BY COUNT(*) DESC LIMIT 5");
  return result.rows.map(row => ({ category: row.category, count: parseInt(row.count, 10) }));
}

async function getRecentActivity(limit = 5) {
  // Get recent activity from models and reports
  const modelRows = (await db.query('SELECT id, title, created_at FROM threat_model.threat_models ORDER BY created_at DESC LIMIT $1', [limit])).rows;
  const reportRows = (await db.query('SELECT id, name, created_at FROM threat_model.reports ORDER BY created_at DESC LIMIT $1', [limit])).rows;
  const activities = [
    ...modelRows.map(row => ({ type: 'create_model', title: row.title, link: `/results?subjectid=${row.id}`, date: row.created_at })),
    ...reportRows.map(row => ({ type: 'create_report', title: row.name, link: `/reports/${row.id}`, date: row.created_at }))
  ];
  // Sort by date descending, limit total
  return activities.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
}

router.get('/prompts', async (req, res) => {
  console.log('[ROUTE] GET /prompts called');
  try {
    const prompts = await promptService.getAllPrompts();
    res.render('prompts', {
      user: req.session.username,
      prompts,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.render('prompts', {
      user: req.session.username,
      prompts: [],
      error: 'Failed to load prompts',
      success: null
    });
  }
});

// API endpoint to get all prompts
router.get('/api/prompts', async (req, res) => {
  console.log('[ROUTE] GET /api/prompts called');
  try {
    const prompts = await promptService.getAllPrompts();
    res.json({ success: true, prompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    console.error('[ROUTE] Error fetching /api/prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// API endpoint to get a specific prompt
router.get('/api/prompts/:id', async (req, res) => {
  console.log('[ROUTE] GET /api/prompts/:id called with id:', req.params.id);
  try {
    const { id } = req.params;
    const prompt = await promptService.getPromptById(id);
    if (!prompt) {
      console.warn('[ROUTE] /api/prompts/:id not found for id:', id);
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json({ success: true, prompt });
  } catch (error) {
    console.error('[ROUTE] Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// API endpoint to create a new prompt
router.post('/api/prompts', async (req, res) => {
  console.log('[ROUTE] POST /api/prompts called with body:', req.body);
  const { title, text, prompt_text, description } = req.body;
  const content = prompt_text || text;
  console.log('[ROUTE] /api/prompts using prompt_text:', content);
  if (!title || !content) {
    console.warn('[ROUTE] /api/prompts missing title or prompt_text:', { title, prompt_text, text });
    return res.status(400).json({ error: 'Title and prompt_text are required' });
  }
  try {
    const prompt = await promptService.createPrompt({ title, prompt_text: content, description });
    console.log('[ROUTE] /api/prompts created prompt:', prompt);
    res.json({ success: true, prompt });
    console.log('[ROUTE] /api/prompts response sent');
  } catch (error) {
    console.error('[ROUTE] Error creating prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

// API endpoint to update a prompt
router.put('/api/prompts/:id', async (req, res) => {
  console.log('[ROUTE] PUT /api/prompts/:id called with id:', req.params.id, 'and body:', req.body);
  try {
    const { id } = req.params;
    const { title, text, description } = req.body;
    if (!title || !text) {
      return res.status(400).json({ error: 'Title and text are required' });
    }
    const prompt = await promptService.updatePrompt(id, { title, prompt_text: text, description });
    console.log('[ROUTE] /api/prompts/:id updated prompt:', prompt);
    res.json({ success: true, prompt });
  } catch (error) {
    console.error('[ROUTE] Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// API endpoint to delete prompts
router.post('/api/delete-prompts', async (req, res) => {
  console.log('[ROUTE] POST /api/delete-prompts called with body:', req.body);
  try {
    const { promptsToDelete } = req.body;
    if (!promptsToDelete || !Array.isArray(promptsToDelete) || promptsToDelete.length === 0) {
      console.warn('[ROUTE] /api/delete-prompts missing or invalid promptsToDelete:', promptsToDelete);
      return res.status(400).json({ error: 'No prompts specified for deletion' });
    }
    for (const id of promptsToDelete) {
      console.log('[ROUTE] /api/delete-prompts deleting prompt id:', id);
      await promptService.deletePrompt(id);
    }
    res.json({ success: true, message: 'Prompts deleted successfully' });
    console.log('[ROUTE] /api/delete-prompts response sent');
  } catch (error) {
    console.error('[ROUTE] Error deleting prompts:', error);
    res.status(500).json({ error: 'Failed to delete prompts' });
  }
});

// API endpoint to delete a prompt
router.delete('/api/prompts/:id', async (req, res) => {
  console.log('[ROUTE] DELETE /api/prompts/:id called with id:', req.params.id);
  try {
    const { id } = req.params;
    await promptService.deletePrompt(id);
    res.json({ success: true, message: 'Prompt deleted successfully' });
    console.log('[ROUTE] /api/prompts/:id response sent');
  } catch (error) {
    console.error('[ROUTE] Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// API endpoint to export prompts
router.post('/api/export-prompts', async (req, res) => {
  try {
    const { promptIds } = req.body;
    
    if (!promptIds || !Array.isArray(promptIds) || promptIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty prompts list' });
    }
    
    // Create a list of promises to fetch prompt details
    const promptsPromises = promptIds.map(async (id) => {
      // Get prompt details
      const prompt = await promptService.getPromptById(id);
      if (!prompt) return null;
      
      return prompt;
    });
    
    // Resolve all promises and filter out null values (non-existent prompts)
    let prompts = (await Promise.all(promptsPromises)).filter(Boolean);
    
    // Set response headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=prompt-templates.json');
    
    // Send the prompts as a JSON file
    res.json({ prompts });
  } catch (error) {
    console.error('Error exporting prompts:', error);
    res.status(500).json({ error: 'Failed to export prompts' });
  }
});


router.get('/models', async (req, res) => {
  try {
    // Get all threat models from PostgreSQL only
    const allThreatModels = await threatModelService.listThreatModels();

    // Process the results to match the expected format for the view
    const subjects = allThreatModels.map(model => {
      let threatCount = 0;
      let createdAt = model.createdAt || new Date().toISOString();
      if (model.pgRecord && model.pgRecord.response_text) {
        // Count threats in the response text (## ...\n)
        const threatPattern = /## (.*?)\n/g;
        let match;
        let matches = [];
        while ((match = threatPattern.exec(model.pgRecord.response_text)) !== null) {
          matches.push(match[1]);
        }
        threatCount = matches.length;
        createdAt = model.pgRecord.created_at;
      }
      // Check if ID is a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRegex.test(model.id);
      return {
        id: model.id,
        subjectid: model.id, // For backward compatibility
        title: model.title || 'Untitled Threat Model',
        model: model.model || 'Unknown',
        createdAt: createdAt,
        threatCount: threatCount,
        isUuid: isUuid,
        source: model.source // Add source information for UI customization
      };
    });
    // Sort by creation date (newest first)
    const sortedSubjects = subjects.sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    // Get LLM provider and available Ollama models for selection UI
    const settingsService = require('../services/settingsService');
    const { getOllamaModels } = require('../utils/ollamaModelList');
    let llmProvider = 'openai';
    let ollamaModels = [];
    try {
      llmProvider = await settingsService.getSettingByKey('llm.provider');
      if (llmProvider === 'ollama') {
        ollamaModels = await getOllamaModels();
      }
    } catch (err) {
      console.warn('Unable to load Ollama models or provider:', err);
    }
    // Also get the default Ollama model from DB for default selection
    const ollamaModel = await settingsService.getSettingByKey('ollama.model');
    res.render('models', {
      user: req.session.username,
      subjects: sortedSubjects,
      error: null,
      success: null,
      llmProvider,
      ollamaModels,
      ollamaModel
    });
  } catch (error) {
    console.error('Error loading models page:', error);
    res.status(500).send('Error loading models page.');
  }
});

// Threat Model Results Page
router.get('/results', async (req, res) => {
  console.log('[ROUTE] GET /results called');
  const { subjectid } = req.query;
  console.log(`[ROUTE] /results - subjectid param:`, subjectid);
  if (!subjectid) {
    console.error('[ROUTE] /results - Missing subjectid');
    return res.status(400).send('Missing subjectid');
  }
  try {
    console.log(`[ROUTE] /results - Fetching threat model for subjectid: ${subjectid}`);
    const threatModel = await threatModelService.getThreatModel(subjectid);
    if (!threatModel) {
      console.error(`[ROUTE] /results - No threat model found for subjectid: ${subjectid}`);
      return res.status(404).send('Threat model not found');
    }
    console.log(`[ROUTE] /results - Threat model found:`, threatModel);
    console.log(`[ROUTE] /results - Rendering results.ejs with user:`, req.session.username);
    res.render('results', {
      user: req.session.username || { name: 'Guest', email: 'guest@example.com' },
      subjectid,
      threatModel,
      summary: null,
      title: threatModel && threatModel.title ? threatModel.title : '',
      description: threatModel && threatModel.description ? threatModel.description : '',
      subjectText: threatModel && threatModel.description ? threatModel.description : '',
      model: threatModel && threatModel.model ? threatModel.model : '',
      response: threatModel && threatModel.responseText ? threatModel.responseText : '',
      error: null,
      success: null
    });
    console.log('[ROUTE] /results - Rendered results.ejs successfully');
  } catch (error) {
    console.error('[ROUTE] /results - Error loading results page:', error);
    res.status(500).send('Error loading results page.');
  }
});

// API endpoint to get dashboard stats for charts
router.get('/api/dashboard-stats', async (req, res) => {
  try {
    // Get all dashboard stats in parallel
    const [modelsByMonth, componentsByType, safeguardsByType] = await Promise.all([
      getModelsByMonth(),
      getComponentsByType(),
      getSafeguardsByType()
    ]);
    res.json({
      success: true,
      data: {
        modelsByMonth,
        componentsByType,
        safeguardsByType
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;
