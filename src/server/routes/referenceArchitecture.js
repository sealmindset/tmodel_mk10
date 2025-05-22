const express = require('express');
const { getCategories, getOptions, saveRefArch, getSavedRefArch } = require('../controllers/referenceArchitectureController.js');

module.exports = function({ pool }) {
  const router = express.Router();
  // Fetch all reference architecture categories
  router.get('/categories', getCategories(pool));
  // Fetch options for a given category
  router.get('/options', getOptions(pool));
  // Fetch saved selection for a safeguard
  router.get(
    '/components/:componentId/safeguards/:safeguardId/reference-architecture',
    getSavedRefArch(pool)
  );
  // Persist reference architecture selection for a component safeguard
  router.post(
    '/components/:componentId/safeguards/:safeguardId/reference-architecture',
    saveRefArch(pool)
  );
  return router;
};
