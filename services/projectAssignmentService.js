// services/projectAssignmentService.js

const dbSettingsService = require('./dbSettingsService');

// Helper to get a pool dynamically for each operation
async function getDbPool() {
  return dbSettingsService.getConnection();
}

/**
 * Invalidate Redis caches for a project.
 */
async function clearProjectCache(projectId) {
  // No-op: Redis has been removed. No cache to clear.
  return;
}

/**
 * Fetch all threat models assigned to a project.
 */
async function getThreatModelsForProject(projectId) {
  if (!projectId) throw new Error('projectId is required');
  const sql = `
    SELECT tm.*
      FROM threat_model.threat_models tm
     WHERE tm.project_id = $1
     ORDER BY tm.title ASC
  `;
  const pool = await getDbPool();
  try {
    const { rows } = await pool.query(sql, [projectId]);
    return rows;
  } finally {
    // cleanup if needed
  }
}

/**
 * Get threat models NOT assigned to a project
 */
async function getUnassignedThreatModelsForProject(projectId) {
  if (!projectId) throw new Error('projectId is required');
  const sql = `
    SELECT tm.*, COUNT(t.id) AS threat_count
      FROM threat_model.threat_models tm
      LEFT JOIN threat_model.threats t ON t.threat_model_id = tm.id
     WHERE (tm.project_id IS NULL OR tm.project_id != $1)
     GROUP BY tm.id
     ORDER BY tm.title ASC
  `;
  const pool = await getDbPool();
  try {
    const { rows } = await pool.query(sql, [projectId]);
    return rows;
  } finally {
    // cleanup if needed
  }
}

/**
 * Get threat models NOT assigned to a component
 * Returns array of threat models not linked to the given component.
 * Supports PostgreSQL (and Redis if present).
 */
async function getUnassignedThreatModelsForComponent(componentId) {
  if (!componentId) throw new Error('componentId is required');
  const pool = await getDbPool();
  // 1. Get all threat models
  let allThreatModels = [];
  try {
    const { rows } = await pool.query('SELECT * FROM threat_model.threat_models ORDER BY created_at DESC');
    allThreatModels = rows;
    console.log(`[UNASSIGNED] Found ${allThreatModels.length} total threat models in PostgreSQL`);
  } catch (err) {
    console.error(`[UNASSIGNED] Error fetching all threat models:`, err);
    throw err;
  }
  // 2. Get threat models already assigned to this component
  let assigned = [];
  try {
    const assignedRes = await pool.query(
      'SELECT tm.id FROM threat_model.threat_models tm JOIN threat_model.component_threat_models ctm ON tm.id = ctm.threat_model_id WHERE ctm.component_id = $1',
      [componentId]
    );
    assigned = assignedRes.rows.map(r => r.id);
    console.log(`[UNASSIGNED] Component ${componentId} has ${assigned.length} assigned threat models`);
  } catch (err) {
    console.error(`[UNASSIGNED] Error fetching assigned threat models for component:`, err);
    throw err;
  }
  // 3. Filter out assigned
  const unassigned = allThreatModels.filter(tm => !assigned.includes(tm.id));
  console.log(`[UNASSIGNED] ${unassigned.length} unassigned threat models for component ${componentId}`);
  return unassigned;
}


/**
 * Assign threat models to a project.
 * Returns array of inserted threat_model IDs.
 */
