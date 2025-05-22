/**
 * Model routes for accessing threat models by ID
 */
const express = require('express');
const router = express.Router();

// GET /models/:id - Redirect to results page with subject ID
router.get('/:id', (req, res) => {
  const modelId = req.params.id;
  console.log(`[MODEL-REDIRECT] Redirecting model ID ${modelId} to results page`);
  res.redirect(`/results?subjectid=${modelId}`);
});

module.exports = router;
