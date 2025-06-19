/**
 * Threat Model Merge API Routes
 * 
 * Provides endpoints for merging threat models
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../../middleware/auth');
const threatModelMergeService = require('../../services/threatModelMergeServiceV2');

/**
 * @route POST /api/threat-models/merge
 * @desc Merge multiple threat models into a primary model
 * @access Private
 */
router.post('/threat-models/merge', ensureAuthenticated, async (req, res) => {
  console.time('[MERGE API] /api/threat-models/merge');
  try {
    const { primaryId: primaryModelId, sourceIds, mergedContent, selectedThreatTitles } = req.body;
    console.log('[MERGE API] Incoming merge request:', JSON.stringify(req.body));
    
        if (!primaryModelId || !sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Primary model ID and at least one source model ID are required'
      });
    }
    
    // Get username from session
    const mergedBy = req.session.username || 'system';
    
    console.log('Starting merge operation:', { primaryModelId, sourceIds, mergedBy });
    
    // Perform the merge operation
    const result = await threatModelMergeService.mergeThreatModels(
      primaryModelId,
      sourceIds,
      mergedBy,
      mergedContent, // Pass mergedContent to the service
      selectedThreatTitles // Pass selectedThreatTitles to the service
    );
    
    res.json({
      success: true,
      message: 'Threat models merged successfully',
      data: result
    });
    console.timeEnd('[MERGE API] /api/threat-models/merge');
  } catch (error) {
    console.error('Error merging threat models:', error);
    console.timeEnd('[MERGE API] /api/threat-models/merge');
    res.status(500).json({
      success: false,
      error: error.message || 'Error merging threat models'
    });
  }
});

module.exports = router;
