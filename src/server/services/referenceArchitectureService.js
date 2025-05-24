console.log('[LOG] referenceArchitectureService.js loaded');
console.log('[LOG] referenceArchitectureService.js initialized');

const CAT_CACHE_KEY = 'refArch:categories';
const OPT_CACHE_NS  = 'refArch:options:';

/**
 * Fetch all reference architecture categories (cached)
 */
async function fetchCategories(pool) {
  console.log('[LOG] referenceArchitectureService.js: fetchCategories called');
  console.log('[LOG] referenceArchitectureService.js: fetchCategories started');

  if (cached) return JSON.parse(cached);

  const { rows } = await pool.query(
    'SELECT id, name FROM threat_model.reference_architecture_category ORDER BY id'
  );

  return rows;
}

/**
 * Fetch options for a specific category (cached)
 */
async function fetchOptions(pool, categoryId) {
  console.log('[LOG] referenceArchitectureService.js: fetchOptions called');
  const key = `${OPT_CACHE_NS}${categoryId}`;

  if (cached) return JSON.parse(cached);

  const { rows } = await pool.query(
    'SELECT id, name FROM threat_model.reference_architecture_option WHERE category_id = $1 ORDER BY id',
    [categoryId]
  );

  return rows;
}

/**
 * Persist a safeguard's reference-architecture selection
 */
async function persistRefArch(pool, { componentId, safeguardId, categoryId, optionId, color }) {
  console.log('[LOG] referenceArchitectureService.js: persistRefArch called');
  await pool.query(
    `INSERT INTO threat_model.safeguard_reference_architecture
       (safeguard_id, category_id, option_id, color)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (safeguard_id,option_id)
     DO UPDATE SET color = EXCLUDED.color`,
    [safeguardId, categoryId, optionId, color]
  );
}

/**
 * Fetch saved reference architecture selection for a safeguard
 */
async function fetchSavedRefArch(pool, safeguardId) {
  console.log('[LOG] referenceArchitectureService.js: fetchSavedRefArch called');
  const { rows } = await pool.query(
    'SELECT category_id AS "categoryId", option_id AS "optionId", color FROM threat_model.safeguard_reference_architecture WHERE safeguard_id = $1',
    [safeguardId]
  );
  return rows[0] || null;
}

module.exports = {
  fetchCategories,
  fetchOptions,
  persistRefArch,
  fetchSavedRefArch
};
