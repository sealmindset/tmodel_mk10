/**
 * Threats API Routes
 */
const express = require('express');
const router = express.Router();
const Threat = require('../../database/models/threat');
const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * @route   GET /api/threats
 * @desc    Get all threats with optional filtering
 * @access  Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { 
      threat_model_id, 
      category, 
      status, 
      min_risk_score, 
      max_risk_score 
    } = req.query;
    
    const filters = {};
    
    if (threat_model_id) filters.threat_model_id = threat_model_id;
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (min_risk_score) filters.min_risk_score = parseInt(min_risk_score);
    if (max_risk_score) filters.max_risk_score = parseInt(max_risk_score);
    
    const threats = await Threat.getAll(filters);
    res.json({ success: true, data: threats });
  } catch (error) {
    console.error('Error fetching threats:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/threats/:id
 * @desc    Get threat by ID
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const threat = await Threat.getById(req.params.id);
    
    if (!threat) {
      return res.status(404).json({ success: false, error: 'Threat not found' });
    }
    
    // Get safeguards for this threat
    const safeguards = await Threat.getSafeguards(req.params.id);
    
    // Get vulnerabilities related to this threat
    const vulnerabilities = await Threat.getVulnerabilities(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...threat,
        safeguards,
        vulnerabilities
      }
    });
  } catch (error) {
    console.error('Error fetching threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/threats
 * @desc    Create a new threat
 * @access  Private
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const {
      threat_model_id,
      name,
      description,
      category,
      likelihood,
      impact,
      risk_score,
      status
    } = req.body;
    
    // Validation
    if (!threat_model_id || !name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Please provide threat_model_id, name, and category'
      });
    }
    
    // Calculate risk score if not provided
    let calculatedRiskScore = risk_score;
    if (!calculatedRiskScore && likelihood && impact) {
      const likelihoodScore = getLikelihoodScore(likelihood);
      const impactScore = getImpactScore(impact);
      calculatedRiskScore = likelihoodScore * impactScore;
    }
    
    const threatData = {
      threat_model_id,
      name,
      description,
      category,
      likelihood: likelihood || 'Medium',
      impact: impact || 'Medium',
      risk_score: calculatedRiskScore || 50,
      status: status || 'Open',
      created_by: req.user.id
    };
    
    const threat = await Threat.create(threatData);
    res.status(201).json({ success: true, data: threat });
  } catch (error) {
    console.error('Error creating threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   PUT /api/threats/:id
 * @desc    Update a threat
 * @access  Private
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const threat = await Threat.getById(req.params.id);
    
    if (!threat) {
      return res.status(404).json({ success: false, error: 'Threat not found' });
    }
    
    const {
      name,
      description,
      category,
      likelihood,
      impact,
      risk_score,
      status,
      mitigation_notes
    } = req.body;
    
    // Calculate risk score if likelihood or impact changed but risk_score not provided
    let calculatedRiskScore = risk_score;
    if (!calculatedRiskScore && (likelihood || impact)) {
      const likelihoodScore = getLikelihoodScore(likelihood || threat.likelihood);
      const impactScore = getImpactScore(impact || threat.impact);
      calculatedRiskScore = likelihoodScore * impactScore;
    }
    
    const threatData = {
      name: name || threat.name,
      description: description || threat.description,
      category: category || threat.category,
      likelihood: likelihood || threat.likelihood,
      impact: impact || threat.impact,
      risk_score: calculatedRiskScore || threat.risk_score,
      status: status || threat.status,
      mitigation_notes: mitigation_notes !== undefined ? mitigation_notes : threat.mitigation_notes
    };
    
    const updatedThreat = await Threat.update(req.params.id, threatData);
    res.json({ success: true, data: updatedThreat });
  } catch (error) {
    console.error('Error updating threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/threats/:id
 * @desc    Delete a threat
 * @access  Private
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const deleted = await Threat.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Threat not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/threats/:id/safeguards
 * @desc    Add a safeguard to a threat
 * @access  Private
 */
router.post('/:id/safeguards', ensureAuthenticated, async (req, res) => {
  try {
    const { safeguard_id, effectiveness, notes } = req.body;
    
    if (!safeguard_id) {
      return res.status(400).json({
        success: false,
        error: 'Please provide safeguard_id'
      });
    }
    
    const result = await Threat.addSafeguard(
      req.params.id,
      safeguard_id,
      { effectiveness, notes }
    );
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding safeguard to threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/threats/:id/safeguards/:safeguardId
 * @desc    Remove a safeguard from a threat
 * @access  Private
 */
router.delete('/:id/safeguards/:safeguardId', ensureAuthenticated, async (req, res) => {
  try {
    const result = await Threat.removeSafeguard(
      req.params.id,
      req.params.safeguardId
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Safeguard not found for this threat'
      });
    }
    
    res.json({ success: true, data: { message: 'Safeguard removed from threat' } });
  } catch (error) {
    console.error('Error removing safeguard from threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/threats/metrics/risk
 * @desc    Get risk metrics for threats
 * @access  Private
 */
router.get('/metrics/risk', ensureAuthenticated, async (req, res) => {
  try {
    const { threat_model_id } = req.query;
    const metrics = await Threat.calculateRiskMetrics(threat_model_id);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error calculating risk metrics:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/threats/metrics/matrix
 * @desc    Get risk matrix data
 * @access  Private
 */
router.get('/metrics/matrix', ensureAuthenticated, async (req, res) => {
  try {
    const { threat_model_id } = req.query;
    const matrix = await Threat.generateRiskMatrix(threat_model_id);
    res.json({ success: true, data: matrix });
  } catch (error) {
    console.error('Error generating risk matrix:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Helper functions
function getLikelihoodScore(likelihood) {
  switch (likelihood.toLowerCase()) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 2;
  }
}

function getImpactScore(impact) {
  switch (impact.toLowerCase()) {
    case 'high': return 30;
    case 'medium': return 20;
    case 'low': return 10;
    default: return 20;
  }
}

module.exports = router;
