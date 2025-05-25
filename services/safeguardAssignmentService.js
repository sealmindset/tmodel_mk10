/**
 * Safeguard Assignment Service
 * 
 * This service handles the assignment of safeguards to components.
 * It uses the reusable item assignment template pattern.
 */

const db = require('../db/db');
const { v4: uuidv4 } = require('uuid');

// Utility function for logging that can be easily turned on/off
const ENABLE_LOGS = process.env.NODE_ENV !== 'production';
const log = message => {
  if (ENABLE_LOGS) console.log(`[ASSIGN-SAFEGUARDS] ${message}`);
};

/**
 * Get safeguards assigned to a specific component
 * 
 * @param {string} componentId - The component ID
 * @returns {Promise<Array>} - List of safeguards assigned to the component
 */
async function getSafeguardsForComponent(componentId) {
  if (!componentId) {
    throw new Error('Component ID is required');
  }
  
  const client = await db.connect();
  try {
    // First check if the component_safeguards table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'threat_model' 
        AND table_name = 'component_safeguards'
      );
    `;
    
    const tableExists = await client.query(tableCheckQuery);
    
    if (!tableExists.rows[0].exists) {
      log('Warning: threat_model.component_safeguards table does not exist');
      return [];
    }
    
    // Select all safeguards assigned to this component
    const sql = `
      SELECT s.*, cs.status, cs.notes 
      FROM threat_model.safeguards s
      JOIN threat_model.component_safeguards cs ON s.id = cs.safeguard_id
      WHERE cs.component_id = $1
      ORDER BY s.name ASC
    `;
    
    const result = await client.query(sql, [componentId]);
    return result.rows;
  } catch (err) {
    log(`Error getting safeguards for component ${componentId}: ${err}`);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Get safeguards not assigned to a specific component
 * 
 * @param {string} componentId - The component ID
 * @returns {Promise<Array>} - List of safeguards not assigned to the component
 */
async function getUnassignedSafeguardsForComponent(componentId) {
  if (!componentId) {
    throw new Error('Component ID is required');
  }
  
  const client = await db.connect();
  try {
    // First check if the component_safeguards table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'threat_model' 
        AND table_name = 'component_safeguards'
      );
    `;
    
    const tableExists = await client.query(tableCheckQuery);
    
    if (!tableExists.rows[0].exists) {
      log('Warning: threat_model.component_safeguards table does not exist');
      
      // If the junction table doesn't exist, return all safeguards
      const allSafeguardsQuery = `
        SELECT * FROM threat_model.safeguards
        ORDER BY name ASC
      `;
      
      const result = await client.query(allSafeguardsQuery);
      return result.rows;
    }
    
    // Select all safeguards not assigned to this component
    // (i.e., not in the component_safeguards junction table for this component)
    const sql = `
      SELECT s.*
      FROM threat_model.safeguards s
      WHERE s.id NOT IN (
        SELECT cs.safeguard_id
        FROM threat_model.component_safeguards cs
        WHERE cs.component_id = $1
      )
      ORDER BY s.name ASC
    `;
    
    const result = await client.query(sql, [componentId]);
    return result.rows;
  } catch (err) {
    log(`Error getting unassigned safeguards for component ${componentId}: ${err}`);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Assign safeguards to a component
 * 
 * @param {string} componentId - The component ID
 * @param {Array<string>} safeguardIds - Array of safeguard IDs to assign
 * @returns {Promise<Object>} - Result with success flag and count of assigned safeguards
 */
async function assignSafeguardsToComponent(componentId, safeguardIds) {
  // Input validation
  if (!componentId) {
    throw new Error('Component ID is required');
  }
  
  if (!safeguardIds || !Array.isArray(safeguardIds) || safeguardIds.length === 0) {
    return { success: false, message: 'No valid safeguard IDs provided', count: 0 };
  }
  
  // Log incoming assignment request
  log(`Incoming assignment for component ${componentId}: ${JSON.stringify(safeguardIds)}`);
  
  const client = await db.connect();
  try {
    // First check if the component_safeguards table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'threat_model' 
        AND table_name = 'component_safeguards'
      );
    `;
    
    const tableExists = await client.query(tableCheckQuery);
    
    if (!tableExists.rows[0].exists) {
      throw new Error('threat_model.component_safeguards table does not exist');
    }
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Get current state for logging
    const beforeRes = await client.query(
      `SELECT s.id, s.name 
       FROM threat_model.safeguards s
       JOIN threat_model.component_safeguards cs ON s.id = cs.safeguard_id
       WHERE cs.component_id = $1`, 
      [componentId]
    );
    log(`BEFORE assignment - Component ${componentId} safeguards: ${JSON.stringify(beforeRes.rows)}`);
    
    // Verify the safeguards exist before attempting to assign
    log(`Checking for valid safeguards with IDs: ${JSON.stringify(safeguardIds)}`);
    const safeguardCheckResult = await client.query(
      `SELECT id FROM threat_model.safeguards WHERE id = ANY($1::uuid[])`,
      [safeguardIds]
    );
    
    if (safeguardCheckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'No valid safeguards found', count: 0 };
    }
    
    // Get valid IDs that exist in the database
    const validSafeguardIds = safeguardCheckResult.rows.map(row => row.id);
    log(`Found ${validSafeguardIds.length} valid safeguards: ${JSON.stringify(validSafeguardIds)}`);
    
    // Only proceed if we have valid safeguards to assign
    if (validSafeguardIds.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'No valid safeguards to assign', count: 0 };
    }
    
    // For each valid safeguard, check if it's already assigned to this component
    const existingAssignmentsQuery = `
      SELECT safeguard_id 
      FROM threat_model.component_safeguards
      WHERE component_id = $1 AND safeguard_id = ANY($2::uuid[])
    `;
    
    const existingAssignments = await client.query(
      existingAssignmentsQuery,
      [componentId, validSafeguardIds]
    );
    
    // Filter out safeguards that are already assigned
    const existingIds = existingAssignments.rows.map(row => row.safeguard_id);
    const newSafeguardIds = validSafeguardIds.filter(id => !existingIds.includes(id));
    
    log(`${existingIds.length} safeguards already assigned, ${newSafeguardIds.length} new assignments to create`);
    
    // Only proceed if we have new safeguards to assign
    if (newSafeguardIds.length === 0) {
      await client.query('COMMIT'); // Commit the empty transaction
      return { 
        success: true, 
        message: 'All safeguards already assigned', 
        count: 0 
      };
    }
    
    // Insert new assignments in the junction table
    const insertValues = newSafeguardIds.map((safeguardId) => {
      return `('${componentId}', '${safeguardId}', NOW(), NOW(), 'pending', NULL)`;
    }).join(', ');
    
    const insertSQL = `
      INSERT INTO threat_model.component_safeguards
        (component_id, safeguard_id, created_at, updated_at, status, notes)
      VALUES
        ${insertValues}
      RETURNING safeguard_id
    `;
    
    const insertResult = await client.query(insertSQL);
    const assigned = insertResult.rows;
    
    // Commit the transaction
    await client.query('COMMIT');
    
    // Get after state for logging
    const afterRes = await client.query(
      `SELECT s.id, s.name 
       FROM threat_model.safeguards s
       JOIN threat_model.component_safeguards cs ON s.id = cs.safeguard_id
       WHERE cs.component_id = $1`, 
      [componentId]
    );
    log(`AFTER assignment - Component ${componentId} safeguards: ${JSON.stringify(afterRes.rows)}`);
    
    return { 
      success: true, 
      count: assigned.length,
      ids: assigned.map(row => row.safeguard_id)
    };
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    log(`ERROR assigning safeguards to component ${componentId}: ${err}`);
    return { success: false, message: err.message, count: 0 };
  } finally {
    client.release();
  }
}

/**
 * Remove a safeguard from a component
 * 
 * @param {string} componentId - The component ID
 * @param {string} safeguardId - The safeguard ID to remove
 * @returns {Promise<Object>} - Result with success flag
 */
async function removeSafeguardFromComponent(componentId, safeguardId) {
  // Input validation
  if (!componentId || !safeguardId) {
    throw new Error('Component ID and Safeguard ID are required');
  }
  
  const client = await db.connect();
  try {
    // First check if the component_safeguards table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'threat_model' 
        AND table_name = 'component_safeguards'
      );
    `;
    
    const tableExists = await client.query(tableCheckQuery);
    
    if (!tableExists.rows[0].exists) {
      log('Warning: threat_model.component_safeguards table does not exist');
      return { success: false, message: 'Component safeguards table does not exist' };
    }
    
    // Start a transaction
    await client.query('BEGIN');
    
    // First check if the safeguard is actually assigned to this component
    const checkSQL = `
      SELECT safeguard_id 
      FROM threat_model.component_safeguards
      WHERE component_id = $1 AND safeguard_id = $2
    `;
    
    const checkResult = await client.query(checkSQL, [componentId, safeguardId]);
    
    if (checkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { 
        success: false, 
        message: 'Safeguard not found or not assigned to this component' 
      };
    }
    
    // Delete the assignment from the junction table
    const deleteSQL = `
      DELETE FROM threat_model.component_safeguards 
      WHERE component_id = $1 AND safeguard_id = $2
      RETURNING safeguard_id
    `;
    
    const result = await client.query(deleteSQL, [componentId, safeguardId]);
    
    if (result.rowCount > 0) {
      await client.query('COMMIT');
      log(`Successfully removed safeguard ${safeguardId} from component ${componentId}`);
      return { success: true };
    } else {
      await client.query('ROLLBACK');
      log(`Failed to remove safeguard ${safeguardId} from component ${componentId}`);
      return { 
        success: false, 
        message: 'Failed to remove safeguard from component' 
      };
    }
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    log(`Error removing safeguard ${safeguardId} from component ${componentId}: ${err}`);
    return { success: false, message: err.message };
  } finally {
    client.release();
  }
}

/**
 * Assign multiple safeguards to a component with detailed logging
 * 
 * @param {string} componentId - The component ID
 * @param {Array<string>} safeguardIds - Array of safeguard IDs to assign
 * @returns {Promise<Object>} - Result object with success flag
 */
async function assignSafeguardsToComponentWithLogging(componentId, safeguardIds) {
  log(`Assigning safeguards to component ${componentId}: ${JSON.stringify(safeguardIds)}`);
  return assignSafeguardsToComponent(componentId, safeguardIds);
}

module.exports = {
  getSafeguardsForComponent,
  getUnassignedSafeguardsForComponent,
  assignSafeguardsToComponent,
  removeSafeguardFromComponent,
  assignSafeguardsToComponentWithLogging
};
