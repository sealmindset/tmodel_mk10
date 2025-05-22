/**
 * Rapid7 Sync API
 * 
 * This API provides endpoints for syncing vulnerability data from Rapid7
 */
const express = require('express');
const router = express.Router();
const rapid7Service = require('../../services/rapid7Service');
const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * @route POST /api/rapid7-sync
 * @desc Start a sync of vulnerabilities from Rapid7
 * @access Private
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    console.log('Starting Rapid7 vulnerability sync...');
    
    // Verify Rapid7 API connection before starting sync
    console.log('Verifying Rapid7 API connection...');
    const connectionStatus = await rapid7Service.checkConnection();
    if (!connectionStatus) {
      console.error('Rapid7 API connection failed. Cannot proceed with sync.');
      return res.status(400).json({
        success: false,
        message: 'Cannot connect to Rapid7 API. Please check your API settings.'
      });
    }
    
    console.log('Rapid7 API connection verified. Starting sync process...');
    // Start the sync process
    const syncResult = await rapid7Service.syncVulnerabilities();
    
    return res.status(200).json({
      success: true,
      message: 'Vulnerability sync completed successfully',
      data: syncResult
    });
  } catch (error) {
    console.error('Error syncing vulnerabilities:', error);
    // Log detailed error information
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
    
    return res.status(500).json({
      success: false,
      message: `Error syncing vulnerabilities: ${error.message}`
    });
  }
});

/**
 * @route GET /api/rapid7-sync/status
 * @desc Get the status of the last sync
 * @access Private
 */
router.get('/status', ensureAuthenticated, async (req, res) => {
  try {
    // Get the last sync time from Redis
    const redis = require('../../utils/redis').client;
    const lastSync = await redis.get('rapid7:last_sync');
    
    // Get the last scan history record
    const db = require('../../db/db');
    const query = `
      SELECT * FROM threat_model.scan_history
      WHERE scan_id LIKE 'sync-%'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await db.query(query);
    const lastScan = result.rows.length > 0 ? result.rows[0] : null;
    
    return res.status(200).json({
      success: true,
      data: {
        lastSync,
        lastScan
      }
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting sync status: ${error.message}`
    });
  }
});

module.exports = router;