async function assignThreatModelsToProject(projectId, pgIds = []) {
  if (!projectId) throw new Error('projectId is required');
  const pool = await getDbPool();
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    let insertedIds = [];
    if (pgIds.length) {
      // Verify all IDs exist
      const res = await client.query(
        'SELECT id FROM threat_model.threat_models WHERE id = ANY($1::int[])',
        [pgIds]
      );
      const valid = res.rows.map(r => r.id);
      const invalid = pgIds.filter(id => !valid.includes(id));
      if (invalid.length) {
        throw new Error(`Invalid threat_model IDs: ${invalid.join(', ')}`);
      }
      
      // Update the project_id field directly in the threat_models table
      const updateSQL = `
        UPDATE threat_model.threat_models
        SET project_id = $1, updated_at = NOW()
        WHERE id = ANY($2::int[])
        RETURNING id
      `;
      const updated = await client.query(updateSQL, [projectId, pgIds]);
      insertedIds = updated.rows.map(r => r.id);
    }
    await client.query('COMMIT');
    return insertedIds;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Remove a threat model from a project.
 */
async function removeThreatModelFromProject(projectId, threatModelId) {
  if (!projectId || typeof threatModelId === 'undefined') {
    throw new Error('projectId and threatModelId are required');
  }
  const pool = await getDbPool();
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    // Update the threat model to set project_id to NULL
    await client.query(
      'UPDATE threat_model.threat_models SET project_id = NULL, updated_at = NOW() WHERE id = $1 AND project_id = $2',
      [threatModelId, projectId]
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Invalidate PostgreSQL caches for a component.
 */
async function clearComponentCache(componentId) {
  // No-op: No cache to clear.
  return;
}

/**
 * Fetch all threat models assigned to a component.
 */
async function getThreatModelsForComponent(componentId, filters = {}) {
  if (!componentId) throw new Error('componentId is required');
  let sql = `
    SELECT tm.*,
           (SELECT COUNT(*) FROM threat_model.threat_model_threats tmt WHERE tmt.threat_model_id = tm.id) AS threat_count,
           (SELECT AVG(t.risk_score) FROM threat_model.threats t 
             JOIN threat_model.threat_model_threats tmt ON t.id = tmt.threat_id 
             WHERE tmt.threat_model_id = tm.id) AS avg_risk_score
    FROM threat_model.threat_models tm
    JOIN threat_model.component_threat_models ctm ON tm.id = ctm.threat_model_id
    WHERE ctm.component_id = $1
  `;
  const params = [componentId];
  if (filters.status) {
    sql += ' AND tm.status = $2';
    params.push(filters.status);
  }
  sql += ' ORDER BY tm.created_at DESC';
  const pool = await getDbPool();
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } finally {

  }
}

/**
 * Assign threat models to a component.
 * @param {string} componentId - Component UUID
 * @param {number[]} pgIds - Array of numeric threat model IDs
 * @param {string[]} redisSubjectIds - Array of Redis subject UUIDs
 */
// NOTE: If this function uses the pool, update it to use getDbPool() as above.
/**
 * Assign threat models to a component.
 * @param {string} componentId - Component UUID
 * @param {string[]} threatModelUuids - Array of threat model UUIDs
 * @returns {Promise<string[]>} List of assigned threat model IDs
 */
async function assignThreatModelsToComponent(componentId, threatModelUuids = []) {
  const pool = await getDbPool();
  if (!componentId) throw new Error('componentId is required');
  if (!Array.isArray(threatModelUuids) || threatModelUuids.length === 0) throw new Error('No threat model IDs provided');
  const client = await pool.connect();
  await client.query('BEGIN');
  let insertedDbIds = [];
  try {
    for (const threatModelId of threatModelUuids) {
      // Validate UUID exists in the database
      const idRes = await client.query(
        'SELECT id FROM threat_model.threat_models WHERE id = $1',
        [threatModelId]
      );
      if (idRes.rows.length > 0) {
        // Insert the assignment
        const insertSQL = `
          INSERT INTO threat_model.component_threat_models 
          (component_id, threat_model_id, created_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT DO NOTHING
          RETURNING threat_model_id AS id
        `;
        const ins = await client.query(insertSQL, [componentId, threatModelId]);
        if (ins.rows.length > 0) {
          insertedDbIds.push(ins.rows[0].id);
        }
      } else {
        console.warn(`Threat model with ID ${threatModelId} not found`);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await clearComponentCache(componentId);
  return insertedDbIds;
}

/**
 * Remove a threat model from a component.
 */
async function removeThreatModelFromComponent(componentId, threatModelId) {
  if (!componentId || !threatModelId) {
    throw new Error('componentId and threatModelId are required');
  }
  const pool = await getDbPool();
  const client = await pool.connect();
  await client.query('BEGIN');
  try {
    await client.query(
      'DELETE FROM threat_model.component_threat_models WHERE component_id = $1 AND threat_model_id = $2',
      [componentId, threatModelId]
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


const fs = require('fs');
const path = require('path');

/**
 * Assign threat models to a project with logging and partial success allowed.
 * Logs before/after states to both console and logs/assignment.log.
 * Returns true if any assignment succeeded, false otherwise.
 *
 * @param {string|number} projectId
 * @param {Array<string|number>} threatModelIds
 * @returns {Promise<boolean>}
 */
async function assignThreatModelsToProjectWithLogging(projectId, threatModelIds = []) {
  const pool = await getDbPool();
  if (!projectId) throw new Error('projectId is required');
  if (!Array.isArray(threatModelIds) || threatModelIds.length === 0) return false;

  const logFile = path.join(__dirname, '../logs/assignment.log');
  const log = (msg) => {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${msg}\n`;
    // Log to console
    console.log(entry.trim());
    // Append to file (sync to avoid race in quick calls)
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, entry);
    } catch (e) {
      console.error(`[${timestamp}] Failed to write to assignment.log:`, e);
    }
  };

  const client = await pool.connect();
  try {
    // Get before state
    const beforeRes = await client.query(
      `SELECT tm.id, tm.title FROM threat_model.threat_models tm
       WHERE tm.project_id = $1`, [projectId]
    );
    const beforeList = beforeRes.rows;
    log(`BEFORE assignment - Project ${projectId} threat models: ${JSON.stringify(beforeList)}`);

    // Validate threatModelIds: must exist and not already assigned
    log(`Checking for valid threat models with IDs: ${JSON.stringify(threatModelIds)}`);
    const validRes = await client.query(
      `SELECT id FROM threat_model.threat_models WHERE id = ANY($1::uuid[])`, [threatModelIds]
    );
    const validIds = validRes.rows.map(r => r.id);
    log(`Found ${validIds.length} valid threat models: ${JSON.stringify(validIds)}`);
    
    const alreadyAssignedRes = await client.query(
      `SELECT id FROM threat_model.threat_models WHERE project_id = $1 AND id = ANY($2::uuid[])`,
      [projectId, validIds]
    );
    const alreadyAssigned = alreadyAssignedRes.rows.map(r => r.id);
    const toAssign = validIds.filter(id => !alreadyAssigned.includes(id));
    const skipped = threatModelIds.filter(id => !validIds.includes(id) || alreadyAssigned.includes(id));
    if (skipped.length > 0) {
      log(`SKIPPED IDs (invalid or already assigned): ${JSON.stringify(skipped)}`);
    }
    let assigned = [];
    if (toAssign.length > 0) {
      log(`Attempting to assign ${toAssign.length} threat models to project ${projectId}: ${JSON.stringify(toAssign)}`);
      
      // Update project_id directly in the threat_models table
      const updateSQL = `
        UPDATE threat_model.threat_models
        SET project_id = $1, updated_at = NOW()
        WHERE id = ANY($2::uuid[])
        RETURNING id
      `;
      
      const updated = await client.query(updateSQL, [projectId, toAssign]);
      assigned = updated.rows.map(r => r.id);
      
      if (assigned.length > 0) {
        log(`SUCCESS: Assigned ${assigned.length} threat models to project ${projectId}: ${JSON.stringify(assigned)}`);
      } else {
        log(`WARNING: Update query completed but no threat models were assigned to project ${projectId}`);
      }
    } else {
      log(`No new assignments performed for project ${projectId} - all threat models already assigned or invalid.`);
    }
    // Get after state
    const afterRes = await client.query(
      `SELECT tm.id, tm.title FROM threat_model.threat_models tm
       WHERE tm.project_id = $1`, [projectId]
    );
    const afterList = afterRes.rows;
    log(`AFTER assignment - Project ${projectId} threat models: ${JSON.stringify(afterList)}`);
    return assigned.length > 0;
  } catch (err) {
    log(`ERROR assigning threat models to project ${projectId}: ${err}`);
    return false;
  } finally {
    client.release();
  }
}

module.exports = {
  clearProjectCache,
  getThreatModelsForProject,
  assignThreatModelsToProject,
  removeThreatModelFromProject,
  clearComponentCache,
  getThreatModelsForComponent,
  assignThreatModelsToComponent,
  removeThreatModelFromComponent,
  getUnassignedThreatModelsForProject,
  assignThreatModelsToProjectWithLogging,
  getUnassignedThreatModelsForComponent,
};
