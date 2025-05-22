/**
 * Component Assignments API Routes
 * Handles the assignment of threat models to components
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../../middleware/auth');
const { 
  getThreatModelsForComponent, 
  assignThreatModelsToComponent, 
  removeThreatModelFromComponent, 
  clearComponentCache 
} = require('../../services/projectAssignmentService');

/**
 * @route   GET /api/components/:id/threat-models
 * @desc    Get threat models assigned to a component
 * @access  Private
 */
router.get('/:id/threat-models', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    
    console.log(`API: Fetching threat models for component ${id}`);
    
    // Get threat models from the service
    const threatModels = await getThreatModelsForComponent(id, { status });
    console.log(`API: Retrieved ${threatModels.length} models (including Redis) for component ${id}`);
    
    res.json({ success: true, data: threatModels });
  } catch (error) {
    console.error(`API: Error fetching component threat models for ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/components/:id/unassigned-threat-models
 * @desc    Get threat models NOT assigned to a component
 * @access  Public (no auth for debug)
 */
router.get('/:id/unassigned-threat-models', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] Fetching unassigned threat models for component ${id}`);
    const { getUnassignedThreatModelsForComponent } = require('../../services/projectAssignmentService');
    const unassigned = await getUnassignedThreatModelsForComponent(id);
    res.json({ success: true, data: unassigned });
  } catch (error) {
    console.error(`[API] Error fetching unassigned threat models for component:`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/components/:id/threat-models
 * @desc    Assign threat models to a component
 * @access  Private
 */
router.post('/:id/threat-models', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { threatModelIds } = req.body;
    
    if (!Array.isArray(threatModelIds) || threatModelIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No threat model IDs provided' });
    }
    
    // Only allow UUIDs for assignment (PostgreSQL threat model IDs)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validUuids = threatModelIds.filter(rawId => uuidPattern.test(rawId));

    if (validUuids.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid UUID threat model IDs to assign' });
    }

    console.log(`API: Assigning ${validUuids.length} threat models to component ${id}`);

    // Assign via service: only UUIDs
    const insertedIds = await assignThreatModelsToComponent(id, validUuids);
    
    // Clear the cache for this component
    await clearComponentCache(id);
    
    res.json({ 
      success: true, 
      message: 'Successfully assigned threat models to component',
      count: threatModelIds.length,
      inserted: insertedIds
    });
  } catch (error) {
    console.error(`API: Error assigning threat models to component ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/components/:id/threat-models/:threatModelId
 * @desc    Remove a threat model from a component
 * @access  Private
 */
router.delete('/:id/threat-models/:threatModelId', ensureAuthenticated, async (req, res) => {
  try {
    const { id, threatModelId } = req.params;
    
    console.log(`API: Removing threat model ${threatModelId} from component ${id}`);
    
    // Use the service to remove the threat model
    await removeThreatModelFromComponent(id, threatModelId);
    
    res.json({ success: true, message: 'Threat model removed from component' });
  } catch (error) {
    console.error(`API: Error removing threat model from component:`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/components/:id/clear-cache
 * @desc    Clear Redis cache for a component
 * @access  Private
 */
router.post('/:id/clear-cache', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use the service to clear the cache
    await clearComponentCache(id);
    
    res.json({ success: true, message: `Cache cleared for component ${id}` });
  } catch (error) {
    console.error(`API: Error clearing cache for component ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
