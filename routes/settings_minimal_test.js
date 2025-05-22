const express = require('express');
const router = express.Router();

// GET /settings-minimal-test - Render minimal test form
router.get('/', (req, res) => {
  res.render('settings_minimal_test');
});

module.exports = router;
