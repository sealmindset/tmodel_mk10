/**
 * Item Assignment Service Template
 * 
 * This is a reusable template for implementing item assignment functionality
 * between different entities in the application. This template follows best practices
 * for database access, error handling, and transaction management.
 * 
 * How to use:
 * 1. Copy this file and rename it to match your specific item type (e.g., safeguardAssignmentService.js)
 * 2. Replace the placeholder schema/table names with your actual database schema
 * 3. Update the function names and parameters to match your entity and item types
 * 4. Implement any additional custom logic needed for your specific case
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Utility function for logging that can be easily turned on/off
const ENABLE_LOGS = process.env.NODE_ENV !== 'production';
const log = message => {
  if (ENABLE_LOGS) console.log(`[ASSIGN-ITEMS] ${message}`);
};

/**
 * Get items assigned to a specific entity
 * 
 * @param {string} entityId - The ID of the entity (project, component, etc.)
 * @param {Object} options - Optional parameters
 * @param {string} options.schema - Database schema (default: 'threat_model')
 * @param {string} options.itemsTable - Table name for items (default: 'items')
 * @param {string} options.entityField - Field name in items table for entity ID (default: 'entity_id')
 * @returns {Promise<Array>} - List of items assigned to the entity
 */
async function getItemsForEntity(entityId, options = {}) {
  const {
    schema = 'threat_model',
    itemsTable = 'items',
    entityField = 'entity_id'
  } = options;
  
  if (!entityId) {
    throw new Error('Entity ID is required');
  }
  
  const client = await db.connect();
  try {
    // Select all items assigned to this entity
    const sql = `
      SELECT i.*, COUNT(r.id) AS related_count
      FROM ${schema}.${itemsTable} i
      LEFT JOIN ${schema}.related_items r ON r.item_id = i.id
      WHERE i.${entityField} = $1
      GROUP BY i.id
      ORDER BY i.title ASC
    `;
    
    const result = await client.query(sql, [entityId]);
    return result.rows;
  } catch (err) {
    log(`Error getting items for entity ${entityId}: ${err}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get items not assigned to a specific entity
 * 
 * @param {string} entityId - The ID of the entity (project, component, etc.)
 * @param {Object} options - Optional parameters
 * @param {string} options.schema - Database schema (default: 'threat_model')
 * @param {string} options.itemsTable - Table name for items (default: 'items')
 * @param {string} options.entityField - Field name in items table for entity ID (default: 'entity_id')
 * @returns {Promise<Array>} - List of items not assigned to the entity
 */
async function getUnassignedItemsForEntity(entityId, options = {}) {
  const {
    schema = 'threat_model',
    itemsTable = 'items',
    entityField = 'entity_id'
  } = options;
  
  if (!entityId) {
    throw new Error('Entity ID is required');
  }
  
  const client = await db.connect();
  try {
    // Select all items not assigned to this entity (either NULL or different entity_id)
    const sql = `
      SELECT i.*, COUNT(r.id) AS related_count
      FROM ${schema}.${itemsTable} i
      LEFT JOIN ${schema}.related_items r ON r.item_id = i.id
      WHERE (i.${entityField} IS NULL OR i.${entityField} != $1)
      GROUP BY i.id
      ORDER BY i.title ASC
    `;
    
    const result = await client.query(sql, [entityId]);
    return result.rows;
  } catch (err) {
    log(`Error getting unassigned items for entity ${entityId}: ${err}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Assign items to an entity
 * 
 * @param {string} entityId - The ID of the entity (project, component, etc.)
 * @param {Array<string>} itemIds - Array of item IDs to assign
 * @param {Object} options - Optional parameters
 * @param {string} options.schema - Database schema (default: 'threat_model')
 * @param {string} options.itemsTable - Table name for items (default: 'items')
 * @param {string} options.entityField - Field name in items table for entity ID (default: 'entity_id')
 * @returns {Promise<Object>} - Result with success flag and count of assigned items
 */
async function assignItemsToEntity(entityId, itemIds, options = {}) {
  const {
    schema = 'threat_model',
    itemsTable = 'items',
    entityField = 'entity_id'
  } = options;
  
  // Input validation
  if (!entityId) {
    throw new Error('Entity ID is required');
  }
  
  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    return { success: false, message: 'No valid item IDs provided', count: 0 };
  }
  
  // Log incoming assignment request
  log(`Incoming assignment for entity ${entityId}: ${JSON.stringify(itemIds)}`);
  
  const client = await db.connect();
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // Get current state for logging
    const beforeRes = await client.query(
      `SELECT id, title FROM ${schema}.${itemsTable} WHERE ${entityField} = $1`,
      [entityId]
    );
    log(`BEFORE assignment - Entity ${entityId} items: ${JSON.stringify(beforeRes.rows)}`);
    
    // Verify the items exist before attempting to assign
    log(`Checking for valid items with IDs: ${JSON.stringify(itemIds)}`);
    const itemCheckResult = await client.query(
      `SELECT id FROM ${schema}.${itemsTable} WHERE id = ANY($1::uuid[])`,
      [itemIds]
    );
    
    if (itemCheckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'No valid items found', count: 0 };
    }
    
    // Get valid IDs that exist in the database
    const validItemIds = itemCheckResult.rows.map(row => row.id);
    log(`Found ${validItemIds.length} valid items: ${JSON.stringify(validItemIds)}`);
    
    // Only proceed if we have valid items to assign
    if (validItemIds.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'No valid items to assign', count: 0 };
    }
    
    // Update the items table to assign items to the entity
    log(`Attempting to assign ${validItemIds.length} items to entity ${entityId}: ${JSON.stringify(validItemIds)}`);
    const updateSQL = `
      UPDATE ${schema}.${itemsTable}
      SET ${entityField} = $1, updated_at = NOW()
      WHERE id = ANY($2::uuid[])
      RETURNING id
    `;
    
    const updateResult = await client.query(updateSQL, [entityId, validItemIds]);
    const assigned = updateResult.rows;
    
    // Check if assignment was successful
    if (assigned.length > 0) {
      await client.query('COMMIT');
      log(`SUCCESS: Assigned ${assigned.length} items to entity ${entityId}: ${JSON.stringify(validItemIds)}`);
    } else {
      await client.query('ROLLBACK');
      log(`No new assignments performed for entity ${entityId} - all items already assigned or invalid.`);
    }
    
    // Get after state for logging
    const afterRes = await client.query(
      `SELECT id, title FROM ${schema}.${itemsTable} WHERE ${entityField} = $1`,
      [entityId]
    );
    log(`AFTER assignment - Entity ${entityId} items: ${JSON.stringify(afterRes.rows)}`);
    
    return { 
      success: assigned.length > 0, 
      count: assigned.length,
      ids: assigned.map(row => row.id)
    };
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    log(`ERROR assigning items to entity ${entityId}: ${err}`);
    return { success: false, message: err.message, count: 0 };
  } finally {
    client.release();
  }
}

