/**
 * Projects API Routes
 */
const express = require('express');
const router = express.Router();
const Project = require('../../database/models/project');
const db = require('../../database');
const { ensureAuthenticated } = require('../../middleware/auth');

/**
 * @route   GET /api/projects
 * @desc    Get all projects with optional filtering
 * @access  Private
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const { business_unit, criticality, status } = req.query;
    const filters = {};
    
    if (business_unit) filters.business_unit = business_unit;
    if (criticality) filters.criticality = criticality;
    if (status) filters.status = status;
    
    const projects = await Project.getAll(filters);
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/projects/:id
 * @desc    Get project by ID with components and threat models
 * @access  Private
 */
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const project = await Project.getById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Get components for this project
    const components = await Project.getComponents(req.params.id);
    
    // Get threat models for this project
    const threatModels = await Project.getThreatModels(req.params.id);
    
    res.json({
      success: true,
      data: {
        ...project,
        components,
        threat_models: threatModels
      }
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/projects
 * @desc    Create a new project with optional components
 * @access  Private
 */
router.post('/', ensureAuthenticated, async (req, res) => {
  // Log incoming request data
  console.log('[Project Create][Request]', JSON.stringify(req.body));
  try {
    const {
      name,
      description,
      business_unit,
      criticality,
      data_classification,
      status,
      components
    } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a project name'
      });
    }
    
    const projectData = {
      name,
      description,
      business_unit,
      criticality: criticality || 'Medium',
      data_classification: data_classification || 'Other: Internal Use Only',
      status: status || 'Active',
      created_by: req.user ? req.user.username : 'system'
    };
    
    // Start a transaction to ensure all operations succeed or fail together
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      // Create the project
      // Log project creation attempt
      console.log('[Project Create][DB Insert]', JSON.stringify(projectData));
      const project = await Project.create(projectData);
      console.log('[Project Create][DB Success]', JSON.stringify(project));
      
      // Add components if provided
      if (components && Array.isArray(components) && components.length > 0) {
        // Filter out empty components
        const validComponents = components.filter(comp => comp.name && comp.name.trim() !== '');
        
        for (const component of validComponents) {
          // Create each component
          const newComponent = await Project.createComponent({
            name: component.name,
            hostname: component.hostname,
            ip_address: component.ip_address,
            type: component.type
          });
          
          // Link component to project
          await Project.addComponentToProject(project.id, newComponent.id);
        }
      }
      
      await client.query('COMMIT');
      
      // Get the project with components
      const fullProject = await Project.getById(project.id);
      const projectComponents = await Project.getComponents(project.id);
      
      res.status(201).json({ 
        success: true, 
        data: {
          ...fullProject,
          components: projectComponents
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      // Log DB error details
      console.error('[Project Create][DB Error]', err);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   PUT /api/projects/:id
 * @desc    Update a project
 * @access  Private
 */
router.put('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const project = await Project.getById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    const {
      name,
      description,
      business_unit,
      criticality,
      data_classification,
      status
    } = req.body;
    
    const projectData = {
      name: name || project.name,
      description: description !== undefined ? description : project.description,
      business_unit: business_unit || project.business_unit,
      criticality: criticality || project.criticality,
      data_classification: data_classification || project.data_classification,
      status: status || project.status
    };
    
    const updatedProject = await Project.update(req.params.id, projectData);
    res.json({ success: true, data: updatedProject });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project
 * @access  Private
 */
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const deleted = await Project.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/projects/:id/components
 * @desc    Add a component to a project
 * @access  Private
 */
router.post('/:id/components', ensureAuthenticated, async (req, res) => {
  try {
    const { component_id, notes } = req.body;
    
    if (!component_id) {
      return res.status(400).json({
        success: false,
        error: 'Please provide component_id'
      });
    }
    
    const result = await Project.addComponent(req.params.id, component_id, notes);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error adding component to project:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/projects/:id/components/:componentId
 * @desc    Remove a component from a project
 * @access  Private
 */
router.delete('/:id/components/:componentId', ensureAuthenticated, async (req, res) => {
  try {
    const result = await Project.removeComponent(req.params.id, req.params.componentId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Component not found in this project'
      });
    }
    
    res.json({ success: true, data: { message: 'Component removed from project' } });
  } catch (error) {
    console.error('Error removing component from project:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/projects/:id/statistics
 * @desc    Get project statistics
 * @access  Private
 */
router.get('/:id/statistics', ensureAuthenticated, async (req, res) => {
  try {
    const stats = await Project.getStatistics(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching project statistics:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/projects/business-units/list
 * @desc    Get list of all business units
 * @access  Private
 */
router.get('/business-units/list', ensureAuthenticated, async (req, res) => {
  try {
    const businessUnits = await Project.getBusinessUnits();
    res.json({ success: true, data: businessUnits });
  } catch (error) {
    console.error('Error fetching business units:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   GET /api/projects/:id/unassigned-threat-models
 * @desc    Get threat models NOT assigned to a project
 * @access  Private
 */
const projectAssignmentService = require('../../services/projectAssignmentService');
// Helper: Validate UUID v4
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

router.get('/:id/unassigned-threat-models', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID. Must be a valid UUID.' });
    }
    console.log(`[UNASSIGNED-THREAT-MODELS] Incoming request for project id: ${id}`);
    const models = await projectAssignmentService.getUnassignedThreatModelsForProject(id);
    console.log(`[UNASSIGNED-THREAT-MODELS] Models returned for project ${id}:`, Array.isArray(models) ? models.length : models, models);
    res.json({ success: true, data: models });
  } catch (error) {
    console.error('[UNASSIGNED-THREAT-MODELS] Error fetching unassigned threat models:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * @route   POST /api/projects/:id/threat-models
 * @desc    Assign threat models to a project (batch)
 * @access  Private
 */
router.post('/:id/threat-models', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidUUID(id)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID. Must be a valid UUID.' });
    }
    const { threatModelIds } = req.body;
    if (!Array.isArray(threatModelIds) || threatModelIds.length === 0) {
      return res.status(400).json({ success: false, error: 'threatModelIds must be a non-empty array' });
    }
    console.log(`[ASSIGN-THREAT-MODELS] Incoming assignment for project ${id}:`, threatModelIds);
    const result = await projectAssignmentService.assignThreatModelsToProjectWithLogging(id, threatModelIds);
    if (result) {
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'No threat models assigned. See logs for details.' });
    }
  } catch (error) {
    console.error('[ASSIGN-THREAT-MODELS] Error assigning threat models:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
