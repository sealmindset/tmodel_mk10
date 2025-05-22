/**
 * Component Routes
 * 
 * Handles web routes for component views
 */
const express = require('express');
const router = express.Router();
const Component = require('../database/models/component');
const { ensureAuthenticated } = require('../middleware/auth');
const { getThreatModelsForComponent } = require('../services/projectAssignmentService');

/**
 * @route   GET /components
 * @desc    Display all components
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
    
    res.render('components', {
      components,
      filters: req.query
    });
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).render('error', {
      message: 'Error fetching components',
      error
    });
  }
});

/**
 * @route   GET /components/:id
 * @desc    Display component details
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const component = await Component.getById(req.params.id);
    
    if (!component) {
      return res.status(404).render('error', {
        message: 'Component not found',
        error: { status: 404 }
      });
    }
    
    // Get projects using this component
    const projects = await Component.getProjects(req.params.id);
    
    // Get safeguards for this component
    const safeguards = await Component.getSafeguards(req.params.id);
    
    // Get vulnerabilities for this component
    const vulnerabilities = await Component.getVulnerabilities(req.params.id);
    
    // Get component statistics
    const stats = await Component.getStatistics(req.params.id);
    
    // Calculate vulnerability count for display
    const vulnerabilityCount = vulnerabilities ? vulnerabilities.length : 0;
    
    // Get threat models for this component
    let threatModels = [];
    try {
      threatModels = await getThreatModelsForComponent(req.params.id);
      console.log(`Fetched ${threatModels.length} threat models for component ${req.params.id}`);
    } catch (error) {
      console.error('Error fetching threat models for component:', error);
      // Continue rendering the page even if threat models can't be fetched
    }
    
    res.render('component-detail', {
      component,
      projects,
      safeguards,
      vulnerabilities,
      stats,
      vulnerabilityCount,
      threatModels
    });
  } catch (error) {
    console.error('Error fetching component details:', error);
    res.status(500).render('error', {
      message: 'Error fetching component details',
      error
    });
  }
});

module.exports = router;
