/**
 * Logs API Routes
 * 
 * Routes for accessing application logs stored in Redis
 */
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * @route GET /api/logs
 * @desc Get application logs with filtering options
 * @access Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { level, module, limit, offset } = req.query;
    
    // Log this request
    logger.info('Logs API request', { 
      level, 
      module, 
      limit: limit ? parseInt(limit) : 100, 
      offset: offset ? parseInt(offset) : 0 
    });
    
    // Get logs with filters
    const logs = await logger.getLogs({
      level,
      module,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });
    
    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    logger.error('Error retrieving logs', null, error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving logs',
      error: error.message
    });
  }
});

/**
 * @route GET /api/logs/modules
 * @desc Get list of all modules that have logs
 * @access Private
 */
router.get('/modules', ensureAuthenticated, async (req, res) => {
  try {
    // Get all logs
    const logs = await logger.getLogs({ limit: 1000 });
    
    // Extract unique module names
    const modules = [...new Set(logs.map(log => log.module))].filter(Boolean).sort();
    
    res.json({
      success: true,
      count: modules.length,
      data: modules
    });
  } catch (error) {
    logger.error('Error retrieving log modules', null, error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving log modules',
      error: error.message
    });
  }
});

/**
 * @route GET /api/logs/levels
 * @desc Get list of available log levels
 * @access Private
 */
router.get('/levels', ensureAuthenticated, (req, res) => {
  const levels = Object.keys(logger.LOG_LEVELS);
  
  res.json({
    success: true,
    count: levels.length,
    data: levels
  });
});

module.exports = router;
