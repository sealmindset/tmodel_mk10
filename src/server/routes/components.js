console.log('[LOG] components.js loaded');
const express = require('express');
const { getComponents } = require('../controllers/componentsController.js');

function componentsRouter({ pool }) {
  const router = express.Router();
  router.get('/', getComponents(pool));
  // ...other component routes
  return router;
}

module.exports = componentsRouter;
