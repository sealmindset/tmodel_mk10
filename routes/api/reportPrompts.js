/**
 * API Routes for Report Prompts
 */
const express = require('express');
const ReportPrompt = require('../../database/models/reportPromptModel');
const router = express.Router();

// POST /api/report-prompts - Create a new report prompt
router.post('/', async (req, res) => {
  try {
    const newPrompt = await ReportPrompt.create(req.body);
    res.status(201).json(newPrompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create report prompt', details: error.message });
  }
});

// GET /api/report-prompts - Get all report prompts (optionally filtered by report_type or llm_provider)
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.report_type) filters.report_type = req.query.report_type;
    if (req.query.llm_provider) filters.llm_provider = req.query.llm_provider;
    
    const prompts = await ReportPrompt.getAll(filters);
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve report prompts', details: error.message });
  }
});

// GET /api/report-prompts/type/:reportType - Get prompts by report type
router.get('/type/:reportType', async (req, res) => {
  try {
    const { reportType } = req.params;
    const prompts = await ReportPrompt.getByReportType(reportType);
    if (prompts.length === 0) {
      return res.status(404).json({ message: `No report prompts found for type: ${reportType}` });
    }
    res.json(prompts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve report prompts by type', details: error.message });
  }
});

// GET /api/report-prompts/:id - Get a specific report prompt by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prompt = await ReportPrompt.getById(id);
    if (!prompt) {
      return res.status(404).json({ message: 'Report prompt not found' });
    }
    res.json(prompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve report prompt', details: error.message });
  }
});

// PUT /api/report-prompts/:id - Update a report prompt
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPrompt = await ReportPrompt.update(id, req.body);
    if (!updatedPrompt) {
      return res.status(404).json({ message: 'Report prompt not found or not updatable' });
    }
    res.json(updatedPrompt);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report prompt', details: error.message });
  }
});

// DELETE /api/report-prompts/:id - Delete a report prompt (if not a default)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPrompt = await ReportPrompt.deleteById(id);
    if (!deletedPrompt) {
      return res.status(404).json({ message: 'Report prompt not found or is a default prompt that cannot be deleted' });
    }
    res.json({ message: 'Report prompt deleted successfully', prompt: deletedPrompt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete report prompt', details: error.message });
  }
});

module.exports = router;
