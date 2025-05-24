const express = require('express');
const router = express.Router();
const safeguardsService = require('../services/safeguardsService');

// List all safeguards
router.get('/', async (req, res) => {
  const safeguards = await safeguardsService.getAllSafeguards();
  res.render('safeguards', { safeguards });
});

// New safeguard form
router.get('/new', (req, res) => {
  res.render('safeguard-new');
});

// Create safeguard
router.post('/', async (req, res) => {
  console.log('[Safeguards] POST /safeguards body:', req.body);
  const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);
  try {
    await safeguardsService.createSafeguard(req.body);
    if (isAjax) {
      return res.json({ success: true });
    }
    res.redirect('/safeguards?success=1');
  } catch (error) {
    console.error('Error creating safeguard:', error);
    if (isAjax) {
      return res.status(400).json({ error: 'Failed to create safeguard: ' + (error.message || error) });
    }
    // Re-render the form with submitted values and error message
    res.render('safeguard-new', {
      safeguard: req.body,
      error: 'Failed to create safeguard: ' + (error.message || error)
    });
  }
});

// Safeguard detail
router.get('/:id', async (req, res) => {
  if (req.params.id === 'new') {
    // Prevent treating 'new' as a UUID, redirect to the new safeguard form
    return res.redirect('/safeguards/new');
  }
  const safeguard = await safeguardsService.getSafeguardById(req.params.id);
  res.render('safeguard-detail', { safeguard });
});

// Edit safeguard form
router.get('/:id/edit', async (req, res) => {
  if (req.params.id === 'new') {
    // Prevent treating 'new' as a UUID, redirect to the new safeguard form
    return res.redirect('/safeguards/new');
  }
  const safeguard = await safeguardsService.getSafeguardById(req.params.id);
  res.render('safeguard-edit', { safeguard });
});

// Update safeguard
router.post('/:id', async (req, res) => {
  try {
    await safeguardsService.updateSafeguard(req.params.id, req.body);
    res.redirect('/safeguards');
  } catch (error) {
    console.error('Error updating safeguard:', error);
    // Re-render the edit page with the submitted values and error message
    const safeguard = Object.assign({}, req.body, { id: req.params.id });
    res.render('safeguard-edit', {
      safeguard,
      error: 'Failed to update safeguard: ' + (error.message || error)
    });
  }
});

// Delete safeguard
router.delete('/:id', async (req, res) => {
  await safeguardsService.deleteSafeguard(req.params.id);
  res.status(204).end();
});

module.exports = router;
