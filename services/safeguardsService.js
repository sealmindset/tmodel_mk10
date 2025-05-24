// Service for handling safeguards CRUD
const db = require('../database/index');

async function getAllSafeguards() {
  const result = await db.query(`
    SELECT id, threat_id, name, type, description, effectiveness, implementation_status, implementation_details, created_at, updated_at, created_by, category, subcategory, implementation_cost, maintenance_cost, effectiveness_justification, last_effectiveness_review, reusable
    FROM threat_model.safeguards
    ORDER BY name
  `);
  return result.rows;
}

async function createSafeguard(data) {
  const {
    threat_id,
    name,
    type,
    description,
    effectiveness,
    implementation_status,
    implementation_details,
    created_by,
    category,
    subcategory,
    implementation_cost,
    maintenance_cost,
    effectiveness_justification,
    last_effectiveness_review,
    reusable
  } = data;
  const result = await db.query(
    `INSERT INTO threat_model.safeguards (
      threat_id, name, type, description, effectiveness, implementation_status, implementation_details, created_by, category, subcategory, implementation_cost, maintenance_cost, effectiveness_justification, last_effectiveness_review, reusable
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    ) RETURNING *`,
    [
      threat_id || null,
      name,
      type || null,
      description || null,
      effectiveness || 0,
      implementation_status || 'Planned',
      implementation_details || null,
      created_by || null,
      category || null,
      subcategory || null,
      implementation_cost || 0,
      maintenance_cost || 0,
      effectiveness_justification || null,
      last_effectiveness_review || null,
      reusable === 'true' || reusable === true
    ]
  );
  return result.rows[0];
}

async function getSafeguardById(id) {
  const result = await db.query(`
    SELECT id, threat_id, name, type, description, effectiveness, implementation_status, implementation_details, created_at, updated_at, created_by, category, subcategory, implementation_cost, maintenance_cost, effectiveness_justification, last_effectiveness_review, reusable
    FROM threat_model.safeguards
    WHERE id = $1
  `, [id]);
  return result.rows[0];
}

async function updateSafeguard(id, data) {
  const {
    threat_id,
    name,
    type,
    description,
    effectiveness,
    implementation_status,
    implementation_details,
    created_by,
    category,
    subcategory,
    implementation_cost,
    maintenance_cost,
    effectiveness_justification,
    last_effectiveness_review,
    reusable
  } = data;
  const result = await db.query(
    `UPDATE threat_model.safeguards SET
      threat_id = $1,
      name = $2,
      type = $3,
      description = $4,
      effectiveness = $5,
      implementation_status = $6,
      implementation_details = $7,
      created_by = $8,
      category = $9,
      subcategory = $10,
      implementation_cost = $11,
      maintenance_cost = $12,
      effectiveness_justification = $13,
      last_effectiveness_review = $14,
      reusable = $15,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $16
    RETURNING *`,
    [
      threat_id || null,
      name,
      type || null,
      description || null,
      effectiveness || 0,
      implementation_status || 'Planned',
      implementation_details || null,
      created_by || null,
      category || null,
      subcategory || null,
      implementation_cost || 0,
      maintenance_cost || 0,
      effectiveness_justification || null,
      last_effectiveness_review || null,
      reusable === 'true' || reusable === true,
      id
    ]
  );
  return result.rows[0];
}

async function deleteSafeguard(id) {
  await db.query('DELETE FROM threat_model.safeguards WHERE id = $1', [id]);
}

module.exports = {
  getAllSafeguards,
  createSafeguard,
  getSafeguardById,
  updateSafeguard,
  deleteSafeguard,
};
