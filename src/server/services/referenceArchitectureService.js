const CAT_CACHE_KEY = 'refArch:categories';
const OPT_CACHE_NS  = 'refArch:options:';

/**
 * Fetch all reference architecture categories (cached)
 */
export async function fetchCategories(pool) {

  if (cached) return JSON.parse(cached);

  const { rows } = await pool.query(
    'SELECT id, name FROM threat_model.reference_architecture_category ORDER BY id'
  );

  return rows;
}

/**
 * Fetch options for a specific category (cached)
 */
export async function fetchOptions(pool, categoryId) {
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
export async function persistRefArch(pool, { componentId, safeguardId, categoryId, optionId, color }) {
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
export async function fetchSavedRefArch(pool, safeguardId) {
  const { rows } = await pool.query(
    'SELECT category_id AS "categoryId", option_id AS "optionId", color FROM threat_model.safeguard_reference_architecture WHERE safeguard_id = $1',
    [safeguardId]
  );
  return rows[0] || null;
}
