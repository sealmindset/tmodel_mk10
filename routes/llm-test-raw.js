const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('llm-test-raw');
});

router.post('/', (req, res) => {
  console.log('[LLM RAW TEST] content-type:', req.headers['content-type']);
  console.log('[LLM RAW TEST] req.body:', req.body);
  res.render('llm-test-raw', {
    provider: req.body.llmProvider,
    headers: req.headers,
    body: req.body
  });
});

module.exports = router;
