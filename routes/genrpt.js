const express = require('express');
const router = express.Router();

// GET /genrpt/ - Landing page for Generate Report
router.get('/', async (req, res) => {
  try {
    res.render('genrpt/index', {
      title: 'Generate Report',
      projectUuid: '',
      projectTitle: '',
    });
  } catch (e) {
    console.error('[genrpt] Error rendering landing:', e);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading Generate Report page',
      errorDetails: e.message,
    });
  }
});

// GET /genrpt/:uuid - Prefilled project UUID
router.get('/:uuid', async (req, res) => {
  try {
    const projectUuid = req.params.uuid;
    res.render('genrpt/index', {
      title: 'Generate Report',
      projectUuid,
      projectTitle: '',
    });
  } catch (e) {
    console.error('[genrpt] Error rendering project page:', e);
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: 'Error loading project Generate Report page',
      errorDetails: e.message,
    });
  }
});

module.exports = router;
