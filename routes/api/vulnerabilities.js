/**
 * Vulnerabilities API Routes
 */
const express = require('express');
const router = express.Router();
const Vulnerability = require('../../database/models/vulnerability');
const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * @route   GET /api/vulnerabilities
 * @desc    Get all vulnerabilities with optional filtering
 * @access  Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { source, severity, status, component_id, cve_id } = req.query;
    const filters = {};
    
    if (source) filters.source = source;
    if (severity) filters.severity = severity;
    if (status) filters.status = status;
    if (component_id) filters.component_id = component_id;
    if (cve_id) filters.cve_id = cve_id;
    
    const vulnerabilities = await Vulnerability.getAll(filters);
    res.json({ success: true, data: vulnerabilities });
  } catch (error) {
    console.error('Error fetching vulnerabilities:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/vulnerabilities/:id
 * @desc    Get vulnerability by ID
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const vulnerability = await Vulnerability.getById(req.params.id);
    
    if (!vulnerability) {
      return res.status(404).json({ success: false, error: 'Vulnerability not found' });
    }
    
    // Get related threats
    const threats = await Vulnerability.getRelatedThreats(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...vulnerability,
        related_threats: threats
      }
    });
  } catch (error) {
    console.error('Error fetching vulnerability:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   PUT /api/vulnerabilities/:id
 * @desc    Update a vulnerability
 * @access  Private
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const vulnerability = await Vulnerability.getById(req.params.id);
    
    if (!vulnerability) {
      return res.status(404).json({ success: false, error: 'Vulnerability not found' });
    }
    
    const {
      name,
      description,
      component_id,
      severity,
      cvss_score,
      cve_id,
      status,
      remediation_steps
    } = req.body;
    
    const vulnerabilityData = {
      name: name || vulnerability.name,
      description: description || vulnerability.description,
      component_id: component_id || vulnerability.component_id,
      severity: severity || vulnerability.severity,
      cvss_score: cvss_score !== undefined ? cvss_score : vulnerability.cvss_score,
      cve_id: cve_id || vulnerability.cve_id,
      status: status || vulnerability.status,
      remediation_steps: remediation_steps || vulnerability.remediation_steps,
      last_checked: new Date()
    };
    
    const updatedVulnerability = await Vulnerability.update(req.params.id, vulnerabilityData);
    res.json({ success: true, data: updatedVulnerability });
  } catch (error) {
    console.error('Error updating vulnerability:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/vulnerabilities/:id
 * @desc    Delete a vulnerability
 * @access  Private
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const deleted = await Vulnerability.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Vulnerability not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting vulnerability:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/vulnerabilities/:id/threats
 * @desc    Link vulnerability to a threat
 * @access  Private
 */
router.post('/:id/threats', ensureAuthenticated, async (req, res) => {
  try {
    const { threat_id, match_confidence, notes } = req.body;
    
    if (!threat_id) {
      return res.status(400).json({
        success: false,
        error: 'Please provide threat_id'
      });
    }
    
    const result = await Vulnerability.linkToThreat(
      req.params.id,
      threat_id,
      match_confidence || 80,
      notes
    );
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error linking vulnerability to threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/vulnerabilities/:id/threats/:threatId
 * @desc    Unlink vulnerability from a threat
 * @access  Private
 */
router.delete('/:id/threats/:threatId', ensureAuthenticated, async (req, res) => {
  try {
    const result = await Vulnerability.unlinkFromThreat(
      req.params.id,
      req.params.threatId
    );
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Threat link not found for this vulnerability'
      });
    }
    
    res.json({ success: true, data: { message: 'Threat unlinked from vulnerability' } });
  } catch (error) {
    console.error('Error unlinking vulnerability from threat:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/vulnerabilities/stats/overview
 * @desc    Get vulnerability statistics
 * @access  Private
 */
router.get('/stats/overview', ensureAuthenticated, async (req, res) => {
  try {
    const stats = await Vulnerability.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching vulnerability statistics:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