/**
 * Remove an item from an entity
 * 
 * @param {string} entityId - The ID of the entity (project, component, etc.)
 * @param {string} itemId - The ID of the item to remove
 * @param {Object} options - Optional parameters
 * @param {string} options.schema - Database schema (default: 'threat_model')
 * @param {string} options.itemsTable - Table name for items (default: 'items')
 * @param {string} options.entityField - Field name in items table for entity ID (default: 'entity_id')
 * @returns {Promise<Object>} - Result with success flag
 */
async function removeItemFromEntity(entityId, itemId, options = {}) {
  const {
    schema = 'threat_model',
    itemsTable = 'items',
    entityField = 'entity_id'
  } = options;
  
  // Input validation
  if (!entityId || !itemId) {
    throw new Error('Entity ID and Item ID are required');
  }
  
  const client = await db.connect();
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    // First check if the item is actually assigned to this entity
    const checkSQL = `
      SELECT id FROM ${schema}.${itemsTable}
      WHERE id = $1 AND ${entityField} = $2
    `;
    
    const checkResult = await client.query(checkSQL, [itemId, entityId]);
    
    if (checkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Item not found or not assigned to this entity' };
    }
    
    // Update the item to remove the entity association
    const updateSQL = `
      UPDATE ${schema}.${itemsTable}
      SET ${entityField} = NULL, updated_at = NOW()
      WHERE id = $1 AND ${entityField} = $2
      RETURNING id
    `;
    
    const result = await client.query(updateSQL, [itemId, entityId]);
    
    if (result.rowCount > 0) {
      await client.query('COMMIT');
      log(`Successfully removed item ${itemId} from entity ${entityId}`);
      return { success: true };
    } else {
      await client.query('ROLLBACK');
      log(`Failed to remove item ${itemId} from entity ${entityId}`);
      return { success: false, message: 'Failed to remove item from entity' };
    }
  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    log(`Error removing item ${itemId} from entity ${entityId}: ${err}`);
    return { success: false, message: err.message };
  } finally {
    client.release();
  }
}

/**
 * Assign multiple items to an entity with detailed logging
 * 
 * @param {string} entityId - The ID of the entity (project, component, etc.)
 * @param {Array<string>} itemIds - Array of item IDs to assign
 * @param {Object} options - Optional parameters for customization
 * @returns {Promise<Object>} - Result object with success flag
 */
async function assignItemsToEntityWithLogging(entityId, itemIds, options = {}) {
  log(`Assigning items to entity ${entityId}: ${JSON.stringify(itemIds)}`);
  return assignItemsToEntity(entityId, itemIds, options);
}

module.exports = {
  getItemsForEntity,
  getUnassignedItemsForEntity,
  assignItemsToEntity,
  removeItemFromEntity,
  assignItemsToEntityWithLogging
};
