/**
 * Project Assignments API Routes
 * Handles the assignment of threat models to projects
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../../middleware/auth');
const projectAssignmentService = require('../../services/projectAssignmentService');

/**
 * @route   GET /api/projects/:id/threat-models
 * @desc    Get threat models assigned to a project
 * @access  Private
 */
router.get('/projects/:id/threat-models', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    
    console.log(`API: Fetching threat models for project ${id}`);
    
    let threatModels = [];
    try {
      threatModels = await projectAssignmentService.getThreatModelsForProject(id, { status });
      console.log(`API: Retrieved ${threatModels.length} models from service for project ${id}`);
    } catch (error) {
      console.error(`API: Error getting models from service for project ${id}:`, error);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
    res.json({ success: true, data: threatModels });
  } catch (error) {
    console.error(`API: Error fetching project threat models for ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/threat-models/:id/projects
 * @desc    Get projects assigned to a threat model
 * @access  Private
 */
router.get('/threat-models/:id/projects', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    // This endpoint is no longer supported as we removed the getProjectsForThreatModel function
    // Return an empty array to avoid breaking existing clients
    console.warn(`Deprecated endpoint called: GET /api/threat-models/${id}/projects`);
    
    res.json({ 
      success: true, 
      data: [],
      message: 'This endpoint is deprecated. Please use the project-centric endpoints instead.'
    });
  } catch (error) {
    console.error('Error handling deprecated endpoint:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/projects/:id/threat-models
 * @desc    Assign threat models to a project
 * @access  Private
 */
router.post('/projects/:id/threat-models', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { threatModelIds } = req.body;
    
    if (!Array.isArray(threatModelIds) || threatModelIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid threat model IDs. Please provide an array of IDs.' 
      });
    }
    
    // Get username from session or use 'system' as fallback (for logs)
    const username = req.session?.username || 'system';
    
    console.log(`Starting assignment of ${threatModelIds.length} threat models to project ${id}`);
    
    // Only support PostgreSQL numeric IDs
    const pgIds = [];
    for (const rawId of threatModelIds) {
      if (/^[0-9]+$/.test(rawId)) {
        pgIds.push(parseInt(rawId, 10));
      } else {
        return res.status(400).json({ success: false, error: 'Only numeric PostgreSQL threat model IDs are supported.' });
      }
    }
    if (pgIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid threat model IDs to assign.' });
    }

    const assignmentPromise = projectAssignmentService.assignThreatModelsToProject(id, pgIds);

    // Respond immediately to prevent UI hanging
    res.status(202).json({ 
      success: true, 
      message: `Assignment of ${pgIds.length} threat model(s) to project started.`
    });

    // Continue processing in the background
    assignmentPromise
      .then(assignedIds => {
        console.log(`Successfully assigned ${assignedIds.length} threat models to project ${id}`);
      })
      .catch(error => {
        console.error(`Error in background assignment for project ${id}:`, error);
      });
  } catch (error) {
    console.error('Error starting threat model assignment:', error);
    
    // Handle specific errors with appropriate status codes
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/projects/:projectId/threat-models/:threatModelId
 * @desc    Remove a threat model assignment from a project
 * @access  Private
 */
router.delete('/projects/:projectId/threat-models/:threatModelId', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId, threatModelId } = req.params;
    
    await projectAssignmentService.removeThreatModelFromProject(projectId, threatModelId);
    
    res.json({ 
      success: true, 
      message: 'Threat model assignment removed successfully' 
    });
  } catch (error) {
    console.error('Error removing threat model assignment:', error);
    
    // Handle specific errors with appropriate status codes
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/projects/:id/clear-cache
 * @desc    Clear the cache for a project's threat models
 * @access  Private
 */
// [REMOVED] POST /projects/:id/clear-cache is deprecated and removed. No-op.

/**
 * @route   GET /api/projects/:id/unassigned-threat-models
 * @desc    Get threat models NOT assigned to a project (with threatCount)
 * @access  Private
 */
router.get('/projects/:id/unassigned-threat-models', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const unassigned = await projectAssignmentService.getUnassignedThreatModelsForProject(id);
    res.json({ success: true, data: unassigned });
  } catch (error) {
    console.error(`[API] Error fetching unassigned threat models for project:`, error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
