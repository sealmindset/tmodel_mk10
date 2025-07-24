/**
 * Report Generator API Routes
 * Handles report generation and management endpoints
 */

const express = require('express');
const router = express.Router();
const pool = require('../../db/db');
const reportContextUtil = require('../../utils/reportContextUtil');
const logger = require('../../logger');

/**
 * Generate a report with LLM-generated content and save it to the database
 * POST /api/report-generator/complete
 */
router.post('/complete', async (req, res) => {
  logger.info('Received request to generate complete report', { body: req.body });
  
  const {
    projectId,
    title,
    templateId,
    templateName,
    provider,
    model,
    sections
  } = req.body;

  // Validate request data
  if (!projectId || !title || !sections || !sections.length) {
    logger.warn('Invalid report generation request', { body: req.body });
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  try {
    // Determine if projectId is UUID or integer
    const isUuid = typeof projectId === 'string' && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    logger.info(`Project ID type: ${isUuid ? 'UUID' : 'Integer'}`, { projectId, isUuid });
    
    // 1. Get project context (including threat models, components, etc.)
    logger.info('Fetching project context', { projectId });
    const context = await reportContextUtil.getProjectContext(projectId, isUuid);

    // 2. Generate content for each requested section
    logger.info('Generating report sections', { sections, provider, model });
    const reportContent = await reportContextUtil.generateCompleteReport(
      projectId, 
      sections, 
      provider, 
      model, 
      isUuid,
      context,
      templateId
    );
    
    // 3. Prepare content for storage
    let contentToStore;
    if (typeof reportContent === 'string') {
      contentToStore = reportContent;
    } else if (typeof reportContent === 'object') {
      contentToStore = JSON.stringify(reportContent);
    } else {
      contentToStore = String(reportContent);
    }

    // 4. Create a new report record in the database
    let projectIdForStorage = projectId;
    let projectUuidForStorage = null;
    
    // For UUID support, we need to handle storing both project_id and project_uuid
    if (isUuid) {
      projectUuidForStorage = projectId;
      // Get the integer project ID if needed for foreign key constraints
      try {
        const projectMapperResponse = await fetch(`http://localhost:3000/api/project-mapper/${projectId}`);
        if (projectMapperResponse.ok) {
          const projectMapperData = await projectMapperResponse.json();
          if (projectMapperData.integerId) {
            projectIdForStorage = projectMapperData.integerId;
          }
        } else {
          logger.warn(`Project mapper returned status ${projectMapperResponse.status}`);
        }
      } catch (error) {
        logger.warn(`Could not get integer project ID from mapper, using UUID directly: ${error.message}`);
      }
      if (!projectIdForStorage) {
        // Fallback: attempt DB lookup only if mapper did not give us an ID
        try {
          const idResult = await pool.query('SELECT id FROM reports.project_map WHERE uuid = $1', [projectId]);
          if (idResult.rows.length) {
            projectIdForStorage = idResult.rows[0].id;
          } else {
            throw new Error('No integer mapping found for project UUID');
          }
        } catch (error) {
          logger.error(`Failed to map project UUID to integer ID: ${error.message}`);
          return res.status(400).json({ error: 'Unable to map project UUID to internal project ID' });
        }
      }
    }
    
    logger.info('Creating new report record', {
      projectId: projectIdForStorage,
      projectUuid: projectUuidForStorage,
      title,
      templateId
    });

    // Insert into reports.report table
    const createReportQuery = `
      INSERT INTO reports.report (
        project_id,
        project_uuid,
        title,
        template_id,
        content,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, project_id, title, created_at;
    `;

    const reportResult = await pool.query(createReportQuery, [
      projectIdForStorage,
      projectUuidForStorage,
      title,
      templateId || null,
      contentToStore
    ]);

    const newReport = reportResult.rows[0];
    logger.info('Report created successfully', { reportId: newReport.id });

    // Return success with the new report ID
    return res.status(201).json({
      success: true,
      message: 'Report generated successfully',
      report: newReport
    });
  } catch (error) {
    logger.error(`Failed to generate report: ${error.message}`, { 
      error: error.stack,
      projectId,
      sections
    });
    
    return res.status(500).json({ 
      error: `Failed to generate report: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Regenerate a specific section of an existing report
 * POST /api/report-generator/regenerate-section
 */
router.post('/regenerate-section', async (req, res) => {
  logger.info('Received request to regenerate report section', { body: req.body });
  
  const {
    reportId,
    sectionType,
    provider,
    model
  } = req.body;

  // Validate request
  if (!reportId || !sectionType) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Get the report from the database
    const reportQuery = await pool.query(
      'SELECT id, project_id, project_uuid, title, content FROM reports.report WHERE id = $1',
      [reportId]
    );

    if (reportQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportQuery.rows[0];
    const projectId = report.project_uuid || report.project_id;
    const isUuid = !!report.project_uuid;

    // Generate the new section content
    const sectionContent = await reportContextUtil.generateSectionContent(
      projectId,
      sectionType,
      provider || 'openai',
      model,
      isUuid
    );

    // Parse existing content
    let existingContent;
    try {
      existingContent = typeof report.content === 'string' 
        ? JSON.parse(report.content) 
        : report.content;
    } catch (e) {
      // If parsing fails, treat content as a string
      existingContent = { sections: { [sectionType]: report.content } };
    }

    // If content is a string or doesn't have sections property
    if (typeof existingContent !== 'object' || !existingContent.sections) {
      existingContent = { 
        sections: { [sectionType]: existingContent }
      };
    }

    // Update the specified section
    existingContent.sections[sectionType] = sectionContent;

    // Update the report in the database
    const updateQuery = await pool.query(
      'UPDATE reports.report SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, updated_at',
      [JSON.stringify(existingContent), reportId]
    );

    return res.status(200).json({
      success: true,
      message: `Section "${sectionType}" regenerated successfully`,
      report: updateQuery.rows[0],
      updatedSection: sectionType,
      sectionContent
    });
  } catch (error) {
    logger.error(`Failed to regenerate section: ${error.message}`, { 
      error: error.stack,
      reportId,
      sectionType
    });
    
    return res.status(500).json({ 
      error: `Failed to regenerate section: ${error.message}`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
