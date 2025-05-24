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
 * @route   GET /components/new
 * @desc    Display form to create a new component
 * @access  Private
 */
router.get('/new', ensureAuthenticated, (req, res) => {
  res.render('component-new', {
    component: {}, // Empty component for the form
    title: 'Create New Component'
  });
});

/**
 * @route   POST /components
 * @desc    Create a new component
 * @access  Private
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    console.log('Creating new component:', req.body);
    const component = await Component.create(req.body);
    
    // Check if this is an AJAX request
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);
    
    if (isAjax) {
      return res.json({ success: true, component });
    }
    
    // For regular form submissions, redirect to component list
    res.redirect('/components');
  } catch (error) {
    console.error('Error creating component:', error);
    
    // Check if this is an AJAX request
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);
    
    if (isAjax) {
      return res.status(400).json({ 
        success: false, 
        error: error.message || 'Failed to create component'
      });
    }
    
    // For regular form submissions, re-render the form with error
    res.render('component-new', {
      component: req.body,
      error: 'Failed to create component: ' + (error.message || error)
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
    // Handle 'new' special case by redirecting to the new component form
    if (req.params.id === 'new') {
      return res.redirect('/components/new');
    }
    
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

/**
 * @route   GET /components/:id/edit
 * @desc    Display form to edit an existing component
 * @access  Private
 */
router.get('/:id/edit', ensureAuthenticated, async (req, res) => {
  try {
    // Handle 'new' special case by redirecting to the new component form
    if (req.params.id === 'new') {
      return res.redirect('/components/new');
    }
    
    const component = await Component.getById(req.params.id);
    
    if (!component) {
      return res.status(404).render('error', {
        message: 'Component not found',
        error: { status: 404 }
      });
    }
    
    res.render('component-edit', {
      component,
      title: 'Edit Component'
    });
  } catch (error) {
    console.error('Error fetching component for editing:', error);
    res.status(500).render('error', {
      message: 'Error fetching component for editing',
      error
    });
  }
});

/**
 * @route   POST /components/:id
 * @desc    Update an existing component
 * @access  Private
 */
router.post('/:id', ensureAuthenticated, async (req, res) => {
  try {
    console.log(`Updating component ${req.params.id}:`, req.body);
    
    const component = await Component.update(req.params.id, req.body);
    
    // Check if this is an AJAX request
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);
    
    if (isAjax) {
      return res.json({ success: true, component });
    }
    
    // For regular form submissions, redirect to component detail
    res.redirect(`/components/${req.params.id}`);
  } catch (error) {
    console.error(`Error updating component ${req.params.id}:`, error);
    
    // Check if this is an AJAX request
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1);
    
    if (isAjax) {
      return res.status(400).json({ 
        success: false, 
        error: error.message || 'Failed to update component'
      });
    }
    
    // For regular form submissions, re-render the form with error
    try {
      const component = await Component.getById(req.params.id);
      // Merge the form data with the fetched component to preserve the ID
      const mergedComponent = { ...component, ...req.body, id: req.params.id };
      
      res.render('component-edit', {
        component: mergedComponent,
        error: 'Failed to update component: ' + (error.message || error)
      });
    } catch (fetchError) {
      // If we can't even fetch the component, render a more generic error
      res.status(500).render('error', {
        message: 'Error updating component',
        error
      });
    }
  }
});

module.exports = router;
