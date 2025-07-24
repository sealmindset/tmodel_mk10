/**
 * Project Mapper API Routes
 * Provides compatibility layer between different project ID formats
 * 
 * NOTE: This API provides project verification functionality
 * for the threat model and reports integration.
 * - Supports both UUID and integer ID formats
 * - Maps UUIDs to integer IDs for cross-schema compatibility
 */
const express = require('express');
const router = express.Router();
const pool = require('../../db/db');
const logger = require('../../logger');

/**
 * @route   GET /api/project-mapper/:projectId
 * @desc    Map project ID across formats (UUID to integer and verify existence)
 * @access  Public
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    let projectQuery;
    
    // Check if projectId looks like a UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(projectId);
    
    if (isUuid) {
      // If UUID format, use it directly to query threat_model.projects
      projectQuery = await pool.query(
        'SELECT id, name FROM threat_model.projects WHERE id = $1::uuid',
        [projectId]
      );
    } else {
      // Try to convert projectId to integer
      const projectIdInt = parseInt(projectId, 10);
      
      // Check if conversion was successful
      if (isNaN(projectIdInt)) {
        return res.status(400).json({
          success: false,
          error: `Invalid project ID format: ${projectId} is neither a valid UUID nor an integer`
        });
      }
      
      // Query by integer ID
      projectQuery = await pool.query(
        'SELECT id, name FROM threat_model.projects WHERE id = $1',
        [projectIdInt]
      );
    }
    
    // Check if project exists
    if (projectQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Project with ID ${projectId} not found`
      });
    }
    
    const projectData = projectQuery.rows[0];
    
    // Generate an integer ID for reports.report table compatibility
    // For real implementation, this should be a lookup to an actual mapping table
    // or use a hash function to generate a consistent integer from the UUID
    const integerIdQuery = await pool.query(
      "SELECT CASE WHEN $1::text ~ '^[0-9]+$' THEN $1::integer ELSE abs(('x' || md5($1))::bit(31)::integer) END as int_id",
      [projectId]
    );
    
    const mappedIntegerId = integerIdQuery.rows[0].int_id;
    
    // Return the project information with both ID formats
    return res.json({
      success: true,
      projectUuid: projectData.id,
      projectId: mappedIntegerId,
      integerId: mappedIntegerId,
      name: projectData.name
    });
    
  } catch (error) {
    logger.error(`Error in project mapping: ${error.message}`, error);
    res.status(500).json({
      success: false,
      error: `Project mapping failed: ${error.message}`
    });
  }
});

/**
 * @route   GET /api/project-mapper
 * @desc    Return information about UUID standardization status
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Project mapper API provides project verification between threat model and reports.',
    apiStatus: 'active'
  });
});

module.exports = router;
