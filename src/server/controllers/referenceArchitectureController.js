const svc = require('../services/referenceArchitectureService.js');

// GET /api/reference-architecture/categories
function getCategories(pool, redisClient) {
  return async (req, res) => {
    try {
      const cats = await svc.fetchCategories(pool, redisClient);
      return res.json(cats);
    } catch (err) {
      console.error('Error loading categories:', err);
      return res.status(500).json({ error: 'Failed to load categories' });
    }
  };
}

// GET /api/reference-architecture/options?category=<id>
function getOptions(pool, redisClient) {
  return async (req, res) => {
    const { category } = req.query;
    if (!category) {
      return res.status(400).json({ error: 'Missing category parameter' });
    }
    try {
      const opts = await svc.fetchOptions(pool, redisClient, category);
      return res.json(opts);
    } catch (err) {
      console.error('Error loading options:', err);
      return res.status(500).json({ error: 'Failed to load options' });
    }
  };
}

// POST /api/reference-architecture/components/:componentId/safeguards/:safeguardId/reference-architecture
function saveRefArch(pool, redisClient) {
  return async (req, res) => {
    const { componentId, safeguardId } = req.params;
    const { categoryId, optionId, color } = req.body;
    if (!categoryId || !optionId || !color) {
      return res.status(400).json({ error: 'categoryId, optionId, and color are required' });
    }
    try {
      await svc.persistRefArch(
        pool, redisClient,
        { componentId, safeguardId, categoryId, optionId, color }
      );
      return res.json({ success: true });
    } catch (err) {
      console.error('Error saving reference architecture:', err);
      return res.status(500).json({ error: 'Failed to save selection' });
    }
  };
}

// GET saved selection for a safeguard
function getSavedRefArch(pool, redisClient) {
  return async (req, res) => {
    const { componentId, safeguardId } = req.params;
    try {
      const saved = await svc.fetchSavedRefArch(pool, redisClient, safeguardId);
      return res.json(saved);
    } catch (err) {
      console.error('Error loading saved ref arch:', err);
      return res.status(500).json({ error: 'Failed to load saved selection' });
    }
  };
}

module.exports = {
  getCategories,
  getOptions,
  saveRefArch,
  getSavedRefArch
};
