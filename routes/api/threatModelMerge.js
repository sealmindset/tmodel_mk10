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
  try {
    const { primaryModelId, sourceModelIds } = req.body;
    
    if (!primaryModelId || !sourceModelIds || !Array.isArray(sourceModelIds) || sourceModelIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Primary model ID and at least one source model ID are required'
      });
    }
    
    // Get username from session
    const mergedBy = req.session.username || 'system';
    
    console.log('Starting merge operation:', { primaryModelId, sourceModelIds, mergedBy });
    
    // Perform the merge operation
    const result = await threatModelMergeService.mergeThreatModels(
      primaryModelId,
      sourceModelIds,
      mergedBy
    );
    
    res.json({
      success: true,
      message: 'Threat models merged successfully',
      data: result
    });
  } catch (error) {
    console.error('Error merging threat models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error merging threat models'
    });
  }
});

module.exports = router;
