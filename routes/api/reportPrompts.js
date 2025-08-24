/**
 * API Routes for Report Prompts
 */
const express = require('express');
const ReportPrompt = require('../../database/models/reportPromptModel');
const router = express.Router();

// POST /api/report-prompts - Create a new report prompt
router.post('/', async (req, res) => {
  console.log('[REPORT_PROMPTS][CREATE] body:', req.body);
  try {
    const newPrompt = await ReportPrompt.create(req.body);
    console.log('[REPORT_PROMPTS][CREATE] success id:', newPrompt && newPrompt.id);
    res.status(201).json(newPrompt);
  } catch (error) {
    console.error('[REPORT_PROMPTS][CREATE] error:', error);
    res.status(500).json({ error: 'Failed to create report prompt', details: error.message });
  }
});

// GET /api/report-prompts - Get all report prompts (optionally filtered by report_type or llm_provider)
router.get('/', async (req, res) => {
  const filters = {};
  if (req.query.report_type) filters.report_type = req.query.report_type;
  if (req.query.llm_provider) filters.llm_provider = req.query.llm_provider;
  console.log('[REPORT_PROMPTS][LIST] filters:', filters);
  try {
    const prompts = await ReportPrompt.getAll(filters);
    console.log('[REPORT_PROMPTS][LIST] count:', Array.isArray(prompts) ? prompts.length : 0);
    res.json(prompts);
  } catch (error) {
    console.error('[REPORT_PROMPTS][LIST] error:', error);
    res.status(500).json({ error: 'Failed to retrieve report prompts', details: error.message });
  }
});

// GET /api/report-prompts/type/:reportType - Get prompts by report type
router.get('/type/:reportType', async (req, res) => {
  const { reportType } = req.params;
  console.log('[REPORT_PROMPTS][LIST_BY_TYPE] type:', reportType);
  try {
    const prompts = await ReportPrompt.getByReportType(reportType);
    if (prompts.length === 0) {
      console.warn('[REPORT_PROMPTS][LIST_BY_TYPE] none for type:', reportType);
      return res.status(404).json({ message: `No report prompts found for type: ${reportType}` });
    }
    res.json(prompts);
  } catch (error) {
    console.error('[REPORT_PROMPTS][LIST_BY_TYPE] error:', error);
    res.status(500).json({ error: 'Failed to retrieve report prompts by type', details: error.message });
  }
});

// GET /api/report-prompts/:id - Get a specific report prompt by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[REPORT_PROMPTS][GET] id:', id);
  try {
    const prompt = await ReportPrompt.getById(id);
    if (!prompt) {
      console.warn('[REPORT_PROMPTS][GET] not found id:', id);
      return res.status(404).json({ message: 'Report prompt not found' });
    }
    res.json(prompt);
  } catch (error) {
    console.error('[REPORT_PROMPTS][GET] error:', error);
    res.status(500).json({ error: 'Failed to retrieve report prompt', details: error.message });
  }
});

// PUT /api/report-prompts/:id - Update a report prompt
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[REPORT_PROMPTS][UPDATE] id:', id, 'body:', req.body);
  try {
    const updatedPrompt = await ReportPrompt.update(id, req.body);
    if (!updatedPrompt) {
      console.warn('[REPORT_PROMPTS][UPDATE] not found or not updatable id:', id);
      return res.status(404).json({ message: 'Report prompt not found or not updatable' });
    }
    res.json(updatedPrompt);
  } catch (error) {
    console.error('[REPORT_PROMPTS][UPDATE] error:', error);
    res.status(500).json({ error: 'Failed to update report prompt', details: error.message });
  }
});

// DELETE /api/report-prompts/:id - Delete a report prompt (if not a default)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[REPORT_PROMPTS][DELETE] id:', id);
  try {
    const deletedPrompt = await ReportPrompt.deleteById(id);
    if (!deletedPrompt) {
      console.warn('[REPORT_PROMPTS][DELETE] not found or protected id:', id);
      return res.status(404).json({ message: 'Report prompt not found or is a default prompt that cannot be deleted' });
    }
    res.json({ message: 'Report prompt deleted successfully', prompt: deletedPrompt });
  } catch (error) {
    console.error('[REPORT_PROMPTS][DELETE] error:', error);
    res.status(500).json({ error: 'Failed to delete report prompt', details: error.message });
  }
});

module.exports = router;
