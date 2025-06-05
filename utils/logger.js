/**
 * Centralized Logging Utility
 * 
 * Provides standardized logging functionality across the application with:
 * - Timestamps
 * - Log levels (debug, info, warn, error)
 * - Module/component identification
 * - Redis logging for persistence and viewing in the UI
 * - Truncation of sensitive or large data
 */
const util = require('util');
const path = require('path');
const db = require('../db/db');

// Determine if we should persist logs to the database
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// In-memory log storage (non-persistent, for dev only)
const inMemoryLogs = [];

// Maximum length for truncated values (e.g. API keys, large responses)
const MAX_VALUE_LENGTH = 1000;
// Maximum number of log entries to keep in Redis
const MAX_LOG_ENTRIES = 1000;
// Redis key prefix for logs
const LOG_KEY_PREFIX = 'logs:';
// Redis key for the log index
const LOG_INDEX_KEY = 'logs:index';

// Log levels and their numeric values for filtering
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level from environment or default to INFO
const currentLogLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const CURRENT_LOG_LEVEL = LOG_LEVELS[currentLogLevel] || LOG_LEVELS.INFO;

/**
 * Truncate a string or object to a maximum length
 * @param {any} value - The value to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string
 */
function truncate(value, maxLength = MAX_VALUE_LENGTH) {
  if (value === null || value === undefined) return String(value);
  
  let stringValue;
  if (typeof value === 'object') {
    try {
      stringValue = JSON.stringify(value);
    } catch (e) {
      stringValue = util.inspect(value);
    }
  } else {
    stringValue = String(value);
  }
  
  if (stringValue.length <= maxLength) return stringValue;
  return `${stringValue.substring(0, maxLength)}... [truncated, ${stringValue.length} chars total]`;
}

/**
 * Get the calling module name from the stack trace
 * @returns {string} - Module name
 */
function getCallerInfo() {
  const stack = new Error().stack.split('\n');
  // Skip this function and the log function in the stack
  const callerLine = stack[3] || '';
  
  // Try to extract filename
  const match = callerLine.match(/at\s+(?:\w+\s+\()?([^:)]+):/);
  if (match && match[1]) {
    // Get just the filename without the path
    return path.basename(match[1]);
  }
  return 'unknown';
}

/**
 * Store a log entry in memory (dev only). Replace with persistent storage in production.
 * @param {Object} logEntry - The log entry to store
 */
function storeLogInMemory(logEntry) {
  if (IS_PRODUCTION) {
    // Persist logs to the database in production
    db.query(
      `INSERT INTO threat_model.app_logs (timestamp, level, module, message, data, error)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        logEntry.timestamp,
        logEntry.level,
        logEntry.module,
        logEntry.message,
        logEntry.data,
        logEntry.error ? JSON.stringify(logEntry.error) : null
      ]
    ).catch((err) => {
      console.error('Failed to store log entry in database', err);
    });
  } else {
    inMemoryLogs.unshift(logEntry);
    if (inMemoryLogs.length > 1000) inMemoryLogs.length = 1000;
  }
}

/**
 * Format and log a message
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {Object} [data] - Additional data to log
 * @param {Error} [error] - Error object if applicable
 */
function log(level, module, message, data = null, error = null) {
  const levelUpper = level.toUpperCase();
  const levelValue = LOG_LEVELS[levelUpper] || 0;
  
  // Skip logging if below current log level
  if (levelValue < CURRENT_LOG_LEVEL) return;
  
  const timestamp = new Date().toISOString();
  const moduleInfo = module || getCallerInfo();
  
  // Format the log message
  let logMessage = `[${timestamp}] [${levelUpper}] [${moduleInfo}] ${message}`;
  
  // Process data if present
  let logData = null;
  if (data) {
    // Handle sensitive data
    if (data.apiKey || data.api_key) {
      const apiKey = data.apiKey || data.api_key;
      if (typeof apiKey === 'string' && apiKey.length > 8) {
        const masked = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
        if (data.apiKey) data.apiKey = masked;
        if (data.api_key) data.api_key = masked;
      }
    }
    
    // Truncate large data
    logData = truncate(data);
  }
  
  // Process error if present
  let errorInfo = null;
  if (error) {
    errorInfo = {
      message: error.message,
      stack: error.stack,
      code: error.code || error.statusCode
    };
  }
  
  // Log to console
  const consoleLogData = [];
  if (logData) consoleLogData.push(logData);
  if (errorInfo) consoleLogData.push(errorInfo);
  
  switch (levelUpper) {
    case 'DEBUG':
      console.debug(logMessage, ...consoleLogData);
      break;
    case 'INFO':
      console.log(logMessage, ...consoleLogData);
      break;
    case 'WARN':
      console.warn(logMessage, ...consoleLogData);
      break;
    case 'ERROR':
      console.error(logMessage, ...consoleLogData);
      break;
    default:
      console.log(logMessage, ...consoleLogData);
  }
  
  // Store in memory for dev. Replace with persistent storage for production.
  const logEntry = {
    timestamp,
    level: levelUpper,
    module: moduleInfo,
    message,
    data: logData,
    error: errorInfo
  };
  storeLogInMemory(logEntry);

}

/**
 * Get logs from in-memory storage (dev only)
 * @param {Object} options - Options for retrieving logs
 * @param {string} [options.level] - Filter by log level
 * @param {string} [options.module] - Filter by module
 * @param {number} [options.limit=100] - Maximum number of logs to retrieve
 * @param {number} [options.offset=0] - Offset for pagination
 * @returns {Promise<Array>} - Array of log entries
 */
async function getLogs(options = {}) {
  const { level, module, limit = 100, offset = 0 } = options;

  if (IS_PRODUCTION) {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (level) {
      conditions.push(`level = $${idx}`);
      params.push(level.toUpperCase());
      idx++;
    }

    if (module) {
      conditions.push(`module = $${idx}`);
      params.push(module);
      idx++;
    }

    let query = 'SELECT timestamp, level, module, message, data, error FROM threat_model.app_logs';
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ` ORDER BY timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  // In development, use in-memory logs
  let logs = inMemoryLogs;
  if (level) logs = logs.filter(entry => entry.level === level.toUpperCase());
  if (module) logs = logs.filter(entry => entry.module === module);
  return logs.slice(offset, offset + limit);
}

// Export convenience methods for each log level
module.exports = {
  debug: (message, data, error) => log('debug', null, message, data, error),
  info: (message, data, error) => log('info', null, message, data, error),
  warn: (message, data, error) => log('warn', null, message, data, error),
  error: (message, data, error) => log('error', null, message, data, error),
  
  // Module-specific logging
  forModule: (module) => ({
    debug: (message, data, error) => log('debug', module, message, data, error),
    info: (message, data, error) => log('info', module, message, data, error),
    warn: (message, data, error) => log('warn', module, message, data, error),
    error: (message, data, error) => log('error', module, message, data, error),
  }),
  
  // Utility functions
  getLogs,
  LOG_LEVELS
};
