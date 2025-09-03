const express = require('express');
const router = express.Router();

// NOTE: This is a stub router to wire /api/rtg path. Endpoints return 501 for now.
// All routes here should be mounted behind ensureAuthenticated in routes/api.js

function notImplemented(res, meta = {}) {
  res.set('Access-Control-Allow-Origin', '*'); // open CORS per project rule
  return res.status(501).json({ error: 'Not Implemented', ...meta });
}

// Templates CRUD + Versions
router.get('/templates', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const repo = require('../../build/rtg/server/templatesRepo.js');
    const q = (req.query.q || '').toString();
    const limit = Math.max(0, parseInt((req.query.limit || '50').toString(), 10) || 50);
    const offset = Math.max(0, parseInt((req.query.offset || '0').toString(), 10) || 0);
    const { items, total } = await repo.listTemplates(q || undefined, limit, offset);
    return res.json({ items, total, limit, offset });
  } catch (e) {
    console.error('[RTG] list templates error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

router.post('/templates', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const repo = require('../../build/rtg/server/templatesRepo.js');
    const { name, description, content_md } = req.body || {};
    if (!name || !content_md) return res.status(400).json({ error: 'name and content_md are required' });
    if (typeof name !== 'string' || name.length > 255) return res.status(400).json({ error: 'invalid name' });
    const created_by = (req.user && req.user.username) ? req.user.username : 'system';
    const row = await repo.createTemplate(String(name), description ?? null, String(content_md), created_by);
    return res.status(201).json(row);
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg && /unique/i.test(msg) && /name/i.test(msg)) return res.status(409).json({ error: 'template name must be unique' });
    console.error('[RTG] create template error:', e);
    return res.status(500).json({ error: msg });
  }
});

router.get('/templates/:id', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const id = req.params.id;
    if (/^\d+$/.test(id)) return res.status(400).json({ error: 'numeric id not supported; use UUID' });
    const repo = require('../../build/rtg/server/templatesRepo.js');
    const row = await repo.getTemplate(id);
    if (!row) return res.status(404).json({ error: 'not found' });
    return res.json(row);
  } catch (e) {
    console.error('[RTG] get template error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

router.put('/templates/:id', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const id = req.params.id;
    if (/^\d+$/.test(id)) return res.status(400).json({ error: 'numeric id not supported; use UUID' });
    const { name, description, content_md, changelog } = req.body || {};
    const hasAny = (name != null) || (description !== undefined) || (content_md != null);
    if (!hasAny) return res.status(400).json({ error: 'no updatable fields provided' });
    if (name != null && (typeof name !== 'string' || name.length > 255)) return res.status(400).json({ error: 'invalid name' });
    const repo = require('../../build/rtg/server/templatesRepo.js');
    const updated = await repo.updateTemplate(id, { name, description, content_md }, changelog ?? null);
    if (!updated) return res.status(404).json({ error: 'not found' });
    return res.json(updated);
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg && /unique/i.test(msg) && /name/i.test(msg)) return res.status(409).json({ error: 'template name must be unique' });
    console.error('[RTG] update template error:', e);
    return res.status(500).json({ error: msg });
  }
});

router.delete('/templates/:id', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const id = req.params.id;
    if (/^\d+$/.test(id)) return res.status(400).json({ error: 'numeric id not supported; use UUID' });
    const repo = require('../../build/rtg/server/templatesRepo.js');
    const ok = await repo.deleteTemplate(id);
    if (!ok) return res.status(404).json({ error: 'not found' });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[RTG] delete template error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// Manually import templates from docs/report-templates into DB
router.post('/templates/import-docs', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const importer = require('../../build/rtg/server/templatesImporter.js');
    const overwrite = (req.query.overwrite === '1' || req.query.overwrite === 'true' || req.body?.overwrite === true);
    const result = await importer.importDocsTemplates(undefined, { overwrite });
    return res.json({ ok: true, result });
  } catch (e) {
    console.error('[RTG] import docs templates error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

router.get('/templates/:id/versions', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const id = req.params.id;
    if (/^\d+$/.test(id)) return res.status(400).json({ error: 'numeric id not supported; use UUID' });
    const limit = Math.max(0, parseInt((req.query.limit || '50').toString(), 10) || 50);
    const offset = Math.max(0, parseInt((req.query.offset || '0').toString(), 10) || 0);
    const repo = require('../../build/rtg/server/templatesRepo.js');
    // Optionally ensure template exists
    const tmpl = await repo.getTemplate(id);
    if (!tmpl) return res.status(404).json({ error: 'template not found' });
    const { items, total } = await repo.listVersions(id, limit, offset);
    return res.json({ items, total, limit, offset });
  } catch (e) {
    console.error('[RTG] list versions error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

router.get('/templates/:id/versions/:version', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const id = req.params.id;
    if (/^\d+$/.test(id)) return res.status(400).json({ error: 'numeric id not supported; use UUID' });
    const version = parseInt(req.params.version, 10);
    if (!Number.isFinite(version)) return res.status(400).json({ error: 'invalid version' });
    const repo = require('../../build/rtg/server/templatesRepo.js');
    const row = await repo.getVersion(id, version);
    if (!row) return res.status(404).json({ error: 'not found' });
    return res.json(row);
  } catch (e) {
    console.error('[RTG] get version error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

// Compile preview (expands tokens, renders markdown)
router.post('/compile', async (req, res) => {
  // Try to load compiled service: build/rtg/server/compileService.js
  try {
    const svcPath = '../../build/rtg/server/compileService.js';
    const svc = require(svcPath);
    if (svc && typeof svc.compile === 'function') {
      const { content, warnings, meta } = await svc.compile({
        content: String(req.body?.content || ''),
        filters: req.body?.filters || {}
      });
      res.set('Access-Control-Allow-Origin', '*');
      return res.json({ content, warnings, meta });
    }
    return notImplemented(res, { endpoint: 'POST /api/rtg/compile', reason: 'compile function not found' });
  } catch (e) {
    return notImplemented(res, { endpoint: 'POST /api/rtg/compile', error: e?.message || String(e) });
  }
});

// Submit to LLM and persist generated report
router.post('/submit', async (req, res) => {
  try {
    const svcPath = '../../build/rtg/server/submitService.js';
    const svc = require(svcPath);
    if (svc && typeof svc.submit === 'function') {
      const { provider, model, templateId, templateVersion } = req.body || {};
      const { output, meta } = await svc.submit({
        content: String(req.body?.content || ''),
        filters: req.body?.filters || {},
        provider,
        model,
        templateId,
        templateVersion
      });
      res.set('Access-Control-Allow-Origin', '*');
      return res.json({ output, meta });
    }
    return notImplemented(res, { endpoint: 'POST /api/rtg/submit', reason: 'submit function not found' });
  } catch (e) {
    console.error('[RTG] submit error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
});

module.exports = router;
