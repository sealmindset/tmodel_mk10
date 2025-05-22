/**
 * Logger Compatibility Module
 * 
 * This provides a compatibility layer for modules that import
 * the logger from the root directory instead of from utils/logger.
 */

const logger = require('./utils/logger');

// Export the logger
module.exports = logger;
