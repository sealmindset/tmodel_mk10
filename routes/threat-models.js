/**
 * Threat Model routes for accessing threat models by ID
 */
const express = require('express');
const router = express.Router();

// GET /threat-models/:id - Redirect to results page with subject ID
router.get('/:id', (req, res) => {
  const modelId = req.params.id;
  console.log(`[THREAT-MODEL-REDIRECT] Redirecting model ID ${modelId} to results page`);
  res.redirect(`/results?subjectid=${modelId}`);
});

// GET /threat-models/:id/threats - Redirect to results page with subject ID
router.get('/:id/threats', (req, res) => {
  const modelId = req.params.id;
  console.log(`[THREAT-MODEL-REDIRECT] Redirecting model ID ${modelId} to results page`);
  res.redirect(`/results?subjectid=${modelId}`);
});

module.exports = router;
