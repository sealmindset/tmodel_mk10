const express = require('express');
const router = express.Router();

// Protect route with simple session presence (align with existing dev bypass elsewhere)
router.get('/rtg', (req, res) => {
  res.render('rtg/index', { title: 'Report Template Generator (RTG)' });
});

// AJAX partial for How To content
router.get('/rtg/howto', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    // Render partial fragment (no layout)
    return res.render('rtg/partials/howto');
  } catch (e) {
    console.error('[RTG] howto partial render error:', e);
    return res.status(500).send('<div class="text-danger">Failed to load Help content.</div>');
  }
});

module.exports = router;
