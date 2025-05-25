/**
 * Components API Routes
 */
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../../middleware/auth');
const db = require('../../db/db');
const Component = require('../../database/models/component.js');
const safeguardAssignmentService = require('../../services/safeguardAssignmentService');

/**
 * @route   GET /api/components
 * @desc    Get all components with optional filtering
 * @access  Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { type, is_reusable, tag } = req.query;
    const filters = {};
    
    if (type) filters.type = type;
    if (is_reusable !== undefined) filters.is_reusable = is_reusable === 'true';
    if (tag) filters.tag = tag;
    
    const components = await Component.getAll(filters);
    res.json({ success: true, data: components });
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/components/:id
 * @desc    Get component by ID with related data
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const component = await Component.getById(req.params.id);
    
    if (!component) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }
    
    // Get projects using this component
    const projects = await Component.getProjects(req.params.id);
    
    // Get safeguards for this component
    const safeguards = await Component.getSafeguards(req.params.id);
    
    // Get vulnerabilities for this component
    const vulnerabilities = await Component.getVulnerabilities(req.params.id);
    
    // Get component statistics
    const stats = await Component.getStatistics(req.params.id);
    
    res.json({
      success: true,
      data: {
        component,
        projects,
        safeguards,
        vulnerabilities,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/components
 * @desc    Create a new component
 * @access  Private
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const {
      name,
      type,
      description,
      version,
      is_reusable,
      tags
    } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a component name'
      });
    }
    
    const componentData = {
      name,
      type: type || 'System',
      description,
      version,
      is_reusable: is_reusable !== undefined ? is_reusable : true,
      tags: tags || [],
      created_by: req.user ? req.user.username : 'system'
    };
    
    const component = await Component.create(componentData);
    res.status(201).json({ success: true, data: component });
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   PUT /api/components/:id
 * @desc    Update a component
 * @access  Private
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const component = await Component.getById(req.params.id);
    
    if (!component) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }
    
    const {
      name,
      type,
      description,
      version,
      is_reusable,
      tags
    } = req.body;
    
    const componentData = {
      name: name || component.name,
      type: type || component.type,
      description: description !== undefined ? description : component.description,
      version: version !== undefined ? version : component.version,
      is_reusable: is_reusable !== undefined ? is_reusable : component.is_reusable,
      tags: tags || component.tags
    };
    
    const updatedComponent = await Component.update(req.params.id, componentData);
    res.json({ success: true, data: updatedComponent });
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/components/:id
 * @desc    Delete a component
 * @access  Private
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const deleted = await Component.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/components/:id/safeguards
 * @desc    Get safeguards for a component
 * @access  Private
 */
router.get('/:id/safeguards', ensureAuthenticated, async (req, res) => {
  try {
    const safeguards = await Component.getSafeguards(req.params.id);
    res.json({ success: true, data: safeguards });
  } catch (error) {
    console.error('Error fetching safeguards:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/components/:id/safeguards
 * @desc    Add a safeguard to a component
 * @access  Private
 */
router.post('/:id/safeguards', ensureAuthenticated, async (req, res) => {
  try {
    const { name, type, description, status, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide safeguard name'
      });
    }
    
    // First create the safeguard if it doesn't exist
    // This is a simplified implementation - in a real app, you'd have a separate safeguards API
    // and would check if the safeguard already exists
    const safeguardData = {
      name,
      type: type || 'Technical',
      description: description || '',
      created_by: req.user ? req.user.username : 'system'
    };
    
    // Add safeguard to component
    const result = await Component.addSafeguard(
      req.params.id,
      safeguardData,
      status || 'Implemented',
      notes || ''
    );
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding safeguard:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/components/:id/safeguards/:safeguardId
 * @desc    Remove a safeguard from a component
 * @access  Private
 */
router.delete('/:id/safeguards/:safeguardId', ensureAuthenticated, async (req, res) => {
  try {
    const result = await Component.removeSafeguard(req.params.id, req.params.safeguardId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Safeguard not found for this component'
      });
    }
    
    res.json({ success: true, data: { message: 'Safeguard removed from component' } });
  } catch (error) {
    console.error('Error removing safeguard:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   PUT /api/components/:id/safeguards/:safeguardId
 * @desc    Update a safeguard for a component
 * @access  Private
 */
router.put('/:id/safeguards/:safeguardId', ensureAuthenticated, async (req, res) => {
  try {
    const { name, type, description, status, notes } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide safeguard name'
      });
    }
    
    // Update the safeguard
    const safeguardData = {
      name,
      type: type || 'Technical',
      description: description || ''
    };
    
    const result = await Component.updateSafeguard(
      req.params.id,
      req.params.safeguardId,
      safeguardData,
      status || 'Implemented',
      notes || ''
    );
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating safeguard:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/components/:id/vulnerabilities
 * @desc    Get vulnerabilities for a component
 * @access  Private
 */
router.get('/:id/vulnerabilities', ensureAuthenticated, async (req, res) => {
  try {
    const vulnerabilities = await Component.getVulnerabilities(req.params.id);
    res.json({ success: true, data: vulnerabilities });
  } catch (error) {
    console.error('Error fetching vulnerabilities:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/components/:id/projects
 * @desc    Get projects using this component
 * @access  Private
 */
router.get('/:id/projects', ensureAuthenticated, async (req, res) => {
  try {
    const projects = await Component.getProjects(req.params.id);
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/components/:id/statistics
 * @desc    Get component statistics
 * @access  Private
 */
router.get('/:id/statistics', ensureAuthenticated, async (req, res) => {
  try {
    const stats = await Component.getStatistics(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching component statistics:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/components/:id/unassigned-safeguards
 * @desc    Get safeguards not assigned to a component
 * @access  Private
 */
router.get('/:id/unassigned-safeguards', ensureAuthenticated, async (req, res) => {
  try {
    const unassignedSafeguards = await safeguardAssignmentService.getUnassignedSafeguardsForComponent(req.params.id);
    res.json({ success: true, data: unassignedSafeguards });
  } catch (error) {
    console.error('Error fetching unassigned safeguards:', error);
    res.status(500).json({ error: 'Failed to fetch unassigned safeguards' });
  }
});

/**
 * @route   POST /api/components/:id/safeguards/assign
 * @desc    Assign multiple safeguards to a component
 * @access  Private
 */
router.post('/:id/safeguards/assign', ensureAuthenticated, async (req, res) => {
  try {
    // Support both 'ids' and 'safeguardIds' format for backward compatibility
    const { ids, safeguardIds } = req.body;
    const safeguardIDsToAssign = ids || safeguardIds || [];
    
    if (!Array.isArray(safeguardIDsToAssign) || safeguardIDsToAssign.length === 0) {
      return res.status(400).json({ error: 'No safeguard IDs provided or invalid format' });
    }
    
    const result = await safeguardAssignmentService.assignSafeguardsToComponentWithLogging(req.params.id, safeguardIDsToAssign);
    
    if (result.success) {
      res.json({ success: true, count: result.count, ids: result.ids });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error assigning safeguards:', error);
    res.status(500).json({ error: 'Failed to assign safeguards' });
  }
});

/**
 * @route   DELETE /api/components/:id/safeguards/:safeguardId
 * @desc    Remove a safeguard from a component
 * @access  Private
 */
router.delete('/:id/safeguards/:safeguardId', ensureAuthenticated, async (req, res) => {
  try {
    const result = await safeguardAssignmentService.removeSafeguardFromComponent(
      req.params.id,
      req.params.safeguardId
    );
    
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error removing safeguard:', error);
    res.status(500).json({ error: 'Failed to remove safeguard' });
  }
});

module.exports = router;
