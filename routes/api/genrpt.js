const express = require('express');
const router = express.Router();
const ReportRunner = require('../../reporting/reportRunner');
const { createReportLimiter } = require('../../middleware/rateLimiter');

const reportLimiter = createReportLimiter();

// POST /api/genrpt/generate?stream=true - SSE generation focused on project UUID
router.post('/generate', reportLimiter.middleware(), async (req, res) => {
  const wantsStreaming = (req.headers.accept || '').includes('text/event-stream') || req.query.stream === 'true';
  if (!wantsStreaming) {
    return standardGenerate(req, res);
  }
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });
  res.write('event: connected\n');
  res.write('data: {"status":"connected","message":"Starting genrpt"}\n\n');

  const { reportType, templateId, promptId, filters } = req.body || {};
  const projectUuid = filters?.projectUuid;
  if (!projectUuid) {
    res.write('event: error\n');
    res.write('data: {"error":"Missing projectUuid in filters"}\n\n');
    return res.end();
  }
  if (!reportType || (templateId == null && !promptId)) {
    res.write('event: error\n');
    res.write('data: {"error":"Missing reportType or templateId/promptId"}\n\n');
    return res.end();
  }

  const controller = new AbortController();
  const { signal } = controller;
  const timer = setTimeout(() => {
    try { controller.abort(); } catch(_) {}
    try {
      res.write('event: error\n');
      res.write('data: {"error":"Request timeout"}\n\n');
    } catch(_) {}
    res.end();
  }, 120000);

  const cleanup = () => { try { clearTimeout(timer); } catch(_) {} };

  try {
    res.write('event: progress\n');
    res.write('data: {"message":"Preparing","progress":10}\n\n');
    const tid = templateId ?? promptId; // allow promptId alias
    const payloadFilters = Object.assign({}, filters || {}, { projectUuid });
    const generated = await ReportRunner.generateReport(reportType, tid, payloadFilters, { signal });
    cleanup();
    res.write('event: complete\n');
    res.write(`data: ${JSON.stringify({ status:'completed', generatedReport: generated })}\n\n`);
    res.end();
  } catch (e) {
    cleanup();
    console.error('[genrpt] SSE error:', e);
    try {
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error:'Failed to generate', details: e.message })}\n\n`);
    } catch(_) {}
    res.end();
  }
});

async function standardGenerate(req, res) {
  try {
    const { reportType, templateId, promptId, filters } = req.body || {};
    const tid = templateId ?? promptId;
    if (!filters?.projectUuid) return res.status(400).json({ error: 'Missing projectUuid in filters' });
    if (!reportType || tid == null) return res.status(400).json({ error: 'Missing reportType or templateId/promptId' });
    const generated = await ReportRunner.generateReport(reportType, tid, filters || {}, {});
    return res.json({ success: true, generatedReport: generated });
  } catch (e) {
    console.error('[genrpt] standard error:', e);
    return res.status(500).json({ error: 'Failed to generate', details: e.message });
  }
}

module.exports = router;
