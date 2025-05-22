/**
 * Safeguards API Routes
 */
const express = require('express');
const router = express.Router();
const Safeguard = require('../../database/models/safeguard');
const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * @route   GET /api/safeguards
 * @desc    Get all safeguards with optional filtering
 * @access  Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { type, implementation_status, effectiveness_min } = req.query;
    const filters = {};
    
    if (type) filters.type = type;
    if (implementation_status) filters.implementation_status = implementation_status;
    if (effectiveness_min) filters.effectiveness_min = parseInt(effectiveness_min);
    
    const safeguards = await Safeguard.getAll(filters);
    res.json({ success: true, data: safeguards });
  } catch (error) {
    console.error('Error fetching safeguards:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/safeguards/:id
 * @desc    Get safeguard by ID
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const safeguard = await Safeguard.getById(req.params.id);
    
    if (!safeguard) {
      return res.status(404).json({ success: false, error: 'Safeguard not found' });
    }
    
    // Get components using this safeguard
    const components = await Safeguard.getComponents(req.params.id);
    
    // Get compliance requirements
    const requirements = await Safeguard.getComplianceRequirements(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...safeguard,
        components,
        compliance_requirements: requirements
      }
    });
  } catch (error) {
    console.error('Error fetching safeguard:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/safeguards
 * @desc    Create a new safeguard
 * @access  Private
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const {
      name,
      type,
      description,
      effectiveness,
      implementation_status,
      implementation_details,
      verification_method
    } = req.body;
    
    // Validation
    if (!name || !type || !description) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, type, and description'
      });
    }
    
    const safeguardData = {
      name,
      type,
      description,
      effectiveness: effectiveness || 50,
      implementation_status: implementation_status || 'Planned',
      implementation_details,
      verification_method,
      created_by: req.user.id
    };
    
    const safeguard = await Safeguard.create(safeguardData);
    res.status(201).json({ success: true, data: safeguard });
  } catch (error) {
    console.error('Error creating safeguard:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   PUT /api/safeguards/:id
 * @desc    Update a safeguard
 * @access  Private
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const safeguard = await Safeguard.getById(req.params.id);
    
    if (!safeguard) {
      return res.status(404).json({ success: false, error: 'Safeguard not found' });
    }
    
    const {
      name,
      type,
      description,
      effectiveness,
      implementation_status,
      implementation_details,
      verification_method,
      last_verified
    } = req.body;
    
    const safeguardData = {
      name: name || safeguard.name,
      type: type || safeguard.type,
      description: description || safeguard.description,
      effectiveness: effectiveness !== undefined ? effectiveness : safeguard.effectiveness,
      implementation_status: implementation_status || safeguard.implementation_status,
      implementation_details: implementation_details !== undefined ? implementation_details : safeguard.implementation_details,
      verification_method: verification_method || safeguard.verification_method,
      last_verified: last_verified || safeguard.last_verified
    };
    
    const updatedSafeguard = await Safeguard.update(req.params.id, safeguardData);
    res.json({ success: true, data: updatedSafeguard });
  } catch (error) {
    console.error('Error updating safeguard:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/safeguards/:id
 * @desc    Delete a safeguard
 * @access  Private
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const deleted = await Safeguard.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Safeguard not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting safeguard:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/safeguards/:id/compliance
 * @desc    Add compliance requirement to safeguard
 * @access  Private
 */
router.post('/:id/compliance', ensureAuthenticated, async (req, res) => {
  try {
    const { requirement_id, notes } = req.body;
    
    if (!requirement_id) {
      return res.status(400).json({
        success: false,
        error: 'Please provide requirement_id'
      });
    }
    
    const result = await Safeguard.addComplianceRequirement(
      req.params.id,
      requirement_id,
      notes
    );
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding compliance requirement:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/safeguards/:id/compliance/:requirementId
 * @desc    Remove compliance requirement from safeguard
 * @access  Private
 */
router.delete('/:id/compliance/:requirementId', ensureAuthenticated, async (req, res) => {
  try {
    const result = await Safeguard.removeComplianceRequirement(
      req.params.id,
      req.params.requirementId
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Compliance requirement not found for this safeguard'
      });
    }
    
    res.json({ success: true, data: { message: 'Compliance requirement removed' } });
  } catch (error) {
    console.error('Error removing compliance requirement:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/safeguards/stats/effectiveness
 * @desc    Get safeguard effectiveness statistics
 * @access  Private
 */
router.get('/stats/effectiveness', ensureAuthenticated, async (req, res) => {
  try {
    const stats = await Safeguard.getEffectivenessStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching safeguard statistics:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
