/**
 * Database Compatibility Module
 * 
 * This provides a compatibility layer for modules that import
 * the database from the root directory instead of from db/db.
 * 
 * This version uses a wrapped pool that adds validation and error handling
 * to prevent common connection issues with PostgreSQL.
 */

// Use the wrapped pool with improved error handling
const pool = require('./db/pool-wrapper');

// Export the wrapped database pool
module.exports = pool;
